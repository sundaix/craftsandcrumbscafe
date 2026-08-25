/* =========================================================
   Crafts & Crumbs — products-service.js
   All Firestore reads/writes for the "products" collection
   live here. script.js calls these instead of touching a
   hardcoded array.
========================================================= */
import { db } from "./firebase-config.js";
import {
  collection, getDocs, getDoc, doc, setDoc, addDoc, updateDoc, deleteDoc, deleteField, increment
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
function patchCachedProduct(id, fields, fieldsToDelete){
  const cached = getCachedProducts();
  if(!cached) return;
  const idx = cached.findIndex(p => p.id === id);
  if(idx > -1){
    const merged = { ...cached[idx], ...fields };
    if(fieldsToDelete) fieldsToDelete.forEach(f => delete merged[f]);
    cached[idx] = merged;
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

/* Used by the Admin dashboard's "Edit" action on a product row.
   fieldsToDelete (optional) removes keys from the doc entirely — e.g.
   clearing `ingredients`/`allergens` off a product that's being changed
   to a merch category, or `sizes` off one moving to a flat-price
   category. updateDoc() only ever touches the keys it's given, so
   simply leaving a field out of `fields` would NOT remove it; it has
   to be set to Firestore's deleteField() sentinel explicitly. */
export async function updateProduct(id, fields, fieldsToDelete){
  const payload = { ...fields };
  if(fieldsToDelete && fieldsToDelete.length){
    fieldsToDelete.forEach(f => { payload[f] = deleteField(); });
  }
  await updateDoc(doc(db, PRODUCTS_COL, id), payload);
  patchCachedProduct(id, fields, fieldsToDelete);
}

/* Used by the Admin dashboard's "Delete" action on a product row. */
export async function deleteProduct(id){
  await deleteDoc(doc(db, PRODUCTS_COL, id));
  removeCachedProduct(id);
}

export async function decrementStock(items){
  for(const item of items){
    await updateDoc(doc(db, PRODUCTS_COL, item.id), { stock: increment(-item.qty) });
  }
}

/* One-off cleanup for merch products that still carry stray
   ingredients/allergens fields written before category-aware saving
   existed (see the comment on updateProduct above). Normally those
   fields only get deleted when an admin re-saves that specific
   product through the edit form — this walks every product still in
   Firestore and deletes the two fields from any doc whose category
   isn't food, so a merch item nobody has re-saved yet still gets
   cleaned up.

   foodCategories is passed in from admin.js's FOOD_CATEGORIES rather
   than duplicated here, so the two lists can't drift apart. Returns
   the ids of every product that was actually changed, so the caller
   can report a real count instead of "done" with no detail. */
export async function cleanupLegacyFoodFields(foodCategories){
  const snap = await getDocs(collection(db, PRODUCTS_COL));
  const cleaned = [];
  for(const docSnap of snap.docs){
    const data = docSnap.data();
    if(foodCategories.includes(data.cat)) continue; // food item — these fields belong here
    const hasIngredients = Object.prototype.hasOwnProperty.call(data, 'ingredients');
    const hasAllergens = Object.prototype.hasOwnProperty.call(data, 'allergens');
    if(!hasIngredients && !hasAllergens) continue; // already clean
    const fieldsToDelete = {};
    if(hasIngredients) fieldsToDelete.ingredients = deleteField();
    if(hasAllergens) fieldsToDelete.allergens = deleteField();
    await updateDoc(doc(db, PRODUCTS_COL, docSnap.id), fieldsToDelete);
    patchCachedProduct(docSnap.id, {}, ['ingredients', 'allergens']);
    cleaned.push(docSnap.id);
  }
  return cleaned;
}

/* One-time migration for sized merch (Caps, Shorts, Socks) that was
   seeded/added before per-size pricing existed, or that was seeded
   before the starter catalog's `sizes` prices were spread out to match
   the Shirts pattern. seedProducts() only ever ADDS missing docs and
   never touches ones that already exist, so a product added back when
   Shorts/Socks/Caps still had one flat price across all sizes stays
   flat forever unless something like this walks through and fixes it.

   sizedCategories/seedProductsList are passed in from script.js's
   SIZED_CATEGORIES/SEED_PRODUCTS (same reasoning as
   cleanupLegacyFoodFields taking foodCategories) so this file doesn't
   duplicate that list and the two can't drift apart.

   For each sized product that doesn't yet have real per-size pricing:
   - If its id matches one of the built-in starter-catalog items, it
     gets that item's exact sizes/prices (same graduated pricing the
     Shirts already use).
   - Otherwise (a custom product an admin added) a graduated schedule
     is derived from its current flat price, on the same "smaller
     sizes stay at the base price, bigger sizes step up" pattern as
     the Shirts seed data, so it's not left flat.
   - A product with only one size (e.g. a Cap's "One Size") is left
     alone — there's nothing to graduate across a single size, and
     that's expected, not a bug.
   - A product that already has two-plus differently-priced sizes is
     left alone — it's already migrated.

   Returns the ids of every product that was actually changed. */
export async function applyGraduatedSizePricing(sizedCategories, seedProductsList){
  const snap = await getDocs(collection(db, PRODUCTS_COL));
  const seedById = {};
  seedProductsList.forEach(p => { seedById[p.id] = p; });

  const updated = [];
  for(const docSnap of snap.docs){
    const data = docSnap.data();
    if(!sizedCategories.includes(data.cat)) continue;
    if(!data.sizes || data.sizes.length < 2) continue; // no sizes, or only one (e.g. One Size Caps) — nothing to graduate

    const opts = data.sizes.map(s => typeof s === 'string' ? { size: s, price: data.price } : s);
    const alreadyVaries = new Set(opts.map(o => o.price)).size > 1;
    if(alreadyVaries) continue; // already has shirt-style per-size pricing

    const seed = seedById[docSnap.id];
    let newSizes;
    if(seed && seed.cat === data.cat && seed.sizes && seed.sizes.length > 1){
      newSizes = seed.sizes.map(s => ({ ...s }));
    } else {
      const base = opts[0].price;
      const step = Math.max(10, Math.round((base * 0.07) / 10) * 10); // ~7% of base price per size-tier, rounded to nearest ₱10
      const midpoint = Math.ceil(opts.length / 2);
      newSizes = opts.map((o, i) => ({
        size: o.size,
        price: base + Math.max(0, i - midpoint + 1) * step
      }));
    }

    const newPrice = Math.min(...newSizes.map(s => s.price));
    await updateDoc(doc(db, PRODUCTS_COL, docSnap.id), { sizes: newSizes, price: newPrice });
    patchCachedProduct(docSnap.id, { sizes: newSizes, price: newPrice });
    updated.push(docSnap.id);
  }
  return updated;
}

window.CCProducts = { fetchAllProducts, addProduct, updateProduct, deleteProduct, seedProducts, getCachedProducts, decrementStock, cleanupLegacyFoodFields, applyGraduatedSizePricing };
