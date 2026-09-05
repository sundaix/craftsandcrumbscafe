import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

const SETTINGS_COL = "settings";
const GENERAL_DOC_ID = "general";
const CACHE_KEY = "cc_settings_cache_v1";

export const DEFAULT_DELIVERY_FEE = 60;

export function getCachedSettings(){
  try{
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(err){
    return null;
  }
}

function setCachedSettings(settings){
  try{
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch(err){
  }
}

export async function fetchSettings(){
  const snap = await getDoc(doc(db, SETTINGS_COL, GENERAL_DOC_ID));
  const settings = {
    deliveryFee: DEFAULT_DELIVERY_FEE,
    ...(snap.exists() ? snap.data() : {})
  };
  setCachedSettings(settings);
  return settings;
}

export async function updateDeliveryFee(fee){
  await setDoc(doc(db, SETTINGS_COL, GENERAL_DOC_ID), { deliveryFee: fee }, { merge: true });
  const cached = getCachedSettings() || { deliveryFee: DEFAULT_DELIVERY_FEE };
  setCachedSettings({ ...cached, deliveryFee: fee });
}

window.CCSettings = { fetchSettings, updateDeliveryFee, getCachedSettings, DEFAULT_DELIVERY_FEE };