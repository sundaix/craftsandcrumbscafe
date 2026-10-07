let RIDER_ALL = []; // every order ever assigned to this rider (from fetchRiderDeliveries) — split into the lists below at render time
let riderQueue = []; // unclaimed, ready, delivery orders (from fetchAvailableDeliveries)

const RID_ALERT_KEY = 'cc_rider_alerts_v1';
const RID_POLL_MS = 30000;
let ridKnownQueueIds = null;   // null until the first load, so the very first load never "alerts"
let ridPollTimer = null;
let ridAudioCtx = null;
let ridAlertsOn = false;
let ridShop = null;            // { lat, lng } — where deliveries start (Admin -> Settings)
let ridShopTried = false;
const ridMaps = {};            // orderId -> { map, layers... }
let ridQueueSig = '';
let ridMineSig = '';
let ridHistorySig = '';
let ridFailedPhotoUpload = false;

function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

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
  if(status === 'delivery_failed') return 'Failed';
  return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* ---------- map / contact links ---------- */
function pinOf(o){
  const c = (o && o.customer) || {};
  if(c.lat == null || c.lng == null) return null;
  const lat = Number(c.lat), lng = Number(c.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/* Orders placed since route pricing went live carry the customer's exact
   map pin, so Navigate goes straight to it (directions from wherever the
   rider is right now). Older orders only have the typed address, so they
   fall back to a text search. */
function navigateLinkFor(o){
  const pin = pinOf(o);
  if(pin) return `https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}&travelmode=driving`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((o.customer && o.customer.address) || '')}`;
}

/* Only used for older orders without a pin. Informal output=embed URL —
   no API key needed. */
function mapsEmbedFor(address){
  return `https://maps.google.com/maps?q=${encodeURIComponent(address || '')}&z=15&output=embed`;
}

function telLinkFor(phone){
  return `tel:${(phone || '').replace(/[^\d+]/g, '')}`;
}

function smsLinkFor(phone){
  return `sms:${(phone || '').replace(/[^\d+]/g, '')}`;
}

/* ---------- earnings ----------
   The rider keeps the whole delivery fee. Dated by completedAt when the
   order has it, otherwise (older deliveries) by createdAt. */
function earnedFor(o){
  return Number(o.totals && o.totals.deliveryFee) || 0;
}
function doneAtMs(o){
  return riderOrderTimestampMs(o.completedAt) || riderOrderTimestampMs(o.createdAt) || 0;
}
function earningsSummary(){
  const done = RIDER_ALL.filter(o => o.status === 'completed');
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dow = (now.getDay() + 6) % 7; // Monday = 0
  const startOfWeek = startOfDay - dow * 86400000;
  const sum = (list) => ({ count: list.length, amount: list.reduce((s, o) => s + earnedFor(o), 0) });
  return {
    today: sum(done.filter(o => doneAtMs(o) >= startOfDay)),
    week: sum(done.filter(o => doneAtMs(o) >= startOfWeek)),
    all: sum(done)
  };
}
function renderEarnings(){
  const e = earningsSummary();
  const card = (label, v) => `
    <div class="rid-earn-card">
      <span class="rid-earn-label">${label}</span>
      <strong class="rid-earn-amount">${peso(v.amount)}</strong>
      <span class="rid-earn-count">${v.count} ${v.count === 1 ? 'delivery' : 'deliveries'}</span>
    </div>`;
  $('#ridEarnings').html(card('Today', e.today) + card('This week', e.week) + card('All time', e.all));
  $('#ridMineToday').html(e.today.count
    ? `Today: <b>${e.today.count}</b> delivered · <b>${peso(e.today.amount)}</b> earned`
    : 'No deliveries completed yet today.');
}

const RID_BELL = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
const RID_CAMERA = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

/* ================= SMALL UI INJECTION =================
   Everything new in the rider app is added from here, so rider/index.html
   doesn't need to change. */
function ridInitUi(){
  if($('#ridAlertBtn').length) return;
  const $refresh = $('#ridRefreshBtn');
  $refresh.wrap('<div class="rid-topbar-actions"></div>');
  $refresh.before(`<button type="button" class="btn btn-outline btn-sm rid-alert-btn" id="ridAlertBtn" aria-pressed="false">${RID_BELL} <span>Alerts off</span></button>`);

  $('[data-rider-panel="mine"] .admin-panel-head').after('<p class="rid-mine-today" id="ridMineToday"></p>');
  $('[data-rider-panel="history"] .admin-panel-head').after('<div class="rid-earn" id="ridEarnings"></div>');

  $('body').append(`
    <div class="legal-overlay" id="ridDoneOverlay">
      <div class="legal-modal" style="max-width:440px;" role="dialog" aria-modal="true" aria-labelledby="ridDoneTitle">
        <button class="legal-close" id="ridDoneClose" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        <div class="legal-header"><h2 id="ridDoneTitle">Confirm Delivery</h2></div>
        <div class="legal-body">
          <div class="form-group">
            <label>Photo of the delivered order <span class="rid-optional">(recommended)</span></label>
            <label class="rid-photo-drop" id="ridPhotoDrop" for="ridPhotoInput">
              <img id="ridPhotoPreview" alt="" style="display:none;">
              <span id="ridPhotoHint">${RID_CAMERA}<span>Tap to take or choose a photo</span></span>
            </label>
            <input type="file" id="ridPhotoInput" accept="image/*" capture="environment" style="display:none;">
          </div>
          <div class="form-group">
            <label for="ridDoneNote">Delivery note <span class="rid-optional">(optional)</span></label>
            <textarea id="ridDoneNote" rows="2" maxlength="200" placeholder="e.g. Handed to customer at the gate."></textarea>
          </div>
          <button type="button" class="btn btn-primary btn-full" id="ridDoneSubmit" data-order-id="">Mark as Delivered</button>
        </div>
      </div>
    </div>

    <div class="legal-overlay" id="ridFailOverlay">
      <div class="legal-modal" style="max-width:440px;" role="dialog" aria-modal="true" aria-labelledby="ridFailTitle">
        <button class="legal-close" id="ridFailClose" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        </button>
        <div class="legal-header"><h2 id="ridFailTitle">Can't Deliver</h2></div>
        <div class="legal-body">
          <p class="form-hint" style="margin:0 0 14px;">This tells the shop the delivery didn't go through so they can contact the customer. You can't undo it.</p>
          <div class="form-group">
            <label for="ridFailReason">What happened?</label>
            <select id="ridFailReason">
              <option value="">Choose a reason…</option>
              <option>Customer unreachable</option>
              <option>Nobody at the location</option>
              <option>Wrong or incomplete address</option>
              <option>Customer refused the order</option>
              <option>Unsafe to deliver (weather / area)</option>
              <option>Other</option>
            </select>
          </div>
          <div class="form-group">
            <label for="ridFailNote">More detail <span class="rid-optional">(optional)</span></label>
            <textarea id="ridFailNote" rows="2" maxlength="200" placeholder="e.g. Called 3 times, no answer."></textarea>
          </div>
          <button type="button" class="btn btn-danger btn-full" id="ridFailSubmit" data-order-id="">Report Failed Delivery</button>
        </div>
      </div>
    </div>
  `);

  ridAlertsOn = localStorage.getItem(RID_ALERT_KEY) === '1';
  ridSyncAlertBtn();
  // Browsers only allow sound after a tap — if alerts were left on, wake the audio on the first tap.
  if(ridAlertsOn) $(document).one('click touchstart', ridEnsureAudio);
}

/* ================= ALERTS (sound + vibration for new deliveries) ================= */
function ridEnsureAudio(){
  try{
    if(!ridAudioCtx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;
      ridAudioCtx = new AC();
    }
    if(ridAudioCtx.state === 'suspended') ridAudioCtx.resume();
  } catch(err){ console.warn('Audio unavailable', err); }
}

function ridBeep(){
  if(!ridAudioCtx) return;
  const ctx = ridAudioCtx;
  [880, 1175, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain); gain.connect(ctx.destination);
    const t = ctx.currentTime + i * 0.2;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    osc.start(t); osc.stop(t + 0.18);
  });
}

function ridSyncAlertBtn(){
  $('#ridAlertBtn').toggleClass('on', ridAlertsOn).attr('aria-pressed', ridAlertsOn)
    .find('span').text(ridAlertsOn ? 'Alerts on' : 'Alerts off');
}

$(document).on('click', '#ridAlertBtn', function(){
  ridAlertsOn = !ridAlertsOn;
  localStorage.setItem(RID_ALERT_KEY, ridAlertsOn ? '1' : '0');
  ridSyncAlertBtn();
  if(ridAlertsOn){
    ridEnsureAudio();   // this tap is the user gesture the browser needs
    ridBeep();
    if(navigator.vibrate) navigator.vibrate(120);
    showToast("Alerts on — you'll hear a beep when a new delivery appears.", 'success');
  } else {
    showToast('Alerts off.', 'info');
  }
});

function ridAnnounceNew(newOrders){
  const n = newOrders.length;
  showToast(n === 1 ? 'New delivery available!' : `${n} new deliveries available!`, 'success');
  if(ridAlertsOn){
    ridBeep();
    if(navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }
}

function ridUpdateTitle(){
  document.title = (riderQueue.length ? `(${riderQueue.length}) ` : '') + 'Rider — Crafts & Crumbs';
}

/* Firestore Lite has no live listeners, so the queue is re-checked every
   30 seconds. Lists only re-render when something actually changed, so an
   open map isn't wiped out by a routine check. */
function ridStartPolling(){
  if(ridPollTimer) return;
  ridPollTimer = setInterval(() => {
    if(!$('#ridShell').is(':visible')) return;
    loadAll({ silent: true });
  }, RID_POLL_MS);
}

/* ================= LOAD ================= */
async function loadAndRenderQueue(silent){
  if(!silent) $('#ridQueueList').html(`<p class="rid-empty">Loading available deliveries…</p>`);
  try{
    riderQueue = await window.CCOrders.fetchAvailableDeliveries();
  } catch(err){
    console.error(err);
    if(!silent) $('#ridQueueList').html(`<p class="rid-empty">Could not load available deliveries. Please try refreshing.</p>`);
    return;
  }
  const ids = riderQueue.map(o => o.id);
  if(ridKnownQueueIds !== null){
    const fresh = riderQueue.filter(o => !ridKnownQueueIds.includes(o.id));
    if(fresh.length) ridAnnounceNew(fresh);
  }
  ridKnownQueueIds = ids;
  ridUpdateTitle();
  const sig = JSON.stringify(ids);
  if(silent && sig === ridQueueSig) return;
  ridQueueSig = sig;
  renderQueue();
}

async function loadAndRenderMineAndHistory(silent){
  const uid = window.currentUser && window.currentUser.uid;
  if(!uid) return;
  if(!silent){
    $('#ridMineList').html(`<p class="rid-empty">Loading your deliveries…</p>`);
    $('#ridHistoryList').html(`<p class="rid-empty">Loading history…</p>`);
  }
  try{
    RIDER_ALL = await window.CCOrders.fetchRiderDeliveries(uid);
  } catch(err){
    console.error(err);
    if(!silent){
      $('#ridMineList').html(`<p class="rid-empty">Could not load your deliveries. Please try refreshing.</p>`);
      $('#ridHistoryList').html(`<p class="rid-empty">Could not load history. Please try refreshing.</p>`);
    }
    return;
  }
  const mineSig = JSON.stringify(RIDER_ALL.filter(o => ['ready', 'out_for_delivery'].includes(o.status)).map(o => [o.id, o.status, o.arrivedAt || '']));
  const histSig = JSON.stringify(RIDER_ALL.filter(o => ['completed', 'delivery_failed'].includes(o.status)).map(o => [o.id, o.status]));
  if(!(silent && mineSig === ridMineSig)){ ridMineSig = mineSig; renderMine(); }
  if(!(silent && histSig === ridHistorySig)){ ridHistorySig = histSig; renderHistory(); }
  renderEarnings();
}

async function loadAll(opts){
  const silent = !!(opts && opts.silent);
  ridInitUi();
  ridStartPolling();
  await Promise.all([loadAndRenderQueue(silent), loadAndRenderMineAndHistory(silent)]);
}

window.CCRider = { loadAll };

/* ================= SHARED CARD PIECES ================= */
function itemsListHtml(o){
  return (o.items || []).map(it => `<li>${esc(it.qty)} × ${esc(it.name)}${it.size ? ` (${esc(it.size)})` : ''}</li>`).join('');
}

function routeMetaHtml(o){
  const t = o.totals || {};
  const bits = [];
  if(t.distanceKm != null) bits.push(`<span class="rid-chip rid-chip-route">${Number(t.distanceKm).toFixed(1)} km${t.durationMin ? ` · ~${esc(t.durationMin)} min` : ''}</span>`);
  const earn = earnedFor(o);
  if(earn > 0) bits.push(`<span class="rid-chip rid-chip-earn">You earn ${esc(peso(earn))}</span>`);
  return bits.length ? `<div class="rid-chips">${bits.join('')}</div>` : '';
}

function mapBlockHtml(o){
  const c = o.customer || {};
  if(pinOf(o)){
    return `
      <div class="rid-map-wrap" id="ridMap-${esc(o.id)}">
        <div class="rid-map-tools">
          <span class="rid-map-info" id="ridMapInfo-${esc(o.id)}">Loading route…</span>
          <button type="button" class="btn btn-outline btn-sm" data-locate-me="${esc(o.id)}">My location</button>
        </div>
        <div class="rid-map" id="ridMapEl-${esc(o.id)}"></div>
      </div>`;
  }
  return c.address
    ? `<div class="rid-map-wrap" id="ridMap-${esc(o.id)}"><iframe class="rid-map-frame" data-embed-src="${esc(mapsEmbedFor(c.address))}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`
    : '';
}

function mapToggleBtn(o){
  const c = o.customer || {};
  return (pinOf(o) || c.address) ? `<button class="btn btn-outline btn-sm" data-toggle-map="${esc(o.id)}">${pinOf(o) ? 'View route' : 'Preview map'}</button>` : '';
}

/* ================= RENDER: QUEUE ================= */
function renderQueue(){
  $('#ridQueueCount').text(riderQueue.length || '');
  if(!riderQueue.length){
    $('#ridQueueList').html(`<p class="rid-empty">No available deliveries right now. New ones show up here automatically.</p>`);
    return;
  }
  const html = riderQueue.map(o => {
    const c = o.customer || {};
    return `
      <div class="rid-card">
        <div class="rid-card-top">
          <div>
            <span class="rid-card-id">#${esc(o.id.slice(0,6).toUpperCase())}</span>
            <div class="rid-card-name">${esc(c.name || 'Guest')}</div>
          </div>
          <span class="rid-status-pill rid-status-ready">Ready</span>
        </div>
        <div class="rid-card-address">${esc(c.address || 'No address on file')}</div>
        ${routeMetaHtml(o)}
        <div class="rid-card-meta">
          <span>${esc(formatRiderTimestamp(o.createdAt))}</span>
          <span>${esc(peso(o.totals?.total || 0))}</span>
        </div>
        <ul class="rid-card-items">${itemsListHtml(o)}</ul>
        <div class="rid-card-actions">
          <button class="btn btn-primary btn-sm" data-claim-order="${esc(o.id)}">Claim Delivery</button>
          ${mapToggleBtn(o)}
        </div>
        ${mapBlockHtml(o)}
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
    const id = esc(o.id);
    let primary;
    if(status === 'ready'){
      primary = `
        <button class="btn btn-primary btn-sm" data-mark-status="${id}" data-next-status="out_for_delivery">Mark Picked Up</button>
        <button class="btn btn-outline btn-sm rid-btn-soft-danger" data-release-order="${id}">Release</button>`;
    } else {
      primary = `
        ${o.arrivedAt ? '' : `<button class="btn btn-outline btn-sm" data-arrived-order="${id}">I've arrived</button>`}
        <button class="btn btn-primary btn-sm" data-open-done="${id}">Mark Delivered</button>
        <button class="btn btn-outline btn-sm rid-btn-soft-danger" data-open-fail="${id}">Can't deliver</button>`;
    }
    return `
      <div class="rid-card">
        <div class="rid-card-top">
          <div>
            <span class="rid-card-id">#${esc(o.id.slice(0,6).toUpperCase())}</span>
            <div class="rid-card-name">${esc(c.name || 'Guest')}</div>
          </div>
          <span class="rid-status-pill rid-status-${esc(status)}">${esc(riderStatusLabel(status))}</span>
        </div>
        <div class="rid-card-address">${esc(c.address || 'No address on file')}</div>
        ${routeMetaHtml(o)}
        ${o.arrivedAt ? `<div class="rid-arrived-note">You marked arrived at ${esc(formatRiderTimestamp(o.arrivedAt))}</div>` : ''}
        <div class="rid-card-meta">
          <span>${esc(formatRiderTimestamp(o.createdAt))}</span>
          <span>${esc(peso(o.totals?.total || 0))}</span>
        </div>
        <ul class="rid-card-items">${itemsListHtml(o)}</ul>
        <div class="rid-card-actions">
          ${primary}
        </div>
        <div class="rid-card-actions rid-card-actions-secondary">
          <a class="btn btn-outline btn-sm" href="${esc(navigateLinkFor(o))}" target="_blank" rel="noopener">Navigate</a>
          ${mapToggleBtn(o)}
          ${c.phone ? `<a class="btn btn-outline btn-sm" href="${esc(telLinkFor(c.phone))}">Call</a><a class="btn btn-outline btn-sm" href="${esc(smsLinkFor(c.phone))}">Text</a>` : ''}
        </div>
        ${mapBlockHtml(o)}
      </div>
    `;
  }).join('');
  $('#ridMineList').html(html);
}

/* ================= RENDER: HISTORY ================= */
function renderHistory(){
  const history = RIDER_ALL.filter(o => ['completed', 'delivery_failed'].includes(o.status))
    .sort((a, b) => doneAtMs(b) - doneAtMs(a));
  if(!history.length){
    $('#ridHistoryList').html(`<p class="rid-empty">No completed deliveries yet.</p>`);
    return;
  }
  const html = history.map(o => {
    const c = o.customer || {};
    const failed = o.status === 'delivery_failed';
    const when = failed ? (o.failedAt || o.createdAt) : (o.completedAt || o.createdAt);
    return `
      <div class="rid-card">
        <div class="rid-card-top">
          <div>
            <span class="rid-card-id">#${esc(o.id.slice(0,6).toUpperCase())}</span>
            <div class="rid-card-name">${esc(c.name || 'Guest')}</div>
          </div>
          <span class="rid-status-pill rid-status-${failed ? 'delivery_failed' : 'completed'}">${failed ? 'Failed' : 'Completed'}</span>
        </div>
        <div class="rid-card-address">${esc(c.address || 'No address on file')}</div>
        <div class="rid-card-meta">
          <span>${esc(formatRiderTimestamp(when))}</span>
          ${o.totals && o.totals.distanceKm != null ? `<span>${Number(o.totals.distanceKm).toFixed(1)} km</span>` : ''}
          ${failed ? '' : `<span class="rid-earned">+${esc(peso(earnedFor(o)))}</span>`}
        </div>
        ${failed && o.failureReason ? `<div class="rid-card-note rid-card-note-bad">${esc(o.failureReason)}</div>` : ''}
        ${!failed && o.deliveryProof ? `<div class="rid-card-note">"${esc(o.deliveryProof)}"</div>` : ''}
        ${o.deliveryPhoto ? `<a class="rid-proof-link" href="${esc(o.deliveryPhoto)}" target="_blank" rel="noopener"><img class="rid-proof-thumb" src="${esc(o.deliveryPhoto)}" alt="Delivery photo" loading="lazy"></a>` : ''}
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

/* ================= RELEASE (give a claimed, not-yet-picked-up order back) ================= */
$(document).on('click', '[data-release-order]', async function(){
  const orderId = $(this).data('release-order');
  const ok = await showConfirm({
    title: 'Release this delivery?',
    message: 'It goes back to Available Deliveries so another rider can take it.',
    confirmText: 'Release'
  });
  if(!ok) return;
  const $btn = $(this).prop('disabled', true);
  try{
    await window.CCOrders.releaseDelivery(orderId);
    showToast(`Order #${orderId.slice(0,6).toUpperCase()} released.`, 'success');
    await loadAll();
  } catch(err){
    console.error(err);
    showToast('Could not release that order. Please try again.', 'error');
    $btn.prop('disabled', false);
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

/* ================= ARRIVED ================= */
$(document).on('click', '[data-arrived-order]', async function(){
  const orderId = $(this).data('arrived-order');
  const $btn = $(this).prop('disabled', true);
  try{
    await window.CCOrders.markArrived(orderId);
    showToast('Marked as arrived — the customer can see it.', 'success');
    await loadAndRenderMineAndHistory();
  } catch(err){
    console.error(err);
    showToast('Could not update that order. Please try again.', 'error');
    $btn.prop('disabled', false);
  }
});

/* ================= DELIVERED (photo + note) ================= */
function loadScriptOnce(src, testGlobal){
  return new Promise((resolve, reject) => {
    if(testGlobal && window[testGlobal]) return resolve();
    const existing = document.querySelector(`script[data-rid-src="${src}"]`);
    if(existing){ existing.addEventListener('load', resolve); existing.addEventListener('error', reject); return; }
    const s = document.createElement('script');
    s.src = src; s.async = true; s.dataset.ridSrc = src;
    s.onload = resolve; s.onerror = () => reject(new Error('script-load-failed: ' + src));
    document.head.appendChild(s);
  });
}

let ridPhotoFile = null;

function openDoneModal(orderId){
  ridPhotoFile = null;
  ridFailedPhotoUpload = false;
  $('#ridDoneNote').val('');
  $('#ridPhotoInput').val('');
  $('#ridPhotoPreview').hide().attr('src', '');
  $('#ridPhotoHint').show();
  $('#ridPhotoDrop').removeClass('has-photo');
  $('#ridDoneSubmit').data('order-id', orderId).prop('disabled', false).text('Mark as Delivered');
  $('#ridDoneOverlay').addClass('open');
  // Warm up the uploader while the rider is taking the photo.
  loadScriptOnce('../image-upload-service.js', 'CCImages').catch(() => {});
}
function closeDoneModal(){ $('#ridDoneOverlay').removeClass('open'); }

$(document).on('click', '[data-open-done]', function(){ openDoneModal($(this).data('open-done')); });
$(document).on('click', '#ridDoneClose', closeDoneModal);
$(document).on('click', '#ridDoneOverlay', function(e){ if(e.target === this) closeDoneModal(); });

$(document).on('change', '#ridPhotoInput', function(){
  const file = this.files && this.files[0];
  if(!file) return;
  ridPhotoFile = file;
  ridFailedPhotoUpload = false;
  $('#ridDoneSubmit').text('Mark as Delivered');
  const url = URL.createObjectURL(file);
  $('#ridPhotoPreview').attr('src', url).show();
  $('#ridPhotoHint').hide();
  $('#ridPhotoDrop').addClass('has-photo');
});

$(document).on('click', '#ridDoneSubmit', async function(){
  const orderId = $(this).data('order-id');
  const note = $('#ridDoneNote').val().trim();
  const $btn = $(this);
  $btn.prop('disabled', true);
  let photoUrl = null;
  if(ridPhotoFile && !ridFailedPhotoUpload){
    $btn.text('Uploading photo…');
    try{
      await loadScriptOnce('../image-upload-service.js', 'CCImages');
      const blob = await window.CCImages.resizeImageToMax(ridPhotoFile, 1280);
      photoUrl = await window.CCImages.uploadImage(blob, 'delivery-proofs', `${orderId}-${Date.now()}`);
    } catch(err){
      console.error(err);
      // Don't strand a rider at the door with a bad signal: let them try
      // again, or finish without the photo.
      ridFailedPhotoUpload = true;
      showToast('Photo upload failed. Tap again to finish without the photo, or choose another photo to retry.', 'warning');
      $btn.prop('disabled', false).text('Deliver without photo');
      return;
    }
  }
  $btn.text('Saving…');
  try{
    const extra = photoUrl ? { deliveryPhoto: photoUrl } : undefined;
    await window.CCOrders.updateDeliveryStatus(orderId, 'completed', note || null, extra);
    showToast(`Order #${orderId.slice(0,6).toUpperCase()} marked delivered.`, 'success');
    closeDoneModal();
    await loadAndRenderMineAndHistory();
  } catch(err){
    console.error(err);
    showToast('Could not confirm delivery. Please try again.', 'error');
    $btn.prop('disabled', false).text(ridFailedPhotoUpload ? 'Deliver without photo' : 'Mark as Delivered');
  }
});

/* ================= FAILED DELIVERY ================= */
function openFailModal(orderId){
  $('#ridFailReason').val('');
  $('#ridFailNote').val('');
  $('#ridFailSubmit').data('order-id', orderId).prop('disabled', false).text('Report Failed Delivery');
  $('#ridFailOverlay').addClass('open');
}
function closeFailModal(){ $('#ridFailOverlay').removeClass('open'); }

$(document).on('click', '[data-open-fail]', function(){ openFailModal($(this).data('open-fail')); });
$(document).on('click', '#ridFailClose', closeFailModal);
$(document).on('click', '#ridFailOverlay', function(e){ if(e.target === this) closeFailModal(); });

$(document).on('click', '#ridFailSubmit', async function(){
  const orderId = $(this).data('order-id');
  const reason = $('#ridFailReason').val();
  const note = $('#ridFailNote').val().trim();
  if(!reason){ showToast('Choose what happened first.', 'warning'); return; }
  const $btn = $(this).prop('disabled', true).text('Saving…');
  try{
    const failureReason = note ? `${reason} — ${note}` : reason;
    await window.CCOrders.updateDeliveryStatus(orderId, 'delivery_failed', undefined, { failureReason });
    showToast(`Order #${orderId.slice(0,6).toUpperCase()} reported as not delivered.`, 'warning');
    closeFailModal();
    await loadAndRenderMineAndHistory();
  } catch(err){
    console.error(err);
    showToast('Could not report that. Please try again.', 'error');
    $btn.prop('disabled', false).text('Report Failed Delivery');
  }
});

$(document).on('keydown', function(e){
  if(e.key !== 'Escape') return;
  if($('#ridDoneOverlay').hasClass('open')) closeDoneModal();
  if($('#ridFailOverlay').hasClass('open')) closeFailModal();
});

/* ================= ROUTE MAP (Leaflet + OpenStreetMap, no API key) ================= */
function loadLeaflet(){
  if(window.L) return Promise.resolve();
  if(!document.querySelector('link[data-rid-leaflet]')){
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.dataset.ridLeaflet = '1';
    document.head.appendChild(link);
  }
  return loadScriptOnce('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'L');
}

/* Where deliveries start from — the shop pin set in Admin -> Settings. If
   it can't be read, the map just shows the customer and the rider. */
async function loadShop(){
  if(ridShop || ridShopTried) return ridShop;
  ridShopTried = true;
  try{
    await import('../settings-service.js');
    const s = await window.CCSettings.fetchSettings();
    const lat = Number(s.deliveryPricing.shopLat), lng = Number(s.deliveryPricing.shopLng);
    if(Number.isFinite(lat) && Number.isFinite(lng)) ridShop = { lat, lng };
  } catch(err){
    console.warn('Could not load the shop location for the route map.', err);
  }
  return ridShop;
}

function ridPin(cls, text){
  return L.divIcon({ className: 'rid-pin ' + cls, html: `<span>${text}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
}

async function ridFetchRoute(a, b){
  try{
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`, { signal: ctrl.signal });
    clearTimeout(timer);
    const data = await res.json();
    if(res.ok && data.code === 'Ok' && data.routes && data.routes[0]){
      const r = data.routes[0];
      return {
        line: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        km: r.distance / 1000,
        min: Math.max(1, Math.round(r.duration / 60))
      };
    }
  } catch(err){
    console.warn('Route lookup failed — drawing a straight line instead.', err);
  }
  return null;
}

async function openRouteMap(o){
  const id = o.id;
  const pin = pinOf(o);
  if(!pin) return;
  const $info = $(`#ridMapInfo-${id}`);
  try{
    await loadLeaflet();
  } catch(err){
    $info.text('Could not load the map.');
    return;
  }
  const entry = ridMaps[id] || (ridMaps[id] = {});
  if(!entry.map){
    entry.map = L.map(`ridMapEl-${id}`, { zoomControl: true }).setView([pin.lat, pin.lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(entry.map);
    L.marker([pin.lat, pin.lng], { icon: ridPin('rid-pin-dest', '⌂') }).addTo(entry.map).bindPopup('Customer');
  }
  // The wrapper animates open — re-measure once it has its final size.
  setTimeout(() => entry.map && entry.map.invalidateSize(), 350);

  const shop = await loadShop();
  const bounds = [[pin.lat, pin.lng]];
  if(shop){
    if(!entry.shopMarker) entry.shopMarker = L.marker([shop.lat, shop.lng], { icon: ridPin('rid-pin-shop', 'C&C') }).addTo(entry.map).bindPopup('Crafts & Crumbs');
    bounds.push([shop.lat, shop.lng]);
    if(!entry.routeDrawn){
      const route = await ridFetchRoute(shop, pin);
      if(route){
        entry.routeLayer = L.polyline(route.line, { color: '#a86f41', weight: 5, opacity: 0.85 }).addTo(entry.map);
        $info.html(`<b>${route.km.toFixed(1)} km</b> · about ${route.min} min by road`);
        route.line.forEach(p => bounds.push(p));
      } else {
        entry.routeLayer = L.polyline([[shop.lat, shop.lng], [pin.lat, pin.lng]], { color: '#a86f41', weight: 4, dashArray: '8 8' }).addTo(entry.map);
        $info.text('Showing a straight line — road route unavailable.');
      }
      entry.routeDrawn = true;
    }
  } else {
    const t = o.totals || {};
    $info.text(t.distanceKm != null ? `${Number(t.distanceKm).toFixed(1)} km from the shop` : 'Customer location');
  }
  if(entry.meLatLng) bounds.push(entry.meLatLng);
  entry.map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
}

$(document).on('click', '[data-toggle-map]', async function(){
  const orderId = String($(this).data('toggle-map'));
  const $wrap = $(`#ridMap-${orderId}`);
  const o = RIDER_ALL.find(x => x.id === orderId) || riderQueue.find(x => x.id === orderId);
  if($wrap.hasClass('open')){
    $wrap.removeClass('open');
    $(this).text(o && pinOf(o) ? 'View route' : 'Preview map');
    return;
  }
  $wrap.addClass('open');
  $(this).text('Hide map');
  if(o && pinOf(o)){
    await openRouteMap(o);
  } else {
    // Older order without a pin: the plain address preview, loaded on first open only.
    const $iframe = $wrap.find('iframe');
    if(!$iframe.attr('src')) $iframe.attr('src', $iframe.data('embed-src'));
  }
});

$(document).on('click', '[data-locate-me]', function(){
  const orderId = String($(this).data('locate-me'));
  const entry = ridMaps[orderId];
  if(!entry || !entry.map) return;
  if(!navigator.geolocation){ showToast('Your browser does not support location access.', 'warning'); return; }
  const $btn = $(this).prop('disabled', true).text('Locating…');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const ll = [pos.coords.latitude, pos.coords.longitude];
      entry.meLatLng = ll;
      if(entry.meMarker) entry.meMarker.setLatLng(ll);
      else entry.meMarker = L.marker(ll, { icon: ridPin('rid-pin-me', '●') }).addTo(entry.map).bindPopup('You are here');
      const o = RIDER_ALL.find(x => x.id === orderId) || riderQueue.find(x => x.id === orderId);
      const pin = o && pinOf(o);
      entry.map.fitBounds(pin ? [ll, [pin.lat, pin.lng]] : [ll], { padding: [28, 28], maxZoom: 16 });
      $btn.prop('disabled', false).text('My location');
    },
    () => {
      showToast('Could not get your location. Check that location access is allowed for this site.', 'warning');
      $btn.prop('disabled', false).text('My location');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

/* ================= REFRESH ================= */
$(document).on('click', '#ridRefreshBtn', () => loadAll());
