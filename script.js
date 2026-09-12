const SIZE_CHARTS = {
  Shirts: {
    unit: 'cm',
    columns: ['Chest', 'Length', 'Shoulder'],
    rows: {
      'XS':  ['86–89',  '64', '40'],
      'S':   ['90–93',  '66', '42'],
      'M':   ['94–97',  '68', '44'],
      'L':   ['98–103', '70', '46'],
      'XL':  ['104–109','72', '48'],
      'XXL': ['110–115','74', '50'],
    }
  },
  Shorts: {
    unit: 'cm',
    columns: ['Waist', 'Hip', 'Length'],
    rows: {
      'XS':  ['66–69',  '88–91',  '38'],
      'S':   ['70–73',  '92–95',  '39'],
      'M':   ['74–78',  '96–100', '40'],
      'L':   ['79–84',  '101–106','41'],
      'XL':  ['85–91',  '107–113','42'],
      'XXL': ['92–98',  '114–120','43'],
    }
  },
  Socks: {
    unit: '',
    columns: ['Shoe Size (US)', 'Shoe Size (UK)'],
    rows: {
      'S': ['4–6.5',  '3–6'],
      'M': ['7–9.5',  '6–9'],
      'L': ['10–13',  '9–12'],
    }
  },
  Caps: {
    unit: '',
    columns: ['Head Circumference'],
    rows: {
      'One Size': ['54–60 cm, adjustable strap'],
    }
  }
};

const CATEGORIES = [
  { key:'Coffee', emoji:'☕', title:'Coffee', desc:'Slow-pulled espresso and small-batch roasts, brewed to order.', img:'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&q=80' },
  { key:'Pastries', emoji:'🥐', title:'Pastries', desc:'Laminated, folded, and baked fresh every single morning.', img:'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500&q=80' },
  { key:'Wearables', emoji:'🎁', title:'Merchandise', desc:'Shirts, caps, bracelets, and keychains made for regulars.', img:'merchcac.png' },
];

/* ================= STATE ================= */
let cart = []; // {id, qty, size}
let cartOwnerUid = null; // uid whose cart is currently loaded into `cart` — null while signed out

/* COMBOS / COMBO_PRODUCTS moved to shared-catalog.js — see
   buildComboProducts() there. */

function persistCart(){
  if(!cartOwnerUid) return;
  window.CCCart.saveCart(cartOwnerUid, cart);
}

function mergeCarts(base, incoming){
  const merged = base.map(c => ({ ...c }));
  incoming.forEach(line => {
    const match = merged.find(c => c.id === line.id && c.size === line.size);
    if(match){ match.qty += line.qty; } else { merged.push({ ...line }); }
  });
  return merged;
}

function rerenderActiveCartPage(){
  const activePage = $('.page.active').data('page');
  if(activePage === 'cart') renderCart();
  if(activePage === 'checkout') renderCheckoutSummary();
}

/* Called from authStateReady on every login/logout/page load. Cart
   now lives in Firestore (cart-service.js) instead of localStorage,
   so the same cart shows up on web and mobile. */
async function syncCartToAccount(realUser){
  if(realUser){
    if(cartOwnerUid === realUser.uid) return; // already this account's cart, nothing to do
    const saved = await window.CCCart.fetchCart(realUser.uid);
    cart = mergeCarts(saved, cart); // keep anything just added as a guest, add back what was saved
    cartOwnerUid = realUser.uid;
    persistCart();
    updateCartCount();
    rerenderActiveCartPage();
    return;
  }
  // No real (non-anonymous) user right now. Only clear the cart if an
  // account was actually just signed OUT of — guest checkout also
  // triggers this listener via ensureSignedIn()'s anonymous sign-in,
  // and that must NOT wipe items a guest already added.
  if(cartOwnerUid === null) return;
  cartOwnerUid = null;
  cart = [];
  updateCartCount();
  rerenderActiveCartPage();
}
let currentProductId = SEED_PRODUCTS[0].id;
let pdQty = 1;
let pdSize = null;
/* Currently-selected choices on the product detail page's option
   groups (bean, milk, syrup, etc — see getOptionGroups below).
   Shape: { [groupId]: [choiceId, ...] }. Reset each time
   renderProductDetail() opens a product. */
let pdOptions = {};
let menuFilter = 'Coffee';
let menuSearch = '';
let menuSort = 'featured';
let merchFilter = 'Shirts';
let merchSearch = '';
let merchSort = 'featured';

/* Remembers whatever category was selected right before a search
   started typing, so that clearing the search box (rather than
   picking a new category) puts the customer back where they were
   instead of stranding them on "All Items"/"All Merchandise". Reset
   to null once restored. */
let menuFilterBeforeSearch = null;
let merchFilterBeforeSearch = null;
let fulfillment = 'delivery';

let wishlist = []; // array of product ids
let wishlistOwnerUid = null; // uid whose wishlist is currently loaded — null while signed out

/* ================= MENU SIDEBAR DATA ================= */
const MENU_SIDEBAR = [
  { group:'Drinks', items:[
      { label:'Caffeine', cat:'Coffee' },
      { label:'Non-Caffeine', cat:'Non-Coffee' },
      { label:'Tea', cat:'Tea' },
  ]},
  { group:'Food', items:[
      { label:'Pastries', cat:'Pastries' },
      { label:'Sandwiches & Pasta', cat:'Sandwiches' },
      { label:'Cakes', cat:'Cakes' },
  ]},
];

/* ================= MERCHANDISE SIDEBAR DATA ================= */
const MERCH_SIDEBAR = [
  { group:null, items:[
      { label:'Bracelets', cat:'Bracelets' },
      { label:'Keychains', cat:'Keychains' },
  ]},
  { group:'Wearables', items:[
      { label:'Shirts', cat:'Shirts' },
      { label:'Caps', cat:'Caps' },
      { label:'Shorts', cat:'Shorts' },
      { label:'Socks', cat:'Socks' },
      { label:'Tote Bags', cat:'ToteBags' },
  ]},
];

/* SIZED_CATEGORIES moved to shared-catalog.js (loaded before this
   file). Wearable categories that price flat but track stock per
   size — used by the admin Add/Edit form's stock-per-size UI and the
   "Flatten Size Pricing" legacy cleanup tool. Does NOT include
   Coffee/Non-Coffee/Tea, which intentionally DO price per size. */
/* CAT_LABELS moved to shared-catalog.js. */

/* Flattens a sidebar's groups down to the plain list of category keys
   it contains — used to tell, given a product's `cat`, whether it
   belongs to the Menu (food/drinks) or Merchandise side of the
   catalog, so search can point a customer to the other section when
   their term only matches over there. Computed on demand (not cached)
   since admin-added custom categories can append to either sidebar at
   runtime (see applyCustomCategory below). */
function flatCats(sidebar){
  return sidebar.flatMap(g => g.items.map(it => it.cat));
}

function escapeRegExp(str){
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* Product search matching. Plain substring matching (name.includes(q))
   used to match a query anywhere at all — including mid-word, e.g.
   "tee" matching inside "sauteed" or "cap" matching inside "escaped".
   That surfaced completely unrelated products (a pasta dish showing
   up for a "tee" search because its description says "sauteed
   mushrooms"). Matching is now anchored to word boundaries instead —
   a term only counts if it starts a word (so "tee" still matches
   "Tee"/"Teeshirt", "cook" still matches "Cookie", but neither matches
   burred inside another word).

   Multi-word queries are split into separate terms, each checked
   independently against the product's combined name + description,
   and ALL terms must match (in any order, anywhere across the two
   fields) — so "chocolate cake" matches a cake named "Dark Chocolate
   Loaf" whose description mentions "cake" without either word needing
   to appear together or in that order. */
function productMatchesQuery(p, query){
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if(!terms.length) return true;
  const haystack = `${p.name} ${p.desc || ''}`;
  return terms.every(term => new RegExp('\\b' + escapeRegExp(term), 'i').test(haystack));
}

/* ================= CUSTOM CATEGORIES ================= */
/* Categories an admin has added at runtime via the "+ Add Category"
   form (admin.js), on top of the built-in set above. Kept as its own
   list (rather than only folded into CAT_LABELS) so the admin
   dashboard can tell "built-in" and "custom" categories apart if it
   ever needs to (e.g. only custom ones are deletable). */
/* CUSTOM_CATEGORIES moved to shared-catalog.js. */

/* Folds one category doc — see categories-service.js for the shape —
   into every piece of config a category needs to participate in:
   CAT_LABELS (badge + breadcrumb text), FOOD_CATEGORIES /
   DRINK_CATEGORIES / SIZED_CATEGORIES / DEFAULT_SIZES_BY_CATEGORY
   (pricing + stock behavior, all declared in admin.js but shared
   here since script.js and admin.js are plain scripts in the same
   global scope), and the Menu/Merchandise sidebar it should appear
   on. Safe to call more than once with the same category — it just
   no-ops after the first time (CAT_LABELS[c.id] already set). */
/* applyCustomCategory()/removeCustomCategoryEffects(): thin storefront
   wrappers around the shared applyCustomCategoryCore()/
   removeCustomCategoryEffectsCore() (see shared-catalog.js). The only
   thing these versions add on top of Core is keeping MENU_SIDEBAR/
   MERCH_SIDEBAR (customer-nav-only data) in sync — that's why this
   wrapper stays here instead of moving to the shared file. admin.js
   calls the Core versions directly, since the standalone admin app has
   no storefront sidebar to update. */
function applyCustomCategory(c){
  const isNew = !CAT_LABELS[c.id];
  applyCustomCategoryCore(c);
  if(!isNew) return; // already applied (and sidebar already has it too)

  const sidebar = c.page === 'merch' ? MERCH_SIDEBAR : MENU_SIDEBAR;
  let groupEntry = sidebar.find(g => g.group === c.group);
  if(!groupEntry){
    groupEntry = { group: c.group, items: [] };
    sidebar.push(groupEntry);
  }
  if(!groupEntry.items.some(it => it.cat === c.id)){
    groupEntry.items.push({ label: c.label, cat: c.id });
  }
}

function applyCustomCategories(categories){
  categories.forEach(applyCustomCategory);
}

/* Reverses applyCustomCategory — unwinds every place a category id
   was folded into when it was added, including the sidebar entry (the
   part removeCustomCategoryEffectsCore alone doesn't touch). Only ever
   called on entries from CUSTOM_CATEGORIES; built-in categories never
   go through this. */
function removeCustomCategoryEffects(c){
  removeCustomCategoryEffectsCore(c);

  const sidebar = c.page === 'merch' ? MERCH_SIDEBAR : MENU_SIDEBAR;
  const groupEntry = sidebar.find(g => g.group === c.group);
  if(groupEntry){
    groupEntry.items = groupEntry.items.filter(it => it.cat !== c.id);
    if(!groupEntry.items.length){
      const gi = sidebar.indexOf(groupEntry);
      if(gi > -1) sidebar.splice(gi, 1);
    }
  }
}

/* ================= HELPERS ================= */
/* peso() moved to shared-catalog.js. */
const findProduct = id => PRODUCTS.find(p => p.id === id) || COMBO_PRODUCTS.find(p => p.id === id);
const escapeHtml = str => $('<div>').text(str == null ? '' : str).html();

/* Normalizes a product's `sizes` field to `[{size, price, stock}, ...]`
   no matter which shape it's actually in:
   - plain string ('S') — legacy/seed data, flat price, no stock tracked
   - {size, price} — drinks (Coffee/Non-Coffee/Tea): 12oz/16oz/20oz each
     priced independently; stock isn't tracked per size for these
   - {size, stock} — wearables (Shirts/Caps/Shorts/Socks): one flat
     price, stock tracked per size
   `stock: null` means stock isn't tracked for that size at all, which
   the storefront treats as always available (never crossed out). */
/* getSizeOptions() moved to shared-catalog.js. */

/* True when a specific size is out of stock — only ever true when
   that size actually has stock tracked (stock isn't null) and it's
   down to zero or below. A size with no stock tracking at all is
   always treated as available. */
function isSizeOutOfStock(p, sizeLabel){
  const opts = getSizeOptions(p);
  const match = opts.find(o => o.size === sizeLabel);
  return !!match && match.stock !== null && match.stock <= 0;
}

/* Single source of truth for "is this product out of stock", shared by
   every customer-facing surface (grid cards, quick add, product detail
   page) so they always agree with each other AND with the admin
   dashboard's stock badge (admin.js), which is built from these same
   two stock shapes:
   - Per-size tracked (wearables — Shirts/Caps/Shorts/Socks): out of
     stock only once every size that actually tracks stock is at 0 or
     below. Sizes with stock:null (untracked) don't count either way.
   - Flat top-level stock (drinks, food, ToteBags/Bracelets/Keychains):
     out of stock when p.stock is a tracked number <= 0.
   A product with no stock tracked anywhere (p.stock is null/undefined
   and no sizes track stock) is always treated as available — same as
   the admin table's "—" badge. */
function isProductOutOfStock(p){
  const trackedSizes = getSizeOptions(p).filter(o => o.stock !== null);
  if(trackedSizes.length) return trackedSizes.every(o => o.stock <= 0);
  return typeof p.stock === 'number' && p.stock <= 0;
}

function getPriceForSize(p, sizeLabel){
  const opts = getSizeOptions(p);
  if(!opts.length) return p.price;
  const match = opts.find(o => o.size === sizeLabel);
  return match ? match.price : opts[0].price;
}

/* The price to show before a size is picked — the lowest of the
   available sizes, e.g. a latte that runs ₱139–₱179 just shows ₱139. */
/* getDisplayPrice() / hasVariablePricing() moved to shared-catalog.js. */

/* ================= PRODUCT CUSTOMIZATION (OPTION GROUPS) ================= */
/* A product can optionally carry `optionGroups`, an array admin-defined
   groups like "Choose your bean" or "Topping" — see admin.js's option
   group builder for the exact shape written to Firestore:
     { id, label, type:'single'|'multi', max (multi only),
       choices: [{ id, label, price, kcal, available, default }] }
   Only drinks (Coffee/Non-Coffee/Tea) get these today, but nothing
   here assumes that — any product with optionGroups gets the UI. */
function getOptionGroups(p){
  return Array.isArray(p.optionGroups) ? p.optionGroups : [];
}

/* Every group (single or multi) is expected to have real, priced
   choices for its "nothing extra" state too (e.g. "No Topping",
   "Standard", "No Added Sugar") — same pattern the ZUS reference used.
   That means picking sensible defaults is just: for a single-select
   group, whichever available choice is flagged `default` (or the
   first available one); for multi-select, every available choice
   flagged `default`. Nothing needs special-casing for "no selection". */
function defaultPdOptions(p){
  const out = {};
  getOptionGroups(p).forEach(g => {
    const avail = g.choices.filter(c => c.available !== false);
    if(g.type === 'multi'){
      out[g.id] = avail.filter(c => c.default).map(c => c.id);
    } else {
      const def = avail.find(c => c.default) || avail[0];
      out[g.id] = def ? [def.id] : [];
    }
  });
  return out;
}

function optionsPriceDelta(p, options){
  let delta = 0;
  getOptionGroups(p).forEach(g => {
    (options[g.id] || []).forEach(cid => {
      const choice = g.choices.find(c => c.id === cid);
      if(choice) delta += (choice.price || 0);
    });
  });
  return delta;
}

/* Base price (from the selected size, or the display price for
   unsized products) plus whatever the selected options add. This is
   the single source of truth for what the customer is about to pay —
   used by the pd page's live price, the Add to Cart button, and what
   ultimately gets stored on the cart line as `unitPrice`. */
function computePdUnitPrice(p, size, options){
  const base = size ? getPriceForSize(p, size) : getDisplayPrice(p);
  return base + optionsPriceDelta(p, options || {});
}

/* Same idea as optionsPriceDelta, but for calories — the product's own
   base `calories` (admin-set, drinks only), SIZE-SCALED to whatever
   size is currently selected (see scaleForSize), plus whatever the
   selected options add on top (add-ins like an extra shot cost the
   same calories no matter what size cup they go in, so those are
   added AFTER scaling, not scaled themselves). Returns null (not 0)
   when there's genuinely no calorie data at all, so the caller can
   hide the subtitle entirely rather than showing a misleading
   "0 kcal". */
function computePdCalories(p, options, size){
  const hasBase = typeof p.calories === 'number';
  let total = hasBase ? scaleForSize(p, p.calories, size) : 0;
  let hasAny = hasBase;
  getOptionGroups(p).forEach(g => {
    (options[g.id] || []).forEach(cid => {
      const choice = g.choices.find(c => c.id === cid);
      if(choice && typeof choice.kcal === 'number'){
        total += choice.kcal;
        hasAny = true;
      }
    });
  });
  return hasAny ? Math.round(total) : null;
}

/* A drink's nutrition numbers (calories + the macro table) are admin-
   entered for ONE reference size — n.servingSize if set, otherwise
   whatever the smallest size on the product is. A 20oz obviously has
   more sugar in it than a 12oz of the exact same drink, so every
   value scales in proportion to the selected size's volume relative
   to that reference size. Returns 1 (no scaling) for anything that
   isn't a plain "<number>oz" size, or when there's no size to compare
   against at all (unsized drinks, or nothing selected yet) — those
   just show the admin's numbers as-is. */
function pdSizeOz(sizeStr){
  if(!sizeStr) return null;
  const m = String(sizeStr).match(/(\d+(?:\.\d+)?)\s*oz/i);
  return m ? parseFloat(m[1]) : null;
}
function scaleForSize(p, value, size){
  if(typeof value !== 'number') return value;
  const n = p.nutrition || {};
  const refOz = pdSizeOz(n.servingSize) || pdSizeOz((getSizeOptions(p)[0] || {}).size);
  const selOz = pdSizeOz(size);
  if(!refOz || !selOz) return value;
  return value * (selOz / refOz);
}

/* The small "16oz • 120 kcal" line under the product name — drinks
   only, and only the parts that actually have data (a tea with no
   calories set just shows the size, not a blank " • kcal"). */
function pdSubtitleText(p, size, options){
  if(!DRINK_CATEGORIES.includes(p.cat)) return '';
  const parts = [];
  if(size) parts.push(size);
  const kcal = computePdCalories(p, options || {}, size);
  if(kcal !== null) parts.push(`~${kcal} kcal`);
  return parts.join(' • ');
}

/* "Iced, Regular, BOSS, Oat Milk, No Added Sugar, Normal Ice, No Topping"
   — the one-line summary shown on the sticky action bar, on cart lines,
   and saved onto the order. Groups with nothing selected (shouldn't
   normally happen since every group has a default) are just skipped. */
function optionsSummaryText(p, options){
  if(!options) return '';
  const parts = [];
  getOptionGroups(p).forEach(g => {
    const ids = options[g.id] || [];
    const labels = ids.map(cid => {
      const choice = g.choices.find(c => c.id === cid);
      return choice ? choice.label : null;
    }).filter(Boolean);
    if(labels.length) parts.push(labels.join(' + '));
  });
  return parts.join(', ');
}

/* Stable string key for a set of selected options, order-independent —
   used to tell whether two cart lines for the same product/size are
   actually the same customization (should merge quantities) or
   different ones (should stay as separate lines). */
function optionsKey(options){
  if(!options) return '';
  return Object.keys(options).sort()
    .map(k => k + ':' + [...(options[k] || [])].sort().join('+'))
    .join('|');
}

/* Renders every option group for the current product as chip rows —
   single-select groups behave like the existing size chips (one
   active choice), multi-select groups toggle on/off up to `max`. */
function renderPdOptionGroups(p, options){
  const groups = getOptionGroups(p);
  if(!groups.length) return '';
  return `
    <div class="pd-options">
      ${groups.map(g => {
        const selected = options[g.id] || [];
        return `
          <div class="pd-opt-group" data-opt-group="${g.id}">
            <div class="pd-opt-head">
              <h4>${g.label}</h4>
              <span class="pd-opt-tag">${g.type === 'multi' ? `Select up to ${g.max || g.choices.length}` : '* Pick 1'}</span>
            </div>
            <div class="pd-opt-choice-row">
              ${g.choices.map(c => {
                const avail = c.available !== false;
                const isSel = selected.includes(c.id);
                return `
                  <button type="button" class="pd-opt-chip${isSel ? ' active' : ''}${!avail ? ' pd-opt-chip-disabled' : ''}"
                    data-opt-choice data-group="${g.id}" data-choice="${c.id}" ${!avail ? 'disabled' : ''}>
                    <span class="pd-opt-chip-label">${c.label}</span>
                    ${c.price ? `<span class="pd-opt-chip-price">(+${peso(c.price)})</span>` : ''}
                    ${c.kcal ? `<span class="pd-opt-chip-kcal">~ ${c.kcal} kcal</span>` : ''}
                    ${!avail ? '<span class="pd-opt-chip-oos">Unavailable</span>' : ''}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/* Re-reads pdOptions/pdSize/pdQty and repaints everything on the pd
   page that depends on them — the live price, the Add to Cart button
   label, and the running selection summary. Called after every size,
   option, or qty change so those three never fall out of sync with
   each other (the same class of bug fixed earlier in the cart). */
/* Clamps the description to 3 lines by default and only reveals the
   See More/See Less toggle if the text actually overflows that height
   — a short one-line description never shows a pointless toggle. */
function initPdDescToggle(){
  const $desc = $('#pdDesc');
  const $btn = $('#pdDescToggle');
  if(!$desc.length || !$btn.length) return;
  $desc.addClass('pd-desc-clamped');
  $btn.text('See More').hide();
  requestAnimationFrame(() => {
    if($desc[0].scrollHeight > $desc[0].clientHeight + 2) $btn.show();
  });
}

$(document).on('click', '#pdDescToggle', function(){
  const nowClamped = $('#pdDesc').toggleClass('pd-desc-clamped').hasClass('pd-desc-clamped');
  $(this).text(nowClamped ? 'See More' : 'See Less');
});

function refreshPdPricing(p){
  const unit = computePdUnitPrice(p, pdSize, pdOptions);
  const oos = pdSize ? isSizeOutOfStock(p, pdSize) : isProductOutOfStock(p);
  $('#pdPriceDisplayValue').text(peso(unit));
  if(p.comboMeta && pdSize) $('.combo-price-original-pd').text(comboOriginalPriceForSize(p, pdSize));
  $('#pdAddBtn').prop('disabled', oos).text(oos ? 'Out of Stock' : `Add to Cart · ${peso(unit * pdQty)}`);
  $('#pdBuyNowBtn').prop('disabled', oos);
  $('#pdOptSummary').text(optionsSummaryText(p, pdOptions));
  const subtitle = pdSubtitleText(p, pdSize, pdOptions);
  $('#pdSubtitle').text(subtitle).toggle(!!subtitle);
  // Nutrition table scales with size and add-ons too (see
  // renderPdNutrition) — re-render it in place on every size/option
  // change so it never shows stale numbers from the previous
  // selection. Whether the section exists at all is fixed per
  // product (it depends only on whether the admin filled in any
  // calories/nutrition, not on which size/options are picked), so
  // this only ever needs to update content, never add or remove
  // the section itself.
  const $nutrition = $('#pdNutritionSection');
  if($nutrition.length) $nutrition.replaceWith(renderPdNutrition(p, pdSize, pdOptions));
}

/* Drinks show a range across their three sizes (e.g. "₱139–₱179");
   everything else (one flat price, sized or not) shows a single
   number. */
/* priceLabel() moved to shared-catalog.js. */

/* Shared by the Menu and Merchandise grids. "Featured" keeps the
   catalog's natural order but pulls best sellers to the front — it's
   the closest thing this app has to a popularity signal without a real
   sales-analytics pipeline behind it. "Newest" relies on createdAt,
   which only admin-added products have (see products-services.js /
   admin.js) — older seed products fall back to the end of that sort. */
function sortProducts(items, sortValue){
  const list = [...items];
  const toMs = (val) => {
    if(!val) return 0;
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
  };
  switch(sortValue){
    case 'price-asc': return list.sort((a,b) => a.price - b.price);
    case 'price-desc': return list.sort((a,b) => b.price - a.price);
    case 'name-asc': return list.sort((a,b) => a.name.localeCompare(b.name));
    case 'newest': return list.sort((a,b) => toMs(b.createdAt) - toMs(a.createdAt));
    case 'featured':
    default:
      return list.sort((a,b) => {
        const ai = BEST_SELLER_IDS.indexOf(a.id), bi = BEST_SELLER_IDS.indexOf(b.id);
        if(ai === -1 && bi === -1) return 0;
        if(ai === -1) return 1;
        if(bi === -1) return -1;
        return ai - bi;
      });
  }
}

/* ================= WISHLIST ================= */
function isWishlisted(id){
  return wishlist.includes(id);
}

function persistWishlist(){
  if(!wishlistOwnerUid) return;
  window.CCWishlist.saveWishlist(wishlistOwnerUid, wishlist);
}

/* Wishlisting requires a real account (not guest/anonymous) since it's
   saved per-user in Firestore — unlike the cart, there's no local-first
   guest version of this, so signed-out taps just prompt a login. */
function toggleWishlist(id){
  if(!window.currentUser || window.currentUser.isAnonymous){
    showToast('Please log in to save favorites.', 'warning');
    navigate('login');
    return;
  }
  const adding = !wishlist.includes(id);
  if(adding){
    wishlist.push(id);
  } else {
    wishlist = wishlist.filter(x => x !== id);
  }
  persistWishlist();
  $(`[data-wishlist-toggle="${id}"]`).toggleClass('active', wishlist.includes(id))
    .find('svg').attr('fill', wishlist.includes(id) ? 'currentColor' : 'none');
  if($('.page[data-page="wishlist"]').hasClass('active')) renderWishlistPage();
  // Confirms the tap actually did something — the heart icon fills in,
  // but that's easy to miss on a quick tap, especially on mobile.
  const label = findProduct(id) ? findProduct(id).name : 'Item';
  showToast(adding ? `Added to favorites · ${label}` : `Removed from favorites · ${label}`, 'cart');
}

/* Called from authStateReady alongside syncCartToAccount. */
async function syncWishlistToAccount(realUser){
  if(realUser){
    if(wishlistOwnerUid === realUser.uid) return;
    wishlist = await window.CCWishlist.fetchWishlist(realUser.uid);
    wishlistOwnerUid = realUser.uid;
    if($('.page[data-page="wishlist"]').hasClass('active')) renderWishlistPage();
    return;
  }
  if(wishlistOwnerUid === null) return;
  wishlistOwnerUid = null;
  wishlist = [];
}

function renderWishlistPage(){
  const $grid = $('#wishlistGrid');
  const items = [...PRODUCTS, ...COMBO_PRODUCTS].filter(p => wishlist.includes(p.id));
  if(!items.length){
    $('#wishlistCount').text('');
    $('#wishlistClearBtn').hide();
    $grid.html(`
      <div class="empty-favorites">
        <div class="empty-favorites-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 21s-7.5-4.6-10-9.3C.6 8.1 2.4 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.6.5 5.4 4.1 4 7.7C19.5 16.4 12 21 12 21z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </div>
        <h3>No favorites yet</h3>
        <p>Tap the heart on anything you love and it'll be saved here for next time.</p>
        <div class="empty-favorites-actions">
          <button class="btn btn-primary" data-nav="menu">Browse Menu</button>
          <button class="btn btn-outline" data-nav="merchandise">Browse Merchandise</button>
        </div>
      </div>
    `);
    return;
  }
  $('#wishlistCount').text(`${items.length} item${items.length === 1 ? '' : 's'} saved`);
  $('#wishlistClearBtn').show();
  $grid.html(items.map(p => p.comboMeta ? comboCard(p) : productCard(p)).join(''));
  initReveal();
}

/* ================= SAVED ADDRESSES ================= */
/* Same account-scoped caching pattern as wishlist above: myAddresses
   holds the signed-in customer's saved delivery addresses, kept in
   sync with whoever's actually logged in via addressesOwnerUid so a
   log-out/log-in (or switching accounts) never leaks one customer's
   addresses into another's view. */
let myAddresses = [];
let addressesOwnerUid = null;
let editingAddressId = null;      // set while the address form is editing an existing one
let addressFormContext = 'page';  // 'page' (My Addresses) or 'checkout' — where to return focus after saving
let addressFormMap = null;        // Leaflet map instance, created once and reused across opens
let addressFormMarker = null;

// Quezon City — sensible default center since that's where the shop is.
const ADDRESS_MAP_DEFAULT = { lat: 14.6760, lng: 121.0437 };

/* Called from authStateReady alongside syncCartToAccount/syncWishlistToAccount. */
async function syncAddressesToAccount(realUser){
  if(realUser){
    if(addressesOwnerUid === realUser.uid) return;
    myAddresses = await window.CCAddresses.fetchAddresses(realUser.uid);
    addressesOwnerUid = realUser.uid;
    if($('.page[data-page="addresses"]').hasClass('active')) renderAddressesPage();
    if($('.page[data-page="checkout"]').hasClass('active')) renderCheckoutAddressPicker();
    return;
  }
  if(addressesOwnerUid === null) return;
  addressesOwnerUid = null;
  myAddresses = [];
}

async function reloadMyAddresses(){
  if(!window.currentUser || window.currentUser.isAnonymous) return;
  myAddresses = await window.CCAddresses.fetchAddresses(window.currentUser.uid);
  if($('.page[data-page="addresses"]').hasClass('active')) renderAddressesPage();
  if($('.page[data-page="checkout"]').hasClass('active')) renderCheckoutAddressPicker();
}

function renderAddressesPage(){
  const $list = $('#addressesList');
  if(!myAddresses.length){
    $list.html(`
      <div class="empty-favorites">
        <div class="empty-favorites-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 21s-5.5-6-5.5-10.5A5.5 5.5 0 0 1 12 5a5.5 5.5 0 0 1 5.5 5.5C17.5 15 12 21 12 21z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="10.5" r="2" stroke="currentColor" stroke-width="1.5"/></svg>
        </div>
        <h3>No saved addresses yet</h3>
        <p>Add one now so checkout only takes a tap next time.</p>
        <div class="empty-favorites-actions">
          <button class="btn btn-primary" id="emptyAddAddressBtn">Add Your First Address</button>
        </div>
      </div>
    `);
    return;
  }
  $list.html(myAddresses.map(addressCard).join(''));
}

function addressCard(a){
  return `
    <div class="address-card${a.isDefault ? ' is-default' : ''}" data-address-id="${a.id}">
      <div class="address-card-main">
        <div class="address-card-label-row">
          <span class="address-card-label">${a.label || 'Address'}</span>
          ${a.isDefault ? '<span class="address-default-badge">Default</span>' : ''}
        </div>
        <p class="address-card-text">${a.address}</p>
      </div>
      <div class="address-card-actions">
        ${!a.isDefault ? `<button type="button" class="link-btn" data-address-set-default="${a.id}">Set as default</button>` : ''}
        <button type="button" class="link-btn" data-address-edit="${a.id}">Edit</button>
        <button type="button" class="link-btn link-btn-danger" data-address-delete="${a.id}">Delete</button>
      </div>
    </div>
  `;
}

$(document).on('click', '#addAddressBtn, #emptyAddAddressBtn', function(){
  openAddressForm({ editing: null, context: 'page' });
});

$(document).on('click', '[data-address-edit]', function(){
  const a = myAddresses.find(x => x.id === $(this).data('address-edit'));
  if(a) openAddressForm({ editing: a, context: 'page' });
});

$(document).on('click', '[data-address-set-default]', async function(){
  const id = $(this).data('address-set-default');
  try{
    await window.CCAddresses.setDefaultAddress(window.currentUser.uid, id);
    await reloadMyAddresses();
    showToast('Default address updated.', 'success');
  } catch(err){
    console.error(err);
    showToast('Could not update your default address. Please try again.', 'error');
  }
});

$(document).on('click', '[data-address-delete]', async function(){
  const id = $(this).data('address-delete');
  const a = myAddresses.find(x => x.id === id);
  const ok = await showConfirm({
    title: 'Delete this address?',
    message: `"${a ? a.label || a.address : 'This address'}" will be removed from your account.`,
    confirmText: 'Delete',
    danger: true
  });
  if(!ok) return;
  try{
    await window.CCAddresses.deleteAddress(window.currentUser.uid, id);
    await reloadMyAddresses();
    showToast('Address deleted.', 'success');
  } catch(err){
    console.error(err);
    showToast('Could not delete that address. Please try again.', 'error');
  }
});

/* ---------- Address form modal (map + fields, shared by My Addresses & Checkout) ---------- */

function openAddressForm({ editing, context }){
  editingAddressId = editing ? editing.id : null;
  addressFormContext = context;
  $('#addressFormTitle').text(editing ? 'Edit Address' : 'Add Address');
  $('#afLabel').val(editing ? (editing.label || '') : '');
  $('#afAddress').val(editing ? (editing.address || '') : '');
  $('#afIsDefault').prop('checked', editing ? !!editing.isDefault : myAddresses.length === 0);
  $('#addressFormOverlay').addClass('open');

  const startLat = editing && editing.lat ? editing.lat : ADDRESS_MAP_DEFAULT.lat;
  const startLng = editing && editing.lng ? editing.lng : ADDRESS_MAP_DEFAULT.lng;

  // The overlay needs to actually be visible (display != none, full
  // size) before Leaflet can measure its container, or the map tiles
  // render into a collapsed 0x0 box — a short delay covers the CSS
  // transition that fades/scales the modal in.
  setTimeout(() => initOrResetAddressMap(startLat, startLng), 60);
}

function closeAddressForm(){
  $('#addressFormOverlay').removeClass('open');
  editingAddressId = null;
}

function initOrResetAddressMap(lat, lng){
  if(!addressFormMap){
    addressFormMap = L.map('addressMap').setView([lat, lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(addressFormMap);
    addressFormMarker = L.marker([lat, lng], { draggable: true }).addTo(addressFormMap);

    // Dragging the pin is the "map drives the address field" half of
    // the sync — only fires once per drag (not continuously), which
    // keeps this comfortably within Nominatim's fair-use rate limit.
    addressFormMarker.on('dragend', function(){
      const pos = addressFormMarker.getLatLng();
      reverseGeocodeToField(pos.lat, pos.lng);
    });
    // Clicking anywhere else on the map moves the pin there too.
    addressFormMap.on('click', function(e){
      addressFormMarker.setLatLng(e.latlng);
      reverseGeocodeToField(e.latlng.lat, e.latlng.lng);
    });
  } else {
    addressFormMap.setView([lat, lng], 14);
    addressFormMarker.setLatLng([lat, lng]);
  }
  addressFormMap.invalidateSize();
}

/* OpenStreetMap's free Nominatim service, used for both directions of
   the address<->pin sync. No API key. Its usage policy asks for no
   more than ~1 request/second and no automated bulk use — both
   comfortably satisfied here since every call is a single customer's
   own deliberate action (a drag-end, a location-search tap, or the
   "use my current location" button), never a loop or a keystroke
   handler. */
async function reverseGeocodeToField(lat, lng){
  $('#afAddress').attr('placeholder', 'Looking up address...');
  try{
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
    const data = await res.json();
    if(data && data.display_name) $('#afAddress').val(data.display_name);
  } catch(err){
    console.warn('Reverse geocoding failed — leaving the address field as-is.', err);
  } finally {
    $('#afAddress').attr('placeholder', 'Street, Barangay, City');
  }
}

async function forwardGeocodeFromField(){
  const query = $('#afAddress').val().trim();
  if(!query) return;
  const $btn = $('#afSearchBtn');
  $btn.prop('disabled', true).text('Searching...');
  try{
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`);
    const results = await res.json();
    if(!results.length){
      showToast('Could not find that address on the map. You can still drag the pin manually.', 'warning');
      return;
    }
    const { lat, lon } = results[0];
    addressFormMarker.setLatLng([lat, lon]);
    addressFormMap.setView([lat, lon], 15);
  } catch(err){
    console.error(err);
    showToast('Address search failed. Please try again.', 'error');
  } finally {
    $btn.prop('disabled', false).text('Search');
  }
}

$(document).on('click', '#afSearchBtn', forwardGeocodeFromField);
$(document).on('keydown', '#afAddress', function(e){
  if(e.key === 'Enter'){ e.preventDefault(); forwardGeocodeFromField(); }
});

$(document).on('click', '#afUseCurrentLocationBtn', function(){
  if(!navigator.geolocation){
    showToast('Your browser does not support location access.', 'warning');
    return;
  }
  const $btn = $(this);
  $btn.prop('disabled', true).text('Locating...');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      addressFormMarker.setLatLng([latitude, longitude]);
      addressFormMap.setView([latitude, longitude], 16);
      reverseGeocodeToField(latitude, longitude);
      $btn.prop('disabled', false).text('Use my current location');
    },
    () => {
      showToast('Could not access your location. You can still drop the pin manually.', 'warning');
      $btn.prop('disabled', false).text('Use my current location');
    }
  );
});

$(document).on('click', '#addressFormClose, #addressFormCancel', closeAddressForm);
$(document).on('click', '#addressFormOverlay', function(e){
  if(e.target.id === 'addressFormOverlay') closeAddressForm();
});

$(document).on('submit', '#addressForm', async function(e){
  e.preventDefault();
  if(!window.currentUser || window.currentUser.isAnonymous){
    showToast('Please log in to save an address.', 'warning');
    return;
  }
  const address = $('#afAddress').val().trim();
  if(!address){
    showToast('Enter a delivery address first.', 'warning');
    return;
  }
  const pos = addressFormMarker.getLatLng();
  const fields = {
    label: $('#afLabel').val().trim(),
    address,
    lat: pos.lat,
    lng: pos.lng,
    isDefault: $('#afIsDefault').is(':checked')
  };

  const $btn = $('#addressFormSubmit');
  $btn.prop('disabled', true).text('Saving...');
  try{
    const uid = window.currentUser.uid;
    let savedId;
    if(editingAddressId){
      await window.CCAddresses.updateAddress(uid, editingAddressId, fields);
      savedId = editingAddressId;
    } else {
      savedId = await window.CCAddresses.addAddress(uid, fields);
    }
    await reloadMyAddresses();
    closeAddressForm();
    showToast(editingAddressId ? 'Address updated.' : 'Address saved.', 'success');
    // Opened from checkout's "+ Add new address" chip — select the
    // address that was just saved instead of leaving the picker on
    // whatever was chosen before.
    if(addressFormContext === 'checkout') selectCheckoutAddress(savedId);
  } catch(err){
    console.error(err);
    showToast('Could not save that address. Please try again.', 'error');
  } finally {
    $btn.prop('disabled', false).text('Save Address');
  }
});

/* ---------- Checkout's saved-address picker ---------- */

let checkoutSelectedAddressId = null;

function renderCheckoutAddressPicker(){
  const $picker = $('#coSavedAddressPicker');
  const loggedIn = window.currentUser && !window.currentUser.isAnonymous;
  if(!loggedIn){
    $picker.hide().html('');
    return;
  }
  $picker.show().html(`
    ${myAddresses.map(a => `
      <button type="button" class="address-chip${a.id === checkoutSelectedAddressId ? ' active' : ''}" data-checkout-address="${a.id}">
        <span class="address-chip-label">${a.label || 'Address'}</span>
        <span class="address-chip-text">${a.address}</span>
      </button>
    `).join('')}
    <button type="button" class="address-chip address-chip-add" data-checkout-address-new="1">+ Add new address</button>
  `);
  // Nothing picked yet this session — default to the customer's
  // default address so returning customers don't have to tap at all.
  if(!checkoutSelectedAddressId){
    const def = myAddresses.find(a => a.isDefault);
    if(def) selectCheckoutAddress(def.id);
  }
}

function selectCheckoutAddress(id){
  const a = myAddresses.find(x => x.id === id);
  if(!a) return;
  checkoutSelectedAddressId = id;
  $('#coAddress').val(a.address);
  $('#coSavedAddressPicker .address-chip').removeClass('active');
  $(`#coSavedAddressPicker [data-checkout-address="${id}"]`).addClass('active');
}

$(document).on('click', '[data-checkout-address]', function(){
  selectCheckoutAddress($(this).data('checkout-address'));
});

$(document).on('click', '[data-checkout-address-new]', function(){
  openAddressForm({ editing: null, context: 'checkout' });
});

/* ================= COMBOS ================= */
/* Turns each raw combo doc (name, desc, img, drinkId, pastryId,
   discountPercent, active) into a "product" — same {sizes, price,
   stock} shape a real drink already has — so every piece of storefront
   machinery that already knows how to handle a sized product (price
   display, size picker, add to cart, stock checks, cart line items,
   checkout, order history) works on a combo completely unmodified.
   The one addition is `comboMeta`, read in exactly two places: the
   home page combo card (to show the discount + original price) and
   placeOrder (to expand a combo line into its two real stock
   decrements at checkout — see placeOrder below).

   Only combos whose linked drink AND pastry both still exist end up
   in COMBO_PRODUCTS — if either product was deleted from the catalog,
   the combo silently drops off the storefront rather than crashing or
   showing a broken card. Re-run whenever PRODUCTS or COMBOS changes
   (product prices/stock updated, or a combo added/edited/toggled). */
/* buildComboProducts() moved to shared-catalog.js. */

async function loadCombosFromFirestore(){
  try{
    COMBOS = await window.CCCombos.fetchAllCombos();
  } catch(err){
    console.error('Could not load combos from Firestore.', err);
    COMBOS = [];
  }
  buildComboProducts();
}

/* The struck-through "before discount" price shown next to a combo's
   discounted price — mirrors priceLabel()'s single-value-vs-range
   logic, just built from comboMeta.originalSizes instead of p.sizes. */
function comboOriginalPriceLabel(p){
  const sizes = p.comboMeta && p.comboMeta.originalSizes;
  if(!sizes || !sizes.length) return '';
  const min = Math.min(...sizes.map(s => s.price));
  const max = Math.max(...sizes.map(s => s.price));
  return min === max ? peso(min) : `${peso(min)}–${peso(max)}`;
}

/* Same struck-through original price, but for one specific chosen
   size — used once a drink size is actually picked on the combo's
   product detail page, instead of showing the full range. */
function comboOriginalPriceForSize(p, size){
  const sizes = p.comboMeta && p.comboMeta.originalSizes;
  if(!sizes || !sizes.length) return '';
  const match = sizes.find(s => s.size === size);
  return match ? peso(match.price) : comboOriginalPriceLabel(p);
}

function comboCard(p, i=0){
  const saved = isWishlisted(p.id);
  const oos = isProductOutOfStock(p);
  return `
    <div class="product-card combo-card reveal${oos ? ' oos' : ''}" style="--i:${i}">
      <div class="product-img" data-open-product="${p.id}">
        <img src="${resolveImageSrc(p.img)}" alt="${p.name}">
        <span class="combo-discount-badge">${p.comboMeta.discountPercent}% off</span>
        ${oos ? '<span class="oos-badge">Out of Stock</span>' : ''}
        <button type="button" class="wishlist-btn ${saved ? 'active' : ''}" data-wishlist-toggle="${p.id}" aria-label="${saved ? 'Remove from favorites' : 'Save to favorites'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}"><path d="M12 21s-7.5-4.6-10-9.3C.6 8.1 2.4 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.6.5 5.4 4.1 4 7.7C19.5 16.4 12 21 12 21z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="product-info">
        <div class="product-name" data-open-product="${p.id}">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-footer">
          <span class="combo-price-group">
            <span class="combo-price-original">${comboOriginalPriceLabel(p)}</span>
            <span class="price">${priceLabel(p)}</span>
          </span>
          <button class="add-btn" data-quick-add="${p.id}" aria-label="${oos ? 'Out of stock' : 'Add to cart'}" ${oos ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderFeaturedCombos(){
  const $section = $('#featuredCombosSection');
  if(!$section.length) return;
  if(!COMBO_PRODUCTS.length){
    $section.hide();
    return;
  }
  $section.show();
  $('#featuredCombosGrid').html(COMBO_PRODUCTS.map(comboCard).join(''));
  initReveal();
}

$(document).on('click', '#wishlistClearBtn', function(){
  if(!window.confirm('Remove all favorites?')) return;
  wishlist = [];
  persistWishlist();
  renderWishlistPage();
});

$(document).on('click', '[data-wishlist-toggle]', function(e){
  e.stopPropagation();
  toggleWishlist($(this).data('wishlist-toggle'));
});

/* Centered, temporary notification dialog used across the whole site
   (customer pages + admin dashboard both call this same function).
   type controls the icon glyph + accent color:
     'success' (default) — sage check, completed positive actions
     'cart'    — caramel cup, added-to-cart/wishlist confirmations
     'warning' — caramel alert, "please do X" prompts
     'error'   — red alert, something failed
     'info'    — dusty-blue info, neutral status updates

   Calls are QUEUED, not clobbered: if the admin (or a customer) fires
   several actions in quick succession — e.g. deleting a few products,
   or updating two order statuses back to back — each message gets its
   own full, uninterrupted turn on screen instead of the newest one
   silently overwriting/cutting off the previous one mid-animation.
   duration is how long that toast stays up (ms) before the next one
   in the queue takes over; error/warning default longer than routine
   success/info messages since they need more time to actually read. */
const TOAST_ICONS = {
  success: '<path d="M4 12l5 5L20 6"/>',
  cart:    '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v7a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/>',
  warning: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0z"/>',
  error:   '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5l5 5"/><path d="M14.5 9.5l-5 5"/>',
  info:    '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>'
};
const TOAST_DEFAULT_DURATIONS = { success:2400, cart:2400, info:2600, warning:3200, error:3800 };

const _toastQueue = [];
let _toastActive = false;
let _toastHideTimer = null;

function showToast(msg, type='success', duration){
  const iconType = TOAST_ICONS[type] ? type : 'success';
  const ms = duration || TOAST_DEFAULT_DURATIONS[iconType] || 2400;

  // Collapse an exact repeat that's still waiting in line (e.g. a
  // double-click firing the same handler twice) instead of showing
  // the identical message back to back.
  const last = _toastQueue[_toastQueue.length - 1];
  if(last && last.msg === msg && last.type === iconType) return;

  _toastQueue.push({ msg, type: iconType, ms });
  if(!_toastActive) _advanceToastQueue();
}

function _advanceToastQueue(){
  const next = _toastQueue.shift();
  if(!next){ _toastActive = false; return; }
  _toastActive = true;

  const $t = $('#toast');
  const $veil = $('#toastVeil');

  clearTimeout(_toastHideTimer);
  // If a toast is still visibly mid-exit, let it finish its own
  // transition before the next one pops in, so they never visually
  // collide — but never leave the admin waiting more than a beat.
  const wasShowing = $t.hasClass('show');
  $t.removeClass('show hide');

  const present = () => {
    $('#toastMsg').text(next.msg);
    $t.attr('class', 'toast show type-' + next.type);
    $t.attr('aria-live', next.type === 'error' ? 'assertive' : 'polite');
    $('#toastIconSvg').html(TOAST_ICONS[next.type]);
    $veil.addClass('show');

    _toastHideTimer = setTimeout(() => {
      $t.removeClass('show').addClass('hide');
      $veil.removeClass('show');
      // give the exit animation room to finish before the next toast
      setTimeout(_advanceToastQueue, 260);
    }, next.ms);
  };

  if(wasShowing) requestAnimationFrame(() => requestAnimationFrame(present));
  else present();
}

function addToCart(id, qty=1, size=null, options=null, unitPrice=null, silent=false){
  const p = findProduct(id);
  const finalUnitPrice = unitPrice != null ? unitPrice : (size ? getPriceForSize(p, size) : getDisplayPrice(p));
  const key = optionsKey(options);
  const existing = cart.find(c => c.id === id && c.size === size && optionsKey(c.options) === key);
  if(existing){
    existing.qty += qty;
  } else {
    cart.push({
      id, qty, size,
      options: options || null,
      unitPrice: finalUnitPrice,
      optionsSummary: options ? optionsSummaryText(p, options) : null
    });
  }
  updateCartCount();
  if(silent) return;
  const label = p.name + (size ? ` (${size})` : '');
  showToast('Added to cart · ' + label, 'cart');
}

function updateCartCount(){
  persistCart();
  const count = cart.reduce((s,c)=>s+c.qty,0);
  $('#cartCount').text(count).toggle(count > 0);
  renderCartDropdown();
}

/* ================= MINI CART DROPDOWN ================= */
function renderCartDropdown(){
  const $items = $('#cartDropdownItems');
  const $footer = $('#cartDropdownFooter');

  if(cart.length === 0){
    $items.html(`
      <div class="cart-dropdown-empty">
        <div class="cart-dd-empty-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="21" r="1.4" fill="currentColor"/><circle cx="18" cy="21" r="1.4" fill="currentColor"/></svg>
        </div>
        <p>Your cart is empty</p>
        <span>Discover something delicious or handmade.</span>
      </div>`);
    $footer.html(`
      <button class="btn btn-primary" data-nav="menu">Browse Menu</button>
      <button class="btn btn-outline" data-nav="merchandise">Browse Merchandise</button>
    `);
    return;
  }

  $items.html(cart.filter(c => findProduct(c.id)).map(c => {
    const p = findProduct(c.id);
    const lineKey = cartLineKey(c);
    const unit = typeof c.unitPrice === 'number' ? c.unitPrice : getPriceForSize(p, c.size);
    return `
      <div class="cart-dd-item">
        <img src="${resolveImageSrc(p.img)}" alt="${p.name}">
        <div>
          <div class="cart-dd-name">${p.name}${c.size ? ` <span class="cart-dd-size">(${c.size})</span>` : ''}</div>
          ${c.optionsSummary ? `<div class="cart-dd-item-opts">${c.optionsSummary}</div>` : ''}
          <div class="cart-dd-meta">
            <span>${c.qty} × ${peso(unit)}</span>
            <span style="display:flex; align-items:center; gap:8px;">
              ${peso(unit*c.qty)}
              <button class="cart-dd-remove" data-cart-remove="${lineKey}" aria-label="Remove item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              </button>
            </span>
          </div>
        </div>
      </div>
    `;
  }).join(''));

  $footer.html(`
    <div class="cart-dd-subtotal"><span>Subtotal</span><span>${peso(cartTotal())}</span></div>
    <button class="btn btn-primary" data-nav="checkout" id="ddCheckoutBtn">Proceed to Checkout</button>
    <button class="btn btn-outline" data-nav="cart" id="ddViewCartBtn">View Cart</button>
  `);
}

$(document).on('click', '#cartBtn', function(e){
  e.stopPropagation();
  $('#cartDropdownWrap').toggleClass('open');
});

// Clicking a cart-dropdown action (checkout / view cart) should also close the dropdown
$(document).on('click', '#cartDropdown [data-nav]', function(){
  $('#cartDropdownWrap').removeClass('open');
});

// Click anywhere outside the dropdown closes it
$(document).on('click', function(e){
  const $wrap = $('#cartDropdownWrap');
  if($wrap.hasClass('open') && !$(e.target).closest('#cartDropdownWrap').length){
    $wrap.removeClass('open');
  }
});

// Esc key closes it too
$(document).on('keydown', function(e){
  if(e.key === 'Escape'){
    $('#cartDropdownWrap').removeClass('open');
    $('#accountDropdownWrap').removeClass('open');
    closeLegalModal();
  }
});

function cartTotal(){
  return cart.reduce((s,c)=> {
    if(typeof c.unitPrice === 'number') return s + c.unitPrice * c.qty;
    const p = findProduct(c.id);
    return p ? s + getPriceForSize(p, c.size) * c.qty : s;
  }, 0);
}

/* ================= NAVIGATION ================= */
function navigate(pageName){
  const previousPage = $('.page.active').data('page');
  $('.page').removeClass('active');
  $(`.page[data-page="${pageName}"]`).addClass('active');

  $('.nav-links a').each(function(){
    $(this).toggleClass('active', $(this).data('nav') === pageName);
  });

  $('#navLinks').removeClass('open');
  window.scrollTo({top:0, behavior:'instant' in window ? 'instant':'auto'});

  /* The header search box is only meant for Home — Menu and
     Merchandise already have their own inline "Looking for..."
     search right at the top of their grid, so showing the header one
     too just duplicates it. Hidden everywhere except Home. */
  $('.header-search').toggleClass('is-hidden', pageName !== 'home');
  if(pageName === 'home' && previousPage !== 'home') $('#headerSearch').val('');

  /* A leftover search term shouldn't silently follow the customer
     when they switch sections — coming back to Menu later and still
     seeing last week's "birthday cake" search (with the grid filtered
     down to match) looks like a bug, not a feature. Clearing happens
     on arrival at Menu/Merchandise from anywhere else, EXCEPT from
     Product Detail: clicking a result to view it and then tapping
     "Back to Menu" is still the same browsing session, so that one
     path intentionally leaves the search term (and category filter,
     restored the same way the search box's own × button does it) in
     place rather than wiping out what they were doing. Sidebar
     category clicks already clear search themselves (see
     [data-menu-cat]/[data-merch-cat] below) — this only covers
     switching all the way out of the section. */
  if(pageName === 'menu' && previousPage !== 'menu' && previousPage !== 'product' && menuSearch){
    menuSearch = '';
    if(menuFilterBeforeSearch){ menuFilter = menuFilterBeforeSearch; menuFilterBeforeSearch = null; }
    renderMenuPage();
  }
  if(pageName === 'merchandise' && previousPage !== 'merchandise' && previousPage !== 'product' && merchSearch){
    merchSearch = '';
    if(merchFilterBeforeSearch){ merchFilter = merchFilterBeforeSearch; merchFilterBeforeSearch = null; }
    renderMerchPage();
  }

  /* The 'admin' page/route no longer exists on the customer site —
     the admin dashboard is now a standalone app at /admin (see
     admin/index.html) with its own login, so there's nothing left
     here to gate. */
  if(pageName === 'checkout' && !window.currentUser){
    showToast('Please log in to check out.', 'warning');
    $('.page').removeClass('active');
    $('.page[data-page="login"]').addClass('active');
    return;
  }
  if(pageName === 'order-history' && (!window.currentUser || window.currentUser.isAnonymous)){
    showToast('Please log in to view your orders.', 'warning');
    $('.page').removeClass('active');
    $('.page[data-page="login"]').addClass('active');
    return;
  }
  if(pageName === 'wishlist' && (!window.currentUser || window.currentUser.isAnonymous)){
    showToast('Please log in to view your favorites.', 'warning');
    $('.page').removeClass('active');
    $('.page[data-page="login"]').addClass('active');
    return;
  }
  if(pageName === 'addresses' && (!window.currentUser || window.currentUser.isAnonymous)){
    showToast('Please log in to manage your addresses.', 'warning');
    $('.page').removeClass('active');
    $('.page[data-page="login"]').addClass('active');
    return;
  }
  if(pageName === 'product') renderProductDetail();
  if(pageName === 'cart') renderCart();
  if(pageName === 'checkout') renderCheckoutSummary();
  if(pageName === 'checkout') renderCheckoutAddressPicker();
  if(pageName === 'order-history') renderOrderHistory();
  if(pageName === 'wishlist') renderWishlistPage();
  if(pageName === 'addresses') renderAddressesPage();
  if(pageName === 'about'){
    navigate('home');
    setTimeout(()=> $('.about-split')[0]?.scrollIntoView({behavior:'smooth'}), 50);
  }

  /* Cart and Checkout are the two places a stale price actually costs
     someone money, so refetch the live catalog every time either page
     is opened — this tab may have been sitting open since before an
     admin changed a price, and there's no realtime listener to tell it
     otherwise. renderCart()/renderCheckoutSummary() already painted
     above with whatever PRODUCTS we had, so this just quietly corrects
     it once the fresh fetch resolves (usually well under a second). */
  if(pageName === 'cart' || pageName === 'checkout'){
    refreshProductsThenRerender(pageName);
  }

  initReveal();
}

async function refreshProductsThenRerender(pageName){
  await loadProductsFromFirestore();
  buildComboProducts();
  if(!$(`.page[data-page="${pageName}"]`).hasClass('active')) return; // user already navigated away
  if(pageName === 'cart') renderCart();
  if(pageName === 'checkout') renderCheckoutSummary();
}

async function renderOrderHistory(){
  const $list = $('#orderHistoryList');
  $list.html('<p class="order-history-empty">Loading your orders...</p>');
  if(!window.currentUser) return;

  let orders;
  try{
    orders = await window.CCOrders.fetchMyOrders(window.currentUser.uid);
  } catch(err){
    console.error(err);
    $list.html('<p class="order-history-empty">Could not load your orders. Please try again.</p>');
    return;
  }

  if(!orders.length){
    $list.html('<p class="order-history-empty">No orders yet — once you place one, it\'ll show up here.</p>');
    return;
  }

  const toDate = (val) => {
    if(!val) return '';
    const ms = typeof val.seconds === 'number' ? val.seconds * 1000 : new Date(val).getTime();
    return isNaN(ms) ? '' : new Date(ms).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' });
  };

  const rows = orders.map(o => {
    const status = o.status || 'pending';
    const itemsText = (o.items || []).map(it => `${it.name}${it.size ? ` (${it.size})` : ''} × ${it.qty}`).join(', ');
    return `
      <div class="order-card">
        <div class="order-card-head">
          <span class="order-card-num">#${o.id.slice(0,6).toUpperCase()}</span>
          <span class="order-status-badge order-status-${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
        </div>
        <p class="order-card-items">${itemsText}</p>
        ${orderStatusTracker(status)}
        <div class="order-card-foot">
          <span>${toDate(o.createdAt)} · ${o.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}</span>
          <span class="order-card-total">${peso(o.totals?.total || 0)}</span>
        </div>
      </div>
    `;
  }).join('');
  $list.html(rows);
}

/* Visual step tracker for order history — mirrors the status values the
   admin dashboard's dropdown writes (pending/preparing/ready/completed/
   cancelled, see orders-service.js + admin.js). Cancelled breaks out of
   the linear flow entirely rather than showing a "stuck" progress bar. */
const ORDER_STAGES = [
  { key:'pending', label:'Pending' },
  { key:'preparing', label:'Preparing' },
  { key:'ready', label:'Ready' },
  { key:'completed', label:'Completed' }
];

function orderStatusTracker(status){
  if(status === 'cancelled'){
    return `<div class="order-tracker-cancelled">This order was cancelled.</div>`;
  }
  const idx = Math.max(0, ORDER_STAGES.findIndex(s => s.key === status));
  return `
    <div class="order-tracker">
      ${ORDER_STAGES.map((s,i) => `
        <div class="order-tracker-step ${i <= idx ? 'done' : ''} ${i === idx ? 'current' : ''}">
          <span class="order-tracker-dot"></span>
          <span class="order-tracker-label">${s.label}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// Delegated nav click — covers elements rendered now or later
$(document).on('click', '[data-nav]', function(e){
  e.preventDefault();
  navigate($(this).data('nav'));
});

$('#hamburgerBtn').on('click', ()=> $('#navLinks').toggleClass('open'));

/* ================= HEADER SEARCH ================= */
/* Only reachable from Home (see navigate() above). Runs against the
   full catalog — PRODUCTS holds both food/drink and merchandise
   items together, only the `cat` field tells them apart — by landing
   on the Menu page with its category filter cleared to "All", which
   shows every matching product regardless of section. */
function runHeaderSearch(){
  const q = $('#headerSearch').val();
  // navigate() first, while the OLD menuSearch is still in place, so
  // its own "left the section" reset (see navigate() above) clears
  // any stale term before this new query overwrites it below —
  // otherwise this fresh search would be wiped out immediately.
  navigate('menu');
  menuSearch = q;
  menuFilter = 'All';
  menuFilterBeforeSearch = null;
  renderMenuPage();
}
$('#headerSearchBtn').on('click', runHeaderSearch);
$('#headerSearch').on('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); runHeaderSearch(); } });
$('#headerSearchClear').on('click', function(){
  $('#headerSearch').val('');
  runHeaderSearch();
  $('#headerSearch').focus();
});

/* ================= RENDER: HOME ================= */
function renderCategories(){
  const isMerch = c => ['Wearables','Bracelets','Keychains'].includes(c.key);
  const html = CATEGORIES.map((c,i) => `
    <div class="cat-card reveal" style="--i:${i}" ${isMerch(c) ? `data-nav="merchandise"` : `data-menu-filter="${c.key}"`}>
      <div class="cat-img"><img src="${resolveImageSrc(c.img)}" alt="${c.title}"></div>
      <div class="cat-body">
        <span class="emoji">${c.emoji}</span>
        <h3>${c.title}</h3>
        <p>${c.desc}</p>
        <span class="cat-link">Explore ${c.title} <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </div>
    </div>
  `).join('');
  $('#categoryGrid').html(html);
  initReveal();
}

$(document).on('click', '[data-menu-filter]', function(){
  menuFilter = $(this).data('menu-filter');
  menuSearch = '';
  menuFilterBeforeSearch = null;
  navigate('menu');
  renderMenuPage();
});

function productCard(p, i=0){
  const saved = isWishlisted(p.id);
  const oos = isProductOutOfStock(p);
  return `
    <div class="product-card reveal${oos ? ' oos' : ''}" style="--i:${i}">
      <div class="product-img" data-open-product="${p.id}">
        <img src="${resolveImageSrc(p.img)}" alt="${p.name}">
        ${oos ? '<span class="oos-badge">Out of Stock</span>' : ''}
        <button type="button" class="wishlist-btn ${saved ? 'active' : ''}" data-wishlist-toggle="${p.id}" aria-label="${saved ? 'Remove from favorites' : 'Save to favorites'}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${saved ? 'currentColor' : 'none'}"><path d="M12 21s-7.5-4.6-10-9.3C.6 8.1 2.4 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.6.5 5.4 4.1 4 7.7C19.5 16.4 12 21 12 21z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="product-info">
        <div class="product-name" data-open-product="${p.id}">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-footer">
          <span class="price">${priceLabel(p)}</span>
          <button class="add-btn" data-quick-add="${p.id}" aria-label="${oos ? 'Out of stock' : 'Add to cart'}" ${oos ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

/* Eight curated best sellers — mixes drinks + bakes for visual variety in the carousel */
const BEST_SELLER_IDS = ['p13','p14','p15','p16','p17','p23','p28','p53'];

/* On-brand fallback artwork for any product image that fails to load
   (used by p13–p17, which point at local files that aren't hosted here). */
function placeholderImg(p){
  return blankPlaceholder(p.id, p.cat);
}

function bestSellerCard(p, i){
  const oos = isProductOutOfStock(p);
  return `
    <div class="product-card best-card${oos ? ' oos' : ''}" style="--i:${i}">
      <div class="product-img" data-open-product="${p.id}">
        <span class="bestseller-tag">${String(i+1).padStart(2,'0')}</span>
        <img src="${resolveImageSrc(p.img)}" alt="${p.name}">
        ${oos ? '<span class="oos-badge">Out of Stock</span>' : ''}
        <div class="best-card-shade"></div>
      </div>
      <div class="product-info">
        <span class="eyebrow best-eyebrow">${p.cat}</span>
        <div class="product-name" data-open-product="${p.id}">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-footer">
          <span class="price">${priceLabel(p)}</span>
          <button class="add-btn" data-quick-add="${p.id}" aria-label="${oos ? 'Out of stock' : 'Add to cart'}" ${oos ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderBestSellers(){
  const best = BEST_SELLER_IDS.map(findProduct).filter(Boolean);
  initBestSellerCarousel(best);
}

/* ================= POPULAR THIS WEEK — auto-scrolling marquee ================= */
function debounce(fn, wait){
  let t;
  return function(...args){ clearTimeout(t); t = setTimeout(()=> fn.apply(this, args), wait); };
}

function initBestSellerCarousel(items){
  const wrapEl = document.querySelector('#bestSellerCarousel .carousel-track-wrap');
  const trackEl = document.getElementById('bestSellerGrid');
  const prevBtn = document.getElementById('bsPrev');
  const nextBtn = document.getElementById('bsNext');
  if(!wrapEl || !trackEl || !items.length) return;

  // Two back-to-back copies of the set create a seamless infinite loop
  // for the arrows/swipe to scroll through (no auto-play — purely
  // manual browsing now).
  trackEl.innerHTML = items.map(bestSellerCard).join('') + items.map(bestSellerCard).join('');

  // On-brand fallback for any image that fails to load
  $(trackEl).find('.product-img img').each(function(i){
    const p = items[i % items.length];
    $(this).one('error', function(){ this.src = placeholderImg(p); });
  });

  // NOTE: this is a plain, native-scrolling container (overflow-x:auto in
  // CSS). We only ever read/nudge wrapEl.scrollLeft here — we never call
  // setPointerCapture, preventDefault, or stopPropagation on anything, so
  // clicks on a card image/name/add-btn behave exactly like they do in the
  // menu and merch grids (same [data-open-product]/[data-quick-add]
  // delegated handlers, completely untouched by carousel code).

  let setWidth = 0;
  function measure(){
    const cards = trackEl.querySelectorAll('.product-card');
    if(cards.length < items.length) return;
    const cs = getComputedStyle(trackEl);
    const gap = parseFloat(cs.columnGap || cs.gap) || 22;
    let w = 0;
    for(let i=0; i<items.length; i++){ w += cards[i].getBoundingClientRect().width + gap; }
    setWidth = w;
    // Start a little way into the first set so the illusion of endless
    // items works when nudging backwards from the very start too.
    if(wrapEl.scrollLeft < 1) wrapEl.scrollLeft = 1;
  }
  measure();
  window.addEventListener('resize', debounce(measure, 200));

  const SPEED = 26; // px/sec, moving left — an unhurried, boutique-window drift
  // Respect the OS-level "reduce motion" setting: the passive drift is
  // pure decoration, so people who've asked for less motion get a
  // perfectly still carousel they can still browse with the arrows,
  // wheel, or a swipe — nothing here is required to use the site.
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paused = reduceMotion;
  let interacting = false;
  let resumeTimer = null;
  let lastTime = null;
  let correcting = false; // guards against our own loop-reset scroll events
  let ramp = 1; // eases the drift back in after a pause instead of snapping to full speed

  function pauseTemporarily(ms){
    paused = true;
    clearTimeout(resumeTimer);
    if(reduceMotion) return; // stays paused — no auto-resume when motion is reduced
    resumeTimer = setTimeout(()=>{ paused = false; ramp = 0; }, ms);
  }

  // Seamless infinite loop: once we scroll past one full set, silently
  // snap back by exactly that width (imperceptible since the two halves
  // are identical copies).
  wrapEl.addEventListener('scroll', function(){
    if(correcting || setWidth <= 0) return;
    if(wrapEl.scrollLeft >= setWidth){
      correcting = true;
      wrapEl.scrollLeft -= setWidth;
      correcting = false;
    } else if(wrapEl.scrollLeft <= 0){
      correcting = true;
      wrapEl.scrollLeft += setWidth;
      correcting = false;
    }
  });

  // Drift the scroll position steadily to the right, which visually
  // carries the cards to the left — same direction reading flows.
  function frame(t){
    if(lastTime === null) lastTime = t;
    const dt = (t - lastTime) / 1000;
    lastTime = t;
    if(!paused && !interacting && setWidth > 0){
      if(ramp < 1) ramp = Math.min(1, ramp + dt * 0.5);
      correcting = true;
      wrapEl.scrollLeft += SPEED * dt * ramp;
      correcting = false;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function step(){
    const card = trackEl.querySelector('.product-card');
    const cs = getComputedStyle(trackEl);
    const gap = parseFloat(cs.columnGap || cs.gap) || 22;
    return (card ? card.getBoundingClientRect().width : 250) + gap;
  }

  prevBtn && prevBtn.addEventListener('click', function(){
    wrapEl.scrollBy({ left: -step(), behavior:'smooth' });
    pauseTemporarily(3400);
  });
  nextBtn && nextBtn.addEventListener('click', function(){
    wrapEl.scrollBy({ left: step(), behavior:'smooth' });
    pauseTemporarily(3400);
  });

  // Pause the drift while the user's mouse/finger is anywhere near the
  // carousel (this is also when the arrows fade in via CSS) — resumes
  // automatically a moment after they leave.
  wrapEl.addEventListener('mouseenter', ()=>{ clearTimeout(resumeTimer); paused = true; });
  wrapEl.addEventListener('mouseleave', ()=>{ if(!reduceMotion){ paused = false; ramp = 0; } });
  wrapEl.addEventListener('touchstart', ()=>{ interacting = true; clearTimeout(resumeTimer); }, { passive:true });
  wrapEl.addEventListener('touchend', ()=>{ interacting = false; pauseTemporarily(1500); }, { passive:true });

  // Let a vertical mouse wheel also scroll the carousel horizontally —
  // a nice touch for desktop users without a trackpad.
  wrapEl.addEventListener('wheel', function(e){
    if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){
      wrapEl.scrollLeft += e.deltaY;
      e.preventDefault();
      pauseTemporarily(1800);
    }
  }, { passive:false });

  // Pause while the tab is hidden so items don't "jump" forward when
  // the user comes back.
  document.addEventListener('visibilitychange', ()=>{ lastTime = null; });
}

// Delegated product-card interactions (open detail / quick add)
$(document).on('click', '[data-open-product]', function(){
  currentProductId = $(this).data('open-product');
  navigate('product');
});

$(document).on('click', '[data-quick-add]', function(e){
  e.stopPropagation();
  const id = $(this).data('quick-add');
  const p = findProduct(id);
  if(isProductOutOfStock(p)){
    showToast('This item is out of stock.', 'warning');
    return;
  }
  const opts = getSizeOptions(p);
  if(opts.length > 1){
    currentProductId = id;
    navigate('product');
    showToast('Please select a size', 'warning');
    return;
  }
  addToCart(id, 1, opts.length === 1 ? opts[0].size : null);
  const $img = $(this).closest('.product-card').find('.product-img img').first();
  if($img.length) flyToCart($img[0]);
  $(this).addClass('added');
  setTimeout(()=> $(this).removeClass('added'), 500);
});

/* ================= RENDER: MENU ================= */
function renderMenuSidebar(){
  const html = MENU_SIDEBAR.map(g => `
    <div class="sidebar-group">
      <div class="sidebar-group-title">${g.group}</div>
      <div class="sidebar-group-items">
        ${g.items.map(it => `<a class="sidebar-link ${menuFilter===it.cat?'active':''}" data-menu-cat="${it.cat}">${it.label}</a>`).join('')}
      </div>
    </div>
  `).join('');
  $('#menuSidebarGroups').html(html);
}

$(document).on('click', '[data-menu-cat]', function(){
  menuFilter = $(this).data('menu-cat');
  menuSearch = '';
  menuFilterBeforeSearch = null;
  renderMenuPage();
});

/* Shows/hides the "Also found N in Merchandise" banner under the
   Menu search box. Counts matches against the FULL catalog (not
   filtered to the Menu's own categories) so a search for e.g. "tote"
   while on Menu still tells the customer merchandise has hits, even
   though nothing here does. */
function renderMenuCrossHint(){
  const q = menuSearch.trim();
  const $hint = $('#menuCrossHint');
  if(!q){ $hint.removeClass('is-visible').empty(); return; }
  const merchCats = flatCats(MERCH_SIDEBAR);
  const count = PRODUCTS.filter(p => merchCats.includes(p.cat) && productMatchesQuery(p, q)).length;
  if(!count){ $hint.removeClass('is-visible').empty(); return; }
  $hint.html(`Also found <strong>${count}</strong> matching item${count > 1 ? 's' : ''} in <strong>Merchandise</strong> — <button type="button" class="search-cross-link" data-cross-nav="merchandise">View them</button>`).addClass('is-visible');
}

function renderMenuGrid(){
  let items = PRODUCTS.filter(p => menuFilter === 'All' || p.cat === menuFilter);
  if(menuSearch.trim()){
    items = items.filter(p => productMatchesQuery(p, menuSearch));
  }
  items = sortProducts(items, menuSort);
  renderMenuCrossHint();
  const $grid = $('#menuGrid');
  if(items.length === 0){
    $grid.html(`<div class="empty-state" style="grid-column:1/-1;">No items here yet. Try another category or search term.</div>`);
    return;
  }
  $grid.html(items.map(productCard).join(''));
  initReveal();
}

function renderMenuHeading(){
  if(menuFilter === 'All'){
    $('#menuBreadcrumb').text('Search');
    $('#menuHeading').text(menuSearch ? `Results for "${menuSearch}"` : 'All Items');
  } else {
    const label = CAT_LABELS[menuFilter] || { group:menuFilter, sub:'' };
    $('#menuBreadcrumb').text(label.sub ? `${label.group} / ${label.sub}` : label.group);
    $('#menuHeading').text(label.sub || label.group);
  }
}

function renderMenuPage(){
  renderMenuSidebar();
  renderMenuHeading();
  renderMenuGrid();
  $('#menuSearch').val(menuSearch);
  $('#menuSort').val(menuSort);
}

/* Typing a search term used to only filter WITHIN whatever category
   the sidebar already had selected (e.g. stuck on "Caffeine"),
   making it look like search only worked for that one category. A
   query now always clears the category filter to "All" so it runs
   against everything on this page, and the category it came from is
   remembered so clearing the box restores it instead of leaving the
   customer on "All Items". */
$(document).on('input', '#menuSearch', function(){
  menuSearch = $(this).val();
  if(menuSearch.trim()){
    if(menuFilter !== 'All'){
      menuFilterBeforeSearch = menuFilter;
      menuFilter = 'All';
      renderMenuSidebar();
    }
  } else if(menuFilterBeforeSearch){
    menuFilter = menuFilterBeforeSearch;
    menuFilterBeforeSearch = null;
    renderMenuSidebar();
  }
  renderMenuHeading();
  renderMenuGrid();
});

$(document).on('click', '#menuSearchClear', function(){
  $('#menuSearch').val('').trigger('input').focus();
});

/* "View them" link in the cross-catalog hint — carries the current
   search term over to the other section (Menu <-> Merchandise) and
   runs it there, so a term that only half-matched on this page
   doesn't dead-end the customer. */
$(document).on('click', '[data-cross-nav]', function(){
  const target = $(this).data('cross-nav');
  const term = target === 'menu' ? merchSearch : menuSearch;
  // navigate() first (see runHeaderSearch above for why) so its
  // section-switch reset clears the old term before this carried-over
  // one is applied.
  if(target === 'menu'){
    navigate('menu');
    menuSearch = term;
    menuFilter = 'All';
    menuFilterBeforeSearch = null;
    renderMenuPage();
  } else {
    navigate('merchandise');
    merchSearch = term;
    merchFilter = 'All';
    merchFilterBeforeSearch = null;
    renderMerchPage();
  }
});

$(document).on('change', '#menuSort', function(){
  menuSort = $(this).val();
  renderMenuGrid();
});

/* ================= RENDER: MERCHANDISE ================= */
function renderMerchSidebar(){
  const html = MERCH_SIDEBAR.map(g => `
    <div class="sidebar-group${g.group ? '' : ' sidebar-group-untitled'}">
      ${g.group ? `<div class="sidebar-group-title">${g.group}</div>` : ''}
      <div class="sidebar-group-items">
        ${g.items.map(it => `<a class="sidebar-link ${merchFilter===it.cat?'active':''}" data-merch-cat="${it.cat}">${it.label}</a>`).join('')}
      </div>
    </div>
  `).join('');
  $('#merchSidebarGroups').html(html);
}

$(document).on('click', '[data-merch-cat]', function(){
  merchFilter = $(this).data('merch-cat');
  merchSearch = '';
  merchFilterBeforeSearch = null;
  renderMerchPage();
});

/* Mirror of renderMenuCrossHint() for the Merchandise search box —
   points a customer to the Menu when their term only matches food or
   drink items. */
function renderMerchCrossHint(){
  const q = merchSearch.trim();
  const $hint = $('#merchCrossHint');
  if(!q){ $hint.removeClass('is-visible').empty(); return; }
  const menuCats = flatCats(MENU_SIDEBAR);
  const count = PRODUCTS.filter(p => menuCats.includes(p.cat) && productMatchesQuery(p, q)).length;
  if(!count){ $hint.removeClass('is-visible').empty(); return; }
  $hint.html(`Also found <strong>${count}</strong> matching item${count > 1 ? 's' : ''} in the <strong>Menu</strong> — <button type="button" class="search-cross-link" data-cross-nav="menu">View them</button>`).addClass('is-visible');
}

function renderMerchGrid(){
  let items = PRODUCTS.filter(p => merchFilter === 'All' || p.cat === merchFilter);
  if(merchSearch.trim()){
    items = items.filter(p => productMatchesQuery(p, merchSearch));
  }
  items = sortProducts(items, merchSort);
  renderMerchCrossHint();
  const $grid = $('#merchGrid');
  if(items.length === 0){
    $grid.html(`<div class="empty-state" style="grid-column:1/-1;">No items here yet. Try another category or search term.</div>`);
    return;
  }
  $grid.html(items.map(productCard).join(''));
  initReveal();
}

function renderMerchHeading(){
  if(merchFilter === 'All'){
    $('#merchBreadcrumb').text('Search');
    $('#merchHeading').text(merchSearch ? `Results for "${merchSearch}"` : 'All Merchandise');
  } else {
    const label = CAT_LABELS[merchFilter] || { group:merchFilter, sub:'' };
    $('#merchBreadcrumb').text(label.sub ? `${label.group} / ${label.sub}` : label.group);
    $('#merchHeading').text(label.sub || label.group);
  }
}

function renderMerchPage(){
  renderMerchSidebar();
  renderMerchHeading();
  renderMerchGrid();
  $('#merchSearch').val(merchSearch);
  $('#merchSort').val(merchSort);
}

/* Same fix as the Menu search box above: a query clears the sidebar
   category filter to "All" instead of only ever matching within
   whatever category was last clicked, and remembers that category so
   clearing the box restores it. This was the main "search only works
   inside the current category" bug on the Merchandise page. */
$(document).on('input', '#merchSearch', function(){
  merchSearch = $(this).val();
  if(merchSearch.trim()){
    if(merchFilter !== 'All'){
      merchFilterBeforeSearch = merchFilter;
      merchFilter = 'All';
      renderMerchSidebar();
    }
  } else if(merchFilterBeforeSearch){
    merchFilter = merchFilterBeforeSearch;
    merchFilterBeforeSearch = null;
    renderMerchSidebar();
  }
  renderMerchHeading();
  renderMerchGrid();
});

$(document).on('click', '#merchSearchClear', function(){
  $('#merchSearch').val('').trigger('input').focus();
});

$(document).on('change', '#merchSort', function(){
  merchSort = $(this).val();
  renderMerchGrid();
});

/* ================= RENDER: PRODUCT DETAIL ================= */
/* Renders the size selector (any product with a `sizes` array — both
   wearables with a SIZE_CHARTS fit guide and drinks with plain
   12oz/16oz/20oz pricing), the ingredients/allergens block (any
   product with `ingredients` — food AND drinks), or both together for
   a sized drink. Other merch (totes, bracelets, keychains) gets
   neither. */
function renderPdSecondary(p, size, options){
  const chart = SIZE_CHARTS[p.cat];
  let sizingHtml = '';
  if(p.sizes && p.sizes.length){
    const opts = getSizeOptions(p);
    const singleSize = opts.length === 1;
    const variable = hasVariablePricing(p);
    sizingHtml = `
      <div class="pd-sizing">
        <div class="pd-sizing-head">
          <h4>${singleSize ? 'Size' : 'Select Size'}</h4>
          ${p.fit ? `<span class="pd-fit-tag">${p.fit}</span>` : ''}
        </div>
        ${singleSize ? `
          <div class="size-chip active${opts[0].stock !== null && opts[0].stock <= 0 ? ' size-chip-oos' : ''}" data-pd-size="${opts[0].size}">
            <span class="size-chip-label">${opts[0].size}</span>
            ${opts[0].stock !== null && opts[0].stock <= 0 ? '<span class="size-chip-oos-label">Out of stock</span>' : ''}
          </div>
        ` : `
          <div class="size-chip-row" id="pdSizeRow">
            ${opts.map(o => {
              const oos = o.stock !== null && o.stock <= 0;
              return `<button type="button" class="size-chip${oos ? ' size-chip-oos' : ''}" data-pd-size="${o.size}" ${oos ? 'disabled' : ''}>
                <span class="size-chip-label">${o.size}</span>${variable ? `<span class="size-chip-price">${peso(o.price)}</span>` : ''}
                ${oos ? '<span class="size-chip-oos-label">Out of stock</span>' : ''}
              </button>`;
            }).join('')}
          </div>
        `}
        ${chart ? `
          <button type="button" class="size-guide-toggle" id="pdSizeGuideToggle">Size Guide</button>
          <div class="size-guide-table" id="pdSizeGuideTable" style="display:none;">
            <table>
              <thead><tr><th>Size</th>${chart.columns.map(c=>`<th>${c}${chart.unit? ` (${chart.unit})`:''}</th>`).join('')}</tr></thead>
              <tbody>
                ${Object.entries(chart.rows).map(([size, vals]) => `
                  <tr><td>${size}</td>${vals.map(v=>`<td>${v}</td>`).join('')}</tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      </div>
    `;
  }
  const optionsHtml = renderPdOptionGroups(p, options || {});
  let infoHtml = '';
  if(p.ingredients){
    infoHtml = `
      <div class="pd-info-grid">
        <div class="pd-ingredients">
          <h4>Ingredients</h4>
          <p>${p.ingredients}</p>
        </div>
        <div class="pd-ingredients pd-allergens">
          <h4>Allergens</h4>
          <p>${p.allergens || 'Please ask our staff for full allergen details.'}</p>
        </div>
      </div>
    `;
  }
  const aboutHtml = renderPdAbout(p);
  const nutritionHtml = renderPdNutrition(p, size, options);
  return sizingHtml + optionsHtml + infoHtml + aboutHtml + nutritionHtml;
}

/* "About the Drink" — a short fun-fact/backstory blurb, admin-set per
   product (Drink Details in the Add/Edit form). Drinks only, and only
   when the admin actually wrote something. */
function renderPdAbout(p){
  if(!DRINK_CATEGORIES.includes(p.cat) || !p.aboutText) return '';
  return `
    <div class="pd-about">
      <h4>About the Drink</h4>
      <p>${p.aboutText}</p>
    </div>
  `;
}

/* Nutrition table — serving size + calories (from the base product,
   same number used in the header subtitle) plus whatever macro fields
   the admin filled in. Rows with no value are skipped rather than
   shown as blank/"—", and the whole section is skipped if there's
   nothing to show at all. LIVE: every number here scales with the
   currently selected size (see scaleForSize) and the calories line
   also includes any selected add-on's own kcal — refreshPdPricing
   re-renders this same block on every size/option change so it never
   falls out of sync with the price and subtitle above it. */
function renderPdNutrition(p, size, options){
  if(!DRINK_CATEGORIES.includes(p.cat)) return '';
  const n = p.nutrition || {};
  const calories = computePdCalories(p, options || {}, size);
  const round1 = (v) => Math.round(v * 10) / 10;
  const rows = [
    ['Serving Size', size || n.servingSize],
    ['Calories', calories !== null ? `${calories} kcal` : null],
    ['Carbohydrates', n.carbs ? `${round1(scaleForSize(p, n.carbs, size))} g` : null],
    ['Sugar', n.sugar ? `${round1(scaleForSize(p, n.sugar, size))} g` : null],
    ['Protein', n.protein ? `${round1(scaleForSize(p, n.protein, size))} g` : null],
    ['Fat', n.fat ? `${round1(scaleForSize(p, n.fat, size))} g` : null],
    ['Sodium', n.sodium ? `${Math.round(scaleForSize(p, n.sodium, size))} mg` : null],
  ].filter(([, val]) => val !== null && val !== undefined && val !== '');
  if(!rows.length) return '';
  return `
    <div class="pd-nutrition" id="pdNutritionSection">
      <h4>Nutrition</h4>
      <table class="pd-nutrition-table">
        <tbody>
          ${rows.map(([label, val]) => `<tr><td>${label}</td><td>${val}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderProductDetail(){
  const p = findProduct(currentProductId);
  pdQty = 1;
  const pdOpts = getSizeOptions(p);
  pdSize = pdOpts.length === 1 ? pdOpts[0].size : null;
  pdOptions = defaultPdOptions(p);
  $('#pdCrumb').text(p.name);
  const isMerch = ['Shirts','Caps','Shorts','Socks','ToteBags','Bracelets','Keychains'].includes(p.cat);
  const isCombo = p.cat === 'Combo';
  $('#pdSectionLink').text(isCombo ? 'Home' : isMerch ? 'Merchandise' : 'Menu')
    .attr('data-nav', isCombo ? 'home' : isMerch ? 'merchandise' : 'menu')
    .data('nav', isCombo ? 'home' : isMerch ? 'merchandise' : 'menu');
  const startPrice = computePdUnitPrice(p, pdSize, pdOptions);
  // Sized products: judge the currently-selected size. Unsized products,
  // and sized products where every size is out of stock (so nothing was
  // pre-selected), fall back to isProductOutOfStock — same check the
  // grid cards and admin dashboard use, so this page never disagrees.
  const startOos = pdSize ? isSizeOutOfStock(p, pdSize) : isProductOutOfStock(p);
  const hasOptions = getOptionGroups(p).length > 0;
  $('#pdContent').html(`
    <div>
      <div class="pd-main-img"><img id="pdMainImg" src="${resolveImageSrc(p.imgs[0])}" alt="${p.name}"></div>
      <div class="pd-thumbs">
        ${p.imgs.map((im,i)=>`<img src="${resolveImageSrc(im)}" class="${i===0?'active':''}" data-thumb="${resolveImageSrc(im)}" alt="${p.name} view ${i+1}">`).join('')}
      </div>
    </div>
    <div>
      <div class="eyebrow">${isCombo ? `Combo · ${p.comboMeta.discountPercent}% off` : p.cat}</div>
      <h1 style="margin:10px 0 4px;">${p.name}</h1>
      <p class="pd-subtitle" id="pdSubtitle">${pdSubtitleText(p, pdSize, pdOptions)}</p>
      <div class="pd-price" id="pdPriceDisplay">
        ${isCombo ? `<span class="combo-price-original combo-price-original-pd">${comboOriginalPriceLabel(p)}</span>` : ''}
        <span id="pdPriceDisplayValue">${peso(startPrice)}</span>
      </div>
      <p class="pd-desc pd-desc-clamped" id="pdDesc">${p.desc}${p.ingredients ? ' Made in small batches at our counter, using seasonal ingredients whenever we can.' : ''}</p>
      <button type="button" class="pd-desc-toggle" id="pdDescToggle" style="display:none;">See More</button>
      ${renderPdSecondary(p, pdSize, pdOptions)}
      <div class="pd-actions-wrap" id="pdActionsWrap">
        ${hasOptions ? `<div class="pd-opt-summary" id="pdOptSummary">${optionsSummaryText(p, pdOptions)}</div>` : ''}
        <div class="pd-actions">
          <div class="qty-select" id="pdQtySelect">
            <button data-qty-action="minus">−</button>
            <span id="pdQtyVal">1</span>
            <button data-qty-action="plus">+</button>
          </div>
          <div class="pd-actions-btns">
            <button class="btn btn-outline" id="pdBuyNowBtn" data-pd-buy-now="${p.id}" ${startOos ? 'disabled' : ''}>Buy Now</button>
            <button class="btn btn-primary" id="pdAddBtn" data-pd-add="${p.id}" ${startOos ? 'disabled' : ''}>${startOos ? 'Out of Stock' : `Add to Cart · ${peso(startPrice)}`}</button>
          </div>
          <button type="button" class="wishlist-btn pd-wishlist-btn ${isWishlisted(p.id) ? 'active' : ''}" data-wishlist-toggle="${p.id}" aria-label="Save to favorites">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isWishlisted(p.id) ? 'currentColor' : 'none'}"><path d="M12 21s-7.5-4.6-10-9.3C.6 8.1 2.4 4.5 6 4c2-.3 3.7.7 6 3 2.3-2.3 4-3.3 6-3 3.6.5 5.4 4.1 4 7.7C19.5 16.4 12 21 12 21z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  `);
  initPdDescToggle();

  // A combo's "you may also like" is the two real products it's made
  // of — showing random catalog items here instead would be confusing
  // (PRODUCTS never contains combo docs, so the normal same-category
  // lookup below would just return unrelated items).
  let related, fill;
  if(isCombo){
    related = [p.comboMeta.drinkId, p.comboMeta.pastryId].map(findProduct).filter(Boolean);
    fill = [];
  } else {
    related = PRODUCTS.filter(x => x.cat === p.cat && x.id !== p.id).slice(0,4);
    fill = related.length < 4 ? PRODUCTS.filter(x=>x.id!==p.id && !related.includes(x)).slice(0, 4-related.length) : [];
  }
  $('#relatedHeading').text(isCombo ? "What's in this combo" : 'You might also like');
  $('#relatedGrid').html([...related, ...fill].map(productCard).join(''));
  initReveal();
  loadAndRenderReviews(p.id);
}

/* ================= RATINGS & REVIEWS ================= */
function starString(rating){
  const r = Math.round(rating);
  return '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r);
}

/* State for the currently-open product's reviews, kept in memory so
   switching the sort order re-sorts instantly instead of re-fetching
   from Firestore every time. Reset whenever a new product's reviews load. */
let reviewsState = { productId: null, reviews: [], purchased: false, sort: 'recent' };

/* Deterministic avatar color from the reviewer's name, picked from
   the site's own palette so avatars never look out of place. */
const AVATAR_PALETTE = ['var(--sage)', 'var(--cta)', 'var(--dusk)', 'var(--cta-dark)'];
function avatarColor(name){
  let hash = 0;
  for(let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
function avatarInitials(name){
  const parts = (name || 'Customer').trim().split(/\s+/);
  const initials = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
  return initials.toUpperCase();
}

function formatReviewDate(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function sortReviews(reviews, mode){
  const list = [...reviews];
  if(mode === 'highest') list.sort((a,b) => b.rating - a.rating || new Date(b.createdAt) - new Date(a.createdAt));
  else if(mode === 'lowest') list.sort((a,b) => a.rating - b.rating || new Date(b.createdAt) - new Date(a.createdAt));
  else list.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  return list;
}

/* "Purchased" = at least one of the account's own orders (any status
   except cancelled — a cancelled order was never actually fulfilled)
   contains this product id. Run alongside the reviews fetch so both
   are ready before the section paints — no extra loading flicker. */
async function hasPurchasedProduct(uid, productId){
  try{
    const orders = await window.CCOrders.fetchMyOrders(uid);
    return orders.some(o => o.status !== 'cancelled' && (o.items || []).some(it => it.id === productId));
  } catch(err){
    console.error(err);
    return false; // can't confirm the purchase — default to not allowing the form
  }
}

async function loadAndRenderReviews(productId){
  const $wrap = $('#productReviews');
  $wrap.html('<p class="reviews-loading">Loading reviews...</p>');
  const realUser = window.currentUser && !window.currentUser.isAnonymous ? window.currentUser : null;
  let reviews, purchased = false;
  try{
    const results = await Promise.all([
      window.CCReviews.fetchReviewsForProduct(productId),
      realUser ? hasPurchasedProduct(realUser.uid, productId) : Promise.resolve(false)
    ]);
    reviews = results[0];
    purchased = results[1];
  } catch(err){
    console.error(err);
    $wrap.html('<p class="reviews-loading">Could not load reviews right now.</p>');
    return;
  }
  // Bail if the person has already navigated to a different product by
  // the time this resolves — don't paint stale reviews over a new page.
  if(currentProductId !== productId) return;
  reviewsState = { productId, reviews, purchased, sort: 'recent' };
  renderReviewsSection();
}

function renderReviewsSection(){
  const { productId, reviews, purchased, sort } = reviewsState;
  const total = reviews.length;
  const avg = total ? reviews.reduce((s,r) => s + r.rating, 0) / total : 0;

  // 5→1 breakdown, used for the distribution bars next to the score.
  const counts = [0,0,0,0,0]; // index 0 = 5-star ... index 4 = 1-star
  reviews.forEach(r => { const i = 5 - Math.round(r.rating); if(counts[i] !== undefined) counts[i]++; });
  const barsHtml = counts.map((c, i) => {
    const star = 5 - i;
    const pct = total ? Math.round((c / total) * 100) : 0;
    return `
      <div class="rating-bar-row">
        <span class="rating-bar-label">${star}<span class="rating-bar-star">★</span></span>
        <div class="rating-bar-track"><div class="rating-bar-fill" style="width:${pct}%"></div></div>
        <span class="rating-bar-pct">${pct}%</span>
      </div>
    `;
  }).join('');

  const summaryHtml = `
    <div class="reviews-summary-card">
      <div class="review-summary-score">${avg ? avg.toFixed(1) : '—'}</div>
      <div class="stars stars-lg">${starString(avg)}</div>
      <div class="review-summary-count">${total} review${total === 1 ? '' : 's'}</div>
      ${total ? `<div class="rating-bars">${barsHtml}</div>` : ''}
    </div>
  `;

  const realUser = window.currentUser && !window.currentUser.isAnonymous ? window.currentUser : null;
  const myReview = realUser ? reviews.find(r => r.uid === realUser.uid) : null;

  const sorted = sortReviews(reviews, sort);
  const listHtml = sorted.length
    ? sorted.map(r => {
        const name = r.userName || 'Customer';
        const mine = realUser && r.uid === realUser.uid;
        return `
      <div class="review-card real-review${mine ? ' review-card-mine' : ''}">
        <div class="review-top">
          <div class="review-avatar" style="background:${avatarColor(name)}">${avatarInitials(name)}</div>
          <div class="review-meta">
            <div class="review-name-row">
              <span class="review-name">${escapeHtml(name)}</span>
              ${r.verified ? `<span class="verified-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>Verified Purchase</span>` : ''}
            </div>
            <div class="review-stars-row">
              <span class="stars">${starString(r.rating)}</span>
              <span class="review-date">${formatReviewDate(r.createdAt)}</span>
            </div>
          </div>
          ${mine ? `<button class="review-delete-btn" data-review-delete="${productId}" title="Delete your review">Delete</button>` : ''}
        </div>
        ${r.text ? `<p class="review-text">${escapeHtml(r.text)}</p>` : ''}
      </div>
    `;
      }).join('')
    : `<div class="reviews-empty">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M12 17.3l-5.8 3 1.1-6.5-4.7-4.6 6.5-1 2.9-5.9 2.9 5.9 6.5 1-4.7 4.6 1.1 6.5z" stroke="var(--line-strong)" stroke-width="1.4" stroke-linejoin="round"/></svg>
        <p>No reviews yet — be the first to share what you thought.</p>
      </div>`;

  // Gate the form on having actually bought the item — but an existing
  // reviewer can still edit/delete their own review even if that order
  // later got cancelled, rather than getting locked out of it.
  const canReview = realUser && (purchased || myReview);

  const formHtml = !realUser
    ? `<p class="reviews-login-hint"><a data-nav="login">Log in</a> to leave a review.</p>`
    : canReview ? `
    <div class="review-form">
      <h4>${myReview ? 'Edit your review' : 'Write a review'}</h4>
      <div class="review-star-input" id="reviewStarInput" data-value="${myReview ? myReview.rating : 0}">
        ${[1,2,3,4,5].map(n => `<span data-star="${n}" class="${myReview && n <= myReview.rating ? 'active' : ''}">★</span>`).join('')}
      </div>
      <textarea id="reviewTextInput" placeholder="Optional — what did you think?" maxlength="600">${myReview ? escapeHtml(myReview.text || '') : ''}</textarea>
      <div class="review-form-footer">
        <span class="review-form-hint">${purchased ? 'You purchased this item' : 'Verified from a past order'}</span>
        <button class="btn btn-primary" id="submitReviewBtn" data-product-id="${productId}">${myReview ? 'Update Review' : 'Submit Review'}</button>
      </div>
    </div>
  ` : `<p class="reviews-login-hint">Only customers who've purchased this item can leave a review.</p>`;

  const sortHtml = total > 1 ? `
    <label class="sort-select-wrap reviews-sort-wrap">
      <span class="sort-select-label">Sort</span>
      <select id="reviewSort" class="sort-select">
        <option value="recent" ${sort === 'recent' ? 'selected' : ''}>Most Recent</option>
        <option value="highest" ${sort === 'highest' ? 'selected' : ''}>Highest Rated</option>
        <option value="lowest" ${sort === 'lowest' ? 'selected' : ''}>Lowest Rated</option>
      </select>
    </label>
  ` : '';

  const mainHtml = `
    <div class="reviews-main">
      <div class="reviews-main-head">
        <h4 class="reviews-main-title">${total ? `Customer Reviews (${total})` : 'Customer Reviews'}</h4>
        ${sortHtml}
      </div>
      <div class="review-list">${listHtml}</div>
      ${formHtml}
    </div>
  `;

  $('#productReviews').html(`<div class="reviews-panel">${summaryHtml}${mainHtml}</div>`);
}

$(document).on('change', '#reviewSort', function(){
  reviewsState.sort = $(this).val();
  renderReviewsSection();
});

$(document).on('click', '#reviewStarInput span', function(){
  const val = Number($(this).data('star'));
  $('#reviewStarInput').attr('data-value', val)
    .find('span').each(function(){ $(this).toggleClass('active', Number($(this).data('star')) <= val); });
});

$(document).on('click', '#submitReviewBtn', async function(){
  const productId = $(this).data('product-id');
  const rating = Number($('#reviewStarInput').attr('data-value')) || 0;
  const text = $('#reviewTextInput').val().trim();
  if(!rating){
    showToast('Please select a star rating.', 'warning');
    return;
  }
  const $btn = $(this);
  const originalText = $btn.text();
  $btn.prop('disabled', true).text('Saving...');
  try{
    const myExisting = reviewsState.reviews.find(r => r.uid === window.currentUser.uid);
    const verified = reviewsState.purchased || (myExisting ? myExisting.verified : false);
    await window.CCReviews.submitReview(productId, window.currentUser.uid, window.currentUser.displayName || 'Customer', rating, text, verified);
    showToast('Thanks for the review!', 'success');
    loadAndRenderReviews(productId);
  } catch(err){
    console.error(err);
    showToast('Could not save your review. Please try again.', 'error');
    $btn.prop('disabled', false).text(originalText);
  }
});

$(document).on('click', '[data-review-delete]', async function(){
  const productId = $(this).data('review-delete');
  const ok = await showConfirm({
    title: 'Delete your review?',
    message: "This will remove your rating and comment from this product. This can't be undone.",
    confirmText: 'Delete',
    danger: true
  });
  if(!ok) return;
  try{
    await window.CCReviews.deleteReview(productId, window.currentUser.uid);
    showToast('Your review was deleted.', 'success');
    loadAndRenderReviews(productId);
  } catch(err){
    console.error(err);
    showToast('Could not delete your review. Please try again.', 'error');
  }
});

$(document).on('click', '[data-pd-size]:not([disabled])', function(){
  pdSize = $(this).data('pd-size');
  $('#pdSizeRow .size-chip').removeClass('active');
  $(this).addClass('active');
  const p = findProduct(currentProductId);
  refreshPdPricing(p);
});

$(document).on('click', '#pdSizeGuideToggle', function(){
  $('#pdSizeGuideTable').slideToggle(160);
});

$(document).on('click', '[data-thumb]', function(){
  $('#pdMainImg').attr('src', $(this).data('thumb'));
  $('[data-thumb]').removeClass('active');
  $(this).addClass('active');
});

$(document).on('click', '[data-qty-action]', function(){
  const p = findProduct(currentProductId);
  if($(this).data('qty-action') === 'plus') pdQty++;
  else pdQty = Math.max(1, pdQty - 1);
  $('#pdQtyVal').text(pdQty);
  refreshPdPricing(p);
});

/* Single-select groups swap the one active choice; multi-select groups
   toggle on/off, capped at the group's `max` (default: unlimited). */
$(document).on('click', '[data-opt-choice]:not([disabled])', function(){
  const p = findProduct(currentProductId);
  const groupId = $(this).data('group');
  const choiceId = $(this).data('choice');
  const group = getOptionGroups(p).find(g => g.id === groupId);
  if(!group) return;

  if(group.type === 'multi'){
    const sel = pdOptions[groupId] ? pdOptions[groupId].slice() : [];
    const idx = sel.indexOf(choiceId);
    if(idx > -1){
      sel.splice(idx, 1);
    } else {
      const max = group.max || Infinity;
      if(sel.length >= max){
        showToast(`You can only select up to ${max} for ${group.label}.`, 'warning');
        return;
      }
      sel.push(choiceId);
    }
    pdOptions[groupId] = sel;
  } else {
    pdOptions[groupId] = [choiceId];
  }

  $(`.pd-opt-group[data-opt-group="${groupId}"] .pd-opt-chip`).removeClass('active');
  (pdOptions[groupId] || []).forEach(cid => {
    $(`.pd-opt-group[data-opt-group="${groupId}"] [data-choice="${cid}"]`).addClass('active');
  });
  refreshPdPricing(p);
});

/* Shared by Add to Cart and Buy Now — every out-of-stock/size-required
   check lives here once so the two buttons can never disagree about
   whether this selection is actually purchasable. Returns null (after
   showing the relevant toast) when it isn't, or {unit, opts} when it is. */
function validatePdSelection(p){
  if(!pdSize && isProductOutOfStock(p)){
    showToast('This item is out of stock.', 'warning');
    return null;
  }
  if(p.sizes && p.sizes.length > 1 && !pdSize){
    showToast('Please select a size first', 'warning');
    return null;
  }
  if(pdSize && isSizeOutOfStock(p, pdSize)){
    showToast('That size is out of stock.', 'warning');
    return null;
  }
  const unit = computePdUnitPrice(p, pdSize, pdOptions);
  const opts = getOptionGroups(p).length ? pdOptions : null;
  return { unit, opts };
}

$(document).on('click', '[data-pd-add]', function(){
  const p = findProduct($(this).data('pd-add'));
  const selection = validatePdSelection(p);
  if(!selection) return;
  addToCart(p.id, pdQty, pdSize, selection.opts, selection.unit);
  const mainImg = document.getElementById('pdMainImg');
  if(mainImg) flyToCart(mainImg);
});

/* Adds the current selection to the cart (silently — no "Added to
   cart" toast, since the very next thing is jumping to Checkout) and
   heads straight there, same as tapping Add to Cart then Checkout. */
$(document).on('click', '[data-pd-buy-now]', function(){
  const p = findProduct($(this).data('pd-buy-now'));
  const selection = validatePdSelection(p);
  if(!selection) return;
  addToCart(p.id, pdQty, pdSize, selection.opts, selection.unit, true);
  navigate('checkout');
});

/* ================= RENDER: CART ================= */
function renderCart(){
  const $wrap = $('#cartContainer');
  if(cart.length === 0){
    $wrap.html(`
      <div class="empty-cart">
        <div class="empty-cart-icon">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="21" r="1.4" fill="currentColor"/><circle cx="18" cy="21" r="1.4" fill="currentColor"/></svg>
        </div>
        <h3>Your cart feels a little light</h3>
        <p>Add a coffee, a pastry, or a handcrafted keepsake to get started.</p>
        <div class="empty-cart-actions">
          <button class="btn btn-primary" data-nav="menu">Browse Menu</button>
          <button class="btn btn-outline" data-nav="merchandise">Browse Merchandise</button>
        </div>
      </div>`);
    return;
  }

  const itemsHtml = cart.filter(c => findProduct(c.id)).map(c => {
    const p = findProduct(c.id);
    const lineKey = cartLineKey(c);
    const unit = typeof c.unitPrice === 'number' ? c.unitPrice : getPriceForSize(p, c.size);
    return `
      <div class="cart-item">
        <img src="${resolveImageSrc(p.img)}" alt="${p.name}">
        <div>
          <div class="cart-item-name">${p.name}</div>
          <div class="cart-item-meta">${p.cat}${c.size ? ` · Size: ${c.size}` : ''} · ${peso(unit)} each</div>
          ${c.optionsSummary ? `<div class="cart-item-opts">${c.optionsSummary}</div>` : ''}
        </div>
        <div class="qty-select" data-cart-qty="${lineKey}">
          <button data-cart-action="minus">−</button>
          <span>${c.qty}</span>
          <button data-cart-action="plus">+</button>
        </div>
        <div style="display:flex; align-items:center; gap:14px;">
          <span class="price cart-item-price">${peso(unit*c.qty)}</span>
          <button class="remove-btn" data-cart-remove="${lineKey}" aria-label="Remove item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  const totalQty = cart.reduce((s,c)=>s+c.qty,0);
  const subtotal = cartTotal();
  const delivery = subtotal > 0 ? DELIVERY_FEE : 0;
  const total = subtotal + delivery;

  $wrap.html(`
    <div class="cart-layout">
      <div>
        <div class="cart-page-toolbar">
          <span class="cart-item-count">${totalQty} item${totalQty !== 1 ? 's' : ''} in your cart</span>
          <button class="cart-clear-btn" id="cartClearBtn">Clear cart</button>
        </div>
        ${itemsHtml}
      </div>
      <div class="order-summary">
        <h3>Order Summary</h3>
        <div class="sum-row"><span>Subtotal</span><span>${peso(subtotal)}</span></div>
        <div class="sum-row"><span>Delivery fee</span><span>${peso(delivery)}</span></div>
        <div class="sum-row total"><span>Total</span><span>${peso(total)}</span></div>
        <button class="btn btn-primary btn-full" style="margin-top:18px;" data-nav="checkout">Proceed to Checkout</button>
        <div class="order-summary-trust">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 10V8a6 6 0 0 1 12 0v2M5 10h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
          <span>Secure checkout · Pay on delivery/pickup, by card, or via GCash, GoTyme Bank, or Maribank.</span>
        </div>
      </div>
    </div>
  `);
}

function cartLineKey(c){
  return `${c.id}::${c.size || ''}::${encodeURIComponent(optionsKey(c.options))}`;
}

function parseLineKey(key){
  const [id, size, optsEnc] = String(key).split('::');
  return { id, size: size || null, optsKey: optsEnc ? decodeURIComponent(optsEnc) : '' };
}

$(document).on('click', '[data-cart-action]', function(){
  const { id, size, optsKey } = parseLineKey($(this).closest('[data-cart-qty]').data('cart-qty'));
  const item = cart.find(c => c.id === id && c.size === size && optionsKey(c.options) === optsKey);
  if(!item) return;
  if($(this).data('cart-action') === 'plus') item.qty++;
  else item.qty = Math.max(1, item.qty - 1);
  persistCart();
  updateCartCount();
  renderCart();
});

$(document).on('click', '[data-cart-remove]', function(){
  const { id, size, optsKey } = parseLineKey($(this).data('cart-remove'));
  cart = cart.filter(c => !(c.id === id && c.size === size && optionsKey(c.options) === optsKey));
  persistCart();
  updateCartCount();
  renderCart();
});

$(document).on('click', '#cartClearBtn', function(){
  if(!cart.length) return;
  if(!window.confirm('Remove all items from your cart?')) return;
  cart = [];
  persistCart();
  updateCartCount();
  renderCart();
});

/* ================= CHECKOUT ================= */
$(document).on('click', '[data-fulfillment]', function(){
  $('[data-fulfillment]').removeClass('active');
  $(this).addClass('active');
  fulfillment = $(this).data('fulfillment');
  $('#addressGroup').css('display', fulfillment === 'delivery' ? 'block' : 'none');
  renderCheckoutSummary();
});

/* Placeholder QR images per e-wallet/bank — swap these three files
   (qr-gcash.png, qr-gotyme.png, qr-maribank.png) for the real bank
   QR codes whenever they're ready; nothing else needs to change. */
const PAYMENT_QR = {
  gcash: { src: 'qr-gcash.png', label: 'GCash' },
  gotyme: { src: 'qr-gotyme.png', label: 'GoTyme Bank' },
  maribank: { src: 'qr-maribank.png', label: 'Maribank' }
};

// clean label text for a pay-opt, ignoring the "Tap to show QR" hint
function payOptLabel($opt){
  const $clone = $opt.clone();
  $clone.find('.pay-qr-hint').remove();
  return $clone.text().trim().replace(/\s+/g, ' ');
}

$(document).on('click', '.pay-opt', function(){
  $('.pay-opt').removeClass('active');
  $(this).addClass('active');
  $(this).find('input').prop('checked', true);

  const qrKey = $(this).data('qr');
  const info = qrKey && PAYMENT_QR[qrKey];
  if(info){
    $('#qrDisplayImg').attr('src', info.src).attr('alt', `${info.label} QR code`);
    $('#qrDisplayLabel').text(`Scan this QR using your ${info.label} app to pay.`);
    $('#qrDisplay').addClass('active');
  } else {
    $('#qrDisplay').removeClass('active');
  }
});

/* Tapping the small checkout QR opens it centered and enlarged —
   big enough for a phone camera to scan comfortably, capped so it
   never takes over the whole screen. */
function openQrModal(){
  $('#qrModalImg').attr('src', $('#qrDisplayImg').attr('src')).attr('alt', $('#qrDisplayImg').attr('alt'));
  $('#qrModalLabel').text($('#qrDisplayLabel').text());
  $('#qrOverlay').addClass('open');
}
function closeQrModal(){
  $('#qrOverlay').removeClass('open');
}
$(document).on('click', '#qrDisplayImg', openQrModal);
$(document).on('click', '#qrModalClose', closeQrModal);
$(document).on('click', '#qrOverlay', function(e){
  if(e.target.id === 'qrOverlay') closeQrModal();
});
$(document).on('keydown', function(e){
  if(e.key === 'Escape' && $('#qrOverlay').hasClass('open')) closeQrModal();
});

function renderCheckoutSummary(){
  const subtotal = cartTotal();
  const delivery = fulfillment === 'delivery' && subtotal > 0 ? DELIVERY_FEE : 0;
  const total = subtotal + delivery;
  const lines = cart.filter(c => findProduct(c.id)).map(c=>{
    const p = findProduct(c.id);
    const unit = typeof c.unitPrice === 'number' ? c.unitPrice : getPriceForSize(p, c.size);
    const label = p.name + (c.size ? ` (${c.size})` : '') + ` × ${c.qty}`;
    return `<div class="sum-row"><span>${label}${c.optionsSummary ? `<br><small class="sum-row-opts">${c.optionsSummary}</small>` : ''}</span><span>${peso(unit*c.qty)}</span></div>`;
  }).join('') || '<div class="sum-row"><span>Your cart is empty</span><span></span></div>';

  $('#checkoutSummary').html(`
    <h3>Order Summary</h3>
    ${lines}
    <div class="sum-row"><span>${fulfillment==='delivery' ? 'Delivery fee' : 'Pickup fee'}</span><span>${peso(delivery)}</span></div>
    <div class="sum-row total"><span>Total</span><span>${peso(total)}</span></div>
    <button class="btn btn-primary btn-full" style="margin-top:18px;" id="placeOrderBtn" ${cart.length===0?'disabled':''}>Place Order</button>
  `);
}

$(document).on('click', '#placeOrderBtn', placeOrder);

async function placeOrder(){
  if(cart.length === 0) return;

  const $form = $('.checkout-layout .form-card').first();
  const selectedAddress = myAddresses.find(a => a.id === checkoutSelectedAddressId);
  const customer = {
    name: $form.find('input[type="text"]').val().trim(),
    phone: $form.find('input[type="tel"]').val().trim(),
    email: $form.find('input[type="email"]').val().trim(),
    address: fulfillment === 'delivery' ? $('#addressGroup input').val().trim() : ''
  };
  // Only attach lat/lng when the address on the form still matches the
  // saved address it came from — if the customer hand-edited the text
  // after picking a saved address, the old pin no longer describes
  // where they typed, so it's better to send no coordinates than a
  // wrong one.
  if(fulfillment === 'delivery' && selectedAddress && selectedAddress.address === customer.address){
    customer.lat = selectedAddress.lat;
    customer.lng = selectedAddress.lng;
  }
  if(!customer.name || !customer.phone){
    showToast('Please fill in your name and phone number.', 'warning');
    return;
  }

  const subtotal = cartTotal();
  const deliveryFee = fulfillment === 'delivery' ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;
  const items = cart.map(c => {
    const p = findProduct(c.id);
    const unit = typeof c.unitPrice === 'number' ? c.unitPrice : getPriceForSize(p, c.size);
    return {
      id: p.id, name: p.name, price: unit, qty: c.qty, size: c.size || null,
      options: c.options || null, optionsSummary: c.optionsSummary || null
    };
  });
  const paymentMethod = payOptLabel($('.pay-opt.active'));

  const $btn = $('#placeOrderBtn');
  $btn.prop('disabled', true).text('Placing order...');

  try{
    await window.CCAuth.ensureSignedIn();
    const orderPayload = {
      items, totals: { subtotal, deliveryFee, total },
      fulfillment, customer, paymentMethod
    };
    const orderId = await window.CCOrders.createOrder(orderPayload);
    $('#confOrderNum').text('#CC-' + orderId.slice(0,6).toUpperCase());
    $('#confFulfillment').text(fulfillment === 'delivery' ? 'Delivery' : 'Store Pickup');
    $('#confTotal').text(peso(total));
    cart = [];
    persistCart();
    updateCartCount();
    checkoutSelectedAddressId = null;
    navigate('confirmation');
    // Best-effort — the order is already placed at this point, so an
    // email hiccup shouldn't show as a checkout failure to the customer.
    if(customer.email){
      sendOrderConfirmationEmail(orderPayload, orderId);
    }
    // Only decrement products that actually track stock (merch items
    // without a stock field are skipped by decrementStock's caller here).
    // Sized products (Shirts/Caps/Shorts/Socks) carry the size along so
    // the per-size stock count gets decremented instead of the flat total.
    // A combo line isn't a real product doc in Firestore — it expands
    // into its two real component decrements instead (see comboMeta,
    // set in buildComboProducts): the drink (with its chosen size) and
    // the pastry (unsized), each decremented exactly like a normal
    // order for that product would be.
    const stockUpdates = [];
    items.forEach(it => {
      const p = findProduct(it.id);
      if(!p) return;
      if(p.comboMeta){
        stockUpdates.push({ id: p.comboMeta.drinkId, qty: it.qty, size: it.size || null });
        stockUpdates.push({ id: p.comboMeta.pastryId, qty: it.qty, size: null });
      } else if(typeof p.stock === 'number'){
        stockUpdates.push({ id: it.id, qty: it.qty, size: it.size || null });
      }
    });
    if(stockUpdates.length){
      window.CCProducts.decrementStock(stockUpdates).catch(err => console.error('Stock decrement failed:', err));
    }
  } catch(err){
    console.error(err);
    if(String(err.code).includes('admin-restricted-operation') || String(err.code).includes('operation-not-allowed')){
      showToast('Guest checkout isn\'t enabled yet — turn on "Anonymous" sign-in in the Firebase Console.', 'error');
    } else {
      showToast('Could not place order. Please try again.', 'error');
    }
    $btn.prop('disabled', false).text('Place Order');
  }
}

/* ================= PASSWORD SHOW/HIDE TOGGLE ================= */
/* Swaps type="password" <-> type="text" and keeps focus + cursor
   position intact across the swap — losing those is what usually
   makes a show/hide toggle feel glitchy (cursor jumping to the start,
   or the field losing focus entirely after the type changes). */
$(document).on('click', '[data-password-toggle]', function(){
  const $btn = $(this);
  const input = document.getElementById($btn.data('password-toggle'));
  if(!input) return;

  const wasPassword = input.type === 'password';
  const selStart = input.selectionStart;
  const selEnd = input.selectionEnd;

  input.type = wasPassword ? 'text' : 'password';
  input.focus();
  try { input.setSelectionRange(selStart, selEnd); } catch(err) { /* ignore if unsupported */ }

  $btn.find('.eye-open').toggle(!wasPassword);
  $btn.find('.eye-closed').toggle(wasPassword);
  $btn.attr('aria-pressed', String(wasPassword)).attr('aria-label', wasPassword ? 'Hide password' : 'Show password');
});

/* ================= AUTH FORMS (real Firebase Auth) ================= */
$('#loginForm').on('submit', async function(e){
  e.preventDefault();
  const $btn = $(this).find('button[type="submit"]');
  const email = $(this).find('input[type="email"]').val().trim();
  const password = $('#loginPassword').val();
  $btn.prop('disabled', true).text('Logging in...');
  try{
    const user = await window.CCAuth.loginUser(email, password);
    showToast('Welcome back! Logged in successfully.', 'success');
    const verified = await window.CCAuth.isOtpVerified();
    if(!verified){
      goToVerifyEmail(user.email);
    } else {
      navigate('home');
    }
  } catch(err){
    showToast(friendlyAuthError(err), 'error');
  } finally {
    $btn.prop('disabled', false).text('Login');
  }
});

$('#registerForm').on('submit', async function(e){
  e.preventDefault();
  const $form = $(this);
  const $btn = $form.find('button[type="submit"]');
  const fullName = $form.find('input[type="text"]').val().trim();
  const email = $form.find('input[type="email"]').val().trim();
  const phone = $form.find('input[type="tel"]').val().trim();
  const password = $('#regPassword').val();
  const confirm = $('#regPasswordConfirm').val();

  if(password !== confirm){
    showToast("Passwords don't match.", 'warning');
    return;
  }
  $btn.prop('disabled', true).text('Creating account...');
  try{
    const user = await window.CCAuth.registerUser(fullName, email, phone, password);
    showToast(user.otpEmailSent
      ? 'Account created! Check your email for a verification code.'
      : "Account created — but we couldn't send the verification email just now. Tap \"Resend code\" on the next screen to try again.",
      user.otpEmailSent ? 'success' : 'warning');
    goToVerifyEmail(email, user.otpEmailSent);
  } catch(err){
    showToast(friendlyAuthError(err), 'error');
  } finally {
    $btn.prop('disabled', false).text('Create Account');
  }
});

function friendlyAuthError(err){
  const code = err && err.code || '';
  if(code === 'profile-write-failed') return 'Account created, but a browser extension (ad blocker / privacy shield) blocked the connection to the database. Please disable it for this site and try logging in.';
  if(code.includes('email-already-in-use')) return 'That email is already registered.';
  if(code.includes('invalid-email')) return 'Please enter a valid email address.';
  if(code.includes('weak-password')) return 'Password should be at least 6 characters.';
  if(code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) return 'Incorrect email or password.';
  if(code.includes('too-many-requests')) return 'Too many attempts — please wait a moment and try again.';
  return 'Something went wrong. Please try again.';
}

/* ================= OTP VERIFICATION ================= */
let verifyResendCooldown = null;

function goToVerifyEmail(email, justSent){
  $('#verifyEmailAddress').text(email);
  $('#otpError').hide();
  $('.otp-digit').val('').removeClass('otp-error-state');
  navigate('verify-email');
  $('.otp-digit').first().trigger('focus');
  // Only impose the brief "just sent it" cooldown when a code actually
  // went out. If the send failed, let them tap Resend immediately
  // instead of forcing a wait for an email that never arrived.
  startVerifyResendCooldown(justSent === false ? 0 : 30);
}

function startVerifyResendCooldown(seconds){
  const $btn = $('#verifyResendBtn');
  clearInterval(verifyResendCooldown);
  if(seconds <= 0){
    $btn.prop('disabled', false).text('Resend code');
    return;
  }
  let remaining = seconds;
  $btn.prop('disabled', true).text(`Resend code (${remaining}s)`);
  verifyResendCooldown = setInterval(() => {
    remaining--;
    if(remaining <= 0){
      clearInterval(verifyResendCooldown);
      $btn.prop('disabled', false).text('Resend code');
    } else {
      $btn.text(`Resend code (${remaining}s)`);
    }
  }, 1000);
}

/* 6-box code entry: type advances to the next box, backspace on an
   empty box jumps back, and pasting a full code fills every box. */
$(document).on('input', '.otp-digit', function(){
  this.value = this.value.replace(/[^0-9]/g, '').slice(0, 1);
  $('#otpError').hide();
  $('.otp-digit').removeClass('otp-error-state');
  if(this.value) $(this).next('.otp-digit').trigger('focus');
});
$(document).on('keydown', '.otp-digit', function(e){
  if(e.key === 'Backspace' && !this.value) $(this).prev('.otp-digit').trigger('focus');
});
$(document).on('paste', '.otp-digit', function(e){
  const pasted = (e.originalEvent.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
  if(!pasted) return;
  e.preventDefault();
  const $digits = $('.otp-digit');
  pasted.slice(0, $digits.length).split('').forEach((digit, i) => $digits.eq(i).val(digit));
  $digits.eq(Math.min(pasted.length, $digits.length) - 1).trigger('focus');
});

function otpErrorMessage(reason, attemptsLeft){
  switch(reason){
    case 'expired': return 'That code expired. Tap "Resend code" for a new one.';
    case 'too-many-attempts': return 'Too many incorrect attempts. Tap "Resend code" for a new one.';
    case 'incorrect': return `Incorrect code — ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`;
    case 'no-code': return 'No code on file yet. Tap "Resend code".';
    case 'not-signed-in': return 'Your session needs a moment to reconnect — please try again in a few seconds.';
    default: return 'Something went wrong. Please try again.';
  }
}

$(document).on('click', '#verifyResendBtn', async function(){
  const $btn = $(this);
  $btn.prop('disabled', true).text('Sending...');
  try{
    const { emailSent } = await window.CCAuth.resendOtp();
    $('#otpError').hide();
    $('.otp-digit').val('').removeClass('otp-error-state').first().trigger('focus');
    if(emailSent){
      showToast('New code sent — check your inbox.', 'success');
      startVerifyResendCooldown(45);
    } else {
      // Be honest: the code was regenerated in Firestore, but the email
      // itself didn't go out, so don't tell them to go check their inbox.
      showToast("New code generated, but the email didn't go out. Check your connection and tap Resend again in a moment.", 'warning');
      startVerifyResendCooldown(10); // short cooldown, not the usual 45s, since nothing was actually sent
    }
  } catch(err){
    console.error(err);
    const message = (err && err.message === 'not-signed-in')
      ? 'Your session needs a moment to reconnect — please try again in a few seconds.'
      : 'Could not resend right now. Please try again shortly.';
    showToast(message, 'error');
    $btn.prop('disabled', false).text('Resend code');
  }
});

$(document).on('click', '#verifyContinueBtn', async function(){
  const code = $('.otp-digit').map(function(){ return this.value; }).get().join('');
  if(code.length < 6){
    $('#otpError').text('Enter all 6 digits.').show();
    $('.otp-digit').addClass('otp-error-state');
    return;
  }
  const $btn = $(this);
  $btn.prop('disabled', true).text('Verifying...');
  try{
    const result = await window.CCAuth.verifyOtp(code);
    if(result.ok){
      showToast("Email verified — you're all set!", 'success');
      // verifyOtp() only updates Firestore — it doesn't touch the nav
      // dot/dropdown, which only refresh on the auth.js onAuthStateChanged
      // listener (login/logout/page load). Re-firing authRoleReady here
      // updates them immediately instead of waiting for the next reload.
      document.dispatchEvent(new CustomEvent("authRoleReady", {
        detail: { user: window.currentUser, role: window.currentRole, otpVerified: true }
      }));
      navigate('home');
    } else {
      $('#otpError').text(otpErrorMessage(result.reason, result.attemptsLeft)).show();
      $('.otp-digit').addClass('otp-error-state');
    }
  } catch(err){
    console.error(err);
    showToast('Could not verify right now. Please try again.', 'error');
  } finally {
    $btn.prop('disabled', false).text('Verify & Continue');
  }
});

$(document).on('click', '#verifySkipBtn', function(){
  navigate('home');
});

$(document).on('click', '#accountDdVerifyBtn', function(){
  $('#accountDropdownWrap').removeClass('open');
  goToVerifyEmail(window.currentUser ? window.currentUser.email : '');
});

/* Reflect sign-in state in the nav: show an Admin link for admins,
   and swap the account icon's behavior once we know who's signed in. */
document.addEventListener('authStateReady', function(e){
  const { user } = e.detail;
  const realUser = user && !user.isAnonymous ? user : null;
  syncCartToAccount(realUser);
  syncWishlistToAccount(realUser);
  syncAddressesToAccount(realUser);
  $('#accountStatusDot').toggle(!!realUser);
  $('#accountBtn').attr('title', realUser ? `Signed in as ${realUser.displayName || realUser.email}` : 'Not signed in — click to log in')
    .toggleClass('signed-in', !!realUser);
});

/* Verification status arrives slightly later than the base auth state
   (it needs a Firestore read), so the dot/dropdown update here once
   authRoleReady fires rather than in authStateReady above. */
document.addEventListener('authRoleReady', function(e){
  const { user, otpVerified } = e.detail;
  const realUser = user && !user.isAnonymous ? user : null;
  $('#accountStatusDot').toggleClass('unverified', !!(realUser && !otpVerified));
  renderAccountDropdown(realUser, otpVerified);
});

function renderAccountDropdown(user, otpVerified){
  const $content = $('#accountDropdownContent');
  if(!user){ $content.html(''); return; }
  $content.html(`
    <div class="account-dd-name">${user.displayName || 'My Account'}</div>
    <div class="account-dd-email">${user.email}</div>
    ${!otpVerified ? `<button type="button" class="account-dd-unverified" id="accountDdVerifyBtn">Email not verified — tap to verify</button>` : ''}
    <div class="account-dd-divider"></div>
    <button type="button" class="account-dd-link" id="accountDdOrdersBtn">Order History</button>
    <button type="button" class="account-dd-link" id="accountDdAddressesBtn">My Addresses</button>
    <button type="button" class="account-dd-link" id="accountDdWishlistBtn">Favorites</button>
    <button class="btn btn-outline account-dd-logout" id="accountLogoutBtn">Log Out</button>
  `);
}

$(document).on('click', '#accountDdOrdersBtn', function(){
  $('#accountDropdownWrap').removeClass('open');
  navigate('order-history');
});

$(document).on('click', '#accountDdAddressesBtn', function(){
  $('#accountDropdownWrap').removeClass('open');
  navigate('addresses');
});

$(document).on('click', '#accountDdWishlistBtn', function(){
  $('#accountDropdownWrap').removeClass('open');
  navigate('wishlist');
});

$(document).on('click', '#accountBtn', function(e){
  e.stopPropagation();
  if(window.currentUser && !window.currentUser.isAnonymous){
    $('#accountDropdownWrap').toggleClass('open');
  } else {
    navigate('login');
  }
});

$(document).on('click', '#accountLogoutBtn', async function(){
  await window.CCAuth.logoutUser();
  $('#accountDropdownWrap').removeClass('open');
  showToast('Logged out.', 'info');
  navigate('home');
});

// Click anywhere outside the account dropdown closes it
$(document).on('click', function(e){
  const $wrap = $('#accountDropdownWrap');
  if($wrap.hasClass('open') && !$(e.target).closest('#accountDropdownWrap').length){
    $wrap.removeClass('open');
  }
});

/* ================= CONFIRM DIALOG (replaces window.confirm) ================= */
let confirmResolve = null;

/* Usage: const ok = await showConfirm({ title, message, confirmText, danger });
   Resolves true/false depending on which button was pressed (or false if
   dismissed via backdrop click / Escape). */
function showConfirm({ title = 'Are you sure?', message = "This action can't be undone.", confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}){
  $('#confirmDialogTitle').text(title);
  $('#confirmDialogMsg').text(message);
  $('#confirmDialogOk').text(confirmText).toggleClass('btn-danger', danger).toggleClass('btn-primary', !danger);
  $('#confirmDialogCancel').text(cancelText);
  $('#confirmDialogIcon').toggleClass('danger', danger);
  $('#confirmOverlay').addClass('open');
  return new Promise((resolve) => { confirmResolve = resolve; });
}

function closeConfirm(result){
  $('#confirmOverlay').removeClass('open');
  if(confirmResolve){
    confirmResolve(result);
    confirmResolve = null;
  }
}

$(document).on('click', '#confirmDialogOk', () => closeConfirm(true));
$(document).on('click', '#confirmDialogCancel', () => closeConfirm(false));
$(document).on('click', '#confirmOverlay', function(e){
  if(e.target.id === 'confirmOverlay') closeConfirm(false);
});
$(document).on('keydown', function(e){
  if(e.key === 'Escape' && $('#confirmOverlay').hasClass('open')) closeConfirm(false);
});

/* ================= RESET PASSWORD MODAL ================= */
$(document).on('click', '#forgotPasswordLink', function(){
  $('#resetPasswordEmail').val($('#loginEmail').val().trim());
  $('#resetPasswordOverlay').addClass('open');
  $('#resetPasswordEmail').trigger('focus');
});

function closeResetPasswordModal(){
  $('#resetPasswordOverlay').removeClass('open');
  $('#resetPasswordForm')[0].reset();
}

$(document).on('click', '#resetPasswordCancel', closeResetPasswordModal);
$(document).on('click', '#resetPasswordOverlay', function(e){
  if(e.target.id === 'resetPasswordOverlay') closeResetPasswordModal();
});
$(document).on('keydown', function(e){
  if(e.key === 'Escape' && $('#resetPasswordOverlay').hasClass('open')) closeResetPasswordModal();
});

$(document).on('submit', '#resetPasswordForm', async function(e){
  e.preventDefault();
  const email = $('#resetPasswordEmail').val().trim();
  const $btn = $('#resetPasswordSubmit');
  $btn.prop('disabled', true).text('Sending...');
  try{
    await window.CCAuth.sendResetPasswordEmail(email);
    showToast("If that email has an account, we've sent a reset link.", 'success');
    closeResetPasswordModal();
  } catch(err){
    console.error(err);
    showToast('Could not send the reset link right now. Please try again.', 'error');
  } finally {
    $btn.prop('disabled', false).text('Send Link');
  }
});

/* ================= SCROLL PROGRESS BAR ================= */
function initScrollProgress(){
  const bar = document.getElementById('scrollProgress');
  if(!bar) return;
  window.addEventListener('scroll', ()=>{
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? scrollTop / docHeight : 0;
    bar.style.transform = `scaleX(${pct})`;
  });
}

/* ================= NAV: SHRINK + SHADOW ON SCROLL ================= */
function initNavScroll(){
  const header = document.querySelector('header.site-nav');
  if(!header) return;
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();
}

/* ================= PRODUCT CARD: SUBTLE 3D TILT ================= */
/* Only .product-card gets the tilt — .cat-card is deliberately flat/
   editorial by design (see its CSS comment), so it's left alone. */
function initCardTilt(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(window.matchMedia('(hover: none)').matches) return; // skip on touch devices
  const maxTilt = 6;
  $(document).on('mouseenter', '.product-card', function(){
    this.style.transition = 'transform 0.1s ease-out, box-shadow 0.4s var(--ease-premium), border-color 0.4s ease';
  });
  $(document).on('mousemove', '.product-card', function(e){
    const rect = this.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    this.style.transform = `perspective(800px) rotateX(${(-py*maxTilt).toFixed(2)}deg) rotateY(${(px*maxTilt).toFixed(2)}deg) translateY(-4px)`;
  });
  $(document).on('mouseleave', '.product-card', function(){
    this.style.transition = '';
    this.style.transform = '';
  });
}

/* ================= ABOUT SECTION: ANIMATED STAT COUNTERS ================= */
/* Counts up any "<strong>" inside .about-stats from 0 to its printed
   value once it scrolls into view. Reads the number out of the existing
   text so it keeps whatever prefix/suffix is already there (e.g. "12k+"). */
function initStatCounters(){
  const nodes = document.querySelectorAll('.about-stats strong:not([data-counted])');
  if(!nodes.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      const el = entry.target;
      obs.unobserve(el);
      el.setAttribute('data-counted', '1');
      const raw = el.textContent;
      const match = raw.match(/[\d.,]+/);
      if(!match || reduceMotion) return;
      const numStr = match[0];
      const target = parseFloat(numStr.replace(/,/g, ''));
      if(isNaN(target)) return;
      const prefix = raw.slice(0, match.index);
      const suffix = raw.slice(match.index + numStr.length);
      const hasComma = numStr.includes(',');
      const duration = 1100;
      const start = performance.now();
      function tick(now){
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        const val = Math.round(target * eased);
        el.textContent = prefix + (hasComma ? val.toLocaleString('en-US') : val) + suffix;
        if(t < 1) requestAnimationFrame(tick);
        else el.textContent = raw;
      }
      requestAnimationFrame(tick);
    });
  }, { threshold:0.4 });
  nodes.forEach(n => obs.observe(n));
}

/* ================= ADD TO CART: FLY-TO-CART MICRO-INTERACTION ================= */
/* Clones the product image and animates it flying into the cart icon,
   then gives the cart icon a little bounce — a small, tactile confirmation
   that something was actually added, instead of just a toast. */
function flyToCart(sourceImgEl){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cartBtn = document.getElementById('cartBtn');
  if(!cartBtn || !sourceImgEl) return;
  const srcRect = sourceImgEl.getBoundingClientRect();
  const dstRect = cartBtn.getBoundingClientRect();
  if(srcRect.width === 0 || srcRect.height === 0) return;

  const clone = sourceImgEl.cloneNode(true);
  clone.classList.add('fly-to-cart-clone');
  Object.assign(clone.style, {
    position:'fixed',
    left: srcRect.left + 'px',
    top: srcRect.top + 'px',
    width: srcRect.width + 'px',
    height: srcRect.height + 'px',
    margin:0,
    zIndex:999,
    pointerEvents:'none',
    borderRadius:'12px',
    objectFit:'cover',
    boxShadow:'var(--shadow-lift)'
  });
  document.body.appendChild(clone);

  const dx = (dstRect.left + dstRect.width/2) - (srcRect.left + srcRect.width/2);
  const dy = (dstRect.top + dstRect.height/2) - (srcRect.top + srcRect.height/2);

  requestAnimationFrame(()=>{
    clone.style.transition = 'transform 0.6s cubic-bezier(0.16,1,0.3,1), opacity 0.6s ease';
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.1)`;
    clone.style.opacity = '0.3';
  });

  const cleanup = () => {
    clone.remove();
    cartBtn.classList.add('cart-bump');
    setTimeout(()=> cartBtn.classList.remove('cart-bump'), 400);
  };
  clone.addEventListener('transitionend', cleanup, { once:true });
  setTimeout(cleanup, 700); // safety net in case transitionend never fires
}

/* ================= TERMS & PRIVACY MODAL ================= */
function openLegalModal(which){
  $('.legal-tab').removeClass('active');
  $(`.legal-tab[data-legal-tab="${which}"]`).addClass('active');
  $('.legal-panel').removeClass('active');
  $(`.legal-panel[data-legal-panel="${which}"]`).addClass('active');
  $('#legalBody').scrollTop(0);
  $('#legalOverlay').addClass('open');
  $('body').css('overflow', 'hidden');
}

function closeLegalModal(){
  if(!$('#legalOverlay').hasClass('open')) return;
  $('#legalOverlay').removeClass('open');
  $('body').css('overflow', '');
}

$(document).on('click', '[data-legal]', function(e){
  e.preventDefault();
  openLegalModal($(this).data('legal'));
});

$(document).on('click', '.legal-tab', function(){
  const which = $(this).data('legal-tab');
  $('.legal-tab').removeClass('active');
  $(this).addClass('active');
  $('.legal-panel').removeClass('active');
  $(`.legal-panel[data-legal-panel="${which}"]`).addClass('active');
  $('#legalBody').scrollTop(0);
});

$(document).on('click', '#legalClose, #legalAccept', closeLegalModal);

// Clicking the dimmed backdrop (not the card itself) closes it
$(document).on('click', '#legalOverlay', function(e){
  if(e.target === this) closeLegalModal();
});

/* ================= FAQ ACCORDION ================= */
$(document).on('click', '.faq-question', function(){
  $(this).closest('.faq-item').toggleClass('open');
});

/* ================= CONTACT FORM ================= */
$(document).on('submit', '#contactForm', async function(e){
  e.preventDefault();
  const $form = $(this);
  const $btn = $form.find('button[type="submit"]');
  const payload = {
    name: $('#cName').val().trim(),
    email: $('#cEmail').val().trim(),
    subject: $('#cSubject').val().trim(),
    message: $('#cMessage').val().trim()
  };
  console.log('Contact form submitted:', payload);
  showToast('Message received — we\'ll get back to you soon.', 'success');
  this.reset();
});

/* ================= SCROLL REVEAL ================= */
function initReveal(){
  const items = document.querySelectorAll('.page.active .reveal:not(.in)');
  const obs = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('in');
        obs.unobserve(entry.target);
      }
    });
  }, {threshold:0.12});
  items.forEach(i => obs.observe(i));
}

/* ================= INIT ================= */

function renderAll(){
  renderBestSellers();
  renderMenuPage();
  renderMerchPage();
  buildComboProducts();
  renderFeaturedCombos();
  // Products may have still been loading the first time the cart dropdown
  // (or the cart/checkout page) rendered, which would have left it showing
  // "empty" even though items existed. Re-paint it now that PRODUCTS /
  // COMBO_PRODUCTS are populated.
  renderCartDropdown();
  rerenderActiveCartPage();
}

/* loadProductsFromFirestore() moved to shared-catalog.js. */

async function loadSettingsFromFirestore(){
  try{
    const settings = await window.CCSettings.fetchSettings();
    DELIVERY_FEE = settings.deliveryFee;
    PROMO_POPUP_CONFIG = settings.promoPopup;
  } catch(err){
    console.error('Could not load settings from Firestore, using the default delivery fee instead.', err);
  }
}

async function loadCategoriesFromFirestore(){
  try{
    const categories = await window.CCCategories.fetchAllCategories();
    CUSTOM_CATEGORIES = categories;
    applyCustomCategories(categories);
  } catch(err){
    console.error('Could not load custom categories from Firestore — falling back to the built-in category list.', err);
  }
}

$(async function(){

  renderCategories();
  updateCartCount();
  initReveal();
  initScrollProgress();


  const cached = window.CCProducts.getCachedProducts();
  if(cached && cached.length){
    PRODUCTS = cached;
    renderAll();
  }
  const cachedSettings = window.CCSettings.getCachedSettings();
  if(cachedSettings){
    DELIVERY_FEE = cachedSettings.deliveryFee;
    if(cachedSettings.promoPopup) PROMO_POPUP_CONFIG = cachedSettings.promoPopup;
  }
  const cachedCategories = window.CCCategories.getCachedCategories();
  if(cachedCategories && cachedCategories.length){
    CUSTOM_CATEGORIES = cachedCategories;
    applyCustomCategories(cachedCategories);
  }

  await loadCategoriesFromFirestore();
  await loadProductsFromFirestore();
  await loadSettingsFromFirestore();
  await loadCombosFromFirestore();
  renderAll();
  initPromoOverlay();
});
/* ================= PROMO LAUNCH BANNER ================= */
/* Fancy "New" popup shown once per browser session on page load, its
   content driven by whatever the admin last saved (see the Launch
   Popup panel in admin.js) via the shared resolvePromoProducts()/
   applyPromoPopupContent() in shared-catalog.js. sessionStorage (not
   localStorage) so it reappears on a fresh visit/tab but doesn't nag
   on every reload within the same session.

   Called from the main $(async function(){...}) init flow below,
   once loadSettingsFromFirestore()/loadProductsFromFirestore() have
   populated PROMO_POPUP_CONFIG/PRODUCTS — not on raw page parse —
   since there's nothing real to show before then. */
function initPromoOverlay(){
  const PROMO_KEY = 'cc_promo_seen_v1';
  const $overlay = $('#promoOverlay');
  if(!$overlay.length) return;

  const cfg = PROMO_POPUP_CONFIG || PROMO_POPUP_DEFAULTS;
  if(cfg.enabled === false) return;

  function closePromo(){
    $overlay.removeClass('open');
    sessionStorage.setItem(PROMO_KEY, '1');
  }

  let seen = false;
  try{ seen = sessionStorage.getItem(PROMO_KEY) === '1'; } catch(err){ /* private mode — just show it */ }
  if(seen) return;

  applyPromoPopupContent(cfg, resolvePromoProducts(cfg), {
    badge: '#promoBadgeText', eyebrow: '#promoEyebrow', title: '#promoModalTitle',
    copy: '#promoModalCopy', cta: '#promoModalCta', dismiss: '#promoModalDismiss',
    stage: '#promoStage', cards: '#promoStageCards'
  });

  // Slight delay so it arrives after the hero's own entrance animation
  // has had a moment to breathe, rather than competing with it.
  setTimeout(() => $overlay.addClass('open'), 900);

  $('#promoModalClose, #promoModalDismiss').on('click', closePromo);
  $('#promoModalCta').on('click', closePromo);
  // Clicking a product card itself should close the popup and let it
  // proceed like any other product link — the existing global
  // [data-open-product] handler (bound elsewhere, used by every
  // product grid) already sets currentProductId and navigates on this
  // same click; this just dismisses the popup out of the way first,
  // since it's bound closer to the target and fires earlier in the
  // bubble phase.
  $('#promoStageCards').on('click', '.promo-stage-card', closePromo);
  $overlay.on('click', function(e){
    if(e.target === this) closePromo();
  });
  $(document).on('keydown', function(e){
    if(e.key === 'Escape' && $overlay.hasClass('open')) closePromo();
  });
}
