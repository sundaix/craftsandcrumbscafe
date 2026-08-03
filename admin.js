/* =========================================================
   Crafts & Crumbs — admin.js
   Everything specific to the Admin Side lives in this file:
   the dashboard tabs, product management (add/edit/delete),
   order management (view + update status), and the starter
   catalog seeder. Kept separate from script.js so the
   customer-facing code doesn't carry admin-only logic.

   Depends on globals already set up in script.js by the time
   these handlers actually run: PRODUCTS, SEED_PRODUCTS, peso(),
   showToast(), blankPlaceholder(), renderMenuPage(),
   renderMerchPage(), renderCategories(), renderBestSellers(),
   loadProductsFromFirestore(). Load this file after script.js.
========================================================= */

let ADMIN_ORDERS = [];
let adminEditingId = null; // set while editing an existing product, null when adding a new one

/* Shows the 🛠️ nav icon only once we know the signed-in
   account's role is 'admin' (fired from auth.js). */
document.addEventListener('authRoleReady', function(e){
  const { role } = e.detail;
  $('[data-nav="admin"]').remove();
  if(role === 'admin'){
    $('.nav-actions').prepend('<a href="#" class="icon-btn admin-link" data-nav="admin" title="Admin" aria-label="Admin">🛠️</a>');
  }
});

/* ================= DASHBOARD ENTRY POINT ================= */
/* Called from script.js's navigate() every time the admin page
   is opened. Cheap to re-run, so it just refreshes everything. */
function renderAdminDashboard(){
  renderAdminOverviewStats();
  renderAdminProductsTable();
  loadAndRenderAdminOrders();
}

/* ================= TABS ================= */
$(document).on('click', '.admin-tab', function(){
  const tab = $(this).data('admin-tab');
  $('.admin-tab').removeClass('active');
  $(this).addClass('active');
  $('.admin-panel').removeClass('active');
  $(`.admin-panel[data-admin-panel="${tab}"]`).addClass('active');
});

/* ================= OVERVIEW ================= */
function renderAdminOverviewStats(){
  $('#statTotalProducts').text(PRODUCTS.length);
  $('#statTotalOrders').text(ADMIN_ORDERS.length || '—');
  const pending = ADMIN_ORDERS.filter(o => (o.status || 'pending') === 'pending').length;
  $('#statPendingOrders').text(ADMIN_ORDERS.length ? pending : '—');
  const revenue = ADMIN_ORDERS.reduce((sum, o) => sum + (o.totals?.total || 0), 0);
  $('#statTotalRevenue').text(ADMIN_ORDERS.length ? peso(revenue) : '—');
}

/* ================= PRODUCTS TABLE ================= */
function renderAdminProductsTable(filter){
  const q = (filter || '').trim().toLowerCase();
  const rows = PRODUCTS
    .filter(p => !q || p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q))
    .map(p => `
      <tr data-product-row="${p.id}">
        <td class="admin-td-product">
          <img src="${p.img}" alt="${p.name}">
          <span>${p.name}</span>
        </td>
        <td>${p.cat}</td>
        <td>${peso(p.price)}</td>
        <td class="admin-td-actions">
          <button class="admin-icon-btn" data-admin-edit="${p.id}" title="Edit" aria-label="Edit ${p.name}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 20l1-4L16.5 4.5a1.5 1.5 0 0 1 2 0l1 1a1.5 1.5 0 0 1 0 2L8 19l-4 1Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
          </button>
          <button class="admin-icon-btn admin-icon-btn-danger" data-admin-delete="${p.id}" title="Delete" aria-label="Delete ${p.name}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </td>
      </tr>
    `).join('');
  $('#adminProductsBody').html(rows || `<tr><td colspan="4" class="admin-empty-row">No products match that search.</td></tr>`);
}

$(document).on('input', '#adminProductSearch', function(){
  renderAdminProductsTable($(this).val());
});

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

  $('#adminFormTitle').text(`Edit "${p.name}"`);
  $('#adminFormSubmitBtn').text('Update Product');
  $('#adminCancelEditBtn').show();

  $('.admin-tab').removeClass('active');
  $('.admin-tab[data-admin-tab="add-product"]').addClass('active');
  $('.admin-panel').removeClass('active');
  $('.admin-panel[data-admin-panel="add-product"]').addClass('active');
});

$(document).on('click', '#adminCancelEditBtn', function(){
  resetAdminProductForm();
});

function resetAdminProductForm(){
  adminEditingId = null;
  $('#adminAddProductForm')[0].reset();
  $('#apEditId').val('');
  $('#adminFormTitle').text('Add Product to Inventory');
  $('#adminFormSubmitBtn').text('Add Product');
  $('#adminCancelEditBtn').hide();
}

/* Delete: confirm, then remove from Firestore and the in-memory list */
$(document).on('click', '[data-admin-delete]', async function(){
  const id = $(this).data('admin-delete');
  const p = PRODUCTS.find(x => x.id === id);
  if(!p) return;
  if(!window.confirm(`Delete "${p.name}"? This can't be undone.`)) return;

  try{
    await window.CCProducts.deleteProduct(id);
    PRODUCTS = PRODUCTS.filter(x => x.id !== id);
    renderAdminProductsTable($('#adminProductSearch').val());
    renderAdminOverviewStats();
    renderMenuPage();
    renderMerchPage();
    showToast(`Deleted "${p.name}".`);
  } catch(err){
    console.error(err);
    showToast('Could not delete product. Please try again.');
  }
});

/* ================= ADD / EDIT PRODUCT FORM ================= */
$(document).on('submit', '#adminAddProductForm', async function(e){
  e.preventDefault();
  const $btn = $('#adminFormSubmitBtn');
  const cat = $('#apCategory').val();
  const name = $('#apName').val().trim();
  const price = Number($('#apPrice').val());
  const desc = $('#apDesc').val().trim();
  const imgInput = $('#apImg').val().trim();
  const img = imgInput || blankPlaceholder((adminEditingId || 'admin-' + Date.now()), cat);

  const fields = {
    name, cat, price, desc,
    img, imgs: [img],
    ingredients: $('#apIngredients').val().trim() || 'Details coming soon.',
    allergens: $('#apAllergens').val().trim() || 'Please ask our staff for full allergen details.'
  };

  if(adminEditingId){
    $btn.prop('disabled', true).text('Updating...');
    try{
      await window.CCProducts.updateProduct(adminEditingId, fields);
      const idx = PRODUCTS.findIndex(x => x.id === adminEditingId);
      if(idx > -1) PRODUCTS[idx] = { id: adminEditingId, ...fields };
      showToast(`Updated "${name}".`);
      resetAdminProductForm();
      renderAdminProductsTable();
      renderMenuPage();
      renderMerchPage();
      $('.admin-tab').removeClass('active');
      $('.admin-tab[data-admin-tab="products"]').addClass('active');
      $('.admin-panel').removeClass('active');
      $('.admin-panel[data-admin-panel="products"]').addClass('active');
    } catch(err){
      console.error(err);
      showToast('Could not update product. Please try again.');
    } finally {
      $btn.prop('disabled', false).text('Update Product');
    }
    return;
  }

  $btn.prop('disabled', true).text('Adding...');
  try{
    const newId = await window.CCProducts.addProduct(fields);
    PRODUCTS.push({ id: newId, ...fields });
    showToast(`Added "${name}" to inventory.`);
    resetAdminProductForm();
    renderAdminProductsTable();
    renderAdminOverviewStats();
    renderMenuPage();
    renderMerchPage();
  } catch(err){
    console.error(err);
    showToast('Could not add product. Please try again.');
  } finally {
    $btn.prop('disabled', false).text('Add Product');
  }
});

/* ================= ORDERS TABLE ================= */
async function loadAndRenderAdminOrders(){
  $('#adminOrdersBody').html(`<tr><td colspan="5" class="admin-empty-row">Loading orders...</td></tr>`);
  try{
    ADMIN_ORDERS = await window.CCOrders.fetchAllOrders();
  } catch(err){
    console.error(err);
    $('#adminOrdersBody').html(`<tr><td colspan="5" class="admin-empty-row">Could not load orders. Please try refreshing.</td></tr>`);
    return;
  }
  renderAdminOrdersTable();
  renderAdminOverviewStats();
}

const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

function renderAdminOrdersTable(){
  if(!ADMIN_ORDERS.length){
    $('#adminOrdersBody').html(`<tr><td colspan="5" class="admin-empty-row">No orders yet.</td></tr>`);
    return;
  }
  const rows = ADMIN_ORDERS.map(o => {
    const status = o.status || 'pending';
    const options = ORDER_STATUSES.map(s => `<option value="${s}" ${s === status ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('');
    return `
      <tr>
        <td>#${o.id.slice(0,6).toUpperCase()}</td>
        <td>${o.customer?.name || 'Guest'}</td>
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

$(document).on('change', '[data-order-status]', async function(){
  const orderId = $(this).data('order-status');
  const newStatus = $(this).val();
  const $select = $(this);
  $select.prop('disabled', true);
  try{
    await window.CCOrders.updateOrderStatus(orderId, newStatus);
    const order = ADMIN_ORDERS.find(o => o.id === orderId);
    if(order) order.status = newStatus;
    $select.attr('class', `admin-status-select admin-status-${newStatus}`);
    showToast(`Order #${orderId.slice(0,6).toUpperCase()} marked ${newStatus}.`);
    renderAdminOverviewStats();
  } catch(err){
    console.error(err);
    showToast('Could not update order status. Please try again.');
  } finally {
    $select.prop('disabled', false);
  }
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