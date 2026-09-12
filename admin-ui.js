(function(){
  const ICONS = {
    success: '<path d="M4 12l5 5L20 6"/>',
    warning: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0z"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5l5 5"/><path d="M14.5 9.5l-5 5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>'
  };
  const DURATIONS = { success:2400, info:2600, warning:3200, error:3800 };

  const $toast = $(`
    <div class="adm-toast" id="admToast" role="status" aria-live="polite">
      <span class="adm-toast-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="admToastIconSvg"></svg></span>
      <span id="admToastMsg"></span>
    </div>
  `).appendTo('body');

  const queue = [];
  let active = false;
  let hideTimer = null;

  function advance(){
    const next = queue.shift();
    if(!next){ active = false; return; }
    active = true;
    clearTimeout(hideTimer);
    $toast.attr('class', 'adm-toast adm-toast-' + next.type);
    $('#admToastIconSvg').html(ICONS[next.type] || ICONS.success);
    $('#admToastMsg').text(next.msg);
    // Force reflow so the show/hide transition re-triggers even for
    // back-to-back toasts of the same type.
    void $toast[0].offsetWidth;
    $toast.addClass('show');
    hideTimer = setTimeout(() => {
      $toast.removeClass('show');
      setTimeout(advance, 250);
    }, next.ms);
  }

  window.showToast = function(msg, type = 'success', duration){
    const iconType = ICONS[type] ? type : 'success';
    const ms = duration || DURATIONS[iconType] || 2400;
    const last = queue[queue.length - 1];
    if(last && last.msg === msg && last.type === iconType) return;
    queue.push({ msg, type: iconType, ms });
    if(!active) advance();
  };

  /* ---------- Confirm dialog ---------- */
  const $confirm = $(`
    <div class="adm-confirm-overlay" id="admConfirmOverlay">
      <div class="adm-confirm-dialog" role="alertdialog" aria-modal="true">
        <div class="adm-confirm-icon" id="admConfirmIcon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 9v4.5M12 16.3v.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10.6 3.7a1.6 1.6 0 0 1 2.8 0l8.6 15A1.6 1.6 0 0 1 20.6 21H3.4a1.6 1.6 0 0 1-1.4-2.3l8.6-15Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        </div>
        <h3 id="admConfirmTitle">Are you sure?</h3>
        <p id="admConfirmMsg">This action can't be undone.</p>
        <div class="adm-confirm-actions">
          <button type="button" class="btn btn-outline" id="admConfirmCancel">Cancel</button>
          <button type="button" class="btn btn-primary" id="admConfirmOk">Confirm</button>
        </div>
      </div>
    </div>
  `).appendTo('body');

  let resolveFn = null;
  function close(result){
    $confirm.removeClass('open');
    if(resolveFn){ resolveFn(result); resolveFn = null; }
  }

  window.showConfirm = function({ title = 'Are you sure?', message = "This action can't be undone.", confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}){
    $('#admConfirmTitle').text(title);
    $('#admConfirmMsg').text(message);
    $('#admConfirmOk').text(confirmText).toggleClass('btn-danger', danger).toggleClass('btn-primary', !danger);
    $('#admConfirmCancel').text(cancelText);
    $('#admConfirmIcon').toggleClass('danger', danger);
    $confirm.addClass('open');
    return new Promise((resolve) => { resolveFn = resolve; });
  };

  $(document).on('click', '#admConfirmOk', () => close(true));
  $(document).on('click', '#admConfirmCancel', () => close(false));
  $(document).on('click', '#admConfirmOverlay', function(e){
    if(e.target.id === 'admConfirmOverlay') close(false);
  });
  $(document).on('keydown', function(e){
    if(e.key === 'Escape' && $confirm.hasClass('open')) close(false);
  });
})();