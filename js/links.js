// links.js — owns the top/bottom bookmark bars: rendering, favicon
// resolution, add/remove CRUD, and the "accent color" applied to link
// text/icons. This is the only module that touches #top-bar / #bottom-bar.

import { storageSyncGet, storageSyncSet, onStorageChanged } from './storage.js';

const topBar = document.getElementById('top-bar');
const bottomBar = document.getElementById('bottom-bar');
const topAddBtn = document.getElementById('top-add-btn');
const bottomAddBtn = document.getElementById('bottom-add-btn');

const DEFAULT_TOP_LINKS = [
  { title: 'Google', url: 'https://www.google.com' },
  { title: 'Gmail', url: 'https://mail.google.com' }
];
const DEFAULT_BOTTOM_LINKS = [
  { title: 'YouTube', url: 'https://www.youtube.com' },
  { title: 'Drive', url: 'https://drive.google.com' }
];

let topLinks = DEFAULT_TOP_LINKS.slice();
let bottomLinks = DEFAULT_BOTTOM_LINKS.slice();
let colorOverride = '';

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

function renderLinkItem(link) {
  const a = document.createElement('a');
  a.className = 'link-item';
  a.href = link.url;
  a.style.color = colorOverride || '';

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
  label.style.fontSize = '12px';

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

function applyColor() {
  document.querySelectorAll('.link-item').forEach(a => {
    a.style.color = colorOverride || '';
  });
}

function renderBars() {
  if (topBar) topBar.innerHTML = '';
  if (bottomBar) bottomBar.innerHTML = '';
  topLinks.forEach(l => topBar && topBar.appendChild(renderLinkItem(l)));
  bottomLinks.forEach(l => bottomBar && bottomBar.appendChild(renderLinkItem(l)));
  applyColor();
}

async function saveLinks() {
  await storageSyncSet({ topLinks, bottomLinks });
}

function addLink(list, link) {
  if (list === 'top') topLinks.push(link); else bottomLinks.push(link);
  saveLinks();
  renderBars();
}

async function removeLink(link) {
  topLinks = topLinks.filter(l => l.url !== link.url || l.title !== link.title);
  bottomLinks = bottomLinks.filter(l => l.url !== link.url || l.title !== link.title);
  await saveLinks();
  renderBars();
}

function addLinkPrompt(list) {
  let url = prompt('Enter URL (https://...)');
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  if (!isSafeUrl(url)) {
    alert('Please enter a valid http:// or https:// URL.');
    return;
  }
  const title = prompt('Title (optional)', url.replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
  addLink(list, { title: title || url, url });
}

if (topAddBtn) topAddBtn.addEventListener('click', () => addLinkPrompt('top'));
if (bottomAddBtn) bottomAddBtn.addEventListener('click', () => addLinkPrompt('bottom'));

// Cross-tab sync: another open new tab added/removed a link, or changed the
// accent color -> re-render here too, without needing a page reload.
onStorageChanged('sync', (changes) => {
  let shouldRender = false;
  if (changes.topLinks) { topLinks = changes.topLinks.newValue || []; shouldRender = true; }
  if (changes.bottomLinks) { bottomLinks = changes.bottomLinks.newValue || []; shouldRender = true; }
  if (changes.colorOverride) { colorOverride = changes.colorOverride.newValue || ''; shouldRender = true; }
  if (shouldRender) renderBars();
});

export async function init() {
  const res = await storageSyncGet(['topLinks', 'bottomLinks', 'colorOverride']);
  if (res.topLinks) topLinks = res.topLinks;
  if (res.bottomLinks) bottomLinks = res.bottomLinks;
  if (res.colorOverride) colorOverride = res.colorOverride;
  renderBars();
}

export function getColorOverride() { return colorOverride; }