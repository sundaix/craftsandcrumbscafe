/* =========================================================
   Crafts & Crumbs — products-service.js
   All Firestore reads/writes for the "products" collection
   live here. script.js calls these instead of touching a
   hardcoded array.
========================================================= */
import { db } from "./firebase-config.js";
import {
  collection, getDocs, doc, setDoc, addDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

const PRODUCTS_COL = "products";
const CACHE_KEY = "cc_products_cache_v1";

/* Synchronous read of whatever product list was cached from the
   last successful Firestore fetch. Lets the UI paint immediately
   on repeat visits instead of waiting on a network round trip.
   Returns null if nothing has been cached yet (first-ever visit). */
export function getCachedProducts(){
  try{
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(err){
    return null;
  }
}

function setCachedProducts(products){
  try{
    localStorage.setItem(CACHE_KEY, JSON.stringify(products));
  } catch(err){
    // Storage full/unavailable (private browsing, etc.) — safe to ignore,
    // it just means we skip the fast-path cache next time.
  }
}

/* Reads every product from Firestore. Returns [] if the
   collection is empty (e.g. before seeding has been run).
   Also refreshes the local cache on success so the next page
   load can render instantly before this fetch even starts. */
export async function fetchAllProducts(){
  const snap = await getDocs(collection(db, PRODUCTS_COL));
  const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  setCachedProducts(products);
  return products;
}

/* Used by the Admin "Add Product" form. Firestore auto-generates
   the doc id so admins never have to think about unique ids. */
export async function addProduct(product){
  const ref = await addDoc(collection(db, PRODUCTS_COL), product);
  return ref.id;
}

/* One-time seeder: pushes an array of {id, ...fields} products
   into Firestore, using the given id as the doc id so it matches
   the ids already baked into script.js (best-seller list, etc).
   Safe to re-run — setDoc overwrites rather than duplicating. */
export async function seedProducts(productsArray){
  for(const p of productsArray){
    const { id, ...fields } = p;
    await setDoc(doc(db, PRODUCTS_COL, id), fields);
  }
}

/* Used by the Admin dashboard's "Edit" action on a product row. */
export async function updateProduct(id, fields){
  await updateDoc(doc(db, PRODUCTS_COL, id), fields);
}

/* Used by the Admin dashboard's "Delete" action on a product row. */
export async function deleteProduct(id){
  await deleteDoc(doc(db, PRODUCTS_COL, id));
}

window.CCProducts = { fetchAllProducts, addProduct, updateProduct, deleteProduct, seedProducts, getCachedProducts };