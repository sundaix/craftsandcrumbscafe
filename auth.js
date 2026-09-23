import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

window.currentUser = null;   // Firebase Auth user object
window.currentRole = null;   // 'admin' | 'customer'

function withTimeout(promise, ms, message){
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
  ]);
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

function generateOtp(){
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits, never leading-zero-only
}

async function issueOtp(uid, email, fullName, extraFields){
  const otpCode = generateOtp();
  await setDoc(doc(db, "users", uid), {
    ...extraFields,
    otpVerified: false,
    otpCode,
    otpExpiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    otpAttempts: 0
  }, { merge: true });
  if(!window.sendOtpEmail){
    console.warn('email-notifications.js has not loaded — OTP email skipped.');
    return { emailSent: false };
  }
  try{
    await window.sendOtpEmail(email, fullName, otpCode);
    return { emailSent: true };
  } catch(err){
    console.warn('Could not send the verification email (code was still generated — Resend will retry).', err);
    return { emailSent: false };
  }
}

export async function registerUser(fullName, email, phone, password){
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: fullName });
  try{
    await withTimeout(
      setDoc(doc(db, "users", cred.user.uid), {
        fullName, email, phone,
        role: "customer",
        createdAt: new Date().toISOString(),
        otpVerified: false
      }),
      8000,
      'timeout'
    );
  } catch(err){
    // Auth account was created successfully even if this profile
    // write got blocked/timed out — surface a specific error so the
    // UI can explain what actually happened instead of looking stuck.
    const blockErr = new Error('profile-write-failed');
    blockErr.code = 'profile-write-failed';
    throw blockErr;
  }
  // Best-effort: a blocked/slow connection here shouldn't stop the
  // account from being created — the "Resend code" button on the
  // verify screen calls issueOtp again if this doesn't land. We still
  // report whether the email actually went out so the UI can say so
  // truthfully instead of always promising "check your inbox."
  let emailSent = false;
  try{
    ({ emailSent } = await issueOtp(cred.user.uid, email, fullName));
  } catch(err){
    console.warn('Could not generate the verification code yet — the Resend button on the verify screen will retry.', err);
  }
  cred.user.otpEmailSent = emailSent;
  return cred.user;
}

export async function loginUser(email, password){
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logoutUser(){
  await signOut(auth);
}

/* Sends Firebase's built-in password reset email — the user gets a
   link that lets them set a new password directly, no OTP flow
   needed here since Firebase Auth handles the whole thing. Always
   resolves the same way whether or not the email exists, so the UI
   can't be used to check which emails are registered. */
export async function sendResetPasswordEmail(email){
  try{
    await sendPasswordResetEmail(auth, email);
  } catch(err){
    // auth/user-not-found is deliberately swallowed for the same
    // reason above — don't let the UI reveal whether an account
    // exists. Anything else (bad email format, network) is worth
    // surfacing.
    if(err.code !== 'auth/user-not-found'){
      throw err;
    }
  }
}

/* Firebase restores a signed-in session asynchronously on page load —
   auth.currentUser is null for a brief moment even for someone who's
   genuinely logged in, until onAuthStateChanged fires. Without this,
   tapping "Resend code" right after a page refresh (rather than right
   after registering, in the same session) could hit that null window
   and throw "not-signed-in" for someone who actually is signed in —
   surfacing as a confusing "please try again" error for no real reason.
   auth.authStateReady() (Firebase JS SDK) resolves once that first
   determination has been made, one way or the other. */
async function waitForAuthReady(){
  if(auth.currentUser) return auth.currentUser;
  if(typeof auth.authStateReady === 'function'){
    try{ await auth.authStateReady(); } catch(err){ /* ignore — fall through to the null check below */ }
  }
  return auth.currentUser;
}

/* Sends a fresh code, resetting attempts — used by the "Resend code" button.
   Returns { emailSent } (see issueOtp) so the button's click handler can
   tell the person the truth instead of always saying "check your inbox." */
export async function resendOtp(){
  const user = await waitForAuthReady();
  if(!user) throw new Error('not-signed-in');
  const snap = await getDoc(doc(db, "users", user.uid));
  const data = snap.exists() ? snap.data() : {};
  // Profile doc missing entirely (e.g. the original write during
  // registration got blocked or timed out)? Rebuild the baseline
  // fields here so the account isn't left permanently incomplete —
  // otherwise this button could never recover on its own.
  const extraFields = snap.exists() ? undefined : {
    email: user.email,
    fullName: user.displayName || '',
    role: 'customer',
    createdAt: new Date().toISOString()
  };
  return issueOtp(user.uid, data.email || user.email, data.fullName || user.displayName, extraFields);
}

/* Read-only check used right after login to decide whether to route
   to the verify screen (registerUser/resendOtp/verifyOtp all read the
   fuller record when they actually need to act on it). */
export async function isOtpVerified(){
  const user = await waitForAuthReady();
  if(!user) return false;
  const snap = await getDoc(doc(db, "users", user.uid));
  return snap.exists() && !!snap.data().otpVerified;
}

/* Compares the entered code against what's stored on the user's own
   Firestore doc. NOTE: since there's no backend server in this stack,
   this comparison runs entirely in the browser — it stops typos and
   casual mistakes, but isn't tamper-proof against someone deliberately
   inspecting their own devtools during their own registration. True
   server-side verification would need a Cloud Function (Blaze plan). */
export async function verifyOtp(enteredCode){
  const user = await waitForAuthReady();
  if(!user) return { ok:false, reason:'not-signed-in' };
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if(!snap.exists()) return { ok:false, reason:'no-record' };
  const data = snap.data();

  if(data.otpVerified) return { ok:true };
  if(!data.otpCode) return { ok:false, reason:'no-code' };
  if(new Date(data.otpExpiresAt).getTime() < Date.now()) return { ok:false, reason:'expired' };
  if((data.otpAttempts || 0) >= OTP_MAX_ATTEMPTS) return { ok:false, reason:'too-many-attempts' };

  if(String(enteredCode) === String(data.otpCode)){
    await updateDoc(ref, { otpVerified:true, otpCode:null, otpAttempts:0 });
    return { ok:true };
  }
  const attempts = (data.otpAttempts || 0) + 1;
  await updateDoc(ref, { otpAttempts: attempts });
  return { ok:false, reason:'incorrect', attemptsLeft: OTP_MAX_ATTEMPTS - attempts };
}

/* Firestore's order-create rule requires request.auth != null (so writes
   are at least tied to a real Firebase Auth session, not an anonymous
   script). Guest checkout still needs to work per the FAQ ("no account
   needed"), so if nobody's logged in we sign in anonymously first —
   this satisfies that rule without asking the guest to register.
   Requires the "Anonymous" provider to be enabled in the Firebase
   Console under Authentication > Sign-in method. */
export async function ensureSignedIn(){
  if(auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}

/* Fetches the role + verification status stored in Firestore for the
   given uid, in a single read. Falls back to sensible defaults
   (rather than hanging) if the read is blocked or times out. */
/* Caches the last successfully-fetched record per uid. Falling back
   to "customer" on any failure (the old behavior) was actively wrong
   for admin/rider accounts: onAuthStateChanged re-fetches the role on
   every token refresh, not just real sign-ins, and those refreshes
   are far more likely to time out right after a tab has sat
   backgrounded/inactive for a while (throttled timers, a slow
   reconnect). A defaulted-to-customer role there was read by
   admin-boot.js/rider-boot.js as "this account lost its access" and
   force-signed the person out — i.e. the "logged out after
   inactivity" bug. Falling back to the last known-good record instead
   means a transient fetch failure just quietly keeps the status quo. */
const lastKnownUserRecord = new Map(); // uid -> { role, otpVerified, disabled }

function sleep(ms){ return new Promise(res => setTimeout(res, ms)); }

async function fetchUserRecordOnce(uid, timeoutMs){
  const snap = await withTimeout(getDoc(doc(db, "users", uid)), timeoutMs, 'timeout');
  const data = snap.exists() ? snap.data() : {};
  return { role: data.role || "customer", otpVerified: !!data.otpVerified, disabled: !!data.disabled };
}

async function fetchUserRecord(uid){
  // Two retries with backoff before giving up — a slow reconnect
  // right after a backgrounded tab wakes up is exactly the case this
  // is meant to ride out, and it usually resolves within a few
  // seconds if given the chance.
  const attempts = [12000, 6000, 6000];
  let lastErr = null;
  for(let i = 0; i < attempts.length; i++){
    try{
      const record = await fetchUserRecordOnce(uid, attempts[i]);
      lastKnownUserRecord.set(uid, record);
      return record;
    } catch(err){
      lastErr = err;
      if(i < attempts.length - 1) await sleep(1500 * (i + 1));
    }
  }
  console.warn('Could not fetch user record after retries (connection blocked or slow).', lastErr);
  const cached = lastKnownUserRecord.get(uid);
  if(cached){
    console.warn('Falling back to the last known role for this account instead of defaulting to customer.');
    return cached;
  }
  // No cache to fall back on (e.g. very first load on a fresh
  // session) — this is the one case where we genuinely don't know
  // the role yet. Signal that distinctly so the boot scripts can
  // avoid treating "unknown" the same as "not admin/rider".
  return { role: "customer", otpVerified: false, disabled: false, unknown: true };
}

/* Fires on every login/logout/page load. Keeps window.currentUser
   and window.currentRole in sync, then tells script.js to
   re-render anything that depends on auth state (nav, admin link). */
onAuthStateChanged(auth, async (user) => {
  // TEMP DIAGNOSTIC — remove once the inactivity-logout bug is found.
  console.warn('[auth] onAuthStateChanged fired. user:', user ? user.uid : null, 'at', new Date().toISOString());
  window.currentUser = user;
  window.currentRole = null;
  // Fires immediately — everything that only needs the Auth user
  // (name, email, dot indicator, dropdown contents) can render now,
  // without waiting on a Firestore round-trip.
  document.dispatchEvent(new CustomEvent("authStateReady", {
    detail: { user, role: null }
  }));

  const { role, otpVerified, disabled, unknown } = user && !user.isAnonymous
    ? await fetchUserRecord(user.uid)
    : { role: null, otpVerified: false, disabled: false, unknown: false };

  if(disabled){
    // TEMP DIAGNOSTIC
    console.warn('[auth] Signing out — disabled:true on user record.', { role, otpVerified, unknown });
    // Blocked via the admin dashboard's Accounts tab (see
    // accounts-service.js). Firestore rules already stop a blocked
    // account from writing anything, but that alone would leave them
    // sitting signed in with a half-working UI — sign them straight
    // back out instead. The `blocked: true` detail lets script.js
    // (customer site) show a "your account has been blocked" message
    // if it wants to; this file only handles the sign-out itself.
    window.currentUser = null;
    window.currentRole = null;
    await signOut(auth);
    document.dispatchEvent(new CustomEvent("authRoleReady", {
      detail: { user: null, role: null, otpVerified: false, blocked: true }
    }));
    return;
  }

  window.currentRole = role;
  // TEMP DIAGNOSTIC
  console.warn('[auth] role resolved:', role, 'unknown:', !!unknown, 'otpVerified:', otpVerified);
  // Fires once the role/verification status is known — used for
  // admin-only UI (the admin nav icon) and the unverified nudge,
  // both of which can safely lag behind by a moment. `unknown: true`
  // means fetchUserRecord couldn't confirm the role at all (first
  // load, no cache to fall back on, and every retry failed) — the
  // admin/rider boot scripts treat that as "try again," not "this
  // account lost access," since we genuinely don't know either way.
  document.dispatchEvent(new CustomEvent("authRoleReady", {
    detail: { user, role, otpVerified, unknown: !!unknown }
  }));
});

/* Re-checks the role for the currently signed-in user and re-dispatches
   authRoleReady with a fresh result, without going through a full
   onAuthStateChanged cycle. Used by admin-boot.js/rider-boot.js as a
   one-time double-check before showing "this account doesn't have
   admin/rider access": a role read taken immediately after sign-in
   occasionally lands before Firestore has fully caught up (or before
   a just-changed role has propagated), coming back with a stale
   default. A single quick recheck avoids flashing that message at
   someone who genuinely does have access. */
export async function recheckRole(){
  const user = await waitForAuthReady();
  if(!user || user.isAnonymous) return;
  const { role, otpVerified, unknown } = await fetchUserRecord(user.uid);
  window.currentRole = role;
  document.dispatchEvent(new CustomEvent("authRoleReady", {
    detail: { user, role, otpVerified, unknown: !!unknown }
  }));
}

/* Expose to non-module scripts (script.js) via window */
window.CCAuth = { registerUser, loginUser, logoutUser, ensureSignedIn, resendOtp, verifyOtp, isOtpVerified, sendResetPasswordEmail, recheckRole };