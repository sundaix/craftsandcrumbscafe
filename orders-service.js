import { db } from "./firebase-config.js";
import {
  collection, addDoc, setDoc, serverTimestamp, getDocs, getDoc, doc, updateDoc, query, where
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

/* ---------- Returns & refunds ----------
   One return request per order: the doc id IS the order id, so a second
   request for the same order can't be created (the rules only allow
   `create`, and the doc already exists). Customers create + read their
   own; only admins can move a request through its statuses.
   Statuses: requested -> approved | rejected -> refunded.
   Refunds are recorded manually (the admin sends the money back through
   PayMongo / GCash themselves, then marks it refunded here). */
const RETURNS_COL = "returns";

export async function createReturnRequest({ order, reason, note }){
  const c = order.customer || {};
  const payload = {
    orderId: order.id,
    userId: window.currentUser ? window.currentUser.uid : null,
    status: "requested",
    reason,
    customerNote: note || "",
    customer: { name: c.name || "", email: c.email || "", phone: c.phone || "" },
    // Snapshot of what was ordered, so the admin sees exactly what the
    // customer is returning even if a product is later renamed/deleted.
    items: (order.items || []).map(it => ({
      id: it.id, name: it.name, qty: it.qty, price: it.price,
      size: it.size || null,
      optionsSummary: it.optionsSummary || null
    })),
    refundAmount: (order.totals && order.totals.total) || 0,
    createdAt: serverTimestamp()
  };
  await setDoc(doc(db, RETURNS_COL, order.id), payload);
}

export async function fetchMyReturns(uid){
  const q = query(collection(db, RETURNS_COL), where("userId", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchAllReturns(){
  const snap = await getDocs(collection(db, RETURNS_COL));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const toSeconds = (val) => {
    if(!val) return 0;
    if(typeof val.seconds === 'number') return val.seconds;
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed / 1000;
  };
  list.sort((a, b) => toSeconds(b.createdAt) - toSeconds(a.createdAt));
  return list;
}

/* Admin only (firestore.rules). `fields` may only contain the keys the
   returns rule allows: status, adminNote, refundRef, restocked,
   restockedSummary, reviewedBy, reviewedAt, refundedAt. */
export async function updateReturn(returnId, fields){
  await updateDoc(doc(db, RETURNS_COL, returnId), fields);
}

window.CCOrders = {
  createOrder, fetchAllOrders, fetchMyOrders, fetchOrder, updateOrderStatus,
  fetchAvailableDeliveries, fetchRiderDeliveries, claimDelivery, updateDeliveryStatus, assignRider,
  backfillMissingRiderId,
  createReturnRequest, fetchMyReturns, fetchAllReturns, updateReturn
};