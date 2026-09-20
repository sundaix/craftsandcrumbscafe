const admin = require('../_lib/firebaseAdmin');

module.exports = async (req, res) => {
  if(req.method !== 'GET'){
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  }
  if(!process.env.PAYMONGO_SECRET_KEY){
    return res.status(500).json({ ok: false, error: 'paymongo-not-configured' });
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

  const authHeader = 'Basic ' + Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64');

  let session;
  try{
    const sessRes = await fetch(`https://api.paymongo.com/v2/checkout_sessions/${order.paymongoCheckoutSessionId}`, {
      headers: { 'Authorization': authHeader }
    });
    const sessData = await sessRes.json();
    if(!sessRes.ok){
      console.error('PayMongo session fetch failed', sessData);
      return res.status(502).json({ ok: false, error: 'paymongo-error' });
    }
    session = sessData.data;
  } catch(err){
    console.error('PayMongo session fetch unreachable', err);
    return res.status(502).json({ ok: false, error: 'paymongo-unreachable' });
  }

  // A Checkout Session only gets a payments[] entry once the customer
  // has actually completed authorization — nothing to check yet if
  // it's empty (they may still be mid-flow, or bailed out).
  const payments = (session.attributes && session.attributes.payments) || [];
  if(!payments.length){
    return res.status(200).json({ ok: false, error: 'not-paid-yet' });
  }

  const paymentId = payments[0].id;
  let payment;
  try{
    const payRes = await fetch(`https://api.paymongo.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': authHeader }
    });
    const payData = await payRes.json();
    if(!payRes.ok){
      console.error('PayMongo payment fetch failed', payData);
      return res.status(502).json({ ok: false, error: 'paymongo-error' });
    }
    payment = payData.data;
  } catch(err){
    console.error('PayMongo payment fetch unreachable', err);
    return res.status(502).json({ ok: false, error: 'paymongo-unreachable' });
  }

  if(payment.attributes.status !== 'paid'){
    return res.status(200).json({ ok: false, error: 'not-paid-yet' });
  }

  // Confirmed paid, server-to-server. Admin SDK write — bypasses
  // firestore.rules on purpose, since this is the one trusted place
  // that's allowed to set paymentStatus: 'paid' at all.
  await orderRef.update({
    paymentStatus: 'paid',
    status: order.status === 'pending' ? 'preparing' : order.status
  });

  return res.status(200).json({ ok: true });
};