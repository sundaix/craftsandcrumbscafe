import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

const CARTS_COL = "carts";

export async function fetchCart(uid){
  if(!uid) return [];
  const snap = await getDoc(doc(db, CARTS_COL, uid));
  return snap.exists() ? (snap.data().items || []) : [];
}

export async function saveCart(uid, items){
  if(!uid) return;
  await setDoc(doc(db, CARTS_COL, uid), {
    items,
    updatedAt: new Date().toISOString()
  });
}

window.CCCart = { fetchCart, saveCart };
