import { db } from "./firebase-config.js";
import {
  collection, getDocs, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

function friendlyError(err) {
  // Firestore permission errors (e.g. a rules rejection) show up as
  // err.code === 'permission-denied' with a generic message — give a
  // clearer one for the most likely cause here.
  if (err && err.code === 'permission-denied') {
    return "You don't have permission to do that — either you're not signed in as an admin, or you're trying to change your own account.";
  }
  return err && err.message ? err.message : 'Something went wrong. Please try again.';
}

async function listUserProfiles() {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => {
      const data = d.data();
      return {
        uid: d.id,
        email: data.email || null,
        name: data.fullName || null,
        role: data.role === 'admin' || data.role === 'rider' ? data.role : 'customer',
        disabled: !!data.disabled
      };
    });
  } catch (err) {
    console.error(err);
    throw new Error(friendlyError(err));
  }
}

async function setUserRole(uid, role) {
  try {
    await updateDoc(doc(db, 'users', uid), { role });
  } catch (err) {
    console.error(err);
    throw new Error(friendlyError(err));
  }
}

async function setUserDisabled(uid, disabled) {
  try {
    await updateDoc(doc(db, 'users', uid), { disabled });
  } catch (err) {
    console.error(err);
    throw new Error(friendlyError(err));
  }
}

window.CCAccounts = { listUserProfiles, setUserRole, setUserDisabled };