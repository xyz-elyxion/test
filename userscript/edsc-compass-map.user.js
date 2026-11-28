// ==UserScript==
// @name         EDSC Compass → 3D Campus Map
// @namespace    https://github.com/xyz-elyxion/test
// @version      2.4.0
// @description  Adds an "Open to map" button beside the room name in Compass (e.g. WA22), opens that room in the EDSC 3D campus map, and paints a loading screen while Compass boots.
// @author       xyz-elyxion
// @match        https://edsc-vic.compass.education/*
// @match        https://auth.compass.education/*
// @match        https://login.microsoftonline.com/*
// @run-at       document-start
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
 * 2.4.0 — arriving at Microsoft's SAML endpoint from Compass gets a quieter,
 *         Microsoft-styled "Signing you in…" screen instead of the ink plate.
 * 2.3.0 — the SSO steps say "Logging you in…": Compass's own handoff
 *         (/login?handler=SamlSignin) and auth.compass.education/auth/sso/assert.
 * 2.2.0 — the SAML handoff (/login?handler=SamlSignin) gets its own plate that
 *         says "Logging you in…" and waits for the page to move on.
 * 2.1.1 — the sign-in form (/login.aspx) is left alone: a runtime path check
 *         keeps the loading plate off it.
 * 2.1.0 — runs at document-start and paints an ink loading plate over Compass
 *         until the class header renders (or 9 s pass, or you click it), so a
 *         half-built Compass page is never what you sit looking at.
 * 1.3.0 — ink-enamel plate to match the map's wayfinding signage: squared
 *         corners, chalk label, red pin and base rule, no backdrop filter.
 * 1.2.0 — redesigned pill button (map pin + label, hover/press states, dark and
 *         light friendly, keyboard focus ring), sturdier re-render handling and
 *         skipping placeholder text such as "TBC".
 */

(function () {
  'use strict';

  const MAP_URL = 'https://xyz-elyxion.github.io/test/';
  const APP_HOST = 'edsc-vic.compass.education';
  const AUTH_HOST = 'auth.compass.education';
  const MS_HOST = 'login.microsoftonline.com';
  const MS_TENANT = 'd96cb337-1a87-44cf-b69b-3cec334a4c1f';
  const MS_LOADER_ID = 'edsc-ms-signin';
  const MS_STYLE_ID = 'edsc-ms-signin-style';
  const MS_MIN_MS = 400; // never flash in and straight out
  const MS_MAX_MS = 6000; // Microsoft's own form must never stay covered
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

  /* ------------------------------------------------------------------- *
   * Boot screen
   * ------------------------------------------------------------------- */

  const LOADER_ID = 'edsc-compass-loader';
  const LOADER_STYLE_ID = 'edsc-compass-loader-style';
  const LOADER_MIN_MS = 500; // never flash in and straight out
  const LOADER_MAX_MS = 9000; // never trap you on a page that never settles
  const LOADER_LOGIN_MAX_MS = 20000; // the SAML handoff can be slow

  const LOADER_PIN =
    '<svg class="edsc-loader__pin" viewBox="0 0 24 24" width="20" height="20" fill="none" ' +
    'stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" ' +
    'aria-hidden="true" focusable="false">' +
    '<path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0Z" />' +
    '<circle cx="12" cy="10" r="2.6" />' +
    '</svg>';

  const LOADER_STYLE = `
    #${LOADER_ID} {
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483000 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #101d17 !important;
      color: #eef2e9 !important;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important;
      opacity: 1;
      transition: opacity 0.28s cubic-bezier(0.22, 0.68, 0.26, 1);
    }
    #${LOADER_ID}.is-done {
      opacity: 0 !important;
      pointer-events: none !important;
    }
    #${LOADER_ID} .edsc-loader__plate {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 13px;
      min-width: 214px;
      padding: 20px 24px 18px;
      border: 1px solid rgba(238, 242, 233, 0.18);
      border-radius: 4px;
      background: #16261f;
      box-shadow: inset 0 -3px 0 0 #d84a31;
    }
    #${LOADER_ID} .edsc-loader__pin {
      width: 20px;
      height: 20px;
      color: #f2765c;
    }
    #${LOADER_ID} .edsc-loader__word {
      margin: 0;
      font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      letter-spacing: 0.26em;
      text-transform: uppercase;
      color: #9fb0a4;
    }
    #${LOADER_ID} .edsc-loader__word b {
      color: #eef2e9;
      font-weight: 600;
    }
    #${LOADER_ID} .edsc-loader__bar {
      width: 100%;
      height: 3px;
      border-radius: 2px;
      background: rgba(238, 242, 233, 0.16);
      overflow: hidden;
    }
    #${LOADER_ID} .edsc-loader__bar i {
      display: block;
      width: 38%;
      height: 100%;
      background: #e2533a;
      animation: edsc-compass-load 1.15s cubic-bezier(0.45, 0, 0.55, 1) infinite;
    }
    @keyframes edsc-compass-load {
      0% { transform: translateX(-110%); }
      100% { transform: translateX(275%); }
    }
    #${LOADER_ID} .edsc-loader__hint {
      margin: 0;
      font-size: 11.5px;
      line-height: 1.3;
      letter-spacing: 0.01em;
      color: #8fa295;
    }
    @media (prefers-reduced-motion: reduce) {
      #${LOADER_ID} { transition: none; }
      #${LOADER_ID} .edsc-loader__bar i { animation: none; width: 100%; opacity: 0.5; }
    }
  `;

  function loaderHtml(hint) {
    return (
      '<div class="edsc-loader__plate">' +
      LOADER_PIN +
      '<p class="edsc-loader__word">EDSC <b>Compass</b></p>' +
      '<div class="edsc-loader__bar"><i></i></div>' +
      '<p class="edsc-loader__hint">' +
      hint +
      '</p>' +
      '</div>'
    );
  }

  let loaderShownAt = 0;
  let loaderGone = false;
  let readyPoll = 0;

  function loaderElement() {
    return document.getElementById(LOADER_ID);
  }

  /** The single sign-on handoff: Compass is verifying you, not loading a page. */
  function isSamlSignin() {
    return (
      /^\/login(\.aspx)?$/i.test(location.pathname) &&
      /[?&]handler=SamlSignin(&|$)/i.test(location.search)
    );
  }

  /** The SSO assertion on Compass's auth origin: the last step before the app. */
  function isSsoAssert() {
    return location.hostname === AUTH_HOST && /^\/auth\/sso\//i.test(location.pathname);
  }

  /** Any page that is in the middle of signing you in. */
  function isSigningIn() {
    return isSamlSignin() || isSsoAssert();
  }

  function isCompassOrigin() {
    return location.hostname === APP_HOST || location.hostname === AUTH_HOST;
  }

  /** Compass's sign-in form: nothing to map, nothing to cover. */
  function isAuthPage() {
    if (isSigningIn()) return false;
    // The auth origin holds only sign-in pages of its own.
    if (location.hostname === AUTH_HOST) return true;
    return /^\/login(\.aspx)?$/i.test(location.pathname);
  }

  function showLoader() {
    const root = document.body || document.documentElement;
    if (loaderGone || !root || loaderElement() || !isCompassOrigin() || isAuthPage()) return;

    if (!document.getElementById(LOADER_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = LOADER_STYLE_ID;
      style.textContent = LOADER_STYLE;
      (document.head || document.documentElement).appendChild(style);
    }

    const signingIn = isSigningIn();

    const el = document.createElement('div');
    el.id = LOADER_ID;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', signingIn ? 'Logging in to Compass' : 'Loading Compass');
    el.title = 'Click to dismiss';
    el.innerHTML = loaderHtml(signingIn ? 'Logging you in…' : 'Loading your classes…');
    root.appendChild(el);

    loaderShownAt = performance.now();
    el.addEventListener('click', hideLoader);
    document.addEventListener('keydown', onLoaderKey);
    setTimeout(hideLoader, signingIn ? LOADER_LOGIN_MAX_MS : LOADER_MAX_MS);
    // On the handoff page Compass's own "signing in" text would retire this
    // plate at once, so only the app shell counts as ready there.
    readyPoll = setTimeout(signingIn ? watchAppShell : watchReady, 120);
  }

  function onLoaderKey(event) {
    if (event.key === 'Escape') hideLoader();
  }

  /** The signed-in app shell: room name in the header, or its container. */
  function compassHeader() {
    return !!(
      document.querySelector('#topDetailsLocationName') ||
      document.querySelector('.topDetails, [class*="topDetails__"]')
    );
  }

  /** Has Compass painted enough that covering it is no longer helpful? */
  function compassReady() {
    const body = document.body;
    if (!body) return false;
    if (compassHeader()) return true;
    // Anything else with real content on it (login page, dashboard, notices).
    // innerText, not textContent: script and style bodies are not content.
    return (body.innerText || '').trim().length > 150;
  }

  function watchReady() {
    if (loaderGone) return;
    if (compassReady()) {
      const waited = performance.now() - loaderShownAt;
      setTimeout(hideLoader, Math.max(0, LOADER_MIN_MS - waited));
      return;
    }
    readyPoll = setTimeout(watchReady, 120);
  }

  /** Handoff pages: leave as soon as the app shell shows up, nothing else counts. */
  function watchAppShell() {
    if (loaderGone) return;
    if (compassHeader()) {
      const waited = performance.now() - loaderShownAt;
      setTimeout(hideLoader, Math.max(0, LOADER_MIN_MS - waited));
      return;
    }
    readyPoll = setTimeout(watchAppShell, 120);
  }

  function hideLoader() {
    if (loaderGone) return;
    loaderGone = true;
    clearTimeout(readyPoll);
    document.removeEventListener('keydown', onLoaderKey);

    const el = loaderElement();
    if (!el) return;
    el.classList.add('is-done');
    el.removeAttribute('role');
    setTimeout(() => el.remove(), 340);
  }

  /* ------------------------------------------------------------------- *
   * Microsoft sign-in (the SAML identity provider Compass sends you to)
   * ------------------------------------------------------------------- */

  const MS_STYLE = `
    #${MS_LOADER_ID} {
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483000 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin: 0 !important;
      background: #f3f2f1 !important;
      color: #242424 !important;
      font-family: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif !important;
      opacity: 1;
      transition: opacity 0.25s ease;
    }
    #${MS_LOADER_ID}.is-done {
      opacity: 0 !important;
      pointer-events: none !important;
    }
    #${MS_LOADER_ID} .edsc-ms__card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 28px 32px;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.14);
    }
    #${MS_LOADER_ID} .edsc-ms__spin {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 3px solid #d9d9d9;
      border-top-color: #0f6cbd;
      animation: edsc-ms-spin 0.9s linear infinite;
    }
    @keyframes edsc-ms-spin {
      to { transform: rotate(360deg); }
    }
    #${MS_LOADER_ID} .edsc-ms__word {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
    #${MS_LOADER_ID} .edsc-ms__hint {
      margin: 0;
      font-size: 12.5px;
      color: #616161;
    }
    @media (prefers-reduced-motion: reduce) {
      #${MS_LOADER_ID} { transition: none; }
      #${MS_LOADER_ID} .edsc-ms__spin { animation-duration: 2.4s; }
    }
  `;

  const MS_HTML =
    '<div class="edsc-ms__card">' +
    '<div class="edsc-ms__spin" aria-hidden="true"></div>' +
    '<p class="edsc-ms__word">Signing you in…</p>' +
    '<p class="edsc-ms__hint">Taking you back to Compass</p>' +
    '</div>';

  let msGone = false;
  let msShownAt = 0;
  let msPoll = 0;

  /** Did this sign-in start at Compass, rather than at Microsoft by itself? */
  function cameFromCompass() {
    try {
      const from = new URL(document.referrer);
      if (from.hostname === APP_HOST || from.hostname === AUTH_HOST) return true;
    } catch (error) {
      /* no referrer at all, or not a URL: fall through to the SAML request */
    }
    // A referrer policy can blank the referrer; Microsoft's plain sign-in page
    // never carries a SAML request, so this still only matches the SSO hop.
    return /[?&]SAMLRequest=/i.test(location.search);
  }

  function isMicrosoftSignin() {
    if (location.hostname !== MS_HOST) return false;
    const tenant = new RegExp('^/' + MS_TENANT + '/saml2(/|$)', 'i');
    return tenant.test(location.pathname) && cameFromCompass();
  }

  function msElement() {
    return document.getElementById(MS_LOADER_ID);
  }

  /** Microsoft has painted its own form: stop covering it, it needs typing in. */
  function microsoftReady() {
    const body = document.body;
    if (!body) return false;
    if (
      document.querySelector(
        'input[type="password"], input[type="email"], input[name="loginfmt"], #i0116, #i0118'
      )
    ) {
      return true;
    }
    return (body.innerText || '').trim().length > 90;
  }

  function hideMsSignin() {
    if (msGone) return;
    msGone = true;
    clearTimeout(msPoll);
    const el = msElement();
    if (!el) return;
    el.classList.add('is-done');
    el.removeAttribute('role');
    setTimeout(() => el.remove(), 300);
  }

  function watchMicrosoft() {
    if (msGone) return;
    if (microsoftReady()) {
      setTimeout(hideMsSignin, Math.max(0, MS_MIN_MS - (performance.now() - msShownAt)));
      return;
    }
    msPoll = setTimeout(watchMicrosoft, 100);
  }

  function showMsSignin() {
    const root = document.body || document.documentElement;
    if (msGone || !root || msElement() || !isMicrosoftSignin()) return;

    if (!document.getElementById(MS_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = MS_STYLE_ID;
      style.textContent = MS_STYLE;
      (document.head || document.documentElement).appendChild(style);
    }

    const el = document.createElement('div');
    el.id = MS_LOADER_ID;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', 'Signing in to Compass');
    el.title = 'Click to dismiss';
    el.innerHTML = MS_HTML;
    root.appendChild(el);

    msShownAt = performance.now();
    el.addEventListener('click', hideMsSignin);
    document.addEventListener('keydown', onMsKey);
    setTimeout(hideMsSignin, MS_MAX_MS);
    msPoll = setTimeout(watchMicrosoft, 100);
  }

  function onMsKey(event) {
    if (event.key === 'Escape') hideMsSignin();
  }

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
    // Only Compass itself has a room header to put a map button beside.
    if (location.hostname !== APP_HOST) return;

    injectStyle();

    // The boot screen can be built before <body> exists; move it in once it does.
    const loader = loaderElement();
    if (loader && document.body && loader.parentNode !== document.body) {
      document.body.appendChild(loader);
    }

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

  // Paint the boot screens before Compass (or Microsoft) paints its own shell.
  function paintBootScreens() {
    showLoader();
    showMsSignin();
  }

  if (document.documentElement) paintBootScreens();
  else document.addEventListener('readystatechange', paintBootScreens, { once: true });

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
