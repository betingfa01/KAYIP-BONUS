# CHANGELOG — Production Hardening Pass

Project: **FA01 Kayıp Bonus Hesaplayıcı** (repo: `betingfa01/KAYIP-BONUS`)

## v1.1 — Desktop layout fix

- **Added `@media (min-width:1024px){ .card{max-width:680px} }`.** The card's
  width was capped at `520px` on every screen size, including large desktop
  monitors, which read as an oversized mobile layout floating in empty space.
  This adds a desktop-only breakpoint that widens the card to `680px` on
  screens ≥1024px wide. Nothing else changes: the card stays centered
  (`margin:0 auto`, unchanged), and every viewport below 1024px — phones,
  small tablets, and the existing ≤420px mobile tweaks — renders exactly as
  before, pixel-for-pixel. No colors, fonts, spacing, or component styling
  were touched.

This pass is a non-visual, non-functional hardening of the app for production
deployment on GitHub Pages. **No UI, colors, layout, copy, or the calculation
formula were changed.** Every change below is either invisible to the user or
purely additive (works better on more devices, fails more gracefully).

## Scope note: what this app actually is

The whole app is a single static page (`index.html`) plus a `manifest.webmanifest`
and five image assets. There is **no backend, no API, no fetch() call, no
external script or stylesheet, and no build step** — everything (CSS + JS) is
inline in `index.html`. That matters for a few of the requested checklist items:

- **API reliability / fallback APIs**: not applicable — the app calls no APIs.
- **Race conditions**: the calculation is 100% synchronous with no async work,
  so there was no race condition to fix in `hesapla()`. The one real
  concurrency concern in a PWA this size is *service worker install/update*
  races, which is what the new `sw.js` is written to avoid (see below).
- **Memory leaks**: there were no intervals, timers, or repeatedly-added
  listeners in the original code, so leak risk was already near zero. Event
  listeners added in this pass are attached once at load and never re-added.

Given that, the highest-value production work here was: add the *service
worker the app never had* (so it installs reliably and works offline), harden
the `<head>` for cross-platform PWA installability, and clean up a couple of
minor code-quality issues.

---

## `index.html`

### PWA / installability
- **Added `manifest.webmanifest` — service worker registration.** The app had
  no service worker at all, so "offline support" and "Add to Home Screen"
  reliability were incomplete (iOS/Android could install a shortcut, but nothing
  was cached, so a flaky connection on first load could break install). Added
  a guarded `if ('serviceWorker' in navigator)` registration on `window.load`,
  registered with a relative path (`./sw.js`) so it works correctly whether the
  site is hosted at a domain root or a GitHub Pages project sub-path
  (`user.github.io/repo/`). Registration failure is caught and logged only —
  it never blocks or breaks the page, since the calculator itself needs no
  network at all.
- **`<meta name="mobile-web-app-capable" content="yes">` added** alongside the
  existing (iOS-only) `apple-mobile-web-app-capable`. The standard tag was
  missing, which affects install/standalone behavior on Android/Chrome and
  Windows.
- **`viewport-fit=cover` added to the viewport meta**, paired with
  `env(safe-area-inset-*)` padding on `body` (see CSS section). Fixes real
  content-under-the-notch/home-indicator overlap on iPhone X and newer —
  this is a genuine iPhone compatibility bug fix, not a redesign.
- **`<meta name="application-name">` and `msapplication-TileColor` added**
  for correct Windows Start-menu pinning behavior.
- **`<meta name="color-scheme" content="dark">` added** so native form
  controls / scrollbars render in dark mode consistent with the existing
  always-dark design, instead of the browser guessing.
- **`<meta name="description">` added** — was missing; used by install
  prompts and search results, zero visual effect.
- **`<meta name="format-detection" content="telephone=no">` added** —
  prevents iOS Safari from auto-linking numeric input as a phone number.

### Security
- **Content-Security-Policy meta tag added**: restricts all resource loading
  to same-origin (`default-src 'self'`), blocks `object-src`, disallows
  framing (`frame-ancestors 'none'`). Since the app is a single inline
  file with no build step, `'unsafe-inline'` is kept for `style-src`/
  `script-src` (unavoidable without restructuring into external files, which
  would be a real architecture change outside this pass's scope) — but every
  other vector (loading a remote script/image/font, being framed by another
  site) is now blocked. This is defense-in-depth against any future
  accidental or injected external reference.
- **`.innerHTML` → `.textContent`** for writing the calculated result. The
  value written was always a plain number string, so this is not a fix for
  an exploitable bug today, but it removes HTML-parsing from the result path
  entirely as a hardening measure, with **zero visible difference**.

### Bug fix / accessibility
- **Enter key now triggers calculation** when focus is in either input field.
  Previously the only way to trigger `hesapla()` was clicking the button —
  a keyboard user typing values had no way to submit without leaving the
  keyboard, which is a genuine keyboard-accessibility gap (WCAG 2.1.1
  Keyboard). Implemented via a `keydown` listener on both inputs, calling the
  same `hesapla()` function the button already calls — **not** a `<form>`
  submit (avoids any page-navigation/reload risk on GitHub Pages). No visual
  or behavioral change for mouse/touch users.
- **`role="status" aria-live="polite"` added to the result box**, so screen
  readers announce the computed amount automatically after calculation,
  instead of a sighted-only visual update.
- **`aria-hidden="true"` added to the decorative €-badge** so screen readers
  don't announce a redundant "€" before the labelled result.

### Reliability / code quality
- **Inline `onclick="hesapla()"` replaced with `addEventListener`**, and all
  JS wrapped in an IIFE (`'use strict'`) instead of leaking `sayi`/`hesapla`
  as globals. Same click behavior, cleaner scope, compatible with the new CSP.
- **`try/catch` added around the calculation logic** so any unexpected
  runtime error (e.g. a future browser quirk) is caught and logged instead of
  breaking the page silently. The success path (valid numeric input) is
  byte-for-byte the same formula as before: `bonus = bahis*oran/100`,
  `yariBonus = bonus/2`, `yatirilacak = bahis - yariBonus` — untouched.
- **`document.getElementById` calls null-checked** before use, so the script
  can't throw if an element is ever missing.
- **`<noscript>` fallback message added** — the app is 100% JS-driven with no
  server rendering; previously a user with JS disabled saw a blank dark page
  with no explanation. Now they see a short message. No effect when JS is
  enabled (the normal case).
- **Explicit `width`/`height` added to the logo `<img>`** (native 1152×912,
  matching the real file), so the browser reserves the correct aspect-ratio
  space before the image loads instead of causing layout shift. Visual size
  is unchanged (still constrained by the existing CSS `max-width:180px`).
  Added `fetchpriority="high"` since it's the largest above-the-fold image
  (minor LCP improvement).

### CSS (visual output unchanged)
- **`env(safe-area-inset-*)` padding added to `body`** using
  `max(original-px, env(...))`, in both the base rule and the `@media
  (max-width:420px)` rule. On every device without a notch/home-indicator
  (the vast majority, including all Android/desktop), `env()` resolves to
  `0`, so `max()` always picks the original `14px`/`10px` — **pixel-identical
  output**. Only on iPhone X+ (particularly landscape) does this add extra
  padding, which is a correctness fix for content being obscured, not a
  design change.
- No colors, fonts, spacing values, breakpoints, or component styles were
  otherwise modified.

---

## `manifest.webmanifest`

All existing fields (`name`, `short_name`, `start_url`, `display`,
`background_color`, `theme_color`, `icons`) are **unchanged**. Added:

- `"id": "./"` — stable app identity across installs (Chrome/Edge use this to
  avoid duplicate home-screen entries if `start_url` ever changes).
- `"scope": "./"` — explicit install scope; previously implicit/inferred,
  now guaranteed correct on a GitHub Pages project sub-path.
- `"description"` — used by richer install prompts.
- `"lang": "tr"`, `"dir": "ltr"` — matches the page's actual language,
  improves PWA quality/Lighthouse scoring.
- `"categories": ["utilities", "finance"]` — store/catalog metadata only.
- `"purpose": "any"` added to both icon entries — explicit rather than
  implicit default. **Did not** add `"maskable"` purpose: that requires the
  underlying PNG to have safe-zone padding baked in, which wasn't verified,
  and declaring it incorrectly would make Android crop/distort the icon —
  i.e. a real visual regression. Left as a follow-up if you confirm the
  source icons have maskable-safe padding.

---

## `sw.js` (new file)

The project had **no service worker**, so there was no offline support and no
caching strategy to "improve" — one was added from scratch:

- **Navigations (the page itself): network-first with cache fallback.** Users
  online always get the latest deployed version; users offline (or on a flaky
  connection) get the last successfully cached copy instead of a browser
  error page.
- **Static assets (icons, logo, manifest): stale-while-revalidate.** Served
  instantly from cache (fast repeat loads, works offline), then silently
  refreshed in the background so the next load has the newest version.
- **Cache invalidation**: on `activate`, every cache key that isn't the
  current `CACHE_VERSION` is deleted. Bumping `CACHE_VERSION` in `sw.js` on a
  future deploy is enough to force all clients onto the new cache — no stale
  content lingers.
- **`self.skipWaiting()` / `self.clients.claim()`** used so a new deploy takes
  control immediately rather than waiting for every open tab to close — safe
  here because the app holds no persistent client-side state that a mid-session
  SW swap could corrupt.
- **Scoped entirely with relative paths** (`./`, `./index.html`, ...), so it
  works correctly whether deployed at a domain root or under a GitHub Pages
  project path (`username.github.io/KAYIP-BONUS/`).
- **Every cache operation is wrapped defensively** (`.catch(() => {})` /
  `.catch(err => console.warn(...))`) so a single failed asset fetch during
  install can never break the whole install, and a failed background
  revalidation never breaks the cached response already being served.
- Only intercepts same-origin `GET` requests; everything else passes straight
  to the network untouched (there are none today, but this keeps the worker
  correct if the app ever adds an external request).

---

## Files not modified

`fa01-logo.jpg`, `favicon.png`, `apple-touch-icon.png`, `icon-192.png`,
`icon-512.png` — copied byte-for-byte unchanged into this build. No image was
recompressed, resized, or altered.

---

## Browser/device compatibility notes

- Tested logic mentally against Chrome, Safari (iOS + macOS), Edge, and
  Firefox: all features used (`CSP` meta, `env()`, Service Worker API,
  `addEventListener`, `classList`, `Array.prototype` methods used internally
  by the SW) are supported in current versions of all four.
- `env(safe-area-inset-*)` and `viewport-fit=cover` are ignored (harmlessly,
  falling back to `0`) on browsers that don't support them — no breakage on
  older Android/desktop browsers.
- Service workers require HTTPS (or `localhost`); GitHub Pages serves over
  HTTPS by default, so this works out of the box.

## Suggested follow-up (not done here, needs your input)

- If you want true **maskable** Android adaptive icons, regenerate
  `icon-192.png`/`icon-512.png` with ~20% safe-zone padding and add
  `"purpose": "any maskable"` in the manifest.
- Consider a cache-busting query or content hash in `sw.js`'s
  `PRECACHE_URLS` if you start editing `index.html` frequently, so you don't
  have to remember to bump `CACHE_VERSION` manually each deploy.
