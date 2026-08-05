// settings.js — owns the settings panel: opening/closing it, the Themes
// grid (backed by js/backgrounds.js), and applying whichever background
// is currently selected. Clock toggles live in the same panel but are
// wired up by js/clock.js -- this file only builds the markup they
// attach to.

import { storageLocalGet, storageLocalSet, onStorageChanged } from './storage.js';
import { listBackgrounds, resolveBackgroundUrl, addCustomBackground, removeCustomBackground, hidePreset } from './backgrounds.js';

const settingsBtn = document.getElementById('settings-button');
const settingsPanel = document.getElementById('settings-panel');
const timeEl = document.getElementById('time');
const themeGrid = document.getElementById('theme-grid');
const fileInput = document.getElementById('bg-file-input');

let panelOpen = false;
let activeBg = null; // {kind, name} of the currently-applied background, or null

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

// Click-anywhere-outside-the-panel to close. mousedown (not click) so it
// fires before whatever was clicked reacts, and it no-ops while the
// panel is already closed -- which is what keeps this from fighting with
// the settingsBtn click handler above on the very click that opens the
// panel (that mousedown lands while panelOpen is still false, so this
// returns immediately and the click handler is the one that opens it).
// Clicks on settingsBtn itself are also skipped here -- that button
// handles its own open/close toggle, so this listener staying out of the
// way is what stops the two from fighting once the panel's already open.
document.addEventListener('mousedown', (ev) => {
  if (!panelOpen) return;
  if (settingsBtn && settingsBtn.contains(ev.target)) return;
  if (settingsPanel && !settingsPanel.contains(ev.target)) {
    setPanelOpen(false);
  }
});

/* ---------- Applying a background ---------- */
async function applyBackground(bg) {
  activeBg = bg || null;
  const url = activeBg ? await resolveBackgroundUrl(activeBg) : null;
  document.body.style.backgroundImage = url ? `url(${url})` : 'none';
}

async function selectBackground(bg) {
  await applyBackground(bg);
  await storageLocalSet({ bgCurrent: bg });
  renderThemeGrid();
}

/* ---------- Themes grid ---------- */

function clearGrid() {
  if (themeGrid) themeGrid.innerHTML = '';
}

function makeEmptyTile() {
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'theme-tile theme-tile--empty';
  tile.title = 'Add a background';
  tile.textContent = '+';
  tile.addEventListener('click', () => fileInput.click());
  return tile;
}

function isActive(img) {
  return !!activeBg && activeBg.kind === img.kind && activeBg.name === img.name;
}

function makeImageTile(img) {
  const tile = document.createElement('div');
  tile.className = 'theme-tile' + (isActive(img) ? ' active' : '');
  tile.style.backgroundImage = `url(${img.url})`;
  tile.title = img.name;
  tile.setAttribute('role', 'button');
  tile.tabIndex = 0;
  const select = () => selectBackground({ kind: img.kind, name: img.name });
  tile.addEventListener('click', select);
  tile.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(); }
  });

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'theme-tile-delete';
  del.title = img.kind === 'preset' ? `Hide ${img.name}` : `Delete ${img.name}`;
  del.textContent = '\u00d7';
  del.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    const verb = img.kind === 'preset' ? 'Remove' : 'Delete';
    if (!confirm(`${verb} "${img.name}" from your backgrounds?`)) return;
    if (img.kind === 'preset') await hidePreset(img.name);
    else await removeCustomBackground(img.name);
    if (isActive(img)) {
      await applyBackground(null);
      await storageLocalSet({ bgCurrent: null });
    }
    renderThemeGrid();
  });
  tile.appendChild(del);

  return tile;
}

async function renderThemeGrid() {
  if (!themeGrid) return;
  const images = await listBackgrounds();
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
      const name = await addCustomBackground(file);
      await selectBackground({ kind: 'custom', name });
    } catch (e) {
      alert(e.message);
    }
  });
}

/* ---------- Settings panel toggle wiring is above; below is init/sync ---------- */

// Cross-tab sync for background.
onStorageChanged('local', (changes) => {
  if (changes.bgCurrent) {
    applyBackground(changes.bgCurrent.newValue);
    if (panelOpen) renderThemeGrid();
  }
});

export async function init() {
  const local = await storageLocalGet(['bgCurrent']);
  if (local.bgCurrent) {
    await applyBackground(local.bgCurrent);
    return;
  }
  // No background chosen yet (first-ever run, or the previously-selected
  // one was deleted) -- default to whichever background turns up first,
  // rather than leaving the page blank until someone opens Settings.
  const images = await listBackgrounds();
  if (images.length) {
    const first = { kind: images[0].kind, name: images[0].name };
    await applyBackground(first);
    await storageLocalSet({ bgCurrent: first });
  }
}