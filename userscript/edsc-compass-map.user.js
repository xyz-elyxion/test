// ==UserScript==
// @name         EDSC Compass → 3D Campus Map
// @namespace    https://github.com/xyz-elyxion/test
// @version      1.0.0
// @description  Adds an "Open to map" button beside the room name in Compass and opens that room in the EDSC 3D campus map.
// @author       xyz-elyxion
// @match        https://edsc-vic.compass.education/*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://xyz-elyxion.github.io/test/userscript/edsc-compass-map.user.js
// @updateURL    https://xyz-elyxion.github.io/test/userscript/edsc-compass-map.user.js
// ==/UserScript==

/*
 * Install: open the link below in a browser that has Tampermonkey or Violentmonkey,
 * and confirm the install.
 *
 *   https://xyz-elyxion.github.io/test/userscript/edsc-compass-map.user.js
 *
 * On the Compass timetable/class page the script watches for
 *
 *   <span id="topDetailsLocationName" class="topDetails__locationName">WA22</span>
 *
 * and puts an "Open to map" button right after it. Clicking the button opens
 *
 *   https://xyz-elyxion.github.io/test/?room=WA22
 *
 * in a new tab, and the 3D map flies to that room and highlights its building.
 * The room shown by Compass can be anything (K12, WA22, Library …); the button
 * follows whatever the span currently says, including when Compass swaps the
 * location without a page reload.
 */

(function () {
  'use strict';

  const MAP_URL = 'https://xyz-elyxion.github.io/test/';
  const NAME_SELECTOR = '#topDetailsLocationName';
  const BUTTON_CLASS = 'edsc-open-map';
  const BUTTON_TEXT = 'Open to map';

  const STYLE = `
    a.${BUTTON_CLASS} {
      display: inline-flex !important;
      align-items: center;
      margin-left: 10px;
      padding: 2px 10px;
      border-radius: 999px;
      background: #1c3f6e !important;
      color: #f7c948 !important;
      font: 600 12px/1.8 system-ui, -apple-system, "Segoe UI", sans-serif !important;
      letter-spacing: 0.01em;
      text-decoration: none !important;
      white-space: nowrap;
      vertical-align: middle;
      box-shadow: 0 1px 2px rgba(10, 25, 45, 0.25);
      cursor: pointer;
    }
    a.${BUTTON_CLASS}:hover {
      background: #274f83 !important;
      color: #ffd863 !important;
    }
    a.${BUTTON_CLASS}:focus-visible {
      outline: 2px solid #f7c948;
      outline-offset: 2px;
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

  /** The room Compass is currently showing, with whitespace collapsed. */
  function currentLocation() {
    const el = document.querySelector(NAME_SELECTOR);
    if (!el) return null;
    const name = el.textContent.replace(/\s+/g, ' ').trim();
    return name ? { el, name } : null;
  }

  function mapHref(name) {
    return `${MAP_URL}?room=${encodeURIComponent(name)}`;
  }

  function sync() {
    const found = currentLocation();
    const buttons = document.querySelectorAll(`a.${BUTTON_CLASS}`);

    // No location on screen (e.g. a different Compass page): leave nothing behind.
    if (!found) {
      buttons.forEach((button) => button.remove());
      return;
    }

    // Compass re-renders this header, so drop any button that no longer sits
    // beside the live element or still shows an older room.
    buttons.forEach((button) => {
      if (button.dataset.edscRoom !== found.name || button.previousElementSibling !== found.el) {
        button.remove();
      }
    });

    let link = found.el.nextElementSibling;
    if (!link || !link.classList.contains(BUTTON_CLASS)) {
      link = document.createElement('a');
      link.className = BUTTON_CLASS;
      link.textContent = BUTTON_TEXT;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      found.el.insertAdjacentElement('afterend', link);
    }

    link.href = mapHref(found.name);
    link.dataset.edscRoom = found.name;
    link.title = `Open ${found.name} in the EDSC 3D campus map`;
    link.setAttribute('aria-label', `Open ${found.name} in the EDSC 3D campus map`);
  }

  function start() {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    // Compass swaps the location in place as you move between classes, so watch
    // the DOM rather than loading once.
    new MutationObserver(schedule).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener('popstate', schedule);
    window.addEventListener('hashchange', schedule);

    sync();
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
