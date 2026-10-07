import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, doc, updateDoc, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

/* Contact-form inbox with two-way replies.
   contactMessages/{id}          one conversation (the customer's first message)
   contactMessages/{id}/replies  every later message, from the customer or an admin
   Customers can only touch their own conversations and admins can touch all
   (see the contactMessages block in firestore.rules). Guests can send a first
   message but have no account to receive replies, so admin answers those by email. */
const COL = "contactMessages";

const toSeconds = (val) => {
  if(!val) return 0;
  if(typeof val.seconds === 'number') return val.seconds;
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? 0 : parsed / 1000;
};
const newestFirst = (a, b) =>
  toSeconds(b.lastActivityAt || b.createdAt) - toSeconds(a.lastActivityAt || a.createdAt);

/* ---------- storefront ---------- */
export async function sendMessage({ name, email, subject, message }){
  const user = window.currentUser;
  const ref = await addDoc(collection(db, COL), {
    name, email, subject, message,
    status: 'new',
    // Real accounts are linked so the customer can read replies; guests stay null.
    userId: (user && !user.isAnonymous) ? user.uid : null,
    adminUnread: true,
    customerUnread: false,
    lastActivityAt: serverTimestamp(),
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function fetchMyMessages(uid){
  const snap = await getDocs(query(collection(db, COL), where('userId', '==', uid)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(newestFirst);
}

export async function markReadByCustomer(messageId){
  await updateDoc(doc(db, COL, messageId), { customerUnread: false });
}

/* ---------- admin ---------- */
export async function fetchAllMessages(){
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(newestFirst);
}

export async function setMessageStatus(messageId, status){
  if(status !== 'new' && status !== 'handled') throw new Error('Invalid status');
  await updateDoc(doc(db, COL, messageId), { status });
}

export async function markReadByAdmin(messageId){
  await updateDoc(doc(db, COL, messageId), { adminUnread: false });
}

/* ---------- both sides ---------- */
export async function fetchReplies(messageId){
  const snap = await getDocs(collection(db, COL, messageId, 'replies'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => toSeconds(a.createdAt) - toSeconds(b.createdAt));
}

/* role is 'admin' or 'customer'. The rules re-check that the signed-in
   user really is that role, so this is not a trust boundary. */
export async function sendReply(messageId, role, text){
  const user = window.currentUser;
  if(!user) throw new Error('Not signed in');
  await addDoc(collection(db, COL, messageId, 'replies'), {
    authorRole: role,
    authorUid: user.uid,
    text,
    createdAt: serverTimestamp()
  });
  // An admin answer closes the conversation and flags it for the customer;
  // a customer answer re-opens it and flags it for the admin.
  const patch = role === 'admin'
    ? { status: 'handled', customerUnread: true, adminUnread: false, lastActivityAt: serverTimestamp() }
    : { status: 'new', adminUnread: true, lastActivityAt: serverTimestamp() };
  await updateDoc(doc(db, COL, messageId), patch);
}

window.CCContact = {
  sendMessage, fetchMyMessages, markReadByCustomer,
  fetchAllMessages, setMessageStatus, markReadByAdmin,
  fetchReplies, sendReply
};