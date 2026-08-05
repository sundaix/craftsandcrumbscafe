/* =========================================================
   Crafts & Crumbs — products-service.js
   All Firestore reads/writes for the "products" collection
   live here. script.js calls these instead of touching a
   hardcoded array.
========================================================= */
import { db } from "./firebase-config.js";
import {
  collection, getDocs, getDoc, doc, setDoc, addDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

const PRODUCTS_COL = "products";
const CACHE_KEY = "cc_products_cache_v2";

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

/* Keeps the localStorage cache in sync with individual admin writes
   (add/update/delete), so the "paint instantly from cache" fast-path
   on the next page load never shows a price/product that's already
   been changed in Firestore. Without this, an admin edit was only
   reflected in the cache after the NEXT full fetchAllProducts() call,
   which meant an old price could still flash briefly on page reload. */
function patchCachedProduct(id, fields){
  const cached = getCachedProducts();
  if(!cached) return;
  const idx = cached.findIndex(p => p.id === id);
  if(idx > -1){
    cached[idx] = { ...cached[idx], ...fields };
    setCachedProducts(cached);
  }
}

function addCachedProduct(product){
  const cached = getCachedProducts();
  if(!cached) return; // nothing cached yet — next fetchAllProducts() will populate it
  setCachedProducts([...cached, product]);
}

function removeCachedProduct(id){
  const cached = getCachedProducts();
  if(!cached) return;
  setCachedProducts(cached.filter(p => p.id !== id));
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
  addCachedProduct({ id: ref.id, ...product });
  return ref.id;
}

/* One-time seeder: pushes an array of {id, ...fields} products
   into Firestore, using the given id as the doc id so it matches
   the ids already baked into script.js (best-seller list, etc).

   Safe to re-run in the sense that it only ever *fills gaps* — for
   each product it checks whether that id's doc already exists and,
   if so, leaves it completely untouched. Previously this used
   setDoc() unconditionally, which fully overwrites a Firestore doc
   (not a merge/patch); re-clicking "Seed Starter Catalog" after an
   admin had already edited a product's image, price, or stock would
   blow those edits away and replace them with the hardcoded starter
   values. Skipping existing docs means the button only ever adds
   products that are missing — e.g. after a fresh Firestore project,
   or a product that was deleted — and never resets one that's
   already there. */
export async function seedProducts(productsArray){
  let added = 0;
  for(const p of productsArray){
    const { id, ...fields } = p;
    const ref = doc(db, PRODUCTS_COL, id);
    const existing = await getDoc(ref);
    if(existing.exists()) continue; // already in Firestore — don't clobber admin edits
    await setDoc(ref, fields);
    added++;
  }
  return added;
}

/* Used by the Admin dashboard's "Edit" action on a product row. */
export async function updateProduct(id, fields){
  await updateDoc(doc(db, PRODUCTS_COL, id), fields);
  patchCachedProduct(id, fields);
}

/* Used by the Admin dashboard's "Delete" action on a product row. */
export async function deleteProduct(id){
  await deleteDoc(doc(db, PRODUCTS_COL, id));
  removeCachedProduct(id);
}

window.CCProducts = { fetchAllProducts, addProduct, updateProduct, deleteProduct, seedProducts, getCachedProducts };
