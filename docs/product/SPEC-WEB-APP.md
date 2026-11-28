# Spec: Hearth web app for Android Chrome

Status: Chase's go, Nov 24, 2026 (DEC-88) · Owner: staff-pm · Persona check: `decisions/2026-11-24-web-app.md` · TRACKER R92, R93

## The bet

Some Android grandparents (AG) use Hearth before any native Android build exists. They open a link in Chrome, sign in once with the 6-digit email code, add Hearth to the home screen, and from then on it opens like an app, still signed in. Hearth runs on web, iPhone and Android; the native path does not change.

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

### Words (grandparent-ux)

Exact words, all 17pt+ (Body, Easy view or not), buttons 48pt+, "Chrome" only on web (phones keep "Hearth"). Reviewed as Grandaddy on an old Android; reading the screen, not guessing: confirm with a relative in UAT.

| Where | Exact words | Rule |
|---|---|---|
| WEB-APP-33 warning, once on Share while a post is sending and the browser can't keep it (muted, under the headline, not red) | `Keep Chrome open until this is sent. Closing Chrome now would stop it.` | One element; regex-safe: it matches `/clos\w+ (Chrome\|this page\|the app)[^.]*(stop\|finish\|before)/i` exactly once ("Closing Chrome now would stop"), so the provisional e2e regex can stay as is. Shown only for memory-only posts. Plain, no "storage", "IndexedDB", "private window". |
| WEB-APP-31 failed job (saved photo gone) | Headline `Didn't send` (keep: it matches phones and the test). Body: `This photo is no longer on this phone, so we can't send it. Go to Share to pick it again.` Button: `Remove this from the list` (visible text `Remove`) | One clear choice. Do not show "Try again" for this case: retrying a missing photo can only fail again. Other failed jobs keep Try again + Remove. (`webQueue.test.ts` header says "Try again / Remove": change it to Remove only for the missing-bytes case.) Never blame the person; no code shown. |
| Bulk staging (WEB-APP-30/enqueue prepare, before the batch is saved) | `Getting 12 of 48 photos ready…` (one photo: `Getting your photo ready…`). Screen reader says the same, polite live region. | Same shape as `Sending 12 of 48 photos…`; uses the real numbers; "photo" not "item"/"asset". |
| "Waiting to send" second line, web, photo saved safely | `We'll keep trying. You can close Chrome. It will finish when you open Hearth again.` | Replaces "You can close Hearth" on web (true only because the bytes are saved, WEB-APP-30). |
| Same line, web, memory-only (blocked/over cap) | `We'll keep trying while Chrome stays open. Closing Chrome now would stop it.` | The web-true version when nothing is saved; never promise "close". Headline stays `Waiting to send`. |

Acceptance (qa-tdd): UX-WEB3-1 the line shows exactly once and only for memory-only posts; UX-WEB3-2 the failed missing-photo job shows Remove and no Try again; UX-WEB3-3 no web string says "Hearth" where it means closing the browser tab; UX-WEB3-4 all of these render at 17pt+ and 200% font scale without clipping (360x740).

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

## HRT-WEB.4: notices on web (PR 4)

**Bet.** An Android grandparent who signs in on Chrome hears about new photos by email, in words she can read, and can tell if it will reach her. Chrome web push stays out (after the beta).

**Today (checked Nov 28 from `notify/index.ts`, migrations 0003/0026/0034, `push.ts`, `Preferences.tsx`).**
- **Who gets an email.** `claim_notification_batches` picks the channel: push if wanted and a token exists; else `email` if push was wanted (default `true`) or a digest is chosen, and the account has an email address; else closed. So a web-only email account with default prefs already falls back to the **evening email** (once, from 6 pm Eastern; the sender runs every minute). Covered for the fallback by the SQL tests (BETA-NOTIFY-5, "push wanted but no phone registered"). A phone-sign-in (text) account has no email and gets **nothing** on web (BETA-SMS-13); Preferences hides the email choices for it, so on web it is told "tells you on this phone", which is false there.
- **Words are fine.** `summary()` gives the same plain line for push and email: "From Gammy on Hearth", counts, kinds, never a caption or child's name; tests: BETA-NOTIFY-2/5/7, NOTIFY-K-1..5. HTML is 20px, no image.
- **Gap 1, the link.** The email has no link unless `APP_LINK_BASE` is set, and then it is `<base>/p/<post id>`. The app has no `/p/` route and `APP_LINK_BASE` is empty (`.env.example`), so today the email says "Open Hearth on your phone", which a web-only person has no icon to follow. Needs the web URL as base and a deep link that opens the post after sign-in.
- **Gap 2, the Notices screen on web.** `pushStatus()` returns `off` on web, so the "Turn on notices" card never shows (fine), but `Preferences` still offers "A sound on your phone when there are new photos (Recommended)" and its saved line, which are untrue on web. Choosing it still sends email (fallback), by accident.
- **Gap 3, no opt-out in the email.** No unsubscribe line, no way to stop except in the app. A grandparent who only has the email cannot stop it (A1/A2).
- **Gap 4, no proof the address works.** Sign-in by 6-digit code proves she can read that inbox once; nothing tells her which address gets notices or that one arrived.
- **No migration needed** for any of this: prefs, channel fallback and the email address already exist. A migration only if Chase wants the 10-minute immediate email (the email is evening/Sunday only today); recommend not now (A1: one calm email a day).

**Change (small, reuse).** (a) On web, the notice choices say email, with "Every evening" as the recommended default; the sound choice is hidden. (b) Emails get one plain "Stop these emails" line that opens the web Preferences page (no token link; she is signed in on the home-screen icon). (c) `APP_LINK_BASE` set to the web URL and the app opens `/p/<id>` to that post after sign-in. (d) A "Send me a test email" button on the notices choice, using the existing sender, one email to her own address, rate-limited, no post content. (e) Phone-sign-in accounts on web see a plain note that notices need an email address, with a way to add one only if it is already in the app; otherwise log as not supported.

### Acceptance criteria

| ID | Given / When / Then | Type |
|---|---|---|
| WEB-APP-37 | Given an email account with default prefs and no push token (web-only), when a post is shared to her group, then the outbox claim at 6 pm Eastern returns one `email` batch to her address and no push batch; nothing earlier than 6 pm | auto (backend SQL; existing BETA-NOTIFY-5 case plus an explicit web-only account) |
| WEB-APP-38 | Given a text-sign-in account (no email) with no token, when a post is shared, then no batch is returned and the notice is closed, not retried forever | auto (SQL; BETA-SMS-13 exists, add the web-only wording) |
| WEB-APP-39 | Given the web build, when the notice choices show, then the sound choice is absent, "An email every evening" is selected by default and says Recommended, "Every Sunday morning" is offered, and no string says "sound" or "on your phone" | auto (jest on `Preferences` with `Platform.OS = 'web'`; e2e:web) |
| WEB-APP-40 | Given the web build and a saved choice, when it saves, then the server prefs are `push: false` plus `daily` or `weekly` (not `push: true`), and the saved line names email | auto (jest, `serverPrefs` web path; `notifySync`) |
| WEB-APP-41 | Given the sender with `APP_LINK_BASE` set, when an email is built for a post, then text and HTML carry one link `<base>/p/<id>` with the words "Open Hearth to see it", and no post words or photo | auto (Deno, extends BETA-NOTIFY-5) |
| WEB-APP-42 | Given a signed-in web session, when `/p/<id>` is opened, then that post shows; signed out, then after the 6-digit sign-in it opens that post; a post she can't see shows "not found" (privacy rule 2) | auto (e2e:web) |
| WEB-APP-43 | Given any notice email, when it is built, then it ends with one line "Don't want these emails? Open Hearth, tap More, then Notices." plus the plain words (not a tracking link), and the sender logs no address (existing privacy test still passes) | auto (Deno) |
| WEB-APP-44 | Given the test-email button, when pressed, then one email "A test from Hearth" goes to her own address only, a second press inside 5 minutes says "Sent already, check your email", and the run reports counts only | auto (Deno + jest; needs a tiny authenticated route in `notify`, architect to confirm it is not a new vendor or migration) |
| WEB-APP-45 | Given a phone-sign-in account on web, when notices are opened, then it says in one line that notices need an email address and shows no broken choice | auto (jest) |
| WEB-APP-46 | Given a real Android phone in Chrome with an email account, when a sibling posts, then the evening email lands in the inbox (not spam), reads clearly at default text size, and its link opens the post in the home-screen app or Chrome | manual (real phone) |
| WEB-APP-47 | Given the same phone, when "Send me a test email" is tapped, then the email arrives within 2 minutes and the person says in her own words that she knows it worked (no help) | manual (real phone, AG tester) |
| WEB-APP-48 | Given Gmail, Yahoo and AOL addresses (grandparent reality), when a notice is sent from the Resend domain, then it is delivered to inbox or the tester is told where to look; SPF/DKIM pass in the headers | manual (3 inboxes; ties to the unfinished domain, ACCOUNTS.md) |

**Done when:** WEB-APP-37..45 green 3x with all suites; 46..48 logged on a real phone and three inboxes before a grandparent relies on email for notices. Rule 6: no new data stored; update the notices row in `docs/architecture/` "Last checked" only if the link base or test route changes data flow (it does not log or store anything new).

### Words (grandparent-ux)

| Where | Words | Why |
|---|---|---|
| Notices, web, choice 1 (default) | `An email every evening with the day's new photos (Recommended)` | Same words as phones, now first on web. |
| Notices, web, choice 2 | `An email every Sunday morning` | Unchanged. |
| Saved, evening | `Saved. We'll email you every evening when there are new photos.` | Unchanged. |
| Which address | `We'll send it to <her address>.` under the choices | She sees where it goes (A1). |
| Test button | `Send me a test email` | Verb label. |
| Test sent | `Sent. Look in your email for "A test from Hearth". It can take a minute.` | Says what to look for. |
| Test sent already | `Already sent. Look in your email, or check your junk folder.` | Spam tip in her words. |
| Test email subject / body | `A test from Hearth` / `This is the test you asked for. If you can read this, Hearth emails reach you.` | No post words. |
| Text-sign-in on web | `You signed in with a text, so Hearth can't email you. Open Hearth on your phone to hear about new photos.` | True and plain; adjust if (e) is built. |
| Email footer | `Don't want these emails? Open Hearth, tap More, then Notices.` | One plain way out; no link to click. |
| Email link line | `Open Hearth to see them` | Existing. |

**Automatable vs manual.** Auto: 37..45. Manual on real hardware: 46 (Android Chrome inbox and link), 47 (AG tester confirms test email), 48 (Gmail/Yahoo/AOL delivery).

**Not doing here.** Chrome web push; instant email (needs a migration, breaks "one calm email"); an unsubscribe-by-link token (needs a migration and a public route); per-group mute.

**Needs other lanes first.** architect: the test-email route and `APP_LINK_BASE`; privacy-security: the address is shown to its owner only, no address in logs; grandparent-ux: the words above. Decisions for Chase: (1) email default for web-only people is the evening email, not instant (recommend yes); (2) set `APP_LINK_BASE` to the web URL now (recommend yes, one secret).

**Lanes:** architect → qa-tdd red (WEB-APP-37..45) → engineer → qa-tdd green 3x → privacy-security → grandparent-ux.

**Architect call (Nov 28).** Verdict: OK with changes. Rung: existing Supabase edge function plus existing Resend sender; no new vendor, no migration.
- **ARCH-WEB4-R1 (P1) test-email route lives in `notify`.** Same `POST /functions/v1/notify`, body `{"test_email":true}`. `authorized()` stays service-only for the batch run; the test branch is checked first and validates the caller by `GET ${SUPABASE_URL}/auth/v1/user` with the user's JWT (`verify_jwt` is already false, so the function does its own auth). Send to that user's auth `email` only, never an address from the body; no email (text sign-in) returns 400. One Resend call reusing `RESEND_URL`/`env`. Report counts only, log no address.
- **ARCH-WEB4-R2 (P1) rate limit without a migration.** `notification_outbox` needs a `post_id`, so it can't hold a test row. Use the auth user's `app_metadata.last_test_email_at` via the admin API (`PUT /auth/v1/admin/users/{id}`, service key already in the function): read from the `/user` response, refuse inside 5 minutes ("Sent already"), write on success. No table, no secret. A rare double tap racing is harmless (two emails to herself). Not an in-memory check (isolates reset). A migration is unavoidable only if Chase wants a per-day cap across all users; not needed.
- **ARCH-WEB4-R3 (P1) `/p/<id>` route.** `APP_LINK_BASE` alone is enough for the email (`buildEmail` already builds `<base>/p/<id>`); set it to the web origin. Reuse the existing `viewer/[postId].tsx`: add one thin `app/src/app/p/[id].tsx` that is a `<Redirect href={{pathname:'/viewer/[postId]',params:{postId:id}}}/>`, same on web and native (expo-router, so no Platform branch). Not-found and RLS stay in `ViewerScreen` (rule 2). Native universal links (`app.json` intent filter pathPrefix `/p`) stay out of the web beta.
- **ARCH-WEB4-R4 (P1) signed-out return.** `AppGate`/`goSignIn` keep no return target, so WEB-APP-42's "after sign-in it opens that post" needs a small keep-and-resume of the path (web: sessionStorage via `platform/webStorage.ts`, cleared on read). Add to the engineer's scope and to e2e:web.
- **ARCH-WEB4-R5 (P2) hosting.** The web build is `output: single`; the host must rewrite `/p/*` to `index.html` (RR-15 shows `/viewer/<id>` has no file). Confirm on the chosen host before relying on the link.
- **ARCH-WEB4-R6 (P2) deploy (waits for Chase's word).** `bash backend/scripts/deploy.sh` redeploys `notify` (nothing in the cron changes); set `APP_LINK_BASE` as a function secret (needs the web URL final, ACCOUNTS.md name rule); `RESEND_FROM` domain must be verified before WEB-APP-48. No migration, so no schema step. Update `docs/architecture/02-data-flow.md` only to add the user-JWT test route and `app_metadata` timestamp (a small stored value), with its footer.

## Not doing (now)

- Chrome web push: after the beta; email covers notices (HRT-WEB.4).
- Video on web: off, as today.
- A custom domain: waits for "Name final: yes" (`ACCOUNTS.md`).
- Native Android build: still ANCHORS milestone 5; the web app is the bridge, not a replacement.
- Offline browsing of photos on web: the web build keeps no photo files (architecture 03); not on the critical path.
