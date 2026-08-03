// textStyle.js — the color/bold/italic picker for #date and #time.
//
// This used to also offer a font-family choice (Inter vs Krona One), but
// the whole extension now uses a single embedded font (Inter -- see
// fonts.css), so a picker with exactly one option would just be dead UI.
// If you ever add a second font file back, reintroduce a font-family
// section here the same way the color/bold/italic controls below are
// built, and add it to the `style_<id>` schema.

import { storageSyncGet, storageSyncSet, onStorageChanged } from './storage.js';

const TARGET_IDS = ['date', 'time'];

const fontPickerModal = document.getElementById('font-picker-modal');
const fontList = document.getElementById('font-list');
const fontPickerCancel = document.getElementById('font-picker-cancel');

let currentTargetId = null;

function styleKey(id) { return `style_${id}`; }

function applyStyleToElement(id, style) {
  const el = document.getElementById(id);
  if (!el || !style) return;
  el.style.color = style.color || '';
  el.style.fontWeight = style.bold ? '700' : '';
  el.style.fontStyle = style.italic ? 'italic' : '';
}

async function saveStyle(id, style) {
  await storageSyncSet({ [styleKey(id)]: style });
}

function openPicker(id) {
  currentTargetId = id;
  const targetEl = document.getElementById(id);
  if (!targetEl || !fontList) return;

  storageSyncGet([styleKey(id)]).then(res => {
    const style = Object.assign({ color: '', bold: false, italic: false }, res[styleKey(id)] || {});

    fontList.innerHTML = '';

    // Color + bold/italic row
    const controlsRow = document.createElement('div');
    controlsRow.className = 'font-style-toggles';

    const colorLabel = document.createElement('label');
    colorLabel.style.display = 'flex';
    colorLabel.style.alignItems = 'center';
    colorLabel.style.gap = '6px';
    colorLabel.textContent = 'Color';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = style.color || '#000000';
    colorInput.addEventListener('input', () => {
      style.color = colorInput.value;
      applyStyleToElement(id, style);
      saveStyle(id, style);
    });
    colorLabel.appendChild(colorInput);

    const boldBtn = document.createElement('button');
    boldBtn.type = 'button';
    boldBtn.className = 'font-style-toggle';
    boldBtn.textContent = 'Bold';
    boldBtn.classList.toggle('active', !!style.bold);
    boldBtn.addEventListener('click', () => {
      style.bold = !style.bold;
      boldBtn.classList.toggle('active', style.bold);
      applyStyleToElement(id, style);
      saveStyle(id, style);
    });

    const italicBtn = document.createElement('button');
    italicBtn.type = 'button';
    italicBtn.className = 'font-style-toggle';
    italicBtn.textContent = 'Italic';
    italicBtn.classList.toggle('active', !!style.italic);
    italicBtn.addEventListener('click', () => {
      style.italic = !style.italic;
      italicBtn.classList.toggle('active', style.italic);
      applyStyleToElement(id, style);
      saveStyle(id, style);
    });

    controlsRow.appendChild(colorLabel);
    controlsRow.appendChild(boldBtn);
    controlsRow.appendChild(italicBtn);
    fontList.appendChild(controlsRow);

    if (fontPickerModal) fontPickerModal.setAttribute('aria-hidden', 'false');
  });
}

TARGET_IDS.forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.cursor = 'pointer';
  el.title = 'Click to change text style';
  el.addEventListener('click', () => openPicker(id));
});

if (fontPickerCancel) {
  fontPickerCancel.addEventListener('click', () => {
    if (fontPickerModal) fontPickerModal.setAttribute('aria-hidden', 'true');
  });
}
if (fontPickerModal) {
  fontPickerModal.addEventListener('click', (e) => {
    if (e.target === fontPickerModal) fontPickerModal.setAttribute('aria-hidden', 'true');
  });
}

// Global keyboard shortcut retained from the original main.js: Shift+T
// opens the picker for whichever element was last focused, defaulting to
// the time.
window.addEventListener('keydown', (ev) => {
  if (ev.shiftKey && ev.key.toLowerCase() === 't') {
    openPicker(currentTargetId || 'time');
  }
});

onStorageChanged('sync', (changes) => {
  TARGET_IDS.forEach(id => {
    const key = styleKey(id);
    if (changes[key]) applyStyleToElement(id, changes[key].newValue);
  });
});

export async function init() {
  const keys = TARGET_IDS.map(styleKey);
  const res = await storageSyncGet(keys);
  TARGET_IDS.forEach(id => applyStyleToElement(id, res[styleKey(id)]));
}