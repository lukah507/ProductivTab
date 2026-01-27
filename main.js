// main.js - Manifest V3 compatible new-tab logic using chrome.storage
// Features implemented:
// - top/bottom bars (add/remove links, favicon), right-click removal
// - background upload (gallery management removed per request)
// - on-load random background selection, and overlay color selection via pixel sampling
// - custom icon/text color override (sync setting), used for icons/text and overlay derivation
// - center date/time (12/24 toggle), quotes (editable list saved to storage)
// - sticky notes (add/edit/delete, three colors) saved to chrome.storage.local
//
// Storage strategy:
// - chrome.storage.sync: small settings and arrays (topLinks, bottomLinks, colorOverride, clock24)
// - chrome.storage.local: larger assets (bgList, notes, bgCurrent)
// Note: chrome.storage is async; helper wrappers below.

(function(){
  'use strict';

  /* ---------- Storage helpers ---------- */

  function storageSyncGet(keys) {
    return new Promise(resolve => chrome.storage.sync.get(keys, resolve));
  }
  function storageSyncSet(obj) {
    return new Promise(resolve => chrome.storage.sync.set(obj, resolve));
  }
  function storageLocalGet(keys) {
    return new Promise(resolve => chrome.storage.local.get(keys, resolve));
  }
  function storageLocalSet(obj) {
    return new Promise(resolve => chrome.storage.local.set(obj, resolve));
  }

  /* ---------- Element refs ---------- */
  const topBar = document.getElementById('top-bar');
  const bottomBar = document.getElementById('bottom-bar');
  const topOverlay = document.getElementById('top-bar-overlay');
  const bottomOverlay = document.getElementById('bottom-bar-overlay');
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

  const notesList = document.getElementById('notes-list');
  const addNoteBtn = document.getElementById('add-note-btn');

  /* ---------- Defaults ---------- */
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
    colorOverride: '' // e.g., "#336699"
  };

  /* ---------- Utility helpers ---------- */
  function $(id){return document.getElementById(id);}
  function qsa(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }
  function uid(){ return Math.random().toString(36).slice(2,9); }

  function faviconForUrl(url){
    try {
      const u = new URL(url);
      return 'https://s2.googleusercontent.com/s2/favicons?domain=' + u.hostname;
    } catch(e){ return ''; }
  }

  /* ---------- State (loaded from storage) ---------- */
  let state = {
    topLinks: DEFAULTS.topLinks.slice(),
    bottomLinks: DEFAULTS.bottomLinks.slice(),
    quotes: DEFAULTS.quotes.slice(),
    clock24: DEFAULTS.clock24,
    colorOverride: DEFAULTS.colorOverride,
    // from local:
    bgList: [], // array of dataURLs
    bgCurrent: '',
    notes: [] // {id, color, text}
  };

  /* ---------- Render functions ---------- */

  function renderLinkItem(link) {
    const a = document.createElement('a');
    a.className = 'link-item';
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    // apply color override to text if present
    if (state.colorOverride) a.style.color = state.colorOverride;

    const icon = document.createElement('span');
    icon.className = 'icon';
    const fav = faviconForUrl(link.url);
    if (fav) {
      const img = document.createElement('img');
      img.src = fav;
      img.alt = '';
      icon.appendChild(img);
    } else {
      // Letter icon: apply color to text only (background is transparent)
      icon.textContent = (link.title||link.url||'•').charAt(0).toUpperCase();
      if (state.colorOverride) icon.style.color = state.colorOverride;
    }

    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = link.title || link.url;
    label.style.fontSize = '12px';

    // Add remove button (visible only when settings are open via CSS)
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-shortcut';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove shortcut';
    removeBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (confirm('Remove "' + (link.title||link.url) + '"?')) {
        removeLink(link);
      }
    });

    a.appendChild(removeBtn);
    a.appendChild(icon);
    a.appendChild(label);

    // Add remove (×) button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-shortcut';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove shortcut';
    removeBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      removeLink(link);
    });
    a.appendChild(removeBtn);

    // right-click remove (legacy option)
    a.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      if (confirm('Remove "' + (link.title||link.url) + '"?')) {
        removeLink(link);
      }
    });

    return a;
  }

  function renderBars() {
    topBar.innerHTML = '';
    bottomBar.innerHTML = '';
    state.topLinks.forEach(l => topBar.appendChild(renderLinkItem(l)));
    state.bottomLinks.forEach(l => bottomBar.appendChild(renderLinkItem(l)));
    applyColorToBars();
  }

  function applyColorToBars(){
    qsa('.link-item').forEach(a => {
      // Apply color to link text
      a.style.color = state.colorOverride || '';
      const icon = a.querySelector('.icon');
      if (icon && state.colorOverride) {
        // Only apply color to letter icons (not favicons)
        const hasImage = icon.querySelector('img');
        if (!hasImage) {
          // Letter icon: apply text color only
          icon.style.color = state.colorOverride;
        }
        // Do NOT change icon background (it's transparent)
      }
    });
  }

  /* ---------- Link CRUD ---------- */
  async function saveLinksToSync() {
    await storageSyncSet({ topLinks: state.topLinks, bottomLinks: state.bottomLinks });
  }
  function addLink(listName, link) {
    if (listName === 'top') state.topLinks.push(link);
    else state.bottomLinks.push(link);
    saveLinksToSync().then(renderBars);
  }
  function removeLink(link) {
    state.topLinks = state.topLinks.filter(l => l.url !== link.url);
    state.bottomLinks = state.bottomLinks.filter(l => l.url !== link.url);
    saveLinksToSync().then(renderBars);
  }

  /* ---------- Background handling ---------- */

  async function loadBackgroundsFromLocal() {
    const res = await storageLocalGet(['bgList','bgCurrent']);
    state.bgList = res.bgList || [];
    state.bgCurrent = res.bgCurrent || '';
  }

  async function saveBackgroundsToLocal() {
    await storageLocalSet({ bgList: state.bgList, bgCurrent: state.bgCurrent });
  }

  function setBodyBackground(dataUrl) {
    if (dataUrl) {
      document.body.style.backgroundImage = `url(${dataUrl})`;
      state.bgCurrent = dataUrl;
      saveBackgroundsToLocal();
      // update overlays after background is painted
      setTimeout(updateBarOverlaysBasedOnBackground, 300);
    } else {
      document.body.style.backgroundImage = '';
    }
  }

  function processFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = e => resolve(e.target.result);
      fr.onerror = (e) => reject(e);
      fr.readAsDataURL(file);
    });
  }

  bgUpload.addEventListener('change', async (ev) => {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;
    for (const f of files) {
      try {
        const dataUrl = await processFileAsDataUrl(f);
        // add to gallery
        state.bgList.push(dataUrl);
      } catch (e) {
        console.error('file read error', e);
      }
    }
    // save gallery and set one as current (last uploaded)
    await saveBackgroundsToLocal();
    if (state.bgList.length) {
      setBodyBackground(state.bgList[state.bgList.length - 1]);
    }
    ev.target.value = '';
    alert('Uploaded ' + files.length + ' image(s).');
  });

  // Gallery management removed per user request

  function pickRandomBackgroundOnLoad() {
    if (state.bgList && state.bgList.length) {
      const pick = state.bgList[Math.floor(Math.random()*state.bgList.length)];
      setBodyBackground(pick);
    } else if (state.bgCurrent) {
      setBodyBackground(state.bgCurrent);
    }
  }

  /* ---------- Color-sampling & overlay ---------- */

  // Compute average color of the visible background in the area of sampleElem
  function computeAverageColorOfElement(sampleElem) {
    return new Promise((resolve) => {
      const bg = state.bgCurrent || '';
      if (!bg) return resolve(null);

      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = function(){
        const rect = sampleElem.getBoundingClientRect();
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(rect.width));
        canvas.height = Math.max(1, Math.floor(rect.height));
        const ctx = canvas.getContext('2d');

        // draw image sized "cover" to fill the canvas (approx)
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const cw = canvas.width, ch = canvas.height;
        const scale = Math.max(cw/iw, ch/ih);
        const sw = iw*scale, sh = ih*scale;
        const sx = (cw - sw)/2, sy = (ch - sh)/2;
        try {
          ctx.drawImage(img, sx, sy, sw, sh);
          const data = ctx.getImageData(0,0,canvas.width,canvas.height).data;
          let r=0,g=0,b=0,count=0;
          const stepX = Math.max(1, Math.floor(canvas.width/20));
          const stepY = Math.max(1, Math.floor(canvas.height/10));
          for (let y=0;y<canvas.height;y+=stepY){
            for (let x=0;x<canvas.width;x+=stepX){
              const idx = (y*canvas.width + x)*4;
              r += data[idx]; g += data[idx+1]; b += data[idx+2]; count++;
            }
          }
          r = Math.round(r/count); g = Math.round(g/count); b = Math.round(b/count);
          resolve({r,g,b});
        } catch (e) {
          // CORS or other issue
          console.warn('sample failed', e);
          resolve(null);
        }
      };
      img.onerror = function(){ resolve(null); };
      img.src = state.bgCurrent;
    });
  }

  function luminanceFromRGB({r,g,b}) {
    return (0.2126*r + 0.7152*g + 0.0722*b) / 255;
  }

  async function updateBarOverlaysBasedOnBackground(){
    // top
    const pairs = [
      {overlay: topOverlay, sample: topBar},
      {overlay: bottomOverlay, sample: bottomBar}
    ];
    for (const p of pairs) {
      const avg = await computeAverageColorOfElement(p.sample);
      if (!avg) {
        p.overlay.style.background = 'rgba(0,0,0,0.45)';
        continue;
      }
      if (state.colorOverride) {
        // derive darkest or lightest shade of override color based on brightness
        const hex = state.colorOverride.replace('#','');
        if (hex.length === 6) {
          const cr = parseInt(hex.slice(0,2),16);
          const cg = parseInt(hex.slice(2,4),16);
          const cb = parseInt(hex.slice(4,6),16);
          const lum = luminanceFromRGB({r:cr,g:cg,b:cb});
          if (lum > 0.6) {
            // darken it
            p.overlay.style.background = `rgba(${Math.floor(cr*0.12)},${Math.floor(cg*0.12)},${Math.floor(cb*0.12)},${0.95})`;
          } else {
            // lighten / opaque white-ish
            p.overlay.style.background = `rgba(${Math.min(255,cr+180)},${Math.min(255,cg+180)},${Math.min(255,cb+180)},${0.95})`;
          }
          continue;
        }
      }
      const lum = luminanceFromRGB(avg);
      if (lum < 0.5) p.overlay.style.background = 'rgba(0,0,0,0.85)';
      else p.overlay.style.background = 'rgba(255,255,255,0.95)';
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
    if (state.clock24) {
      return d.toLocaleTimeString([], { hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
    } else {
      return d.toLocaleTimeString([], { hour12:true, hour:'2-digit', minute:'2-digit', second:'2-digit' });
    }
  }

  function updateTime() {
    const now = new Date();
    dateEl.textContent = formatDate(now);
    timeEl.textContent = formatTime(now);
  }

  function chooseRandomQuote() {
    if (!state.quotes || !state.quotes.length) return '';
    return state.quotes[Math.floor(Math.random()*state.quotes.length)];
  }

  clockToggle.addEventListener('click', async () => {
    state.clock24 = !state.clock24;
    await storageSyncSet({ clock24: state.clock24 });
    updateTime();
  });

  editQuotesBtn.addEventListener('click', () => {
    quotesTextarea.value = (state.quotes || []).join('\n');
    modal.setAttribute('aria-hidden','false');
  });
  closeModalBtn.addEventListener('click', () => modal.setAttribute('aria-hidden','true'));
  saveQuotesBtn.addEventListener('click', async () => {
    const arr = quotesTextarea.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    state.quotes = arr;
    await storageSyncSet({ quotes: state.quotes });
    quoteEl.textContent = chooseRandomQuote();
    modal.setAttribute('aria-hidden','true');
  });

  /* ---------- Color override ---------- */

  colorApplyBtn.addEventListener('click', async () => {
    const val = (colorInput.value || '').trim();
    if (!val) {
      state.colorOverride = '';
      await storageSyncSet({ colorOverride: '' });
    } else {
      // Native color input always returns #rrggbb format
      state.colorOverride = val;
      await storageSyncSet({ colorOverride: state.colorOverride });
    }
    applyColorToBars();
    updateBarOverlaysBasedOnBackground();
  });

  /* ---------- Sticky notes ---------- */

  async function loadNotesFromLocal() {
    const res = await storageLocalGet(['notes']);
    state.notes = res.notes || [];
  }
  async function saveNotesToLocal() { await storageLocalSet({ notes: state.notes }); }

  function renderNotes() {
    notesList.innerHTML = '';
    state.notes.forEach(n => {
      const note = document.createElement('div');
      note.className = 'note color-' + (n.color || 'yellow');

      const ta = document.createElement('textarea');
      ta.value = n.text || '';
      ta.placeholder = 'Note...';
      ta.addEventListener('input', () => {
        const found = state.notes.find(x => x.id === n.id);
        if (found) { found.text = ta.value; saveNotesToLocal(); }
      });

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '6px';
      row.style.marginTop = '8px';
      row.style.justifyContent = 'flex-end';

      const del = document.createElement('button');
      del.className = 'mini-btn';
      del.textContent = 'Delete';
      del.addEventListener('click', async () => {
        if (confirm('Delete note?')) {
          state.notes = state.notes.filter(x => x.id !== n.id);
          await saveNotesToLocal();
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
        if (f) { f.color = select.value; await saveNotesToLocal(); renderNotes(); }
      });

      row.appendChild(select);
      row.appendChild(del);
      note.appendChild(ta);
      note.appendChild(row);
      notesList.appendChild(note);
    });
  }

  addNoteBtn.addEventListener('click', async () => {
    const newNote = { id: uid(), color: 'yellow', text: '' };
    state.notes.push(newNote);
    await saveNotesToLocal();
    renderNotes();
  });

  /* ---------- Add link prompt handlers ---------- */

  topAddBtn.addEventListener('click', () => {
    addLinkPrompt('top');
  });
  bottomAddBtn.addEventListener('click', () => {
    addLinkPrompt('bottom');
  });

  function addLinkPrompt(list) {
    const url = prompt('Enter URL (https://...)');
    if (!url) return;
    const title = prompt('Title (optional)', url.replace(/^https?:\/\//,'').replace(/\/.*$/,''));
    const entry = { title: title || url, url: url };
    if (list === 'top') state.topLinks.push(entry);
    else state.bottomLinks.push(entry);
    storageSyncSet({ topLinks: state.topLinks, bottomLinks: state.bottomLinks }).then(renderBars);
  }

  /* ---------- Initialization and load ---------- */

  async function loadInitialState() {
    // load sync keys: topLinks, bottomLinks, quotes, clock24, colorOverride
    const syncRes = await storageSyncGet(['topLinks','bottomLinks','quotes','clock24','colorOverride']);
    if (syncRes.topLinks) state.topLinks = syncRes.topLinks;
    if (syncRes.bottomLinks) state.bottomLinks = syncRes.bottomLinks;
    if (syncRes.quotes) state.quotes = syncRes.quotes;
    if (typeof syncRes.clock24 !== 'undefined') state.clock24 = syncRes.clock24;
    if (syncRes.colorOverride) state.colorOverride = syncRes.colorOverride;

    // load local: bgList, bgCurrent, notes
    const localRes = await storageLocalGet(['bgList','bgCurrent','notes']);
    state.bgList = localRes.bgList || [];
    state.bgCurrent = localRes.bgCurrent || '';
    state.notes = localRes.notes || [];
  }

  async function init() {
    await loadInitialState();

    // set any current background (or choose random gallery)
    if (state.bgList && state.bgList.length) {
      // pick a random one on load
      const r = state.bgList[Math.floor(Math.random()*state.bgList.length)];
      setBodyBackground(r);
    } else if (state.bgCurrent) {
      setBodyBackground(state.bgCurrent);
    }

    // initial renders
    renderBars();
    renderNotes();
    quoteEl.textContent = chooseRandomQuote();
    if (state.colorOverride) colorInput.value = state.colorOverride;

    updateTime();
    setInterval(updateTime, 1000);

    // compute overlays a bit after background loads
    setTimeout(updateBarOverlaysBasedOnBackground, 400);

    // handle window resize
    window.addEventListener('resize', updateBarOverlaysBasedOnBackground);
  }

  // expose a small API for debugging in console (optional)
  window.__customNewTab = {
    state,
    reload: init
  };

  // Start
  init();

})();