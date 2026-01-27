(function() {
  'use strict';

  /* ---------- Storage helpers (small wrappers) ---------- */
  function storageSyncGet(keys) {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(keys, resolve);
      } else {
        // fallback: localStorage
        const result = {};
        (Array.isArray(keys) ? keys : [keys]).forEach(k => {
          try { result[k] = JSON.parse(localStorage.getItem(k)); } catch(e) { result[k] = null; }
        });
        resolve(result);
      }
    });
  }
  function storageSyncSet(obj) {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set(obj, resolve);
      } else {
        Object.entries(obj).forEach(([k,v]) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} });
        resolve();
      }
    });
  }
  function storageLocalGet(keys) {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(keys, resolve);
      } else {
        const result = {};
        (Array.isArray(keys) ? keys : [keys]).forEach(k => {
          try { result[k] = JSON.parse(localStorage.getItem(k)); } catch(e) { result[k] = null; }
        });
        resolve(result);
      }
    });
  }
  function storageLocalSet(obj) {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(obj, resolve);
      } else {
        Object.entries(obj).forEach(([k,v]) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} });
        resolve();
      }
    });
  }

  /* ---------- Settings toggle ---------- */
  const settingsBtn = document.getElementById('settings-button');
  const centerControls = document.getElementById('center-controls');
  const settingsDoneBtn = document.getElementById('settings-done');

  if (settingsBtn && centerControls) {
    settingsBtn.addEventListener('click', () => {
      const isOpen = document.body.classList.toggle('settings-open');
      centerControls.classList.toggle('hidden', !isOpen);
      settingsBtn.classList.toggle('active', isOpen);
    });

    if (settingsDoneBtn) {
      settingsDoneBtn.addEventListener('click', () => {
        document.body.classList.remove('settings-open');
        centerControls.classList.add('hidden');
        settingsBtn.classList.remove('active');
      });
    }
  }

  /* ---------- Default background fallback ---------- */
  async function applyDefaultBackgroundIfNeeded() {
    const local = await storageLocalGet(['bgCurrent']);
    const bgCurrent = local.bgCurrent || '';
    if (!bgCurrent) {
      const defaultBg = '/default.png';
      document.body.style.backgroundImage = `url(${defaultBg})`;
      await storageLocalSet({ bgCurrent: defaultBg });
    }
  }

  /* ---------- Initialize enhancements ---------- */
  async function initEnhancements() {
    await applyDefaultBackgroundIfNeeded();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancements);
  } else {
    initEnhancements();
  }

})();