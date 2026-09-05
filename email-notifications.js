const EMAILJS_PUBLIC_KEY        = 'p-vyE-kvRr1-26Bh0';
const EMAILJS_SERVICE_ID        = 'service_tnzpjyg';
const EMAILJS_OTP_TEMPLATE_ID   = 'template_2aj648z';
const EMAILJS_ORDER_TEMPLATE_ID = 'template_kd8m5qd';

if(window.emailjs){
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
} else {
  console.warn('EmailJS SDK did not load — emails will be skipped. Check the <script> tag in index.html.');
}

window.sendOtpEmail = async function(toEmail, toName, otpCode){
  if(!window.emailjs) throw new Error('emailjs-not-loaded');
  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_OTP_TEMPLATE_ID, {
    to_email: toEmail,
    to_name: toName || 'there',
    otp_code: otpCode
  });
};

window.sendOrderConfirmationEmail = async function(orderPayload, orderId){
  if(!window.emailjs) return false;
  try{
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_ORDER_TEMPLATE_ID, {
      to_email: orderPayload.customer.email,
      to_name: orderPayload.customer.name,
      order_id: '#CC-' + orderId.slice(0, 6).toUpperCase(),
      order_total: orderPayload.totals.total,
      fulfillment: orderPayload.fulfillment
    });
    return true;
  } catch(err){
    console.warn('EmailJS: order confirmation email failed to send.', err);
    return false;
  }
};
