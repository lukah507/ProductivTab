// notes.js — sticky notes: CRUD, drag-to-reposition, and persistence.
// Positions are clamped to the current viewport on render so a note
// dragged near the edge on a large monitor doesn't end up off-screen when
// the same profile is opened on a smaller display.

import { storageLocalGet, storageLocalSet, onStorageChanged } from './storage.js';

const notesList = document.getElementById('notes-list');
let addNoteFab = document.getElementById('add-note-fab');

let notes = []; // [{id, color, text, x, y}]
let draggingCount = 0; // guards against a cross-tab re-render yanking a note mid-drag

function uid() { return Math.random().toString(36).slice(2, 9); }

async function saveNotes() {
  await storageLocalSet({ notes });
}

function clamp(value, max) {
  return Math.max(0, Math.min(value, Math.max(0, max)));
}

function createNoteElement(n) {
  const note = document.createElement('div');
  note.className = 'note color-' + (n.color || 'yellow');
  const maxX = window.innerWidth - 260; // note width from style.css
  const maxY = window.innerHeight - 40;
  note.style.left = clamp(n.x != null ? n.x : 20, maxX) + 'px';
  note.style.top = clamp(n.y != null ? n.y : 140, maxY) + 'px';
  note.dataset.id = n.id;

  const handle = document.createElement('div');
  handle.className = 'note-handle';
  handle.textContent = '\u2261';

  const ta = document.createElement('textarea');
  ta.value = n.text || '';
  ta.placeholder = 'Note...';
  ta.addEventListener('input', () => {
    const found = notes.find(x => x.id === n.id);
    if (found) { found.text = ta.value; saveNotes(); }
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
    notes = notes.filter(x => x.id !== n.id);
    await saveNotes();
    renderNotes();
  });

  const select = document.createElement('select');
  ['yellow', 'pink', 'blue'].forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.text = c;
    if (c === n.color) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', async () => {
    const f = notes.find(x => x.id === n.id);
    if (f) { f.color = select.value; await saveNotes(); renderNotes(); }
  });

  row.appendChild(select);
  row.appendChild(del);
  note.appendChild(handle);
  note.appendChild(ta);
  note.appendChild(row);

  let dragging = false;
  let startX = 0, startY = 0, origX = 0, origY = 0;
  const onPointerMove = (ev) => {
    if (!dragging) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    const nx = clamp(origX + dx, window.innerWidth - 260);
    const ny = clamp(origY + dy, window.innerHeight - 40);
    note.style.left = nx + 'px';
    note.style.top = ny + 'px';
  };
  const onPointerUp = async (ev) => {
    if (!dragging) return;
    dragging = false;
    draggingCount = Math.max(0, draggingCount - 1);
    handle.releasePointerCapture(ev.pointerId);
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    const f = notes.find(x => x.id === note.dataset.id);
    if (f) { f.x = parseInt(note.style.left, 10); f.y = parseInt(note.style.top, 10); await saveNotes(); }
  };
  handle.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    dragging = true;
    draggingCount++;
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
  notesList.innerHTML = '';
  notes.forEach(n => notesList.appendChild(createNoteElement(n)));
}

if (addNoteFab) {
  addNoteFab.addEventListener('click', async () => {
    const newNote = { id: uid(), color: 'yellow', text: '', x: 24, y: 140 + (notes.length * 20) };
    notes.push(newNote);
    await saveNotes();
    renderNotes();
  });
}

// Cross-tab sync, but skip re-render while a note is actively being
// dragged in *this* tab so the in-flight drag isn't reset out from under
// the user's cursor.
onStorageChanged('local', (changes) => {
  if (changes.notes && draggingCount === 0) {
    notes = changes.notes.newValue || [];
    renderNotes();
  }
});

export async function init() {
  const res = await storageLocalGet(['notes']);
  notes = res.notes || [];
  renderNotes();
}