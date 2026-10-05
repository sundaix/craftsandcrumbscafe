const admin = require('../_lib/firebaseAdmin');
const pr = require('../_lib/passwordReset');

/* POST { email, code, newPassword?, checkOnly? }
   - checkOnly: true  -> just verifies the code (wrong guesses still
                         count toward the 5-attempt limit) and leaves it
                         valid, so the form can move on to "new password".
   - otherwise        -> verifies the code, consumes it, and sets the new
                         password with the Admin SDK. All other sessions
                         for that account are signed out.
   Errors come back as { ok:false, error } with error one of:
   invalid-code | wrong-code (+attemptsLeft) | expired | too-many-attempts
   | weak-password | invalid-request | reset-failed */
module.exports = async (req, res) => {
  if(req.method !== 'POST'){
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  }

  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const code = String(body.code || '').trim();
  const checkOnly = body.checkOnly === true;
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if(!email || !pr.EMAIL_RE.test(email) || !/^\d{6}$/.test(code)){
    return res.status(400).json({ ok: false, error: 'invalid-request' });
  }
  if(!checkOnly && (newPassword.length < 6 || newPassword.length > 128)){
    return res.status(400).json({ ok: false, error: 'weak-password' });
  }

  let user;
  try{
    user = await admin.auth().getUserByEmail(email);
  } catch(err){
    // Same answer as a wrong code, so this can't reveal whether an account exists.
    return res.status(400).json({ ok: false, error: 'invalid-code' });
  }

  const db = admin.firestore();
  const ref = db.collection(pr.COLLECTION).doc(user.uid);

  // One transaction, so two parallel guesses can't both slip past the attempt limit.
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if(!snap.exists) return { error: 'invalid-code' };
    const d = snap.data();
    if(Date.now() > d.expiresAt){ tx.delete(ref); return { error: 'expired' }; }
    if((d.attempts || 0) >= pr.MAX_ATTEMPTS) return { error: 'too-many-attempts' };
    if(!pr.codesMatch(code, d.salt, user.uid, d.codeHash)){
      const attempts = (d.attempts || 0) + 1;
      tx.update(ref, { attempts });
      return attempts >= pr.MAX_ATTEMPTS
        ? { error: 'too-many-attempts' }
        : { error: 'wrong-code', attemptsLeft: pr.MAX_ATTEMPTS - attempts };
    }
    if(!checkOnly) tx.delete(ref); // single use
    return { ok: true };
  });

  if(!result.ok){
    return res.status(400).json({ ok: false, ...result });
  }
  if(checkOnly) return res.status(200).json({ ok: true });

  try{
    await admin.auth().updateUser(user.uid, { password: newPassword });
    await admin.auth().revokeRefreshTokens(user.uid);
  } catch(err){
    console.error('Password reset: could not set the new password', err);
    return res.status(500).json({ ok: false, error: 'reset-failed' });
  }
  return res.status(200).json({ ok: true });
};