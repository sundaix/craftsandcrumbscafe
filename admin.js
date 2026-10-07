let ADMIN_ORDERS = [];
let adminEditingId = null; // set while editing an existing product, null when adding a new one
let adminProductSearch = '';    // current text in the Products search box
let adminCategoryFilter = 'All'; // current selection in the category filter dropdown
let adminStatusFilter = 'All';   // All | active | inactive | low | out (Products table)
let adminSelectedIds = new Set(); // product ids ticked for bulk activate/deactivate
let adminInvFilter = 'all';      // Overview inventory alerts list: all | out | low | inactive

// The dashboard must keep seeing inactive products (so they can be
// re-activated); the storefront never sets this. See setCatalogProducts()
// in shared-catalog.js.
window.CC_SHOW_INACTIVE = true;
let apOptionGroups = [];

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
  const ok = await showConfirm({
    title: 'Delete category?',
    message: msg,
    confirmText: 'Delete',
    danger: true
  });
  if(!ok) return;

  const $btn = $(this);
  $btn.prop('disabled', true);
  try{
    await window.CCCategories.deleteCategory(id);
    logActivity('delete', 'category', id, `Deleted category "${c.label}"`);
    CUSTOM_CATEGORIES = CUSTOM_CATEGORIES.filter(x => x.id !== id);
    removeCustomCategoryEffectsCore(c);
    renderExistingCategoriesList();
    renderAdminCategorySelects();
    // These four are customer-storefront renderers — they only exist
    // when admin.js happens to be running inside the full customer
    // page (script.js loaded). On the standalone admin app they're
    // undefined, so this is guarded rather than called unconditionally.
    if(typeof renderMenuSidebar === 'function') renderMenuSidebar();
    if(typeof renderMerchSidebar === 'function') renderMerchSidebar();
    if(typeof renderMenuPage === 'function') renderMenuPage();
    if(typeof renderMerchPage === 'function') renderMerchPage();
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
    logActivity('create', 'category', id, `Added category "${label}"`);
    CUSTOM_CATEGORIES.push(category);
    applyCustomCategoryCore(category);
    renderAdminCategorySelects();
    if(typeof renderMenuSidebar === 'function') renderMenuSidebar();
    if(typeof renderMerchSidebar === 'function') renderMerchSidebar();
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
  loadAndRenderInbox();
  renderAdminCategorySelects();
  renderAdminOverviewStats();
  renderAdminProductsTable();
  loadAndRenderAdminOrders();
  loadAndRenderAdminCombos();
  loadAndRenderAdminSettings();
  loadAndRenderAdminPromo();
  loadAndRenderAdminPopularSection();
  loadAndRenderAdminAccounts();
  loadAndRenderActivityLog();
}

/* ================= ACTIVITY LOG =================
   One entry per admin action, written by logActivity() right after
   each real write below already succeeded. See audit-log-service.js
   for the Firestore side (admin-read/admin-create-only, no update or
   delete allowed through the app at all). */
let ADMIN_ACTIVITY_LOG = [];
let adminActivityTypeFilter = 'All';
let adminActivitySearch = '';

const ACTIVITY_TYPE_LABELS = {
  product: 'Product', category: 'Category', combo: 'Combo',
  order: 'Order', settings: 'Settings', account: 'Account', message: 'Message'
};

/* Fire-and-forget on purpose: a logging failure is console-only,
   never surfaced to the admin and never allowed to block or roll
   back the real action it's describing — losing one log entry is far
   better than scaring someone about (or undoing) a product/order/
   account change that actually went through fine. Every call site
   below sits right after its real write already resolved. */
function logActivity(action, entityType, entityId, summary){
  if(!window.CCAuditLog) return;
  window.CCAuditLog.writeActivityLog({ action, entityType, entityId, summary })
    .catch(err => console.error('Activity log write failed (non-fatal):', err));
}

async function loadAndRenderActivityLog(){
  $('#adminActivityBody').html(`<tr><td colspan="4" class="admin-empty-row">Loading activity...</td></tr>`);
  try{
    ADMIN_ACTIVITY_LOG = await window.CCAuditLog.fetchActivityLog();
    renderAdminActivityTable();
  } catch(err){
    console.error(err);
    $('#adminActivityBody').html(`<tr><td colspan="4" class="admin-empty-row">Could not load the activity log. Please try again.</td></tr>`);
  }
}

function renderAdminActivityTable(){
  let filtered = ADMIN_ACTIVITY_LOG;
  if(adminActivityTypeFilter !== 'All'){
    filtered = filtered.filter(e => e.entityType === adminActivityTypeFilter);
  }
  const q = adminActivitySearch.trim().toLowerCase();
  if(q){
    filtered = filtered.filter(e =>
      (e.adminName || '').toLowerCase().includes(q) ||
      (e.adminEmail || '').toLowerCase().includes(q) ||
      (e.summary || '').toLowerCase().includes(q)
    );
  }

  if(!ADMIN_ACTIVITY_LOG.length){
    $('#adminActivityBody').html(`<tr><td colspan="4" class="admin-empty-row">No activity recorded yet — actions taken from this dashboard will start showing up here.</td></tr>`);
    return;
  }
  if(!filtered.length){
    $('#adminActivityBody').html(`<tr><td colspan="4" class="admin-empty-row">No activity matches your filters.</td></tr>`);
    return;
  }

  const rows = filtered.map(e => `
    <tr>
      <td>${formatOrderTimestamp(e.createdAt)}</td>
      <td>
        <div class="admin-customer-link" style="cursor:default;">
          <span class="admin-avatar">${customerInitials(e.adminEmail || e.adminName || '?')}</span>
          <span>${e.adminName || e.adminEmail || 'Unknown admin'}</span>
        </div>
      </td>
      <td>${ACTIVITY_TYPE_LABELS[e.entityType] || e.entityType || '—'}</td>
      <td>${e.summary || '—'}</td>
    </tr>
  `).join('');
  $('#adminActivityBody').html(rows);
}

$(document).on('change', '#adminActivityTypeFilter', function(){
  adminActivityTypeFilter = $(this).val();
  renderAdminActivityTable();
});
$(document).on('input', '#adminActivitySearch', function(){
  adminActivitySearch = $(this).val();
  renderAdminActivityTable();
});
$(document).on('click', '#adminRefreshActivity', loadAndRenderActivityLog);

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
  renderInventoryAlerts();
  renderOverviewAnalytics();
}

/* ================= INVENTORY ALERTS (Overview tab) =================
   Works off the PRODUCTS already in memory, so like everything else
   here it's a snapshot (no realtime listeners on Firestore Lite): the
   Refresh button re-fetches the catalog. Inactive products are listed
   under "Inactive" only — an admin who deliberately hid something
   (a seasonal item, say) shouldn't be nagged about its stock too. */
function computeInventoryAlerts(){
  const out = [], low = [], inactive = [];
  PRODUCTS.forEach(p => {
    if(!isProductActive(p)){ inactive.push(p); return; }
    const state = getProductStockState(p);
    if(state === 'out') out.push(p);
    else if(state === 'low') low.push(p);
  });
  const lowestStock = p => {
    const tracked = getSizeOptions(p).filter(o => typeof o.stock === 'number');
    return tracked.length ? Math.min(...tracked.map(o => o.stock)) : (typeof p.stock === 'number' ? p.stock : 0);
  };
  low.sort((a, b) => lowestStock(a) - lowestStock(b));
  return { out, low, inactive };
}

/* "M: 0 · L: 2" for sized products, "3 left" for flat stock. */
function inventoryDetailText(p){
  const tracked = getSizeOptions(p).filter(o => typeof o.stock === 'number');
  if(tracked.length){
    const flagged = tracked.filter(o => o.stock <= LOW_STOCK_THRESHOLD);
    return flagged.map(o => `${o.size}: ${o.stock}`).join(' · ');
  }
  return typeof p.stock === 'number' ? `${p.stock} left` : '';
}

const INV_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'out', label: 'Out of stock' },
  { key: 'low', label: 'Low stock' },
  { key: 'inactive', label: 'Inactive' }
];
const INV_LIST_LIMIT = 6;

function renderInventoryAlerts(){
  if(!$('#inventoryAlerts').length) return;
  const { out, low, inactive } = computeInventoryAlerts();
  $('#invOutCount').text(out.length);
  $('#invLowCount').text(low.length);
  $('#invInactiveCount').text(inactive.length);
  $('#invLowHint').text(`at or under ${LOW_STOCK_THRESHOLD}`);

  // Red badge on the sidebar Products tab = things that need restocking.
  const needAttention = out.length + low.length;
  $('#productsTabBadge').text(needAttention).prop('hidden', needAttention === 0);

  $('#invFilters').html(INV_FILTERS.map(f => {
    const count = f.key === 'all' ? out.length + low.length + inactive.length
      : f.key === 'out' ? out.length : f.key === 'low' ? low.length : inactive.length;
    return `<button type="button" class="range-filter-pill${f.key === adminInvFilter ? ' active' : ''}" data-inv-filter="${f.key}">${f.label} (${count})</button>`;
  }).join(''));

  const rowsFor = (list, kind) => list.map(p => ({ p, kind }));
  let items = [];
  if(adminInvFilter === 'all') items = [...rowsFor(out, 'out'), ...rowsFor(low, 'low'), ...rowsFor(inactive, 'inactive')];
  else if(adminInvFilter === 'out') items = rowsFor(out, 'out');
  else if(adminInvFilter === 'low') items = rowsFor(low, 'low');
  else items = rowsFor(inactive, 'inactive');

  if(!items.length){
    $('#invAlertList').html(`<div class="inv-empty">${
      adminInvFilter === 'all' ? 'All clear — every active product is stocked and nothing is hidden.' : 'Nothing here right now.'
    }</div>`);
    $('#invViewAll').hide();
    return;
  }

  $('#invAlertList').html(items.slice(0, INV_LIST_LIMIT).map(({ p, kind }) => {
    const badge = kind === 'out' ? '<span class="admin-stock-badge admin-stock-out">Out of stock</span>'
      : kind === 'low' ? `<span class="admin-stock-badge admin-stock-low">${inventoryDetailText(p) || 'Low'}</span>`
      : '<span class="admin-stock-badge admin-stock-unknown">Inactive</span>';
    const action = kind === 'inactive'
      ? `<button type="button" class="btn btn-activate btn-sm" data-admin-product-toggle="${p.id}">Activate</button>`
      : `<button type="button" class="btn btn-restock btn-sm" data-admin-edit="${p.id}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Restock</button>`;
    return `
      <div class="inv-row">
        <img src="${resolveImageSrc(p.img)}" alt="${p.name}">
        <div class="inv-row-main">
          <span class="inv-row-name">${p.name}</span>
          ${badge}
        </div>
        ${action}
      </div>`;
  }).join(''));

  const hidden = items.length - INV_LIST_LIMIT;
  $('#invViewAll')
    .toggle(true)
    .text(hidden > 0 ? `View all ${items.length} in Products` : 'Open in Products')
    .attr('data-inv-view', adminInvFilter);
}

$(document).on('click', '[data-inv-filter]', function(){
  adminInvFilter = $(this).data('inv-filter');
  renderInventoryAlerts();
});

/* Jump to the Products catalog pre-filtered to what the admin was just
   looking at ('all' = both stock problems and inactive, so no filter). */
$(document).on('click', '[data-inv-view]', function(){
  const view = $(this).attr('data-inv-view');
  adminStatusFilter = (view === 'all') ? 'All' : view;
  $('.admin-tab[data-admin-tab="products"]').trigger('click');
  goToProductsSubtab('catalog');
  $('#adminStatusFilter').val(adminStatusFilter);
  renderAdminProductsTable();
});

/* No realtime updates, and customer checkouts decrement stock behind the
   dashboard's back — so this re-reads the catalog. Calls fetchAllProducts
   directly instead of loadProductsFromFirestore() because that one falls
   back to the demo seed list on a network error, which would replace the
   real catalog in memory. */
$(document).on('click', '#invRefreshBtn', async function(){
  const $btn = $(this);
  $btn.prop('disabled', true).addClass('is-loading').find('.btn-refresh-label').text('Refreshing...');
  try{
    setCatalogProducts(await window.CCProducts.fetchAllProducts());
    renderAdminProductsTable();
    renderInventoryAlerts();
    $('#invUpdatedAt').text('Updated ' + new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }));
    showToast('Inventory refreshed.', 'success');
  } catch(err){
    console.error(err);
    showToast('Could not refresh inventory. Please try again.', 'error');
  } finally {
    $btn.prop('disabled', false).removeClass('is-loading').find('.btn-refresh-label').text('Refresh');
  }
});

/* ================= INVENTORY DROPDOWN + CLICK FEEDBACK (Overview tab) =================
   The Inventory Alerts product list starts collapsed (the three count chips
   stay visible). Open state lives on #inventoryAlerts, which renderInventoryAlerts()
   never rebuilds, so refreshing / switching filters doesn't snap it shut. */
$(document).on('click', '#invToggle', function(){
  const open = $('#inventoryAlerts').toggleClass('is-open').hasClass('is-open');
  $(this).attr('aria-expanded', open).find('.inv-toggle-label').text(open ? 'Hide products' : 'Show products');
});

/* The other Refresh buttons (Orders / Accounts / Activity) reload through
   their own loaders with no loading hook, so they just spin briefly. */
$(document).on('click', '.btn-refresh:not(#invRefreshBtn)', function(){
  const $b = $(this).addClass('is-loading');
  setTimeout(() => $b.removeClass('is-loading'), 900);
});

/* Re-triggers the small "pop" on a number that just changed. */
function popValue(sel){
  $(sel).each(function(){ this.classList.remove('adm-pop'); void this.offsetWidth; this.classList.add('adm-pop'); });
}

/* Ripple on press for buttons, pills, tabs and quick actions. Skipped when
   the OS asks for reduced motion; the CSS also disables the animation. */
$(document).on('pointerdown', '.btn, .admin-quick-action, .range-filter-pill, .admin-tab, .admin-subtab, .um-subtab, .inv-toggle, .admin-icon-btn', function(e){
  if(this.disabled || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  const oe = e.originalEvent || e, rect = this.getBoundingClientRect(), size = Math.max(rect.width, rect.height) * 2;
  const $r = $('<span class="adm-ripple" aria-hidden="true"></span>').css({
    width: size, height: size, left: oe.clientX - rect.left - size / 2, top: oe.clientY - rect.top - size / 2
  });
  $(this).append($r);
  setTimeout(() => $r.remove(), 600);
});

/* ================= REPORTS & ANALYTICS (Overview tab) =================
   Everything here works off ADMIN_ORDERS, already fetched for the Orders
   tab — no separate query. All computation happens client-side; there's
   no reporting backend, just filtering/aggregating the same order list
   the rest of the dashboard already has in memory. */

const OVERVIEW_RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'all', label: 'All Time' }
];
let adminOverviewRange = '30d';
let overviewCharts = { revenue: null, status: null };

function renderOverviewRangeFilters(){
  const html = OVERVIEW_RANGES.map(r =>
    `<button type="button" class="range-filter-pill${r.key === adminOverviewRange ? ' active' : ''}" data-overview-range="${r.key}">${r.label}</button>`
  ).join('');
  $('#overviewRangeFilters').html(html);
}

$(document).on('click', '[data-overview-range]', function(){
  adminOverviewRange = $(this).data('overview-range');
  renderOverviewRangeFilters();
  renderOverviewAnalytics();
  popValue('#statRangeRevenue, #statRangeOrders, #statRangeAOV');
});

function getOrdersInRange(){
  if(adminOverviewRange === 'all') return ADMIN_ORDERS;
  const now = Date.now();
  const cutoffs = { today: 24 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000, '30d': 30 * 24 * 60 * 60 * 1000 };
  const windowMs = cutoffs[adminOverviewRange] || cutoffs['30d'];
  return ADMIN_ORDERS.filter(o => {
    const ms = orderTimestampMs(o.createdAt);
    return ms !== null && (now - ms) <= windowMs;
  });
}

/* Groups a range's orders into day buckets for the revenue trend chart.
   Caps at 30 buckets (oldest-first) so "All Time" on a mature dataset
   doesn't render an unreadable wall of bars. */
function buildRevenueTrendData(orders){
  const byDay = {};
  orders.forEach(o => {
    const ms = orderTimestampMs(o.createdAt);
    if(ms === null) return;
    const dayKey = new Date(ms).toISOString().slice(0, 10);
    byDay[dayKey] = (byDay[dayKey] || 0) + (o.totals?.total || 0);
  });
  const days = Object.keys(byDay).sort();
  const trimmed = days.length > 30 ? days.slice(days.length - 30) : days;
  return {
    labels: trimmed.map(d => new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })),
    values: trimmed.map(d => byDay[d])
  };
}

function buildStatusBreakdownData(orders){
  const counts = {};
  ORDER_STATUSES.forEach(s => { counts[s] = 0; });
  orders.forEach(o => {
    const s = o.status || 'pending';
    if(counts[s] !== undefined) counts[s]++;
  });
  return counts;
}

/* Top 5 products by revenue within the range — aggregated by item
   NAME (order line items don't reliably carry a productId, but every
   line item is guaranteed to have the name it was sold under). */
function buildTopProducts(orders){
  const byName = {};
  orders.forEach(o => {
    (o.items || []).forEach(it => {
      if(!it.name) return;
      if(!byName[it.name]) byName[it.name] = { units: 0, revenue: 0 };
      byName[it.name].units += (it.qty || 0);
      byName[it.name].revenue += (it.price || 0) * (it.qty || 0);
    });
  });
  return Object.entries(byName)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
}

const RANGE_LABELS = { today: 'today', '7d': 'last 7 days', '30d': 'last 30 days', all: 'all time' };

function renderOverviewAnalytics(){
  renderOverviewRangeFilters();
  const orders = getOrdersInRange();

  // Range stat cards
  const revenue = orders.reduce((sum, o) => sum + (o.totals?.total || 0), 0);
  $('#statRangeRevenue').text(orders.length ? peso(revenue) : '—');
  $('#statRangeOrders').text(orders.length || '—');
  $('#statRangeAOV').text(orders.length ? peso(revenue / orders.length) : '—');

  renderRevenueTrendChart(orders);
  renderOrderStatusChart(orders);
  renderTopProductsTable(orders);
  renderRecentOrdersTable();
}

function renderRevenueTrendChart(orders){
  const $card = $('#chartRevenueTrend').closest('.admin-chart-card');
  const data = buildRevenueTrendData(orders);
  $card.toggleClass('is-empty', data.labels.length === 0);
  if(!data.labels.length) return;

  const ctx = document.getElementById('chartRevenueTrend').getContext('2d');
  if(overviewCharts.revenue) overviewCharts.revenue.destroy();
  overviewCharts.revenue = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        data: data.values,
        backgroundColor: '#C99A3A',
        borderRadius: 4,
        maxBarThickness: 28
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => peso(c.parsed.y) } } },
      scales: {
        y: { beginAtZero: true, ticks: { callback: (v) => peso(v), font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.06)' } },
        x: { ticks: { font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

function renderOrderStatusChart(orders){
  const $card = $('#chartOrderStatus').closest('.admin-chart-card');
  const counts = buildStatusBreakdownData(orders);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  $card.toggleClass('is-empty', total === 0);
  if(!total) return;

  // Same palette family as the status pills/badges elsewhere in the dashboard.
  const statusColors = { pending: '#C99A3A', preparing: '#7C93A6', ready: '#B08659', out_for_delivery: '#A8824F', delivery_failed: '#C0734A', completed: '#7C9885', cancelled: '#B65C5C' };
  const labels = ORDER_STATUSES.map(formatStatusLabel);
  const values = ORDER_STATUSES.map(s => counts[s]);

  const ctx = document.getElementById('chartOrderStatus').getContext('2d');
  if(overviewCharts.status) overviewCharts.status.destroy();
  overviewCharts.status = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: ORDER_STATUSES.map(s => statusColors[s]), borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 }, padding: 10 } } }
    }
  });
}

function renderTopProductsTable(orders){
  const top = buildTopProducts(orders);
  if(!top.length){
    $('#topProductsBody').html(`<tr><td colspan="3" class="admin-empty-row">No sales in this range yet.</td></tr>`);
    return;
  }
  $('#topProductsBody').html(top.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.units}</td>
      <td>${peso(p.revenue)}</td>
    </tr>
  `).join(''));
}

/* Deliberately NOT range-filtered — "recent" always means the most
   recent orders overall, regardless of which analytics range is
   selected, so the admin always has a quick pulse of what just
   happened. */
function renderRecentOrdersTable(){
  const recent = [...ADMIN_ORDERS]
    .sort((a, b) => (orderTimestampMs(b.createdAt) || 0) - (orderTimestampMs(a.createdAt) || 0))
    .slice(0, 8);
  if(!recent.length){
    $('#recentOrdersBody').html(`<tr><td colspan="4" class="admin-empty-row">No orders yet.</td></tr>`);
    return;
  }
  $('#recentOrdersBody').html(recent.map(o => {
    const status = o.status || 'pending';
    return `
      <tr>
        <td><span class="admin-order-id">#${o.id.slice(0,6).toUpperCase()}</span></td>
        <td>${o.customer?.name || 'Guest'}</td>
        <td>${peso(o.totals?.total || 0)}</td>
        <td><span class="admin-status-select admin-status-${status}" style="display:inline-block; cursor:default;">${status}</span></td>
      </tr>
    `;
  }).join(''));
}

/* ================= QUICK ACTIONS ================= */
$(document).on('click', '[data-nav-to-orders]', function(){
  $('.admin-tab[data-admin-tab="orders"]').trigger('click');
});
$(document).on('click', '[data-nav-to-pending-orders]', function(){
  $('.admin-tab[data-admin-tab="orders"]').trigger('click');
  adminOrderStatusFilter = 'pending';
  renderOrderStatusFilters();
  renderAdminOrdersTable();
});
$(document).on('click', '[data-nav-to-accounts]', function(){
  $('.admin-tab[data-admin-tab="accounts"]').trigger('click');
});
$(document).on('click', '[data-nav-to-settings]', function(){
  $('.admin-tab[data-admin-tab="settings"]').trigger('click');
});
$(document).on('click', '[data-nav-to-add-product]', function(){
  $('.admin-tab[data-admin-tab="products"]').trigger('click');
  resetAdminProductForm();
  goToProductsSubtab('add-product');
});

/* Stock badge for the Stock column. Colour comes from the shared stock
   state (so per-size wearables flag a single low size), text from the
   total, same as before. The low threshold is no longer hardcoded to 5. */
function stockBadgeHtml(p){
  if(p.stock === undefined || p.stock === null) return '<span class="admin-stock-badge admin-stock-unknown">—</span>';
  const state = getProductStockState(p);
  if(state === 'out') return '<span class="admin-stock-badge admin-stock-out">Out of stock</span>';
  if(state === 'low') return `<span class="admin-stock-badge admin-stock-low">${p.stock} left</span>`;
  return `<span class="admin-stock-badge admin-stock-ok">${p.stock}</span>`;
}

function statusBadgeHtml(p){
  return isProductActive(p)
    ? '<span class="admin-stock-badge admin-stock-ok">Active</span>'
    : '<span class="admin-stock-badge admin-stock-unknown">Inactive</span>';
}

/* The Low / Out filters only match ACTIVE products, same as the Overview
   alerts, so the counts there and the rows here always line up. */
function productMatchesStatusFilter(p){
  if(adminStatusFilter === 'All') return true;
  if(adminStatusFilter === 'active') return isProductActive(p);
  if(adminStatusFilter === 'inactive') return !isProductActive(p);
  if(!isProductActive(p)) return false;
  return getProductStockState(p) === adminStatusFilter; // 'low' | 'out'
}

function renderAdminProductsTable(){
  const q = adminProductSearch.trim().toLowerCase();
  const visible = PRODUCTS
    .filter(p => adminCategoryFilter === 'All' || p.cat === adminCategoryFilter)
    .filter(productMatchesStatusFilter)
    .filter(p => !q || p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q));

  // Drop ticks on rows that are no longer visible (filter/search changed,
  // product deleted) so a bulk action can never hit something off-screen.
  const visibleIds = new Set(visible.map(p => p.id));
  adminSelectedIds = new Set([...adminSelectedIds].filter(id => visibleIds.has(id)));

  const rows = visible.map(p => {
    const active = isProductActive(p);
    return `
      <tr data-product-row="${p.id}" class="${active ? '' : 'admin-row-inactive'}">
        <td class="admin-td-check">
          <input type="checkbox" data-admin-select="${p.id}" aria-label="Select ${p.name}"${adminSelectedIds.has(p.id) ? ' checked' : ''}>
        </td>
        <td class="admin-td-product">
          <div class="admin-td-product-inner">
            <img src="${resolveImageSrc(p.img)}" alt="${p.name}">
            <span>${p.name}</span>
          </div>
        </td>
        <td>${categoryBadge(p.cat)}</td>
        <td>${priceLabel(p)}</td>
        <td>${stockBadgeHtml(p)}</td>
        <td>${statusBadgeHtml(p)}</td>
        <td class="admin-td-actions">
          <button class="admin-icon-btn" data-admin-product-toggle="${p.id}" title="${active ? 'Deactivate' : 'Activate'}" aria-label="${active ? 'Deactivate' : 'Activate'} ${p.name}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
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
    `;
  }).join('');

  const filtered = q || adminCategoryFilter !== 'All' || adminStatusFilter !== 'All';
  const emptyMsg = filtered ? 'No products match those filters.' : 'No products yet.';
  $('#adminProductsBody').html(rows || `<tr><td colspan="7" class="admin-empty-row">${emptyMsg}</td></tr>`);
  updateBulkBar(visible.length);
}

/* Bulk bar + header "select all" checkbox state. */
function updateBulkBar(visibleCount){
  const n = adminSelectedIds.size;
  $('#adminBulkBar').prop('hidden', n === 0);
  $('#adminBulkCount').text(`${n} selected`);
  const $all = $('#adminSelectAll');
  $all.prop('checked', visibleCount > 0 && n === visibleCount);
  $all.prop('indeterminate', n > 0 && n < visibleCount);
}

$(document).on('change', '[data-admin-select]', function(){
  const id = $(this).data('admin-select');
  if(this.checked) adminSelectedIds.add(id); else adminSelectedIds.delete(id);
  updateBulkBar($('#adminProductsBody [data-admin-select]').length);
});

$(document).on('change', '#adminSelectAll', function(){
  const on = this.checked;
  $('#adminProductsBody [data-admin-select]').each(function(){
    const id = $(this).data('admin-select');
    if(on) adminSelectedIds.add(id); else adminSelectedIds.delete(id);
    $(this).prop('checked', on);
  });
  updateBulkBar($('#adminProductsBody [data-admin-select]').length);
});

$(document).on('change', '#adminStatusFilter', function(){
  adminStatusFilter = $(this).val();
  renderAdminProductsTable();
});

/* ================= PRODUCT STATUS (active / inactive) =================
   Single toggle and bulk both go through here. updateProduct() only
   sends {active} (an admin write, already allowed by firestore.rules)
   and keeps the local products cache in sync. Inactive products drop off
   the storefront the next time a customer's catalog loads — their
   localStorage cache is stale-while-revalidate, so it can take one
   page load. Bulk writes are one request per product (small catalog,
   and Firestore Lite has no realtime/batch helpers wired up here); a
   partial failure reports how many went through. */
async function setProductsActive(ids, active){
  const targets = ids
    .map(id => PRODUCTS.find(p => p.id === id))
    .filter(p => p && isProductActive(p) !== active);
  if(!targets.length){
    showToast(`Already ${active ? 'active' : 'inactive'}.`, 'info');
    return;
  }
  const results = await Promise.allSettled(
    targets.map(p => window.CCProducts.updateProduct(p.id, { active }))
  );
  const done = targets.filter((p, i) => results[i].status === 'fulfilled');
  const failed = targets.length - done.length;
  done.forEach(p => { p.active = active; });

  if(done.length){
    // Logged after the real writes succeeded, like every other call site.
    if(done.length === 1){
      logActivity('update', 'product', done[0].id, `"${done[0].name}" set to ${active ? 'active' : 'inactive'}`);
    } else {
      const names = done.slice(0, 5).map(p => `"${p.name}"`).join(', ') + (done.length > 5 ? `, +${done.length - 5} more` : '');
      logActivity('update', 'product', 'bulk', `${active ? 'Activated' : 'Deactivated'} ${done.length} products: ${names}`);
    }
    adminSelectedIds.clear();
    buildComboProducts();
    renderAdminProductsTable();
    renderInventoryAlerts();
  }
  if(failed){
    results.filter(r => r.status === 'rejected').forEach(r => console.error(r.reason));
    showToast(`${done.length} updated, ${failed} failed. Please try the rest again.`, 'error');
  } else if(done.length === 1){
    showToast(`"${done[0].name}" is now ${active ? 'active' : 'inactive'}.`, 'success');
  } else {
    showToast(`${done.length} products ${active ? 'activated' : 'deactivated'}.`, 'success');
  }
}

$(document).on('click', '[data-admin-product-toggle]', async function(){
  const id = $(this).data('admin-product-toggle');
  const p = PRODUCTS.find(x => x.id === id);
  if(!p) return;
  const $btn = $(this);
  $btn.prop('disabled', true);
  try{
    await setProductsActive([id], !isProductActive(p));
  } finally {
    $btn.prop('disabled', false);
  }
});

$(document).on('click', '[data-admin-bulk]', async function(){
  const active = $(this).data('admin-bulk') === 'activate';
  const ids = [...adminSelectedIds];
  if(!ids.length) return;
  if(!active){
    const ok = await showConfirm({
      title: `Deactivate ${ids.length} product${ids.length !== 1 ? 's' : ''}?`,
      message: "They'll be hidden from customers until you activate them again. Nothing is deleted.",
      confirmText: 'Deactivate',
      danger: true
    });
    if(!ok) return;
  }
  const $btns = $('[data-admin-bulk]').prop('disabled', true);
  try{
    await setProductsActive(ids, active);
  } finally {
    $btns.prop('disabled', false);
  }
});

$(document).on('click', '#adminBulkClear', function(){
  adminSelectedIds.clear();
  renderAdminProductsTable();
});

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
  $('#apActive').prop('checked', isProductActive(p));
  populateDrinkDetailsFields(p);
  toggleFoodFields(p.cat);
  renderSizePriceRows(p.cat, p);
  setImagePreview('apImgPreviewImg', 'apImgPreviewPlaceholder', resolveImageSrc(p.img) || '');
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
  $('#apActive').prop('checked', isProductActive(p));
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
  setImagePreview('apImgPreviewImg', 'apImgPreviewPlaceholder', resolveImageSrc(p.img) || '');
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
  const ok = await showConfirm({
    title: `Delete "${p.name}"?`,
    message: "This can't be undone.",
    confirmText: 'Delete',
    danger: true
  });
  if(!ok) return;

  try{
    await window.CCProducts.deleteProduct(id);
    logActivity('delete', 'product', id, `Deleted product "${p.name}"`);
    PRODUCTS = PRODUCTS.filter(x => x.id !== id);
    adminSelectedIds.delete(id);
    renderAdminProductsTable();
    renderAdminOverviewStats();
    if(typeof renderMenuPage === 'function') renderMenuPage();
    if(typeof renderMerchPage === 'function') renderMerchPage();
    buildComboProducts();
    if(typeof renderFeaturedCombos === 'function') renderFeaturedCombos();
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
    active: $('#apActive').prop('checked'),
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
      // Status/stock changes get spelled out in the entry so the Activity
      // Log shows what changed, not just that something did.
      const notes = [];
      if(prevProduct && isProductActive(prevProduct) !== fields.active){
        notes.push(`set to ${fields.active ? 'active' : 'inactive'}`);
      }
      if(prevProduct && prevProduct.stock !== fields.stock){
        notes.push(`stock ${prevProduct.stock ?? '—'} → ${fields.stock}`);
      }
      logActivity('update', 'product', adminEditingId,
        `Updated product "${name}"${notes.length ? ' (' + notes.join(', ') + ')' : ''}`);
      const idx = PRODUCTS.findIndex(x => x.id === adminEditingId);
      if(idx > -1){
        const merged = { id: adminEditingId, ...prevProduct, ...fields };
        fieldsToDelete.forEach(f => delete merged[f]);
        PRODUCTS[idx] = merged;
      }
      showToast(`Updated "${name}".`, 'success');
      resetAdminProductForm();
      renderAdminProductsTable();
      renderInventoryAlerts();
      if(typeof renderMenuPage === 'function') renderMenuPage();
      if(typeof renderMerchPage === 'function') renderMerchPage();
      buildComboProducts();
      if(typeof renderFeaturedCombos === 'function') renderFeaturedCombos();
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
    logActivity('create', 'product', newId, `Added product "${name}"`);
    PRODUCTS.push({ id: newId, ...fields });
    showToast(`Added "${name}" to inventory.`, 'success');
    resetAdminProductForm();
    renderAdminProductsTable();
    renderAdminOverviewStats();
    if(typeof renderMenuPage === 'function') renderMenuPage();
    if(typeof renderMerchPage === 'function') renderMerchPage();
    buildComboProducts();
    if(typeof renderFeaturedCombos === 'function') renderFeaturedCombos();
  } catch(err){
    console.error(err);
    showToast('Could not add product. Please try again.', 'error');
  } finally {
    $btn.prop('disabled', false).text('Add Product');
  }
});

/* ================= ORDERS TABLE ================= */
let ADMIN_RIDERS = []; // cached rider accounts, for the assign-rider dropdown on delivery orders

/* Riders are just accounts with role:'rider' — reuses the same
   admin-only listUserProfiles() the Accounts tab already calls,
   rather than standing up a separate Firestore query, since an admin
   session always has permission to list every user profile anyway. */
async function loadRidersCache(){
  try{
    const profiles = await window.CCAccounts.listUserProfiles();
    ADMIN_RIDERS = profiles.filter(u => u.role === 'rider' && !u.disabled);
  } catch(err){
    console.error('Could not load riders for assignment.', err);
    ADMIN_RIDERS = [];
  }
}

async function loadAndRenderAdminOrders(){
  $('#adminOrdersBody').html(`<tr><td colspan="8" class="admin-empty-row">Loading orders...</td></tr>`);
  try{
    // loadReturnsCache() never throws (a returns problem must not block the orders table).
    [ADMIN_ORDERS] = await Promise.all([
      window.CCOrders.fetchAllOrders(),
      loadRidersCache(),
      loadReturnsCache()
    ]);
  } catch(err){
    console.error(err);
    $('#adminOrdersBody').html(`<tr><td colspan="8" class="admin-empty-row">Could not load orders. Please try refreshing.</td></tr>`);
    return;
  }
  renderOrderStatusFilters();
  renderAdminOrdersTable();
  rtRenderPanel();
  renderAdminOverviewStats();
}

const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'out_for_delivery', 'delivery_failed', 'completed', 'cancelled'];

/* Human-friendly label for a status value — needed now that
   'out_for_delivery' shouldn't render as "Out_for_delivery". */
function formatStatusLabel(status){
  return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* How long a pending order can sit before the table flags it —
   pending is the one status where every extra minute is a customer
   waiting to hear back, so it's the only one worth calling out. */
const ORDER_STALE_MINUTES = 15;

let adminOrderStatusFilter = 'all'; // 'all' | one of ORDER_STATUSES
let adminOrderSearch = '';          // current text in the orders search box

/* Sort state for the orders table. key is one of 'createdAt' | 'customer' | 'total'.
   Newest-first by date is the most useful default view for an admin
   checking in on the shop, so that's where every session starts. */
let adminOrderSort = { key: 'createdAt', dir: 'desc' };

function sortOrders(list){
  const { key, dir } = adminOrderSort;
  const mult = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    let av, bv;
    if(key === 'total'){
      av = a.totals?.total || 0;
      bv = b.totals?.total || 0;
    } else if(key === 'customer'){
      av = (a.customer?.name || 'Guest').toLowerCase();
      bv = (b.customer?.name || 'Guest').toLowerCase();
    } else {
      av = orderTimestampMs(a.createdAt) || 0;
      bv = orderTimestampMs(b.createdAt) || 0;
    }
    if(av < bv) return -1 * mult;
    if(av > bv) return 1 * mult;
    return 0;
  });
}

/* Reflects adminOrderSort onto the header row: clears stale arrows,
   marks the active column, and points its arrow the right way. */
function updateOrderSortHeaders(){
  $('.sortable-th').removeClass('sort-active').find('.sort-arrow').text('↕');
  const $active = $(`.sortable-th[data-sort-key="${adminOrderSort.key}"]`);
  $active.addClass('sort-active').find('.sort-arrow').text(adminOrderSort.dir === 'asc' ? '↑' : '↓');
}

$(document).on('click', '.sortable-th', function(){
  const key = $(this).data('sort-key');
  if(adminOrderSort.key === key){
    adminOrderSort.dir = adminOrderSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    adminOrderSort = { key, dir: key === 'customer' ? 'asc' : 'desc' };
  }
  renderAdminOrdersTable();
});

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
    const label = f === 'all' ? 'All' : formatStatusLabel(f);
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

/* Two initials from a customer name for the little avatar chip —
   falls back to "?" for guest/blank names so the chip never renders empty. */
function customerInitials(name){
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function minutesWaiting(order){
  const ms = orderTimestampMs(order.createdAt);
  if(ms === null) return null;
  return Math.max(1, Math.round((Date.now() - ms) / 60000));
}

/* Turns a raw minute count into a compact, human-friendly duration —
   "45m", "2h 15m", "3d 4h" — instead of a clunky five-digit number of
   minutes for anything that's been sitting a while (old test/seed
   orders especially). Caps at days; nobody needs "56196m" at a glance. */
function formatWaitDuration(totalMinutes){
  if(totalMinutes < 60) return `${totalMinutes}m`;
  const totalHours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if(totalHours < 24) return mins ? `${totalHours}h ${mins}m` : `${totalHours}h`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours ? `${days}d ${hours}h` : `${days}d`;
}

function renderAdminOrdersTable(){
  pdEnsureSelectHeader();
  if(!ADMIN_ORDERS.length){
    $('#adminOrdersBody').html(`<tr><td colspan="8" class="admin-empty-row">No orders yet.</td></tr>`);
    pdSyncSelectUi();
    return;
  }
  const filtered = sortOrders(getFilteredOrders());
  updateOrderSortHeaders();
  if(!filtered.length){
    const msg = adminOrderSearch
      ? 'No orders match your search.'
      : `No ${adminOrderStatusFilter} orders.`;
    $('#adminOrdersBody').html(`<tr><td colspan="8" class="admin-empty-row">${msg}</td></tr>`);
    pdSyncSelectUi();
    return;
  }
  const rows = filtered.map((o, i) => {
    const status = o.status || 'pending';
    const options = ORDER_STATUSES.map(s => `<option value="${s}" ${s === status ? 'selected' : ''}>${formatStatusLabel(s)}</option>`).join('');
    const stale = isOrderStale(o);
    const name = o.customer?.name || 'Guest';
    const isDelivery = o.fulfillment === 'delivery';
    const waited = stale ? minutesWaiting(o) : null;
    const riderCell = !isDelivery
      ? '<span class="admin-order-rider-na">—</span>'
      : (() => {
          const riderOptions = ['<option value="">Unassigned</option>']
            .concat(ADMIN_RIDERS.map(r => `<option value="${r.uid}" ${o.riderId === r.uid ? 'selected' : ''}>${r.name || r.email || r.uid.slice(0,6)}</option>`));
          // If the order is assigned to a rider who's since gone missing
          // from ADMIN_RIDERS (disabled, or role changed back), still show
          // them selected so the table doesn't silently look unassigned.
          if(o.riderId && !ADMIN_RIDERS.some(r => r.uid === o.riderId)){
            riderOptions.push(`<option value="${o.riderId}" selected>${o.riderId.slice(0,6)} (inactive)</option>`);
          }
          return `<select class="admin-status-select" data-order-rider="${o.id}">${riderOptions.join('')}</select>`;
        })();
    return `
      <tr style="--i:${i}" class="${stale ? 'admin-order-row-stale' : ''}${pdSelectedOrderIds.has(o.id) ? ' pd-row-selected' : ''}">
        <td class="pd-sel-td"><input type="checkbox" class="pd-sel" data-pd-sel="${o.id}" aria-label="Select order #${o.id.slice(0,6).toUpperCase()}" ${pdSelectedOrderIds.has(o.id) ? 'checked' : ''}></td>
        <td><span class="admin-order-id">#${o.id.slice(0,6).toUpperCase()}</span>${rtMiniBadge(o.id)}</td>
        <td class="admin-order-placed">${formatOrderTimestamp(o.createdAt)}${stale ? `<span class="admin-order-stale-flag" title="Pending for over ${ORDER_STALE_MINUTES} minutes">⚠ ${formatWaitDuration(waited)}</span>` : ''}</td>
        <td>
          <button class="admin-customer-link" data-order-view="${o.id}">
            <span class="admin-avatar">${customerInitials(name)}</span>
            <span>${name}</span>
          </button>
        </td>
        <td><span class="fulfillment-badge fulfillment-${isDelivery ? 'delivery' : 'pickup'}">${isDelivery ? 'Delivery' : 'Pickup'}</span></td>
        <td class="admin-order-total">${peso(o.totals?.total || 0)}</td>
        <td>
          <select class="admin-status-select admin-status-${status}" data-order-status="${o.id}">
            ${options}
          </select>
        </td>
        <td>${riderCell}</td>
      </tr>
    `;
  }).join('');
  $('#adminOrdersBody').html(rows);
  pdSyncSelectUi();
}

$(document).on('click', '#adminRefreshOrders', loadAndRenderAdminOrders);

$(document).on('change', '[data-order-rider]', async function(){
  const orderId = $(this).data('order-rider');
  const riderId = $(this).val() || null;
  const rider = riderId ? ADMIN_RIDERS.find(r => r.uid === riderId) : null;
  const $select = $(this);
  $select.prop('disabled', true);
  try{
    await window.CCOrders.assignRider(orderId, riderId, rider ? { name: rider.name || rider.email || null, phone: rider.phone || null } : null);
    const order = ADMIN_ORDERS.find(o => o.id === orderId);
    if(order){
      order.riderId = riderId;
      order.riderName = rider ? (rider.name || rider.email || null) : null;
      order.riderPhone = rider ? (rider.phone || null) : null;
    }
    const orderTag = `#${orderId.slice(0,6).toUpperCase()}`;
    logActivity('update', 'order', orderId, riderId
      ? `Assigned order ${orderTag} to rider ${rider?.name || rider?.email || riderId}`
      : `Unassigned rider from order ${orderTag}`);
    showToast(riderId
      ? `Order ${orderTag} assigned to ${rider?.name || rider?.email || 'rider'}.`
      : `Order ${orderTag} unassigned.`, 'success');
  } catch(err){
    console.error(err);
    showToast('Could not assign that rider. Please try again.', 'error');
    renderAdminOrdersTable();
  } finally {
    $select.prop('disabled', false);
  }
});

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

/* Delivery details for the Order Detail modal: how far it is, who has
   it, the rider's timeline, and the proof they left (note + photo) or why
   the delivery failed. Everything here is optional — an order only shows
   the lines it actually has. */
function odDeliverySectionHtml(order){
  if(order.fulfillment !== 'delivery') return '';
  const t = order.totals || {};
  const field = (label, value, full) => `<div class="order-detail-field${full ? ' order-detail-field-full' : ''}"><label>${label}</label><span>${value}</span></div>`;
  const rows = [];
  if(t.distanceKm != null) rows.push(field('Distance', `${Number(t.distanceKm).toFixed(1)} km${t.durationMin ? ` · about ${umEsc(t.durationMin)} min` : ''}${t.distanceSource === 'estimate' ? ' (estimated)' : ''}`));
  rows.push(field('Rider', order.riderId ? umEsc(order.riderName || 'Assigned') : 'Not assigned yet'));
  if(order.riderPhone) rows.push(field('Rider phone', umEsc(order.riderPhone)));
  if(order.pickedUpAt) rows.push(field('Picked up', umEsc(formatOrderTimestamp(order.pickedUpAt))));
  if(order.arrivedAt) rows.push(field('Arrived', umEsc(formatOrderTimestamp(order.arrivedAt))));
  if(order.completedAt) rows.push(field('Delivered', umEsc(formatOrderTimestamp(order.completedAt))));
  if(order.failedAt) rows.push(field('Delivery failed', umEsc(formatOrderTimestamp(order.failedAt))));
  if(order.failureReason) rows.push(field('Reason', `<strong style="color:var(--adm-danger-dark);">${umEsc(order.failureReason)}</strong>`, true));
  if(order.deliveryProof) rows.push(field('Rider note', umEsc(order.deliveryProof), true));
  const photo = order.deliveryPhoto
    ? `<a class="od-proof-link" href="${umEsc(order.deliveryPhoto)}" target="_blank" rel="noopener"><img class="od-proof-img" src="${umEsc(order.deliveryPhoto)}" alt="Delivery photo" loading="lazy"></a>`
    : '';
  return `
    <div class="order-detail-section">
      <h4>Delivery</h4>
      <div class="order-detail-grid">${rows.join('')}</div>
      ${photo}
    </div>`;
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
    <div class="pd-detail-actions">
      <button type="button" class="btn btn-outline btn-sm" data-pd-open="${order.id}" data-pd-type="invoice">${PD_ICON_PRINTER} Invoice</button>
      <button type="button" class="btn btn-outline btn-sm" data-pd-open="${order.id}" data-pd-type="slip">${PD_ICON_PRINTER} Packing slip</button>
    </div>
    ${rtDetailSectionHtml(order)}
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

    ${odDeliverySectionHtml(order)}

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
    logActivity('status-change', 'order', orderId, `Order #${orderId.slice(0,6).toUpperCase()} marked ${newStatus}`);
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

/* ================= PRINT INVOICES / PACKING SLIPS (Orders tab) =================
   Two printable documents per order, shown in a popup first:
   - Invoice: prices, totals, payment status (customer-facing receipt).
   - Packing slip: NO prices — what to pack, options, and who it goes to.
   "Print / Save as PDF" uses the browser's own print dialog (choose
   "Save as PDF" as the destination), so no PDF library is needed. The
   popup's contents are cloned into #pdPrintRoot and everything else is
   hidden by the @media print rules in admin.css while body.pd-printing
   is set. Works for one order (Order Detail modal) or several (the
   checkboxes in the Orders table). */
const PD_BUSINESS = {
  name: 'Crafts & Crumbs',
  tagline: 'Café & handmade goods',
  address: 'Quezon City, Metro Manila', // TODO: replace with the shop's full address
  phone: '',                            // TODO: shop contact number (leave '' to hide)
  email: '',                            // TODO: shop email (leave '' to hide)
  logo: 'crumblogo.png'
};
let pdSelectedOrderIds = new Set();
let pdState = { orders: [], type: 'invoice' };

const PD_ICON_PRINTER = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="7" rx="1"/><path d="M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/></svg>';

function pdEsc(s){ return umEsc(s); }
function pdOrderNo(order){ return 'CC-' + order.id.slice(0, 6).toUpperCase(); }
function pdPayMethod(m){
  const map = { qrph: 'QR Ph', card: 'Card', gcash: 'GCash', cash: 'Cash' };
  return map[String(m || '').toLowerCase()] || (m || '—');
}
function pdLogoSrc(){
  return (typeof resolveImageSrc === 'function') ? resolveImageSrc(PD_BUSINESS.logo) : '/' + PD_BUSINESS.logo;
}

function pdHeaderHtml(title){
  const contact = [PD_BUSINESS.address, PD_BUSINESS.phone, PD_BUSINESS.email].filter(Boolean).map(pdEsc).join(' · ');
  return `
    <div class="pd-head">
      <img class="pd-logo" src="${pdEsc(pdLogoSrc())}" alt="Crafts &amp; Crumbs logo">
      <div class="pd-brand">
        <div class="pd-brand-name">${pdEsc(PD_BUSINESS.name)}</div>
        <div class="pd-brand-tag">${pdEsc(PD_BUSINESS.tagline)}</div>
        ${contact ? `<div class="pd-brand-contact">${contact}</div>` : ''}
      </div>
      <div class="pd-doc-title">${title}</div>
    </div>
    <div class="pd-divider"></div>
  `;
}

function pdInvoiceHtml(order){
  const c = order.customer || {};
  const totals = order.totals || {};
  const isDelivery = order.fulfillment === 'delivery';
  const status = order.status || 'pending';
  const paid = order.paymentStatus === 'paid';

  const rows = (order.items || []).map((it, i) => `
    <tr class="pd-row" style="--i:${i}">
      <td>
        <div class="pd-item-name">${pdEsc(it.name)}${it.size ? ` <span class="pd-item-size">(${pdEsc(it.size)})</span>` : ''}</div>
        ${it.optionsSummary ? `<div class="pd-item-opts">${pdEsc(it.optionsSummary)}</div>` : ''}
      </td>
      <td class="pd-num">${pdEsc(it.qty)}</td>
      <td class="pd-num">${peso(it.price || 0)}</td>
      <td class="pd-num">${peso((it.price || 0) * (it.qty || 0))}</td>
    </tr>
  `).join('') || `<tr><td colspan="4" class="pd-empty">No items recorded on this order.</td></tr>`;

  // Cancelled wins over paid/unpaid — a cancelled order shouldn't read as a live receipt.
  const stamp = status === 'cancelled'
    ? `<div class="pd-stamp pd-stamp-cancelled">Cancelled</div>`
    : paid
      ? `<div class="pd-stamp pd-stamp-paid">Paid</div>`
      : `<div class="pd-stamp pd-stamp-unpaid">Payment pending</div>`;

  return `
    <article class="pd-sheet pd-invoice">
      ${pdHeaderHtml('Invoice')}
      <div class="pd-meta">
        <div><span>Invoice no.</span><strong>#${pdEsc(pdOrderNo(order))}</strong></div>
        <div><span>Date</span><strong>${pdEsc(formatOrderTimestamp(order.createdAt))}</strong></div>
        <div><span>Payment</span><strong>${pdEsc(pdPayMethod(order.paymentMethod))}</strong></div>
        <div><span>Fulfillment</span><strong>${isDelivery ? 'Delivery' : 'Store pickup'}</strong></div>
      </div>
      <div class="pd-billto">
        <span class="pd-label">Billed to</span>
        <div class="pd-billto-name">${pdEsc(c.name || 'Guest')}</div>
        <div class="pd-billto-line">${[c.phone, c.email].filter(Boolean).map(pdEsc).join(' · ') || '—'}</div>
        ${isDelivery && c.address ? `<div class="pd-billto-line">${pdEsc(c.address)}</div>` : ''}
      </div>
      <table class="pd-table">
        <thead><tr><th>Item</th><th class="pd-num">Qty</th><th class="pd-num">Price</th><th class="pd-num">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="pd-totals">
        <div><span>Subtotal</span><span>${peso(totals.subtotal || 0)}</span></div>
        <div><span>${isDelivery ? 'Delivery fee' : 'Pickup fee'}</span><span>${peso(totals.deliveryFee || 0)}</span></div>
        <div class="pd-grand"><span>Total</span><span>${peso(totals.total || 0)}</span></div>
      </div>
      ${stamp}
      <div class="pd-foot">Thank you for choosing Crafts &amp; Crumbs ☕ — see you again soon!</div>
    </article>
  `;
}

function pdSlipHtml(order){
  const c = order.customer || {};
  const isDelivery = order.fulfillment === 'delivery';
  const itemCount = (order.items || []).reduce((s, it) => s + (it.qty || 0), 0);
  const rider = isDelivery && order.riderId ? ADMIN_RIDERS.find(r => r.uid === order.riderId) : null;

  const rows = (order.items || []).map((it, i) => `
    <tr class="pd-row" style="--i:${i}">
      <td class="pd-check"><span class="pd-box"></span></td>
      <td>
        <div class="pd-item-name">${pdEsc(it.name)}${it.size ? ` <span class="pd-item-size">(${pdEsc(it.size)})</span>` : ''}</div>
        ${it.optionsSummary ? `<div class="pd-item-opts">${pdEsc(it.optionsSummary)}</div>` : ''}
      </td>
      <td class="pd-num pd-qty">× ${pdEsc(it.qty)}</td>
    </tr>
  `).join('') || `<tr><td colspan="3" class="pd-empty">No items recorded on this order.</td></tr>`;

  return `
    <article class="pd-sheet pd-slip">
      ${pdHeaderHtml('Packing slip')}
      <div class="pd-meta">
        <div><span>Order no.</span><strong>#${pdEsc(pdOrderNo(order))}</strong></div>
        <div><span>Date</span><strong>${pdEsc(formatOrderTimestamp(order.createdAt))}</strong></div>
        <div><span>Fulfillment</span><strong>${isDelivery ? 'Delivery' : 'Store pickup'}</strong></div>
        <div><span>Items</span><strong>${itemCount}</strong></div>
      </div>
      <div class="pd-billto">
        <span class="pd-label">${isDelivery ? 'Deliver to' : 'Pickup for'}</span>
        <div class="pd-billto-name">${pdEsc(c.name || 'Guest')}</div>
        <div class="pd-billto-line">${[c.phone].filter(Boolean).map(pdEsc).join('') || '—'}</div>
        ${isDelivery ? `<div class="pd-billto-line">${pdEsc(c.address || 'No address on file')}</div>` : ''}
        ${rider ? `<div class="pd-billto-line">Rider: ${pdEsc(rider.name || rider.email || '')}</div>` : ''}
      </div>
      <table class="pd-table">
        <thead><tr><th class="pd-check"></th><th>Item</th><th class="pd-num">Qty</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="pd-sign">
        <div><span class="pd-sign-line"></span>Packed by</div>
        <div><span class="pd-sign-line"></span>Checked by</div>
      </div>
      <div class="pd-foot">Packing slip — no prices shown. Please check every item before sealing.</div>
    </article>
  `;
}

function pdEnsureModal(){
  if($('#pdOverlay').length) return;
  $('body').append(`
    <div class="legal-overlay" id="pdOverlay">
      <div class="legal-modal pd-modal" role="dialog" aria-modal="true" aria-labelledby="pdTitle">
        <button type="button" class="legal-close" id="pdClose" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <div class="legal-header">
          <div class="legal-icon">${PD_ICON_PRINTER}</div>
          <h2 id="pdTitle" style="font-size:18px;">Receipt</h2>
          <p id="pdSub"></p>
        </div>
        <div class="pd-tabs" role="tablist">
          <button type="button" class="pd-tab active" role="tab" data-pd-tab="invoice">Invoice</button>
          <button type="button" class="pd-tab" role="tab" data-pd-tab="slip">Packing slip</button>
        </div>
        <div class="legal-body pd-body"><div class="pd-preview" id="pdPreview"></div></div>
        <div class="legal-footer pd-footer">
          <button type="button" class="btn btn-outline" id="pdCloseBtn">Close</button>
          <button type="button" class="btn btn-primary" id="pdPrintBtn">${PD_ICON_PRINTER} Print / Save as PDF</button>
        </div>
      </div>
    </div>
  `);
}

function pdRender(){
  const { orders, type } = pdState;
  $('.pd-tab').removeClass('active').attr('aria-selected', 'false');
  $(`.pd-tab[data-pd-tab="${type}"]`).addClass('active').attr('aria-selected', 'true');
  const label = type === 'invoice' ? 'Invoice' : 'Packing slip';
  if(orders.length === 1){
    $('#pdTitle').text(`${label} · #${pdOrderNo(orders[0])}`);
    $('#pdSub').text('Preview below — print it or save it as a PDF.');
  } else {
    $('#pdTitle').text(`${label}s · ${orders.length} orders`);
    $('#pdSub').text('Each order prints on its own page.');
  }
  $('#pdPreview').html(orders.map(o => type === 'invoice' ? pdInvoiceHtml(o) : pdSlipHtml(o)).join(''));
  $('#pdPreview').parent().scrollTop(0);
}

function pdOpen(orderIds, type){
  const orders = orderIds.map(id => ADMIN_ORDERS.find(o => o.id === id)).filter(Boolean);
  if(!orders.length) return;
  pdEnsureModal();
  pdState = { orders, type: type === 'slip' ? 'slip' : 'invoice' };
  pdRender();
  $('#pdOverlay').addClass('open');
}

function pdClose(){ $('#pdOverlay').removeClass('open'); }

function pdPrint(){
  const html = $('#pdPreview').html();
  if(!html) return;
  $('#pdPrintRoot').remove();
  const $root = $('<div id="pdPrintRoot" aria-hidden="true"></div>').html(html).appendTo('body');
  const prevTitle = document.title;
  const first = pdState.orders[0];
  // The browser uses the page title as the default PDF file name.
  document.title = (pdState.type === 'invoice' ? 'Invoice' : 'Packing-slip') + '-' +
    (pdState.orders.length === 1 ? pdOrderNo(first) : pdState.orders.length + '-orders');
  document.body.classList.add('pd-printing');
  const cleanup = () => {
    document.body.classList.remove('pd-printing');
    document.title = prevTitle;
    $root.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // Give the browser a beat to lay the clone out before the dialog opens.
  setTimeout(() => window.print(), 80);
}

$(document).on('click', '[data-pd-open]', function(){
  pdOpen([String($(this).data('pd-open'))], $(this).data('pd-type'));
});
$(document).on('click', '.pd-tab', function(){
  pdState.type = $(this).data('pd-tab');
  pdRender(); // re-render so the paper "prints out" again
});
$(document).on('click', '#pdPrintBtn', pdPrint);
$(document).on('click', '#pdClose, #pdCloseBtn', pdClose);
$(document).on('click', '#pdOverlay', function(e){ if(e.target === this) pdClose(); });
$(document).on('keydown', function(e){
  if(e.key === 'Escape' && $('#pdOverlay').hasClass('open')) pdClose();
});

/* ----- Bulk selection in the Orders table ----- */
/* The checkbox column header is added here rather than in
   admin/index.html so this feature doesn't depend on that file. */
function pdEnsureSelectHeader(){
  const $tr = $('#adminOrdersBody').closest('table').find('thead tr').first();
  if(!$tr.length || $tr.find('.pd-sel-th').length) return;
  $tr.prepend('<th class="pd-sel-th"><input type="checkbox" id="pdSelAll" aria-label="Select all orders shown"></th>');
}

function pdEnsureSelBar(){
  if($('#pdSelBar').length) return;
  $('body').append(`
    <div class="pd-selbar" id="pdSelBar" role="region" aria-label="Print selected orders">
      <span class="pd-selbar-count" id="pdSelCount"></span>
      <button type="button" class="btn btn-primary btn-sm" id="pdSelInvoices">${PD_ICON_PRINTER} Invoices</button>
      <button type="button" class="btn btn-outline btn-sm" id="pdSelSlips">${PD_ICON_PRINTER} Packing slips</button>
      <button type="button" class="pd-selbar-clear" id="pdSelClear" aria-label="Clear selection">Clear</button>
    </div>
  `);
}

function pdSyncSelectUi(){
  // Drop ids that no longer exist (e.g. after a refresh).
  pdSelectedOrderIds.forEach(id => { if(!ADMIN_ORDERS.some(o => o.id === id)) pdSelectedOrderIds.delete(id); });
  pdEnsureSelBar();
  const n = pdSelectedOrderIds.size;
  $('#pdSelCount').text(`${n} selected`);
  $('#pdSelBar').toggleClass('show', n > 0);
  const shown = getFilteredOrders();
  const allShown = shown.length > 0 && shown.every(o => pdSelectedOrderIds.has(o.id));
  const someShown = shown.some(o => pdSelectedOrderIds.has(o.id));
  $('#pdSelAll').prop('checked', allShown).prop('indeterminate', !allShown && someShown);
}

$(document).on('change', '.pd-sel', function(){
  const id = String($(this).data('pd-sel'));
  if(this.checked) pdSelectedOrderIds.add(id); else pdSelectedOrderIds.delete(id);
  $(this).closest('tr').toggleClass('pd-row-selected', this.checked);
  pdSyncSelectUi();
});
$(document).on('change', '#pdSelAll', function(){
  const on = this.checked;
  getFilteredOrders().forEach(o => { if(on) pdSelectedOrderIds.add(o.id); else pdSelectedOrderIds.delete(o.id); });
  renderAdminOrdersTable();
});
$(document).on('click', '#pdSelInvoices', () => pdOpen([...pdSelectedOrderIds], 'invoice'));
$(document).on('click', '#pdSelSlips', () => pdOpen([...pdSelectedOrderIds], 'slip'));
$(document).on('click', '#pdSelClear', function(){
  pdSelectedOrderIds.clear();
  renderAdminOrdersTable();
});

/* ================= RETURNS & REFUNDS (Orders tab) =================
   Customers request a return from Order History on the storefront
   (completed orders only). Here the admin moves each request through
   Requested -> Approved | Rejected -> Refunded. Refunds are recorded
   MANUALLY: the admin sends the money back themselves (PayMongo
   dashboard / GCash) and then marks it refunded here; no payment API is
   called. Restocking is the admin's choice, item by item, when marking
   a return refunded. Docs live in the `returns` collection (doc id =
   order id); see orders-service.js + firestore.rules. */
const RT_STATUSES = ['requested', 'approved', 'rejected', 'refunded'];
const RT_LABELS = { requested: 'Requested', approved: 'Approved', rejected: 'Rejected', refunded: 'Refunded' };
let ADMIN_RETURNS = [];
let rtLoadFailed = false;
let rtFilter = 'all';
let rtOpenId = null; // order id of the return currently open in the modal

async function loadReturnsCache(){
  try{
    ADMIN_RETURNS = await window.CCOrders.fetchAllReturns();
    rtLoadFailed = false;
  } catch(err){
    // Never let a returns problem (e.g. rules not deployed yet) break the Orders table.
    console.error('Could not load return requests.', err);
    ADMIN_RETURNS = [];
    rtLoadFailed = true;
  }
}

function rtFor(orderId){ return ADMIN_RETURNS.find(r => r.id === orderId) || null; }

function rtMiniBadge(orderId){
  const r = rtFor(orderId);
  return r ? `<span class="rt-mini rt-mini-${pdEsc(r.status)}" title="Return request: ${pdEsc(RT_LABELS[r.status] || r.status)}">↩ ${pdEsc(RT_LABELS[r.status] || r.status)}</span>` : '';
}

function rtEnsurePanel(){
  if($('#rtPanel').length) return;
  const $panel = $(`
    <section class="rt-card" id="rtPanel">
      <button type="button" class="rt-toggle" id="rtToggle" aria-expanded="false" aria-controls="rtDropdown">
        <span class="rt-toggle-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
        </span>
        <span class="rt-toggle-main">
          <span class="rt-toggle-title">Returns &amp; Refunds</span>
          <span class="rt-toggle-sub" id="rtSub"></span>
        </span>
        <span class="rt-chips" id="rtChips"></span>
        <span class="rt-toggle-label">Show requests</span>
        <svg class="rt-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div class="rt-dropdown" id="rtDropdown">
        <div class="rt-dropdown-inner">
          <div class="rt-dropdown-pad">
            <div class="rt-toolbar">
              <div class="rt-pills" id="rtPills"></div>
              <button type="button" class="btn btn-outline btn-sm" id="rtRefresh">Refresh</button>
            </div>
            <div class="rt-list" id="rtList"></div>
          </div>
        </div>
      </div>
    </section>
  `);
  // Sit directly above the status filters / table, below the tab's own heading.
  const $anchor = $('#orderStatusFilters').closest('.admin-panel[data-admin-panel="orders"] > *');
  if($anchor.length) $anchor.before($panel);
  else $('.admin-panel[data-admin-panel="orders"]').prepend($panel);
}

function rtStepsHtml(status){
  const flow = status === 'rejected' ? ['requested', 'rejected'] : ['requested', 'approved', 'refunded'];
  const idx = flow.indexOf(status);
  return `<div class="rt-steps">${flow.map((s, i) => `
    <span class="rt-step ${i <= idx ? 'done' : ''} ${i === idx ? 'current' : ''} ${s === 'rejected' ? 'bad' : ''}">
      <span class="rt-step-dot"></span><span class="rt-step-label">${RT_LABELS[s]}</span>
    </span>`).join('<span class="rt-step-bar"></span>')}</div>`;
}

function rtRenderPanel(){
  rtEnsurePanel();
  const counts = { all: ADMIN_RETURNS.length };
  RT_STATUSES.forEach(s => { counts[s] = 0; });
  ADMIN_RETURNS.forEach(r => { if(counts[r.status] !== undefined) counts[r.status]++; });

  $('#rtSub').text(rtLoadFailed
    ? 'Could not load return requests'
    : counts.requested
      ? `${counts.requested} waiting for your review`
      : ADMIN_RETURNS.length ? 'No requests waiting' : 'No return requests yet');

  $('#rtChips').html(RT_STATUSES.map(s =>
    `<span class="rt-chip rt-chip-${s}${s === 'requested' && counts.requested ? ' attn' : ''}">${RT_LABELS[s]} <b>${counts[s]}</b></span>`).join(''));

  $('#rtPills').html(['all', ...RT_STATUSES].map(f => `
    <button type="button" class="order-filter-pill${f === rtFilter ? ' active' : ''}" data-rt-filter="${f}">
      ${f === 'all' ? 'All' : RT_LABELS[f]} <span class="order-filter-count">${counts[f] || 0}</span>
    </button>`).join(''));

  if(rtLoadFailed){
    $('#rtList').html('<p class="rt-empty">Could not load return requests. Make sure the latest firestore.rules is deployed, then press Refresh.</p>');
    return;
  }
  const list = rtFilter === 'all' ? ADMIN_RETURNS : ADMIN_RETURNS.filter(r => r.status === rtFilter);
  if(!list.length){
    $('#rtList').html(`<p class="rt-empty">${ADMIN_RETURNS.length ? `No ${pdEsc(RT_LABELS[rtFilter] || '').toLowerCase()} requests.` : 'Return requests from customers will show up here.'}</p>`);
    return;
  }
  $('#rtList').html(list.map((r, i) => {
    const c = r.customer || {};
    return `
      <div class="rt-row" style="--i:${i}">
        <div class="rt-row-main">
          <div class="rt-row-top">
            <span class="admin-order-id">#CC-${pdEsc(r.id.slice(0, 6).toUpperCase())}</span>
            <span class="rt-badge rt-badge-${pdEsc(r.status)}">${pdEsc(RT_LABELS[r.status] || r.status)}</span>
          </div>
          <div class="rt-row-cust">${pdEsc(c.name || 'Customer')} · ${pdEsc(r.reason || '—')}</div>
          <div class="rt-row-meta">Requested ${pdEsc(formatOrderTimestamp(r.createdAt))} · Refund ${peso(r.refundAmount || 0)}</div>
          ${rtStepsHtml(r.status)}
        </div>
        <button type="button" class="btn btn-outline btn-sm" data-rt-open="${pdEsc(r.id)}">${r.status === 'requested' || r.status === 'approved' ? 'Review' : 'View'}</button>
      </div>`;
  }).join(''));
}

$(document).on('click', '#rtToggle', function(){
  const open = $('#rtPanel').toggleClass('is-open').hasClass('is-open');
  $(this).attr('aria-expanded', open).find('.rt-toggle-label').text(open ? 'Hide requests' : 'Show requests');
});
$(document).on('click', '[data-rt-filter]', function(){
  rtFilter = $(this).data('rt-filter');
  rtRenderPanel();
});
$(document).on('click', '#rtRefresh', async function(){
  const $b = $(this).prop('disabled', true);
  await loadReturnsCache();
  rtRenderPanel();
  renderAdminOrdersTable();
  $b.prop('disabled', false);
});

/* ----- Return modal ----- */
function rtEnsureModal(){
  if($('#rtOverlay').length) return;
  $('body').append(`
    <div class="legal-overlay" id="rtOverlay">
      <div class="legal-modal order-detail-modal rt-modal" role="dialog" aria-modal="true" aria-labelledby="rtTitle">
        <button type="button" class="legal-close" id="rtClose" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <div class="legal-header order-detail-header">
          <h2 id="rtTitle" style="font-size:18px;">Return request</h2>
          <div class="order-detail-subtitle" id="rtSubtitle"></div>
        </div>
        <div class="legal-body order-detail-body" id="rtBody"></div>
        <div class="legal-footer rt-footer" id="rtFooter"></div>
      </div>
    </div>
  `);
}

/* Which product docs would a returned order line put stock back on?
   Mirrors finalizeStockAndEmail() in the storefront's script.js: combos
   draw down their drink (+size) and pastry, everything else its own
   count. Only products that already TRACK a numeric stock are returned,
   so restocking never starts tracking stock on an untracked product. */
function rtStockUpdatesFor(item){
  const out = [];
  if(String(item.id).startsWith('combo_')){
    const combo = COMBOS.find(c => 'combo_' + c.id === item.id);
    if(!combo) return out;
    const drink = PRODUCTS.find(p => p.id === combo.drinkId);
    const pastry = PRODUCTS.find(p => p.id === combo.pastryId);
    if(drink && typeof drink.stock === 'number') out.push({ id: drink.id, qty: item.qty, size: item.size || null });
    if(pastry && typeof pastry.stock === 'number') out.push({ id: pastry.id, qty: item.qty, size: null });
  } else {
    const p = PRODUCTS.find(x => x.id === item.id);
    if(p && typeof p.stock === 'number') out.push({ id: p.id, qty: item.qty, size: item.size || null });
  }
  return out;
}

async function rtOpen(orderId){
  const ret = rtFor(orderId);
  if(!ret) return;
  rtEnsureModal();
  rtOpenId = orderId;

  // Combo lines can only be mapped to their drink/pastry once combos are loaded.
  if((ret.items || []).some(it => String(it.id).startsWith('combo_')) && !COMBOS.length){
    try{ COMBOS = await window.CCCombos.fetchAllCombos(); } catch(err){ console.error(err); }
  }

  const c = ret.customer || {};
  const status = ret.status;
  const editable = status === 'requested' || status === 'approved';

  $('#rtTitle').text(`Return · #CC-${ret.id.slice(0, 6).toUpperCase()}`);
  $('#rtSubtitle').html(`
    <span class="rt-badge rt-badge-${pdEsc(status)}">${pdEsc(RT_LABELS[status] || status)}</span>
    <span class="order-detail-meta">Requested ${pdEsc(formatOrderTimestamp(ret.createdAt))}</span>
  `);

  const showRestock = status === 'approved';
  const itemsHtml = (ret.items || []).map((it, i) => {
    const tracked = rtStockUpdatesFor(it).length > 0;
    return `
      <label class="rt-item${showRestock && !tracked ? ' rt-item-off' : ''}">
        ${showRestock ? `<input type="checkbox" class="rt-restock" data-idx="${i}" ${tracked ? '' : 'disabled'}>` : ''}
        <span class="rt-item-info">
          <span class="rt-item-name">${pdEsc(it.name)}${it.size ? ` <span class="cart-dd-size">(${pdEsc(it.size)})</span>` : ''}</span>
          ${it.optionsSummary ? `<span class="rt-item-opts">${pdEsc(it.optionsSummary)}</span>` : ''}
          ${showRestock && !tracked ? `<span class="rt-item-opts">Stock isn't tracked for this item</span>` : ''}
        </span>
        <span class="rt-item-qty">× ${pdEsc(it.qty)}</span>
      </label>`;
  }).join('') || '<p class="order-detail-empty">No items recorded.</p>';

  const noteBlock = editable
    ? `<div class="order-detail-section">
         <h4>Your note ${status === 'requested' ? '(required if rejecting — the customer sees it)' : '(optional — the customer sees it)'}</h4>
         <textarea id="rtAdminNote" class="rt-textarea" rows="3" maxlength="500" placeholder="e.g. Approved — please bring the item to the shop / Rejected because…">${pdEsc(ret.adminNote || '')}</textarea>
       </div>`
    : (ret.adminNote ? `<div class="order-detail-section"><h4>Admin note</h4><div class="rt-quote">${pdEsc(ret.adminNote)}</div></div>` : '');

  const refundBlock = status === 'approved'
    ? `<div class="order-detail-section">
         <h4>Refund details</h4>
         <p class="rt-hint">Send ${peso(ret.refundAmount || 0)} back to the customer first (PayMongo dashboard / GCash), then mark it refunded here. Nothing is sent automatically.</p>
         <input id="rtRefundRef" class="rt-input" type="text" maxlength="80" placeholder="Refund reference / how it was sent (optional)">
       </div>`
    : (status === 'refunded' ? `<div class="order-detail-section"><h4>Refund</h4>
         <div class="order-detail-grid">
           <div class="order-detail-field"><label>Amount refunded</label><span>${peso(ret.refundAmount || 0)}</span></div>
           <div class="order-detail-field"><label>Refunded on</label><span>${pdEsc(formatOrderTimestamp(ret.refundedAt))}</span></div>
           <div class="order-detail-field order-detail-field-full"><label>Reference</label><span>${pdEsc(ret.refundRef || '—')}</span></div>
           <div class="order-detail-field order-detail-field-full"><label>Restocked</label><span>${pdEsc(ret.restockedSummary || 'Nothing was restocked')}</span></div>
         </div></div>` : '');

  $('#rtBody').html(`
    <div class="order-detail-section">${rtStepsHtml(status)}</div>
    <div class="order-detail-section">
      <h4>Customer</h4>
      <div class="order-detail-grid">
        <div class="order-detail-field"><label>Name</label><span>${pdEsc(c.name || '—')}</span></div>
        <div class="order-detail-field"><label>Phone</label><span>${pdEsc(c.phone || '—')}</span></div>
        <div class="order-detail-field"><label>Email</label><span>${pdEsc(c.email || '—')}</span></div>
        <div class="order-detail-field"><label>Refund amount (full)</label><span>${peso(ret.refundAmount || 0)}</span></div>
      </div>
    </div>
    <div class="order-detail-section">
      <h4>Reason</h4>
      <div class="rt-quote"><strong>${pdEsc(ret.reason || '—')}</strong>${ret.customerNote ? `<br>${pdEsc(ret.customerNote)}` : ''}</div>
    </div>
    <div class="order-detail-section">
      <h4>Items${showRestock ? ' — tick what goes back on the shelf' : ''}</h4>
      <div class="rt-items">${itemsHtml}</div>
    </div>
    ${refundBlock}
    ${noteBlock}
  `);

  const footer = [];
  if(status === 'requested'){
    footer.push('<button type="button" class="btn btn-outline" data-rt-act="reject" style="color:var(--adm-danger);">Reject</button>');
    footer.push('<button type="button" class="btn btn-primary" data-rt-act="approve">Approve return</button>');
  } else if(status === 'approved'){
    footer.push('<button type="button" class="btn btn-outline" data-rt-act="close">Close</button>');
    footer.push('<button type="button" class="btn btn-primary" data-rt-act="refund">Mark as refunded</button>');
  } else {
    footer.push('<button type="button" class="btn btn-outline" data-rt-act="close" style="flex:1;">Close</button>');
  }
  $('#rtFooter').html(footer.join(''));
  $('#rtOverlay').addClass('open');
}

function rtClose(){ $('#rtOverlay').removeClass('open'); rtOpenId = null; }

function rtActorName(){
  const u = window.currentUser;
  return (u && (u.displayName || u.email)) || 'Admin';
}

/* Fire-and-forget, like logActivity(): an email problem must never undo
   or block a return decision that already went through. The sender
   (window.sendReturnStatusEmail) lives in email-notifications.js; until
   it's added there, this quietly does nothing. */
function rtNotifyCustomer(ret, status){
  const c = ret.customer || {};
  if(typeof window.sendReturnStatusEmail !== 'function' || !c.email) return;
  Promise.resolve(window.sendReturnStatusEmail({
    toEmail: c.email,
    toName: c.name || 'there',
    orderNumber: 'CC-' + ret.id.slice(0, 6).toUpperCase(),
    status,
    statusLabel: RT_LABELS[status] || status,
    reason: ret.reason || '',
    adminNote: ret.adminNote || '',
    refundAmount: peso(ret.refundAmount || 0),
    refundRef: ret.refundRef || ''
  })).catch(err => console.error('Return status email failed (non-fatal):', err));
}

$(document).on('click', '[data-rt-open]', function(){ rtOpen(String($(this).data('rt-open'))); });
$(document).on('click', '#rtClose', rtClose);
$(document).on('click', '#rtOverlay', function(e){ if(e.target === this) rtClose(); });
$(document).on('keydown', function(e){
  if(e.key === 'Escape' && $('#rtOverlay').hasClass('open') && !$('#admConfirmOverlay').hasClass('open')) rtClose();
});

$(document).on('click', '[data-rt-act]', async function(){
  const act = $(this).data('rt-act');
  if(act === 'close'){ rtClose(); return; }
  const ret = rtFor(rtOpenId);
  if(!ret) return;
  const tag = `#CC-${ret.id.slice(0, 6).toUpperCase()}`;
  const adminNote = ($('#rtAdminNote').val() || '').trim();

  let nextStatus, fields, confirmOpts, doneMsg, logAction, logSummary;
  const now = new Date().toISOString();

  if(act === 'approve'){
    nextStatus = 'approved';
    fields = { status: 'approved', adminNote, reviewedBy: rtActorName(), reviewedAt: now };
    confirmOpts = { title: 'Approve this return?', message: `The customer will be told return ${tag} was approved. You still record the refund separately afterwards.`, confirmText: 'Approve' };
    doneMsg = `Return ${tag} approved.`;
    logAction = 'return-approve'; logSummary = `Approved return request for order ${tag}`;
  } else if(act === 'reject'){
    if(!adminNote){ showToast('Add a note explaining why — the customer will see it.', 'warning'); $('#rtAdminNote').trigger('focus'); return; }
    nextStatus = 'rejected';
    fields = { status: 'rejected', adminNote, reviewedBy: rtActorName(), reviewedAt: now };
    confirmOpts = { title: 'Reject this return?', message: `The customer will see your note. A rejected request can't be re-submitted for the same order.`, confirmText: 'Reject', danger: true };
    doneMsg = `Return ${tag} rejected.`;
    logAction = 'return-reject'; logSummary = `Rejected return request for order ${tag}`;
  } else if(act === 'refund'){
    nextStatus = 'refunded';
    const picked = $('.rt-restock:checked').map(function(){ return Number($(this).data('idx')); }).get();
    const pickedItems = picked.map(i => (ret.items || [])[i]).filter(Boolean);
    const summary = pickedItems.length
      ? pickedItems.map(it => `${it.name}${it.size ? ` (${it.size})` : ''} × ${it.qty}`).join(', ')
      : '';
    fields = {
      status: 'refunded', adminNote, refundRef: ($('#rtRefundRef').val() || '').trim(),
      restocked: pickedItems.length > 0, restockedSummary: summary,
      reviewedBy: rtActorName(), refundedAt: now
    };
    confirmOpts = {
      title: 'Mark as refunded?',
      message: `Confirm you've already sent ${peso(ret.refundAmount || 0)} back to the customer.${pickedItems.length ? ` ${pickedItems.length} item line(s) will be added back to stock.` : ' Nothing will be restocked.'}`,
      confirmText: 'Yes, refunded'
    };
    doneMsg = `Return ${tag} marked refunded.`;
    logAction = 'return-refund';
    logSummary = `Marked return for order ${tag} refunded (${peso(ret.refundAmount || 0)})${pickedItems.length ? `; restocked: ${summary}` : ''}`;
    fields._pickedItems = pickedItems; // stripped below, never written to Firestore
  } else return;

  const ok = await showConfirm(confirmOpts);
  if(!ok) return;

  const pickedItems = fields._pickedItems || [];
  delete fields._pickedItems;

  const $btns = $('#rtFooter .btn').prop('disabled', true);
  try{
    await window.CCOrders.updateReturn(ret.id, fields);
  } catch(err){
    console.error(err);
    showToast('Could not update that return. Please try again.', 'error');
    $btns.prop('disabled', false);
    return;
  }
  Object.assign(ret, fields);
  logActivity(logAction, 'order', ret.id, logSummary);

  // Restock AFTER the refund is saved: if this part fails the return is
  // still correctly recorded (and can't be restocked twice by a retry).
  let restockFailed = false;
  if(nextStatus === 'refunded' && pickedItems.length){
    try{
      const updates = pickedItems.flatMap(it => rtStockUpdatesFor(it));
      if(updates.length){
        await window.CCProducts.incrementStock(updates);
        await loadProductsFromFirestore();
        if(typeof renderAdminProductsTable === 'function') renderAdminProductsTable();
        if(typeof renderInventoryAlerts === 'function') renderInventoryAlerts();
        renderAdminOverviewStats();
      }
    } catch(err){
      console.error('Restock failed after refund was recorded.', err);
      restockFailed = true;
    }
  }

  rtNotifyCustomer(ret, nextStatus);
  rtClose();
  rtRenderPanel();
  renderAdminOrdersTable();
  showToast(restockFailed
    ? `${doneMsg} But restocking failed — please adjust stock manually in Products.`
    : doneMsg, restockFailed ? 'warning' : 'success');
});

/* Small "Return request" strip inside the Order Detail modal. */
function rtDetailSectionHtml(order){
  const r = rtFor(order.id);
  if(!r) return '';
  return `
    <div class="order-detail-section">
      <h4>Return request</h4>
      <div class="rt-detail-strip">
        <span class="rt-badge rt-badge-${pdEsc(r.status)}">${pdEsc(RT_LABELS[r.status] || r.status)}</span>
        <span class="rt-detail-reason">${pdEsc(r.reason || '')}</span>
        <button type="button" class="btn btn-outline btn-sm" data-rt-open="${pdEsc(r.id)}">Open</button>
      </div>
    </div>`;
}

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
    if(typeof renderCategories === 'function') renderCategories();
    if(typeof renderBestSellers === 'function') renderBestSellers();
    if(typeof renderMenuPage === 'function') renderMenuPage();
    if(typeof renderMerchPage === 'function') renderMerchPage();
    buildComboProducts();
    if(typeof renderFeaturedCombos === 'function') renderFeaturedCombos();
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
    if(typeof renderMenuPage === 'function') renderMenuPage();
    if(typeof renderMerchPage === 'function') renderMerchPage();
    buildComboProducts();
    if(typeof renderFeaturedCombos === 'function') renderFeaturedCombos();
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

/* ================= FIX MISSING riderId FIELD ON OLDER ORDERS ================= */
/* See the comment on CCOrders.backfillMissingRiderId — delivery orders
   placed before createOrder() started writing riderId: null explicitly
   never matched fetchAvailableDeliveries()'s riderId == null query (or
   the matching firestore.rules check), so they never appeared in any
   rider's Available Deliveries list at all. This adds the missing
   field to any delivery order that still lacks it. */
$(document).on('click', '#adminBackfillRiderIdBtn', async function(){
  const $btn = $(this);
  const $status = $('#adminBackfillRiderIdStatus');
  $btn.prop('disabled', true).text('Fixing...');
  $status.text('Scanning delivery orders for a missing riderId field...');
  try{
    const fixedIds = await window.CCOrders.backfillMissingRiderId();
    $status.text(fixedIds.length
      ? `Done — fixed ${fixedIds.length} delivery order${fixedIds.length === 1 ? '' : 's'}: ${fixedIds.join(', ')}.`
      : 'Done — every delivery order already had the riderId field.');
  } catch(err){
    console.error(err);
    $status.text('Something went wrong while fixing older orders. Check the console for details.');
  } finally {
    $btn.prop('disabled', false).text('Fix Older Delivery Orders');
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
    if(typeof renderCategories === 'function') renderCategories();
    if(typeof renderBestSellers === 'function') renderBestSellers();
    if(typeof renderMenuPage === 'function') renderMenuPage();
    if(typeof renderMerchPage === 'function') renderMerchPage();
    buildComboProducts();
    if(typeof renderFeaturedCombos === 'function') renderFeaturedCombos();
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
    if(typeof renderMenuPage === 'function') renderMenuPage();
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

/* ================= FIX BROKEN PRODUCT IMAGES ================= */
/* Repairs products still carrying a bare local filename in img/imgs
   (leftover from before Cloudinary uploads existed, or from a seed
   run before SEED_PRODUCTS was fixed to use a real placeholder) —
   these never resolve on this host and show as a broken-image icon
   everywhere that product appears. Swaps in the same "photo coming
   soon" placeholder the seed data now uses; never touches a product
   that already has a real Cloudinary URL. See
   CCProducts.fixBrokenProductImages for exactly how a broken
   reference is detected. Admins can still upload a real photo for
   any of these afterward through the normal Edit form — this just
   stops the broken-icon in the meantime. */
$(document).on('click', '#adminFixImagesBtn', async function(){
  const missingCount = PRODUCTS.filter(p =>
    !p.img || (Array.isArray(p.imgs) && p.imgs.some(src => !src))
  ).length;
  const ok = await showConfirm({
    title: 'Fix missing product images?',
    message: missingCount
      ? `${missingCount} product${missingCount === 1 ? '' : 's'} currently ${missingCount === 1 ? 'has' : 'have'} no image at all — this will give ${missingCount === 1 ? 'it' : 'them'} a "photo coming soon" placeholder. Existing images (including plain filenames like "croissant.jpg") are left alone — those aren't broken, just upload a real photo whenever you're ready. Continue?`
      : 'No products currently have a missing image — running this won\'t change anything. Continue anyway?',
    confirmText: 'Fix Images',
    danger: false
  });
  if(!ok) return;

  const $btn = $(this);
  const $status = $('#adminFixImagesStatus');
  $btn.prop('disabled', true).text('Fixing...');
  $status.text('Scanning every product for missing image references...');
  try{
    const fixedIds = await window.CCProducts.fixBrokenProductImages();
    await loadProductsFromFirestore();
    if(typeof renderMenuPage === 'function') renderMenuPage();
    if(typeof renderMerchPage === 'function') renderMerchPage();
    buildComboProducts();
    if(typeof renderFeaturedCombos === 'function') renderFeaturedCombos();
    renderAdminProductsTable();
    renderAdminOverviewStats();
    $status.text(fixedIds.length
      ? `Done — placeholder added for ${fixedIds.length} product${fixedIds.length === 1 ? '' : 's'} with no image: ${fixedIds.join(', ')}. Upload real photos for these any time from Edit.`
      : 'Done — no products were missing an image.');
  } catch(err){
    console.error(err);
    $status.text('Something went wrong while fixing images. Check the console for details.');
  } finally {
    $btn.prop('disabled', false).text('Fix Broken Product Images');
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
    if(typeof renderMenuPage === 'function') renderMenuPage();
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
/* Delivery pricing (route-based): base fee for the first few km, then a
   per-km charge, rounded up to the next few pesos, nothing past a max
   distance — measured from the shop's pin. The same formula runs in the
   storefront (script.js) and, authoritatively, on the server
   (api/_lib/deliveryFee.js). */
const AS_DEFAULT_SHOP = { lat: 14.6760, lng: 121.0437 };
let asShopMap = null;
let asShopMarker = null;

function asReadPricing(){
  return {
    baseFee: parseFloat($('#asBaseFee').val()),
    baseKm: parseFloat($('#asBaseKm').val()),
    perKm: parseFloat($('#asPerKm').val()),
    roundTo: parseFloat($('#asRoundTo').val()),
    maxKm: parseFloat($('#asMaxKm').val()),
    shopLat: parseFloat($('#asShopLat').val()),
    shopLng: parseFloat($('#asShopLng').val())
  };
}

function asFeeFor(km, p){
  const raw = p.baseFee + Math.max(0, km - p.baseKm) * p.perKm;
  return Math.ceil((raw - 1e-9) / p.roundTo) * p.roundTo;
}

function asRenderFeePreview(){
  const p = asReadPricing();
  const ok = [p.baseFee, p.baseKm, p.perKm, p.roundTo, p.maxKm].every(Number.isFinite) && p.roundTo >= 1 && p.maxKm > 0;
  if(!ok){ $('#asFeePreview').html(''); return; }
  const samples = [1, 2, 3, 4, 5, 7, 10].filter(km => km <= p.maxKm);
  if(!samples.includes(p.maxKm)) samples.push(p.maxKm);
  $('#asFeePreview').html(samples.map(km => `<span class="as-preview-chip"><b>${km} km</b> ${peso(asFeeFor(km, p))}</span>`).join('')
    + `<span class="as-preview-chip as-preview-none">over ${p.maxKm} km: not delivered</span>`);
}

function asSetShopPin(lat, lng, moveMap){
  $('#asShopLat').val(Number(lat).toFixed(6));
  $('#asShopLng').val(Number(lng).toFixed(6));
  if(asShopMarker) asShopMarker.setLatLng([lat, lng]);
  if(asShopMap && moveMap) asShopMap.setView([lat, lng], 16);
  const placeholder = Math.abs(lat - AS_DEFAULT_SHOP.lat) < 1e-6 && Math.abs(lng - AS_DEFAULT_SHOP.lng) < 1e-6;
  $('#asShopCoords').html(placeholder
    ? '⚠️ This is still the <strong>placeholder pin</strong> — move it to your shop, then save.'
    : `Shop pin: ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`);
}

function asInitShopMap(lat, lng){
  if(typeof L === 'undefined' || !document.getElementById('asShopMap')) return;
  if(!asShopMap){
    asShopMap = L.map('asShopMap').setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(asShopMap);
    asShopMarker = L.marker([lat, lng], { draggable: true }).addTo(asShopMap);
    asShopMarker.on('dragend', () => { const p = asShopMarker.getLatLng(); asSetShopPin(p.lat, p.lng, false); });
    asShopMap.on('click', (e) => asSetShopPin(e.latlng.lat, e.latlng.lng, false));
    // The Settings tab is hidden (0x0) until opened — re-measure whenever it
    // becomes visible so tiles don't render into a collapsed box.
    if(typeof ResizeObserver !== 'undefined'){
      new ResizeObserver(() => asShopMap.invalidateSize()).observe(document.getElementById('asShopMap'));
    }
  }
  asSetShopPin(lat, lng, true);
  setTimeout(() => asShopMap.invalidateSize(), 200);
}

$(document).on('input', '#asBaseFee, #asBaseKm, #asPerKm, #asRoundTo, #asMaxKm', asRenderFeePreview);
$(document).on('change', '#asShopLat, #asShopLng', function(){
  const lat = parseFloat($('#asShopLat').val()), lng = parseFloat($('#asShopLng').val());
  if(Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) asSetShopPin(lat, lng, true);
});

async function asSearchShop(){
  const q = $('#asShopSearch').val().trim();
  if(!q) return;
  const $btn = $('#asShopSearchBtn').prop('disabled', true).text('Searching...');
  try{
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`);
    const results = await res.json();
    if(!results.length){ showToast('Could not find that address. Drag the pin instead.', 'warning'); return; }
    asSetShopPin(parseFloat(results[0].lat), parseFloat(results[0].lon), true);
  } catch(err){
    console.error(err);
    showToast('Address search failed. Please try again.', 'error');
  } finally {
    $btn.prop('disabled', false).text('Search');
  }
}
$(document).on('click', '#asShopSearchBtn', asSearchShop);
$(document).on('keydown', '#asShopSearch', function(e){ if(e.key === 'Enter'){ e.preventDefault(); asSearchShop(); } });
$(document).on('click', '#asShopLocateBtn', function(){
  if(!navigator.geolocation){ showToast('Your browser does not support location access.', 'warning'); return; }
  const $btn = $(this).prop('disabled', true).text('Locating...');
  navigator.geolocation.getCurrentPosition(
    (pos) => { asSetShopPin(pos.coords.latitude, pos.coords.longitude, true); $btn.prop('disabled', false).text('Use my location'); },
    () => { showToast('Could not access your location. Drag the pin instead.', 'warning'); $btn.prop('disabled', false).text('Use my location'); }
  );
});

/* Populates the delivery pricing form from Firestore each time the
   dashboard is (re)rendered, e.g. on navigating to the Admin page. */
async function loadAndRenderAdminSettings(){
  try{
    const settings = await window.CCSettings.fetchSettings();
    const dp = settings.deliveryPricing;
    DELIVERY_FEE = dp.baseFee;
    $('#asBaseFee').val(dp.baseFee);
    $('#asBaseKm').val(dp.baseKm);
    $('#asPerKm').val(dp.perKm);
    $('#asRoundTo').val(dp.roundTo);
    $('#asMaxKm').val(dp.maxKm);
    asInitShopMap(Number(dp.shopLat), Number(dp.shopLng));
    asRenderFeePreview();
    LOW_STOCK_THRESHOLD = Number.isInteger(settings.lowStockThreshold) ? settings.lowStockThreshold : window.CCSettings.DEFAULT_LOW_STOCK_THRESHOLD;
    $('#asLowStock').val(LOW_STOCK_THRESHOLD);
    // Products render before settings finish loading, so redo the parts
    // that depend on the threshold.
    renderAdminProductsTable();
    renderInventoryAlerts();
  } catch(err){
    console.error('Could not load settings from Firestore.', err);
    // Fall back to the built-in defaults so the form isn't left blank.
    const d = window.CCSettings.DEFAULT_DELIVERY_PRICING;
    $('#asBaseFee').val(d.baseFee); $('#asBaseKm').val(d.baseKm); $('#asPerKm').val(d.perKm);
    $('#asRoundTo').val(d.roundTo); $('#asMaxKm').val(d.maxKm);
    asInitShopMap(d.shopLat, d.shopLng);
    asRenderFeePreview();
  }
}

$(document).on('submit', '#adminSettingsForm', async function(e){
  e.preventDefault();
  const p = asReadPricing();
  const $status = $('#adminSettingsStatus');
  if(![p.baseFee, p.baseKm, p.perKm].every(n => Number.isFinite(n) && n >= 0)){
    $status.text('Base fee, base distance and per-km charge must be zero or more.');
    return;
  }
  if(!Number.isFinite(p.roundTo) || p.roundTo < 1){
    $status.text('Round up to must be at least ₱1.');
    return;
  }
  if(!Number.isFinite(p.maxKm) || p.maxKm <= 0 || p.maxKm < p.baseKm){
    $status.text('Maximum distance must be greater than zero and at least the base distance.');
    return;
  }
  if(!Number.isFinite(p.shopLat) || !Number.isFinite(p.shopLng) || Math.abs(p.shopLat) > 90 || Math.abs(p.shopLng) > 180){
    $status.text('Set the shop location on the map first.');
    return;
  }
  const $btn = $('#adminSettingsSubmitBtn');
  $btn.prop('disabled', true).text('Saving...');
  $status.text('');
  try{
    const current = (await window.CCSettings.fetchSettings()).deliveryPricing;
    const pricing = { ...current, ...p };
    await window.CCSettings.updateDeliveryPricing(pricing);
    logActivity('update', 'settings', 'deliveryPricing',
      `Updated delivery pricing: ${peso(p.baseFee)} for the first ${p.baseKm} km, +${peso(p.perKm)}/km after, rounded up to ${peso(p.roundTo)}, max ${p.maxKm} km`);
    DELIVERY_FEE = p.baseFee;
    $status.text('Saved — new orders will be priced by distance.');
  } catch(err){
    console.error(err);
    $status.text('Something went wrong while saving. Check the console for details.');
  } finally {
    $btn.prop('disabled', false).text('Save Delivery Pricing');
  }
});

/* Inventory alert threshold. Whole number >= 1: 0 would make "low" and
   "out of stock" the same thing. */
$(document).on('submit', '#adminLowStockForm', async function(e){
  e.preventDefault();
  const n = Number($('#asLowStock').val());
  const $status = $('#adminLowStockStatus');
  if(!Number.isInteger(n) || n < 1 || n > 9999){
    $status.text('Enter a whole number between 1 and 9999.');
    return;
  }
  const $btn = $('#adminLowStockSubmitBtn');
  $btn.prop('disabled', true).text('Saving...');
  $status.text('');
  try{
    await window.CCSettings.updateLowStockThreshold(n);
    logActivity('update', 'settings', 'lowStockThreshold', `Updated low-stock threshold to ${n}`);
    LOW_STOCK_THRESHOLD = n;
    renderAdminProductsTable();
    renderInventoryAlerts();
    $status.text('Saved — alerts now flag products at or under ' + n + '.');
  } catch(err){
    console.error(err);
    $status.text('Something went wrong while saving. Check the console for details.');
  } finally {
    $btn.prop('disabled', false).text('Save Threshold');
  }
});

/* ================= LAUNCH POPUP ================= */
/* PROMO_PICK_LIMIT now lives in shared-catalog.js (loaded before this
   file) since resolvePromoProducts() there needs it too — don't
   redeclare it here, that throws a SyntaxError that silently kills
   this whole file (see the "no duplicate top-level names" rule). */

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
    const isPicked = promoPickedIds.includes(p.id);
    const catMeta = (typeof CAT_LABELS !== 'undefined') ? CAT_LABELS[p.cat] : null;
    const catLabel = (catMeta && catMeta.sub) || p.cat || '';
    return `
      <label class="promo-pick-row${isPicked ? ' is-picked' : ''}">
        <input type="checkbox" value="${p.id}" data-promo-pick ${isPicked ? 'checked' : ''}>
        <img class="promo-pick-row-thumb" src="${resolveImageSrc(thumb)}" alt="">
        <span class="promo-pick-row-name" title="${p.name}">${p.name}</span>
        <span class="promo-pick-row-cat">${catLabel}</span>
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
    $(this).closest('.promo-pick-row')
      .toggleClass('disabled', !isChecked && count >= PROMO_PICK_LIMIT)
      .toggleClass('is-picked', isChecked);
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

/* Enter picks the first visible match — lets a fast typist add a
   product without reaching for the mouse. No-ops past the limit or
   when nothing matches, same guard as the checkbox handler. */
$(document).on('keydown', '#ppProductSearch', function(e){
  if(e.key !== 'Enter') return;
  e.preventDefault();
  const $firstRow = $('#ppProductList .promo-pick-row:not(.disabled)').first();
  const $checkbox = $firstRow.find('[data-promo-pick]');
  if(!$checkbox.length || $checkbox.prop('checked')) return;
  $checkbox.prop('checked', true).trigger('change');
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
    logActivity('update', 'settings', 'promoPopup', 'Updated Launch Popup settings');
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

/* ================= POPULAR THIS WEEK (homepage carousel) ================= */
/* Same picker pattern as the launch popup above — separate state
   since this list isn't capped by a fixed layout the way the popup's
   3D stage is, just a sane admin-UX ceiling on the scrolling carousel. */
const BS_PICK_LIMIT = 12;
let bsPickedIds = [];

function renderBsSelectedChips(){
  const $chips = $('#bsSelectedChips');
  if(!bsPickedIds.length){ $chips.html('<p class="form-hint" style="margin:4px;">No products picked yet — the homepage will show the built-in default picks until you choose some.</p>'); return; }
  $chips.html(bsPickedIds.map(id => {
    const p = PRODUCTS.find(x => x.id === id);
    const name = p ? p.name : id;
    return `
      <span class="promo-pick-chip">
        <span class="promo-pick-chip-name">${name}</span>
        <button type="button" data-bs-unpick="${id}" aria-label="Remove ${name}">×</button>
      </span>`;
  }).join(''));
}

function renderBsProductList(searchTerm){
  const $list = $('#bsProductList');
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
    const isPicked = bsPickedIds.includes(p.id);
    const catMeta = (typeof CAT_LABELS !== 'undefined') ? CAT_LABELS[p.cat] : null;
    const catLabel = (catMeta && catMeta.sub) || p.cat || '';
    return `
      <label class="promo-pick-row${isPicked ? ' is-picked' : ''}">
        <input type="checkbox" value="${p.id}" data-bs-pick ${isPicked ? 'checked' : ''}>
        <img class="promo-pick-row-thumb" src="${resolveImageSrc(thumb)}" alt="">
        <span class="promo-pick-row-name" title="${p.name}">${p.name}</span>
        <span class="promo-pick-row-cat">${catLabel}</span>
        <span class="promo-pick-row-price">${priceLabel(p)}</span>
      </label>`;
  }).join(''));
  updateBsPickLimit();
}

function updateBsPickLimit(){
  const count = bsPickedIds.length;
  $('#bsPickCount').text(count ? `(${count}/${BS_PICK_LIMIT} selected)` : '');
  $('[data-bs-pick]').each(function(){
    const isChecked = bsPickedIds.includes(this.value);
    $(this).closest('.promo-pick-row')
      .toggleClass('disabled', !isChecked && count >= BS_PICK_LIMIT)
      .toggleClass('is-picked', isChecked);
  });
}

$(document).on('change', '[data-bs-pick]', function(){
  const id = this.value;
  if(this.checked){
    if(bsPickedIds.length >= BS_PICK_LIMIT){ this.checked = false; return; }
    bsPickedIds.push(id);
  } else {
    bsPickedIds = bsPickedIds.filter(x => x !== id);
  }
  renderBsSelectedChips();
  updateBsPickLimit();
});

$(document).on('click', '[data-bs-unpick]', function(){
  const id = $(this).attr('data-bs-unpick');
  bsPickedIds = bsPickedIds.filter(x => x !== id);
  $(`[data-bs-pick][value="${id}"]`).prop('checked', false);
  renderBsSelectedChips();
  updateBsPickLimit();
});

$(document).on('input', '#bsProductSearch', function(){
  renderBsProductList($(this).val());
});

$(document).on('keydown', '#bsProductSearch', function(e){
  if(e.key !== 'Enter') return;
  e.preventDefault();
  const $firstRow = $('#bsProductList .promo-pick-row:not(.disabled)').first();
  const $checkbox = $firstRow.find('[data-bs-pick]');
  if(!$checkbox.length || $checkbox.prop('checked')) return;
  $checkbox.prop('checked', true).trigger('change');
});

async function loadAndRenderAdminPopularSection(){
  $('#bsProductSearch').val('');
  try{
    const settings = await window.CCSettings.fetchSettings();
    const cfg = settings.popularSection || window.CCSettings.DEFAULT_POPULAR_SECTION;
    $('#bsEyebrow').val(cfg.eyebrow || 'Loved by regulars');
    $('#bsHeading').val(cfg.heading || 'Popular this week');
    $('#bsSubtext').val(cfg.subtext || 'Favorites our regulars keep reordering.');
    $('#bsButtonText').val(cfg.buttonText || 'View full menu');
    bsPickedIds = (cfg.productIds || []).slice(0, BS_PICK_LIMIT);
    renderBsSelectedChips();
    renderBsProductList('');
  } catch(err){
    console.error('Could not load homepage section settings from Firestore.', err);
    bsPickedIds = [];
    renderBsSelectedChips();
    renderBsProductList('');
  }
}

$(document).on('submit', '#adminBsForm', async function(e){
  e.preventDefault();
  const popularSection = {
    eyebrow: $('#bsEyebrow').val().trim() || 'Loved by regulars',
    heading: $('#bsHeading').val().trim() || 'Popular this week',
    subtext: $('#bsSubtext').val().trim() || 'Favorites our regulars keep reordering.',
    buttonText: $('#bsButtonText').val().trim() || 'View full menu',
    productIds: bsPickedIds.slice(0, BS_PICK_LIMIT)
  };

  const $btn = $('#adminBsSubmitBtn');
  const $status = $('#adminBsStatus');
  $btn.prop('disabled', true).text('Saving...');
  $status.text('');
  try{
    await window.CCSettings.updatePopularSection(popularSection);
    logActivity('update', 'settings', 'popularSection', 'Updated homepage Popular Section settings');
    // See the equivalent comment on the promo popup save above — this
    // only matters if admin.js happens to be running inside the full
    // customer page; harmless no-op on the standalone admin app.
    if(typeof POPULAR_SECTION_CONFIG !== 'undefined') POPULAR_SECTION_CONFIG = popularSection;
    if(typeof renderBestSellers === 'function') renderBestSellers();
    $status.text('Saved — the homepage will use this the next time it loads.');
  } catch(err){
    console.error(err);
    $status.text('Something went wrong while saving. Check the console for details.');
  } finally {
    $btn.prop('disabled', false).text('Save Homepage Section');
  }
});

/* ================= USER MANAGEMENT (tab id "accounts") =================
   Customers: view, edit (name + phone), suspend/reactivate.
   Admins: view, add (promote a registered account), edit (name + phone),
   remove admin access (demote to customer — the account itself is kept).
   Free-tier version: everything reads/writes the users/{uid} Firestore
   docs directly through window.CCAccounts (accounts-service.js), so:
   1. Only accounts with a users/{uid} profile doc are listed (signup
      creates it — see auth.js); raw Firebase Auth accounts can't be
      listed from the client.
   2. "Suspend" is the app-enforced disabled flag, not an Auth-level
      disable: auth.js signs a disabled account out on its next check.
   3. There is no true account delete (Admin-SDK only), which is why
      "delete admin" means remove admin access.
   Every write is gated by firestore.rules (admin-only, never on your OWN
   role/disabled; only fullName/phone/role/disabled on someone else's
   doc). The disabled buttons on your own row are a courtesy only. */

function currentAdminUid(){
  return (window.currentUser && window.currentUser.uid) || null;
}

/* Names/phones are typed by customers and shown here to admins, so they
   are escaped before going into innerHTML. */
function umEsc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

let ADMIN_ACCOUNTS = [];
let adminAccountSearch = ''; // current text in the User Management search box
let umEditingUid = null;
const UM_PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

async function loadAndRenderAdminAccounts(){
  $('#adminAccountsBody').html(`<tr><td colspan="6" class="admin-empty-row">Loading accounts...</td></tr>`);
  $('#adminAdminsBody').html(`<tr><td colspan="4" class="admin-empty-row">Loading accounts...</td></tr>`);
  try{
    ADMIN_ACCOUNTS = await window.CCAccounts.listUserProfiles();
  } catch(err){
    console.error(err);
    const msg = umEsc(err.message || 'Could not load accounts.');
    $('#adminAccountsBody').html(`<tr><td colspan="6" class="admin-empty-row">${msg}</td></tr>`);
    $('#adminAdminsBody').html(`<tr><td colspan="4" class="admin-empty-row">${msg}</td></tr>`);
    return;
  }
  renderAdminAccountsTable();
}

function umMatches(u, q){
  if(!q) return true;
  return (u.email || '').toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q) ||
    (u.phone || '').toLowerCase().includes(q) || u.uid.toLowerCase().includes(q);
}

const UM_ICON_EDIT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
const UM_ICON_SUSPEND = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const UM_ICON_REACTIVATE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/></svg>';
const UM_ICON_REMOVE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M17 8l5 5M22 8l-5 5"/></svg>';

function umAccountCell(u){
  return `<div class="admin-customer-link" style="cursor:default;">
    <span class="admin-avatar">${umEsc(customerInitials(u.email || u.name || '?'))}</span>
    <span>${umEsc(u.email || '(no email)')}</span>
  </div>`;
}

function renderAdminAccountsTable(){
  const q = adminAccountSearch.trim().toLowerCase();
  const customers = ADMIN_ACCOUNTS.filter(u => u.role !== 'admin');
  const admins = ADMIN_ACCOUNTS.filter(u => u.role === 'admin');
  $('#umCustomerCount').text(customers.length);
  $('#umAdminCount').text(admins.length);

  const cList = customers.filter(u => umMatches(u, q));
  if(!customers.length) $('#adminAccountsBody').html(`<tr><td colspan="6" class="admin-empty-row">No customer accounts yet.</td></tr>`);
  else if(!cList.length) $('#adminAccountsBody').html(`<tr><td colspan="6" class="admin-empty-row">No customers match your search.</td></tr>`);
  else $('#adminAccountsBody').html(cList.map(u => `
    <tr${u.disabled ? ' class="admin-row-inactive"' : ''}>
      <td>${umAccountCell(u)}</td>
      <td>${umEsc(u.name || 'No name')}</td>
      <td>${umEsc(u.phone || '—')}</td>
      <td>
        <select class="admin-status-select admin-role-${u.role === 'rider' ? 'rider' : 'customer'}" data-um-role="${umEsc(u.uid)}">
          <option value="customer" ${u.role !== 'rider' ? 'selected' : ''}>Customer</option>
          <option value="rider" ${u.role === 'rider' ? 'selected' : ''}>Rider</option>
        </select>
      </td>
      <td>${u.disabled
        ? '<span class="admin-stock-badge admin-stock-out">Suspended</span>'
        : '<span class="admin-stock-badge admin-stock-ok">Active</span>'}</td>
      <td class="admin-td-actions">
        <button type="button" class="admin-icon-btn" data-um-edit="${umEsc(u.uid)}" title="Edit name &amp; phone" aria-label="Edit ${umEsc(u.email || u.name || 'account')}">${UM_ICON_EDIT}</button>
        <button type="button" class="admin-icon-btn${u.disabled ? '' : ' admin-icon-btn-danger'}" data-um-suspend="${umEsc(u.uid)}" data-disabled="${!!u.disabled}" title="${u.disabled ? 'Reactivate' : 'Suspend'} account" aria-label="${u.disabled ? 'Reactivate' : 'Suspend'} ${umEsc(u.email || u.name || 'account')}">${u.disabled ? UM_ICON_REACTIVATE : UM_ICON_SUSPEND}</button>
      </td>
    </tr>`).join(''));

  const aList = admins.filter(u => umMatches(u, q));
  if(!admins.length) $('#adminAdminsBody').html(`<tr><td colspan="4" class="admin-empty-row">No admin accounts found.</td></tr>`);
  else if(!aList.length) $('#adminAdminsBody').html(`<tr><td colspan="4" class="admin-empty-row">No admins match your search.</td></tr>`);
  else $('#adminAdminsBody').html(aList.map(u => {
    const isSelf = u.uid === currentAdminUid();
    return `
    <tr>
      <td>${umAccountCell(u)}${isSelf ? ' <span class="um-you">You</span>' : ''}</td>
      <td>${umEsc(u.name || 'No name')}</td>
      <td>${umEsc(u.phone || '—')}</td>
      <td class="admin-td-actions">
        <button type="button" class="admin-icon-btn" data-um-edit="${umEsc(u.uid)}" title="Edit name &amp; phone" aria-label="Edit ${umEsc(u.email || u.name || 'admin')}">${UM_ICON_EDIT}</button>
        <button type="button" class="admin-icon-btn admin-icon-btn-danger" data-um-remove-admin="${umEsc(u.uid)}" ${isSelf ? 'disabled title="You can\'t remove your own admin access"' : 'title="Remove admin access"'} aria-label="Remove admin access for ${umEsc(u.email || u.name || 'admin')}">${UM_ICON_REMOVE}</button>
      </td>
    </tr>`;
  }).join(''));
}

$(document).on('input', '#adminAccountSearch', function(){
  adminAccountSearch = $(this).val();
  renderAdminAccountsTable();
});
$(document).on('click', '#adminRefreshAccounts', loadAndRenderAdminAccounts);

/* Customers / Admins sub-tabs — own classes (.um-subtab / .um-panel) so
   they never collide with the Products tab's .admin-subtab handler. */
$(document).on('click', '.um-subtab', function(){
  const tab = $(this).data('um-tab');
  $('.um-subtab').removeClass('active');
  $(this).addClass('active');
  $('.um-panel').removeClass('active');
  $(`.um-panel[data-um-panel="${tab}"]`).addClass('active');
});

/* ---------- Edit (name + phone) ---------- */
function umCloseEdit(){ $('#umEditOverlay').removeClass('open'); umEditingUid = null; }

$(document).on('click', '[data-um-edit]', function(){
  const uid = $(this).attr('data-um-edit');
  const user = ADMIN_ACCOUNTS.find(u => u.uid === uid);
  if(!user) return;
  umEditingUid = uid;
  $('#umEditEmail').text(user.email || uid);
  $('#umEditName').val(user.name || '');
  $('#umEditPhone').val(user.phone || '');
  $('#umEditError').hide().text('');
  $('#umEditOverlay').addClass('open');
  setTimeout(() => $('#umEditName').trigger('focus'), 50);
});
$(document).on('click', '#umEditClose', umCloseEdit);
$(document).on('click', '#umEditOverlay', function(e){ if(e.target === this) umCloseEdit(); });

$(document).on('submit', '#umEditForm', async function(e){
  e.preventDefault();
  const user = ADMIN_ACCOUNTS.find(u => u.uid === umEditingUid);
  if(!user) return;
  const fullName = $('#umEditName').val().trim();
  const phone = $('#umEditPhone').val().trim();
  const fail = msg => $('#umEditError').text(msg).show();
  if(!fullName) return fail('Name is required.');
  if(fullName.length > 80) return fail('Name must be 80 characters or fewer.');
  if(!UM_PHONE_RE.test(phone) || phone.replace(/\D/g, '').length < 7) return fail('Enter a valid phone number (digits, spaces, + ( ) and - only).');
  if(fullName === (user.name || '') && phone === (user.phone || '')){ umCloseEdit(); return; }

  const $save = $('#umEditSave').prop('disabled', true).text('Saving...');
  try{
    await window.CCAccounts.updateUserProfile(user.uid, { fullName, phone });
    logActivity('update', 'account', user.uid, `Edited name/phone for ${user.email || user.uid}`);
    user.name = fullName; user.phone = phone;
    renderAdminAccountsTable();
    umCloseEdit();
    showToast('Account updated.', 'success');
  } catch(err){
    console.error(err);
    fail(err.message || 'Could not save changes.');
  } finally {
    $save.prop('disabled', false).text('Save changes');
  }
});

/* ---------- Customers: suspend / reactivate, and the Customer/Rider role ---------- */
$(document).on('click', '[data-um-suspend]', async function(){
  const $btn = $(this);
  const uid = $btn.attr('data-um-suspend');
  const user = ADMIN_ACCOUNTS.find(u => u.uid === uid);
  const nextDisabled = $btn.attr('data-disabled') !== 'true';

  const ok = await showConfirm({
    title: nextDisabled ? 'Suspend this account?' : 'Reactivate this account?',
    message: nextDisabled
      ? `${user?.email || uid} won't be able to use the site until you reactivate them. They are signed out the next time the app checks their account.`
      : `${user?.email || uid} will be able to use the site again.`,
    confirmText: nextDisabled ? 'Suspend' : 'Reactivate',
    danger: nextDisabled
  });
  if(!ok) return;

  $btn.prop('disabled', true);
  try{
    await window.CCAccounts.setUserDisabled(uid, nextDisabled);
    logActivity('update', 'account', uid, `${nextDisabled ? 'Suspended' : 'Reactivated'} account ${user?.email || uid}`);
    if(user) user.disabled = nextDisabled;
    showToast(`${user?.email || uid} is now ${nextDisabled ? 'suspended' : 'active'}.`, 'success');
    renderAdminAccountsTable();
  } catch(err){
    console.error(err);
    showToast(err.message || 'Could not update that account.', 'error');
    $btn.prop('disabled', false);
  }
});

/* Kept from the old Accounts tab: the rider app and the Orders "assign
   rider" dropdown depend on accounts having role:'rider', and this is
   the only place that role gets assigned. */
$(document).on('change', '[data-um-role]', async function(){
  const $select = $(this);
  const uid = $select.attr('data-um-role');
  const newRole = $select.val();
  const user = ADMIN_ACCOUNTS.find(u => u.uid === uid);
  const prevRole = user ? user.role : 'customer';
  if(newRole === prevRole) return;

  const ok = await showConfirm({
    title: newRole === 'rider' ? 'Make this account a rider?' : 'Make this account a customer?',
    message: newRole === 'rider'
      ? `${user?.email || uid} will be able to sign in to the rider app and claim/deliver orders.`
      : `${user?.email || uid} will lose rider app access.`,
    confirmText: newRole === 'rider' ? 'Make Rider' : 'Make Customer'
  });
  if(!ok){ $select.val(prevRole); return; }

  $select.prop('disabled', true);
  try{
    await window.CCAccounts.setUserRole(uid, newRole);
    logActivity('update', 'account', uid, `Changed ${user?.email || uid}'s role to ${newRole === 'rider' ? 'a rider' : 'a customer'}`);
    if(user) user.role = newRole;
    showToast(`${user?.email || uid} is now ${newRole === 'rider' ? 'a rider' : 'a customer'}.`, 'success');
    renderAdminAccountsTable();
  } catch(err){
    console.error(err);
    showToast(err.message || "Could not change that account's role.", 'error');
    $select.val(prevRole).prop('disabled', false);
  }
});

/* ---------- Admins: add (promote) / remove access ---------- */
function umCloseAddAdmin(){ $('#umAddAdminOverlay').removeClass('open'); }

function renderUmAddAdminList(){
  const q = ($('#umAddAdminSearch').val() || '').trim().toLowerCase();
  // Suspended accounts are left out: auth.js would sign them straight back out.
  const pool = ADMIN_ACCOUNTS.filter(u => u.role !== 'admin' && !u.disabled && umMatches(u, q));
  if(!pool.length){
    $('#umAddAdminList').html(`<div class="inv-empty">${q ? 'No registered accounts match that search.' : 'No accounts available to promote.'}</div>`);
    return;
  }
  $('#umAddAdminList').html(pool.slice(0, 8).map(u => `
    <div class="um-pick-row">
      <span class="admin-avatar">${umEsc(customerInitials(u.email || u.name || '?'))}</span>
      <div class="um-pick-main"><strong>${umEsc(u.name || 'No name')}</strong><span>${umEsc(u.email || '(no email)')}</span></div>
      <button type="button" class="btn btn-outline btn-sm" data-um-make-admin="${umEsc(u.uid)}">Make admin</button>
    </div>`).join('') + (pool.length > 8 ? `<p class="form-hint">Showing 8 of ${pool.length} — type to narrow it down.</p>` : ''));
}

$(document).on('click', '#umAddAdminBtn', function(){
  $('#umAddAdminSearch').val('');
  renderUmAddAdminList();
  $('#umAddAdminOverlay').addClass('open');
  setTimeout(() => $('#umAddAdminSearch').trigger('focus'), 50);
});
$(document).on('input', '#umAddAdminSearch', renderUmAddAdminList);
$(document).on('click', '#umAddAdminClose', umCloseAddAdmin);
$(document).on('click', '#umAddAdminOverlay', function(e){ if(e.target === this) umCloseAddAdmin(); });

$(document).on('click', '[data-um-make-admin]', async function(){
  const $btn = $(this);
  const uid = $btn.attr('data-um-make-admin');
  const user = ADMIN_ACCOUNTS.find(u => u.uid === uid);
  if(!user) return;
  const ok = await showConfirm({
    title: 'Grant admin access?',
    message: `${user.email || uid} will be able to sign in to this dashboard and manage products, orders, and other accounts.`,
    confirmText: 'Make Admin'
  });
  if(!ok) return;
  $btn.prop('disabled', true);
  try{
    await window.CCAccounts.setUserRole(uid, 'admin');
    logActivity('update', 'account', uid, `Added ${user.email || uid} as an admin`);
    user.role = 'admin';
    renderAdminAccountsTable();
    umCloseAddAdmin();
    showToast(`${user.email || uid} is now an admin.`, 'success');
  } catch(err){
    console.error(err);
    showToast(err.message || 'Could not add that admin.', 'error');
    $btn.prop('disabled', false);
  }
});

$(document).on('click', '[data-um-remove-admin]', async function(){
  const $btn = $(this);
  const uid = $btn.attr('data-um-remove-admin');
  const user = ADMIN_ACCOUNTS.find(u => u.uid === uid);
  if(!user || uid === currentAdminUid()) return;
  const ok = await showConfirm({
    title: 'Remove admin access?',
    message: `${user.email || uid} will become a regular customer account and lose access to this dashboard. The account itself is not deleted.`,
    confirmText: 'Remove Access',
    danger: true
  });
  if(!ok) return;
  $btn.prop('disabled', true);
  try{
    await window.CCAccounts.setUserRole(uid, 'customer');
    logActivity('update', 'account', uid, `Removed admin access from ${user.email || uid}`);
    user.role = 'customer';
    renderAdminAccountsTable();
    showToast(`${user.email || uid} is no longer an admin.`, 'success');
  } catch(err){
    console.error(err);
    showToast(err.message || 'Could not remove admin access.', 'error');
    $btn.prop('disabled', false);
  }
});

/* Escape closes the two modals above, unless a confirm dialog sitting on
   top of them is the thing being dismissed (admin-ui.js handles that one). */
$(document).on('keydown', function(e){
  if(e.key !== 'Escape' || $('#admConfirmOverlay').hasClass('open')) return;
  if($('#umEditOverlay').hasClass('open')) umCloseEdit();
  if($('#umAddAdminOverlay').hasClass('open')) umCloseAddAdmin();
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
  if(typeof renderFeaturedCombos === 'function') renderFeaturedCombos();
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
            <img src="${resolveImageSrc(c.img || blankPlaceholder(c.id, 'Combo'))}" alt="${c.name}">
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
  setImagePreview('acImgPreviewImg', 'acImgPreviewPlaceholder', resolveImageSrc(c.img) || '');
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
    logActivity('update', 'combo', id, `"${c.name}" set to ${c.active ? 'active' : 'inactive'}`);
    buildComboProducts();
    if(typeof renderFeaturedCombos === 'function') renderFeaturedCombos();
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
  if(!c) return;
  const ok = await showConfirm({
    title: `Delete "${c.name}"?`,
    message: "This can't be undone.",
    confirmText: 'Delete',
    danger: true
  });
  if(!ok) return;
  try{
    await window.CCCombos.deleteCombo(id);
    logActivity('delete', 'combo', id, `Deleted combo "${c.name}"`);
    COMBOS = COMBOS.filter(x => x.id !== id);
    buildComboProducts();
    if(typeof renderFeaturedCombos === 'function') renderFeaturedCombos();
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
      logActivity('update', 'combo', adminEditingComboId, `Updated combo "${fields.name}"`);
      const idx = COMBOS.findIndex(x => x.id === adminEditingComboId);
      if(idx > -1) COMBOS[idx] = { id: adminEditingComboId, ...fields };
      buildComboProducts();
      if(typeof renderFeaturedCombos === 'function') renderFeaturedCombos();
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
    logActivity('create', 'combo', newId, `Added combo "${fields.name}"`);
    COMBOS.push({ id: newId, ...fields });
    buildComboProducts();
    if(typeof renderFeaturedCombos === 'function') renderFeaturedCombos();
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

/* ================= MESSAGES INBOX (Contact form) =================
   Conversations started on the storefront Contact page live in
   `contactMessages`; each later message is a doc in its `replies`
   subcollection (see contact-service.js + the rules block of the same
   name). A reply written here shows up in that customer's "My Messages"
   page. Guest messages (no account) can't receive in-app replies, so
   those get a "Reply by email" mailto: instead. */
let ADMIN_INBOX = [];
let inboxFilter = 'new';      // 'new' | 'handled' | 'all'
let inboxOpenId = null;
let inboxReplies = [];
let inboxLoadFailed = false;

/* Messages from before replies existed have no adminUnread flag, so
   fall back to "not handled yet" for those. */
function inboxIsUnread(m){
  return typeof m.adminUnread === 'boolean' ? m.adminUnread : m.status !== 'handled';
}

async function loadAndRenderInbox(){
  if(!window.CCContact) return;
  $('#inboxBody').html(`<tr><td colspan="5" class="admin-empty-row">Loading messages...</td></tr>`);
  try{
    ADMIN_INBOX = await window.CCContact.fetchAllMessages();
    inboxLoadFailed = false;
  } catch(err){
    // A messages problem (e.g. rules not deployed yet) must never break the rest of the dashboard.
    console.error('Could not load messages.', err);
    ADMIN_INBOX = [];
    inboxLoadFailed = true;
  }
  renderInbox(true);
}

function renderInbox(animate){
  const unread = ADMIN_INBOX.filter(inboxIsUnread).length;
  const $badge = $('#inboxTabBadge');
  const badgeChanged = $badge.text() !== String(unread);
  $badge.text(unread).prop('hidden', unread === 0);
  if(badgeChanged && unread > 0){
    if($badge[0]){ $badge.removeClass('pop'); void $badge[0].offsetWidth; $badge.addClass('pop'); }
  }
  $('#inboxBody').toggleClass('inbox-anim', animate === true);

  const open = ADMIN_INBOX.filter(m => m.status !== 'handled').length;
  const filters = [
    { key:'new', label:'New', count:open },
    { key:'handled', label:'Handled', count:ADMIN_INBOX.length - open },
    { key:'all', label:'All', count:ADMIN_INBOX.length }
  ];
  $('#inboxFilters').html(filters.map(f =>
    `<button type="button" class="range-filter-pill${f.key === inboxFilter ? ' active' : ''}" data-inbox-filter="${f.key}">${f.label} (${f.count})</button>`
  ).join(''));

  if(inboxLoadFailed){
    $('#inboxBody').html(`<tr><td colspan="5" class="admin-empty-row">Could not load messages. Check that the latest firestore.rules are deployed, then refresh.</td></tr>`);
    return;
  }
  let rows = ADMIN_INBOX;
  if(inboxFilter === 'new') rows = rows.filter(m => m.status !== 'handled');
  if(inboxFilter === 'handled') rows = rows.filter(m => m.status === 'handled');
  if(!rows.length){
    $('#inboxBody').html(`<tr><td colspan="5" class="admin-empty-row">${inboxFilter === 'new' ? 'No new messages.' : 'Nothing here yet.'}</td></tr>`);
    return;
  }
  $('#inboxBody').html(rows.map(m => {
    const handled = m.status === 'handled';
    const isUnread = inboxIsUnread(m);
    return `<tr class="inbox-row${isUnread ? ' inbox-unread' : ''}" data-inbox-open="${umEsc(m.id)}" tabindex="0">
      <td><strong>${umEsc(m.name || 'No name')}</strong>${m.userId ? '' : ' <span class="inbox-guest">Guest</span>'}<div class="inbox-sub">${umEsc(m.email || '')}</div></td>
      <td>${umEsc(m.subject || '(no subject)')}</td>
      <td>${umEsc(formatOrderTimestamp(m.lastActivityAt || m.createdAt))}</td>
      <td><span class="order-status-badge inbox-status-${handled ? 'handled' : 'new'}">${handled ? 'Handled' : 'New'}</span></td>
      <td><button type="button" class="btn btn-outline btn-sm" data-inbox-open="${umEsc(m.id)}">Open</button></td>
    </tr>`;
  }).join(''));
}

$(document).on('click', '#inboxRefresh', loadAndRenderInbox);
$(document).on('click', '[data-inbox-filter]', function(){
  inboxFilter = $(this).attr('data-inbox-filter');
  renderInbox(true);
});

/* ---------- Conversation modal (built once, on first open) ---------- */
function inboxEnsureModal(){
  if($('#inboxOverlay').length) return;
  $('body').append(`
    <div class="inbox-overlay" id="inboxOverlay">
      <div class="inbox-modal" role="dialog" aria-modal="true" aria-labelledby="inboxModalSubject">
        <div class="inbox-modal-head">
          <h3 id="inboxModalSubject"></h3>
          <button type="button" class="admin-icon-btn" id="inboxClose" aria-label="Close">&times;</button>
        </div>
        <div class="inbox-meta" id="inboxMeta"></div>
        <div class="inbox-thread" id="inboxThread"></div>
        <div class="inbox-composer" id="inboxComposer">
          <textarea id="inboxReplyText" rows="3" maxlength="2000" placeholder="Write a reply. The customer will see it in My Messages."></textarea>
          <button type="button" class="btn btn-primary" id="inboxSendReply">Send reply</button>
        </div>
        <p class="inbox-guest-note" id="inboxGuestNote" hidden>This customer wasn't logged in, so they can't read replies in the app. Use "Reply by email" instead.</p>
        <div class="inbox-actions">
          <a class="btn btn-outline" id="inboxReply" href="#">Reply by email</a>
          <button type="button" class="btn btn-outline" id="inboxToggleStatus"></button>
        </div>
      </div>
    </div>`);
}

function inboxCloseModal(){
  $('#inboxOverlay').removeClass('open');
  inboxOpenId = null;
  renderInbox();
}

function inboxBubble(role, who, text, time){
  return `<div class="inbox-bubble-row inbox-bubble-row-${role}">
    <div class="inbox-bubble inbox-bubble-${role}">
      <div class="inbox-bubble-who">${umEsc(who)}</div>
      <div class="inbox-bubble-text">${umEsc(text)}</div>
      <div class="inbox-bubble-time">${umEsc(formatOrderTimestamp(time))}</div>
    </div>
  </div>`;
}

function inboxFillModal(m, mode){
  const handled = m.status === 'handled';
  const isMember = !!m.userId;
  $('#inboxModalSubject').text(m.subject || '(no subject)');
  $('#inboxMeta').html(
    `<span><strong>${umEsc(m.name || 'No name')}</strong> &lt;${umEsc(m.email || '')}&gt;</span>` +
    `<span>${isMember ? 'Registered customer' : 'Guest'}</span>`
  );
  const bubbles = [inboxBubble('customer', m.name || 'Customer', m.message, m.createdAt)]
    .concat(inboxReplies.map(r => r.authorRole === 'admin'
      ? inboxBubble('admin', 'You (store)', r.text, r.createdAt)
      : inboxBubble('customer', m.name || 'Customer', r.text, r.createdAt)));
  if(mode === 'send') bubbles[bubbles.length - 1] = bubbles[bubbles.length - 1].replace('inbox-bubble-row ', 'inbox-bubble-row is-new ');
  $('#inboxThread').toggleClass('inbox-anim-all', mode === 'open').html(bubbles.join(''));
  const th = $('#inboxThread')[0]; if(th) th.scrollTop = th.scrollHeight;
  $('#inboxComposer').toggle(isMember);
  $('#inboxGuestNote').prop('hidden', isMember);
  $('#inboxReply').attr('href', `mailto:${encodeURIComponent(m.email || '')}?subject=${encodeURIComponent('Re: ' + (m.subject || 'Your message to Crafts & Crumbs'))}`);
  $('#inboxToggleStatus').text(handled ? 'Mark as new' : 'Mark as handled');
}

$(document).on('click keydown', '[data-inbox-open]', async function(e){
  if(e.type === 'keydown' && e.key !== 'Enter') return;
  if(e.type === 'click' && $(e.target).closest('button').length && !$(this).is('button')) return; // the row's own Open button handles it
  const m = ADMIN_INBOX.find(x => x.id === $(this).attr('data-inbox-open'));
  if(!m) return;
  inboxEnsureModal();
  inboxOpenId = m.id;
  inboxReplies = [];
  $('#inboxReplyText').val('');
  inboxFillModal(m);
  $('#inboxOverlay').addClass('open');
  try{
    inboxReplies = await window.CCContact.fetchReplies(m.id);
    if(inboxOpenId === m.id) inboxFillModal(m, 'open');
  } catch(err){
    console.error('Could not load replies.', err);
    showToast('Could not load the replies for this message.', 'error');
  }
  // Opening a conversation counts as reading it.
  if(inboxIsUnread(m)){
    m.adminUnread = false;
    renderInbox();
    window.CCContact.markReadByAdmin(m.id).catch(err => console.warn('Could not mark as read.', err));
  }
});
$(document).on('click', '#inboxClose', inboxCloseModal);
$(document).on('click', '#inboxOverlay', function(e){ if(e.target === this) inboxCloseModal(); });
$(document).on('keydown', function(e){
  if(e.key === 'Escape' && $('#inboxOverlay').hasClass('open')) inboxCloseModal();
});

$(document).on('click', '#inboxSendReply', async function(){
  const m = ADMIN_INBOX.find(x => x.id === inboxOpenId);
  if(!m || !m.userId) return;
  const text = $('#inboxReplyText').val().trim();
  if(!text){ showToast('Write a reply first.', 'warning'); return; }
  if(text.length > 2000){ showToast('Replies are limited to 2,000 characters.', 'error'); return; }
  const $btn = $(this).prop('disabled', true).addClass('is-loading').text('Sending...');
  try{
    await window.CCContact.sendReply(m.id, 'admin', text);
    m.status = 'handled';
    m.adminUnread = false;
    m.customerUnread = true;
    inboxReplies = await window.CCContact.fetchReplies(m.id);
    $('#inboxReplyText').val('');
    logActivity('update', 'message', m.id, `Replied to ${m.name || m.email || m.id}: "${m.subject || 'message'}"`);
    showToast('Reply sent.', 'success');
    inboxFillModal(m, 'send');
    renderInbox();
  } catch(err){
    console.error(err);
    showToast('Could not send the reply. Please try again.', 'error');
  } finally {
    $btn.prop('disabled', false).removeClass('is-loading').text('Send reply');
  }
});

$(document).on('click', '#inboxToggleStatus', async function(){
  const m = ADMIN_INBOX.find(x => x.id === inboxOpenId);
  if(!m) return;
  const next = m.status === 'handled' ? 'new' : 'handled';
  const $btn = $(this).prop('disabled', true);
  try{
    await window.CCContact.setMessageStatus(m.id, next);
    m.status = next;
    logActivity('update', 'message', m.id, `Marked message from ${m.name || m.email || m.id} as ${next === 'handled' ? 'handled' : 'new'}`);
    showToast(next === 'handled' ? 'Marked as handled.' : 'Marked as new.', 'success');
    renderInbox();
    inboxFillModal(m);
  } catch(err){
    console.error(err);
    showToast('Could not update the message. Please try again.', 'error');
  } finally {
    $btn.prop('disabled', false);
  }
});
