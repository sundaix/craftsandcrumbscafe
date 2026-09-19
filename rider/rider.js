<<<<<<< HEAD
let RIDER_ALL = []; // every order ever assigned to this rider (from fetchRiderDeliveries) — split into the three lists below at render time
let riderQueue = []; // unclaimed, ready, delivery orders (from fetchAvailableDeliveries)

function peso(n){
  return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function riderOrderTimestampMs(val){
  if(!val) return null;
  if(typeof val.seconds === 'number') return val.seconds * 1000;
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? null : parsed;
}

function formatRiderTimestamp(val){
  const ms = riderOrderTimestampMs(val);
  if(ms === null) return 'Unknown date';
  return new Date(ms).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

function riderStatusLabel(status){
  return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* Best-effort Google Maps link — works whether or not a place_id/lat-
   lng is on the order (this project never stores geocoded
   coordinates, only the free-text address the customer typed at
   checkout), so this always falls back to a text-search URL. */
function mapsLinkFor(address){
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`;
}

function telLinkFor(phone){
  return `tel:${(phone || '').replace(/[^\d+]/g, '')}`;
}

function smsLinkFor(phone){
  return `sms:${(phone || '').replace(/[^\d+]/g, '')}`;
}

/* ================= LOAD ================= */
async function loadAndRenderQueue(){
  $('#ridQueueList').html(`<p class="rid-empty">Loading available deliveries…</p>`);
  try{
    riderQueue = await window.CCOrders.fetchAvailableDeliveries();
  } catch(err){
    console.error(err);
    $('#ridQueueList').html(`<p class="rid-empty">Could not load available deliveries. Please try refreshing.</p>`);
    return;
  }
  renderQueue();
}

async function loadAndRenderMineAndHistory(){
  const uid = window.currentUser && window.currentUser.uid;
  if(!uid) return;
  $('#ridMineList').html(`<p class="rid-empty">Loading your deliveries…</p>`);
  $('#ridHistoryList').html(`<p class="rid-empty">Loading history…</p>`);
  try{
    RIDER_ALL = await window.CCOrders.fetchRiderDeliveries(uid);
  } catch(err){
    console.error(err);
    $('#ridMineList').html(`<p class="rid-empty">Could not load your deliveries. Please try refreshing.</p>`);
    $('#ridHistoryList').html(`<p class="rid-empty">Could not load history. Please try refreshing.</p>`);
    return;
  }
  renderMine();
  renderHistory();
}

async function loadAll(){
  await Promise.all([loadAndRenderQueue(), loadAndRenderMineAndHistory()]);
}

window.CCRider = { loadAll };

/* ================= RENDER: QUEUE ================= */
function renderQueue(){
  $('#ridQueueCount').text(riderQueue.length || '');
  if(!riderQueue.length){
    $('#ridQueueList').html(`<p class="rid-empty">No available deliveries right now. Check back soon.</p>`);
    return;
  }
  const html = riderQueue.map(o => {
    const c = o.customer || {};
    const items = (o.items || []).map(it => `<li>${it.qty} × ${it.name}${it.size ? ` (${it.size})` : ''}</li>`).join('');
    return `
      <div class="rid-card">
        <div class="rid-card-top">
          <div>
            <span class="rid-card-id">#${o.id.slice(0,6).toUpperCase()}</span>
            <div class="rid-card-name">${c.name || 'Guest'}</div>
          </div>
          <span class="rid-status-pill rid-status-ready">Ready</span>
        </div>
        <div class="rid-card-address">${c.address || 'No address on file'}</div>
        <div class="rid-card-meta">
          <span>${formatRiderTimestamp(o.createdAt)}</span>
          <span>${peso(o.totals?.total || 0)}</span>
        </div>
        <ul class="rid-card-items">${items}</ul>
        <div class="rid-card-actions">
          <button class="btn btn-primary btn-sm" data-claim-order="${o.id}">Claim Delivery</button>
        </div>
      </div>
    `;
  }).join('');
  $('#ridQueueList').html(html);
}

/* ================= RENDER: MINE ================= */
function renderMine(){
  const mine = RIDER_ALL.filter(o => ['ready', 'out_for_delivery'].includes(o.status || ''));
  $('#ridMineCount').text(mine.length || '');
  if(!mine.length){
    $('#ridMineList').html(`<p class="rid-empty">No active deliveries. Claim one from Available Deliveries.</p>`);
    return;
  }
  const html = mine.map(o => {
    const c = o.customer || {};
    const status = o.status || 'ready';
    const items = (o.items || []).map(it => `<li>${it.qty} × ${it.name}${it.size ? ` (${it.size})` : ''}</li>`).join('');
    const nextActionBtn = status === 'ready'
      ? `<button class="btn btn-primary btn-sm" data-mark-status="${o.id}" data-next-status="out_for_delivery">Mark Picked Up</button>`
      : `<button class="btn btn-primary btn-sm" data-open-proof="${o.id}">Mark Delivered</button>`;
    return `
      <div class="rid-card">
        <div class="rid-card-top">
          <div>
            <span class="rid-card-id">#${o.id.slice(0,6).toUpperCase()}</span>
            <div class="rid-card-name">${c.name || 'Guest'}</div>
          </div>
          <span class="rid-status-pill rid-status-${status}">${riderStatusLabel(status)}</span>
        </div>
        <div class="rid-card-address">${c.address || 'No address on file'}</div>
        <div class="rid-card-meta">
          <span>${formatRiderTimestamp(o.createdAt)}</span>
          <span>${peso(o.totals?.total || 0)}</span>
        </div>
        <ul class="rid-card-items">${items}</ul>
        <div class="rid-card-actions">
          ${nextActionBtn}
          <a class="btn btn-outline btn-sm" href="${mapsLinkFor(c.address)}" target="_blank" rel="noopener">Navigate</a>
          ${c.phone ? `<a class="btn btn-outline btn-sm" href="${telLinkFor(c.phone)}">Call</a><a class="btn btn-outline btn-sm" href="${smsLinkFor(c.phone)}">Text</a>` : ''}
        </div>
      </div>
    `;
  }).join('');
  $('#ridMineList').html(html);
}

/* ================= RENDER: HISTORY ================= */
function renderHistory(){
  const history = RIDER_ALL.filter(o => o.status === 'completed')
    .sort((a, b) => (riderOrderTimestampMs(b.createdAt) || 0) - (riderOrderTimestampMs(a.createdAt) || 0));
  if(!history.length){
    $('#ridHistoryList').html(`<p class="rid-empty">No completed deliveries yet.</p>`);
    return;
  }
  const html = history.map(o => {
    const c = o.customer || {};
    return `
      <div class="rid-card">
        <div class="rid-card-top">
          <div>
            <span class="rid-card-id">#${o.id.slice(0,6).toUpperCase()}</span>
            <div class="rid-card-name">${c.name || 'Guest'}</div>
          </div>
          <span class="rid-status-pill rid-status-completed">Completed</span>
        </div>
        <div class="rid-card-address">${c.address || 'No address on file'}</div>
        <div class="rid-card-meta">
          <span>${formatRiderTimestamp(o.createdAt)}</span>
          <span>${peso(o.totals?.total || 0)}</span>
        </div>
        ${o.deliveryProof ? `<div class="rid-card-note">"${o.deliveryProof}"</div>` : ''}
      </div>
    `;
  }).join('');
  $('#ridHistoryList').html(html);
}

/* ================= TABS ================= */
$(document).on('click', '.admin-tab', function(){
  const tab = $(this).data('rider-tab');
  $('.admin-tab').removeClass('active');
  $(this).addClass('active');
  $('.admin-panel').removeClass('active');
  $(`.admin-panel[data-rider-panel="${tab}"]`).addClass('active');
});

/* ================= CLAIM ================= */
$(document).on('click', '[data-claim-order]', async function(){
  const orderId = $(this).data('claim-order');
  const uid = window.currentUser && window.currentUser.uid;
  const $btn = $(this);
  $btn.prop('disabled', true).text('Claiming…');
  try{
    await window.CCOrders.claimDelivery(orderId, uid);
    showToast(`Order #${orderId.slice(0,6).toUpperCase()} claimed.`, 'success');
    await loadAll();
  } catch(err){
    console.error(err);
    // Most likely another rider claimed it first — the rules reject
    // the write because riderId is no longer null by the time this
    // one lands, which surfaces here as a generic permission error.
    showToast('Could not claim that order — it may have just been taken by another rider.', 'warning');
    await loadAndRenderQueue();
  }
});

/* ================= STATUS: MARK PICKED UP ================= */
$(document).on('click', '[data-mark-status]', async function(){
  const orderId = $(this).data('mark-status');
  const nextStatus = $(this).data('next-status');
  const $btn = $(this);
  $btn.prop('disabled', true);
  try{
    await window.CCOrders.updateDeliveryStatus(orderId, nextStatus);
    showToast(`Order #${orderId.slice(0,6).toUpperCase()} marked ${riderStatusLabel(nextStatus).toLowerCase()}.`, 'success');
    await loadAndRenderMineAndHistory();
  } catch(err){
    console.error(err);
    showToast('Could not update that order. Please try again.', 'error');
    $btn.prop('disabled', false);
  }
});

/* ================= PROOF OF DELIVERY MODAL ================= */
function openProofModal(orderId){
  $('#ridProofNote').val('');
  $('#ridProofSubmit').data('order-id', orderId);
  $('#ridProofOverlay').addClass('open');
}
function closeProofModal(){
  $('#ridProofOverlay').removeClass('open');
}

$(document).on('click', '[data-open-proof]', function(){
  openProofModal($(this).data('open-proof'));
});
$(document).on('click', '#ridProofClose', closeProofModal);
$(document).on('click', '#ridProofOverlay', function(e){
  if(e.target === this) closeProofModal();
});
$(document).on('keydown', function(e){
  if(e.key === 'Escape' && $('#ridProofOverlay').hasClass('open')) closeProofModal();
});

$(document).on('click', '#ridProofSubmit', async function(){
  const orderId = $(this).data('order-id');
  const note = $('#ridProofNote').val().trim();
  const $btn = $(this);
  $btn.prop('disabled', true).text('Saving…');
  try{
    await window.CCOrders.updateDeliveryStatus(orderId, 'completed', note || null);
    showToast(`Order #${orderId.slice(0,6).toUpperCase()} marked delivered.`, 'success');
    closeProofModal();
    await loadAndRenderMineAndHistory();
  } catch(err){
    console.error(err);
    showToast('Could not confirm delivery. Please try again.', 'error');
  } finally {
    $btn.prop('disabled', false).text('Mark as Delivered');
  }
});

/* ================= REFRESH ================= */
=======
let RIDER_ALL = []; // every order ever assigned to this rider (from fetchRiderDeliveries) — split into the three lists below at render time
let riderQueue = []; // unclaimed, ready, delivery orders (from fetchAvailableDeliveries)

function peso(n){
  return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function riderOrderTimestampMs(val){
  if(!val) return null;
  if(typeof val.seconds === 'number') return val.seconds * 1000;
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? null : parsed;
}

function formatRiderTimestamp(val){
  const ms = riderOrderTimestampMs(val);
  if(ms === null) return 'Unknown date';
  return new Date(ms).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

function riderStatusLabel(status){
  return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* Best-effort Google Maps link — works whether or not a place_id/lat-
   lng is on the order (this project never stores geocoded
   coordinates, only the free-text address the customer typed at
   checkout), so this always falls back to a text-search URL. */
function mapsLinkFor(address){
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || '')}`;
}

function telLinkFor(phone){
  return `tel:${(phone || '').replace(/[^\d+]/g, '')}`;
}

function smsLinkFor(phone){
  return `sms:${(phone || '').replace(/[^\d+]/g, '')}`;
}

/* ================= LOAD ================= */
async function loadAndRenderQueue(){
  $('#ridQueueList').html(`<p class="rid-empty">Loading available deliveries…</p>`);
  try{
    riderQueue = await window.CCOrders.fetchAvailableDeliveries();
  } catch(err){
    console.error(err);
    $('#ridQueueList').html(`<p class="rid-empty">Could not load available deliveries. Please try refreshing.</p>`);
    return;
  }
  renderQueue();
}

async function loadAndRenderMineAndHistory(){
  const uid = window.currentUser && window.currentUser.uid;
  if(!uid) return;
  $('#ridMineList').html(`<p class="rid-empty">Loading your deliveries…</p>`);
  $('#ridHistoryList').html(`<p class="rid-empty">Loading history…</p>`);
  try{
    RIDER_ALL = await window.CCOrders.fetchRiderDeliveries(uid);
  } catch(err){
    console.error(err);
    $('#ridMineList').html(`<p class="rid-empty">Could not load your deliveries. Please try refreshing.</p>`);
    $('#ridHistoryList').html(`<p class="rid-empty">Could not load history. Please try refreshing.</p>`);
    return;
  }
  renderMine();
  renderHistory();
}

async function loadAll(){
  await Promise.all([loadAndRenderQueue(), loadAndRenderMineAndHistory()]);
}

window.CCRider = { loadAll };

/* ================= RENDER: QUEUE ================= */
function renderQueue(){
  $('#ridQueueCount').text(riderQueue.length || '');
  if(!riderQueue.length){
    $('#ridQueueList').html(`<p class="rid-empty">No available deliveries right now. Check back soon.</p>`);
    return;
  }
  const html = riderQueue.map(o => {
    const c = o.customer || {};
    const items = (o.items || []).map(it => `<li>${it.qty} × ${it.name}${it.size ? ` (${it.size})` : ''}</li>`).join('');
    return `
      <div class="rid-card">
        <div class="rid-card-top">
          <div>
            <span class="rid-card-id">#${o.id.slice(0,6).toUpperCase()}</span>
            <div class="rid-card-name">${c.name || 'Guest'}</div>
          </div>
          <span class="rid-status-pill rid-status-ready">Ready</span>
        </div>
        <div class="rid-card-address">${c.address || 'No address on file'}</div>
        <div class="rid-card-meta">
          <span>${formatRiderTimestamp(o.createdAt)}</span>
          <span>${peso(o.totals?.total || 0)}</span>
        </div>
        <ul class="rid-card-items">${items}</ul>
        <div class="rid-card-actions">
          <button class="btn btn-primary btn-sm" data-claim-order="${o.id}">Claim Delivery</button>
        </div>
      </div>
    `;
  }).join('');
  $('#ridQueueList').html(html);
}

/* ================= RENDER: MINE ================= */
function renderMine(){
  const mine = RIDER_ALL.filter(o => ['ready', 'out_for_delivery'].includes(o.status || ''));
  $('#ridMineCount').text(mine.length || '');
  if(!mine.length){
    $('#ridMineList').html(`<p class="rid-empty">No active deliveries. Claim one from Available Deliveries.</p>`);
    return;
  }
  const html = mine.map(o => {
    const c = o.customer || {};
    const status = o.status || 'ready';
    const items = (o.items || []).map(it => `<li>${it.qty} × ${it.name}${it.size ? ` (${it.size})` : ''}</li>`).join('');
    const nextActionBtn = status === 'ready'
      ? `<button class="btn btn-primary btn-sm" data-mark-status="${o.id}" data-next-status="out_for_delivery">Mark Picked Up</button>`
      : `<button class="btn btn-primary btn-sm" data-open-proof="${o.id}">Mark Delivered</button>`;
    return `
      <div class="rid-card">
        <div class="rid-card-top">
          <div>
            <span class="rid-card-id">#${o.id.slice(0,6).toUpperCase()}</span>
            <div class="rid-card-name">${c.name || 'Guest'}</div>
          </div>
          <span class="rid-status-pill rid-status-${status}">${riderStatusLabel(status)}</span>
        </div>
        <div class="rid-card-address">${c.address || 'No address on file'}</div>
        <div class="rid-card-meta">
          <span>${formatRiderTimestamp(o.createdAt)}</span>
          <span>${peso(o.totals?.total || 0)}</span>
        </div>
        <ul class="rid-card-items">${items}</ul>
        <div class="rid-card-actions">
          ${nextActionBtn}
          <a class="btn btn-outline btn-sm" href="${mapsLinkFor(c.address)}" target="_blank" rel="noopener">Navigate</a>
          ${c.phone ? `<a class="btn btn-outline btn-sm" href="${telLinkFor(c.phone)}">Call</a><a class="btn btn-outline btn-sm" href="${smsLinkFor(c.phone)}">Text</a>` : ''}
        </div>
      </div>
    `;
  }).join('');
  $('#ridMineList').html(html);
}

/* ================= RENDER: HISTORY ================= */
function renderHistory(){
  const history = RIDER_ALL.filter(o => o.status === 'completed')
    .sort((a, b) => (riderOrderTimestampMs(b.createdAt) || 0) - (riderOrderTimestampMs(a.createdAt) || 0));
  if(!history.length){
    $('#ridHistoryList').html(`<p class="rid-empty">No completed deliveries yet.</p>`);
    return;
  }
  const html = history.map(o => {
    const c = o.customer || {};
    return `
      <div class="rid-card">
        <div class="rid-card-top">
          <div>
            <span class="rid-card-id">#${o.id.slice(0,6).toUpperCase()}</span>
            <div class="rid-card-name">${c.name || 'Guest'}</div>
          </div>
          <span class="rid-status-pill rid-status-completed">Completed</span>
        </div>
        <div class="rid-card-address">${c.address || 'No address on file'}</div>
        <div class="rid-card-meta">
          <span>${formatRiderTimestamp(o.createdAt)}</span>
          <span>${peso(o.totals?.total || 0)}</span>
        </div>
        ${o.deliveryProof ? `<div class="rid-card-note">"${o.deliveryProof}"</div>` : ''}
      </div>
    `;
  }).join('');
  $('#ridHistoryList').html(html);
}

/* ================= TABS ================= */
$(document).on('click', '.admin-tab', function(){
  const tab = $(this).data('rider-tab');
  $('.admin-tab').removeClass('active');
  $(this).addClass('active');
  $('.admin-panel').removeClass('active');
  $(`.admin-panel[data-rider-panel="${tab}"]`).addClass('active');
});

/* ================= CLAIM ================= */
$(document).on('click', '[data-claim-order]', async function(){
  const orderId = $(this).data('claim-order');
  const uid = window.currentUser && window.currentUser.uid;
  const $btn = $(this);
  $btn.prop('disabled', true).text('Claiming…');
  try{
    await window.CCOrders.claimDelivery(orderId, uid);
    showToast(`Order #${orderId.slice(0,6).toUpperCase()} claimed.`, 'success');
    await loadAll();
  } catch(err){
    console.error(err);
    // Most likely another rider claimed it first — the rules reject
    // the write because riderId is no longer null by the time this
    // one lands, which surfaces here as a generic permission error.
    showToast('Could not claim that order — it may have just been taken by another rider.', 'warning');
    await loadAndRenderQueue();
  }
});

/* ================= STATUS: MARK PICKED UP ================= */
$(document).on('click', '[data-mark-status]', async function(){
  const orderId = $(this).data('mark-status');
  const nextStatus = $(this).data('next-status');
  const $btn = $(this);
  $btn.prop('disabled', true);
  try{
    await window.CCOrders.updateDeliveryStatus(orderId, nextStatus);
    showToast(`Order #${orderId.slice(0,6).toUpperCase()} marked ${riderStatusLabel(nextStatus).toLowerCase()}.`, 'success');
    await loadAndRenderMineAndHistory();
  } catch(err){
    console.error(err);
    showToast('Could not update that order. Please try again.', 'error');
    $btn.prop('disabled', false);
  }
});

/* ================= PROOF OF DELIVERY MODAL ================= */
function openProofModal(orderId){
  $('#ridProofNote').val('');
  $('#ridProofSubmit').data('order-id', orderId);
  $('#ridProofOverlay').addClass('open');
}
function closeProofModal(){
  $('#ridProofOverlay').removeClass('open');
}

$(document).on('click', '[data-open-proof]', function(){
  openProofModal($(this).data('open-proof'));
});
$(document).on('click', '#ridProofClose', closeProofModal);
$(document).on('click', '#ridProofOverlay', function(e){
  if(e.target === this) closeProofModal();
});
$(document).on('keydown', function(e){
  if(e.key === 'Escape' && $('#ridProofOverlay').hasClass('open')) closeProofModal();
});

$(document).on('click', '#ridProofSubmit', async function(){
  const orderId = $(this).data('order-id');
  const note = $('#ridProofNote').val().trim();
  const $btn = $(this);
  $btn.prop('disabled', true).text('Saving…');
  try{
    await window.CCOrders.updateDeliveryStatus(orderId, 'completed', note || null);
    showToast(`Order #${orderId.slice(0,6).toUpperCase()} marked delivered.`, 'success');
    closeProofModal();
    await loadAndRenderMineAndHistory();
  } catch(err){
    console.error(err);
    showToast('Could not confirm delivery. Please try again.', 'error');
  } finally {
    $btn.prop('disabled', false).text('Mark as Delivered');
  }
});

/* ================= REFRESH ================= */
>>>>>>> e9cb7b70c270141b540704d99debce1959ccc213
$(document).on('click', '#ridRefreshBtn', loadAll);