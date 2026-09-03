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
export const db = getFirestore(app);
