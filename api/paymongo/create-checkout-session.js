const admin = require('../_lib/firebaseAdmin');

async function isAdminToken(db, idToken){
  if(!idToken || typeof idToken !== 'string') return false;
  try{
    const decoded = await admin.auth().verifyIdToken(idToken);
    const snap = await db.collection('users').doc(decoded.uid).get();
    return snap.exists && snap.data().role === 'admin';
  } catch(err){
    console.error('Test-mode token check failed', err && err.message);
    return false;
  }
}

module.exports = async (req, res) => {
  // Allow browser/Capacitor app to call this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS') return res.status(200).end();

  if(req.method !== 'POST'){
    return res.status(405).json({ error: 'method-not-allowed' });
  }

  const { orderId, method, testMode, idToken } = req.body || {};
  if(!orderId){
    return res.status(400).json({ error: 'missing-order-id' });
  }

  const db = admin.firestore();

  // ----- which PayMongo key does this request use? -----
  // PAYMONGO_DEMO_MODE=true forces EVERY checkout onto the test key, so
  // trial users can pay with PayMongo's simulated QR Ph without real money.
  const demoMode = process.env.PAYMONGO_DEMO_MODE === 'true';
  const wantsTest = demoMode || testMode === true;
  let secretKey;
  if(wantsTest){
    if(!process.env.PAYMONGO_TEST_SECRET_KEY){
      return res.status(500).json({ error: 'paymongo-test-not-configured' });
    }
    if(!demoMode && !(await isAdminToken(db, idToken))){
      return res.status(403).json({ error: 'test-mode-admin-only' });
    }
    secretKey = process.env.PAYMONGO_TEST_SECRET_KEY;
    // Never let "test mode" run on a live key by misconfiguration.
    if(!secretKey.startsWith('sk_test_')){
      console.error('PAYMONGO_TEST_SECRET_KEY is not an sk_test_ key — refusing.');
      return res.status(500).json({ error: 'paymongo-bad-key' });
    }
  } else {
    secretKey = process.env.PAYMONGO_SECRET_KEY;
    if(!secretKey){
      return res.status(500).json({ error: 'paymongo-not-configured' });
    }
    if(!/^sk_(test|live)_/.test(secretKey)){
      console.error('PAYMONGO_SECRET_KEY is not a PayMongo secret key (expected sk_live_... or sk_test_...).');
      return res.status(500).json({ error: 'paymongo-bad-key' });
    }
    if(secretKey.startsWith('sk_test_')){
      // Not blocked (handy while developing) but loudly logged: a test key can
      // never take real money, so real GCash / QR Ph / card payments will fail.
      console.warn('PAYMONGO_SECRET_KEY is an sk_test_ key — real payments cannot succeed until it is replaced with the sk_live_ key.');
    }
  }

  // Whitelist — never pass an arbitrary client-supplied string
  // straight into the PayMongo request.
  const ALLOWED_METHODS = ['qrph', 'card'];
  const paymentMethodType = ALLOWED_METHODS.includes(method) ? method : 'qrph';

  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();
  if(!orderSnap.exists){
    return res.status(404).json({ error: 'order-not-found' });
  }
  const order = orderSnap.data();
  if(order.paymentStatus === 'paid'){
    return res.status(409).json({ error: 'already-paid' });
  }

  // The amount PayMongo charges comes entirely from what's already in
  // Firestore for this order, never from anything the browser sends
  // to this endpoint — otherwise a tampered request could check out
  // for less than the real total while Firestore still shows the
  // full order as placed.
  const lineItems = [];
  for(const it of (order.items || [])){
    const amount = Math.round(Number(it.price) * 100); // PayMongo wants centavos
    const quantity = Math.floor(Number(it.qty));
    if(!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(quantity) || quantity < 1){
      console.error('Order has an item with a bad price/qty', orderId, it);
      return res.status(400).json({ error: 'invalid-order-item' });
    }
    lineItems.push({ name: String(it.name || 'Item').slice(0, 250), amount, currency: 'PHP', quantity });
  }
  if(order.fulfillment === 'delivery' && order.totals && order.totals.deliveryFee){
    lineItems.push({
      name: 'Delivery fee',
      amount: Math.round(order.totals.deliveryFee * 100),
      currency: 'PHP',
      quantity: 1
    });
  }
  if(!lineItems.length){
    return res.status(400).json({ error: 'order-has-no-items' });
  }

  const siteUrl = `https://${req.headers.host}`;
  const shortId = orderId.slice(0, 6).toUpperCase();
  const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');

  let pmRes, pmData;
  try{
    pmRes = await fetch('https://api.paymongo.com/v2/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: lineItems,
            payment_method_types: [paymentMethodType],
            reference_number: orderId,
            description: `Crafts & Crumbs order #${shortId}${wantsTest ? ' (TEST)' : ''}`,
            success_url: `${siteUrl}/?paymongo_return=success&order_id=${orderId}`,
            cancel_url: `${siteUrl}/?paymongo_return=cancelled&order_id=${orderId}`,
            send_email_receipt: false,
            metadata: { order_id: orderId }
          }
        }
      })
    });
    pmData = await pmRes.json();
  } catch(err){
    console.error('PayMongo create-checkout-session request failed', err);
    return res.status(502).json({ error: 'paymongo-unreachable' });
  }

  if(!pmRes.ok){
    // Log everything PayMongo said (this is what tells you WHY — e.g. a payment
    // method that isn't activated on the live account) and pass the short,
    // non-secret reason back so the checkout can show something useful.
    console.error('PayMongo rejected the checkout session', JSON.stringify(pmData));
    const first = (pmData && Array.isArray(pmData.errors) && pmData.errors[0]) || {};
    return res.status(502).json({
      error: 'paymongo-error',
      code: first.code || null,
      detail: first.detail || null
    });
  }

  const session = pmData.data;
  await orderRef.update({
    paymongoCheckoutSessionId: session.id,
    paymentProvider: `paymongo_${paymentMethodType}`,
    paymentStatus: 'pending',
    paymentTestMode: wantsTest
  });

  return res.status(200).json({ checkoutUrl: session.attributes.checkout_url, testMode: wantsTest });
};