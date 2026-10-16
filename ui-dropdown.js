(function(){
  'use strict';

  const coarse = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if(coarse) return;

  let menu = null;       // the open menu element
  let owner = null;      // the <select> it belongs to
  let items = [];        // [{ el, index, disabled }]
  let activeIdx = -1;

  function enhanceable(el){
    return el instanceof HTMLSelectElement && !el.disabled && !el.multiple &&
      el.size <= 1 && !el.hasAttribute('data-no-dd');
  }

  function setActive(i, scroll){
    if(!items.length) return;
    items.forEach(it => it.el.classList.remove('is-active'));
    activeIdx = i;
    const it = items[i];
    if(!it) return;
    it.el.classList.add('is-active');
    if(scroll) it.el.scrollIntoView({ block: 'nearest' });
  }

  function step(dir){
    if(!items.length) return;
    let i = activeIdx;
    for(let n = 0; n < items.length; n++){
      i = (i + dir + items.length) % items.length;
      if(!items[i].disabled){ setActive(i, true); return; }
    }
  }

  function position(){
    if(!menu || !owner) return;
    const r = owner.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const gap = 6, edge = 8;
    menu.style.minWidth = Math.max(r.width, 140) + 'px';
    menu.style.maxHeight = '';
    const natural = Math.min(menu.scrollHeight, 280);
    const below = vh - r.bottom - edge - gap;
    const above = r.top - edge - gap;
    const up = below < Math.min(natural, 200) && above > below;

    menu.classList.toggle('is-up', up);
    menu.style.maxHeight = Math.max(120, Math.min(280, up ? above : below)) + 'px';
    if(up){
      menu.style.top = 'auto';
      menu.style.bottom = (vh - r.top + gap) + 'px';
    } else {
      menu.style.bottom = 'auto';
      menu.style.top = (r.bottom + gap) + 'px';
    }
    const w = menu.offsetWidth;
    menu.style.left = Math.max(edge, Math.min(r.left, vw - w - edge)) + 'px';
  }

  function close(immediate){
    if(!menu) return;
    const m = menu, sel = owner;
    menu = null; owner = null; items = []; activeIdx = -1;
    if(sel) sel.setAttribute('aria-expanded', 'false');
    m.classList.remove('is-open');
    if(immediate){ m.remove(); return; }
    m.classList.add('is-closing');
    setTimeout(() => m.remove(), 150);
  }

  function choose(i){
    const it = items[i];
    if(!it || it.disabled || !owner) return;
    const sel = owner;
    const changed = sel.selectedIndex !== it.index;
    sel.selectedIndex = it.index;
    close();
    sel.classList.remove('cc-dd-picked');
    void sel.offsetWidth; // restart the pop animation
    sel.classList.add('cc-dd-picked');
    setTimeout(() => sel.classList.remove('cc-dd-picked'), 450);
    if(changed){
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    sel.focus();
  }

  function open(sel){
    close(true);
    owner = sel;
    menu = document.createElement('div');
    menu.className = 'cc-dd-menu';
    menu.setAttribute('role', 'listbox');
    items = [];

    let n = 0;
    const addOption = (opt, groupDisabled) => {
      if(opt.hidden) return;
      const el = document.createElement('div');
      const disabled = opt.disabled || groupDisabled;
      el.className = 'cc-dd-opt' + (opt.selected ? ' is-selected' : '') + (disabled ? ' is-disabled' : '');
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', opt.selected ? 'true' : 'false');
      el.style.setProperty('--i', n++);
      el.textContent = opt.text;
      const idx = items.length;
      items.push({ el, index: opt.index, disabled });
      el.addEventListener('mousemove', () => { if(!disabled && activeIdx !== idx) setActive(idx, false); });
      el.addEventListener('click', () => choose(idx));
      menu.appendChild(el);
    };

    Array.from(sel.children).forEach(child => {
      if(child.tagName === 'OPTGROUP'){
        const g = document.createElement('div');
        g.className = 'cc-dd-group';
        g.textContent = child.label;
        menu.appendChild(g);
        Array.from(child.children).forEach(o => addOption(o, child.disabled));
      } else if(child.tagName === 'OPTION'){
        addOption(child, false);
      }
    });

    if(!items.length){ menu = null; owner = null; return; }

    // Keep the select focused while clicking inside the menu.
    menu.addEventListener('mousedown', e => e.preventDefault());
    document.body.appendChild(menu);
    position();

    sel.setAttribute('aria-expanded', 'true');
    sel.classList.remove('cc-dd-open');
    void sel.offsetWidth;
    sel.classList.add('cc-dd-open');
    setTimeout(() => sel.classList.remove('cc-dd-open'), 550);

    const start = items.findIndex(it => it.index === sel.selectedIndex && !it.disabled);
    setActive(start > -1 ? start : items.findIndex(it => !it.disabled), true);

    const m = menu;
    requestAnimationFrame(() => { if(menu === m) m.classList.add('is-open'); });
  }

  /* Capture phase so it runs before page handlers and before the browser
     opens its own popup. */
  document.addEventListener('mousedown', e => {
    if(e.button !== 0) return;
    const t = e.target;
    if(menu && menu.contains(t)) return;
    if(enhanceable(t)){
      e.preventDefault();      // stops the native popup
      t.focus();
      if(menu && owner === t) close(); else open(t);
      return;
    }
    if(menu) close();
  }, true);

  document.addEventListener('keydown', e => {
    if(menu){
      switch(e.key){
        case 'Escape':
          e.preventDefault(); e.stopPropagation(); // don't also close a modal underneath
          { const sel = owner; close(); if(sel) sel.focus(); }
          return;
        case 'ArrowDown': e.preventDefault(); step(1); return;
        case 'ArrowUp': e.preventDefault(); step(-1); return;
        case 'Home': e.preventDefault(); setActive(items.findIndex(it => !it.disabled), true); return;
        case 'End': e.preventDefault(); { let i = items.length - 1; while(i > 0 && items[i].disabled) i--; setActive(i, true); } return;
        case 'Enter':
        case ' ':
          e.preventDefault(); e.stopPropagation(); choose(activeIdx); return;
        case 'Tab': close(); return;
      }
      return;
    }
    if(enhanceable(e.target) && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')){
      e.preventDefault();
      open(e.target);
    }
  }, true);

  // Anything that moves the select out from under the menu closes it.
  window.addEventListener('resize', () => close(true));
  window.addEventListener('blur', () => close(true));
  window.addEventListener('scroll', e => {
    if(menu && !menu.contains(e.target)) close(true);
  }, true);
})();