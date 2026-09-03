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

export async function seedProducts(productsArray){
  let added = 0;
  for(const p of productsArray){
    const { id, ...fields } = p;
    const ref = doc(db, PRODUCTS_COL, id);
    const existing = await getDoc(ref);
    if(existing.exists()) continue; 
    await setDoc(ref, fields);
    added++;
  }
  return added;
}

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
    const newSizes = opts.map(o => o.stock !== null ? { size: o.size, stock: o.stock } : o.size);

    await updateDoc(doc(db, PRODUCTS_COL, docSnap.id), { sizes: newSizes, price: newPrice });
    patchCachedProduct(docSnap.id, { sizes: newSizes, price: newPrice });
    updated.push(docSnap.id);
  }
  return updated;
}

window.CCProducts = { fetchAllProducts, addProduct, updateProduct, deleteProduct, seedProducts, getCachedProducts, decrementStock, cleanupLegacyFoodFields, flattenSizePricing };
