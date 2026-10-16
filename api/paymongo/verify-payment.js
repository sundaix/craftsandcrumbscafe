const admin = require('../_lib/firebaseAdmin');

module.exports = async (req, res) => {
  // Allow browser/Capacitor app to call this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS') return res.status(200).end();

  if(req.method !== 'GET'){
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  }

  const orderId = req.query.order_id;
  if(!orderId){
    return res.status(400).json({ ok: false, error: 'missing-order-id' });
  }

  const db = admin.firestore();
  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();
  if(!orderSnap.exists){
    return res.status(404).json({ ok: false, error: 'order-not-found' });
  }
  const order = orderSnap.data();

  // Idempotent — refreshing the confirmation page, or PayMongo
  // bouncing the customer back here twice, shouldn't double-charge
  // anything or re-run finalization on the client twice either
  // (script.js uses this flag to skip re-decrementing stock).
  if(order.paymentStatus === 'paid'){
    return res.status(200).json({ ok: true, alreadyPaid: true });
  }
  if(!order.paymongoCheckoutSessionId){
    return res.status(400).json({ ok: false, error: 'no-checkout-session' });
  }

  // A test checkout (admin-only, see create-checkout-session.js) was created
  // with the test key, so it has to be looked up with the test key too.
  const secretKey = order.paymentTestMode ? process.env.PAYMONGO_TEST_SECRET_KEY : process.env.PAYMONGO_SECRET_KEY;
  if(!secretKey){
    return res.status(500).json({ ok: false, error: 'paymongo-not-configured' });
  }
  const authHeader = 'Basic ' + Buffer.from(secretKey + ':').toString('base64');

  let session;
  try{
    const sessRes = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${order.paymongoCheckoutSessionId}`, {
      headers: { 'Authorization': authHeader }
    });
    const sessData = await sessRes.json();
    if(!sessRes.ok){
      console.error('PayMongo session fetch failed', 'http=' + sessRes.status, 'sessionId=' + order.paymongoCheckoutSessionId, 'key=' + secretKey.slice(0, 8), 'testOrder=' + !!order.paymentTestMode, JSON.stringify(sessData));
      return res.status(502).json({ ok: false, error: 'paymongo-error' });
    }
    session = sessData.data;
  } catch(err){
    console.error('PayMongo session fetch unreachable', err);
    return res.status(502).json({ ok: false, error: 'paymongo-unreachable' });
  }

  // payments[] holds ONE ENTRY PER ATTEMPT (a failed card, an expired QR,
  // then the one that worked...), and at most one of them is "paid". The old
  // code only ever looked at payments[0], so any earlier failed attempt hid a
  // later successful one and the order stayed unpaid forever. Look for the
  // paid one anywhere in the list.
  const payments = (session.attributes && session.attributes.payments) || [];
  let paid = payments.find(p => p && p.attributes && p.attributes.status === 'paid') || null;

  if(!paid){
    // Entries that don't carry a status inline: ask PayMongo about them directly.
    for(const p of payments){
      if(!p || !p.id || (p.attributes && p.attributes.status)) continue;
      try{
        const payRes = await fetch(`https://api.paymongo.com/v1/payments/${p.id}`, {
          headers: { 'Authorization': authHeader }
        });
        const payData = await payRes.json();
        if(payRes.ok && payData.data && payData.data.attributes.status === 'paid'){ paid = payData.data; break; }
      } catch(err){
        console.error('PayMongo payment fetch unreachable', err);
      }
    }
  }

  if(!paid){
    // Real QR Ph / GCash payments can take a few seconds to settle after the
    // customer lands back on the site — the client keeps asking for a while.
    return res.status(200).json({ ok: false, error: 'not-paid-yet' });
  }

  // Defence in depth: the paid amount must cover what this order costs, so a
  // session id swapped onto a different order can't mark it paid.
  let expected = (order.items || []).reduce((s, it) => s + Math.round(Number(it.price) * 100) * Math.floor(Number(it.qty)), 0);
  if(order.fulfillment === 'delivery' && order.totals && order.totals.deliveryFee){
    expected += Math.round(order.totals.deliveryFee * 100);
  }
  const paidAmount = paid.attributes && paid.attributes.amount;
  if(typeof paidAmount === 'number' && paidAmount < expected - 1){
    console.error('Paid amount is less than the order total', { orderId, paidAmount, expected });
    return res.status(200).json({ ok: false, error: 'amount-mismatch' });
  }

  // Confirmed paid, server-to-server. Admin SDK write — bypasses
  // firestore.rules on purpose, since this is the one trusted place
  // that's allowed to set paymentStatus: 'paid' at all. Done in a
  // transaction so that when two requests race (the customer's page plus a
  // retry), exactly one of them is told "not already paid" and therefore the
  // only one that runs stock + email finalization on the client.
  const firstToConfirm = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    const cur = snap.data();
    if(cur.paymentStatus === 'paid') return false;
    tx.update(orderRef, {
      paymentStatus: 'paid',
      status: cur.status === 'pending' ? 'preparing' : cur.status,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      paymongoPaymentId: paid.id
    });
    return true;
  });

  return res.status(200).json({ ok: true, alreadyPaid: !firstToConfirm });
};