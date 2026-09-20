/* Creates a real PayMongo Checkout Session for an order already sitting
   in Firestore, and returns the checkout_url the browser redirects to.

   SETUP (one-time):
   1. Create a PayMongo account at https://dashboard.paymongo.com — no
      card needed, test mode works immediately and never charges real
      money. GCash live payouts need PayMongo to activate your account
      (~5 business days per their docs) but test mode works right away.
   2. Dashboard > Developers > API keys. Copy the SECRET key (starts
      with sk_test_... in test mode, sk_live_... once activated).
   3. Vercel dashboard > your project > Settings > Environment
      Variables > add PAYMONGO_SECRET_KEY with that value.
   4. Redeploy after adding it.

   Only GCash and QR Ph are wired up for real payment here — Maya and
   Card still use the simulated checkout in script.js. QR Ph needs no
   account activation and works immediately; GCash needs PayMongo to
   activate it on your account first (Settings > Payment Methods in
   the dashboard) — until then it just won't appear as an option on
   the PayMongo checkout page, QR Ph will. Extending this to Maya/Card
   later is mostly just adding them to payment_method_types below;
   check your dashboard's Payment Methods page for what's actually
   active on your account first. */

const admin = require('../_lib/firebaseAdmin');

module.exports = async (req, res) => {
  if(req.method !== 'POST'){
    return res.status(405).json({ error: 'method-not-allowed' });
  }
  if(!process.env.PAYMONGO_SECRET_KEY){
    return res.status(500).json({ error: 'paymongo-not-configured' });
  }

  const { orderId } = req.body || {};
  if(!orderId){
    return res.status(400).json({ error: 'missing-order-id' });
  }

  const db = admin.firestore();
  const orderRef = db.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();
  if(!orderSnap.exists){
    return res.status(404).json({ error: 'order-not-found' });
  }
  const order = orderSnap.data();

  // The amount PayMongo charges comes entirely from what's already in
  // Firestore for this order, never from anything the browser sends
  // to this endpoint — otherwise a tampered request could check out
  // for less than the real total while Firestore still shows the
  // full order as placed.
  const lineItems = (order.items || []).map(it => ({
    name: it.name,
    amount: Math.round(it.price * 100), // PayMongo wants centavos
    currency: 'PHP',
    quantity: it.qty
  }));
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
  const authHeader = 'Basic ' + Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64');

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
            payment_method_types: ['gcash', 'qrph'],
            reference_number: orderId,
            description: `Crafts & Crumbs order #${shortId}`,
            success_url: `${siteUrl}/?paymongo_return=success&order_id=${orderId}`,
            cancel_url: `${siteUrl}/?paymongo_return=cancelled&order_id=${orderId}`,
            send_email_receipt: false
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
    console.error('PayMongo rejected the checkout session', pmData);
    return res.status(502).json({ error: 'paymongo-error' });
  }

  const session = pmData.data;
  await orderRef.update({
    paymongoCheckoutSessionId: session.id,
    paymentProvider: 'paymongo_gcash',
    paymentStatus: 'pending'
  });

  return res.status(200).json({ checkoutUrl: session.attributes.checkout_url });
};