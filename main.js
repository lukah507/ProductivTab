// main.js — entry point. Each feature owns its own DOM elements and
// storage keys (see js/*.js); this file just boots them in order. Load
// as a module (see index.html) so import/export works natively with no
// bundler.
//
// (textStyle.js was removed: date/time styling -- color, weight -- is
// fixed via CSS now rather than user-configurable, so there was nothing
// left for that module to do.)

import { init as initLinks } from './js/links.js';
import { init as initSettings } from './js/settings.js';
import { init as initClock } from './js/clock.js';
import { init as initNotes } from './js/notes.js';

async function boot() {
  await Promise.all([
    initSettings(),
    initLinks(),
    initClock(),
    initNotes()
  ]);
}

boot();