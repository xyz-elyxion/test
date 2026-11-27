// ==UserScript==
// @name         EDSC Compass → 3D Campus Map
// @namespace    https://github.com/xyz-elyxion/test
// @version      2.0.0
// @description  Adds an "Open to map" button beside the room name in Compass (e.g. WA22) and injects a page script (window.EDSCMap) that opens any room in the EDSC 3D campus map.
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
 * The script puts a small "Open to map" plate right after that span. Clicking it
 * opens
 *
 *   https://xyz-elyxion.github.io/test/?room=WA22
 *
 * in a new tab, where the 3D map flies to the room and highlights its building.
 * The room can be anything Compass prints (K12, WA22, Library …). Compass swaps
 * the location in place as you move between classes, so the button follows the
 * live text and cleans itself up when there is no room on screen.
 *
 * HOW IT WORKS
 * ------------
 * The userscript is only a bootstrap. It serialises the page script below,
 * appends it to Compass as a <script> element, and steps out of the way. The
 * page script runs in Compass's own window, so it can hand the site a small
 * API you can drive from DevTools:
 *
 *   EDSCMap.room()            -> "WA22" (the room on screen), or null
 *   EDSCMap.hrefFor("K12")    -> "https://xyz-elyxion.github.io/test/?room=K12"
 *   EDSCMap.open("WA22")      -> opens that room in a new tab, returns the URL
 *   EDSCMap.open()            -> opens the map at whichever room is on screen
 *   EDSCMap.refresh()         -> re-syncs the button after Compass re-renders
 *   EDSCMap.version           -> "2.0.0"
 *
 * If Compass's Content-Security-Policy refuses inline scripts, the injected
 * <script> never runs; the userscript notices the missing API and runs the same
 * page script itself, so the button still appears (only window.EDSCMap is
 * unavailable on such a page).
 *
 * 2.0.0 — the userscript now injects the page script instead of holding it,
 *         exposing the EDSCMap API; CSP-safe fallback.
 * 1.3.0 — ink-enamel plate to match the map's wayfinding signage: squared
 *         corners, chalk label, red pin and base rule, no backdrop filter.
 * 1.2.0 — redesigned pill button (map pin + label, hover/press states, dark and
 *         light friendly, keyboard focus ring), sturdier re-render handling and
 *         skipping placeholder text such as "TBC".
 */

(function () {
  'use strict';

  const CONFIG = {
    mapUrl: 'https://xyz-elyxion.github.io/test/',
    marker: '__edscMap',
    version: '2.0.0',
  };

  // This function is never called in the userscript's own scope on the happy
  // path — it is stringified and injected into the page. Keep it self-contained:
  // no closures over the constants above.
  function edscPageScript(cfg) {
    const existing = window[cfg.marker];
    if (existing) {
      existing.refresh();
      return;
    }

    const NAME_SELECTOR = '#topDetailsLocationName';
    const BUTTON_CLASS = 'edsc-open-map';
    const BUTTON_TEXT = 'Open to map';
    const STYLE_MARKER = 'edsc-open-map-style';

    // Placeholders Compass prints when a class has no real room.
    const EMPTY_NAME =
      /^(?:tbc|tba|n\/?a|none|null|nil|-+|—|–|\?+|no\s+location|not\s+set|unknown|home)$/i;

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
      gap: 7px !important;
      margin: 0 0 0 10px !important;
      padding: 4px 11px 4px 9px !important;
      border: 1px solid #0c1712 !important;
      border-radius: 3px !important;
      background: #16261f !important;
      color: #eef2e9 !important;
      font: 600 11.5px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important;
      letter-spacing: 0.005em !important;
      text-decoration: none !important;
      text-transform: none !important;
      white-space: nowrap !important;
      vertical-align: middle !important;
      cursor: pointer !important;
      box-shadow: inset 0 -2px 0 0 #d84a31, 0 1px 2px rgba(9, 20, 15, 0.24),
        inset 0 1px 0 rgba(255, 255, 255, 0.07) !important;
      transition: background 0.16s cubic-bezier(0.22, 0.68, 0.26, 1),
        box-shadow 0.16s cubic-bezier(0.22, 0.68, 0.26, 1), transform 0.16s cubic-bezier(0.22, 0.68, 0.26, 1) !important;
    }
    a.${BUTTON_CLASS} .edsc-open-map__pin {
      width: 13px !important;
      height: 13px !important;
      flex: 0 0 auto !important;
      margin: 0 !important;
      color: #f2765c !important;
      opacity: 0.9;
      transition: opacity 0.16s ease;
    }
    a.${BUTTON_CLASS} .edsc-open-map__label {
      display: inline !important;
      color: inherit !important;
      font: inherit !important;
      line-height: inherit !important;
    }
    a.${BUTTON_CLASS}:hover {
      background: #20352b !important;
      box-shadow: inset 0 -2px 0 0 #f2765c, 0 3px 8px -3px rgba(9, 20, 15, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
      transform: translateY(-1px) !important;
    }
    a.${BUTTON_CLASS}:hover .edsc-open-map__pin {
      opacity: 1;
    }
    a.${BUTTON_CLASS}:active {
      transform: translateY(0) !important;
      background: #0f1c16 !important;
      box-shadow: inset 0 -2px 0 0 #d84a31, inset 0 2px 3px rgba(0, 0, 0, 0.35) !important;
    }
    a.${BUTTON_CLASS}:focus-visible {
      outline: 2px solid #e2533a !important;
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
      return `${cfg.mapUrl}?room=${encodeURIComponent(name)}`;
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
      if (document.querySelector(`style[data-${STYLE_MARKER}]`)) return null;
      const style = document.createElement('style');
      style.setAttribute(`data-${STYLE_MARKER}`, '');
      style.textContent = STYLE;
      (document.head || document.documentElement).appendChild(style);
      return style;
    }

    const api = {
      version: cfg.version,
      style: null,
      /** Room Compass is showing right now, or null when it shows a placeholder. */
      room() {
        const el = document.querySelector(NAME_SELECTOR);
        if (!el) return null;
        const name = cleanName(el.textContent);
        return isRealRoom(name) ? name : null;
      },
      /** Map URL for a room code; with no argument, the room on screen. */
      hrefFor(name) {
        const room = name == null ? api.room() : cleanName(String(name));
        return room && isRealRoom(room) ? mapHref(room) : cfg.mapUrl;
      },
      /** Open a room (or the room on screen) in a new tab. Returns the URL used. */
      open(name) {
        const url = api.hrefFor(name);
        window.open(url, '_blank', 'noopener');
        return url;
      },
      /** Re-sync the button with the page, e.g. after Compass re-renders. */
      refresh: sync,
    };

    api.style = injectStyle();
    window[cfg.marker] = api;
    window.EDSCMap = api;

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

  const SOURCE = `(${edscPageScript.toString()})(${JSON.stringify(CONFIG)});`;

  function injectPageScript() {
    const script = document.createElement('script');
    script.setAttribute('data-edsc-map', '');
    script.textContent = SOURCE;
    (document.head || document.documentElement).appendChild(script);
    // Inline scripts run the moment they are inserted, so the marker is either
    // there now or the page's CSP blocked us.
    const injected = Boolean(window[CONFIG.marker]);
    script.remove();
    return injected;
  }

  function start() {
    if (window[CONFIG.marker]) {
      window[CONFIG.marker].refresh();
      return;
    }
    if (injectPageScript()) return;
    // No page-context script allowed: run the same code from here so the button
    // still works (window.EDSCMap will stay private to this context).
    edscPageScript(CONFIG);
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
