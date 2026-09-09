import { db } from "./firebase-config.js";
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

function addressesCol(uid){
  return collection(db, "users", uid, "addresses");
}

export async function fetchAddresses(uid){
  if(!uid) return [];
  const snap = await getDocs(addressesCol(uid));
  const addresses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  addresses.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  return addresses;
}

async function clearOtherDefaults(uid, exceptId){
  const snap = await getDocs(addressesCol(uid));
  for(const d of snap.docs){
    if(d.id === exceptId) continue;
    if(d.data().isDefault) await updateDoc(d.ref, { isDefault: false });
  }
}

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

export async function updateAddress(uid, addressId, fields){
  await updateDoc(doc(db, "users", uid, "addresses", addressId), fields);
  if(fields.isDefault) await clearOtherDefaults(uid, addressId);
}

export async function deleteAddress(uid, addressId){
  await deleteDoc(doc(db, "users", uid, "addresses", addressId));
}

export async function setDefaultAddress(uid, addressId){
  await updateDoc(doc(db, "users", uid, "addresses", addressId), { isDefault: true });
  await clearOtherDefaults(uid, addressId);
}

window.CCAddresses = { fetchAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress };
