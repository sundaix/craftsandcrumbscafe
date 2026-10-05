const EMAILJS_PUBLIC_KEY        = 'p-vyE-kvRr1-26Bh0';
const EMAILJS_SERVICE_ID        = 'service_tnzpjyg';
const EMAILJS_OTP_TEMPLATE_ID   = 'template_2aj648z';
const EMAILJS_ORDER_TEMPLATE_ID = 'template_kd8m5qd';
/* The free EmailJS plan only allows a couple of templates, so order
   confirmations AND return/refund updates share ONE generic template
   (the order template, edited once in the EmailJS dashboard). It is
   driven by these variables: subject, headline, message, highlight,
   details (+ to_email, to_name). The older order_id / order_total /
   fulfillment variables are still sent too, so the template keeps working
   even before it has been edited. */
const EMAILJS_RETURN_TEMPLATE_ID = EMAILJS_ORDER_TEMPLATE_ID;

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
    otp_code: otpCode,
    // generic variables: this same template also carries the password-reset
    // code (sent from api/_lib/passwordReset.js), so the wording is passed in.
    subject: 'Verify your Crafts & Crumbs account',
    headline: 'Verify your account',
    message: 'To finish creating your account, enter the code below on the verification screen:'
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
      fulfillment: orderPayload.fulfillment,
      // generic template variables (see note at the top of this file)
      subject: 'Your Crafts & Crumbs order #CC-' + orderId.slice(0, 6).toUpperCase(),
      headline: 'Order confirmed',
      message: "Thanks for your order! We're getting it ready.",
      highlight: '#CC-' + orderId.slice(0, 6).toUpperCase(),
      details: 'Total: ₱' + Number(orderPayload.totals.total || 0).toLocaleString('en-PH') + '\n' +
               'Fulfillment: ' + (orderPayload.fulfillment === 'delivery' ? 'Delivery' : 'Store pickup')
    });
    return true;
  } catch(err){
    console.warn('EmailJS: order confirmation email failed to send.', err);
    return false;
  }
};

/* Return / refund updates. One template covers every stage; the wording
   for each stage is built here and sent as {{status_message}}, so the
   EmailJS template itself can stay simple. Called from:
   - script.js  -> status 'requested' (right after the customer submits)
   - admin.js   -> 'approved' | 'rejected' | 'refunded' (rtNotifyCustomer)
   Never throws and never blocks: a failed email must not undo a return. */
window.sendReturnStatusEmail = async function(info){
  if(!window.emailjs) return false;
  if(!info || !info.toEmail) return false;
  const order = '#' + info.orderNumber;
  const copy = {
    requested: {
      subject: `We got your return request (${order})`,
      headline: 'Return request received',
      message: `We've received your return request for order ${order} and will review it soon. We'll email you as soon as there's an update.`
    },
    approved: {
      subject: `Your return was approved (${order})`,
      headline: 'Return approved',
      message: `Good news — your return request for order ${order} was approved. We're processing your refund and will email you once it has been sent.`
    },
    rejected: {
      subject: `Update on your return request (${order})`,
      headline: 'Return not approved',
      message: `Sorry — we couldn't approve your return request for order ${order}.`
    },
    refunded: {
      subject: `Your refund has been sent (${order})`,
      headline: 'Refund sent',
      message: `Your refund of ${info.refundAmount} for order ${order} has been sent. Depending on your payment method, it may take a little while to show up.`
    }
  }[info.status] || { subject: `Update on your return (${order})`, headline: info.statusLabel || 'Return update', message: '' };

  const lines = [];
  if(info.reason) lines.push('Reason: ' + info.reason);
  if(info.status === 'requested' && info.refundAmount) lines.push('Refund requested: ' + info.refundAmount);
  if(info.adminNote) lines.push('Note from us: ' + info.adminNote);
  if(info.status === 'refunded'){
    if(info.refundAmount) lines.push('Amount refunded: ' + info.refundAmount);
    if(info.refundRef) lines.push('Reference: ' + info.refundRef);
  }

  try{
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_RETURN_TEMPLATE_ID, {
      to_email: info.toEmail,
      to_name: info.toName || 'there',
      subject: copy.subject,
      headline: copy.headline,
      message: copy.message,
      highlight: order,
      details: lines.join('\n'),
      // kept for anyone who built a template around the earlier variable names
      order_id: order,
      status_label: info.statusLabel || info.status,
      status_message: copy.message,
      admin_note: info.adminNote || '',
      refund_amount: info.refundAmount || '',
      refund_ref: info.refundRef || ''
    });
    return true;
  } catch(err){
    console.warn('EmailJS: return status email failed to send.', err);
    return false;
  }
};