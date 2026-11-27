// ==UserScript==
// @name         EDSC Compass → 3D Campus Map
// @namespace    https://github.com/xyz-elyxion/test
// @version      1.2.0
// @description  Adds an "Open to map" button beside the room name in Compass (e.g. WA22) and opens that room in the EDSC 3D campus map.
// @author       xyz-elyxion
// @match        https://edsc-vic.compass.education/*
// @run-at       document-idle
// @grant        none
// @noframes
// @downloadURL  https://xyz-elyxion.github.io/test/userscript/edsc-compass-map.user.js
// @updateURL    https://xyz-elyxion.github.io/test/userscript/edsc-compass-map.user.js
// ==/UserScript==

/*
 * Install: open the link below in a browser with Tampermonkey or Violentmonkey
 * and confirm the install.
 *
 *   https://xyz-elyxion.github.io/test/userscript/edsc-compass-map.user.js
 *
 * On a Compass class page the header shows the room as
 *
 *   <span id="topDetailsLocationName" class="topDetails__locationName">WA22</span>
 *
 * The script puts a small "Open to map" pill right after that span. Clicking it
 * opens
 *
 *   https://xyz-elyxion.github.io/test/?room=WA22
 *
 * in a new tab, where the 3D map flies to the room and highlights its building.
 * The room can be anything Compass prints (K12, WA22, Library …). Compass swaps
 * the location in place as you move between classes, so the button follows the
 * live text and cleans itself up when there is no room on screen.
 *
 * 1.2.0 — redesigned pill button (map pin + label, hover/press states, dark and
 *         light friendly, keyboard focus ring), sturdier re-render handling and
 *         skipping placeholder text such as "TBC".
 */

(function () {
  'use strict';

  const MAP_URL = 'https://xyz-elyxion.github.io/test/';
  const NAME_SELECTOR = '#topDetailsLocationName';
  const BUTTON_CLASS = 'edsc-open-map';
  const BUTTON_TEXT = 'Open to map';
  const STYLE_MARKER = 'edsc-open-map-style';

  // Placeholders Compass prints when a class has no real room.
  const EMPTY_NAME = /^(?:tbc|tba|n\/?a|none|null|nil|-+|—|–|\?+|no\s+location|not\s+set|unknown|home)$/i;

  const PIN_ICON =
    '<svg class="edsc-open-map__pin" viewBox="0 0 24 24" width="13" height="13" fill="none" ' +
    'stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true" focusable="false">' +
    '<path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0Z" />' +
    '<circle cx="12" cy="10" r="2.6" />' +
    '</svg>';

  const STYLE = `
    a.${BUTTON_CLASS} {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      margin: 0 0 0 10px !important;
      padding: 4px 11px 4px 8px !important;
      border: 1px solid rgba(247, 201, 72, 0.42) !important;
      border-radius: 999px !important;
      background: linear-gradient(180deg, #1e4368 0%, #12293f 100%) !important;
      color: #ffe8a6 !important;
      font: 600 12px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important;
      letter-spacing: 0.005em !important;
      text-decoration: none !important;
      text-transform: none !important;
      white-space: nowrap !important;
      vertical-align: middle !important;
      cursor: pointer !important;
      box-shadow: 0 1px 1px rgba(9, 24, 38, 0.25), 0 6px 16px -8px rgba(9, 24, 38, 0.6),
        inset 0 1px 0 rgba(255, 255, 255, 0.14) !important;
      transition: transform 0.16s cubic-bezier(0.32, 0.72, 0.28, 1),
        box-shadow 0.16s cubic-bezier(0.32, 0.72, 0.28, 1),
        background 0.16s cubic-bezier(0.32, 0.72, 0.28, 1), color 0.16s ease !important;
    }
    a.${BUTTON_CLASS} .edsc-open-map__pin {
      width: 13px !important;
      height: 13px !important;
      flex: 0 0 auto !important;
      margin: 0 !important;
      opacity: 0.85;
      transition: opacity 0.16s ease;
    }
    a.${BUTTON_CLASS} .edsc-open-map__label {
      display: inline !important;
      color: inherit !important;
      font: inherit !important;
      line-height: inherit !important;
    }
    a.${BUTTON_CLASS}:hover {
      background: linear-gradient(180deg, #27557f 0%, #16334c 100%) !important;
      border-color: rgba(255, 219, 128, 0.7) !important;
      color: #fff6d2 !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 2px 3px rgba(9, 24, 38, 0.24), 0 12px 24px -10px rgba(9, 24, 38, 0.65),
        inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
    }
    a.${BUTTON_CLASS}:hover .edsc-open-map__pin {
      opacity: 1;
    }
    a.${BUTTON_CLASS}:active {
      transform: translateY(0) scale(0.985) !important;
      box-shadow: 0 1px 1px rgba(9, 24, 38, 0.3), inset 0 2px 4px rgba(0, 0, 0, 0.25) !important;
    }
    a.${BUTTON_CLASS}:focus-visible {
      outline: 2px solid rgba(247, 201, 72, 0.85) !important;
      outline-offset: 2px !important;
    }
    @media (prefers-reduced-motion: reduce) {
      a.${BUTTON_CLASS},
      a.${BUTTON_CLASS}:hover,
      a.${BUTTON_CLASS}:active {
        transition: none !important;
        transform: none !important;
      }
    }
  `;

  let queued = false;

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  }

  /** Compass room text with the whitespace collapsed. */
  function cleanName(text) {
    return (text || '')
      .replace(/\s+/g, ' ')
      .replace(/^room[:\s]+/i, '')
      .replace(/[\s·|,;:–—-]+$/, '')
      .trim();
  }

  function isRealRoom(name) {
    return Boolean(name) && name.length <= 48 && !EMPTY_NAME.test(name);
  }

  function mapHref(name) {
    return `${MAP_URL}?room=${encodeURIComponent(name)}`;
  }

  function buildButton() {
    const link = document.createElement('a');
    link.className = BUTTON_CLASS;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.innerHTML = `${PIN_ICON}<span class="edsc-open-map__label"></span>`;
    link.querySelector('.edsc-open-map__label').textContent = BUTTON_TEXT;
    return link;
  }

  function sync() {
    const live = [];
    document.querySelectorAll(NAME_SELECTOR).forEach((el) => {
      const name = cleanName(el.textContent);
      if (isRealRoom(name)) live.push({ el, name });
    });

    // Drop any button whose room is gone, or that no longer sits beside the
    // element it was made for.
    document.querySelectorAll(`a.${BUTTON_CLASS}`).forEach((button) => {
      const owner = button.previousElementSibling;
      const stillWanted = live.some(
        ({ el, name }) => el === owner && button.dataset.edscRoom === name
      );
      if (!stillWanted) button.remove();
    });

    live.forEach(({ el, name }) => {
      let button = el.nextElementSibling;
      if (!button || !button.classList.contains(BUTTON_CLASS)) {
        button = buildButton();
        el.insertAdjacentElement('afterend', button);
      }

      const label = `Open ${name} in the EDSC 3D campus map`;
      button.href = mapHref(name);
      button.dataset.edscRoom = name;
      button.title = label;
      button.setAttribute('aria-label', label);
    });
  }

  function injectStyle() {
    if (document.querySelector(`style[data-${STYLE_MARKER}]`)) return;
    const style = document.createElement('style');
    style.setAttribute(`data-${STYLE_MARKER}`, '');
    style.textContent = STYLE;
    (document.head || document.documentElement).appendChild(style);
  }

  function start() {
    injectStyle();

    // Compass is a single-page app: it swaps this header in place as you move
    // between classes, so watch the DOM instead of loading once.
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.addEventListener('popstate', schedule);
    window.addEventListener('hashchange', schedule);
    document.addEventListener('visibilitychange', schedule);

    sync();
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
