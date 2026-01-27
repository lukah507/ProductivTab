(function() {
  'use strict';

  /* ---------- Storage helpers ---------- */
  function storageSyncGet(keys) {
    return new Promise(resolve => chrome.storage.sync.get(keys, resolve));
  }
  function storageSyncSet(obj) {
    return new Promise(resolve => chrome.storage.sync.set(obj, resolve));
  }
  function storageLocalGet(keys) {
    return new Promise(resolve => chrome.storage.local.get(keys, resolve));
  }
  function storageLocalSet(obj) {
    return new Promise(resolve => chrome.storage.local.set(obj, resolve));
  }

  /* ---------- Settings toggle ---------- */
  const settingsBtn = document.getElementById('settings-button');
  const centerControls = document.getElementById('center-controls');
  const colorInput = document.getElementById('color-input');

  let settingsOpen = false;

  if (settingsBtn && centerControls) {
    settingsBtn.addEventListener('click', () => {
      settingsOpen = !settingsOpen;
      if (settingsOpen) {
        centerControls.classList.remove('hidden');
        settingsBtn.classList.add('active');
      } else {
        centerControls.classList.add('hidden');
        settingsBtn.classList.remove('active');
      }
    });

    // Update settings button background when color is applied
    const colorApplyBtn = document.getElementById('color-apply');
    if (colorApplyBtn) {
      colorApplyBtn.addEventListener('click', async () => {
        const val = (colorInput.value || '').trim();
        if (val && val.match(/^#?[0-9a-fA-F]{6}$/)) {
          const color = (val[0] === '#') ? val : ('#' + val);
          settingsBtn.style.setProperty('--accent-color', color);
        }
      });
    }
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

  /* ---------- Font picker ---------- */
  const fontPickerModal = document.getElementById('font-picker-modal');
  const fontList = document.getElementById('font-list');
  const fontPickerCancel = document.getElementById('font-picker-cancel');

  const availableFonts = [
    { name: 'Inter (Default)', family: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' },
    { name: 'Molle', family: 'Molle, cursive' },
    { name: 'Cossette', family: 'Cossette, serif' },
    { name: 'MomoTrust', family: 'MomoTrust, sans-serif' }
  ];

  let currentFontTarget = null;
  let currentFontStyles = { bold: false, italic: false };

  // Make date, time, and quote clickable to open font picker
  const dateEl = document.getElementById('date');
  const timeEl = document.getElementById('time');
  const quoteEl = document.getElementById('quote');

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
    
    // Load current styles
    storageSyncGet([`style_${targetElementId}`]).then(res => {
      const saved = res[`style_${targetElementId}`] || {};
      currentFontStyles.bold = saved.bold || false;
      currentFontStyles.italic = saved.italic || false;

      // Build font list
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
          // Remove selected from all
          document.querySelectorAll('.font-option').forEach(o => o.classList.remove('selected'));
          option.classList.add('selected');
          
          // Apply font
          if (targetEl) {
            targetEl.style.fontFamily = font.family;
            saveFontStyle(targetElementId, font.family, currentFontStyles.bold, currentFontStyles.italic);
          }
        });
        
        fontList.appendChild(option);
      });

      // Add style toggles
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
      if (fontPickerModal) {
        fontPickerModal.setAttribute('aria-hidden', 'true');
      }
    });
  }

  // Close font picker when clicking outside
  if (fontPickerModal) {
    fontPickerModal.addEventListener('click', (e) => {
      if (e.target === fontPickerModal) {
        fontPickerModal.setAttribute('aria-hidden', 'true');
      }
    });
  }

  /* ---------- Hydrate styles on load ---------- */
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
  window.enhanceFaviconImage = function(imgElement, url) {
    try {
      const u = new URL(url);
      const domain = u.hostname;
      
      // Request larger favicon from Google's service
      const highResUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      
      // Try to load high-res version
      const testImg = new Image();
      testImg.onload = function() {
        imgElement.src = highResUrl;
      };
      testImg.onerror = function() {
        // Keep original if high-res fails
      };
      testImg.src = highResUrl;
    } catch (e) {
      // Invalid URL, keep original
    }
  };

  /* ---------- Rectangle color picker ---------- */
  window.openRectColorPicker = function(rectId) {
    // Load saved color if any
    storageSyncGet([`rectcolor_${rectId}`]).then(res => {
      const savedColor = res[`rectcolor_${rectId}`] || '#ffffff';
      
      const color = prompt('Enter hex color for icon background (e.g., #336699):', savedColor);
      if (!color) return;
      
      const match = color.match(/^#?([0-9a-fA-F]{6})$/);
      if (!match) {
        alert('Invalid color format. Use hex like #336699');
        return;
      }
      
      const hexColor = '#' + match[1];
      const rectEl = document.getElementById(rectId);
      if (rectEl) {
        rectEl.style.background = hexColor;
        // Save to storage
        storageSyncSet({ [`rectcolor_${rectId}`]: hexColor });
      }
    });
  };

  /* ---------- Hydrate rectangle colors on load ---------- */
  async function hydrateRectColors() {
    // Get all icon elements with IDs starting with 'rect-'
    const rects = document.querySelectorAll('[id^="rect-"]');
    for (const rect of rects) {
      const rectId = rect.id;
      const res = await storageSyncGet([`rectcolor_${rectId}`]);
      const color = res[`rectcolor_${rectId}`];
      if (color) {
        rect.style.background = color;
      }
    }
  }

  /* ---------- Initialize on load ---------- */
  async function initEnhancements() {
    await applyDefaultBackgroundIfNeeded();
    await hydrateElementStyles();
    
    // Wait a bit for bars to render, then hydrate rect colors
    setTimeout(hydrateRectColors, 500);
  }

  // Run initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancements);
  } else {
    initEnhancements();
  }

  // Re-hydrate rect colors when bars are re-rendered
  // (hook into main.js render if needed, or use MutationObserver)
  const observer = new MutationObserver(() => {
    hydrateRectColors();
  });
  const topBar = document.getElementById('top-bar');
  const bottomBar = document.getElementById('bottom-bar');
  if (topBar) observer.observe(topBar, { childList: true });
  if (bottomBar) observer.observe(bottomBar, { childList: true });

})();
