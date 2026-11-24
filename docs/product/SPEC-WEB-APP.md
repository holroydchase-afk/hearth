# Spec: Hearth web app for Android Chrome

Status: Chase's go, Nov 24, 2026 (DEC-87) · Owner: staff-pm · Persona check: `decisions/2026-11-24-web-app.md` · TRACKER R87, R88

## The bet

Two Android grandparents (AG: Grandaddy, Pawpaw) use Hearth before any native Android build exists. They open a link in Chrome, sign in once with the 6-digit email code, add Hearth to the home screen, and from then on it opens like an app, still signed in. Hearth runs on web, iPhone and Android; the native path does not change.

Proof: both AG testers open Hearth from the home screen on 3 separate days without signing in again and without a help call (GOALS signal: help calls). Stop condition: if a tester is signed out twice in a week, or Chrome loses a picked photo, stop adding web scope and fix that first.

Cost $0: the real-backend web build already lives on Expo's free hosting (the expo.app link in `HANDOFF.md`, "Don't link publicly"); no domain until the name is final (`ACCOUNTS.md`).

## Milestone HRT-WEB: web app on Android Chrome

| ID | Task (one PR each, in this order) | Size | Status |
|---|---|---|---|
| HRT-WEB.1 | Staying signed in on the web (below, WEB-APP-1..12) | 1-2 sessions | todo |
| HRT-WEB.2 | Add to home screen: web manifest (name, icons 192/512 + maskable, `display: standalone`, theme color), opens on Gallery; Android-size screen checks (360x800 and 412x915) for every tab in Playwright, no sideways scroll, 48pt targets | 1-2 | todo |
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
| WEB-APP-7 | Given a signed-in person who is offline, when they sign out, then the local session is still removed and a reload shows the sign-in screen (only the 1-hour access token expires on its own; the refresh session stays open on the server until it is revoked, PRIV-WEB-R4, TRACKER R89) | auto (jest) |
| WEB-APP-8 | Given a browser that blocks IndexedDB or WebCrypto (private window, strict settings), when a person signs in, then Hearth works for that visit from memory, writes nothing in plain text, and does not crash (HARD-7 behaviour kept) | auto (jest) |
| WEB-APP-9 | Given a sealed value that won't open (key gone, value tampered), when Hearth starts, then it treats the person as signed out and clears the leftovers; no error screen | auto (jest) |
| WEB-APP-10 | Given the iPhone or Android native build, when this PR lands, then `secureSession.ts` is unchanged and its existing tests pass (Keychain/Keystore key, AsyncStorage blob) | auto (jest; diff shows no native change) |
| WEB-APP-11 | Given two Hearth tabs open, when one refreshes the session token, then the other stays signed in after its next reload | manual (Android Chrome) |
| WEB-APP-12 | Given an AG tester on their own Android phone in Chrome, when they sign in once and then reopen Hearth after closing Chrome, after restarting the phone, and the next day, then they are signed in each time with no help | manual (real phone) |

Also in PR 1 (done-when, not criteria): request `navigator.storage.persist()` after sign-in so Chrome is less likely to clear Hearth's storage; replace the "test harness only" comment; update `docs/architecture/03-encryption-and-keys.md` (web session line, "Last checked" footer) per rule 6.

**Done when:** WEB-APP-1..10 green 3x with all suites; privacy-security reviews the key handling; WEB-APP-11 and 12 logged on a real Android phone (Chase's or a tester's) before HRT-WEB.2 ships to a grandparent.

**Lanes:** qa-tdd red (WEB-APP-1..10) → engineer → qa-tdd green 3x → privacy-security (keys, sign-out) → architect not needed unless a new dependency lands (no `fake-indexeddb` unless qa-tdd needs it; then architect first). No screen or word changes, so no grandparent-ux pass in PR 1.

## Not doing (now)

- Chrome web push: after the beta; email covers notices (HRT-WEB.4).
- Video on web: off, as today.
- A custom domain: waits for "Name final: yes" (`ACCOUNTS.md`).
- Native Android build: still ANCHORS milestone 5; the web app is the bridge, not a replacement.
- Offline browsing of photos on web: the web build keeps no photo files (architecture 03); not on the critical path.
