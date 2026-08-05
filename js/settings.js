// settings.js — owns the settings panel open/close state and the
// background presets. This is now the ONLY module that touches
// #settings-button and #bg-presets.
//
// The old file-upload background picker and the accent-color picker
// ("Apply Color") were both removed. Backgrounds are now a fixed set of
// 5 presets (see BG_PRESETS) -- just click one, nothing to apply.

import { storageLocalGet, storageLocalSet, onStorageChanged } from './storage.js';

const settingsBtn = document.getElementById('settings-button');
const centerControls = document.getElementById('center-controls');
const bgPresetButtons = document.querySelectorAll('.bg-preset');

/* ---------- Settings panel toggle ---------- */
function setSettingsOpen(open) {
  document.body.classList.toggle('settings-open', open);
  if (centerControls) {
    centerControls.classList.toggle('hidden', !open);
    centerControls.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  if (settingsBtn) settingsBtn.classList.toggle('active', open);
}

if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    const isOpen = document.body.classList.contains('settings-open');
    setSettingsOpen(!isOpen);
  });
}

/* ---------- Background presets ----------
   5 choices (bg/A.jpg - bg/E.jpg), matched to the swatch styling in
   settings.css by data-bg-id. bgCurrent is stored as just the id ('A'
   through 'E'); anything else found in storage (e.g. an old uploaded
   image data-URL from before this feature existed) is treated as a raw
   background-image value for backward compatibility. */
const BG_PRESET_IDS = ['A', 'B', 'C', 'D', 'E'];
const BG_PRESETS = Object.fromEntries(BG_PRESET_IDS.map(id => [id, `url(bg/${id}.jpg)`]));

function resolveBackgroundCss(bgCurrent) {
  if (!bgCurrent) return BG_PRESETS.A;
  if (BG_PRESETS[bgCurrent]) return BG_PRESETS[bgCurrent];
  return `url(${bgCurrent})`; // backward-compat with a previously-uploaded image
}

function applyBackground(bgCurrent) {
  document.body.style.backgroundImage = resolveBackgroundCss(bgCurrent);
}

function setActivePresetUI(bgCurrent) {
  bgPresetButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.bgId === bgCurrent);
  });
}

bgPresetButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const id = btn.dataset.bgId;
    applyBackground(id);
    setActivePresetUI(id);
    await storageLocalSet({ bgCurrent: id });
  });
});

// Cross-tab sync for background.
onStorageChanged('local', (changes) => {
  if (changes.bgCurrent) {
    applyBackground(changes.bgCurrent.newValue);
    setActivePresetUI(changes.bgCurrent.newValue);
  }
});

export async function init() {
  const local = await storageLocalGet(['bgCurrent']);
  const current = local.bgCurrent || 'A';
  applyBackground(current);
  setActivePresetUI(current);
  if (!local.bgCurrent) await storageLocalSet({ bgCurrent: current });
}