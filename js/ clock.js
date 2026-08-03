// clock.js — owns the date/time display and the 12/24-hour toggle. Text
// *styling* (font family/color/bold/italic) for these elements lives in
// textStyle.js -- "what text shows" and "how it's styled" are different
// concerns.
//
// The quote-of-the-moment feature (and its "Edit Quotes" modal) was
// removed along with the #quote element itself -- there's nothing left to
// edit once nothing displays it. If you want quotes back somewhere else,
// the old logic is easy to recreate: store an array under a `quotes` sync
// key and render quotes[0] (or a random pick) into whatever element you
// want it in.

import { storageSyncGet, storageSyncSet, onStorageChanged } from './storage.js';

const dateEl = document.getElementById('date');
const timeEl = document.getElementById('time');
const clockToggle = document.getElementById('clock-toggle');

let clock24 = false;

function formatDate(d) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString(undefined, { month: 'long' });
  const weekday = d.toLocaleString(undefined, { weekday: 'long' });
  return `${day} ${month}, ${weekday}`;
}
function formatTime(d) {
  if (clock24) return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return d.toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function tick() {
  const now = new Date();
  if (dateEl) dateEl.textContent = formatDate(now);
  if (timeEl) timeEl.textContent = formatTime(now);
}
setInterval(tick, 1000);

if (clockToggle) {
  clockToggle.addEventListener('click', async () => {
    clock24 = !clock24;
    await storageSyncSet({ clock24 });
    tick();
  });
}

onStorageChanged('sync', (changes) => {
  if (changes.clock24) { clock24 = !!changes.clock24.newValue; tick(); }
});

export async function init() {
  const res = await storageSyncGet(['clock24']);
  if (typeof res.clock24 !== 'undefined') clock24 = res.clock24;
  tick();
}