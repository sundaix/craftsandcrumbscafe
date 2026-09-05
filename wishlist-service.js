import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

const WISHLISTS_COL = "wishlists";

export async function fetchWishlist(uid){
  if(!uid) return [];
  const snap = await getDoc(doc(db, WISHLISTS_COL, uid));
  return snap.exists() ? (snap.data().productIds || []) : [];
}

export async function saveWishlist(uid, productIds){
  if(!uid) return;
  await setDoc(doc(db, WISHLISTS_COL, uid), {
    productIds,
    updatedAt: new Date().toISOString()
  });
}

window.CCWishlist = { fetchWishlist, saveWishlist };
