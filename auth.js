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
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  doc, setDoc, getDoc
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

export async function registerUser(fullName, email, phone, password){
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: fullName });
  try{
    await withTimeout(
      setDoc(doc(db, "users", cred.user.uid), {
        fullName, email, phone,
        role: "customer",
        createdAt: new Date().toISOString()
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
  return cred.user;
}

export async function loginUser(email, password){
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logoutUser(){
  await signOut(auth);
}

/* Fetches the role stored in Firestore for the given uid.
   Falls back to 'customer' (rather than hanging) if the read
   is blocked or times out. */
async function fetchRole(uid){
  try{
    const snap = await withTimeout(getDoc(doc(db, "users", uid)), 8000, 'timeout');
    return snap.exists() ? (snap.data().role || "customer") : "customer";
  } catch(err){
    console.warn('Could not fetch user role (connection blocked or slow). Defaulting to customer.', err);
    return "customer";
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

  const role = user ? await fetchRole(user.uid) : null;
  window.currentRole = role;
  // Fires once the role is known — only used for admin-only UI
  // (the 🛠️ nav icon), which can safely lag behind by a moment.
  document.dispatchEvent(new CustomEvent("authRoleReady", {
    detail: { user, role }
  }));
});

/* Expose to non-module scripts (script.js) via window */
window.CCAuth = { registerUser, loginUser, logoutUser };