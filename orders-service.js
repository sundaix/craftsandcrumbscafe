/* =========================================================
   Crafts & Crumbs — orders-service.js
   Writes a real order document to Firestore when checkout
   completes, instead of just faking a confirmation screen.
========================================================= */
import { db } from "./firebase-config.js";
import {
  collection, addDoc, serverTimestamp, getDocs, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

const ORDERS_COL = "orders";

/* items: [{id, name, price, qty}], totals: {subtotal, deliveryFee, total},
   fulfillment: 'delivery' | 'pickup', customer: {name, phone, email, address} */
export async function createOrder({ items, totals, fulfillment, customer, paymentMethod }){
  const ref = await addDoc(collection(db, ORDERS_COL), {
    items, totals, fulfillment, customer, paymentMethod,
    userId: window.currentUser ? window.currentUser.uid : null,
    status: "pending",
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/* Used by the Admin dashboard's Orders tab. Reads every order —
   Firestore rules only let an admin account read across users,
   everyone else can only read their own. */
export async function fetchAllOrders(){
  const snap = await getDocs(collection(db, ORDERS_COL));
  const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Newest first when a timestamp is available. createdAt may come back
  // as a Timestamp-like object ({seconds,...}) or as a date string,
  // depending on how Firestore Lite serializes it, so handle both.
  const toSeconds = (val) => {
    if(!val) return 0;
    if(typeof val.seconds === 'number') return val.seconds;
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed / 1000;
  };
  orders.sort((a, b) => toSeconds(b.createdAt) - toSeconds(a.createdAt));
  return orders;
}

/* Used by the Admin dashboard's status dropdown on each order row. */
export async function updateOrderStatus(orderId, status){
  await updateDoc(doc(db, ORDERS_COL, orderId), { status });
}

window.CCOrders = { createOrder, fetchAllOrders, updateOrderStatus };