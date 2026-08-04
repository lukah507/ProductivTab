// notes.js — the notes panel: toggled open/closed by the note button,
// and the black note blocks that live inside it.
//
// This replaced an earlier free-floating/draggable/color-choice sticky
// notes design. Notes are no longer positioned by x/y or individually
// colored -- they're a simple vertical list inside a slide-out panel, and
// every note renders the same way (black block, white Inter text). If you
// want per-note color back, that's a bigger redesign than this file alone
// (the panel's whole visual identity is "black notes on a translucent
// black bar" right now).

import { storageLocalGet, storageLocalSet, onStorageChanged } from './storage.js';

const noteButton = document.getElementById('add-note-fab');
const notesPanel = document.getElementById('notes-panel');
const notesAddBtn = document.getElementById('notes-add-btn');
const notesList = document.getElementById('notes-list');

let notes = []; // [{id, text}]
let panelOpen = false;

function uid() { return Math.random().toString(36).slice(2, 9); }

async function saveNotes() {
  await storageLocalSet({ notes });
}

function setPanelOpen(open) {
  panelOpen = open;
  if (notesPanel) {
    notesPanel.classList.toggle('open', open);
    notesPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  if (noteButton) noteButton.classList.toggle('active', open);
  if (notesAddBtn) notesAddBtn.classList.toggle('open', open);
}

function createNoteElement(n) {
  const note = document.createElement('div');
  note.className = 'note';
  note.dataset.id = n.id;

  const ta = document.createElement('textarea');
  ta.value = n.text || '';
  ta.placeholder = 'Note...';
  ta.addEventListener('input', () => {
    const found = notes.find(x => x.id === n.id);
    if (found) { found.text = ta.value; saveNotes(); }
  });

  const row = document.createElement('div');
  row.className = 'note-actions';

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'note-delete';
  del.textContent = 'Delete';
  del.addEventListener('click', async () => {
    notes = notes.filter(x => x.id !== n.id);
    await saveNotes();
    renderNotes();
  });

  row.appendChild(del);
  note.appendChild(ta);
  note.appendChild(row);

  return note;
}

function renderNotes() {
  if (!notesList) return;
  // Don't yank the list out from under someone actively typing in a note
  // (relevant for the cross-tab sync case below).
  if (notesList.contains(document.activeElement)) return;
  notesList.innerHTML = '';
  notes.forEach(n => notesList.appendChild(createNoteElement(n)));
}

if (noteButton) {
  noteButton.addEventListener('click', () => setPanelOpen(!panelOpen));
}

if (notesAddBtn) {
  notesAddBtn.addEventListener('click', async () => {
    const newNote = { id: uid(), text: '' };
    notes.push(newNote);
    await saveNotes();
    renderNotes();
  });
}

// Cross-tab sync.
onStorageChanged('local', (changes) => {
  if (changes.notes) {
    notes = changes.notes.newValue || [];
    renderNotes();
  }
});

export async function init() {
  const res = await storageLocalGet(['notes']);
  notes = (res.notes || []).map(n => ({ id: n.id, text: n.text || '' })); // drop any legacy color/x/y fields
  renderNotes();
}