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

/* items: [{id, qty, size}]. Plain top-level stock is decremented with
   Firestore's increment() sentinel as before. Sized items (size is
   set) fall into two cases:
   - Wearables with real per-size stock (the {size, stock} shape) need
     that specific entry adjusted — Firestore's increment() can't
     target one element of an array field, so this reads the doc,
     adjusts that size's stock in JS, and writes the whole array back,
     keeping the top-level `stock` (used everywhere else as the "is
     stock tracked at all" flag and the admin table's total) in sync
     as the sum of all sizes' stock.
   - Drinks (size is set, but sizes are {size, price} with no stock
     tracked per size) have nothing to adjust in the array at all — an
     order for any size still only draws down the one shared flat
     `stock` count, exactly like an unsized product. */
export async function decrementStock(items){
  for(const item of items){
    if(item.size){
      const ref = doc(db, PRODUCTS_COL, item.id);
      const snap = await getDoc(ref);
      if(!snap.exists()) continue;
      const data = snap.data();
      const hasPerSizeStock = Array.isArray(data.sizes) &&
        data.sizes.some(s => typeof s === 'object' && s !== null && typeof s.stock === 'number');

      if(hasPerSizeStock){
        let touched = false;
        const newSizes = data.sizes.map(s => {
          if(typeof s === 'string' || s.size !== item.size || typeof s.stock !== 'number') return s;
          touched = true;
          return { ...s, stock: Math.max(0, s.stock - item.qty) };
        });
        if(touched){
          const totalStock = newSizes.reduce((sum, s) =>
            sum + (typeof s === 'object' && typeof s.stock === 'number' ? s.stock : 0), 0);
          await updateDoc(ref, { sizes: newSizes, stock: totalStock });
          patchCachedProduct(item.id, { sizes: newSizes, stock: totalStock });
          continue;
        }
      }
      // Sized but no per-size stock tracked (drinks) — fall back to
      // the flat top-level count, same as an unsized product.
      await updateDoc(ref, { stock: increment(-item.qty) });
    } else {
      await updateDoc(doc(db, PRODUCTS_COL, item.id), { stock: increment(-item.qty) });
    }
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

/* One-time cleanup for sized merch (Shirts, Caps, Shorts, Socks) that
   still carries old per-size pricing — a `sizes` array of
   {size, price} objects where different sizes cost different amounts,
   left over from before per-size pricing was reverted back to one
   flat price per product. This walks every sized product and, for any
   that still has a legacy per-size price, collapses it back to a
   single price (the lowest of its current per-size prices, so no
   customer sees a price go up). Per-size stock (the current
   {size, stock} shape) is left completely untouched either way — this
   tool only ever fixes leftover pricing, never stock.

   sizedCategories is passed in from script.js's SIZED_CATEGORIES (same
   reasoning as cleanupLegacyFoodFields taking foodCategories) so this
   file doesn't duplicate that list and the two can't drift apart.

   A product with no legacy per-size pricing (plain strings, or the
   current {size, stock} shape) is left alone — there's nothing to fix.
   Returns the ids of every product that was actually changed. */
export async function flattenSizePricing(sizedCategories){
  const snap = await getDocs(collection(db, PRODUCTS_COL));

  const updated = [];
  for(const docSnap of snap.docs){
    const data = docSnap.data();
    if(!sizedCategories.includes(data.cat)) continue;
    if(!data.sizes || !data.sizes.length) continue;

    const hasLegacyPricing = data.sizes.some(s => typeof s === 'object' && s !== null && typeof s.price === 'number');
    if(!hasLegacyPricing) continue; // plain strings, or already the {size, stock} shape — nothing to do

    const opts = data.sizes.map(s => typeof s === 'string'
      ? { size: s, price: data.price, stock: null }
      : { size: s.size, price: typeof s.price === 'number' ? s.price : data.price, stock: typeof s.stock === 'number' ? s.stock : null }
    );

    const newPrice = Math.min(...opts.map(o => o.price));
    // Collapse each entry back to a plain string (no stock tracked) or
    // {size, stock} (stock tracked) — whichever it already had. Only
    // the redundant per-size `price` is dropped.
    const newSizes = opts.map(o => o.stock !== null ? { size: o.size, stock: o.stock } : o.size);

    await updateDoc(doc(db, PRODUCTS_COL, docSnap.id), { sizes: newSizes, price: newPrice });
    patchCachedProduct(docSnap.id, { sizes: newSizes, price: newPrice });
    updated.push(docSnap.id);
  }
  return updated;
}

window.CCProducts = { fetchAllProducts, addProduct, updateProduct, deleteProduct, seedProducts, getCachedProducts, decrementStock, cleanupLegacyFoodFields, flattenSizePricing };
