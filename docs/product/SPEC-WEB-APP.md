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
| HRT-WEB.3 | Photo sharing on web: pick from Chrome's photo picker, EXIF/GPS stripped in the browser (auto test on a GPS-tagged JPEG), a picked post survives Chrome closing mid-upload (queue in IndexedDB, resumes on next open) | 2-3 | todo (criteria WEB-APP-25..36 below) |
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

## HRT-WEB.3: photo sharing on web (PR 3)

**Bet.** An AG grandparent taps Share in Chrome, picks a photo from Chrome's photo picker, chooses a group, and the post arrives with no location in it, even if they close Chrome straight after tapping Send.

**Today (checked Nov 25, expo-image-picker 58.0.10, expo-image-manipulator 58.0.15).**
- The pipeline already runs on web: `runtime.ts` wires `prepareItem` (`app/src/media/prepare.ts`) for both the real and the Fake build. Chrome's canvas re-encode drops EXIF, then `cleanImage` + `verifyClean` (pure TS, `clean.ts`) strip again and fail closed. Sizes come from `MEDIA_POLICY` (2048 long edge, quality 0.82, thumb ~40 KB, max 48 KB), the same as phones. No web test proves any of this on a GPS-tagged JPEG yet.
- **The queue does not survive Chrome closing.** The job list persists (localStorage via `webKV`, `hearth.uploadQueue.v1`), but each item's `uri` is a `blob:` URL (the web picker calls `URL.createObjectURL`), which dies with the page. On the next open `readBytes` fetch fails with a TypeError, `toApiError` calls it `NETWORK`, and the job retries forever as "Sending…" (B-WEB3-1, P1: a stuck post, A1). Grants aren't persisted, so a job past `signing` restarts and hits the same dead URL.
- Video is **not** off on web: with `video_posting` on, `pickPhotos` offers videos on web and `e2e-web/video.spec.js` (VID-18) posts one on the Fake build.

**Change.** On web only, `enqueue` prepares each photo before it returns (so the cleaned display + thumb bytes exist before the job is saved), stores those **cleaned** bytes in IndexedDB keyed by job and item, and the job's item points at that store instead of the `blob:` URL. The original (with GPS) never touches disk. Stored bytes are sealed with the HRT-WEB.1 non-extractable key and deleted when the job publishes, is removed, or the person signs out. Phones are unchanged (`file://` URIs already survive).

### Acceptance criteria

| ID | Given / When / Then | Type |
|---|---|---|
| WEB-APP-25 | Given the web build signed in, when Share is tapped and "Pick photos" chosen, then Chrome's file chooser opens with `accept` images only (no video types), multiple allowed, up to 10 | auto (e2e:web, `filechooser`) |
| WEB-APP-26 | Given a JPEG fixture with GPS lat/long, MakerNote, camera serial and XMP, when it is picked and sent through the real web pipeline (`prepareItem`, Fake build), then the display and thumb bytes handed to `encrypt` contain no APP1 Exif/GPS, no XMP and no MakerNote (`verifyClean` passes, and a direct byte search for the GPS IFD tag and the fixture's lat string finds nothing) | auto (e2e:web; jest for the byte check if the hook is easier) |
| WEB-APP-27 | Given that photo, when the post is published, then the spec sent to sign-media says `exif_stripped: true`, `mime_type: image/jpeg`, display long edge ≤ 2048, thumb ≤ 48 KB, matching SPEC-MEDIA 1.2 (`MEDIA_POLICY`, no web-only numbers) | auto (e2e:web) |
| WEB-APP-28 | Given a JPEG with EXIF orientation 6 (rotated), when it is shared on web, then the published display and thumb are upright (width/height swapped vs the raw pixels) | auto (e2e:web) |
| WEB-APP-29 | Given a picked post on web, when it is queued, then no original bytes and no GPS appear in localStorage or IndexedDB; IndexedDB holds only cleaned, sealed bytes; localStorage holds only the job JSON (no `blob:` or `data:` URI, no bytes) | auto (e2e:web reads both stores) |
| WEB-APP-30 | Given a post queued on web, when the page is closed before the upload finishes (Playwright: block the B2 PUT, close the page, open a new page in the same context, unblock), then the post publishes once (one post, same `client_id`), with no second pick | auto (e2e:web) |
| WEB-APP-31 | Given the B-WEB3-1 case (a saved job whose item bytes are gone: cleared site data, an old `blob:` job from before this PR), when Hearth opens, then the job ends as failed with a plain retry/remove choice, not "Sending…" forever, and sends one code-only error report | auto (jest on `UploadQueue` + web store) |
| WEB-APP-32 | Given a published or removed job, or sign-out, then its IndexedDB bytes are deleted (sign-out removes all of them, with WEB-APP-6's wipe) | auto (jest + e2e:web) |
| WEB-APP-33 | Given IndexedDB is blocked (private window, HARD-7), when a photo is shared, then it still sends while the page stays open, nothing is written in plain text, and the Share screen says once that closing Chrome before it finishes will stop it (grandparent-ux words) | auto (jest) |
| WEB-APP-34 | Given the real-backend web build with `video_posting` on, when Share or bulk pick opens, then no video is offered and a video file chosen anyway is skipped with the bulk "videos skipped" line; sign-media still refuses video (FLAG-4) | auto (e2e:web + jest on `pickPhotos` web) |
| WEB-APP-35 | Given an Android phone in Chrome (AG tester or Chase), when a photo taken with location on is shared to a group, then the recipient's saved copy shows no location in any EXIF viewer | manual (real phone) |
| WEB-APP-36 | Given the same phone, when Chrome is swiped closed right after Send and reopened from the home-screen icon 1 minute later, then the post publishes with no help; also with a HEIC/HEIF photo (Samsung): it sends or shows a plain "can't send this one" line, never a stuck job | manual (real phone) |

**Done when:** WEB-APP-25..34 green 3x with all suites; WEB-APP-35, 36 logged on a real Android phone before a grandparent shares from web. Rule 6: this stores photo bytes in the browser, so `docs/architecture/03-encryption-and-keys.md` (web row) and the data-flow doc get the IndexedDB queue store and "Last checked" in this PR.

**Needs other lanes first.**
- **architect:** the IndexedDB byte store (raw `indexedDB` vs a small wrapper; no new dependency preferred; `fake-indexeddb` for jest only if qa-tdd needs it), size cap (bulk 100 photos ≈ 50 MB cleaned), and moving prepare to enqueue time on web only.
- **privacy-security:** cleaned photo bytes at rest in the browser profile (sealed with the WEB.1 key, same limits as PRIV-WEB-R3), deletion on publish/sign-out, and a check that no `blob:` URL or byte ever reaches a log or error report.
- **grandparent-ux:** the WEB-APP-31 failed-job words and the WEB-APP-33 one-line warning.
- **Video conflict:** VID-18 (`e2e-web/video.spec.js`) posts video on the Fake web build. Recommendation: WEB-APP-34 applies to the real-backend web build only; the Fake/demo build keeps VID-18 so the showcase still shows video. Chase can overrule.

**Architect call (Nov 25).** OK with changes; no new dependency (raw `indexedDB`, same pattern as `indexedDbKeyStore`).
- **Store:** a separate database `hearth.uploads` (v1, one object store `items`, key `<stageId>/<index>`, a fresh id per staged post, since the queue makes the job id inside `enqueue`), not a v2 of `hearth.session`: bumping that DB's version would race the key store's `open(DB, 1)` and risk the WEB.1 key. One record per photo: `{ v: 1, spec, display, thumb }`, each a sealed `Uint8Array` (no base64). New module `app/src/platform/uploadStore.web.ts` (no-op `uploadStore.ts` on phones), with its IDB handle injected like `SessionKeyStore`, so jest uses a Map fake and `fake-indexeddb` stays out; real IndexedDB is covered by e2e:web (WEB-APP-29/30/32).
- **Key:** one key owner. `secureSession.web.ts` gains `sealBytes(name, bytes)` / `openBytes(name, sealed)` on the same key, serial chain and memory-mode switch, with `name` (`q.<stageId>/<index>/display|thumb|spec`) as additional data. The upload store never reads or makes a key itself (ARCH-WEB-R1).
- **Queue seam:** keep `UploadQueue` platform-blind. Web staging runs before `enqueue`/`enqueueBatch`: prepare, seal, put, then set the item `uri` to `hearth-q:<stageId>/<index>`; the web `prepare` dep opens that record (and re-runs `verifyClean` on the bytes) instead of re-preparing. Bulk stages post by post and saves each job only after all its items are stored, with a "Getting photos ready… 12 of 48" line (grandparent-ux words); a close mid-staging loses only posts never shown as sending. The queue gains one optional dep, `release(job)`, called on publish and `remove`.
- **Cap:** 150 MB of sealed bytes in `hearth.uploads` (a full 100-photo bulk ≈ 50 MB, with room for a second). Over the cap, or on `QuotaExceededError`, or when IndexedDB/WebCrypto is blocked, that post goes memory-only (WEB-APP-33 path and its one-line warning); sharing is never refused for storage. One code-only error report `upload_store_full` / `upload_store_blocked`, no sizes or names.
- **Deletion:** `release` on publish/remove; sign-out calls `deleteDatabase('hearth.uploads')` beside WEB-APP-6's wipe (the key going makes any leftover unreadable anyway). On queue load, sweep records no saved job's item `uri` points at (a crash between put and save) and fail any job still pointing at `blob:` or a missing record (WEB-APP-31).
- **Video:** agreed: WEB-APP-34 gates on the real backend (`runtime.ts` build kind), not on `Platform.OS`, so the Fake/demo web build keeps VID-18. Fake-build videos stay `blob:` and memory-only (they won't survive a close; fine for the demo).

Findings: **ARCH-WEB-R1 (P1)** one sealing key owner; the upload store must not call `keys.get()/put()` itself, or sign-out and a first write can make two keys. **ARCH-WEB-R2 (P1)** A3 doc drift: `platform/mediaStore.web.ts` and `03-encryption-and-keys.md` say the web build keeps no photo files; this PR adds a short-lived, sealed, cleaned-only exception and must say so in both (Rule 6). **ARCH-WEB-R3 (P2)** no `fake-indexeddb` devDependency; inject the store. **ARCH-WEB-R4 (P2)** the orphan sweep and the `blob:` fail-fast run before the first `kick()` after load, so a dead job never shows "Sending…".

**Lanes:** architect → qa-tdd red (WEB-APP-25..34) → engineer → qa-tdd green 3x → privacy-security → grandparent-ux. Minor, not in scope: the web manipulator's `blob:` URLs are never revoked (memory only, P2, TRACKER if it shows up in perf).

## Not doing (now)

- Chrome web push: after the beta; email covers notices (HRT-WEB.4).
- Video on web: off, as today.
- A custom domain: waits for "Name final: yes" (`ACCOUNTS.md`).
- Native Android build: still ANCHORS milestone 5; the web app is the bridge, not a replacement.
- Offline browsing of photos on web: the web build keeps no photo files (architecture 03); not on the critical path.
