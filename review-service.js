import { db } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, query, where, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

const REVIEWS_COL = "reviews";

function reviewDocId(productId, uid){
  return `${productId}_${uid}`;
}

export async function fetchReviewsForProduct(productId){
  const snap = await getDocs(query(collection(db, REVIEWS_COL), where("productId", "==", productId)));
  const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const toMs = (val) => {
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };
  reviews.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
  return reviews;
}

export async function fetchMyReviewForProduct(productId, uid){
  if(!uid) return null;
  const snap = await getDoc(doc(db, REVIEWS_COL, reviewDocId(productId, uid)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function submitReview(productId, uid, userName, rating, text, verified){
  const ref = doc(db, REVIEWS_COL, reviewDocId(productId, uid));
  const existing = await getDoc(ref);
  await setDoc(ref, {
    productId, uid, userName, rating, text,
    verified: !!verified,
    createdAt: existing.exists() ? existing.data().createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export async function deleteReview(productId, uid){
  await deleteDoc(doc(db, REVIEWS_COL, reviewDocId(productId, uid)));
}

window.CCReviews = { fetchReviewsForProduct, fetchMyReviewForProduct, submitReview, deleteReview };
