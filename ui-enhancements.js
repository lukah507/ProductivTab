(function() {
  'use strict';

  /* ---------- Storage helpers (chrome.storage with localStorage fallback) ---------- */
  function storageSyncGet(keys) {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(keys, resolve);
      } else {
        const result = {};
        (Array.isArray(keys) ? keys : [keys]).forEach(k => {
          try { result[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { result[k] = null; }
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
        Object.entries(obj).forEach(([k, v]) => {
          try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
        });
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
          try { result[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { result[k] = null; }
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
        Object.entries(obj).forEach(([k, v]) => {
          try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
        });
        resolve();
      }
    });
  }

  /* ---------- Elements ---------- */
  const settingsBtn = document.getElementById('settings-button');
  const centerControls = document.getElementById('center-controls');
  const settingsDoneBtn = document.getElementById('settings-done'); // may not exist
  const colorInput = document.getElementById('color-input');
  const colorApplyBtn = document.getElementById('color-apply');

  const fontPickerModal = document.getElementById('font-picker-modal');
  const fontList = document.getElementById('font-list');
  const fontPickerCancel = document.getElementById('font-picker-cancel');

  const dateEl = document.getElementById('date');
  const timeEl = document.getElementById('time');
  const quoteEl = document.getElementById('quote');

  /* ---------- Settings toggle ---------- */
  let settingsOpen = false;
  if (settingsBtn && centerControls) {
    settingsBtn.addEventListener('click', () => {
      settingsOpen = !settingsOpen;
      if (settingsOpen) {
        document.body.classList.add('settings-open');
        centerControls.classList.remove('hidden');
        settingsBtn.classList.add('active');
      } else {
        document.body.classList.remove('settings-open');
        centerControls.classList.add('hidden');
        settingsBtn.classList.remove('active');
      }
    });

    if (settingsDoneBtn) {
      settingsDoneBtn.addEventListener('click', () => {
        settingsOpen = false;
        document.body.classList.remove('settings-open');
        centerControls.classList.add('hidden');
        settingsBtn.classList.remove('active');
      });
    }
  }

  // Update accent color on :root when Apply Color is used in the settings UI (keeps behavior consistent)
  if (colorApplyBtn) {
    colorApplyBtn.addEventListener('click', async () => {
      let val = (colorInput && colorInput.value) ? colorInput.value.trim() : '';
      if (!val) {
        val = prompt('Enter HEX color (e.g. #336699)', '#336699') || '';
      }
      if (val && val.match(/^#?[0-9a-fA-F]{6}$/)) {
        const color = (val[0] === '#') ? val : ('#' + val);
        // persist choice to sync storage
        await storageSyncSet({ colorOverride: color });
        // set root css var so all components using --accent-color update
        document.documentElement.style.setProperty('--accent-color', color);
      } else {
        alert('Please pick a valid 6-digit HEX color.');
      }
    });
  }

  /* ---------- Default background fallback ---------- */
  async function applyDefaultBackgroundIfNeeded() {
    const local = await storageLocalGet(['bgList', 'bgCurrent']);
    const bgList = local.bgList || [];
    const bgCurrent = local.bgCurrent || '';

    // If no background is set, use default.png
    if (!bgCurrent && (!bgList || bgList.length === 0)) {
      const defaultBg = '/default.png';
      document.body.style.backgroundImage = `url(${defaultBg})`;
      // Persist as bgCurrent
      await storageLocalSet({ bgCurrent: defaultBg });
    }
  }

  /* ---------- Font picker UI & persistence ---------- */
  const availableFonts = [
    { name: 'Inter (Default)', family: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' },
    { name: 'Molle', family: 'Molle, cursive' },
    { name: 'Cossette', family: 'Cossette, serif' },
    { name: 'MomoTrust', family: 'MomoTrust, sans-serif' }
  ];

  let currentFontTarget = null;
  let currentFontStyles = { bold: false, italic: false };

  if (dateEl) {
    dateEl.style.cursor = 'pointer';
    dateEl.addEventListener('click', () => openFontPicker('date'));
  }
  if (timeEl) {
    timeEl.style.cursor = 'pointer';
    timeEl.addEventListener('click', () => openFontPicker('time'));
  }
  if (quoteEl) {
    quoteEl.style.cursor = 'pointer';
    quoteEl.addEventListener('click', () => openFontPicker('quote'));
  }

  function openFontPicker(targetElementId) {
    currentFontTarget = targetElementId;
    const targetEl = document.getElementById(targetElementId);

    // Load saved styles from sync storage
    storageSyncGet([`style_${targetElementId}`]).then(res => {
      const saved = res[`style_${targetElementId}`] || {};
      currentFontStyles.bold = !!saved.bold;
      currentFontStyles.italic = !!saved.italic;

      // Build font list UI
      if (!fontList) return;
      fontList.innerHTML = '';

      availableFonts.forEach(font => {
        const option = document.createElement('div');
        option.className = 'font-option';
        option.dataset.fontFamily = font.family;

        const name = document.createElement('div');
        name.className = 'font-option-name';
        name.textContent = font.name;

        const preview = document.createElement('div');
        preview.className = 'font-option-preview';
        preview.textContent = 'The quick brown fox jumps over the lazy dog';
        preview.style.fontFamily = font.family;

        option.appendChild(name);
        option.appendChild(preview);

        // Highlight if currently selected
        if (targetEl && targetEl.style.fontFamily === font.family) {
          option.classList.add('selected');
        }

        option.addEventListener('click', () => {
          document.querySelectorAll('.font-option').forEach(o => o.classList.remove('selected'));
          option.classList.add('selected');
          if (targetEl) {
            targetEl.style.fontFamily = font.family;
            saveFontStyle(targetElementId, font.family, currentFontStyles.bold, currentFontStyles.italic);
          }
        });

        fontList.appendChild(option);
      });

      // Style toggles
      const togglesDiv = document.createElement('div');
      togglesDiv.className = 'font-style-toggles';

      const boldBtn = document.createElement('button');
      boldBtn.className = 'font-style-toggle';
      boldBtn.textContent = 'Bold';
      if (currentFontStyles.bold) {
        boldBtn.classList.add('active');
        if (targetEl) targetEl.style.fontWeight = 'bold';
      }
      boldBtn.addEventListener('click', () => {
        currentFontStyles.bold = !currentFontStyles.bold;
        boldBtn.classList.toggle('active');
        if (targetEl) {
          targetEl.style.fontWeight = currentFontStyles.bold ? 'bold' : 'normal';
          saveFontStyle(targetElementId, targetEl.style.fontFamily, currentFontStyles.bold, currentFontStyles.italic);
        }
      });

      const italicBtn = document.createElement('button');
      italicBtn.className = 'font-style-toggle';
      italicBtn.textContent = 'Italic';
      if (currentFontStyles.italic) {
        italicBtn.classList.add('active');
        if (targetEl) targetEl.style.fontStyle = 'italic';
      }
      italicBtn.addEventListener('click', () => {
        currentFontStyles.italic = !currentFontStyles.italic;
        italicBtn.classList.toggle('active');
        if (targetEl) {
          targetEl.style.fontStyle = currentFontStyles.italic ? 'italic' : 'normal';
          saveFontStyle(targetElementId, targetEl.style.fontFamily, currentFontStyles.bold, currentFontStyles.italic);
        }
      });

      togglesDiv.appendChild(boldBtn);
      togglesDiv.appendChild(italicBtn);
      fontList.appendChild(togglesDiv);

      // Show modal
      if (fontPickerModal) {
        fontPickerModal.setAttribute('aria-hidden', 'false');
      }
    });
  }

  async function saveFontStyle(elementId, fontFamily, bold, italic) {
    const key = `style_${elementId}`;
    const style = { fontFamily, bold, italic };
    await storageSyncSet({ [key]: style });
  }

  if (fontPickerCancel) {
    fontPickerCancel.addEventListener('click', () => {
      if (fontPickerModal) fontPickerModal.setAttribute('aria-hidden', 'true');
    });
  }

  if (fontPickerModal) {
    fontPickerModal.addEventListener('click', (e) => {
      if (e.target === fontPickerModal) fontPickerModal.setAttribute('aria-hidden', 'true');
    });
  }

  /* ---------- Hydrate saved styles on load ---------- */
  async function hydrateElementStyles() {
    const elements = ['date', 'time', 'quote'];
    for (const id of elements) {
      const el = document.getElementById(id);
      if (!el) continue;

      const res = await storageSyncGet([`style_${id}`]);
      const style = res[`style_${id}`];
      if (style) {
        if (style.fontFamily) el.style.fontFamily = style.fontFamily;
        if (style.bold) el.style.fontWeight = 'bold';
        if (style.italic) el.style.fontStyle = 'italic';
      }
    }
  }

  /* ---------- High-res favicon enhancer ---------- */
  // Tries to replace an img element's src with a higher-res favicon (Google s2 service sz=128).
  // If high-res fails to load, original src remains.
  window.enhanceFaviconImage = function(imgElement, url) {
    try {
      const u = new URL(url);
      const domain = u.hostname;
      const highResUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

      const testImg = new Image();
      testImg.onload = function() {
        // If loaded successfully, swap the image
        imgElement.src = highResUrl;
      };
      testImg.onerror = function() {
        // keep original
      };
      testImg.src = highResUrl;
    } catch (e) {
      console.warn('Failed to enhance favicon for URL:', url, e);
    }
  };

  /* ---------- Rectangle color picker ---------- */
  window.openRectColorPicker = function(rectId) {
    storageSyncGet([`rectcolor_${rectId}`]).then(res => {
      const savedColor = res[`rectcolor_${rectId}`] || '#ffffff';

      // Create a temporary color input for better UX
      const input = document.createElement('input');
      input.type = 'color';
      input.value = savedColor;
      // Add id/name attributes to avoid lint warnings and improve traceability
      input.id = 'rectcolor-picker-' + rectId;
      input.name = 'rectcolor-picker-' + rectId;
      input.style.position = 'fixed';
      input.style.top = '-100px';
      document.body.appendChild(input);

      input.addEventListener('change', () => {
        const hexColor = input.value;
        const rectEl = document.getElementById(rectId);
        if (rectEl) {
          rectEl.style.background = hexColor;
          storageSyncSet({ [`rectcolor_${rectId}`]: hexColor });
        }
        document.body.removeChild(input);
      });

      input.addEventListener('blur', () => {
        // Remove input if user cancels
        setTimeout(() => {
          if (input.parentNode) document.body.removeChild(input);
        }, 100);
      });

      // Trigger the color picker
      input.click();
    });
  };

  /* ---------- Hydrate rectangle colors on load ---------- */
  async function hydrateRectColors() {
    const rects = document.querySelectorAll('[id^="rect-"]');
    for (const rect of rects) {
      const rectId = rect.id;
      const res = await storageSyncGet([`rectcolor_${rectId}`]);
      const color = res[`rectcolor_${rectId}`];
      if (color) rect.style.background = color;
    }
  }

  /* ---------- Initialize enhancements ---------- */
  async function initEnhancements() {
    // Default background if nothing set
    await applyDefaultBackgroundIfNeeded();

    // Hydrate saved styles (fonts / bold / italic)
    await hydrateElementStyles();

    // Apply saved accent color (if any)
    const syncRes = await storageSyncGet(['colorOverride']);
    if (syncRes && syncRes.colorOverride) {
      document.documentElement.style.setProperty('--accent-color', syncRes.colorOverride);
    }

    // small delay to allow main.js to render bars before hydrating rect colors
    setTimeout(hydrateRectColors, 500);
  }

  // Run initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancements);
  } else {
    initEnhancements();
  }

  /* ---------- Mutation observer: re-hydrate rect colors when bars are re-rendered ---------- */
  const topBar = document.getElementById('top-bar');
  const bottomBar = document.getElementById('bottom-bar');
  const observer = new MutationObserver(() => {
    hydrateRectColors();
  });
  if (topBar) observer.observe(topBar, { childList: true });
  if (bottomBar) observer.observe(bottomBar, { childList: true });

  /* ---------- Expose for debugging ---------- */
  window.__uiEnhancements = {
    hydrateElementStyles,
    hydrateRectColors,
    openRectColorPicker,
    enhanceFaviconImage
  };

})();