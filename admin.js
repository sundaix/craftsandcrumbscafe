let ADMIN_ORDERS = [];
let adminEditingId = null; // set while editing an existing product, null when adding a new one
let adminProductSearch = '';    // current text in the Products search box
let adminCategoryFilter = 'All'; // current selection in the category filter dropdown

/* Mirrors the product being added/edited's optionGroups field while the
   form is open — see renderOptionGroupsBuilder() below for the shape
   and the whole "OPTION GROUPS BUILDER" section for how it's edited. */
let apOptionGroups = [];

const FOOD_CATEGORIES = ['Coffee', 'Non-Coffee', 'Tea', 'Pastries', 'Sandwiches', 'Cakes'];

/* Default size list offered for each sized category when adding a new
   product, or when switching an existing product to one of these
   categories. Editing a product that already has its own size list
   keeps that list instead (see renderSizePriceRows). */
const DEFAULT_SIZES_BY_CATEGORY = {
  Shirts: ['XS','S','M','L','XL','XXL'],
  Shorts: ['XS','S','M','L','XL','XXL'],
  Socks: ['S','M','L'],
  Caps: ['One Size'],
};

const DRINK_CATEGORIES = ['Coffee', 'Non-Coffee', 'Tea'];
const DRINK_SIZES = ['16oz', '20oz', '24oz'];

const ADMIN_CATEGORY_BADGE_CLASS = {
  'Drinks': 'drinks',
  'Food': 'food',
  'Wearables': 'wearables',
  'Merchandise': 'accessories' // Bracelets / Keychains
};

function categoryBadge(cat){
  const meta = (typeof CAT_LABELS !== 'undefined') ? CAT_LABELS[cat] : null;
  const groupClass = ADMIN_CATEGORY_BADGE_CLASS[meta && meta.group] || 'other';
  const label = (meta && meta.sub) || cat;
  return `<span class="admin-cat-badge admin-cat-badge-${groupClass}">${label}</span>`;
}

const ADMIN_NAV_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" stroke-width="1.5"/><path d="M19.4 13.9c.05-.6.05-1.2 0-1.8l1.9-1.4a.8.8 0 0 0 .2-1L19.7 6.9a.8.8 0 0 0-.95-.35l-2.2.85a7.4 7.4 0 0 0-1.55-.9l-.35-2.3a.8.8 0 0 0-.8-.7h-3.7a.8.8 0 0 0-.8.7l-.35 2.3c-.56.23-1.08.53-1.55.9l-2.2-.85a.8.8 0 0 0-.95.35L2.5 9.7a.8.8 0 0 0 .2 1l1.9 1.4a8.3 8.3 0 0 0 0 1.8l-1.9 1.4a.8.8 0 0 0-.2 1l1.85 2.8c.2.32.6.44.95.35l2.2-.85c.47.37.99.67 1.55.9l.35 2.3c.06.4.42.7.8.7h3.7c.38 0 .74-.3.8-.7l.35-2.3c.56-.23 1.08-.53 1.55-.9l2.2.85c.35.09.75-.03.95-.35l1.85-2.8a.8.8 0 0 0-.2-1l-1.9-1.4Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

/* ================= ADD CATEGORY ================= */
function openCategoryModal(){
  $('#addCategoryForm')[0].reset();
  $('#ccSizesField').hide();
  const groups = Array.from(new Set(Object.values(CAT_LABELS).map(m => m.group)));
  $('#ccGroupOptions').html(groups.map(g => `<option value="${g}">`).join(''));
  renderExistingCategoriesList();
  $('#categoryModalOverlay').addClass('open');
}
function closeCategoryModal(){
  $('#categoryModalOverlay').removeClass('open');
}

/* Lists categories the admin has actually created (CUSTOM_CATEGORIES),
   each with a delete button — built-in categories (Coffee, Shirts,
   etc.) aren't shown here since they're hardcoded in script.js and
   were never meant to be removable. Shows how many products currently
   sit in each category so an admin isn't surprised by an orphaned
   product after deleting one. */
function renderExistingCategoriesList(){
  const $wrap = $('#ccExistingWrap');
  if(!CUSTOM_CATEGORIES.length){
    $wrap.hide();
    return;
  }
  const rows = CUSTOM_CATEGORIES.map(c => {
    const count = PRODUCTS.filter(p => p.cat === c.id).length;
    return `
      <div class="cc-existing-row" data-cc-row="${c.id}">
        <div class="cc-existing-row-info">
          <span class="cc-existing-row-name">${c.label}</span>
          <span class="cc-existing-row-count">${count ? `${count} product${count === 1 ? '' : 's'}` : 'empty'}</span>
        </div>
        <button type="button" class="admin-icon-btn admin-icon-btn-danger" data-admin-category-delete="${c.id}" title="Delete category" aria-label="Delete ${c.label}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    `;
  }).join('');
  $('#ccExistingList').html(rows);
  $wrap.show();
}

/* Deletes a custom category: confirms (with a stronger warning if
   products still use it, since those products won't be reassigned
   automatically), removes it from Firestore, unwinds every place it
   was folded into (CAT_LABELS, sidebars, pricing rules — see
   removeCustomCategoryEffects in script.js), and refreshes every
   piece of UI that reads category data. */
$(document).on('click', '[data-admin-category-delete]', async function(){
  const id = $(this).data('admin-category-delete');
  const c = CUSTOM_CATEGORIES.find(x => x.id === id);
  if(!c) return;

  const count = PRODUCTS.filter(p => p.cat === id).length;
  const msg = count
    ? `${count} product${count === 1 ? '' : 's'} still use${count === 1 ? 's' : ''} "${c.label}". They won't be deleted, but they'll need a new category assigned or they may not show up correctly. Delete "${c.label}" anyway?`
    : `Delete category "${c.label}"? This can't be undone.`;
  if(!window.confirm(msg)) return;

  const $btn = $(this);
  $btn.prop('disabled', true);
  try{
    await window.CCCategories.deleteCategory(id);
    CUSTOM_CATEGORIES = CUSTOM_CATEGORIES.filter(x => x.id !== id);
    removeCustomCategoryEffects(c);
    renderExistingCategoriesList();
    renderAdminCategorySelects();
    renderMenuSidebar();
    renderMerchSidebar();
    renderMenuPage();
    renderMerchPage();
    showToast(`Deleted "${c.label}".`, 'success');
  } catch(err){
    console.error(err);
    showToast('Could not delete that category. Please try again.', 'error');
    $btn.prop('disabled', false);
  }
});

$(document).on('click', '#openAddCategoryBtn', openCategoryModal);
$(document).on('click', '#categoryModalClose', closeCategoryModal);
$(document).on('click', '#categoryModalOverlay', function(e){
  if(e.target === this) closeCategoryModal();
});
$(document).on('keydown', function(e){
  if(e.key === 'Escape' && $('#categoryModalOverlay').hasClass('open')) closeCategoryModal();
});

$(document).on('change', '#ccPricing', function(){
  $('#ccSizesField').toggle($(this).val() === 'sized-stock');
});

/* Turns a free-typed label into a doc-id-safe key in the same style
   as the built-in categories ('Non-Coffee', 'ToteBags') — letters and
   numbers only, no spaces. Falls back to a timestamp if the label is
   somehow left with nothing usable (e.g. all punctuation). */
function slugifyCategoryLabel(label){
  return label.trim().replace(/[^a-zA-Z0-9]+/g, '') || ('Category' + Date.now());
}

/* Guarantees the id doesn't collide with a built-in or previously
   added category — appends 2, 3, 4... until it finds a free one.
   Collisions should be rare (two categories with very similar names)
   but silently overwriting an existing category would be much worse
   than a slightly-suffixed id. */
function uniqueCategoryId(base){
  if(!CAT_LABELS[base]) return base;
  let n = 2;
  while(CAT_LABELS[base + n]) n++;
  return base + n;
}

$(document).on('submit', '#addCategoryForm', async function(e){
  e.preventDefault();
  const $btn = $('#addCategorySubmitBtn');
  const label = $('#ccLabel').val().trim();
  const group = $('#ccGroup').val().trim();
  if(!label || !group) return;

  const id = uniqueCategoryId(slugifyCategoryLabel(label));
  const pricingType = $('#ccPricing').val();
  const sizes = pricingType === 'sized-stock'
    ? $('#ccSizes').val().split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const category = {
    id, label, group,
    page: $('#ccPage').val(),
    pricingType,
    sizes,
    hasFoodFields: $('#ccFoodFields').prop('checked'),
    createdAt: new Date().toISOString()
  };

  $btn.prop('disabled', true).text('Adding...');
  try{
    await window.CCCategories.addCategory(category);
    CUSTOM_CATEGORIES.push(category);
    applyCustomCategory(category);
    renderAdminCategorySelects();
    renderMenuSidebar();
    renderMerchSidebar();
    closeCategoryModal();
    // Jump straight to the Add Product form with the new category
    // already selected — the whole point was to use it right away.
    goToProductsSubtab('add-product');
    $('#apCategory').val(category.id).trigger('change');
    showToast(`Added category "${label}".`, 'success');
  } catch(err){
    console.error(err);
    showToast('Could not add that category. Please try again.', 'error');
  } finally {
    $btn.prop('disabled', false).text('Add Category');
  }
});

document.addEventListener('authRoleReady', function(e){
  const { role } = e.detail;
  $('[data-nav="admin"]').remove();
  if(role === 'admin'){
    $('.nav-actions').prepend(`<a href="#" class="icon-btn admin-link" data-nav="admin" title="Admin" aria-label="Admin">${ADMIN_NAV_ICON}</a>`);
  }
});

function renderAdminDashboard(){
  renderAdminCategorySelects();
  renderAdminOverviewStats();
  renderAdminProductsTable();
  loadAndRenderAdminOrders();
  loadAndRenderAdminCombos();
  loadAndRenderAdminSettings();
  loadAndRenderAdminPromo();
}

/* ================= TABS ================= */
$(document).on('click', '.admin-tab', function(){
  const tab = $(this).data('admin-tab');
  $('.admin-tab').removeClass('active');
  $(this).addClass('active');
  $('.admin-panel').removeClass('active');
  $(`.admin-panel[data-admin-panel="${tab}"]`).addClass('active');
});

/* Inner "Catalog / Add Product / Combos" pill nav inside the
   Products tab (see index.html) — Products/Add Product/Combos used
   to be three separate top-level tabs; they're one tab now with
   this sub-nav switching between them. */
function goToProductsSubtab(subtab){
  $('.admin-tab').removeClass('active');
  $('.admin-tab[data-admin-tab="products"]').addClass('active');
  $('.admin-panel').removeClass('active');
  $('.admin-panel[data-admin-panel="products"]').addClass('active');
  $('.admin-subtab').removeClass('active');
  $(`.admin-subtab[data-admin-subtab="${subtab}"]`).addClass('active');
  $('.admin-subpanel').removeClass('active');
  $(`.admin-subpanel[data-admin-subpanel="${subtab}"]`).addClass('active');
}

$(document).on('click', '.admin-subtab', function(){
  const subtab = $(this).data('admin-subtab');
  // Clicking straight into "Add / Edit Product" (rather than arriving
  // via a row's Edit/Duplicate button, which calls goToProductsSubtab
  // directly) always means "start a fresh product" — guarantees the
  // form can never be left silently stuck in an old "Edit ___" state
  // from a previous visit.
  if(subtab === 'add-product') resetAdminProductForm();
  goToProductsSubtab(subtab);
});

/* Categories select + filter dropdown are rebuilt from CAT_LABELS
   (script.js) every time the dashboard renders, rather than being
   static HTML — that's what lets a category added through "+ Add
   Category" show up immediately without a page reload. Grouped into
   <optgroup>s in whatever order groups first appear in CAT_LABELS,
   so built-in groups (Drinks/Food/Wearables/Merchandise) stay first
   and any brand-new group the admin typed in lands after them. */
function buildCategoryOptgroupsHtml(){
  const groups = [];
  const byGroup = {};
  Object.keys(CAT_LABELS).forEach(catId => {
    const meta = CAT_LABELS[catId];
    if(!byGroup[meta.group]){ byGroup[meta.group] = []; groups.push(meta.group); }
    byGroup[meta.group].push({ id: catId, label: meta.sub || catId });
  });
  return groups.map(g => `<optgroup label="${g}">${
    byGroup[g].map(it => `<option value="${it.id}">${it.label}</option>`).join('')
  }</optgroup>`).join('');
}

function renderAdminCategorySelects(){
  const optgroupsHtml = buildCategoryOptgroupsHtml();

  const $filter = $('#adminCategoryFilter');
  const prevFilter = $filter.val() || 'All';
  $filter.html(`<option value="All">All Categories</option>${optgroupsHtml}`);
  $filter.val($filter.find(`option[value="${prevFilter}"]`).length ? prevFilter : 'All');

  const $apCat = $('#apCategory');
  const prevCat = $apCat.val();
  $apCat.html(optgroupsHtml);
  if(prevCat && $apCat.find(`option[value="${prevCat}"]`).length) $apCat.val(prevCat);
}

/* ================= OVERVIEW ================= */
function renderAdminOverviewStats(){
  $('#statTotalProducts').text(PRODUCTS.length);
  $('#statTotalOrders').text(ADMIN_ORDERS.length || '—');
  const pending = ADMIN_ORDERS.filter(o => (o.status || 'pending') === 'pending').length;
  $('#statPendingOrders').text(ADMIN_ORDERS.length ? pending : '—');
  const revenue = ADMIN_ORDERS.reduce((sum, o) => sum + (o.totals?.total || 0), 0);
  $('#statTotalRevenue').text(ADMIN_ORDERS.length ? peso(revenue) : '—');
}

function renderAdminProductsTable(){
  const q = adminProductSearch.trim().toLowerCase();
  const rows = PRODUCTS
    .filter(p => adminCategoryFilter === 'All' || p.cat === adminCategoryFilter)
    .filter(p => !q || p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q))
    .map(p => `
      <tr data-product-row="${p.id}">
        <td class="admin-td-product">
          <div class="admin-td-product-inner">
            <img src="${p.img}" alt="${p.name}">
            <span>${p.name}</span>
          </div>
        </td>
        <td>${categoryBadge(p.cat)}</td>
        <td>${priceLabel(p)}</td>
        <td>
          ${
            p.stock === undefined || p.stock === null
              ? '<span class="admin-stock-badge admin-stock-unknown">—</span>'
              : p.stock === 0
                ? '<span class="admin-stock-badge admin-stock-out">Out of stock</span>'
                : p.stock <= 5
                  ? `<span class="admin-stock-badge admin-stock-low">${p.stock} left</span>`
                  : `<span class="admin-stock-badge admin-stock-ok">${p.stock}</span>`
          }
        </td>
        <td class="admin-td-actions">
          <button class="admin-icon-btn" data-admin-edit="${p.id}" title="Edit" aria-label="Edit ${p.name}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20l1-4L16.5 4.5a1.5 1.5 0 0 1 2 0l1 1a1.5 1.5 0 0 1 0 2L8 19l-4 1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
          </button>
          <button class="admin-icon-btn" data-admin-duplicate="${p.id}" title="Duplicate" aria-label="Duplicate ${p.name}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.5"/></svg>
          </button>
          <button class="admin-icon-btn admin-icon-btn-danger" data-admin-delete="${p.id}" title="Delete" aria-label="Delete ${p.name}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </td>
      </tr>
    `).join('');
  const emptyMsg = q && adminCategoryFilter !== 'All'
    ? 'No products match that search in this category.'
    : adminCategoryFilter !== 'All'
      ? 'No products in this category yet.'
      : 'No products match that search.';
  $('#adminProductsBody').html(rows || `<tr><td colspan="4" class="admin-empty-row">${emptyMsg}</td></tr>`);
}

$(document).on('input', '#adminProductSearch', function(){
  adminProductSearch = $(this).val();
  renderAdminProductsTable();
});

$(document).on('change', '#adminCategoryFilter', function(){
  adminCategoryFilter = $(this).val();
  renderAdminProductsTable();
});

/* Shared by the Edit and Duplicate handlers below — fills the
   Calories/About/Nutrition fields from an existing product (or blanks
   them for a fresh one). Kept separate from toggleFoodFields/
   renderSizePriceRows since those two are also called on category
   *change*, when there's no product to pull values from. */
function populateDrinkDetailsFields(p){
  const n = (p && p.nutrition) || {};
  $('#apCalories').val(p && typeof p.calories === 'number' ? p.calories : '');
  $('#apAboutText').val((p && p.aboutText) || '');
  $('#apNutServing').val(n.servingSize || '');
  $('#apNutCarbs').val(n.carbs != null ? n.carbs : '');
  $('#apNutSugar').val(n.sugar != null ? n.sugar : '');
  $('#apNutProtein').val(n.protein != null ? n.protein : '');
  $('#apNutFat').val(n.fat != null ? n.fat : '');
  $('#apNutSodium').val(n.sodium != null ? n.sodium : '');
}

/* Edit: pull the product into the Add/Edit form and switch to that tab */
$(document).on('click', '[data-admin-edit]', function(){
  const id = $(this).data('admin-edit');
  const p = PRODUCTS.find(x => x.id === id);
  if(!p) return;

  adminEditingId = id;
  $('#apEditId').val(id);
  $('#apName').val(p.name);
  $('#apPrice').val(p.price);
  $('#apCategory').val(p.cat);
  $('#apDesc').val(p.desc || '');
  $('#apImg').val(p.img || '');
  $('#apIngredients').val(p.ingredients || '');
  $('#apAllergens').val(p.allergens || '');
  $('#apStock').val(p.stock !== undefined && p.stock !== null ? p.stock : '');
  populateDrinkDetailsFields(p);
  toggleFoodFields(p.cat);
  renderSizePriceRows(p.cat, p);
  setImagePreview('apImgPreviewImg', 'apImgPreviewPlaceholder', p.img || '');
  $('#apImgUploadStatus').text('').removeClass('image-upload-error');

  $('#adminFormTitle').text(`Edit "${p.name}"`);
  $('#adminFormSubmitBtn').text('Update Product');
  $('#adminCancelEditBtn').show();

  goToProductsSubtab('add-product');
});

$(document).on('click', '#adminCancelEditBtn', function(){
  resetAdminProductForm();
});

$(document).on('click', '[data-admin-duplicate]', function(){
  const p = PRODUCTS.find(x => x.id === $(this).data('admin-duplicate'));
  if(!p) return;

  adminEditingId = null;
  $('#apEditId').val('');
  $('#apName').val(p.name + ' (Copy)');
  $('#apPrice').val(p.price);
  $('#apCategory').val(p.cat);
  $('#apDesc').val(p.desc || '');
  $('#apImg').val(p.img || '');
  $('#apIngredients').val(p.ingredients || '');
  $('#apAllergens').val(p.allergens || '');
  $('#apStock').val(p.stock !== undefined && p.stock !== null ? p.stock : '');
  populateDrinkDetailsFields(p);
  toggleFoodFields(p.cat);
  renderSizePriceRows(p.cat, p); // pre-checks the same sizes the original has — just adjust and save
  setImagePreview('apImgPreviewImg', 'apImgPreviewPlaceholder', p.img || '');
  $('#apImgUploadStatus').text('').removeClass('image-upload-error');

  $('#adminFormTitle').text(`Duplicate "${p.name}"`);
  $('#adminFormSubmitBtn').text('Add Product');
  $('#adminCancelEditBtn').show();

  goToProductsSubtab('add-product');
  showToast(`Duplicated "${p.name}" — adjust sizing/price, then Add Product.`, 'info');
});

function resetAdminProductForm(){
  adminEditingId = null;
  $('#adminAddProductForm')[0].reset();
  $('#apEditId').val('');
  $('#adminFormTitle').text('Add Product to Inventory');
  $('#adminFormSubmitBtn').text('Add Product');
  $('#adminCancelEditBtn').hide();
  const cat = $('#apCategory').val();
  toggleFoodFields(cat);
  renderSizePriceRows(cat, null);
  setImagePreview('apImgPreviewImg', 'apImgPreviewPlaceholder', '');
  $('#apImgUploadStatus').text('').removeClass('image-upload-error');
}

/* Shows Ingredients/Allergens only for food categories — those fields
   have no meaning on a shirt or a keychain. */
function toggleFoodFields(cat){
  $('#apFoodFields').toggle(FOOD_CATEGORIES.includes(cat));
}

function renderSizePriceRows(cat, existingProduct){
  const isStockSized = Object.prototype.hasOwnProperty.call(DEFAULT_SIZES_BY_CATEGORY, cat);
  const isPriceSized = DRINK_CATEGORIES.includes(cat);

  $('#apSizesField').toggle(isStockSized);
  $('#apDrinkSizesField').toggle(isPriceSized);
  $('#apOptionGroupsField').toggle(isPriceSized);
  $('#apDrinkDetailsField').toggle(isPriceSized);
  $('#apPriceGroup').toggle(!isPriceSized);
  $('#apStockGroup').toggle(!isStockSized);
  $('#apStock').prop('required', !isStockSized);
  $('#apPrice').prop('required', !isPriceSized);

  if(isPriceSized){
    apOptionGroups = (existingProduct && existingProduct.cat === cat && Array.isArray(existingProduct.optionGroups))
      ? JSON.parse(JSON.stringify(existingProduct.optionGroups))
      : [];
  } else {
    apOptionGroups = [];
  }
  renderOptionGroupsBuilder();

  if(isStockSized){
    $('#apDrinkSizeRows').empty();

    let sizeList = DEFAULT_SIZES_BY_CATEGORY[cat];
    let checkedSet = new Set(sizeList); // default: everything checked for a fresh product
    const stockMap = {};

    if(existingProduct && existingProduct.cat === cat && existingProduct.sizes && existingProduct.sizes.length){
      const opts = getSizeOptions(existingProduct);
      const existingSizes = opts.map(o => o.size);
      sizeList = Array.from(new Set([...sizeList, ...existingSizes]));
      checkedSet = new Set(existingSizes);
      opts.forEach(o => { stockMap[o.size] = o.stock; });
    }

    $('#apSizeRows').html(sizeList.map(sz => {
      const checked = checkedSet.has(sz);
      const stockVal = stockMap[sz];
      const stockDisplay = typeof stockVal === 'number' ? stockVal : '';
      return `
      <div class="size-stock-row">
        <label class="size-stock-checkbox${checked ? ' checked' : ''}">
          <input type="checkbox" class="size-toggle-input" value="${sz}" ${checked ? 'checked' : ''}>
          <span>${sz}</span>
        </label>
        <div class="size-stock-input-wrap">
          <input type="number" min="0" step="1" class="size-stock-input" data-size="${sz}"
            value="${stockDisplay}" placeholder="Stock" ${checked ? '' : 'disabled'}>
        </div>
      </div>`;
    }).join(''));
    return;
  }

  if(isPriceSized){
    $('#apSizeRows').empty();

    let sizeList = DRINK_SIZES;
    const priceMap = {};
    if(existingProduct && existingProduct.cat === cat && existingProduct.sizes && existingProduct.sizes.length){
      const opts = getSizeOptions(existingProduct);
      sizeList = opts.map(o => o.size);
      opts.forEach(o => { priceMap[o.size] = o.price; });
    }

    $('#apDrinkSizeRows').html(sizeList.map(sz => `
      <div class="size-price-row">
        <span class="size-price-label">${sz}</span>
        <div class="size-price-input-wrap">
          <span class="size-price-currency">₱</span>
          <input type="number" min="0" step="1" class="size-price-input" data-size="${sz}"
            value="${priceMap[sz] !== undefined ? priceMap[sz] : ''}" placeholder="0" required>
        </div>
      </div>
    `).join(''));
    return;
  }

  $('#apSizeRows').empty();
  $('#apDrinkSizeRows').empty();
}

/* ================= OPTION GROUPS BUILDER (drinks only) ================= */
/* Structural changes (add/remove group or choice, switching a group's
   type) re-render the builder; per-field edits (labels, prices,
   checkboxes) just patch apOptionGroups in place instead, so typing
   in a label doesn't lose focus/cursor position on every keystroke. */
function newOptionGroup(){
  return { id: 'group-' + Date.now(), label: '', type: 'single', max: null, choices: [newOptionChoice()] };
}
function newOptionChoice(){
  return { id: 'choice-' + Date.now() + '-' + Math.floor(Math.random()*1000), label: '', price: 0, kcal: null, available: true, default: false };
}

function renderOptionGroupsBuilder(){
  const $wrap = $('#apOptionGroups');
  if(!apOptionGroups.length){
    $wrap.html(`
      <div class="opt-groups-empty">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h10M4 18h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        <p>No customization options yet.<br>Add a group below to build a page like the size selector above.</p>
      </div>
    `);
    return;
  }
  $wrap.html(apOptionGroups.map((g, gi) => `
    <div class="opt-group-card">
      <div class="opt-group-card-top">
        <span class="opt-group-index">Group ${gi + 1}</span>
        <button type="button" class="admin-icon-btn admin-icon-btn-danger opt-group-remove" data-og-remove="${gi}" aria-label="Remove group">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
      </div>
      <input type="text" class="opt-group-label-input" data-og="${gi}" placeholder="Group label, e.g. Choose your bean" value="${g.label || ''}">
      <div class="opt-group-type-row">
        <div class="opt-type-toggle" data-og="${gi}">
          <button type="button" class="opt-type-btn${g.type !== 'multi' ? ' active' : ''}" data-og="${gi}" data-type="single">Single choice</button>
          <button type="button" class="opt-type-btn${g.type === 'multi' ? ' active' : ''}" data-og="${gi}" data-type="multi">Multiple choice</button>
        </div>
        ${g.type === 'multi' ? `
          <label class="opt-max-field">
            <span>Max</span>
            <input type="number" min="1" step="1" class="opt-group-max-input" data-og="${gi}" placeholder="—" value="${g.max || ''}">
          </label>
        ` : ''}
      </div>
      <div class="opt-choice-rows">
        ${g.choices.map((c, ci) => `
          <div class="opt-choice-row">
            <input type="text" class="opt-choice-label-input" data-og="${gi}" data-oc="${ci}" placeholder="Choice label, e.g. Oat Milk" value="${c.label || ''}">
            <div class="opt-choice-price-wrap">
              <span>+₱</span>
              <input type="number" step="1" class="opt-choice-price-input" data-og="${gi}" data-oc="${ci}" placeholder="0" value="${c.price || ''}">
            </div>
            <div class="opt-choice-kcal-wrap">
              <input type="number" step="1" class="opt-choice-kcal-input" data-og="${gi}" data-oc="${ci}" placeholder="0" value="${c.kcal || ''}">
              <span>kcal</span>
            </div>
            <div class="opt-choice-toggles">
              <label class="opt-toggle-pill"><input type="checkbox" class="opt-choice-default-input" data-og="${gi}" data-oc="${ci}" ${c.default ? 'checked' : ''}><span>Default</span></label>
              <label class="opt-toggle-pill"><input type="checkbox" class="opt-choice-avail-input" data-og="${gi}" data-oc="${ci}" ${c.available !== false ? 'checked' : ''}><span>Available</span></label>
            </div>
            <button type="button" class="opt-choice-remove" data-og="${gi}" data-oc-remove="${ci}" aria-label="Remove choice">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        `).join('')}
      </div>
      <button type="button" class="btn btn-outline btn-sm opt-add-choice-btn" data-og="${gi}">+ Add Choice</button>
    </div>
  `).join(''));
}

$(document).on('click', '#apAddOptionGroupBtn', function(){
  apOptionGroups.push(newOptionGroup());
  renderOptionGroupsBuilder();
});
$(document).on('click', '.opt-group-remove', function(){
  apOptionGroups.splice($(this).data('og-remove'), 1);
  renderOptionGroupsBuilder();
});
$(document).on('click', '.opt-add-choice-btn', function(){
  apOptionGroups[$(this).data('og')].choices.push(newOptionChoice());
  renderOptionGroupsBuilder();
});
$(document).on('click', '.opt-choice-remove', function(){
  const gi = $(this).data('og');
  apOptionGroups[gi].choices.splice($(this).data('oc-remove'), 1);
  renderOptionGroupsBuilder();
});
$(document).on('click', '.opt-type-btn', function(){
  const gi = $(this).data('og');
  const type = $(this).data('type');
  if(apOptionGroups[gi].type === type) return;
  apOptionGroups[gi].type = type;
  renderOptionGroupsBuilder();
});
$(document).on('input', '.opt-group-label-input', function(){
  apOptionGroups[$(this).data('og')].label = $(this).val();
});
$(document).on('input', '.opt-group-max-input', function(){
  const v = parseInt($(this).val(), 10);
  apOptionGroups[$(this).data('og')].max = isNaN(v) ? null : v;
});
$(document).on('input', '.opt-choice-label-input', function(){
  apOptionGroups[$(this).data('og')].choices[$(this).data('oc')].label = $(this).val();
});
$(document).on('input', '.opt-choice-price-input', function(){
  const v = Number($(this).val());
  apOptionGroups[$(this).data('og')].choices[$(this).data('oc')].price = isNaN(v) ? 0 : v;
});
$(document).on('input', '.opt-choice-kcal-input', function(){
  const v = parseInt($(this).val(), 10);
  apOptionGroups[$(this).data('og')].choices[$(this).data('oc')].kcal = isNaN(v) ? null : v;
});
$(document).on('change', '.opt-choice-avail-input', function(){
  apOptionGroups[$(this).data('og')].choices[$(this).data('oc')].available = this.checked;
});
$(document).on('change', '.opt-choice-default-input', function(){
  const gi = $(this).data('og');
  const group = apOptionGroups[gi];
  if(group.type !== 'multi'){
    // Single-select: only one choice can be the default — re-render
    // so the other checkboxes visibly clear too.
    group.choices.forEach(c => { c.default = false; });
    if(this.checked) group.choices[$(this).data('oc')].default = true;
    renderOptionGroupsBuilder();
  } else {
    group.choices[$(this).data('oc')].default = this.checked;
  }
});

$(document).on('change', '#apCategory', function(){
  const cat = $(this).val();
  const existing = adminEditingId ? PRODUCTS.find(x => x.id === adminEditingId) : null;
  toggleFoodFields(cat);
  renderSizePriceRows(cat, existing);
});

$(document).on('change', '.size-toggle-input', function(){
  const checked = this.checked;
  $(this).closest('.size-stock-checkbox').toggleClass('checked', checked);
  $(this).closest('.size-stock-row').find('.size-stock-input').prop('disabled', !checked);
});

$(document).on('wheel', '#apPrice, #apStock, .size-stock-input, .size-price-input, .opt-group-max-input, .opt-choice-price-input, .opt-choice-kcal-input', function(){
  $(this).blur();
});

/* Delete: confirm, then remove from Firestore and the in-memory list */
$(document).on('click', '[data-admin-delete]', async function(){
  const id = $(this).data('admin-delete');
  const p = PRODUCTS.find(x => x.id === id);
  if(!p) return;
  if(!window.confirm(`Delete "${p.name}"? This can't be undone.`)) return;

  try{
    await window.CCProducts.deleteProduct(id);
    PRODUCTS = PRODUCTS.filter(x => x.id !== id);
    renderAdminProductsTable();
    renderAdminOverviewStats();
    renderMenuPage();
    renderMerchPage();
    buildComboProducts();
    renderFeaturedCombos();
    showToast(`Deleted "${p.name}".`, 'success');
  } catch(err){
    console.error(err);
    showToast('Could not delete product. Please try again.', 'error');
  }
});

function setImagePreview(imgId, placeholderId, url){
  if(url){
    $('#' + imgId).attr('src', url).show();
    $('#' + placeholderId).hide();
  } else {
    $('#' + imgId).attr('src', '').hide();
    $('#' + placeholderId).show();
  }
}

async function handleAdminImageUpload(file, { urlFieldId, imgId, placeholderId, statusId, folder, fileId }){
  const $status = $('#' + statusId);
  if(!file.type.startsWith('image/')){
    $status.text('Please choose an image file.').addClass('image-upload-error');
    return;
  }
  $status.text('Processing image...').removeClass('image-upload-error');
  try{
    const blob = await window.CCImages.resizeImageToSquare(file);
    setImagePreview(imgId, placeholderId, URL.createObjectURL(blob));
    $status.text('Uploading...');
    const url = await window.CCImages.uploadImage(blob, folder, fileId);
    $('#' + urlFieldId).val(url);
    $status.text('Uploaded — 1000×1000, ready to save.');
  } catch(err){
    console.error(err);
    const msg = err.message === 'cloudinary-not-configured'
      ? 'Image upload isn\'t set up yet — add your Cloudinary cloud name and upload preset in image-upload-service.js. You can paste an image URL below in the meantime.'
      : 'Upload failed. Please try again, or paste an image URL instead.';
    $status.text(msg).addClass('image-upload-error');
  }
}

$(document).on('change', '#apImgFile', function(){
  const file = this.files[0];
  if(!file) return;
  handleAdminImageUpload(file, {
    urlFieldId: 'apImg', imgId: 'apImgPreviewImg', placeholderId: 'apImgPreviewPlaceholder',
    statusId: 'apImgUploadStatus', folder: 'products',
    fileId: adminEditingId || ('admin-' + Date.now())
  });
});

$(document).on('change', '#acImgFile', function(){
  const file = this.files[0];
  if(!file) return;
  handleAdminImageUpload(file, {
    urlFieldId: 'acImg', imgId: 'acImgPreviewImg', placeholderId: 'acImgPreviewPlaceholder',
    statusId: 'acImgUploadStatus', folder: 'combos',
    fileId: adminEditingComboId || ('admin-' + Date.now())
  });
});

/* ================= ADD / EDIT PRODUCT FORM ================= */
$(document).on('submit', '#adminAddProductForm', async function(e){
  e.preventDefault();
  const $btn = $('#adminFormSubmitBtn');
  const cat = $('#apCategory').val();
  const name = $('#apName').val().trim();
  const desc = $('#apDesc').val().trim();
  const imgInput = $('#apImg').val().trim();
  const img = imgInput || blankPlaceholder((adminEditingId || 'admin-' + Date.now()), cat);

  const isStockSized = Object.prototype.hasOwnProperty.call(DEFAULT_SIZES_BY_CATEGORY, cat);
  const isPriceSized = DRINK_CATEGORIES.includes(cat);
  let price, sizes, stock;

  if(isStockSized){
    sizes = $('#apSizeRows .size-stock-row').map(function(){
      const $chk = $(this).find('.size-toggle-input');
      if(!$chk.prop('checked')) return null;
      const stockVal = parseInt($(this).find('.size-stock-input').val(), 10);
      return { size: $chk.val(), stock: isNaN(stockVal) ? 0 : stockVal };
    }).get().filter(Boolean);
    if(!sizes.length){
      showToast('Select at least one size.', 'warning');
      return;
    }
    price = Number($('#apPrice').val());

    stock = sizes.reduce((sum, s) => sum + s.stock, 0);
  } else if(isPriceSized){
    sizes = $('#apDrinkSizeRows .size-price-input').map(function(){
      return { size: $(this).data('size'), price: Number($(this).val()) || 0 };
    }).get();
    if(!sizes.length){
      showToast('Add a price for at least one size.', 'warning');
      return;
    }
    // The flat top-level `price` mirrors the cheapest size, same as
    // wearables — used by the admin table and anywhere a single
    // number is needed before a size is picked.
    price = Math.min(...sizes.map(s => s.price));
    const stockVal = parseInt($('#apStock').val(), 10);
    stock = isNaN(stockVal) ? 0 : stockVal;
  } else {
    price = Number($('#apPrice').val());
    const stockVal = parseInt($('#apStock').val(), 10);
    stock = isNaN(stockVal) ? 0 : stockVal;
  }

  const isFood = FOOD_CATEGORIES.includes(cat);
  const fields = {
    name, cat, price, desc,
    img, imgs: [img],
    stock,
  };
  if(isStockSized || isPriceSized) fields.sizes = sizes;
  if(isFood){
    fields.ingredients = $('#apIngredients').val().trim() || 'Details coming soon.';
    fields.allergens = $('#apAllergens').val().trim() || 'Please ask our staff for full allergen details.';
  }
  // Drop groups with no label and choices with no label — an admin
  // clicking "+ Add Option Group" then changing their mind shouldn't
  // save a half-empty group. A group left with zero real choices
  // after that cleanup is dropped entirely too.
  const cleanedOptionGroups = isPriceSized
    ? apOptionGroups
        .filter(g => g.label && g.label.trim())
        .map(g => ({
          id: g.id, label: g.label.trim(), type: g.type === 'multi' ? 'multi' : 'single',
          max: g.type === 'multi' && g.max ? g.max : null,
          choices: g.choices
            .filter(c => c.label && c.label.trim())
            .map(c => ({
              id: c.id, label: c.label.trim(), price: c.price || 0,
              kcal: c.kcal || null, available: c.available !== false, default: !!c.default
            }))
        }))
        .filter(g => g.choices.length)
    : [];
  if(isPriceSized && cleanedOptionGroups.length) fields.optionGroups = cleanedOptionGroups;

  // Calories/About/Nutrition — drinks only, and each piece only gets
  // written if the admin actually filled it in (an empty number input
  // stays out of `fields` entirely rather than saving 0/null, same
  // spirit as cleanedOptionGroups above dropping empty groups).
  if(isPriceSized){
    const caloriesVal = parseInt($('#apCalories').val(), 10);
    if(!isNaN(caloriesVal)) fields.calories = caloriesVal;

    const aboutVal = $('#apAboutText').val().trim();
    if(aboutVal) fields.aboutText = aboutVal;

    const nutrition = {};
    const servingVal = $('#apNutServing').val().trim();
    if(servingVal) nutrition.servingSize = servingVal;
    [['apNutCarbs','carbs'], ['apNutSugar','sugar'], ['apNutProtein','protein'], ['apNutFat','fat'], ['apNutSodium','sodium']].forEach(([inputId, key]) => {
      const v = parseFloat($('#' + inputId).val());
      if(!isNaN(v)) nutrition[key] = v;
    });
    if(Object.keys(nutrition).length) fields.nutrition = nutrition;
  }

  if(adminEditingId){
    $btn.prop('disabled', true).text('Updating...');
    // updateDoc only ever touches the keys you pass it — leaving
    // ingredients/allergens/sizes out of `fields` above does NOT clear
    // them from Firestore if the product had them before (e.g. it's a
    // merch item that got food fields written to it before category-
    // aware saving existed, or it's moving from a sized category to a
    // non-sized one). Any such leftover fields get explicitly deleted
    // here instead.
    const prevProduct = PRODUCTS.find(x => x.id === adminEditingId);
    const fieldsToDelete = [];
    if(prevProduct){
      if(!isFood && prevProduct.ingredients !== undefined) fieldsToDelete.push('ingredients');
      if(!isFood && prevProduct.allergens !== undefined) fieldsToDelete.push('allergens');
      if(!isStockSized && !isPriceSized && prevProduct.sizes !== undefined) fieldsToDelete.push('sizes');
      if(!fields.optionGroups && prevProduct.optionGroups !== undefined) fieldsToDelete.push('optionGroups');
      if(!fields.calories && fields.calories !== 0 && prevProduct.calories !== undefined) fieldsToDelete.push('calories');
      if(!fields.aboutText && prevProduct.aboutText !== undefined) fieldsToDelete.push('aboutText');
      if(!fields.nutrition && prevProduct.nutrition !== undefined) fieldsToDelete.push('nutrition');
    }
    try{
      await window.CCProducts.updateProduct(adminEditingId, fields, fieldsToDelete);
      const idx = PRODUCTS.findIndex(x => x.id === adminEditingId);
      if(idx > -1){
        const merged = { id: adminEditingId, ...prevProduct, ...fields };
        fieldsToDelete.forEach(f => delete merged[f]);
        PRODUCTS[idx] = merged;
      }
      showToast(`Updated "${name}".`, 'success');
      resetAdminProductForm();
      renderAdminProductsTable();
      renderMenuPage();
      renderMerchPage();
      buildComboProducts();
      renderFeaturedCombos();
      goToProductsSubtab('catalog');
    } catch(err){
      console.error(err);
      showToast('Could not update product. Please try again.', 'error');
    } finally {
      $btn.prop('disabled', false).text('Update Product');
    }
    return;
  }

  // Only set on creation, never on edit — this is what "Newest" sorting
  // on the Menu/Merchandise pages orders by (script.js's sortProducts).
  // Older seed-catalog products don't have this field at all and just
  // sort to the end of "Newest" rather than crashing anything.
  fields.createdAt = new Date().toISOString();

  $btn.prop('disabled', true).text('Adding...');
  try{
    const newId = await window.CCProducts.addProduct(fields);
    PRODUCTS.push({ id: newId, ...fields });
    showToast(`Added "${name}" to inventory.`, 'success');
    resetAdminProductForm();
    renderAdminProductsTable();
    renderAdminOverviewStats();
    renderMenuPage();
    renderMerchPage();
    buildComboProducts();
    renderFeaturedCombos();
  } catch(err){
    console.error(err);
    showToast('Could not add product. Please try again.', 'error');
  } finally {
    $btn.prop('disabled', false).text('Add Product');
  }
});

/* ================= ORDERS TABLE ================= */
async function loadAndRenderAdminOrders(){
  $('#adminOrdersBody').html(`<tr><td colspan="6" class="admin-empty-row">Loading orders...</td></tr>`);
  try{
    ADMIN_ORDERS = await window.CCOrders.fetchAllOrders();
  } catch(err){
    console.error(err);
    $('#adminOrdersBody').html(`<tr><td colspan="6" class="admin-empty-row">Could not load orders. Please try refreshing.</td></tr>`);
    return;
  }
  renderOrderStatusFilters();
  renderAdminOrdersTable();
  renderAdminOverviewStats();
}

const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

/* How long a pending order can sit before the table flags it —
   pending is the one status where every extra minute is a customer
   waiting to hear back, so it's the only one worth calling out. */
const ORDER_STALE_MINUTES = 15;

let adminOrderStatusFilter = 'all'; // 'all' | one of ORDER_STATUSES
let adminOrderSearch = '';          // current text in the orders search box

function orderTimestampMs(val){
  if(!val) return null;
  if(typeof val.seconds === 'number') return val.seconds * 1000;
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? null : parsed;
}

function isOrderStale(order){
  const status = order.status || 'pending';
  if(status !== 'pending') return false;
  const ms = orderTimestampMs(order.createdAt);
  if(ms === null) return false;
  return (Date.now() - ms) > ORDER_STALE_MINUTES * 60 * 1000;
}

/* Builds the All/Pending/Preparing/.../Cancelled pill row, each with
   a live count so the admin can tell at a glance how many orders
   need attention without opening every filter. Re-run any time
   ADMIN_ORDERS changes (load, refresh, or a status update) so counts
   never go stale. */
function renderOrderStatusFilters(){
  const counts = { all: ADMIN_ORDERS.length };
  ORDER_STATUSES.forEach(s => { counts[s] = 0; });
  ADMIN_ORDERS.forEach(o => {
    const s = o.status || 'pending';
    if(counts[s] !== undefined) counts[s]++;
  });

  const filters = ['all', ...ORDER_STATUSES];
  const html = filters.map(f => {
    const label = f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1);
    return `
      <button type="button" class="order-filter-pill${f === adminOrderStatusFilter ? ' active' : ''}" data-order-filter="${f}">
        ${label} <span class="order-filter-count">${counts[f] || 0}</span>
      </button>
    `;
  }).join('');
  $('#orderStatusFilters').html(html);
}

$(document).on('click', '[data-order-filter]', function(){
  adminOrderStatusFilter = $(this).data('order-filter');
  $('.order-filter-pill').removeClass('active');
  $(this).addClass('active');
  renderAdminOrdersTable();
});

$(document).on('input', '#adminOrderSearch', function(){
  adminOrderSearch = $(this).val().trim().toLowerCase();
  renderAdminOrdersTable();
});

/* Applies the active status pill + search box to ADMIN_ORDERS.
   Search matches the order's short id, customer name, phone, or
   email — whichever the admin is most likely to have on hand when a
   customer calls in asking about their order. */
function getFilteredOrders(){
  let list = ADMIN_ORDERS;
  if(adminOrderStatusFilter !== 'all'){
    list = list.filter(o => (o.status || 'pending') === adminOrderStatusFilter);
  }
  if(adminOrderSearch){
    list = list.filter(o => {
      const c = o.customer || {};
      const haystack = [
        o.id.slice(0, 6),
        c.name, c.phone, c.email
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(adminOrderSearch);
    });
  }
  return list;
}

function renderAdminOrdersTable(){
  if(!ADMIN_ORDERS.length){
    $('#adminOrdersBody').html(`<tr><td colspan="6" class="admin-empty-row">No orders yet.</td></tr>`);
    return;
  }
  const filtered = getFilteredOrders();
  if(!filtered.length){
    const msg = adminOrderSearch
      ? 'No orders match your search.'
      : `No ${adminOrderStatusFilter} orders.`;
    $('#adminOrdersBody').html(`<tr><td colspan="6" class="admin-empty-row">${msg}</td></tr>`);
    return;
  }
  const rows = filtered.map((o, i) => {
    const status = o.status || 'pending';
    const options = ORDER_STATUSES.map(s => `<option value="${s}" ${s === status ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('');
    const stale = isOrderStale(o);
    return `
      <tr style="--i:${i}"${stale ? ' class="admin-order-row-stale"' : ''}>
        <td>#${o.id.slice(0,6).toUpperCase()}</td>
        <td class="admin-order-placed">${formatOrderTimestamp(o.createdAt)}${stale ? `<span class="admin-order-stale-flag" title="Pending for over ${ORDER_STALE_MINUTES} minutes">⚠</span>` : ''}</td>
        <td><button class="admin-customer-link" data-order-view="${o.id}">${o.customer?.name || 'Guest'}</button></td>
        <td>${o.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}</td>
        <td>${peso(o.totals?.total || 0)}</td>
        <td>
          <select class="admin-status-select admin-status-${status}" data-order-status="${o.id}">
            ${options}
          </select>
        </td>
      </tr>
    `;
  }).join('');
  $('#adminOrdersBody').html(rows);
}

$(document).on('click', '#adminRefreshOrders', loadAndRenderAdminOrders);

/* ================= ORDER DETAIL MODAL ================= */
/* Clicking a customer's name opens the full order — every field
   already captured at checkout (createOrder in orders-service.js):
   items, totals, fulfillment, customer contact/address, payment
   method, current status, and when it was placed. */
function formatOrderTimestamp(val){
  if(!val) return 'Unknown date';
  let ms;
  if(typeof val.seconds === 'number'){
    ms = val.seconds * 1000;
  } else {
    const parsed = new Date(val).getTime();
    ms = isNaN(parsed) ? null : parsed;
  }
  if(ms === null) return 'Unknown date';
  return new Date(ms).toLocaleString('en-PH', { dateStyle:'medium', timeStyle:'short' });
}

function openOrderDetailModal(orderId){
  const order = ADMIN_ORDERS.find(o => o.id === orderId);
  if(!order) return;

  const status = order.status || 'pending';
  const c = order.customer || {};
  const totals = order.totals || {};
  const isDelivery = order.fulfillment === 'delivery';
  const itemCount = (order.items || []).reduce((s, it) => s + (it.qty || 0), 0);

  const itemsHtml = (order.items || []).map(it => `
    <div class="order-detail-item">
      <div>
        <div class="order-detail-item-name">${it.name}${it.size ? ` <span class="cart-dd-size">(${it.size})</span>` : ''}</div>
        ${it.optionsSummary ? `<div class="order-detail-item-opts">${it.optionsSummary}</div>` : ''}
        <div class="order-detail-item-meta">${it.qty} × ${peso(it.price)}</div>
      </div>
      <div class="order-detail-item-total">${peso(it.price * it.qty)}</div>
    </div>
  `).join('') || `<p class="order-detail-empty">No items recorded on this order.</p>`;

  $('#orderDetailTitle').text(`Order #${order.id.slice(0,6).toUpperCase()}`);
  $('#orderDetailSubtitle').html(`
    <span class="order-status-badge admin-status-${status}">${status}</span>
    <span class="order-detail-meta">Placed ${formatOrderTimestamp(order.createdAt)}</span>
  `);

  $('#orderDetailBody').html(`
    <div class="order-detail-section">
      <h4>Customer</h4>
      <div class="order-detail-grid">
        <div class="order-detail-field"><label>Name</label><span>${c.name || 'Guest'}</span></div>
        <div class="order-detail-field"><label>Phone</label><span>${c.phone || '—'}</span></div>
        <div class="order-detail-field"><label>Email</label><span>${c.email || '—'}</span></div>
        <div class="order-detail-field"><label>Fulfillment</label><span>${isDelivery ? 'Delivery' : 'Store Pickup'}</span></div>
        ${isDelivery ? `<div class="order-detail-field order-detail-field-full"><label>Delivery Address</label><span>${c.address || '—'}</span></div>` : ''}
        <div class="order-detail-field"><label>Payment Method</label><span>${order.paymentMethod || '—'}</span></div>
      </div>
    </div>

    <div class="order-detail-section">
      <h4>Items (${itemCount})</h4>
      <div class="order-detail-items">${itemsHtml}</div>
      <div class="order-detail-totals">
        <div class="sum-row"><span>Subtotal</span><span>${peso(totals.subtotal || 0)}</span></div>
        <div class="sum-row"><span>${isDelivery ? 'Delivery fee' : 'Pickup fee'}</span><span>${peso(totals.deliveryFee || 0)}</span></div>
        <div class="sum-row total"><span>Total</span><span>${peso(totals.total || 0)}</span></div>
      </div>
    </div>
  `);

  $('#orderDetailOverlay').addClass('open');
}

function closeOrderDetailModal(){
  $('#orderDetailOverlay').removeClass('open');
}

$(document).on('click', '[data-order-view]', function(){
  openOrderDetailModal($(this).data('order-view'));
});
$(document).on('click', '#orderDetailClose', closeOrderDetailModal);
$(document).on('click', '#orderDetailOverlay', function(e){
  if(e.target === this) closeOrderDetailModal();
});
$(document).on('keydown', function(e){
  if(e.key === 'Escape' && $('#orderDetailOverlay').hasClass('open')) closeOrderDetailModal();
});

$(document).on('change', '[data-order-status]', async function(){
  const orderId = $(this).data('order-status');
  const newStatus = $(this).val();
  const $select = $(this);
  $select.prop('disabled', true);
  try{
    await window.CCOrders.updateOrderStatus(orderId, newStatus);
    const order = ADMIN_ORDERS.find(o => o.id === orderId);
    if(order) order.status = newStatus;
    showToast(`Order #${orderId.slice(0,6).toUpperCase()} marked ${newStatus}.`, 'success');
    renderOrderStatusFilters();
    renderAdminOrdersTable();
    renderAdminOverviewStats();
  } catch(err){
    console.error(err);
    showToast('Could not update order status. Please try again.', 'error');
    $select.prop('disabled', false);
  }
});

/* Sync the Ingredients/Allergens vs Sizes-and-Prices fields to whatever
   category is selected by default (the form's first <option>) on first
   load, before anyone has touched the Category dropdown. */
$(function(){
  toggleFoodFields($('#apCategory').val());
  renderSizePriceRows($('#apCategory').val(), null);
});

/* ================= SEED STARTER CATALOG ================= */
$(document).on('click', '#adminSeedBtn', async function(){
  const $btn = $(this);
  const $status = $('#adminSeedStatus');
  $btn.prop('disabled', true).text('Seeding...');
  $status.text('Pushing starter catalog to Firestore — this can take a moment.');
  try{
    await window.CCProducts.seedProducts(SEED_PRODUCTS);
    await loadProductsFromFirestore();
    renderCategories();
    renderBestSellers();
    renderMenuPage();
    renderMerchPage();
    buildComboProducts();
    renderFeaturedCombos();
    renderAdminProductsTable();
    renderAdminOverviewStats();
    $status.text(`Done — ${SEED_PRODUCTS.length} products are now in Firestore.`);
  } catch(err){
    console.error(err);
    $status.text('Something went wrong while seeding. Check the console for details.');
  } finally {
    $btn.prop('disabled', false).text('Seed Starter Catalog');
  }
});

/* ================= CLEAN UP LEGACY FOOD FIELDS ================= */
/* Strips Ingredients/Allergens off any non-food (merch) product that
   still has them — leftover from before the admin form limited those
   fields to food categories. See the comment on
   CCProducts.cleanupLegacyFoodFields for why this has to walk every
   product instead of only fixing the ones re-saved through the form. */
$(document).on('click', '#adminCleanupFieldsBtn', async function(){
  const $btn = $(this);
  const $status = $('#adminCleanupStatus');
  $btn.prop('disabled', true).text('Cleaning...');
  $status.text('Scanning products for stray Ingredients/Allergens fields...');
  try{
    const cleanedIds = await window.CCProducts.cleanupLegacyFoodFields(FOOD_CATEGORIES);
    await loadProductsFromFirestore();
    renderMenuPage();
    renderMerchPage();
    buildComboProducts();
    renderFeaturedCombos();
    renderAdminProductsTable();
    renderAdminOverviewStats();
    $status.text(cleanedIds.length
      ? `Done — removed Ingredients/Allergens from ${cleanedIds.length} product${cleanedIds.length === 1 ? '' : 's'}: ${cleanedIds.join(', ')}.`
      : 'Done — no merch products had leftover Ingredients/Allergens fields.');
  } catch(err){
    console.error(err);
    $status.text('Something went wrong while cleaning up. Check the console for details.');
  } finally {
    $btn.prop('disabled', false).text('Clean Up Legacy Fields');
  }
});

/* ================= FLATTEN LEGACY PER-SIZE PRICING ================= */
/* Some Shirts/Caps/Shorts/Socks products may still carry old per-size
   pricing (a `sizes` array of {size, price} objects with different
   prices per size) from before per-size pricing was reverted. This
   rewrites every such product to the flat, single-price model: each
   size becomes a plain string and the product's one Price field
   applies to all of them. See CCProducts.flattenSizePricing for how
   the flat price is chosen. SIZED_CATEGORIES comes from script.js,
   loaded before this file. */
$(document).on('click', '#adminGraduatePricingBtn', async function(){
  const $btn = $(this);
  const $status = $('#adminGraduatePricingStatus');
  $btn.prop('disabled', true).text('Updating...');
  $status.text('Scanning Shirts/Caps/Shorts/Socks for old per-size pricing...');
  try{
    const updatedIds = await window.CCProducts.flattenSizePricing(SIZED_CATEGORIES);
    await loadProductsFromFirestore();
    renderCategories();
    renderBestSellers();
    renderMenuPage();
    renderMerchPage();
    buildComboProducts();
    renderFeaturedCombos();
    renderAdminProductsTable();
    renderAdminOverviewStats();
    $status.text(updatedIds.length
      ? `Done — flattened per-size pricing on ${updatedIds.length} product${updatedIds.length === 1 ? '' : 's'}: ${updatedIds.join(', ')}.`
      : 'Done — every sized product already has flat pricing.');
  } catch(err){
    console.error(err);
    $status.text('Something went wrong while updating. Check the console for details.');
  } finally {
    $btn.prop('disabled', false).text('Flatten Per-Size Pricing');
  }
});

/* ================= NORMALIZE DRINK SIZES ================= */
/* Rewrites every Coffee/Non-Coffee/Tea product onto exactly three
   selectable sizes — 16oz, 20oz, 24oz — so the size selector on the
   product page always has something real to show, no matter what
   state that drink's `sizes` array was previously in. See
   CCProducts.normalizeDrinkSizes for how the new prices are derived
   from whatever the drink was already charging. */
$(document).on('click', '#adminNormalizeSizesBtn', async function(){
  const $btn = $(this);
  const $status = $('#adminNormalizeSizesStatus');
  $btn.prop('disabled', true).text('Fixing...');
  $status.text('Scanning Coffee/Non-Coffee/Tea drinks for their size options...');
  try{
    const updatedIds = await window.CCProducts.normalizeDrinkSizes(DRINK_CATEGORIES);
    await loadProductsFromFirestore();
    renderMenuPage();
    renderAdminProductsTable();
    renderAdminOverviewStats();
    $status.text(updatedIds.length
      ? `Done — fixed sizes on ${updatedIds.length} drink${updatedIds.length === 1 ? '' : 's'}: ${updatedIds.join(', ')}.`
      : 'Done — every drink already has 16oz/20oz/24oz sizes.');
  } catch(err){
    console.error(err);
    $status.text('Something went wrong while fixing sizes. Check the console for details.');
  } finally {
    $btn.prop('disabled', false).text('Fix Drink Sizes (16/20/24oz)');
  }
});

/* ================= FILL IN DRINK CUSTOMIZATIONS ================= */
/* Fills in whatever Coffee/Non-Coffee/Tea drink is still missing its
   option groups (Sweetness Level, Ice Level, and Milk Type when the
   drink contains milk), calories, about text, or nutrition — without
   touching any of those fields on a drink that already has them. See
   CCProducts.fillMissingDrinkDetails for exactly what gets generated
   and why nothing already-filled-in is ever overwritten. Everything
   it adds shows up as normal, editable fields on that drink's Edit
   form afterward (the Option Groups Builder, and the Calories/About/
   Nutrition inputs) — this is just a starting point, not a lock-in. */
$(document).on('click', '#adminFillDrinkDetailsBtn', async function(){
  const $btn = $(this);
  const $status = $('#adminFillDrinkDetailsStatus');
  $btn.prop('disabled', true).text('Filling...');
  $status.text('Scanning Coffee/Non-Coffee/Tea drinks for missing customization details...');
  try{
    const updatedIds = await window.CCProducts.fillMissingDrinkDetails(DRINK_CATEGORIES);
    await loadProductsFromFirestore();
    renderMenuPage();
    renderAdminProductsTable();
    renderAdminOverviewStats();
    $status.text(updatedIds.length
      ? `Done — filled in details on ${updatedIds.length} drink${updatedIds.length === 1 ? '' : 's'}: ${updatedIds.join(', ')}. Open any of them with Edit to adjust.`
      : 'Done — every drink already has its customization details filled in.');
  } catch(err){
    console.error(err);
    $status.text('Something went wrong while filling in details. Check the console for details.');
  } finally {
    $btn.prop('disabled', false).text('Fill In Drink Customizations');
  }
});

/* ================= SETTINGS ================= */
/* Populates the delivery fee input from Firestore each time the
   dashboard is (re)rendered, e.g. on navigating to the Admin page. */
async function loadAndRenderAdminSettings(){
  try{
    const settings = await window.CCSettings.fetchSettings();
    DELIVERY_FEE = settings.deliveryFee;
    $('#asDeliveryFee').val(settings.deliveryFee);
  } catch(err){
    console.error('Could not load settings from Firestore.', err);
    // Fall back to whatever's cached (or the built-in default) so the
    // field isn't left blank if the fetch above failed.
    $('#asDeliveryFee').val(DELIVERY_FEE);
  }
}

$(document).on('submit', '#adminSettingsForm', async function(e){
  e.preventDefault();
  const fee = parseFloat($('#asDeliveryFee').val());
  if(isNaN(fee) || fee < 0){
    $('#adminSettingsStatus').text('Enter a valid, non-negative delivery fee.');
    return;
  }
  const $btn = $('#adminSettingsSubmitBtn');
  const $status = $('#adminSettingsStatus');
  $btn.prop('disabled', true).text('Saving...');
  $status.text('');
  try{
    await window.CCSettings.updateDeliveryFee(fee);
    // Update the in-memory value script.js reads at checkout, so the
    // new fee takes effect immediately without a page reload.
    DELIVERY_FEE = fee;
    $status.text('Saved — new orders will use this delivery fee.');
  } catch(err){
    console.error(err);
    $status.text('Something went wrong while saving. Check the console for details.');
  } finally {
    $btn.prop('disabled', false).text('Save Delivery Fee');
  }
});

/* ================= LAUNCH POPUP ================= */
const PROMO_PICK_LIMIT = 3;

/* Source of truth for the manual product picks — kept separate from
   the checkbox DOM because the list gets re-rendered on every search
   keystroke (only showing whatever matches), so a checked box that
   scrolls out of view or gets filtered out would otherwise "forget"
   its checked state. Selected ids persist here regardless of what
   the search box currently shows. */
let promoPickedIds = [];

/* Reuses the same grouped-optgroup builder the product/category
   dropdowns use elsewhere, so this stays in sync with custom
   categories automatically. */
function renderPromoCategorySelect(){
  const $sel = $('#ppCategory');
  const prev = $sel.val();
  $sel.html(`<option value="">— None —</option>${buildCategoryOptgroupsHtml()}`);
  if(prev) $sel.val(prev);
}

/* The "you've picked these" row, shown above the search box so the
   admin never has to scroll/search to see what's currently selected —
   each chip removes itself with one click. */
function renderPromoSelectedChips(){
  const $chips = $('#ppSelectedChips');
  if(!promoPickedIds.length){ $chips.empty(); return; }
  $chips.html(promoPickedIds.map(id => {
    const p = PRODUCTS.find(x => x.id === id);
    const name = p ? p.name : id;
    return `
      <span class="promo-pick-chip">
        <span class="promo-pick-chip-name">${name}</span>
        <button type="button" data-promo-unpick="${id}" aria-label="Remove ${name}">×</button>
      </span>`;
  }).join(''));
}

/* Filters by name as the admin types, instead of one long scrolling
   list of the entire catalog — the whole point being it's now fast
   to find one specific product instead of hunting through everything. */
function renderPromoProductList(searchTerm){
  const $list = $('#ppProductList');
  if(!PRODUCTS.length){
    $list.html('<p class="form-hint" style="margin:4px;">No products yet — add some from the Catalog tab first.</p>');
    return;
  }
  const term = (searchTerm || '').trim().toLowerCase();
  const filtered = term ? PRODUCTS.filter(p => p.name.toLowerCase().includes(term)) : PRODUCTS;
  if(!filtered.length){
    $list.html('<p class="form-hint" style="margin:4px;">No products match that search.</p>');
    return;
  }
  $list.html(filtered.map(p => {
    const thumb = (p.imgs && p.imgs[0]) || p.img || blankPlaceholder(p.id, p.cat);
    const checked = promoPickedIds.includes(p.id) ? 'checked' : '';
    return `
      <label class="promo-pick-row">
        <input type="checkbox" value="${p.id}" data-promo-pick ${checked}>
        <img src="${thumb}" alt="">
        <span class="promo-pick-row-name">${p.name}</span>
        <span class="promo-pick-row-price">${priceLabel(p)}</span>
      </label>`;
  }).join(''));
  updatePromoPickLimit();
}

/* Disables the remaining unchecked boxes once 3 are picked, rather
   than only catching it as a submit-time error — immediate feedback
   for a limit tied directly to how many cards the 3D stage lays out. */
function updatePromoPickLimit(){
  const count = promoPickedIds.length;
  $('#ppPickCount').text(count ? `(${count}/${PROMO_PICK_LIMIT} selected)` : '');
  $('[data-promo-pick]').each(function(){
    const isChecked = promoPickedIds.includes(this.value);
    $(this).closest('.promo-pick-row').toggleClass('disabled', !isChecked && count >= PROMO_PICK_LIMIT);
  });
}

$(document).on('change', '[data-promo-pick]', function(){
  const id = this.value;
  if(this.checked){
    if(promoPickedIds.length >= PROMO_PICK_LIMIT){ this.checked = false; return; }
    promoPickedIds.push(id);
  } else {
    promoPickedIds = promoPickedIds.filter(x => x !== id);
  }
  renderPromoSelectedChips();
  updatePromoPickLimit();
});

$(document).on('click', '[data-promo-unpick]', function(){
  const id = $(this).attr('data-promo-unpick');
  promoPickedIds = promoPickedIds.filter(x => x !== id);
  // Uncheck the box too, in case it's currently visible under the
  // active search term.
  $(`[data-promo-pick][value="${id}"]`).prop('checked', false);
  renderPromoSelectedChips();
  updatePromoPickLimit();
});

$(document).on('input', '#ppProductSearch', function(){
  renderPromoProductList($(this).val());
});

async function loadAndRenderAdminPromo(){
  renderPromoCategorySelect();
  $('#ppProductSearch').val('');
  try{
    const settings = await window.CCSettings.fetchSettings();
    const cfg = settings.promoPopup || window.CCSettings.DEFAULT_PROMO_POPUP;
    $('#ppEnabled').prop('checked', cfg.enabled !== false);
    $('#ppBadgeText').val(cfg.badgeText || 'New');
    $('#ppEyebrow').val(cfg.eyebrow || 'Just Dropped');
    $('#ppHeadline').val((cfg.headline || '').replace(/<br\s*\/?>/gi, '\n'));
    $('#ppCopy').val(cfg.copy || '');
    $('#ppCtaText').val(cfg.ctaText || 'Take a Look');
    $('#ppDismissText').val(cfg.dismissText || 'Maybe later');
    $('#ppCategory').val(cfg.category || '');
    $('#ppSortMode').val(cfg.sortMode || 'featured');
    promoPickedIds = (cfg.productIds || []).slice(0, PROMO_PICK_LIMIT);
    renderPromoSelectedChips();
    renderPromoProductList('');
  } catch(err){
    console.error('Could not load popup settings from Firestore.', err);
    promoPickedIds = [];
    renderPromoSelectedChips();
    renderPromoProductList('');
  }
}

$(document).on('submit', '#adminPromoForm', async function(e){
  e.preventDefault();
  const productIds = promoPickedIds.slice(0, PROMO_PICK_LIMIT);
  const promoPopup = {
    enabled: $('#ppEnabled').prop('checked'),
    badgeText: $('#ppBadgeText').val().trim() || 'New',
    eyebrow: $('#ppEyebrow').val().trim(),
    headline: $('#ppHeadline').val().trim().replace(/\n/g, '<br>'),
    copy: $('#ppCopy').val().trim(),
    ctaText: $('#ppCtaText').val().trim() || 'Take a Look',
    dismissText: $('#ppDismissText').val().trim() || 'Maybe later',
    category: $('#ppCategory').val(),
    sortMode: $('#ppSortMode').val(),
    productIds
  };

  const $btn = $('#adminPromoSubmitBtn');
  const $status = $('#adminPromoStatus');
  $btn.prop('disabled', true).text('Saving...');
  $status.text('');
  try{
    await window.CCSettings.updatePromoPopup(promoPopup);
    // Update the in-memory config script.js reads when it decides
    // whether/what to show, so a freshly-saved popup takes effect on
    // this browser's very next fresh session without a redeploy.
    PROMO_POPUP_CONFIG = { ...PROMO_POPUP_DEFAULTS, ...promoPopup };
    $status.text('Saved — visitors will see this the next time the popup shows.');
  } catch(err){
    console.error(err);
    $status.text('Something went wrong while saving. Check the console for details.');
  } finally {
    $btn.prop('disabled', false).text('Save Popup Settings');
  }
});

/* Reads the form exactly as Save would, but skips Firestore entirely
   and renders straight into the isolated #promoPreviewOverlay — so
   the admin can check copy/layout/product picks before committing,
   and so mid-edit previewing never marks the real popup "seen" for
   this browser or saves anything half-finished. */
function buildPromoPreviewConfig(){
  return {
    badgeText: $('#ppBadgeText').val().trim() || 'New',
    eyebrow: $('#ppEyebrow').val().trim(),
    headline: $('#ppHeadline').val().trim().replace(/\n/g, '<br>'),
    copy: $('#ppCopy').val().trim(),
    ctaText: $('#ppCtaText').val().trim() || 'Take a Look',
    dismissText: $('#ppDismissText').val().trim() || 'Maybe later',
    category: $('#ppCategory').val(),
    sortMode: $('#ppSortMode').val(),
    productIds: promoPickedIds.slice(0, PROMO_PICK_LIMIT)
  };
}

function showPromoPopupPreview(){
  const cfg = buildPromoPreviewConfig();
  const products = resolvePromoProducts(cfg);
  applyPromoPopupContent(cfg, products, {
    badge: '#promoPreviewBadgeText', eyebrow: '#promoPreviewEyebrow', title: '#promoPreviewModalTitle',
    copy: '#promoPreviewModalCopy', cta: '#promoPreviewModalCta', dismiss: '#promoPreviewModalDismiss',
    stage: '#promoPreviewStage', cards: '#promoPreviewStageCards'
  });
  $('#promoPreviewOverlay').addClass('open');
}

function closePromoPopupPreview(){
  $('#promoPreviewOverlay').removeClass('open');
}

$(document).on('click', '#adminPromoPreviewBtn', function(e){
  e.preventDefault(); // lives inside the <form> — don't let it submit/save
  showPromoPopupPreview();
});
$(document).on('click', '#promoPreviewModalClose, #promoPreviewModalDismiss, #promoPreviewModalCta', closePromoPopupPreview);
$(document).on('click', '#promoPreviewOverlay', function(e){
  if(e.target === this) closePromoPopupPreview();
});
$(document).on('keydown', function(e){
  if(e.key === 'Escape' && $('#promoPreviewOverlay').hasClass('open')) closePromoPopupPreview();
});

/* ================= COMBOS ================= */
let adminEditingComboId = null; // set while editing an existing combo, null when adding a new one
const PASTRY_CATEGORY = 'Pastries';

/* Drink/Pastry dropdowns are rebuilt from the current PRODUCTS list
   every time the Combos tab is rendered, so a product added/renamed
   elsewhere in the admin always shows up here without a page reload.
   Whatever was previously selected is restored by value so editing a
   combo doesn't lose the current selection mid-rebuild. */
function renderComboProductDropdowns(){
  const drinks = PRODUCTS.filter(p => DRINK_CATEGORIES.includes(p.cat));
  const pastries = PRODUCTS.filter(p => p.cat === PASTRY_CATEGORY);
  const prevDrink = $('#acDrink').val();
  const prevPastry = $('#acPastry').val();
  $('#acDrink').html(drinks.length
    ? drinks.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
    : '<option value="" disabled>No drinks in the catalog yet</option>');
  $('#acPastry').html(pastries.length
    ? pastries.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
    : '<option value="" disabled>No pastries in the catalog yet</option>');
  if(prevDrink) $('#acDrink').val(prevDrink);
  if(prevPastry) $('#acPastry').val(prevPastry);
}

async function loadAndRenderAdminCombos(){
  renderComboProductDropdowns();
  $('#adminCombosBody').html(`<tr><td colspan="6" class="admin-empty-row">Loading combos...</td></tr>`);
  try{
    COMBOS = await window.CCCombos.fetchAllCombos();
  } catch(err){
    console.error(err);
    $('#adminCombosBody').html(`<tr><td colspan="6" class="admin-empty-row">Could not load combos. Please try refreshing.</td></tr>`);
    return;
  }
  buildComboProducts();
  renderFeaturedCombos();
  renderAdminCombosTable();
}

function renderAdminCombosTable(){
  if(!COMBOS.length){
    $('#adminCombosBody').html(`<tr><td colspan="6" class="admin-empty-row">No combos yet — add one below.</td></tr>`);
    return;
  }
  const rows = COMBOS.map(c => {
    const drink = PRODUCTS.find(p => p.id === c.drinkId);
    const pastry = PRODUCTS.find(p => p.id === c.pastryId);
    const broken = !drink || !pastry;
    return `
      <tr data-combo-row="${c.id}">
        <td class="admin-td-product">
          <div class="admin-td-product-inner">
            <img src="${c.img || blankPlaceholder(c.id, 'Combo')}" alt="${c.name}">
            <span>${c.name}</span>
          </div>
        </td>
        <td>${drink ? drink.name : '<span class="admin-stock-badge admin-stock-out">Missing</span>'}</td>
        <td>${pastry ? pastry.name : '<span class="admin-stock-badge admin-stock-out">Missing</span>'}</td>
        <td>${Number(c.discountPercent) || 0}%</td>
        <td>
          ${broken
            ? '<span class="admin-stock-badge admin-stock-out">Broken link</span>'
            : c.active
              ? '<span class="admin-stock-badge admin-stock-ok">Active</span>'
              : '<span class="admin-stock-badge admin-stock-unknown">Inactive</span>'}
        </td>
        <td class="admin-td-actions">
          <button class="admin-icon-btn" data-admin-combo-toggle="${c.id}" title="${c.active ? 'Deactivate' : 'Activate'}" aria-label="${c.active ? 'Deactivate' : 'Activate'} ${c.name}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>${c.active ? '' : '<path d="M12 5v14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'}</svg>
          </button>
          <button class="admin-icon-btn" data-admin-combo-edit="${c.id}" title="Edit" aria-label="Edit ${c.name}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20l1-4L16.5 4.5a1.5 1.5 0 0 1 2 0l1 1a1.5 1.5 0 0 1 0 2L8 19l-4 1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
          </button>
          <button class="admin-icon-btn admin-icon-btn-danger" data-admin-combo-delete="${c.id}" title="Delete" aria-label="Delete ${c.name}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
  $('#adminCombosBody').html(rows);
}

function resetAdminComboForm(){
  adminEditingComboId = null;
  $('#adminAddComboForm')[0].reset();
  $('#acEditId').val('');
  $('#adminComboFormHeading').text('Add Combo');
  $('#adminComboFormSubmitBtn').text('Add Combo');
  $('#adminComboCancelEditBtn').hide();
  setImagePreview('acImgPreviewImg', 'acImgPreviewPlaceholder', '');
  $('#acImgUploadStatus').text('').removeClass('image-upload-error');
}

$(document).on('click', '[data-admin-combo-edit]', function(){
  const id = $(this).data('admin-combo-edit');
  const c = COMBOS.find(x => x.id === id);
  if(!c) return;
  adminEditingComboId = id;
  $('#acEditId').val(id);
  $('#acName').val(c.name);
  renderComboProductDropdowns();
  $('#acDrink').val(c.drinkId);
  $('#acPastry').val(c.pastryId);
  $('#acDiscount').val(c.discountPercent);
  $('#acActive').val(String(!!c.active));
  $('#acDesc').val(c.desc || '');
  $('#acImg').val(c.img || '');
  setImagePreview('acImgPreviewImg', 'acImgPreviewPlaceholder', c.img || '');
  $('#acImgUploadStatus').text('').removeClass('image-upload-error');
  $('#adminComboFormHeading').text(`Edit "${c.name}"`);
  $('#adminComboFormSubmitBtn').text('Update Combo');
  $('#adminComboCancelEditBtn').show();
});

$(document).on('click', '#adminComboCancelEditBtn', resetAdminComboForm);

/* Quick on/off switch right from the table row — the fastest way to
   pull a seasonal combo without deleting and re-creating it later. */
$(document).on('click', '[data-admin-combo-toggle]', async function(){
  const id = $(this).data('admin-combo-toggle');
  const c = COMBOS.find(x => x.id === id);
  if(!c) return;
  const $btn = $(this);
  $btn.prop('disabled', true);
  try{
    await window.CCCombos.updateCombo(id, { active: !c.active });
    c.active = !c.active;
    buildComboProducts();
    renderFeaturedCombos();
    renderAdminCombosTable();
    showToast(`"${c.name}" is now ${c.active ? 'active' : 'inactive'}.`, 'success');
  } catch(err){
    console.error(err);
    showToast('Could not update that combo. Please try again.', 'error');
  } finally {
    $btn.prop('disabled', false);
  }
});

$(document).on('click', '[data-admin-combo-delete]', async function(){
  const id = $(this).data('admin-combo-delete');
  const c = COMBOS.find(x => x.id === id);
  if(!c || !confirm(`Delete "${c.name}"? This can't be undone.`)) return;
  try{
    await window.CCCombos.deleteCombo(id);
    COMBOS = COMBOS.filter(x => x.id !== id);
    buildComboProducts();
    renderFeaturedCombos();
    renderAdminCombosTable();
    showToast(`Deleted "${c.name}".`, 'success');
    if(adminEditingComboId === id) resetAdminComboForm();
  } catch(err){
    console.error(err);
    showToast('Could not delete that combo. Please try again.', 'error');
  }
});

$(document).on('submit', '#adminAddComboForm', async function(e){
  e.preventDefault();
  const $btn = $('#adminComboFormSubmitBtn');
  const drinkId = $('#acDrink').val();
  const pastryId = $('#acPastry').val();
  if(!drinkId || !pastryId){
    showToast('Add at least one drink and one pastry to the catalog first.', 'warning');
    return;
  }
  const drink = PRODUCTS.find(p => p.id === drinkId);
  const pastry = PRODUCTS.find(p => p.id === pastryId);
  const fields = {
    name: $('#acName').val().trim(),
    drinkId, pastryId,
    discountPercent: Number($('#acDiscount').val()) || 0,
    active: $('#acActive').val() === 'true',
    desc: $('#acDesc').val().trim() || `${drink.name} + ${pastry.name}`,
    img: $('#acImg').val().trim()
  };

  if(adminEditingComboId){
    $btn.prop('disabled', true).text('Updating...');
    try{
      await window.CCCombos.updateCombo(adminEditingComboId, fields);
      const idx = COMBOS.findIndex(x => x.id === adminEditingComboId);
      if(idx > -1) COMBOS[idx] = { id: adminEditingComboId, ...fields };
      buildComboProducts();
      renderFeaturedCombos();
      renderAdminCombosTable();
      showToast(`Updated "${fields.name}".`, 'success');
      resetAdminComboForm();
    } catch(err){
      console.error(err);
      showToast('Could not update combo. Please try again.', 'error');
    } finally {
      $btn.prop('disabled', false).text('Update Combo');
    }
    return;
  }

  $btn.prop('disabled', true).text('Adding...');
  try{
    const newId = await window.CCCombos.addCombo(fields);
    COMBOS.push({ id: newId, ...fields });
    buildComboProducts();
    renderFeaturedCombos();
    renderAdminCombosTable();
    showToast(`Added "${fields.name}".`, 'success');
    resetAdminComboForm();
  } catch(err){
    console.error(err);
    showToast('Could not add combo. Please try again.', 'error');
  } finally {
    $btn.prop('disabled', false).text('Add Combo');
  }
});
