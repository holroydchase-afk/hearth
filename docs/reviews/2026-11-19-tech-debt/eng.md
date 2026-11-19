# Engineering review: Hearth @ eceac67 (architect seat, read-only)

Scope: app/src, packages/messenger, backend/supabase (0001-0026, notify, sign-media), scripts/, workflows.
Not repeated from docs/reviews/2026-11-18-portfolio-review.md: no lint/coverage gate, broken demo-screens spec,
HANDOFF length, no scheduled purge/key rotation. Share screen and web tab bar / Easy view (PR 125) left alone.

## P0

**ENG-R1 (P0, S)** `app/src/state/AppContext.tsx:150-159`
Problem: any `mySpaces()` failure (offline, 5xx, timeout) is swallowed to `[]` and the app goes to `noSpace`:
a signed-in grandparent who opens Hearth with no signal sees "you're not part of a family on Hearth yet" with a
"Sign out" button, the feed cache (`feed.hydrate()`) is never read, and the AppState listener (line 209) can't
recover because feed/queue are null. No test covers mySpaces rejecting.
Fix: failing test first (mySpaces rejects -> not noSpace). Keep the last space in KV and go `ready` from it
(hydrate the cached feed), or add an `offline` status with Try again plus a retry on foreground. Only an
empty successful answer means noSpace.

## P1

**ENG-R2 (P1, S)** `backend/supabase/migrations/0024_start_family.sql:174-181` (and 0020:59-66), `app/src/upload/queue.ts:384-404`, `backend/supabase/functions/sign-media/index.ts:243`
Problem: the per-person video counter is incremented when a *pending* media row is inserted and never given back.
Upload grants live only in memory (`queue.ts` grants Map), so an app the phone killed mid-upload, or a grant that
expired, goes through `restart()`, which deletes the draft and prepares new rows: each retry spends another of
the month's videos. The same happens if the `media_keys` insert at sign-media:243 fails after rows exist.
Fix: count on `mark_media_upload_result(ok=true)` instead of on insert (or decrement on failed/deleted pending
rows); SQL test: restart a video upload 3x, counter = 1.

**ENG-R3 (P1, S-M)** `app/src/screens/PostCard.tsx:26-28, 346` with `app/src/feed/store.ts:250-251`
Problem: `PostCard` is `memo`'d but the card and its `ReplyBox` both call `useFeed()`, which subscribes to the
whole FeedState. Comment drafts live in that state, so every keystroke in any comment box (and every
`loadComments` result) re-renders every mounted card. The memo does nothing.
Fix: a selector hook (`useFeedSelector(s => s.drafts[id])` over useSyncExternalStore) or keep the draft in
local state and save it on blur; a render-count test.

**ENG-R4 (P1, M)** `app/src/screens/PostCard.tsx:34-41, 338-345`; `app/src/feed/store.ts:240, 328`
Problem: per-card RPC fan-out. Each mounted card calls `get_comments` (up to 50 rows, for one "newest" line),
`reply_readers` and `mark_seen` on mount, so the first page of 20 posts costs about 60 round trips on a rural
connection, while reactions and viewers are already batched per page (`store.ts:137,147`). `mark_seen` also fires
for every card FlatList pre-renders, not just the ones that were seen.
Fix: return the newest comment and reply readers with the feed page (or one batched RPC like
`reaction_summary`); load `reply_readers` when the comment field gets focus; mark seen from `onViewableItemsChanged`.

**ENG-R5 (P1, S-M)** `app/src/state/runtime.ts:7-10, 25, 67-70`; `app/src/app/_layout.tsx:8-9`
Problem: demo and fake code is statically imported into the real app. FakeBackend (1212 lines, fixture
family), `demo/seed`, `demo/pictures`, DemoChrome and DemoBar all go into the phone bundle; `FAKE_MODE` is only
a runtime branch, and Metro doesn't tree-shake by default.
Fix: move the fake/demo wiring to `runtime.fake.ts` and point a Metro `resolver.resolveRequest` alias (or an
env-selected entry) at a stub unless `EXPO_PUBLIC_HEARTH_FAKE` or `EXPO_PUBLIC_HEARTH_DEMO` is set. Add a test
that greps the exported production bundle for `FakeBackend`.

**ENG-R6 (P1, M)** `app/src/screens/MoreScreen.tsx:41-74`; `app/src/screens/PhotosScreen.tsx:50-54, 97-108`; `TimelineScreen.tsx:39`, `SearchScreen.tsx:57`, `NewForYou.tsx:97`
Problem: navigation is hand-rolled inside expo-router. Sub-screens (Messages, Groups, Me, Help, Events, Timeline,
Search) are `useState` swaps, with a module-level `resets` Set to reset More and hand-written `BackHandler`s.
Results: no iOS swipe-back; Android back on a More sub-screen leaves the tab (MoreScreen has no BackHandler);
Gallery scroll position is lost on return (the list unmounts); and `/me`, `/help`, `/groups` exist as redirect
stubs only to fake deep links.
Fix: nested Stacks (`(tabs)/more/_layout.tsx` + `more/groups.tsx`…, `(tabs)/gallery/search.tsx`…); delete
`resets`, the BackHandlers and the redirect stubs. Sequence it after PR 125, since both touch `(tabs)/_layout.tsx`.

**ENG-R7 (P1, S)** `app/src/api/SupabaseApi.ts:167-178, 216`; `app/src/feed/store.ts:137, 147`; `app/src/api/types.ts:47, 80, 100`; `app/src/screens/PostCard.tsx:42-44, 336-342`
Problem: "older server" compatibility paths (no `set_reaction` before 0017 -> toggle hearts; no `sign_in_with`
before 0026; `i_hearted`/`heart_count` fallbacks; `replyReaders?.()` on a required method, wrapped in
`Promise.resolve`). There is one backend and `deploy.sh` always migrates it to head, so these are second code
paths that never run in production and make each feature read twice.
Fix: delete the fallbacks and legacy fields. contract-real already pins the API to head.

**ENG-R8 (P1, S)** `app/package.json:15-17`; `e2e/package.json`
Problem: the app's e2e scripts run `node ../e2e/node_modules/@playwright/test/cli.js` with
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` hard-coded (one machine's path). They only work after a separate
`npm i` in the throwaway prototype folder. `e2e/package.json` is unedited `npm init` output (license ISC in an
AGPL repo; its `test` script exits 1).
Fix: add `@playwright/test` to app devDependencies (or one root npm workspace with app, e2e and
packages/messenger), read the browsers path from the environment, and fix the e2e package's metadata.

## P2

**ENG-R9 (P2, S)** `app/src/state/AppContext.tsx:143-196`. `load()` has no generation guard. A `reload()` during
an in-flight load can open two UploadQueues over the same persisted jobs, and the losing one is never stopped
(possible double post). Fix: a load counter; stop and ignore stale results.

**ENG-R10 (P2, S-M)** 10 `eslint-disable-line react-hooks/exhaustive-deps` (PostCard.tsx:36,40; JoinScreen.tsx:70;
ViewerScreen.tsx:66; VideoPlayer.tsx:89; PhotoSwipe.tsx:65,86; TimelineScreen.tsx:27; ShareScreen.tsx:65,89;
typing.ts:55-56) while ESLint isn't installed, so nothing checks them; e.g. PostCard:40 uses
`post.comment_count > 0` as a dep. Fix: when ESLint lands (portfolio review), add eslint-plugin-react-hooks and
resolve each one (`useEffectEvent`), leaving Share to its own thread.

**ENG-R11 (P2, S)** `backend/supabase/functions/sign-media/index.ts:215`. The video cap is raised as generic P0001
and matched by message text. Fix: a dedicated SQLSTATE like HF001 (rule 7's spirit), branch on code.

**ENG-R12 (P2, S)** `sign-media/index.ts:28-62` and `notify/index.ts:44, 134`. Each function hand-rolls `env()`
and a PostgREST client. Fix: `supabase/functions/_shared/`. Also notify reads `DeviceNotRegistered` from push
*tickets* only (line 160); Expo reports most of these in *receipts*, which are never polled.

**ENG-R13 (P2, S)** `app/package.json`. `expo-device` and `react-native-gesture-handler` are imported nowhere
(native weight in every build). `@supabase/supabase-js` is caret-ranged while its neighbours are pinned or
tilde-ranged. Fix: remove the two, pin consistently.

**ENG-R14 (P2, S)** `app/src/demo/DemoChrome.tsx:41`, `app/src/state/runtime.ts:69`. The demo reaches the
backend through a `globalThis.__hearthFake` global. Fix: pass it in through context or props with ENG-R5.

**ENG-R15 (P2, S)** AppGate gating repeated in 7 screens (`PhotosScreen.tsx:95`, `MoreScreen.tsx:70`, Groups, Me,
Help, Share, Viewer) though `(tabs)/_layout.tsx` already gates. Fix: gate once per layout.

**ENG-R16 (P2, S)** `app/src/ui/tokens.ts`. Only a docs generator and its test use it, yet it lives in the app's
`src/ui`. Same for `app/src/test/*` helpers inside src. Fix: move tokens to `scripts/`.

**ENG-R17 (P2, S)** `backend/scripts/family-setup.sql` (v1, CLAUDE.md says superseded), `family-setup-v2.sql` and
`family-setup-api.sql`: three ways to seed a family. Fix: delete v1 and say which of the other two is canonical.

**ENG-R18 (P2, S)** Root clutter and committed run output: `ux-shots/*.png` (1.3 MB), `prototype/`, `tracker/`,
`backend/tests/results/*.txt`, `e2e/results/*.txt`. Fix: move evidence into PR bodies or CI artifacts, and
move prototype, tracker and ux-shots under `docs/archive/` (or delete them).

**ENG-R19 (P2, S)** `app/src/ui/kit.tsx:24`, `app/src/app/(tabs)/_layout.tsx:45`. Icon names cast `as never`,
so a misspelled SF Symbol compiles. Fix: type `Icon.sf` as `SFSymbol` from expo-symbols.

**ENG-R20 (P2, S)** Architect: there is no `docs/REUSE.md` (studio rule; messenger, supabase-starter, the
LargeSecureStore session and sigv4 are prime candidates). The `docs/architecture/*` footers have grown into
changelogs (`02-data-flow.md:57` is one ~900-character line) when the README:28 rule is `<date>, <commit>`.
Fix: add REUSE.md and cut the footers back to a single date and commit.

## Already reads as senior
1. One `HearthApi` port with Fake and Supabase implementations, one contract suite run against both, and CI
   running it against real PostgREST (`ci.yml` contract-real) plus a real `supabase start` stack.
2. Migration security hygiene. Every SECURITY DEFINER function sets `search_path = ''`; 0002 revokes all and
   then grants explicitly (anon only gets `invite_preview` and `report_client_error`); tests assert
   `has_function_privilege`.
3. `upload/queue.ts`: an explicit state machine with injected clock, timers and ids, backoff, a concurrency cap,
   a grant-expiry margin and persisted jobs, so it's testable without fake timers.
4. `platform/secureSession.ts`: the LargeSecureStore pattern (AES-GCM blob in AsyncStorage, key in the Keychain),
   which the Supabase session size needs.
5. `sign-media`: no dependencies, signed content-type so only ciphertext can be PUT, 404 (not 403) for posts
   you can't see, a HEAD size check at finalize, and log lines that carry name and code only.
