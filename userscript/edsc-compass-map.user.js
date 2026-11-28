// ==UserScript==
// @name         EDSC Compass → 3D Campus Map
// @namespace    https://github.com/xyz-elyxion/test
// @version      2.9.0
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
 * 2.9.0 — the Compass sign-in page is rebranded: the card becomes an ink plate
 *         with chalk type and a signal-red SSO button.
 * 2.8.0 — the Compass sign-in page is not covered at all: the animated ink
 *         field becomes its page background, behind the sign-in card.
 * 2.7.0 — the Compass sign-in page gets the boot plate too (it retires as soon
 *         as the form paints), and the alternate-sign-in removal now lands as
 *         CSS at document-start, not only once the DOM is synced.
 * 2.6.1 — the loading field drifts: a slow surveyor grid and a breathing red
 *         glow behind the plate (both still when reduced motion is on).
 * 2.6.0 — the login page keeps only "Sign in with SSO": the "Sign in another
 *         way" button and the "or" above it are removed.
 * 2.5.0 — Microsoft's SAML endpoint uses the same ink plate as Compass, not a
 *         separate Microsoft-styled screen.
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
      overflow: hidden !important;
      isolation: isolate;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif !important;
      opacity: 1;
      transition: opacity 0.28s cubic-bezier(0.22, 0.68, 0.26, 1);
    }
    #${LOADER_ID}.is-done {
      opacity: 0 !important;
      pointer-events: none !important;
    }
    /* Drifting surveyor grid: the field never sits still. */
    #${LOADER_ID}::before {
      content: "";
      position: absolute;
      inset: -20%;
      background-image:
        linear-gradient(to right, rgba(238, 242, 233, 0.055) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(238, 242, 233, 0.055) 1px, transparent 1px);
      background-size: 56px 56px, 56px 56px;
      animation: edsc-grid-drift 24s linear infinite;
      pointer-events: none;
      z-index: 0;
    }
    /* Slow signal-red glow swelling behind the plate. */
    #${LOADER_ID}::after {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(
        58% 52% at 50% 46%,
        rgba(226, 83, 58, 0.22),
        rgba(226, 83, 58, 0.07) 45%,
        transparent 72%
      );
      animation: edsc-glow-breathe 7s ease-in-out infinite alternate;
      pointer-events: none;
      z-index: 0;
    }
    @keyframes edsc-grid-drift {
      from { transform: translate3d(0, 0, 0); }
      to { transform: translate3d(56px, 56px, 0); }
    }
    @keyframes edsc-glow-breathe {
      from { opacity: 0.35; transform: scale(0.92); }
      to { opacity: 1; transform: scale(1.08); }
    }
    #${LOADER_ID} .edsc-loader__plate {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 13px;
      min-width: 214px;
      padding: 20px 24px 18px;
      border: 1px solid rgba(238, 242, 233, 0.18);
      border-radius: 4px;
      background: #16261f;
      box-shadow: inset 0 -3px 0 0 #d84a31, 0 18px 40px -18px rgba(0, 0, 0, 0.75);
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
      #${LOADER_ID}::before,
      #${LOADER_ID}::after { animation: none; }
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
  /** Compass's own sign-in form (it lives at /login and the legacy /login.aspx). */
  function isSigninForm() {
    return location.hostname === APP_HOST && /^\/login(\.aspx)?$/i.test(location.pathname);
  }

  function isAuthPage() {
    if (isSigningIn()) return false;
    // The auth origin holds only sign-in pages of its own.
    if (location.hostname === AUTH_HOST) return true;
    return /^\/login(\.aspx)?$/i.test(location.pathname);
  }

  function showLoader() {
    const root = document.body || document.documentElement;
    const microsoft = isMicrosoftSignin();
    if (loaderGone || !root || loaderElement()) return;
    if (!microsoft && (!isCompassOrigin() || isAuthPage())) return;

    if (!document.getElementById(LOADER_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = LOADER_STYLE_ID;
      style.textContent = LOADER_STYLE;
      (document.head || document.documentElement).appendChild(style);
    }

    const signingIn = microsoft || isSigningIn();

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
    // On the handoff pages the site's own "signing in" text would retire this
    // plate at once, so only the app shell (or Microsoft's real form) counts.
    readyPoll = setTimeout(microsoft ? watchMicrosoftForm : signingIn ? watchAppShell : watchReady, 120);
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

  /** Microsoft's form is ready to be typed in: get the plate off it. */
  function watchMicrosoftForm() {
    if (loaderGone) return;
    if (microsoftReady()) {
      const waited = performance.now() - loaderShownAt;
      setTimeout(hideLoader, Math.max(0, LOADER_MIN_MS - waited));
      return;
    }
    readyPoll = setTimeout(watchMicrosoftForm, 100);
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

  const LOGIN_FIX_STYLE_ID = 'edsc-login-fix';
  const LOGIN_BG_ID = 'edsc-login-bg';

  // The sign-in page gets the same moving field as the boot plate, but as its
  // page background, with the sign-in card sitting on top of it.
  const LOGIN_FIX_STYLE = `
    html body,
    html body[class],
    html body .centerWrapper { background: transparent !important; }
    #${LOGIN_BG_ID} {
      position: fixed !important;
      inset: 0 !important;
      z-index: -1 !important;
      overflow: hidden !important;
      pointer-events: none !important;
      background: #101d17 !important;
    }
    #${LOGIN_BG_ID}::before {
      content: "";
      position: absolute;
      inset: -20%;
      background-image:
        linear-gradient(to right, rgba(238, 242, 233, 0.055) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(238, 242, 233, 0.055) 1px, transparent 1px);
      background-size: 56px 56px, 56px 56px;
      animation: edsc-login-grid-drift 24s linear infinite;
    }
    #${LOGIN_BG_ID}::after {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(
        58% 52% at 50% 46%,
        rgba(226, 83, 58, 0.22),
        rgba(226, 83, 58, 0.07) 45%,
        transparent 72%
      );
      animation: edsc-login-glow-breathe 7s ease-in-out infinite alternate;
    }
    @keyframes edsc-login-grid-drift {
      from { transform: translate3d(0, 0, 0); }
      to { transform: translate3d(56px, 56px, 0); }
    }
    @keyframes edsc-login-glow-breathe {
      from { opacity: 0.35; transform: scale(0.92); }
      to { opacity: 1; transform: scale(1.08); }
    }
    @media (prefers-reduced-motion: reduce) {
      #${LOGIN_BG_ID}::before,
      #${LOGIN_BG_ID}::after { animation: none; }
    }
    /* --- the card carries the school's signage, not Compass's chrome --- */
    .loginFormContainer,
    .loginFormContainer-customBackground {
      background: #16261f !important;
      border: 1px solid rgba(238, 242, 233, 0.18) !important;
      border-radius: 4px !important;
      box-shadow: inset 0 -3px 0 0 #d84a31, 0 24px 60px -28px rgba(0, 0, 0, 0.85) !important;
      color: #eef2e9 !important;
      padding: 26px 26px 22px !important;
    }
    .loginFormContainer .schoolName,
    .loginForm .schoolName {
      margin: 0 0 18px !important;
      padding: 0 0 13px !important;
      border-bottom: 1px solid rgba(238, 242, 233, 0.14) !important;
      color: #9fb0a4 !important;
      font: 600 10.5px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
      letter-spacing: 0.16em !important;
      text-transform: uppercase !important;
    }
    .samlSignInButtonContainer {
      border: 0 !important;
      border-radius: 3px !important;
      background: #e2533a !important;
      overflow: hidden !important;
      transition: background 0.15s ease !important;
    }
    .samlSignInButtonContainer:hover,
    .samlSignInButtonContainer:focus-within {
      background: #d84a31 !important;
    }
    #samlSignInButtonKeyImage {
      margin-left: 14px !important;
      filter: brightness(0) invert(1) !important;
      opacity: 0.85 !important;
    }
    .samlSignInButtonText,
    #SamlSignInButtonText {
      width: 100% !important;
      padding: 15px 16px !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      color: #ffffff !important;
      font: 600 11.5px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important;
      letter-spacing: 0.16em !important;
      text-transform: uppercase !important;
      text-align: left !important;
      cursor: pointer !important;
    }
    .loginForm input[type="text"],
    .loginForm input[type="password"],
    .loginForm input[type="email"],
    .loginForm input[type="tel"] {
      background: #101d17 !important;
      border: 1px solid rgba(238, 242, 233, 0.22) !important;
      border-radius: 3px !important;
      color: #eef2e9 !important;
      padding: 11px 12px !important;
      font: 400 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif !important;
    }
    .loginForm input[type="text"]:focus,
    .loginForm input[type="password"]:focus {
      border-color: #e2533a !important;
      outline: none !important;
    }
    .loginForm label,
    .loginForm .checkbox label {
      color: #b9c6bc !important;
      font-size: 12px !important;
    }
    .loginForm a { color: #f2765c !important; }
    .compassLogo-color img { filter: brightness(0) invert(1) !important; opacity: 0.7 !important; }

    .samlSignInAnotherWayButton { display: none !important; }
    .divider:has(+ .samlSignInAnotherWayButton) { display: none !important; }
  `;

  /** Sign-in page: animated field behind the card, alternate route gone. */
  function injectLoginFix() {
    if (!isSigninForm()) return;

    const host = document.head || document.documentElement;
    if (host && !document.getElementById(LOGIN_FIX_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = LOGIN_FIX_STYLE_ID;
      style.textContent = LOGIN_FIX_STYLE;
      host.appendChild(style);
    }

    if (document.body && !document.getElementById(LOGIN_BG_ID)) {
      const field = document.createElement('div');
      field.id = LOGIN_BG_ID;
      field.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(field, document.body.firstChild);
    }
  }

  /** Everyone signs in with SSO here, so the alternate route is just a second
   *  way to fail; take it out with the "or" that only introduced it. */
  function removeAlternateSignIn() {
    document.querySelectorAll('.samlSignInAnotherWayButton').forEach((button) => {
      const divider = button.previousElementSibling;
      button.remove();
      if (divider && divider.classList.contains('divider')) divider.remove();
    });
  }

  function sync() {
    removeAlternateSignIn();

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
    injectLoginFix();

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

  // Paint the boot screen before Compass (or Microsoft) paints its own shell.
  function boot() {
    injectLoginFix();
    showLoader();
  }

  if (document.documentElement) boot();
  else document.addEventListener('readystatechange', boot, { once: true });

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
