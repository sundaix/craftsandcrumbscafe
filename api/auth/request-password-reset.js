const admin = require('../_lib/firebaseAdmin');
const pr = require('../_lib/passwordReset');

/* POST { email }
   Sends a 6-digit code to that email IF an account exists. The response
   is always { ok: true } either way, so this can't be used to find out
   which emails are registered. Throttled per account: 60s between
   sends, 5 per hour. */
module.exports = async (req, res) => {
  if(req.method !== 'POST'){
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  }
  if(!pr.isConfigured()){
    return res.status(500).json({ ok: false, error: 'reset-not-configured' });
  }

  const email = String((req.body || {}).email || '').trim().toLowerCase();
  if(!email || email.length > 254 || !pr.EMAIL_RE.test(email)){
    return res.status(400).json({ ok: false, error: 'invalid-email' });
  }

  let user;
  try{
    user = await admin.auth().getUserByEmail(email);
  } catch(err){
    if(err && err.code === 'auth/user-not-found') return res.status(200).json({ ok: true });
    console.error('Password reset: user lookup failed', err);
    return res.status(502).json({ ok: false, error: 'lookup-failed' });
  }
  if(user.disabled) return res.status(200).json({ ok: true });

  const db = admin.firestore();
  const ref = db.collection(pr.COLLECTION).doc(user.uid);
  const now = Date.now();

  const existing = await ref.get();
  let windowStart = now;
  let sentCount = 0;
  if(existing.exists){
    const d = existing.data();
    if(d.lastSentAt && now - d.lastSentAt < pr.RESEND_COOLDOWN_MS){
      return res.status(200).json({ ok: true }); // too soon — quietly skip
    }
    if(d.windowStart && now - d.windowStart < 60 * 60 * 1000){
      windowStart = d.windowStart;
      sentCount = d.sentCount || 0;
      if(sentCount >= pr.MAX_SENDS_PER_HOUR) return res.status(200).json({ ok: true });
    }
  }

  const code = pr.generateCode();
  const salt = require('crypto').randomBytes(16).toString('hex');
  await ref.set({
    email,
    codeHash: pr.hashCode(code, salt, user.uid),
    salt,
    expiresAt: now + pr.CODE_TTL_MS,
    attempts: 0,
    lastSentAt: now,
    windowStart,
    sentCount: sentCount + 1
  });

  let name = user.displayName || '';
  try{
    const profile = await db.collection('users').doc(user.uid).get();
    if(profile.exists && profile.data().fullName) name = profile.data().fullName;
  } catch(err){ /* name is cosmetic — ignore */ }

  try{
    await pr.sendResetCodeEmail({ toEmail: email, toName: name, code });
  } catch(err){
    console.error('Password reset: could not send the code email', err);
    await ref.delete().catch(() => {}); // don't let a failed send burn the cooldown
  }

  return res.status(200).json({ ok: true });
};