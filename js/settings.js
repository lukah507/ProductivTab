// settings.js — owns the settings panel open/close state, background image
// upload + default background fallback, and the accent-color picker. This
// is now the ONLY module that touches #settings-button and #color-apply
// (previously both main.js and ui-enhancements.js bound click handlers to
// these, which meant every click ran two independent, slightly different
// code paths).

import { storageLocalGet, storageLocalSet, storageSyncGet, storageSyncSet, onStorageChanged } from './storage.js';

const settingsBtn = document.getElementById('settings-button');
const centerControls = document.getElementById('center-controls');
const bgUpload = document.getElementById('bg-upload');
const colorInput = document.getElementById('color-input');
const colorApplyBtn = document.getElementById('color-apply');

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

/* ---------- Background image ---------- */
function applyBackground(dataUrlOrPath) {
  document.body.style.backgroundImage = dataUrlOrPath ? `url(${dataUrlOrPath})` : '';
}

async function applyDefaultBackgroundIfNeeded(bgCurrent) {
  if (!bgCurrent) {
    const defaultBg = '/default.png';
    applyBackground(defaultBg);
    await storageLocalSet({ bgCurrent: defaultBg });
    return;
  }
  applyBackground(bgCurrent);
}

if (bgUpload) {
  bgUpload.addEventListener('change', async (ev) => {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;
    // Only the last selected file is kept as the current background --
    // matches previous behavior. (Storing multiple uploaded backgrounds as
    // base64 blobs would need IndexedDB/unlimitedStorage headroom; see the
    // note in manifest.json.)
    const file = files[files.length - 1];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      applyBackground(dataUrl);
      await storageLocalSet({ bgCurrent: dataUrl });
    };
    reader.onerror = () => console.error('[settings] Failed to read uploaded background image.');
    reader.readAsDataURL(file);
  });
}

/* ---------- Accent color ---------- */
function applyAccentColor(color) {
  document.documentElement.style.setProperty('--accent-color', color || '#336699');
}

if (colorApplyBtn) {
  colorApplyBtn.addEventListener('click', async () => {
    let val = (colorInput && colorInput.value) ? colorInput.value.trim() : '';
    if (!val) val = prompt('Enter HEX color (e.g. #336699)', '#336699') || '';
    if (val && val.match(/^#?[0-9a-fA-F]{6}$/)) {
      const color = (val[0] === '#') ? val : ('#' + val);
      applyAccentColor(color);
      await storageSyncSet({ colorOverride: color });
    } else {
      alert('Please pick a valid 6-digit HEX color.');
    }
  });
}

// Cross-tab sync for background + accent color.
onStorageChanged('local', (changes) => {
  if (changes.bgCurrent) applyBackground(changes.bgCurrent.newValue);
});
onStorageChanged('sync', (changes) => {
  if (changes.colorOverride) {
    applyAccentColor(changes.colorOverride.newValue);
    if (colorInput) colorInput.value = changes.colorOverride.newValue || '#336699';
  }
});

export async function init() {
  const local = await storageLocalGet(['bgCurrent']);
  await applyDefaultBackgroundIfNeeded(local.bgCurrent);

  // Read colorOverride back out of sync storage (links.js also reads it
  // independently for its own render -- this call just drives the CSS var
  // + the <input type=color> UI, so there's no ordering dependency between
  // modules).
  const syncRes = await storageSyncGet(['colorOverride']);
  if (syncRes.colorOverride) {
    applyAccentColor(syncRes.colorOverride);
    if (colorInput) colorInput.value = syncRes.colorOverride;
  }
}