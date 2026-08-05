// settings.js — owns the settings panel: opening/closing it, the Themes
// grid (backed by js/backgrounds.js, the real bg/ folder), and applying
// whichever background is currently selected. Clock toggles live in the
// same panel but are wired up by js/clock.js -- this file only builds
// the markup they attach to.

import { storageLocalGet, storageLocalSet, onStorageChanged } from './storage.js';
import { isSupported as fsSupported, getFolderHandle, connectFolder, listImages, uploadImage, deleteImage } from './backgrounds.js';

const settingsBtn = document.getElementById('settings-button');
const settingsPanel = document.getElementById('settings-panel');
const timeEl = document.getElementById('time');
const themeGrid = document.getElementById('theme-grid');
const fileInput = document.getElementById('bg-file-input');

let panelOpen = false;
let activeName = null; // currently-applied filename, e.g. "sunset.jpg"

/* ---------- Panel open/close ---------- */

// The panel starts at the top and should never reach further down than
// the bottom edge of the clock -- measured live (not a fixed px guess)
// so it still lines up if the clock's size ever changes.
function sizePanelToTime() {
  if (!settingsPanel || !timeEl) return;
  const bottom = timeEl.getBoundingClientRect().bottom;
  settingsPanel.style.height = `${Math.max(bottom, 120)}px`;
}

function setPanelOpen(open) {
  panelOpen = open;
  if (open) sizePanelToTime();
  if (settingsPanel) {
    settingsPanel.classList.toggle('open', open);
    settingsPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  document.body.classList.toggle('settings-open', open);
  if (settingsBtn) settingsBtn.classList.toggle('active', open);
  if (open) renderThemeGrid();
}

if (settingsBtn) {
  settingsBtn.addEventListener('click', () => setPanelOpen(!panelOpen));
}
window.addEventListener('resize', () => { if (panelOpen) sizePanelToTime(); });

/* ---------- Applying a background ----------
   Once a filename is known, applying it is just a plain relative URL --
   the same way any other bundled extension resource is referenced. No
   folder permission is needed just to *display* an already-chosen
   background; permission is only needed to list/upload/delete in the
   Themes grid below. */
function applyBackground(name) {
  activeName = name || null;
  document.body.style.backgroundImage = activeName ? `url(bg/${activeName})` : 'none';
}

async function selectBackground(name) {
  applyBackground(name);
  await storageLocalSet({ bgCurrent: name });
  renderThemeGrid();
}

/* ---------- Themes grid ---------- */

function clearGrid() {
  if (themeGrid) themeGrid.innerHTML = '';
}

function renderConnectPrompt(message) {
  clearGrid();
  if (!themeGrid) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'theme-connect-btn';
  btn.textContent = message;
  btn.addEventListener('click', async () => {
    try {
      await connectFolder();
      await renderThemeGrid();
    } catch (e) {
      console.warn('[ProductivTab] Could not connect the backgrounds folder:', e.message);
    }
  });
  themeGrid.appendChild(btn);
}

function makeEmptyTile() {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'theme-tile theme-tile--empty';
  tile.title = 'Add a background';
  tile.textContent = '+';
  tile.addEventListener('click', async () => {
    // Connecting the folder (if not already) has to happen from this
    // same click so it counts as a user gesture.
    const handle = await getFolderHandle();
    if (!handle) {
      try { await connectFolder(); } catch (e) {
        console.warn('[ProductivTab] Could not connect the backgrounds folder:', e.message);
        return;
      }
    }
    fileInput.click();
  });
  return tile;
}

function makeImageTile(img) {
  const tile = document.createElement('div');
  tile.className = 'theme-tile' + (img.name === activeName ? ' active' : '');
  tile.style.backgroundImage = `url(${img.url})`;
  tile.title = img.name;
  tile.setAttribute('role', 'button');
  tile.tabIndex = 0;
  tile.addEventListener('click', () => selectBackground(img.name));
  tile.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectBackground(img.name); }
  });

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'theme-tile-delete';
  del.title = `Delete ${img.name}`;
  del.textContent = '\u00d7';
  del.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    if (!confirm(`Delete "${img.name}"?`)) return;
    try {
      await deleteImage(img.name);
      if (img.name === activeName) {
        applyBackground(null);
        await storageLocalSet({ bgCurrent: null });
      }
      await renderThemeGrid();
    } catch (e) {
      console.warn('[ProductivTab] Could not delete background:', e.message);
    }
  });
  tile.appendChild(del);

  return tile;
}

async function renderThemeGrid() {
  if (!themeGrid) return;
  if (!fsSupported()) {
    clearGrid();
    const note = document.createElement('div');
    note.className = 'theme-unsupported';
    note.textContent = 'Custom backgrounds need a browser with folder-access support.';
    themeGrid.appendChild(note);
    return;
  }
  const handle = await getFolderHandle();
  if (!handle) {
    renderConnectPrompt('Connect backgrounds folder');
    return;
  }
  const images = await listImages();
  clearGrid();
  images.forEach(img => themeGrid.appendChild(makeImageTile(img)));
  themeGrid.appendChild(makeEmptyTile());
}

if (fileInput) {
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = ''; // allow re-selecting the same file later
    if (!file) return;
    try {
      const name = await uploadImage(file);
      await selectBackground(name);
    } catch (e) {
      alert(e.message);
    }
  });
}

// Cross-tab sync for background.
onStorageChanged('local', (changes) => {
  if (changes.bgCurrent) {
    applyBackground(changes.bgCurrent.newValue);
    if (panelOpen) renderThemeGrid();
  }
});

export async function init() {
  const local = await storageLocalGet(['bgCurrent']);
  applyBackground(local.bgCurrent || null);
}