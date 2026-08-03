// textStyle.js — the ONE font/color/bold/italic picker for #date and
// #time. This replaces two previously-competing systems: main.js had
// a modal with separate color+bold checkboxes persisted under a single
// `textStyles` object, while ui-enhancements.js had a click-the-text
// picker with font-family+bold+italic persisted under per-element
// `style_<id>` keys. Both wrote to the same elements' inline styles
// without knowing about each other, so state could visibly diverge
// depending which UI the user touched last. There is now exactly one
// schema (`style_date` / `style_time`, each { fontFamily, color, bold,
// italic }) and one entry point (click the text itself).
// (The picker previously also covered #quote; that element was removed
// along with the quote-of-the-moment feature, so TARGET_IDS below only
// lists 'date' and 'time' now.)

import { storageSyncGet, storageSyncSet, onStorageChanged } from './storage.js';

const TARGET_IDS = ['date', 'time'];

// Keep this in sync with the @font-face declarations in fonts.css --
// 'Molle', 'Cossette', and 'MomoTrust' were listed here previously but
// their .ttf files were never actually included in the package, so
// selecting them silently fell back to the browser default font.
const AVAILABLE_FONTS = [
  { name: 'Inter (Default)', family: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' },
  { name: 'Krona One', family: "'Krona One', sans-serif" }
];

const fontPickerModal = document.getElementById('font-picker-modal');
const fontList = document.getElementById('font-list');
const fontPickerCancel = document.getElementById('font-picker-cancel');

let currentTargetId = null;

function styleKey(id) { return `style_${id}`; }

function applyStyleToElement(id, style) {
  const el = document.getElementById(id);
  if (!el || !style) return;
  el.style.fontFamily = style.fontFamily || '';
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
    const style = Object.assign({ fontFamily: '', color: '', bold: false, italic: false }, res[styleKey(id)] || {});

    fontList.innerHTML = '';

    // Font family options
    AVAILABLE_FONTS.forEach(font => {
      const option = document.createElement('div');
      option.className = 'font-option';
      if (style.fontFamily === font.family || (!style.fontFamily && font.family.startsWith('Inter'))) {
        option.classList.add('selected');
      }

      const name = document.createElement('div');
      name.className = 'font-option-name';
      name.textContent = font.name;

      const preview = document.createElement('div');
      preview.className = 'font-option-preview';
      preview.textContent = 'The quick brown fox jumps over the lazy dog';
      preview.style.fontFamily = font.family;

      option.appendChild(name);
      option.appendChild(preview);

      option.addEventListener('click', () => {
        fontList.querySelectorAll('.font-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        style.fontFamily = font.family;
        applyStyleToElement(id, style);
        saveStyle(id, style);
      });

      fontList.appendChild(option);
    });

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