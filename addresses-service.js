import { db } from "./firebase-config.js";
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

function addressesCol(uid){
  return collection(db, "users", uid, "addresses");
}

/* Default address first, so callers (checkout's picker, the My
   Addresses page) never have to re-sort to find it. */
export async function fetchAddresses(uid){
  if(!uid) return [];
  const snap = await getDocs(addressesCol(uid));
  const addresses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  addresses.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  return addresses;
}

/* Unsets isDefault on every other address doc so at most one stays
   true. exceptId is skipped since that's the one about to be (or
   already is) the new default. */
async function clearOtherDefaults(uid, exceptId){
  const snap = await getDocs(addressesCol(uid));
  for(const d of snap.docs){
    if(d.id === exceptId) continue;
    if(d.data().isDefault) await updateDoc(d.ref, { isDefault: false });
  }
}

/* Used by the "Add Address" form (My Addresses page and Checkout's
   inline picker both call this). If this is flagged as the default —
   or it's the customer's very first saved address, so it becomes the
   default automatically — every other address gets its flag cleared. */
export async function addAddress(uid, address){
  const snap = await getDocs(addressesCol(uid));
  const makeDefault = address.isDefault || snap.empty;
  const ref = await addDoc(addressesCol(uid), {
    ...address,
    isDefault: makeDefault,
    createdAt: new Date().toISOString()
  });
  if(makeDefault) await clearOtherDefaults(uid, ref.id);
  return ref.id;
}

/* Used by the "Edit Address" form. */
export async function updateAddress(uid, addressId, fields){
  await updateDoc(doc(db, "users", uid, "addresses", addressId), fields);
  if(fields.isDefault) await clearOtherDefaults(uid, addressId);
}

/* Used by the "Delete" button on an address card. */
export async function deleteAddress(uid, addressId){
  await deleteDoc(doc(db, "users", uid, "addresses", addressId));
}

/* Used by the "Set as default" action on an address card — a
   dedicated one-tap flow separate from updateAddress's general field
   editor. */
export async function setDefaultAddress(uid, addressId){
  await updateDoc(doc(db, "users", uid, "addresses", addressId), { isDefault: true });
  await clearOtherDefaults(uid, addressId);
}

window.CCAddresses = { fetchAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress };
