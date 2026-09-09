import { db } from "./firebase-config.js";
import {
  collection, getDocs, getDoc, doc, setDoc, addDoc, updateDoc, deleteDoc, deleteField, increment
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

const PRODUCTS_COL = "products";
const CACHE_KEY = "cc_products_cache_v2";

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
  }
}

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

/* =========================================================
   AUTO-FILL DRINK CUSTOMIZATIONS
   Walks every existing drink product (Coffee/Non-Coffee/Tea) and
   fills in whatever customization/detail fields it's still missing —
   option groups (Sweetness Level, Ice Level, and Milk Type when the
   drink actually contains milk), calories, an "about" blurb, and a
   nutrition breakdown — WITHOUT touching a field that's already
   there. An admin who already customized one drink's option groups,
   or already wrote their own calories/about text, keeps exactly what
   they wrote; this only ever fills the gaps, the same spirit as
   cleanupLegacyFoodFields/flattenSizePricing above. Every field this
   adds is fully editable afterward from the regular Edit form (the
   Option Groups Builder, Calories/About/Nutrition fields). */

function ddSlug(str){
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function buildDefaultOptionGroups(product){
  const hasMilk = /\bmilk\b/i.test(product.ingredients || '') || /\bmilk\b/i.test(product.name || '');
  const slug = ddSlug(product.id);
  const groups = [
    {
      id: `group-sweetness-${slug}`,
      label: 'Sweetness Level',
      type: 'single',
      max: null,
      choices: ['100% Sweet', '75% Sweet', '50% Sweet', '25% Sweet', 'No Sugar'].map((label, i) => ({
        id: `choice-sweet-${i}-${slug}`, label, price: 0, kcal: null, available: true, default: i === 0
      }))
    },
    {
      id: `group-ice-${slug}`,
      label: 'Ice Level',
      type: 'single',
      max: null,
      choices: ['Regular Ice', 'Less Ice', 'No Ice'].map((label, i) => ({
        id: `choice-ice-${i}-${slug}`, label, price: 0, kcal: null, available: true, default: i === 0
      }))
    }
  ];
  if(hasMilk){
    groups.push({
      id: `group-milk-${slug}`,
      label: 'Milk Type',
      type: 'single',
      max: null,
      choices: [
        { id: `choice-milk-0-${slug}`, label: 'Whole Milk', price: 0, kcal: null, available: true, default: true },
        { id: `choice-milk-1-${slug}`, label: 'Oat Milk', price: 20, kcal: null, available: true, default: false },
        { id: `choice-milk-2-${slug}`, label: 'Soy Milk', price: 20, kcal: null, available: true, default: false },
        { id: `choice-milk-3-${slug}`, label: 'Almond Milk', price: 25, kcal: null, available: true, default: false }
      ]
    });
  }
  return groups;
}

function estimateDrinkCalories(product){
  const hasMilk = /\bmilk\b/i.test(product.ingredients || '') || /\bmilk\b/i.test(product.name || '');
  if(product.cat === 'Tea') return hasMilk ? 190 : 90;
  if(product.cat === 'Non-Coffee') return hasMilk ? 190 : 100;
  return hasMilk ? 170 : 90; // Coffee
}

function estimateDrinkNutrition(product, calories){
  const hasMilk = /\bmilk\b/i.test(product.ingredients || '') || /\bmilk\b/i.test(product.name || '');
  const opts = Array.isArray(product.sizes) ? product.sizes.map(s => typeof s === 'string' ? s : s.size) : [];
  return {
    servingSize: opts[1] || opts[0] || '16oz',
    carbs: Math.round(calories / 8),
    sugar: Math.round(calories / 9),
    protein: hasMilk ? 4 : 0,
    fat: hasMilk ? 4 : 0,
    sodium: hasMilk ? 70 : 15
  };
}

function buildDefaultAboutText(product){
  const base = product.desc ? product.desc.trim().replace(/\.$/, '') : product.name;
  return `${base}. Adjust the sweetness, ice, and milk to your liking using the options above.`;
}

/* drinkCategories is passed in from admin.js's DRINK_CATEGORIES, same
   reasoning as cleanupLegacyFoodFields taking foodCategories, so the
   two lists can't drift apart. Returns the ids of every drink that
   was actually changed (a drink that already has every field is
   left completely untouched and doesn't count). */
export async function fillMissingDrinkDetails(drinkCategories){
  const snap = await getDocs(collection(db, PRODUCTS_COL));
  const updated = [];
  for(const docSnap of snap.docs){
    const data = docSnap.data();
    if(!drinkCategories.includes(data.cat)) continue;
    const product = { id: docSnap.id, ...data };

    const fields = {};
    if(!Array.isArray(data.optionGroups) || !data.optionGroups.length){
      fields.optionGroups = buildDefaultOptionGroups(product);
    }
    if(typeof data.calories !== 'number'){
      fields.calories = estimateDrinkCalories(product);
    }
    if(!data.aboutText){
      fields.aboutText = buildDefaultAboutText(product);
    }
    if(!data.nutrition || !Object.keys(data.nutrition).length){
      fields.nutrition = estimateDrinkNutrition(product, fields.calories !== undefined ? fields.calories : data.calories);
    }

    if(!Object.keys(fields).length) continue; // already fully filled in

    await updateDoc(doc(db, PRODUCTS_COL, docSnap.id), fields);
    patchCachedProduct(docSnap.id, fields);
    updated.push(docSnap.id);
  }
  return updated;
}

/* =========================================================
   NORMALIZE DRINK SIZES TO 16oz / 20oz / 24oz
   Rewrites every Coffee/Non-Coffee/Tea product's `sizes` array to
   exactly three entries — 16oz, 20oz, 24oz — each priced ₱20 apart,
   using whatever that drink's cheapest existing size was priced at
   as the new 16oz price (so nobody's drink randomly gets cheaper or
   pricier, it just gets re-labeled onto the three-size scale). A
   product that's missing sizes entirely, or only has one or two, is
   just as broken for the customer-facing size selector as one with
   the wrong labels — both get fixed here the same way. Drinks that
   already have exactly 16oz/20oz/24oz are left completely alone. */
export async function normalizeDrinkSizes(drinkCategories){
  const snap = await getDocs(collection(db, PRODUCTS_COL));
  const updated = [];
  for(const docSnap of snap.docs){
    const data = docSnap.data();
    if(!drinkCategories.includes(data.cat)) continue;

    const existingOpts = Array.isArray(data.sizes)
      ? data.sizes.map(s => typeof s === 'string' ? { size: s, price: data.price } : s)
      : [];
    const currentLabels = existingOpts.map(o => o.size).filter(Boolean);
    const alreadyCorrect = currentLabels.length === 3 &&
      ['16oz', '20oz', '24oz'].every(sz => currentLabels.includes(sz));
    if(alreadyCorrect) continue;

    const basePrice = existingOpts.length
      ? Math.min(...existingOpts.map(o => typeof o.price === 'number' ? o.price : data.price))
      : (typeof data.price === 'number' ? data.price : 0);
    const newSizes = [
      { size: '16oz', price: basePrice },
      { size: '20oz', price: basePrice + 20 },
      { size: '24oz', price: basePrice + 40 }
    ];

    await updateDoc(doc(db, PRODUCTS_COL, docSnap.id), { sizes: newSizes, price: basePrice });
    patchCachedProduct(docSnap.id, { sizes: newSizes, price: basePrice });
    updated.push(docSnap.id);
  }
  return updated;
}

window.CCProducts = { fetchAllProducts, addProduct, updateProduct, deleteProduct, seedProducts, getCachedProducts, decrementStock, cleanupLegacyFoodFields, flattenSizePricing, fillMissingDrinkDetails, normalizeDrinkSizes };
