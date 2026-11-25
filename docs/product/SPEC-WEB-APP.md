# Spec: Hearth web app for Android Chrome

Status: Chase's go, Nov 24, 2026 (DEC-88) · Owner: staff-pm · Persona check: `decisions/2026-11-24-web-app.md` · TRACKER R92, R93

## The bet

Two Android grandparents (AG: Grandaddy, Pawpaw) use Hearth before any native Android build exists. They open a link in Chrome, sign in once with the 6-digit email code, add Hearth to the home screen, and from then on it opens like an app, still signed in. Hearth runs on web, iPhone and Android; the native path does not change.

Proof: both AG testers open Hearth from the home screen on 3 separate days without signing in again and without a help call (GOALS signal: help calls). Stop condition: if a tester is signed out twice in a week, or Chrome loses a picked photo, stop adding web scope and fix that first.

Cost $0: the real-backend web build already lives on Expo's free hosting (the expo.app link in `HANDOFF.md`, "Don't link publicly"); no domain until the name is final (`ACCOUNTS.md`).

## Milestone HRT-WEB: web app on Android Chrome

| ID | Task (one PR each, in this order) | Size | Status |
|---|---|---|---|
| HRT-WEB.1 | Staying signed in on the web (below, WEB-APP-1..12) | 1-2 sessions | todo |
| HRT-WEB.2 | Add to home screen: web manifest (name, icons 192/512 + maskable, `display: standalone`, theme color), opens on Gallery; Android-size screen checks (360x800 and 412x915) for every tab in Playwright, no sideways scroll, 48pt targets | 1-2 | todo (criteria WEB-APP-13..24 below) |
| HRT-WEB.3 | Photo sharing on web: pick from Chrome's photo picker, EXIF/GPS stripped in the browser (auto test on a GPS-tagged JPEG), a picked post survives Chrome closing mid-upload (queue in IndexedDB, resumes on next open) | 2-3 | todo |
| HRT-WEB.4 | Notices: email for the beta (already built; check a web-only person gets it). Chrome web push later, after the beta | 1 | todo |
| HRT-WEB.5 | Save to my phone = browser download of the full photo; video stays off on web | 1 | todo |

Each later task gets its own WEB-APP criteria, written by staff-pm before its PR starts.

## HRT-WEB.1: staying signed in on the web (PR 1)

**Today.** `app/src/platform/secureSession.web.ts` is one line: the Supabase session sits as plain text in `localStorage` (memory only when the browser blocks storage, HARD-7, `webStorage.ts`). It says "Web is a test harness only". The same module also backs the messenger store; web keeps no media item keys (`mediaStore.web.ts`). `expo-secure-store` has no web support. Sign-out calls `client.auth.signOut()`, which can keep the local session when the network call fails (offline).

**Change.** On web only, `secureSessionStorage` uses the same pattern as native: each value is AES-256-GCM sealed (WebCrypto `crypto.subtle`), stored in `localStorage`; the key is a **non-extractable** `CryptoKey` kept in IndexedDB (the browser's nearest thing to the Keychain: page script can use it but can't read its bytes out, so a copy of localStorage alone can't be opened). Supabase keeps refresh tokens; nothing about the backend changes. The key store is injected so jest can use a memory one; real IndexedDB is covered by Playwright.

**Not claimed.** A script running inside the Hearth page (XSS, a bad extension) can still use the key; no browser storage stops that. Nor does it protect against a copy of the whole browser profile or malware on the computer: those get the IndexedDB key and the sealed values together (PRIV-WEB-R3). The architecture doc says so in plain words.

### Acceptance criteria

| ID | Given / When / Then | Type |
|---|---|---|
| WEB-APP-1 | Given a person signed in on web, when the page reloads, then they land on Gallery signed in, with no sign-in screen | auto (e2e:web) |
| WEB-APP-2 | Given a person signed in on web, when the tab is closed and Hearth is opened again from a new tab, then they are still signed in | auto (e2e:web, new page in same context) |
| WEB-APP-3 | Given a session stored on web, when `localStorage` is read directly, then no access token, refresh token, email or user id appears in plain text; the stored value is nonce + ciphertext only | auto (jest) |
| WEB-APP-4 | Given a stored session, when the sealing key is created, then it is a non-extractable AES-GCM `CryptoKey` (`extractable === false`) held in IndexedDB, never in `localStorage` | auto (jest) |
| WEB-APP-5 | Given a person who was signed in under the old plain-text web storage, when they open the new build, then they stay signed in, the value is re-stored sealed, and the plain-text copy is gone | auto (jest) |
| WEB-APP-6 | Given a signed-in person, when they sign out, then the sealed session, the messenger store and the IndexedDB key are all removed, and a reload shows the sign-in screen | auto (jest + e2e:web) |
| WEB-APP-7 | Given a signed-in person who is offline, when they sign out, then the local session is still removed and a reload shows the sign-in screen (only the 1-hour access token expires on its own; the refresh session stays open on the server until it is revoked, PRIV-WEB-R4, TRACKER R94) | auto (jest) |
| WEB-APP-8 | Given a browser that blocks IndexedDB or WebCrypto (private window, strict settings), when a person signs in, then Hearth works for that visit from memory, writes nothing in plain text, and does not crash (HARD-7 behaviour kept) | auto (jest) |
| WEB-APP-9 | Given a sealed value that won't open (key gone, value tampered), when Hearth starts, then it treats the person as signed out and clears the leftovers; no error screen | auto (jest) |
| WEB-APP-10 | Given the iPhone or Android native build, when this PR lands, then `secureSession.ts` is unchanged and its existing tests pass (Keychain/Keystore key, AsyncStorage blob) | auto (jest; diff shows no native change) |
| WEB-APP-11 | Given two Hearth tabs open, when one refreshes the session token, then the other stays signed in after its next reload | manual (Android Chrome) |
| WEB-APP-12 | Given an AG tester on their own Android phone in Chrome, when they sign in once and then reopen Hearth after closing Chrome, after restarting the phone, and the next day, then they are signed in each time with no help | manual (real phone) |

Also in PR 1 (done-when, not criteria): request `navigator.storage.persist()` after sign-in so Chrome is less likely to clear Hearth's storage; replace the "test harness only" comment; update `docs/architecture/03-encryption-and-keys.md` (web session line, "Last checked" footer) per rule 6.

**Done when:** WEB-APP-1..10 green 3x with all suites; privacy-security reviews the key handling; WEB-APP-11 and 12 logged on a real Android phone (Chase's or a tester's) before HRT-WEB.2 ships to a grandparent.

**Lanes:** qa-tdd red (WEB-APP-1..10) → engineer → qa-tdd green 3x → privacy-security (keys, sign-out) → architect not needed unless a new dependency lands (no `fake-indexeddb` unless qa-tdd needs it; then architect first). No screen or word changes, so no grandparent-ux pass in PR 1.

## HRT-WEB.2: add to home screen and Android-size screens (PR 2)

**Bet.** An inviter puts a Hearth icon on an AG/LG relative's Android home screen at setup; tapping it opens Hearth full-screen (no Chrome address bar) on Gallery, still signed in. Every tab reads and taps right on a 360-wide budget Android.

**How the manifest gets into the export.** `app.json` web is `output: "single"`, `bundler: "metro"`; `expo export` copies `app/public/` verbatim to the export root (that is how `og-hearth.png` reaches `dist-fake/` today) and writes `index.html` from Expo's default template. So:
- `app/public/manifest.webmanifest` and `app/public/icons/*.png` ship as static files.
- The `<link rel="manifest">` and `theme-color` tags go in a custom `app/public/index.html` template (Expo's documented single-output customisation, `npx expo customize public/index.html`), keeping today's viewport meta and the root div. A post-export script like `add-site-meta.sh` is the fallback only if the template route fails a WEB-APP-13 check.
- The manifest link is root-relative to the build's base path (`href="/manifest.webmanifest"` in the app build; `scripts/build-demo.sh` rewrites it to `/demo/hearth/manifest.webmanifest` for the site build), never document-relative, so it resolves from any nested route such as `/more/easy-view` (QA-R1, P1, B31; Chase, Nov 24). Inside the manifest everything stays relative to the manifest (`start_url: "."`, `scope: "."`, `icons/...`), so the sub-path still works. No query string on `start_url` (no trackers, anchor A2/A3).
- Test harness: `app/scripts/serve-dist.js` has no `.webmanifest` type; add `application/manifest+json` (harness change, not app code).

**Service worker: none.** Chrome on Android installs from the menu without one since Chrome 108 (Chrome "Revisiting Chrome's installability criteria"); only the automatic install banner still wants a fetch handler, and the inviter uses the menu, so no banner is needed. No offline caching is promised (see Not doing). Adding a service worker later is a new architect call.

**Icons.** From the existing app icon: `icon-192.png` and `icon-512.png` from `app/assets/icon.png` (`purpose: "any"`); `icon-maskable-512.png` from `app/assets/adaptive-icon.png` on `#F7F7F4` (`purpose: "maskable"`, mark inside the central 80% safe zone). A small script makes them (like `make-og-picture.py`), committed with its outputs.

**Manifest values.** `name: "Hearth"`, `short_name: "Hearth"`, `id: "."`, `start_url: "."`, `scope: "."`, `display: "standalone"`, `orientation: "portrait"`, `background_color: "#F7F7F4"`, `theme_color: "#F7F7F4"` (Paper light, `theme.ts`); the template adds `<meta name="theme-color" content="#F7F7F4" media="(prefers-color-scheme: light)">` and `content="#131210"` for dark (Paper dark). Fruit themes don't change the browser colour (static file; not worth code).

**How the relative gets the icon (the inviter does it, persona check LG mitigation).** On the relative's phone at setup: open the Hearth link in Chrome → sign in with the 6-digit code → Chrome menu (three dots, top right) → **Add to home screen** → **Install** → tap the new Hearth icon to check. Written as one short inviter section in `docs/product/GRANDPARENT-GUIDE.md` (grandparent-ux words), not shown in the app in this PR.

### Acceptance criteria

| ID | Given / When / Then | Type |
|---|---|---|
| WEB-APP-13 | Given the web export, when `index.html` is read, then it has exactly one `<link rel="manifest">` whose href is root-relative to the build's base path (`/manifest.webmanifest` for the app build, QA-R1), a light `#F7F7F4` and a dark `#131210` `theme-color` meta, and the existing viewport meta | auto (e2e:web or jest on `dist-fake`) |
| WEB-APP-14 | Given the served manifest, when it is fetched, then it returns 200 as JSON with `name` and `short_name` "Hearth", `display` "standalone", `start_url` and `scope` "." (relative), `background_color` and `theme_color` "#F7F7F4", and no query string on `start_url` | auto (e2e:web) |
| WEB-APP-15 | Given the manifest's icons, when each is fetched, then there is a 192x192 and a 512x512 PNG with purpose `any` and a 512x512 PNG with purpose `maskable`; each returns 200 and its real pixel size matches its `sizes` | auto (e2e:web) |
| WEB-APP-16 | Given the maskable icon, when its pixels are read, then the outer 10% ring is solid `#F7F7F4` (the mark sits inside the safe zone, so Android's circle crop never cuts it) | auto (jest or script test) |
| WEB-APP-17 | Given the export served on 127.0.0.1 in Chromium, when installability is checked (CDP `Page.getInstallabilityErrors`), then the list is empty, with no service worker registered | auto (e2e:web) |
| WEB-APP-18 | Given the demo build under `HEARTH_BASE_URL`, when the manifest and icons are fetched from the sub-path, then all resolve from the sub-path root and from a nested route (`feed/`, QA-R1): the link tag is root-relative to the base path (`/demo/hearth/manifest.webmanifest`, never `/manifest.webmanifest`), and the manifest's `start_url`, `scope` and icon paths are relative | auto (e2e:demo) |
| WEB-APP-19 | Given a signed-in person (FakeApi) at 360x800 and at 412x915 (touch, mobile), when each of Gallery, Feed, Share and More is opened with Easy view on and with it off, then: page `scrollWidth` is no wider than the screen (no sideways scroll); text size follows SPEC-TYPE (amended Nov 25 for DEC-84): with Easy view on every visible text is 17px or larger; with it off every visible text is 17px or larger except the secondary words SPEC-TYPE's map lists (Gallery date group, post date, reaction count: `subheadline`), each at exactly its named style's size (15px), and nothing is ever under caption2's 11px; every button, link, tab and switch is at least 48x48; no visible text is cut (no element with hidden overflow whose `scrollWidth` exceeds its `clientWidth`, no ellipsis on labels) | auto (e2e:web, 16 runs) |
| WEB-APP-20 | Given the same two sizes, when the tab bar is shown, then all four tabs sit fully inside the screen; with Easy view on each shows its word (Gallery, Share, Feed, More) uncut; with it off each keeps its spoken name; each tab is at least 48x48 | auto (e2e:web) |
| WEB-APP-21 | Given WEB-APP-19/20 also run in dark mode at 360x800, then the same checks pass, with the same SPEC-TYPE text-size rule (dark Paper can't hide a clipped label) | auto (e2e:web) |
| WEB-APP-22 | Given an Android phone in Chrome, when the inviter follows the guide steps (menu → Add to home screen → Install), then a Hearth icon with the Hearth mark (not a letter tile, not cropped) appears, named "Hearth" | manual (real phone) |
| WEB-APP-23 | Given that icon, when it is tapped, then Hearth opens with no Chrome address bar, a Paper-coloured status bar, on Gallery and signed in (WEB-APP-12 session); signed out, it opens on sign-in | manual (real phone) |
| WEB-APP-24 | Given the inviter's section in `GRANDPARENT-GUIDE.md`, when an inviter who has never done it follows it on a relative's Android phone, then the icon is on the home screen within 2 minutes with no call to Chase | manual (person) |

**Done when:** WEB-APP-13..21 green 3x with all suites; WEB-APP-22, 23 logged on a real Android phone; WEB-APP-24 logged at the first AG setup (it rides with WEB-APP-12). Rule 6: no data storage change, so no architecture doc update unless a service worker is added.

**Lanes:** qa-tdd red (WEB-APP-13..21) → engineer (manifest, icons script, `public/index.html`, serve-dist type) → qa-tdd green 3x → grandparent-ux (guide words, icon look, WEB-APP-19/20 failures it finds) → privacy-security light pass (no new origins, no tracking params, no service worker). Architect not needed: no new dependency (icon script uses Pillow like `make-og-picture.py`). Existing screens that fail WEB-APP-19/20 get their own finding IDs and failing tests; fixes stay inside this PR only if each is a style change, otherwise a TRACKER row.

## Not doing (now)

- Chrome web push: after the beta; email covers notices (HRT-WEB.4).
- Video on web: off, as today.
- A custom domain: waits for "Name final: yes" (`ACCOUNTS.md`).
- Native Android build: still ANCHORS milestone 5; the web app is the bridge, not a replacement.
- Offline browsing of photos on web: the web build keeps no photo files (architecture 03); not on the critical path.
