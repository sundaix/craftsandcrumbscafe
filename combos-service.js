import { db } from "./firebase-config.js";
import {
  collection, getDocs, doc, addDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

const COMBOS_COL = "combos";

export async function fetchAllCombos(){
  const snap = await getDocs(collection(db, COMBOS_COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* Used by the Admin "Add Combo" form. */
export async function addCombo(combo){
  const ref = await addDoc(collection(db, COMBOS_COL), combo);
  return ref.id;
}

/* Used by the Admin dashboard's "Edit" action on a combo row,
   and by the active/inactive toggle (a single-field update). */
export async function updateCombo(id, fields){
  await updateDoc(doc(db, COMBOS_COL, id), fields);
}

/* Used by the Admin dashboard's "Delete" action on a combo row. */
export async function deleteCombo(id){
  await deleteDoc(doc(db, COMBOS_COL, id));
}

window.CCCombos = { fetchAllCombos, addCombo, updateCombo, deleteCombo };
