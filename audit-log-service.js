import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

const LOG_COL = "activityLog";

export async function writeActivityLog({ action, entityType, entityId, summary }){
  const user = window.currentUser;
  await addDoc(collection(db, LOG_COL), {
    adminUid: user ? user.uid : null,
    adminName: (user && (user.displayName || user.email)) || 'Unknown admin',
    adminEmail: (user && user.email) || null,
    action, entityType,
    entityId: entityId != null ? String(entityId) : null,
    summary,
    createdAt: serverTimestamp()
  });
}

export async function fetchActivityLog(max = 200){
  const snap = await getDocs(collection(db, LOG_COL));
  const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const toSeconds = (val) => {
    if(!val) return 0;
    if(typeof val.seconds === 'number') return val.seconds;
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed / 1000;
  };
  entries.sort((a, b) => toSeconds(b.createdAt) - toSeconds(a.createdAt));
  return entries.slice(0, max);
}

window.CCAuditLog = { writeActivityLog, fetchActivityLog };