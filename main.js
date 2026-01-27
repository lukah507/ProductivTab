// main.js — updated to support separate text styling, movable notes, and new UI wiring
(function(){
  'use strict';

  /* ---------- Storage helpers ---------- */
  function storageSyncGet(keys) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(keys, resolve);
      } else {
        const result = {};
        (Array.isArray(keys) ? keys : [keys]).forEach(k => { try { result[k] = JSON.parse(localStorage.getItem(k)); } catch(e){ result[k]=null }});
        resolve(result);
      }
    });
  }
  function storageSyncSet(obj) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set(obj, resolve);
      } else {
        Object.entries(obj).forEach(([k,v]) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} });
        resolve();
      }
    });
  }
  function storageLocalGet(keys) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(keys, resolve);
      } else {
        const result = {};
        (Array.isArray(keys) ? keys : [keys]).forEach(k => { try { result[k] = JSON.parse(localStorage.getItem(k)); } catch(e){ result[k]=null }});
        resolve(result);
      }
    });
  }
  function storageLocalSet(obj) {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(obj, resolve);
      } else {
        Object.entries(obj).forEach(([k,v]) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} });
        resolve();
      }
    });
  }

  /* ---------- DOM refs ---------- */
  const topBar = document.getElementById('top-bar');
  const bottomBar = document.getElementById('bottom-bar');
  const topAddBtn = document.getElementById('top-add-btn');
  const bottomAddBtn = document.getElementById('bottom-add-btn');

  const dateEl = document.getElementById('date');
  const timeEl = document.getElementById('time');
  const quoteEl = document.getElementById('quote');

  const clockToggle = document.getElementById('clock-toggle');
  const editQuotesBtn = document.getElementById('edit-quotes');
  const modal = document.getElementById('modal');
  const quotesTextarea = document.getElementById('quotes-textarea');
  const saveQuotesBtn = document.getElementById('save-quotes');
  const closeModalBtn = document.getElementById('close-modal');

  const bgUpload = document.getElementById('bg-upload');
  const colorInput = document.getElementById('color-input');
  const colorApplyBtn = document.getElementById('color-apply');

  const settingsBtn = document.getElementById('settings-button');
  const centerControls = document.getElementById('center-controls');
  const settingsDone = document.getElementById('settings-done');

  const fontPickerModal = document.getElementById('font-picker-modal');
  const fontList = document.getElementById('font-list');
  const fontApplyBtn = document.getElementById('font-apply');
  const fontCancelBtn = document.getElementById('font-picker-cancel');
  const timeColorInput = document.getElementById('time-color-input');
  const dateColorInput = document.getElementById('date-color-input');
  const quoteColorInput = document.getElementById('quote-color-input');
  const timeBold = document.getElementById('time-bold');
  const dateBold = document.getElementById('date-bold');
  const quoteBold = document.getElementById('quote-bold');

  const notesList = document.getElementById('notes-list');
  const notesContainer = document.getElementById('notes-container');
  const addNoteFab = document.getElementById('add-note-fab');

  /* ---------- Defaults & state ---------- */
  const DEFAULTS = {
    topLinks: [
      { title: 'Google', url: 'https://www.google.com' },
      { title: 'Gmail', url: 'https://mail.google.com' }
    ],
    bottomLinks: [
      { title: 'YouTube', url: 'https://www.youtube.com' },
      { title: 'Drive', url: 'https://drive.google.com' }
    ],
    quotes: [
      "Be yourself; everyone else is already taken. — Oscar Wilde",
      "Do one thing every day that scares you. — Eleanor Roosevelt",
      "The only way to do great work is to love what you do. — Steve Jobs"
    ],
    clock24: false,
    colorOverride: '',
    textStyles: {
      time: { color: '', bold: false },
      date: { color: '', bold: false },
      quote: { color: '', bold: false }
    }
  };

  let state = {
    topLinks: DEFAULTS.topLinks.slice(),
    bottomLinks: DEFAULTS.bottomLinks.slice(),
    quotes: DEFAULTS.quotes.slice(),
    clock24: DEFAULTS.clock24,
    colorOverride: DEFAULTS.colorOverride,
    textStyles: JSON.parse(JSON.stringify(DEFAULTS.textStyles)),
    bgCurrent: '',
    notes: [] // notes: [{id, color, text, x, y}]
  };

  /* ---------- Helpers ---------- */
  function qsa(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }
  function uid(){ return Math.random().toString(36).slice(2,9); }
  function faviconForUrl(url){
    try { const u = new URL(url); return 'https://s2.googleusercontent.com/s2/favicons?domain=' + u.hostname; }
    catch(e) { return ''; }
  }

  /* ---------- Render links / bars ---------- */
  function renderLinkItem(link) {
    const a = document.createElement('a');
    a.className = 'link-item';
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.color = state.colorOverride || '';

    const icon = document.createElement('span');
    icon.className = 'icon';
    const fav = faviconForUrl(link.url);
    if (fav) {
      const img = document.createElement('img'); img.src = fav; img.alt = '';
      icon.appendChild(img);
    } else {
      icon.textContent = (link.title||link.url||'•').charAt(0).toUpperCase();
      if (state.colorOverride) icon.style.color = state.colorOverride;
    }

    const label = document.createElement('div'); label.className = 'label'; label.textContent = link.title || link.url; label.style.fontSize='12px';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-shortcut';
    removeBtn.type = 'button';
    removeBtn.title = 'Remove shortcut';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      if (confirm('Remove "' + (link.title||link.url) + '"?')) removeLink(link);
    });

    a.appendChild(icon); a.appendChild(label); a.appendChild(removeBtn);

    a.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      if (confirm('Remove "' + (link.title||link.url) + '"?')) removeLink(link);
    });

    return a;
  }

  function renderBars() {
    if (topBar) topBar.innerHTML = '';
    if (bottomBar) bottomBar.innerHTML = '';

    (state.topLinks || []).forEach(l => topBar && topBar.appendChild(renderLinkItem(l)));
    (state.bottomLinks || []).forEach(l => bottomBar && bottomBar.appendChild(renderLinkItem(l)));

    applyColorToBars();
  }

  function applyColorToBars(){
    qsa('.link-item').forEach(a => {
      a.style.color = state.colorOverride || '';
      const icon = a.querySelector('.icon');
      if (icon) {
        const img = icon.querySelector('img');
        if (!img) icon.style.color = state.colorOverride || '';
        else icon.style.color = '';
        icon.style.background = '';
      }
    });
    if (settingsBtn) {
      if (state.colorOverride) { settingsBtn.style.setProperty('--accent-color', state.colorOverride); settingsBtn.classList.add('active'); }
      else { settingsBtn.classList.remove('active'); settingsBtn.style.removeProperty('--accent-color'); }
    }
  }

  /* ---------- Link CRUD ---------- */
  async function saveLinks() { await storageSyncSet({ topLinks: state.topLinks, bottomLinks: state.bottomLinks }); }
  function addLink(list, link) {
    if (list === 'top') state.topLinks.push(link); else state.bottomLinks.push(link);
    saveLinks(); renderBars();
  }
  async function removeLink(link) {
    state.topLinks = state.topLinks.filter(l => l.url !== link.url || l.title !== link.title);
    state.bottomLinks = state.bottomLinks.filter(l => l.url !== link.url || l.title !== link.title);
    await saveLinks();
    renderBars();
  }
  function addLinkPrompt(list) {
    const url = prompt('Enter URL (https://...)'); if (!url) return;
    const title = prompt('Title (optional)', url.replace(/^https?:\/\//,'').replace(/\/.*$/,''));
    addLink(list, { title: title || url, url });
  }

  /* ---------- Background upload ---------- */
  bgUpload && bgUpload.addEventListener('change', async (ev) => {
    const files = Array.from(ev.target.files || []); if (!files.length) return;
    for (const f of files) {
      const r = new FileReader();
      r.onload = async (e) => {
        state.bgCurrent = e.target.result;
        await storageLocalSet({ bgCurrent: state.bgCurrent });
        document.body.style.backgroundImage = `url(${state.bgCurrent})`;
      };
      r.readAsDataURL(f);
    }
  });

  /* ---------- Time / Date / Quotes styling ---------- */
  function applyTextStyles() {
    if (timeEl && state.textStyles.time) {
      timeEl.style.color = state.textStyles.time.color || '';
      timeEl.style.fontWeight = state.textStyles.time.bold ? '700' : '';
    }
    if (dateEl && state.textStyles.date) {
      dateEl.style.color = state.textStyles.date.color || '';
      dateEl.style.fontWeight = state.textStyles.date.bold ? '700' : '';
    }
    if (quoteEl && state.textStyles.quote) {
      quoteEl.style.color = state.textStyles.quote.color || '';
      quoteEl.style.fontWeight = state.textStyles.quote.bold ? '700' : '';
    }
  }

  /* ---------- Date / Time / Quotes ---------- */
  function formatDate(d) {
    const day = String(d.getDate()).padStart(2,'0');
    const month = d.toLocaleString(undefined, { month: 'long' });
    const weekday = d.toLocaleString(undefined, { weekday: 'long' });
    return `${day} ${month}, ${weekday}`;
  }
  function formatTime(d) {
    if (state.clock24) return d.toLocaleTimeString([], { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
    return d.toLocaleTimeString([], { hour12:true, hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }
  function updateTime() {
    const now = new Date();
    dateEl && (dateEl.textContent = formatDate(now));
    timeEl && (timeEl.textContent = formatTime(now));
  }
  setInterval(updateTime,1000);

  clockToggle && clockToggle.addEventListener('click', async () => {
    state.clock24 = !state.clock24; await storageSyncSet({ clock24: state.clock24 }); updateTime();
  });

  editQuotesBtn && editQuotesBtn.addEventListener('click', () => {
    quotesTextarea.value = (state.quotes || []).join('\n'); modal && modal.setAttribute('aria-hidden','false');
  });
  closeModalBtn && closeModalBtn.addEventListener('click', () => modal && modal.setAttribute('aria-hidden','true'));
  saveQuotesBtn && saveQuotesBtn.addEventListener('click', async () => {
    state.quotes = (quotesTextarea.value||'').split(/\n/).map(s => s.trim()).filter(Boolean);
    await storageSyncSet({ quotes: state.quotes });
    modal && modal.setAttribute('aria-hidden','true');
    quoteEl && (quoteEl.textContent = (state.quotes && state.quotes.length) ? state.quotes[0] : '');
  });

  /* ---------- Font picker / text styling UI ---------- */
  // Populate font list (keeps existing fonts list if present)
  const availableFonts = [
    { name: 'Inter (Default)', family: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' },
    { name: 'Molle', family: 'Molle, cursive' },
    { name: 'Cossette', family: 'Cossette, serif' }
  ];
  function populateFontList() {
    if (!fontList) return;
    fontList.innerHTML = '';
    availableFonts.forEach(f => {
      const btn = document.createElement('button');
      btn.className = 'mini-btn';
      btn.textContent = f.name;
      btn.addEventListener('click', () => {
        document.body.style.fontFamily = f.family;
      });
      fontList.appendChild(btn);
    });
  }
  if (fontApplyBtn) {
    fontApplyBtn.addEventListener('click', async () => {
      // read inputs and persist
      state.textStyles.time.color = timeColorInput.value || '';
      state.textStyles.date.color = dateColorInput.value || '';
      state.textStyles.quote.color = quoteColorInput.value || '';
      state.textStyles.time.bold = !!timeBold.checked;
      state.textStyles.date.bold = !!dateBold.checked;
      state.textStyles.quote.bold = !!quoteBold.checked;
      await storageSyncSet({ textStyles: state.textStyles });
      applyTextStyles();
      if (fontPickerModal) fontPickerModal.setAttribute('aria-hidden','true');
    });
  }
  if (fontCancelBtn) fontCancelBtn.addEventListener('click', () => fontPickerModal && fontPickerModal.setAttribute('aria-hidden','true'));

  /* ---------- Notes: Movable notes with positions persisted ---------- */
  async function loadNotes() {
    const res = await storageLocalGet(['notes']);
    state.notes = res.notes || [];
  }
  async function saveNotes() { await storageLocalSet({ notes: state.notes }); }

  function createNoteElement(n) {
    const note = document.createElement('div');
    note.className = 'note color-' + (n.color || 'yellow');
    note.style.left = (n.x != null ? n.x : 20) + 'px';
    note.style.top = (n.y != null ? n.y : 140) + 'px';
    note.dataset.id = n.id;

    const handle = document.createElement('div');
    handle.className = 'note-handle';
    handle.textContent = '≡'; // simple drag handle

    const ta = document.createElement('textarea');
    ta.value = n.text || '';
    ta.placeholder = 'Note...';
    ta.addEventListener('input', () => {
      const found = state.notes.find(x => x.id === n.id);
      if (found) { found.text = ta.value; saveNotes(); }
    });

    const row = document.createElement('div');
    row.style.display = 'flex'; row.style.gap = '6px'; row.style.marginTop = '8px'; row.style.justifyContent = 'flex-end';

    const del = document.createElement('button');
    del.className = 'mini-btn';
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      if (confirm('Delete note?')) {
        state.notes = state.notes.filter(x => x.id !== n.id);
        await saveNotes();
        renderNotes();
      }
    });

    const select = document.createElement('select');
    ['yellow','pink','blue'].forEach(c => {
      const opt = document.createElement('option'); opt.value = c; opt.text = c;
      if (c === n.color) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', async () => {
      const f = state.notes.find(x => x.id === n.id);
      if (f) { f.color = select.value; await saveNotes(); renderNotes(); }
    });

    row.appendChild(select); row.appendChild(del);

    note.appendChild(handle); note.appendChild(ta); note.appendChild(row);

    // Drag logic using pointer events on handle
    let dragging = false;
    let startX=0, startY=0, origX=0, origY=0;
    const onPointerMove = (ev) => {
      if (!dragging) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const nx = Math.max(0, origX + dx);
      const ny = Math.max(0, origY + dy);
      note.style.left = nx + 'px';
      note.style.top = ny + 'px';
    };
    const onPointerUp = async (ev) => {
      if (!dragging) return;
      dragging = false;
      handle.releasePointerCapture(ev.pointerId);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      // persist position
      const id = note.dataset.id;
      const f = state.notes.find(x => x.id === id);
      if (f) { f.x = parseInt(note.style.left,10); f.y = parseInt(note.style.top,10); await saveNotes(); }
    };

    handle.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      dragging = true;
      startX = ev.clientX; startY = ev.clientY;
      origX = parseInt(note.style.left || 0, 10);
      origY = parseInt(note.style.top || 0, 10);
      handle.setPointerCapture(ev.pointerId);
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    });

    return note;
  }

  function renderNotes() {
    if (!notesList) return;
    // clear existing
    notesList.innerHTML = '';
    // add each note DOM element
    state.notes.forEach(n => {
      const el = createNoteElement(n);
      notesList.appendChild(el);
    });
  }

  addNoteFab && addNoteFab.addEventListener('click', async () => {
    const newNote = { id: uid(), color: 'yellow', text: '', x: 24, y: 140 + (state.notes.length * 20) };
    state.notes.push(newNote);
    await saveNotes();
    renderNotes();
  });

  /* ---------- Color apply for icons (persist colorOverride separately) ---------- */
  colorApplyBtn && colorApplyBtn.addEventListener('click', async () => {
    const val = (colorInput && colorInput.value) ? colorInput.value.trim() : '';
    if (val && val.match(/^#?[0-9a-fA-F]{6}$/)) {
      const color = (val[0] === '#') ? val : ('#' + val);
      state.colorOverride = color;
      await storageSyncSet({ colorOverride: state.colorOverride });
      applyColorToBars();
    } else {
      alert('Please pick a color.');
    }
  });

  /* ---------- Load / save initial state ---------- */
  async function loadInitialState() {
    const syncRes = await storageSyncGet(['topLinks','bottomLinks','quotes','clock24','colorOverride','textStyles']);
    if (syncRes.topLinks) state.topLinks = syncRes.topLinks;
    if (syncRes.bottomLinks) state.bottomLinks = syncRes.bottomLinks;
    if (syncRes.quotes) state.quotes = syncRes.quotes;
    if (typeof syncRes.clock24 !== 'undefined') state.clock24 = syncRes.clock24;
    if (syncRes.colorOverride) state.colorOverride = syncRes.colorOverride;
    if (syncRes.textStyles) state.textStyles = Object.assign({}, state.textStyles, syncRes.textStyles);

    const localRes = await storageLocalGet(['bgCurrent','notes']);
    state.bgCurrent = localRes.bgCurrent || state.bgCurrent;
    state.notes = localRes.notes || state.notes;

    // apply background if present
    if (state.bgCurrent) document.body.style.backgroundImage = `url(${state.bgCurrent})`;

    // set UI values
    if (colorInput && state.colorOverride) colorInput.value = state.colorOverride;
    if (timeColorInput && state.textStyles.time) timeColorInput.value = state.textStyles.time.color || '#000000';
    if (dateColorInput && state.textStyles.date) dateColorInput.value = state.textStyles.date.color || '#000000';
    if (quoteColorInput && state.textStyles.quote) quoteColorInput.value = state.textStyles.quote.color || '#000000';
    if (timeBold) timeBold.checked = !!state.textStyles.time.bold;
    if (dateBold) dateBold.checked = !!state.textStyles.date.bold;
    if (quoteBold) quoteBold.checked = !!state.textStyles.quote.bold;

    renderBars();
    await loadNotes();
    renderNotes();

    updateTime();
    applyTextStyles();
  }

  /* ---------- UI Wiring: settings toggle & done & font modal open ---------- */
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      const open = document.body.classList.toggle('settings-open');
      if (centerControls) centerControls.classList.toggle('hidden', !open);
      settingsBtn.classList.toggle('active', open);
    });
  }
  if (settingsDone) {
    settingsDone.addEventListener('click', () => {
      document.body.classList.remove('settings-open');
      if (centerControls) centerControls.classList.add('hidden');
      if (settingsBtn) settingsBtn.classList.remove('active');
    });
  }

  // open font picker via a dedicated UI element - you can add a button elsewhere; reusing existing font picker trigger
  // For convenience: open font picker when user double-clicks the center quote (example)
  if (fontList) populateFontList();
  function populateFontList(){ /* kept intentionally lightweight - font buttons wired earlier */ }

  // add a simple opener to font picker via a longpress on the quote or through developer tools:
  // (keep it explicit — add a UI button if you'd like)
  // We'll wire opening the font-picker modal to a keyboard shortcut: press 't' while holding Shift to open the text styling modal
  window.addEventListener('keydown', (ev) => {
    if (ev.shiftKey && ev.key.toLowerCase() === 't') {
      if (fontPickerModal) { fontPickerModal.setAttribute('aria-hidden','false'); }
    }
  });

  // Also expose a quick open function
  window.openTextStyling = function(){ if (fontPickerModal) fontPickerModal.setAttribute('aria-hidden','false'); };

  /* ---------- Init ---------- */
  async function init(){ await loadInitialState(); }
  init();

  // Expose debug
  window.__customNewTab = { state, renderBars, applyColorToBars, openTextStyling };

})();