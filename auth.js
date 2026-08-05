/* =========================================================
   Crafts & Crumbs — auth.js
   Real Firebase Authentication (email/password).
   Also maintains a "users" Firestore doc per account so we
   can store a role (customer/admin) and basic profile info.
========================================================= */
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

/* Current signed-in user + role, kept in memory and exposed globally
   so script.js (non-module-aware in places) can read it easily. */
window.currentUser = null;   // Firebase Auth user object
window.currentRole = null;   // 'admin' | 'customer'

/* Wraps a promise so it rejects with a clear error instead of
   hanging forever if a network/extension issue blocks the request. */
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

/* Writes a freshly generated code onto the user's own Firestore doc
   and emails it via EmailJS (window.sendOtpEmail, from
   email-notifications.js). Used both right after registration and
   whenever the person taps "Resend code".

   Uses setDoc(..., {merge:true}) rather than updateDoc: updateDoc
   requires the document to already exist and throws "No document to
   update" if it doesn't (e.g. the original profile write during
   registration was blocked/timed out and never landed). merge:true
   creates the doc if it's missing and otherwise only touches the
   fields listed here — existing fields like role are left untouched.
   extraFields lets resendOtp backfill the rest of the profile (email,
   name, role, createdAt) in that recovery case.

   Returns { emailSent } instead of just resolving/rejecting on the
   email step: the Firestore write is the part that must succeed (a
   failure there is a real error and rejects normally), but a failed
   *email* send shouldn't look identical to a failed *code generation*
   — callers use emailSent to tell the person the honest outcome
   instead of always claiming "check your inbox." */
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
async function fetchUserRecord(uid){
  try{
    const snap = await withTimeout(getDoc(doc(db, "users", uid)), 8000, 'timeout');
    const data = snap.exists() ? snap.data() : {};
    return { role: data.role || "customer", otpVerified: !!data.otpVerified };
  } catch(err){
    console.warn('Could not fetch user record (connection blocked or slow). Defaulting to customer/unverified.', err);
    return { role: "customer", otpVerified: false };
  }
}

/* Fires on every login/logout/page load. Keeps window.currentUser
   and window.currentRole in sync, then tells script.js to
   re-render anything that depends on auth state (nav, admin link). */
onAuthStateChanged(auth, async (user) => {
  window.currentUser = user;
  window.currentRole = null;
  // Fires immediately — everything that only needs the Auth user
  // (name, email, dot indicator, dropdown contents) can render now,
  // without waiting on a Firestore round-trip.
  document.dispatchEvent(new CustomEvent("authStateReady", {
    detail: { user, role: null }
  }));

  const { role, otpVerified } = user && !user.isAnonymous
    ? await fetchUserRecord(user.uid)
    : { role: null, otpVerified: false };
  window.currentRole = role;
  // Fires once the role/verification status is known — used for
  // admin-only UI (the admin nav icon) and the unverified nudge,
  // both of which can safely lag behind by a moment.
  document.dispatchEvent(new CustomEvent("authRoleReady", {
    detail: { user, role, otpVerified }
  }));
});

/* Expose to non-module scripts (script.js) via window */
window.CCAuth = { registerUser, loginUser, logoutUser, ensureSignedIn, resendOtp, verifyOtp, isOtpVerified, sendResetPasswordEmail };
