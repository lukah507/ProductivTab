// clock.js — owns the date/time display and the 12/24-hour toggle.
// Text color/weight for #date and #time are fixed via CSS now (no more
// user-configurable picker -- see the note in main.js).
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
  // "Monday, August 3" -- weekday, month day (day not zero-padded).
  const weekday = d.toLocaleString(undefined, { weekday: 'long' });
  const month = d.toLocaleString(undefined, { month: 'long' });
  const day = d.getDate();
  return `${weekday}, ${month} ${day}`;
}

// Returns the hour:minute portion and the seconds portion separately, so
// they can be rendered at different sizes (seconds smaller/dimmer) while
// still sharing one line.
function getTimeParts(d) {
  const parts = new Intl.DateTimeFormat([], { hour12: !clock24, hour: '2-digit', minute: '2-digit' }).formatToParts(d);
  const hour = parts.find(p => p.type === 'hour').value;
  const minute = parts.find(p => p.type === 'minute').value;
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return { main: `${hour}:${minute}`, seconds };
}

function tick() {
  const now = new Date();
  if (dateEl) dateEl.textContent = formatDate(now);
  if (timeEl) {
    const { main, seconds } = getTimeParts(now);
    // Built as two spans (not plain textContent) so .time-seconds can be
    // styled smaller/dimmer via CSS. Both values are digits/locale
    // formatting from Intl -- no user-controlled text -- so innerHTML here
    // carries no injection risk.
    timeEl.innerHTML = `<span class="time-main">${main}</span><span class="time-seconds">:${seconds}</span>`;
  }
}
setInterval(tick, 1000);

// Reflects clock24 onto the toggle switch itself -- .is-24 slides the
// thumb over to the "24h" side and swaps which label reads as active
// (see .clock-toggle-* rules in settings.css), and aria-pressed keeps it
// accessible as an actual toggle rather than a plain button.
function updateToggleUI() {
  if (!clockToggle) return;
  clockToggle.classList.toggle('is-24', clock24);
  clockToggle.setAttribute('aria-pressed', clock24 ? 'true' : 'false');
}

if (clockToggle) {
  clockToggle.addEventListener('click', async () => {
    clock24 = !clock24;
    updateToggleUI();
    await storageSyncSet({ clock24 });
    tick();
  });
}

onStorageChanged('sync', (changes) => {
  if (changes.clock24) { clock24 = !!changes.clock24.newValue; updateToggleUI(); tick(); }
});

export async function init() {
  const res = await storageSyncGet(['clock24']);
  if (typeof res.clock24 !== 'undefined') clock24 = res.clock24;
  updateToggleUI();
  tick();
}