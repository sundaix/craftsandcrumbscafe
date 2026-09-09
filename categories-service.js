import { db } from "./firebase-config.js";
import {
  collection, getDocs, doc, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

const CATEGORIES_COL = "categories";
const CACHE_KEY = "cc_categories_cache_v1";

export function getCachedCategories(){
  try{
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(err){
    return null;
  }
}

function setCachedCategories(categories){
  try{
    localStorage.setItem(CACHE_KEY, JSON.stringify(categories));
  } catch(err){
  }
}

export async function fetchAllCategories(){
  const snap = await getDocs(collection(db, CATEGORIES_COL));
  const categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  setCachedCategories(categories);
  return categories;
}

export async function addCategory(category){
  const { id, ...fields } = category;
  await setDoc(doc(db, CATEGORIES_COL, id), fields);
  const cached = getCachedCategories() || [];
  setCachedCategories([...cached.filter(c => c.id !== id), { id, ...fields }]);
  return id;
}

export async function deleteCategory(id){
  await deleteDoc(doc(db, CATEGORIES_COL, id));
  const cached = getCachedCategories();
  if(cached) setCachedCategories(cached.filter(c => c.id !== id));
}

window.CCCategories = { fetchAllCategories, addCategory, deleteCategory, getCachedCategories };
