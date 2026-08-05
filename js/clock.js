// clock.js — owns the date/time display and its two settings-panel
// toggles: 12/24-hour, and show/hide seconds. Text color/weight for
// #date and #time are fixed via CSS (no more user-configurable picker --
// see the note in main.js).
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
const secondsToggle = document.getElementById('seconds-toggle');

let clock24 = false;
let showSeconds = true;

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
    // Built as spans (not plain textContent) so .time-seconds can be
    // styled smaller/dimmer via CSS. Both values are digits/locale
    // formatting from Intl -- no user-controlled text -- so innerHTML here
    // carries no injection risk. When seconds are hidden, #time simply
    // gets one span instead of two -- since #center-stack is centered via
    // left:50% + translateX(-50%) (see style.css), the now-narrower time
    // re-centers itself automatically, no extra layout code needed.
    timeEl.innerHTML = showSeconds
      ? `<span class="time-main">${main}</span><span class="time-seconds">:${seconds}</span>`
      : `<span class="time-main">${main}</span>`;
  }
}
setInterval(tick, 1000);

// Reflects clock24/showSeconds onto their toggle switches -- .is-on
// slides each thumb to its right-hand side and swaps which label reads
// as active (see .settings-toggle-* rules in settings.css), and
// aria-pressed keeps them accessible as real toggles, not plain buttons.
function updateToggleUI() {
  if (clockToggle) {
    clockToggle.classList.toggle('is-on', clock24);
    clockToggle.setAttribute('aria-pressed', clock24 ? 'true' : 'false');
  }
  if (secondsToggle) {
    secondsToggle.classList.toggle('is-on', showSeconds);
    secondsToggle.setAttribute('aria-pressed', showSeconds ? 'true' : 'false');
  }
}

if (clockToggle) {
  clockToggle.addEventListener('click', async () => {
    clock24 = !clock24;
    updateToggleUI();
    await storageSyncSet({ clock24 });
    tick();
  });
}

if (secondsToggle) {
  secondsToggle.addEventListener('click', async () => {
    showSeconds = !showSeconds;
    updateToggleUI();
    await storageSyncSet({ showSeconds });
    tick();
  });
}

onStorageChanged('sync', (changes) => {
  let dirty = false;
  if (changes.clock24) { clock24 = !!changes.clock24.newValue; dirty = true; }
  if (changes.showSeconds) { showSeconds = changes.showSeconds.newValue !== false; dirty = true; }
  if (dirty) { updateToggleUI(); tick(); }
});

export async function init() {
  const res = await storageSyncGet(['clock24', 'showSeconds']);
  if (typeof res.clock24 !== 'undefined') clock24 = res.clock24;
  if (typeof res.showSeconds !== 'undefined') showSeconds = res.showSeconds !== false;
  updateToggleUI();
  tick();
}