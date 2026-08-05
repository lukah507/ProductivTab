// links.js — owns the bottom bookmarks bar: rendering, favicon
// resolution, add/remove CRUD, and the bar switcher that lets you flip
// between several saved sets of links without cluttering the bar itself.
// This is the only module that touches #bottom-bar / #bar-switcher.
//
// The old top bar is gone. In its place, links now live in named "sets"
// (barSets) -- only one set's links show in the bar at a time, and
// #bar-switcher (a small dot per set) swaps which one is showing. This
// replaces having two separate bars with one bar that can hold as many
// link groups as you want.
//
// The old per-link "accent color" (colorOverride / Apply Color) was
// removed along with the rest of that settings-panel feature; links just
// use the default text color now.

import { storageSyncGet, storageSyncSet, onStorageChanged } from './storage.js';

const bottomBar = document.getElementById('bottom-bar');
const bottomAddBtn = document.getElementById('bottom-add-btn');
const barDots = document.getElementById('bar-dots');
const barAddSetBtn = document.getElementById('bar-add-set');

const DEFAULT_BAR_SETS = [
  {
    id: 'main',
    name: 'Main',
    links: [
      { title: 'Google', url: 'https://www.google.com' },
      { title: 'Gmail', url: 'https://mail.google.com' }
    ]
  },
  {
    id: 'more',
    name: 'More',
    links: [
      { title: 'YouTube', url: 'https://www.youtube.com' },
      { title: 'Drive', url: 'https://drive.google.com' }
    ]
  }
];

let barSets = DEFAULT_BAR_SETS.slice();
let activeIndex = 0;

function uid() { return Math.random().toString(36).slice(2, 9); }

function faviconForUrl(url) {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      const faviconUrl = new URL(chrome.runtime.getURL('/_favicon/'));
      faviconUrl.searchParams.set('pageUrl', url);
      faviconUrl.searchParams.set('size', '64');
      return faviconUrl.toString();
    }
    // Fallback for local testing outside the extension context.
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=128`;
  } catch (e) {
    return '';
  }
}

// Only allow http/https targets. Keeps someone from saving a javascript:
// URL into a shortcut and having it execute when clicked.
function isSafeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function activeSet() {
  if (!barSets[activeIndex]) activeIndex = 0;
  return barSets[activeIndex];
}

function renderLinkItem(link) {
  const a = document.createElement('a');
  a.className = 'link-item';
  a.href = link.url;

  const icon = document.createElement('span');
  icon.className = 'icon';
  const fav = faviconForUrl(link.url);
  if (fav) {
    const img = document.createElement('img');
    img.src = fav;
    img.alt = '';
    icon.appendChild(img);
    img.onerror = function () {
      this.style.display = 'none';
      icon.textContent = (link.title || link.url || '\u2022').charAt(0).toUpperCase();
    };
  }

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = link.title || link.url;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-shortcut';
  removeBtn.type = 'button';
  removeBtn.title = 'Remove shortcut';
  removeBtn.textContent = '\u00d7';
  removeBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    removeLink(link);
  });

  a.appendChild(icon);
  a.appendChild(label);
  a.appendChild(removeBtn);

  a.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    removeLink(link);
  });

  return a;
}

function renderBar() {
  if (!bottomBar) return;
  bottomBar.innerHTML = '';
  activeSet().links.forEach(l => bottomBar.appendChild(renderLinkItem(l)));
}

function renderSwitcher() {
  if (!barDots) return;
  barDots.innerHTML = '';
  barSets.forEach((set, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'bar-switch-dot' + (i === activeIndex ? ' active' : '');
    dot.title = set.name + ' (double-click to rename, right-click to delete)';
    dot.addEventListener('click', () => {
      if (i === activeIndex) return;
      activeIndex = i;
      saveState();
      renderBar();
      renderSwitcher();
    });
    dot.addEventListener('dblclick', () => renameSet(i));
    dot.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      deleteSet(i);
    });
    barDots.appendChild(dot);
  });
}

async function saveState() {
  await storageSyncSet({ barSets, activeIndex });
}

function addLink(link) {
  activeSet().links.push(link);
  saveState();
  renderBar();
}

async function removeLink(link) {
  const set = activeSet();
  set.links = set.links.filter(l => l.url !== link.url || l.title !== link.title);
  await saveState();
  renderBar();
}

function addLinkPrompt() {
  let url = prompt('Enter URL (https://...)');
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  if (!isSafeUrl(url)) {
    alert('Please enter a valid http:// or https:// URL.');
    return;
  }
  const title = prompt('Title (optional)', url.replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
  addLink({ title: title || url, url });
}

function addSetPrompt() {
  const name = prompt('Name this link set', `Set ${barSets.length + 1}`);
  if (!name) return;
  barSets.push({ id: uid(), name, links: [] });
  activeIndex = barSets.length - 1;
  saveState();
  renderBar();
  renderSwitcher();
}

function renameSet(i) {
  const set = barSets[i];
  if (!set) return;
  const name = prompt('Rename this link set', set.name);
  if (!name) return;
  set.name = name;
  saveState();
  renderSwitcher();
}

function deleteSet(i) {
  if (barSets.length <= 1) {
    alert("Can't delete the last link set.");
    return;
  }
  const set = barSets[i];
  if (!confirm(`Delete the "${set.name}" link set? This removes its links too.`)) return;
  barSets.splice(i, 1);
  if (activeIndex >= barSets.length) activeIndex = barSets.length - 1;
  saveState();
  renderBar();
  renderSwitcher();
}

if (bottomAddBtn) bottomAddBtn.addEventListener('click', addLinkPrompt);
if (barAddSetBtn) barAddSetBtn.addEventListener('click', addSetPrompt);

// Cross-tab sync: another open new tab changed the sets or the active
// index -> re-render here too, without needing a page reload.
onStorageChanged('sync', (changes) => {
  let shouldRenderBar = false;
  let shouldRenderSwitcher = false;
  if (changes.barSets) { barSets = changes.barSets.newValue || DEFAULT_BAR_SETS.slice(); shouldRenderBar = true; shouldRenderSwitcher = true; }
  if (changes.activeIndex) { activeIndex = changes.activeIndex.newValue || 0; shouldRenderBar = true; shouldRenderSwitcher = true; }
  if (shouldRenderBar) renderBar();
  if (shouldRenderSwitcher) renderSwitcher();
});

// One-time migration from the old two-bar (topLinks/bottomLinks) storage
// shape into the new barSets shape, so existing users don't lose their
// saved shortcuts when this update lands.
async function migrateLegacyLinksIfNeeded(res) {
  if (res.barSets && res.barSets.length) return false;
  const legacySets = [];
  if (res.bottomLinks && res.bottomLinks.length) legacySets.push({ id: uid(), name: 'Main', links: res.bottomLinks });
  if (res.topLinks && res.topLinks.length) legacySets.push({ id: uid(), name: 'More', links: res.topLinks });
  if (legacySets.length) {
    barSets = legacySets;
    await saveState();
    return true;
  }
  return false;
}

export async function init() {
  const res = await storageSyncGet(['barSets', 'activeIndex', 'topLinks', 'bottomLinks']);
  if (res.barSets && res.barSets.length) {
    barSets = res.barSets;
    activeIndex = res.activeIndex || 0;
  } else {
    const migrated = await migrateLegacyLinksIfNeeded(res);
    if (!migrated) await saveState();
  }
  renderBar();
  renderSwitcher();
}