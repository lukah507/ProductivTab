// backgrounds.js — owns two sources of background images, both loaded
// with zero user prompts (no folder picker, no permission dialog):
//
//   1. PRESETS: whatever image files are already sitting in bg/. Since
//      that folder ships as part of the extension itself, reading it
//      needs no special permission -- we just have to find out what's
//      there. Browsers don't expose a directory listing for extension
//      resources, so this is auto-detected by trying likely filenames
//      (bg/manifest.json first if present, otherwise a quiet probe of
//      letter-named files) and keeping whichever ones actually exist.
//
//   2. CUSTOM uploads: added through the "+" tile in the Themes grid.
//      A real extension can't write a new file into its own bg/ folder
//      at runtime without a permission prompt each time -- browsers
//      don't allow silent filesystem writes, full stop. So these are
//      stored as data URLs in chrome.storage.local instead: from the
//      UI it behaves exactly like an upload (appears immediately, no
//      prompt, persists, can be deleted for real), it just isn't a
//      literal new file in bg/ on disk.
//
// "Deleting" a preset can't remove the real file for the same reason,
// so it's a soft-delete: hidden from the grid via hiddenPresets, kept in
// storage so it's remembered. Deleting a custom upload is a real delete
// (it's just stored data).

import { storageLocalGet, storageLocalSet } from './storage.js';

const IMAGE_EXT_RE = /\.(png|jpe?g)$/i;
const PROBE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const PROBE_EXTS = ['jpg', 'jpeg', 'png'];

let presetCache = null; // resolved once per page load

function imageExists(path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = path;
  });
}

// Preferred: bg/manifest.json, a plain JSON array of filenames, e.g.
// ["A.jpeg","B.jpeg","sunset.png"]. If you'd rather not hand-maintain
// that, skip it -- probePresetLetters() below covers single-letter names
// like the current A.jpeg..E.jpeg automatically.
async function readManifest() {
  try {
    const res = await fetch('bg/manifest.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data)) return data.filter(n => IMAGE_EXT_RE.test(n));
  } catch (e) { /* no manifest -- fall through to probing */ }
  return null;
}

// Quietly checks bg/A.jpg, bg/A.jpeg, bg/A.png, bg/B.jpg, ... and keeps
// whichever ones actually load. All same-origin bundled resources, so
// this triggers no permission prompt and no network request -- it's
// effectively instant.
async function probePresetLetters() {
  const found = [];
  await Promise.all(PROBE_LETTERS.map(async (letter) => {
    for (const ext of PROBE_EXTS) {
      const name = `${letter}.${ext}`;
      if (await imageExists(`bg/${name}`)) { found.push(name); break; }
    }
  }));
  found.sort();
  return found;
}

async function loadPresetNames() {
  if (presetCache) return presetCache;
  const manifest = await readManifest();
  presetCache = (manifest && manifest.length) ? manifest : await probePresetLetters();
  return presetCache;
}

async function getHiddenPresets() {
  const res = await storageLocalGet(['hiddenPresets']);
  return res.hiddenPresets || [];
}

async function getCustomList() {
  const res = await storageLocalGet(['customBackgrounds']);
  return res.customBackgrounds || [];
}

// { name, url, kind: 'preset'|'custom' }[] -- ready to render as tiles.
// `url` is a plain relative path for presets (bg/<name>) and a stored
// data URL for custom uploads.
export async function listBackgrounds() {
  const [presetNames, hidden, customList] = await Promise.all([
    loadPresetNames(), getHiddenPresets(), getCustomList()
  ]);
  const presets = presetNames
    .filter(n => !hidden.includes(n))
    .map(n => ({ name: n, url: `bg/${n}`, kind: 'preset' }));
  const customs = customList.map(c => ({ name: c.name, url: c.dataUrl, kind: 'custom' }));
  return [...presets, ...customs];
}

// Resolves a {kind, name} descriptor (as stored in bgCurrent) to a CSS
// url()-ready path/data-URL, or null if it no longer exists.
export async function resolveBackgroundUrl(bg) {
  if (!bg || !bg.name) return null;
  if (bg.kind === 'custom') {
    const list = await getCustomList();
    const match = list.find(c => c.name === bg.name);
    return match ? match.dataUrl : null;
  }
  const presetNames = await loadPresetNames();
  const hidden = await getHiddenPresets();
  return (presetNames.includes(bg.name) && !hidden.includes(bg.name)) ? `bg/${bg.name}` : null;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Adds an uploaded file as a custom background and returns its stored
// name (de-duplicated against existing custom names).
export async function addCustomBackground(file) {
  if (!IMAGE_EXT_RE.test(file.name)) {
    throw new Error('Only PNG, JPG, or JPEG files are supported.');
  }
  const list = await getCustomList();
  let name = file.name;
  let i = 1;
  while (list.some(c => c.name === name)) {
    const dot = file.name.lastIndexOf('.');
    name = `${file.name.slice(0, dot)}-${i}${file.name.slice(dot)}`;
    i++;
  }
  const dataUrl = await fileToDataUrl(file);
  list.push({ name, dataUrl });
  await storageLocalSet({ customBackgrounds: list });
  return name;
}

export async function removeCustomBackground(name) {
  const list = await getCustomList();
  await storageLocalSet({ customBackgrounds: list.filter(c => c.name !== name) });
}

// Soft-delete: a real file in bg/ can't be removed from disk without a
// permission prompt each time, so this just hides it from the grid.
export async function hidePreset(name) {
  const hidden = await getHiddenPresets();
  if (!hidden.includes(name)) hidden.push(name);
  await storageLocalSet({ hiddenPresets: hidden });
}