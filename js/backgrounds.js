// backgrounds.js — owns the "bg" folder: listing whatever images are
// actually in it, uploading new ones into it, and deleting them.
//
// This uses the File System Access API to talk to a REAL folder on disk
// (the same bg/ folder that sits next to index.html) rather than baking
// uploaded images into chrome.storage. That means:
//   - uploading actually writes a new file into bg/
//   - deleting actually removes the file from bg/
//   - listing reads whatever's really there -- png/jpg/jpeg, any name --
//     instead of a hardcoded id list like "A.jpeg", "B.jpeg", etc.
//   - once a file is in bg/, applying it as the background is just a
//     plain relative url('bg/<name>') -- the same way every other bundled
//     extension resource is referenced, no special permission needed to
//     just *display* an already-chosen background.
//
// The catch: browsers require a user gesture to grant (or re-confirm,
// after the browser restarts) access to a folder. So `getFolderHandle()`
// may resolve to null -- that means "ask the user to click something
// first" -- and `connectFolder()` (which shows the native picker / asks
// for the persisted handle's permission again) must be called directly
// from a click handler, not from init() on page load.

const DB_NAME = 'productivtab-fs';
const STORE = 'handles';
const HANDLE_KEY = 'bgFolder';
const IMAGE_EXT_RE = /\.(png|jpe?g)$/i;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let cachedHandle = null;

// True if this browser/context can even do any of this.
export function isSupported() {
  return typeof window !== 'undefined' && !!window.showDirectoryPicker && !!window.indexedDB;
}

// Returns a directory handle with confirmed readwrite permission, or null
// if we don't have one yet, or permission needs a fresh user gesture to
// re-confirm (e.g. after a browser restart). Safe to call anytime,
// including on page load -- it never itself prompts the user.
export async function getFolderHandle() {
  if (!isSupported()) return null;
  if (cachedHandle) {
    const perm = await cachedHandle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') return cachedHandle;
  }
  const stored = await idbGet(HANDLE_KEY);
  if (!stored) return null;
  const perm = await stored.queryPermission({ mode: 'readwrite' });
  if (perm === 'granted') { cachedHandle = stored; return stored; }
  return null;
}

// Must be called synchronously from a user gesture (a click handler).
// First-ever connect: opens the native folder picker so the person can
// select their extension's bg/ folder once. On later calls, if we
// already have a handle but its permission lapsed, this just re-requests
// permission on that same handle -- no picker needed.
export async function connectFolder() {
  if (!isSupported()) throw new Error('This browser doesn\u2019t support folder access.');
  const stored = await idbGet(HANDLE_KEY);
  if (stored) {
    const perm = await stored.requestPermission({ mode: 'readwrite' });
    if (perm === 'granted') { cachedHandle = stored; return stored; }
  }
  const handle = await window.showDirectoryPicker({ id: 'productivtab-bg', mode: 'readwrite' });
  await idbSet(HANDLE_KEY, handle);
  cachedHandle = handle;
  return handle;
}

// { name, url }[] -- url is a session-local blob: URL, good for painting
// a thumbnail. The name alone (not the url) is what gets stored/applied,
// via the stable relative path bg/<name>.
export async function listImages() {
  const handle = await getFolderHandle();
  if (!handle) return [];
  const out = [];
  for await (const entry of handle.values()) {
    if (entry.kind === 'file' && IMAGE_EXT_RE.test(entry.name)) {
      const file = await entry.getFile();
      out.push({ name: entry.name, url: URL.createObjectURL(file) });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

async function fileExists(dirHandle, name) {
  try { await dirHandle.getFileHandle(name); return true; }
  catch (e) { return false; }
}

// Writes `file` into bg/ under its original name (de-duplicated if that
// name's already taken) and returns the final filename actually used.
export async function uploadImage(file) {
  if (!IMAGE_EXT_RE.test(file.name)) {
    throw new Error('Only PNG, JPG, or JPEG files are supported.');
  }
  const handle = await getFolderHandle();
  if (!handle) throw new Error('Background folder isn\u2019t connected.');

  let name = file.name;
  let i = 1;
  while (await fileExists(handle, name)) {
    const dot = file.name.lastIndexOf('.');
    name = `${file.name.slice(0, dot)}-${i}${file.name.slice(dot)}`;
    i++;
  }
  const fileHandle = await handle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();
  return name;
}

export async function deleteImage(name) {
  const handle = await getFolderHandle();
  if (!handle) throw new Error('Background folder isn\u2019t connected.');
  await handle.removeEntry(name);
}