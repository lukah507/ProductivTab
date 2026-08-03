// clock.js — owns the date/time display and the 12/24-hour toggle. Text
// *styling* (color/bold/italic) for these elements lives in textStyle.js
// -- "what text shows" and "how it's styled" are different concerns.
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