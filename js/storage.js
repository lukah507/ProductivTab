// storage.js — single shared storage layer. Every other module imports
// from here instead of redefining these helpers. All four functions check
// chrome.runtime.lastError so a failed write (e.g. a quota overflow) shows
// up in the console instead of vanishing silently.

function checkError(context) {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
    console.error(`[storage] ${context}:`, chrome.runtime.lastError.message);
  }
}

function localFallbackGet(keys) {
  const result = {};
  (Array.isArray(keys) ? keys : [keys]).forEach(k => {
    try { result[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { result[k] = null; }
  });
  return result;
}
function localFallbackSet(obj) {
  Object.entries(obj).forEach(([k, v]) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.error('[storage] localStorage.setItem failed:', e); }
  });
}

export function storageSyncGet(keys) {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(keys, (res) => { checkError('sync.get'); resolve(res); });
    } else {
      resolve(localFallbackGet(keys));
    }
  });
}
export function storageSyncSet(obj) {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set(obj, () => { checkError('sync.set'); resolve(); });
    } else {
      localFallbackSet(obj); resolve();
    }
  });
}
export function storageLocalGet(keys) {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(keys, (res) => { checkError('local.get'); resolve(res); });
    } else {
      resolve(localFallbackGet(keys));
    }
  });
}
export function storageLocalSet(obj) {
  return new Promise(resolve => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(obj, () => { checkError('local.set'); resolve(); });
    } else {
      localFallbackSet(obj); resolve();
    }
  });
}

// Subscribe to live changes in a given storage area ('sync' | 'local') for
// cross-tab sync: every open new tab re-renders itself when another tab
// changes a setting, instead of only picking it up on next reload.
export function onStorageChanged(area, callback) {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.onChanged) return () => {};
  const listener = (changes, areaName) => {
    if (areaName === area) callback(changes);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}