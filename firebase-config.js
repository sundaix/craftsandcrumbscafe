/* =========================================================
   Crafts & Crumbs — firebase-config.js
   Central Firebase init. Every other file imports app/auth/db
   from here so there's only ever one Firebase instance.
========================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

const firebaseConfig = {
  apiKey: "AIzaSyDME5Wz8caqS_DOJuZDvmifAmcsUU0dfJc",
  authDomain: "crafts-and-crumbs.firebaseapp.com",
  projectId: "crafts-and-crumbs",
  storageBucket: "crafts-and-crumbs.firebasestorage.app",
  messagingSenderId: "719436447556",
  appId: "1:719436447556:web:ab7f997c379fbccd73a111"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

/* This app never uses onSnapshot (no realtime listeners anywhere) —
   every read/write is a one-shot getDoc/getDocs/setDoc/addDoc. The
   full Firestore SDK still opens a persistent Watch/Listen channel
   in the background regardless (for its own internal cache/network
   management), and that's exactly the connection ad blockers and
   privacy extensions flag and kill with ERR_BLOCKED_BY_CLIENT — no
   long-polling/transport setting avoids it, because the block is on
   that channel existing at all, not on which transport carries it.

   Firestore Lite is Google's official REST-only build: it never opens
   that channel in the first place, so there's nothing for a blocker
   to catch. It doesn't support onSnapshot/offline persistence, but
   this app doesn't use either. */
export const db = getFirestore(app);