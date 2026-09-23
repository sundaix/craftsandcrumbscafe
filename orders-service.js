import { db } from "./firebase-config.js";
import {
  collection, addDoc, serverTimestamp, getDocs, getDoc, doc, updateDoc, query, where
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

const ORDERS_COL = "orders";

export async function fetchOrder(orderId){
  const snap = await getDoc(doc(db, ORDERS_COL, orderId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/* items: [{id, name, price, qty}], totals: {subtotal, deliveryFee, total},
   fulfillment: 'delivery' | 'pickup', customer: {name, phone, email, address} */
export async function createOrder({ items, totals, fulfillment, customer, paymentMethod }){
  const ref = await addDoc(collection(db, ORDERS_COL), {
    items, totals, fulfillment, customer, paymentMethod,
    userId: window.currentUser ? window.currentUser.uid : null,
    status: "pending",
    // Explicitly null, not omitted — fetchAvailableDeliveries() and
    // firestore.rules both filter on `riderId == null` to find
    // unclaimed deliveries, and Firestore's `== null` query only
    // matches documents where the field is actually present and set
    // to null. Leaving the field out entirely (as this used to)
    // meant no delivery order could ever match that filter, so no
    // order ever appeared in a rider's Available Deliveries list.
    riderId: null,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

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

export async function fetchMyOrders(uid){
  const q = query(collection(db, ORDERS_COL), where("userId", "==", uid));
  const snap = await getDocs(q);
  const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

/* ---------- Rider module ---------- */

/* Delivery orders that are ready to go out and haven't been claimed
   by a rider yet. Firestore rules only let a rider account read
   orders matching this exact shape (fulfillment: delivery, status:
   ready, riderId: null), so this query mirrors that. */
export async function fetchAvailableDeliveries(){
  const q = query(
    collection(db, ORDERS_COL),
    where("fulfillment", "==", "delivery"),
    where("status", "==", "ready"),
    where("riderId", "==", null)
  );
  const snap = await getDocs(q);
  const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const toSeconds = (val) => {
    if(!val) return 0;
    if(typeof val.seconds === 'number') return val.seconds;
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed / 1000;
  };
  orders.sort((a, b) => toSeconds(a.createdAt) - toSeconds(b.createdAt)); // oldest first — first come, first claimed
  return orders;
}

export async function fetchRiderDeliveries(riderId){
  const q = query(collection(db, ORDERS_COL), where("riderId", "==", riderId));
  const snap = await getDocs(q);
  const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const toSeconds = (val) => {
    if(!val) return 0;
    if(typeof val.seconds === 'number') return val.seconds;
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed / 1000;
  };
  orders.sort((a, b) => toSeconds(b.createdAt) - toSeconds(a.createdAt));
  return orders;
}

export async function claimDelivery(orderId, riderId){
  await updateDoc(doc(db, ORDERS_COL, orderId), { riderId });
}

export async function updateDeliveryStatus(orderId, status, deliveryProof){
  const payload = { status };
  if(deliveryProof !== undefined) payload.deliveryProof = deliveryProof;
  await updateDoc(doc(db, ORDERS_COL, orderId), payload);
}

export async function assignRider(orderId, riderId){
  await updateDoc(doc(db, ORDERS_COL, orderId), { riderId: riderId || null });
}

/* One-time fix for delivery orders created before createOrder() started
   writing riderId: null explicitly. Firestore's where("riderId","==",null)
   query — and the matching firestore.rules check — only match documents
   where riderId is actually present and set to null, not documents
   missing the field entirely, so any order placed before that fix is
   invisible to fetchAvailableDeliveries() and unreadable by riders,
   forever, until backfilled here. Only touches delivery orders with no
   riderId field at all; already-assigned orders are left untouched.
   Safe to run more than once. */
export async function backfillMissingRiderId(){
  const q = query(collection(db, ORDERS_COL), where("fulfillment", "==", "delivery"));
  const snap = await getDocs(q);
  const fixedIds = [];
  for(const d of snap.docs){
    if(!('riderId' in d.data())){
      await updateDoc(d.ref, { riderId: null });
      fixedIds.push(d.id);
    }
  }
  return fixedIds;
}

window.CCOrders = {
  createOrder, fetchAllOrders, fetchMyOrders, fetchOrder, updateOrderStatus,
  fetchAvailableDeliveries, fetchRiderDeliveries, claimDelivery, updateDeliveryStatus, assignRider,
  backfillMissingRiderId
};