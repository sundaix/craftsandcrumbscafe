import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore-lite.js";

const SETTINGS_COL = "settings";
const GENERAL_DOC_ID = "general";
const CACHE_KEY = "cc_settings_cache_v1";

export const DEFAULT_DELIVERY_FEE = 60;

export const DEFAULT_PROMO_POPUP = {
  enabled: true,
  badgeText: 'New',
  eyebrow: 'Just Dropped',
  headline: 'Fresh Brews,<br>Fresh Merch.',
  copy: 'New seasonal drinks and a handcrafted merch line just landed at Crafts & Crumbs — brewed and stitched with the same care as always.',
  ctaText: 'Take a Look',
  dismissText: 'Maybe later',
  category: '',
  sortMode: 'featured',
  productIds: []
};

/* productIds empty means "use the built-in curated list" (BEST_SELLER_IDS
   in script.js) — this way an admin who's never touched this form yet
   doesn't need to see the homepage change out from under them. */
export const DEFAULT_POPULAR_SECTION = {
  eyebrow: 'Loved by regulars',
  heading: 'Popular this week',
  subtext: 'Favorites our regulars keep reordering.',
  buttonText: 'View full menu',
  productIds: []
};

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
  const data = snap.exists() ? snap.data() : {};
  const settings = {
    deliveryFee: DEFAULT_DELIVERY_FEE,
    ...data,
    promoPopup: { ...DEFAULT_PROMO_POPUP, ...(data.promoPopup || {}) },
    popularSection: { ...DEFAULT_POPULAR_SECTION, ...(data.popularSection || {}) }
  };
  setCachedSettings(settings);
  return settings;
}

export async function updateDeliveryFee(fee){
  await setDoc(doc(db, SETTINGS_COL, GENERAL_DOC_ID), { deliveryFee: fee }, { merge: true });
  const cached = getCachedSettings() || { deliveryFee: DEFAULT_DELIVERY_FEE };
  setCachedSettings({ ...cached, deliveryFee: fee });
}

/* promoPopup is always saved as a whole object (the admin form always
   submits every field), so a shallow Firestore merge on just this one
   top-level key is enough — no need for dot-path field updates. */
export async function updatePromoPopup(promoPopup){
  await setDoc(doc(db, SETTINGS_COL, GENERAL_DOC_ID), { promoPopup }, { merge: true });
  const cached = getCachedSettings() || { deliveryFee: DEFAULT_DELIVERY_FEE, promoPopup: DEFAULT_PROMO_POPUP };
  setCachedSettings({ ...cached, promoPopup });
}

/* Same pattern as updatePromoPopup — whole object, shallow merge. */
export async function updatePopularSection(popularSection){
  await setDoc(doc(db, SETTINGS_COL, GENERAL_DOC_ID), { popularSection }, { merge: true });
  const cached = getCachedSettings() || { deliveryFee: DEFAULT_DELIVERY_FEE, popularSection: DEFAULT_POPULAR_SECTION };
  setCachedSettings({ ...cached, popularSection });
}

window.CCSettings = {
  fetchSettings, updateDeliveryFee, updatePromoPopup, updatePopularSection, getCachedSettings,
  DEFAULT_DELIVERY_FEE, DEFAULT_PROMO_POPUP, DEFAULT_POPULAR_SECTION
};