const crypto = require('crypto');

const CODE_TTL_MS = 10 * 60 * 1000;      // same 10-minute life as the signup OTP
const MAX_ATTEMPTS = 5;                  // wrong guesses allowed per code
const RESEND_COOLDOWN_MS = 60 * 1000;    // minimum gap between two sends
const MAX_SENDS_PER_HOUR = 5;
const COLLECTION = 'passwordResets';     // no client rule on purpose: default-deny, Admin SDK only

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateCode(){
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function hashCode(code, salt, uid){
  return crypto.createHash('sha256').update(`${salt}:${uid}:${code}`).digest('hex');
}

function codesMatch(code, salt, uid, expectedHash){
  const a = Buffer.from(hashCode(code, salt, uid), 'hex');
  const b = Buffer.from(String(expectedHash || ''), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isConfigured(){
  return !!process.env.EMAILJS_PRIVATE_KEY;
}

async function sendResetCodeEmail({ toEmail, toName, code }){
  const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: process.env.EMAILJS_SERVICE_ID || 'service_tnzpjyg',
      template_id: process.env.EMAILJS_RESET_TEMPLATE_ID || 'template_2aj648z',
      user_id: process.env.EMAILJS_PUBLIC_KEY || 'p-vyE-kvRr1-26Bh0',
      accessToken: process.env.EMAILJS_PRIVATE_KEY,
      template_params: {
        to_email: toEmail,
        to_name: toName || 'there',
        // the OTP template: big code box + generic wording (shared with signup verification)
        otp_code: code,
        subject: 'Your Crafts & Crumbs password reset code',
        headline: 'Reset your password',
        message: 'Use the code below to reset your password:',
        reset_code: code,
        expires_in: `${CODE_TTL_MS / 60000} minutes`
      }
    })
  });
  if(!r.ok){
    const text = await r.text().catch(() => '');
    throw new Error(`EmailJS ${r.status}: ${text}`);
  }
}

module.exports = {
  CODE_TTL_MS, MAX_ATTEMPTS, RESEND_COOLDOWN_MS, MAX_SENDS_PER_HOUR, COLLECTION, EMAIL_RE,
  generateCode, hashCode, codesMatch, isConfigured, sendResetCodeEmail
};