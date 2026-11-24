# Handoff
<!-- status
stage: building
goal: hearth-beta
milestone: HRT-M1
now: tech-debt review Nov 19 (docs/reviews/2026-11-19-tech-debt/): fixing the P0s and P1s in small PRs (TRACKER R62). Main has everything through #124 (demo bar), live
next: R62 fixes in order (offline family load, demo panel, privacy, UX, perf, CI); then R51 audience-leak eval, R53 operations. Share redo and PR 125 continue in their own threads
waiting_on_chase:
  - New Supabase access token in the Hearth cloud environment (SUPABASE_ACCESS_TOKEN); Chase already said "deploy" (Nov 19), so the next session deploys 0026+0027+0028 and Confirm email
blockers:
  - Deploy (0026, 0027, 0028) stopped Nov 19 14:20Z: Supabase returned "Invalid access token"; nothing applied
-->

## Nov 24: demo photos to Pexels stock, demo parent Kevin (DEC-82, R79, DEMO-PHOTO-4..18; branch claude/project-thread-dp2r8b)
- **Done, test-first (engineer):** 19 stock photos built from the cleaned 2000 px set into `app/public/demo-pictures/` (1200 px display, 400 px thumbs, ImageMagick `-strip`, q80; no APP1/APP2/APP13), the Nov 16 set deleted, `CREDITS.md` added, `DEMO_PICTURE_SIZES` set to the real sizes. `seed.ts`: parent "Kevin", the 7 spec posts (190 / 40 / this week; post 4 titled "Pancake morning", captions for 3, 5, 7 engineer-written), anniversary "Kevin and Alex", seed version moves. Demo bar says Kevin and carries the credit line in Details; the laptop story panel carries it too. README line 15, `pictures.ts`, `make-demo-pictures.py`: no "founder's own" wording.
- **Open:** e2e:demo 51 passed, 2 failed on stale test data for qa-tdd: UX-R1 still clicks "2 new" / "New photos: 1 of 2" (now 3 new, DEMO-PHOTO-12); R18 scrolls 1200 px, which now lands on the November/October section edge so no month title sits in the band. README screens and `og-hearth.png` still show the old photos (DEMO-PHOTO-15, retake). `/mnt/project-files/demo/DEMO-SCRIPT.md` not changed.
- **Next exact step:** qa-tdd fixes UX-R1 and R18 data, green 3x; privacy-security (metadata), grandparent-ux (captions); retake screens.
- **Portfolio / public presence:** the public demo shows free Pexels stock photos and a made-up parent "Kevin" once this merges; no photo of Chase's family remains on main.

## Nov 24: life calendar review fixes built (PRIV-R1..R3, R5; GUX-R1..R11; branch claude/project-thread-ov6z2y)
- **Done, test-first** (qa-tdd red e65adf7, r67): 0029 edited in place (never deployed): members select only the date columns, list ties by id (PRIV-R1); `private.may_see_family_date` in RLS, `list_family_dates` and `delete_family_date`: parents all, a member's birthday where `can_see_profile(member)`, other dates only to the Everyone group (PRIV-R2; Fake backend the same); `export_my_data` gains `family_dates` (PRIV-R3); writes lock the `spaces` row before the 200 count (PRIV-R5). App: short Gallery card, "Add my birthday" opens the form on Birthdays (Gallery's stack, `/gallery/birthdays?add=mine`), Save fixed at the bottom (`Screen footer`), "Your birthday: December 8" above it and checkmarks on the picks (GUX-R1, R5); "Saved. Your family will see December 8." at the top (R2); back reads "Gallery" from Gallery (R3); "Happy birthday, <name>!" (R4); "Today: Family reunion" (R6); the form is its own page, back "Birthdays" (R7); chevrons on tappable rows (R8); the load error words (R9); "Whose birthday?", "It's removed for everyone in the family." (R11). GUX-R10 (cake symbol) not done: `birthday.cake` needs iOS 16. Docs: architecture 02, 04 (gap 7), 05; API.md; spec and DEC-81 say dates follow who sees a name, confirmed by Chase Nov 24. CI: new `backend-sql` job runs `backend/tests/run.sh` on plain Postgres 16 with contrib (dblink); `run.sh` refuses early without dblink.
- **Test setup note:** `family_dates_test.sql` now marks seed.sql's two "Everyone" circles kind `everyone` (the seed predates 0011's kinds); no assertion changed.
- **Open:** the Birthdays subline now reads "Only your family can see these." (CAL-14, CAL-19 e2e). Still open (QA-R1, P2): the card and form line "Your family will see the month and day. Never the year." and "Saved. Your family will see December 8." say the whole family sees your birthday; under PRIV-R2 only people who can see your name do: grandparent-ux/staff-pm to pick words. New CI job needs architect's OK.
- **Next exact step:** all suites green 3x (r68); DEC-81 confirmed by Chase Nov 24. PR #169 merged on Chase's "merge" (Nov 24); next "deploy 0029" (deploy token still broken).

## Nov 24: life calendar v1 built (Chase, DEC-81, R78, CAL-1..21; branch claude/project-thread-ov6z2y)
- **Done, test-first:** qa-tdd red (9276f27, r65), then the build. Migration `0029_family_dates.sql` (table, RLS select for members, no direct writes, `list_family_dates` / `set_my_birthday` / `save_family_date` / `delete_family_date`, security definer, `search_path = ''`, no year column, 200 per family, leaving the family takes your birthday). `HearthApi` + Fake + Supabase methods (`MISSING` code for a server without 0029, calendar RPCs only), API.md "Life calendar (0029)". App: Gallery "When's your birthday?" card (Save / Not now, kept on the phone), "Today is ..." line with See birthdays, More → Birthdays → "Birthdays and dates" (soonest first, Today / Tomorrow / In N days to 30; viewers: Add or Change my birthday; parents: Add a date, tap a date for Change / Delete). All hide quietly without 0029 (CAL-17). Demo: Grandma Jo today, Grandpa Earl in 9 days, Mia's birthday, Chase and Alex's anniversary; seed version moved; a saved demo family gets the dates moved to the visit day. Architecture 02 and 05 updated (CAL-20).
- **Open:** CAL-14 "icon and the word" test counts a `Text` glyph, but `SymbolView` draws no Text under jest (font never loads), so it stays red until qa-tdd checks for the `SymbolView` instead (as RD-15 does). RD-15 and RD-78 row lists gained Birthdays (engineer, flagged for qa-tdd). Member names on birthday rows reach the whole family (wider than "Who sees a name"; spec chose it): privacy-security to confirm. Dates are not in `export_my_data` yet.
- **Next exact step:** qa-tdd green 3x and fix the CAL-14 assertion; grandparent-ux and privacy-security review; then Chase says "merge" and "deploy 0029" (nothing deployed). CAL-21 grandparent test with LG after.
- **Portfolio / public presence:** the public demo shows the Gallery birthday line and Birthdays once this merges.

## Nov 24: visibility core designed (R77; design only, awaits Chase's go)
- `docs/product/SPEC-VISIBILITY-CORE.md` + `docs/architecture/07-visibility-model.md`: one registered core for every kind (fungible, generic `@holroyd/visibility`), CI gate, oracle (folds R51), user-error catches, co-parent bridge (after the beta), one composer. Open: Chase's go on Phases 1, 1b, 2.

## Nov 24: public repo standards (intake #163, R76; branch claude/project-thread-6ew09x, PR)
- **Ask (Product Studio scorecard):** engineers and hiring managers judge the public repo's layout.
- **Done:** CONTRIBUTING.md (test-first, privacy rules), CODE_OF_CONDUCT.md, SECURITY.md (private reporting, no overclaims), `.github/pull_request_template.md` with the `Agents:` line, bug and feature issue templates, `.github/dependabot.yml` (Actions weekly; npm in app, e2e and messenger security-only so Expo versions still come from `expo install`), CI badge and links in the README. Config only.
- **Left:** repo description and topics (Chase pastes one line in Settings), Dependabot security updates switch (Settings), root clutter (moving HANDOFF/CLAUDE/tracker needs the studio rule paths changed in the same PR; not done).
- **Portfolio / public presence:** the public repo now has the standard community files.

## Nov 23: dark mode elevation by surface step (intake #155, R75; branch claude/project-thread-6ew09x, PR)
- **Ask (Product Studio intake):** in dark mode, show elevation with a lighter surface instead of a shadow (DARK-5).
- **Done, test-first:** qa-tdd red DARK-ELEV-1..6 (`darkElevation.test.tsx`, demo e2e DARK-ELEV-6), then the build: `shadeLine(dark)` (GalleryGrid, PhotosScreen) has no shadow in dark; the floating tab bar drops its dark shadow; the laptop demo's phone column sits on `c.surface` with no shadow in dark. Light unchanged. Green 3x (r60). Before/after shots: /mnt/project-files/design/dark-elevation-2026-11-23/.
- **Open:** B23 (QA-R1, P2): the dark surface step is only 1.05 to 1.11:1, so separation is subtle; a bigger step needs new palette values (Chase's call). ux-reviewer: Ready, 8/10, no P0/P1. DARK-UX-R1 (P2): the screens paint c.bg over the phone column's c.surface, so on the laptop the column is set off by its border only, until B23. DARK-UX-R2 (P2, older): a photo corner shows through the 0.62 dark glass bar; parked.
- **Next exact step:** Chase says "merge" (touches app/**, DEC-48); then live check fresh and returning; reply on #155 with the PR link.
- **Portfolio / public presence:** the public demo's dark mode loses its drop shadows once this merges.

## Nov 23: nine fruit themes beside Paper (Chase, DEC-80, R76, FRUIT-1..12; PR #160, branch claude/project-thread-9r046o)
- Done: Paper (default, unchanged) + Avocado (unchanged) + new Pomegranate + Blood orange, Kiwi, Fig, Dragon fruit, Watermelon, Candy-stripe beet, Red cabbage. Picker of 10, owner-only. Dark dangerText #FF6961 off Paper. Tokens regenerated. qa-tdd red (r61) then green 3x (r62). Source tool: https://claude.ai/artifact/SQ6gmnFB6bX7t6scr3ipSz
- Chase Nov 23: "merge all in the right order on green" (after #144, #158). Next: live check fresh + returning; then GUX-R30..R33 (P2) as their own PR; FRUIT-12 on phones.
- GUX-R30..R33 (Nov 23, same branch): swatch shows page, fill and accent (R30); note above the list, "Only this phone changes. Other people keep their own colors." (R32, QA-R1 resolved); first row "Paper (standard)" (R33); R31 Delete never colour-only is guarded (held already). Next: qa-tdd green 3x, then FRUIT-12 on phones.
- **Portfolio / public presence:** the public demo's Theme picker offers the 10 themes once this merges.

## Nov 23: ask-less self-check rule (intake #154, R74; branch claude/project-thread-6ew09x, PR)
- **Chase (Nov 23, via Product Studio):** "I never want to update your settings or environments or repos."
- **Done:** CLAUDE.md "Minimize Chase's effort" gains the self-check paragraph from studio-agents `docs/studio-standard.md` section 1 (do it yourself, then a tool he only allows, then a card, then one copy box). Docs only.
- **Portfolio / public presence:** none.

## Nov 23: Share start B+ built (postcard first for everyone)
- Done: Chase picked "B+ Postcard first for everyone" (Nov 21) and said "Merge on green when finished" (Nov 22). SHARE-ST-10..18 + grandparent-ux fixes GUX-R1..R5, green 3x (r57). Screens: /mnt/project-files/design/share-start-b-plus-2026-11-23/. Open: B21 (P2, long group lists end in "…"), GUX-R6 idea, SHARE-ST-9 on phones, Expo preview republish (needs EXPO_TOKEN).

## Nov 20: Share opens on an empty postcard specced (Chase, DEC-79, R73, SHARE-ST-1..9; branch claude/project-thread-4ulu9i)
- Done: Chase picked "B Empty postcard"; DEC-79, spec `SPEC-REDESIGN.md` 1j-2, persona check `decisions/2026-11-20-share-start-postcard.md`, TRACKER R73. One way in; the "Pick lots of photos" link goes; non-parents stay at 10.
- Nov 23: round 2 "B+ Postcard first, for everyone" (Chase, Nov 21) amends DEC-79 with SHARE-ST-10..18 (new subline, dashed spot, stamp, full-contrast To: with names, "Last shared", no auto-advance).
- Next: qa-tdd red (`shareStart.test.tsx`, demo e2e), engineer, grandparent-ux on shots.
## Nov 23: Share start tester packaged for other people and projects (Chase, R72; branch claude/project-thread-ukmbd0, PR)
- **Chase:** "Can you package the tester and put it on your repo somewhere atlas can get it?" and "I want it to be usable by other humans".
- **Done:** `docs/design/testers/share-start.html` (round 2 Share start tester, standalone, with a How to use note and Chase's pick, B+) and `docs/design/testers/README.md` (how to open it, what it compares, the pick). Checked: no real names, faces, places or emails.
- **Portfolio / public presence:** Chase said host it (Nov 23). Intake holroydchase-afk.github.io#93 asks Product Studio to publish it at a public chaseholroyd.com link; merged as hearth#151. Live at https://chaseholroyd.com/demo/share-start-tester/ (site PR 94, Nov 22; a self-hosted-font copy with nicknames, not the raw file).

## Nov 22: wired to studio-agents PR #45 checks (intake #149, R71; branch claude/project-thread-qt1q8v, PR)
- **Chase:** "Pick up the open intake issue ... one small PR, qa-tdd for any code or CI change".
- **Done:** agents-check fails a code PR whose `qa-tdd skipped` reason isn't exactly `docs only` or `config only` (from studio-agents templates/agents-check.yml; setup-node pin left at v4). Test `scripts/tests/agents_check_skip_test.sh` (AGENTSKIP-0..4, red first) runs the real workflow step; wired into test-all.sh and agents.verify. CLAUDE.md gains "Open every thread the same way" and "Agents come from studio-agents". Shared scripts already matched the studio templates.
- **Portfolio / public presence:** none.

## Nov 21: themes shareable with other studio products (Chase, R70; branch claude/project-thread-1ba5s6, PR)
- **Chase:** "We also probably want the themes Sharable".
- **Done:** `docs/design/themes.css` (Paper default, Avocado, Pomegranate; light, dark, high contrast; studio names + Material 3 role names; font stack) generated from theme.ts by `themesCss()` in `tokens.ts`; `tokens.json` gains `roles`. Drift tests DS-THEMES-1..3 (red first: e2e/results/themes-red-jest-2026-11-21.txt). STUDIO-CORE "Shared themes" says how to use them. DSG-6 closed.
- **Portfolio / public presence:** none.

## Nov 21: Atkinson Hyperlegible Next everywhere, again (Chase, DEC-78, R69; branch claude/project-thread-1ba5s6, PR)
- **Chase:** "hyperlegible next. also ensure that is on the portfolio demo page" (after the live font tester https://claude.ai/artifact/7Dfseqn1BtTaPtFuCijPzX).
- **Done:** qa-tdd red FONT-1..5 (flipped RD-2 tests), engineer built: package 0.4.1 bundled, `FONT`/`FONT_FILES` in theme.ts, `useFonts` in the root layout, every `fontWeight` replaced by the matching family, tokens.json regenerated; STUDIO-CORE, DESIGN-SYSTEM DS-12, DEC-78 and persona check updated.
- **Next:** merge, live demo check fresh and returning, Expo preview republish, Chase's iPhone look at 360 px wrapping.
- **Portfolio / public presence:** the public demo (chaseholroyd.com/hearth/) shows Atkinson Hyperlegible Next once this merges.

## Nov 21: studio design core and Hearth's design guidelines (Chase, R68; branch claude/project-thread-1ba5s6, PR)
- **Chase:** "Can you and the ui agent build design guidelines and whatever design system we should use?", "start lean", "goal is to give this to other projects so their products look similar", "are there other established design systems we should look at?"
- **Done:** `docs/design/STUDIO-CORE.md`, the product-neutral core other products copy: each phone's own guidelines for behavior, Material 3 color roles as the token vocabulary, no component library, 11 principles, the 7-colors-per-mode theme recipe with tested contrast, type, space, corners, components, a new-product checklist. `docs/product/DESIGN-SYSTEM.md` is now Hearth's layer: stale palette, font and DS-11/DS-12 rows brought up to the code (themes, Medium for names, no Bold), Hearth's themes table, Hearth components, and gaps DSG-1..8 (not fixed). Brand names of other apps removed. ux-reviewer reviewed (DSC-R1..R8, all applied).
- **Open:** Chase picks the font (decision card; recommended Atkinson Hyperlegible Next everywhere, which would reverse DEC-59's font and needs an app PR). Studio intake to adopt the core in the shared tools repo. DSG-1..8 need staff-pm ranking and failing tests.

## Nov 21: Easy view case study for the portfolio (Chase, R66; branch claude/project-thread-lld29p, PR)
- **Chase:** "We need to ensure we do a write up on easy mode and ensure that's on the portfolio."
- **Done:** `docs/portfolio/EASY-VIEW.md` (problem, the call and what it beat, persona check and its one Red, tests, what it unlocked: DEC-70 native glass bar, DEC-72 demo, DEC-75 shrink), linked from `CASE-STUDY.md`. Screenshots shot from the live demo Nov 21 (Chase vs Grandma Jo on More, the Easy view page; no faces) in `docs/portfolio/screens/easy-view/`. positioning reviewed the claims.
- **Nov 21, later:** Chase: "delete any mention of any real company in there". The write-up now says standard social feeds, phone photo apps, the phone's standard tab bar and screen reader, AI agents (no company or product names); intake #85 scrubbed the same way.
- **Also fixed:** `backend/tests/notify_test.sql` had a date bomb: the release-and-resend check used a fixed clock of Nov 20, 7pm ET, so from Nov 21 00:00Z its notice was queued after that clock and CI's backend job went red on every PR. The notice is now queued at 5pm ET that day (before the 6pm email slot). Notify suite 60/60 green 3x locally. Two more fixed dates in that file (Nov 2, Nov 7/16 checks) pass today; worth a look if notify goes red again.
- **Next:** when the Share split by Easy view ships (thread "Redo the Share screen"), fill the "Next: Share follows Easy view" section (DEC number, PR, Off vs On screenshot pair).
- **Portfolio / public presence:** intake holroydchase-afk.github.io#85 asks Product Studio to add an Easy view section to the Hearth case study.

## Nov 21: Grandma Jo switch fixed for iPhone Safari (Chase, DEMO-SAFARI-1..4, QA-R1, TRACKER R67; branch claude/project-thread-x63lzp, PR)
- Cause: since the real demo photos (Nov 16) the demo saved ~3.5 MB of photo bytes in localStorage; Safari's quota refused it silently, so a reload (the Jo switch, Reset) always restarted as Chase and nothing a visitor did survived a reload on iPhone.
- Done: photo bytes in IndexedDB (`app/src/state/fakeSave.ts`), small state in localStorage, old saves migrate; Jo switch and Reset wait for saves. New `e2e-web/demo-safari.spec.js` runs the demo under a Safari-sized quota. Sweep found no other regressions.
- Next: Chase's "merge", then live check fresh + returning at 390/1280, then one tap on his iPhone.
- **Portfolio / public presence:** the public demo's Grandma Jo switch works on iPhone once this merges.

## Nov 20: funding research out of the public repo (Chase, DEC-77, PM-R10)
- Done: `docs/product/FUNDING-RESEARCH.md` removed; private copy in the project files (`private/`). Older commits still hold it.
- Next: Chase wants the planning docs (REMAINING, MILESTONE-1, PLAN, PM-REVIEW, TRACKER, BETA-SPEC) rewritten before they stay public; scope waits on his note. Deploy of 0026-0028 still waits on a new Supabase token.

## Nov 20: ENG-R6 navigation is real stacks (tech-debt review, TRACKER R62; branch claude/project-thread-av5ejj, PR)
- **Done, test-first** (red `navStacks.test.tsx`, then old tests moved off the in-place swaps, then the code): Gallery, Feed and More are each a stack (`app/(tabs)/{gallery,feed,more}/_layout.tsx`, shared `screens/TabStack.tsx`, `anchor: 'index'`). Routes: `/gallery/search`, `/feed/timeline?startAt=`, `/more/{messages,groups,events,easy-view,look,theme,me,help}`. `MoreRowGate` keeps the role rules (a viewer at `/more/groups` or `/more/theme` gets the menu, DEC-49). Old links `/groups`, `/me`, `/help` and `/more?open=` redirect with the menu under them. Deleted `resetMore`/`resets` and the BackHandler fallbacks (Search and the timeline only handle their inner steps now). Re-tapping a tab on Hearth's own bar sends `tabPress`, so its stack goes back to its first screen; leaving More pops it (as before); the phone's own bar pops natively. `build-demo.sh` copies the new addresses. Tests render the real routes through `test/appRoutes.tsx`; jest now transforms `standard-navigation`.
- **Still in place (not stack screens):** Feed's Events list/event and Gallery's New for you walk (keeps its BackHandler); More → Events → one event pops straight to More on the phone's Back.
- **Status:** qa-tdd green 3x (P2s QA-R1..R4 open in PR #139); merged on green per Chase's review go-ahead. Next: check iPhone swipe-back and Android Back on More's rows in the Expo preview.

## Nov 20: Hass Avocado and outlined picked reactions built (Chase, DEC-76, RD-111..RD-117; branch claude/project-thread-253q4i, local commit)
- Built: Avocado's new light/dark values in `app/src/ui/theme.ts`; `accentPicked` removed; a picked reaction in `PostCard.tsx` is a 2 pt `c.accent` outline with an accent count, unpicked a 1 pt `c.line` outline, padding absorbs the border so nothing moves; `docs/design/tokens.json` regenerated. RD-111..RD-116 jest green, typecheck green.
- Next: qa-tdd retargets 3 older tests that still expect the superseded no-outline capsule (moments LIVE-3, warmPaper RD-89 layout keeps padding, reviewRound2 R21 subtracts the border), then runs all suites 3x and the RD-117 Playwright run; RD-118 on phones.

## Nov 19: glass tab bar shrinks on scroll (Chase, DEC-75, RD-110, R64; branch claude/project-thread-ox4dz4, PR)
- **Chase:** "I also want the full iOS glass oval interaction on scroll".
- **Done, test-first:** `nativeTabLook('ios')` gives `minimize: 'onScrollDown'` (the layout passes it to `NativeTabs`); Android stays `never`. Web: `HearthTabBar` follows any scrolling area (`nextMinimized`, capture-phase scroll listener) and narrows to a 64 pt oval with only the picked tab; tap it, scroll up or reach the top to bring the bar back. Easy view On never shrinks. DS-5 wording updated.
- **Nov 20 code review (Chase: "go for p1 fixes, docs, etc"):** RD-110-R1 the oval's tap only brings the bar back (More no longer loses its place); R2 the web only follows the app's own vertical scrolling (not the laptop story panel, not sideways strips); R3 changing tabs brings the bar back; R4 the shrink really animates (max width) and Reduce Motion is tested; R5 `nativeTabLook` itself says never with Easy view; R6 the browser tests use the real wheel, measured widths and frame waits instead of fixed pixels and timers. Docs: RD-107 row, DEC-73 comments put back. ONB-4 taps the oval then More.
- **Next exact step:** Chase says "merge 138"; demo rebuilds; live check; republish the Expo preview so Chase sees it on his iPhone (check VoiceOver and a scroll inside More's lists).
- **Portfolio / public presence:** the demo's glass bar shrinks on scroll once this merges.

## Nov 19: text sign-in kept and readied to turn on (Chase, DEC-74, TRACKER R43; branch claude/project-thread-df9051, PR)
- **Why:** the tech-debt review (PM-R5) suggested parking it; Chase: "We need to keep the switched off features."
- **Done:** TD-UX-R7 test-first (sign-out words no longer say "from your email"; Me says "Signed in with the mobile number ending 0100" for text accounts, from a new optional `Session.phone`). `docs/eng/SMS-PROVIDER.md` "Nov 19 check": Verify needs no carrier registration and costs $0.05 + $0.0083 per text (via search; twilio.com is blocked here); Supabase ignores its SMS template under Verify, so Hearth's words go to Twilio Support as a custom template (request body in the doc).
- **privacy-security re-review** (`docs/reviews/2026-11-19-text-sign-in/sec.md`, replaces the lost PRIV-R2..R6): TS-SEC-R1 P1 password sign-up left open (pre-account takeover, phone and maybe email today) fixed by migration 0028 (trigger blanks `auth.users.encrypted_password`) + "Confirm email" on (`config.toml`, `deploy.sh` `mailer_autoconfirm: false`), design `docs/eng/AUTH-NO-PASSWORDS.md` (architect); TS-SEC-R2 P1 project-wide text cap now falls back to email (GoTrue phone.go:73-92: same code, message tells per-number wait apart). TS-SEC-R3..R9 P2 open. QA-R2 open: real-stack (Docker) sign-up tests for R1.
- **grandparent-ux re-review** (`docs/reviews/2026-11-19-text-sign-in/gux.md`, replaces lost GUX-R3..R6): 6 P1 (TS-GUX-R1 safety line in the text, R2 invite text warns of an unknown-number code, R3 guide sign-in step = BETA-SMS-17, R4 text-cap fallback words, R5 'we will email you' for text accounts, R6 wrong-number phone invite dead end), 11 P2.
- **TS-GUX-R1..R6 fixed test-first** (text wording in config.toml + Twilio request body, invite text warns of the code and says "invite code", guide Step 1 'type the code yourself' = BETA-SMS-17 doc side, text-cap fallback words, sign-in-again words name no channel unless known, wrong-number phone invite card). TS-GUX-R7..R17 P2 open.
- **Nov 19 14:20Z:** PR #134 merged (05cad43) on Chase's "Merge 134 on green then deploy". Deploy dry run listed 0026-0028; the real run stopped at step 1: "Invalid access token" (nothing applied).
- **Next exact step:** after Chase replaces SUPABASE_ACCESS_TOKEN, a fresh session runs `deploy.sh` (comment-only functions/.env), smoke check, checks hosted `mailer_autoconfirm` is false (PATCH may 403: then Chase toggles Confirm email), and an email sign-in; then Chase's Twilio sign-up, "deploy" (0026+0027+0028); Claude sets up Verify service, custom text (SMS-PROVIDER request body), per-number rate limits, hosted phone confirmations; BETA-SMS-16 on an iPhone and an Android; Chase's word flips the switch. Then Chase's Twilio sign-up, "deploy" (0026+0027+0028), Verify service + custom text + Verify per-number rate limits, BETA-SMS-16 on an iPhone and an Android.

## Nov 19: Share is a postcard (Chase, DEC-73, R63, SHARE-PC-1..14; branch claude/project-thread-4ulu9i, PR)
- **Chase:** "This all looks great to me. proceed with the build" (00:27 ET) on direction B of the Share tester (https://claude.ai/artifact/71YN9yYWMt1KYZsqfsXCT4); no autoselect of the audience; one "Add a note (optional)" replaces Title + What's happening (amends DEC-39). Spec `SPEC-REDESIGN.md` 1j, persona check `decisions/2026-11-19-share-postcard.md`.
- **Done, test-first:** qa-tdd red (SHARE-PC-1..13), engineer build, grandparent-ux review (GUX-R1 P1 long group names spill out of tiles; R2..R4 P2 grey Add/note fills, picked mark), red tests then fixes (tiles go 2 across for long names, Easy view or big text). qa-tdd all suites 3x green (r50): jest 1537, typecheck, e2e:web 5, e2e:demo 28, test-all 15. Bulk review keeps its Title for now (QA-R3). Open: T24/QA-R1 env-gated screenshot specs stale on Gallery (pre-existing).
- **Next exact step:** Chase says "merge N"; then SHARE-PC-14 on his iPhone (Expo preview republish on his word).
## Nov 19: web glass tab bar lookalike, Grandma Jo no longer enlarges the laptop page (Chase, DEC-72, RD-108, RD-109, DEMO-EASY-1, R61; branch claude/project-thread-ox4dz4, PR)
- **Chase:** "i do not see it in the demo" → picked a web lookalike; "its a poor experience that clicking grandma jo makes the screen much larger".
- **Done, test-first:** `HearthTabBar floating` (web + Easy view Off): capsule 16 pt in, 64 pt, `c.surface` at 60%, `backdropFilter` blur, `c.accentSoft` pill. `ui/tabBarSpace.tsx` context gives screens 96 pt of room (kit `Screen`, Photos, Timeline, Events, Search, the walk's bar). `DemoFrame` panel and the phone's `DemoBar` sit in `BigTextContext` false. RD-44's e2e now measures tile rows from the grid's top (scroll-independent).
- **Expo preview republished Nov 21** from main f65724f (#146, Atkinson Hyperlegible Next font; group f56e32ac-41d3-4d91-b2ba-b7ea62f3dc01). Before that Nov 20 from 6ace2e8 (#140, Hass Avocado; group e200110a). Standing link serves it.
- **Expo preview republished Nov 19** from main eceac67 (group 96e510bb, iOS 01a1f21c-d8b4-79f2-a861-c4e8140f43e0); standing link serves it. Chase checks the iPhone tab bar.
- **Next exact step:** Chase says "merge"; demo rebuilds; live check of the floating bar (fresh and returning).
- **Portfolio / public presence:** the public demo's tab bar floats as glass for Chase's view once this merges.

## Nov 19: tech-debt review from five seats; fixes start (TRACKER R62; branch claude/project-thread-av5ejj)
- **Chase:** "run a full review of hearth as the review team... I'm concerned there's tech debt or we have done some things oddly. Needs to pass the sniff test." Go-ahead to merge the P0/P1 fixes on green, app code included; migrations still deploy only on his word.
- **Done:** architect, qa-tdd, privacy-security, ux-reviewer and staff-pm reviewed main at eceac67: `docs/reviews/2026-11-19-tech-debt/` (ranked table in its README). 2 P0s (offline open shows "no family"; demo story panel cut on a laptop), about 20 P1s. Jest 1507 green 3x, typecheck clean.
- **This PR (docs):** README's Easy view and chat claims made true (PM-R1, PM-R2), CLAUDE.md layout and Ring wording (PM-R6), TRACKER status sweep R40-R60 (PM-R3), `docs/eng/DEPLOYS.md` ledger (PM-R4), test-edit rule in TESTING.md (QA-R5), the old "repo stays private" note corrected (SEC-R5).
- **P0 PR (ENG-R1 + TD-UX-R1):** opening offline keeps the family saved on this phone (feed cache shows), or says "Can't reach Hearth" with Try again; the laptop demo's story panel scrolls instead of being cut. qa-tdd green 3x (jest 1510, typecheck, e2e:demo 27). Open P2s from qa-tdd: coming back to the front doesn't re-read the family (role changes wait for a relaunch); the offline screen has no Sign out.
- **P0 PR #127 merged** (b25d19a).
- **UX PR (TD-UX-R2/R3/R5/R6):** the Notice timing card shows only in debug builds; Help drops the wrong "You can look at photos and write back." line; the demo's Help hides Sign out and Take me off; Sign out and Take me off use one confirm dialog (Stay signed in / Sign out, Stay on Hearth / Take me off) and the old `Confirm` component is gone.
- **UX PR #128 merged** (1a20756), with QA-R1 (the fake web e2e config now ignores every demo-only spec).
- **Privacy and speed PR (SEC-R2, ENG-R7, ENG-R3):** the app no longer records who looked at a post (A2; threat model and API notes updated; the server's `mark_seen` stays until a migration removes it); `setReaction` drops the pre-0017 fallback (0017 is live); post cards follow only their own comments and draft, so typing in one comment box no longer redraws every card.
- **Privacy and speed PR #130 merged** (c61f1be).
- **CI PR (QA-R1..R4 of the review, ENG-R8):** `test-all.sh` runs app Jest, typecheck and both browser suites; a new CI job runs e2e:demo and e2e:web on every PR; the CI 3x rerun includes app Jest; e2e scripts find the browser without a hard-coded path; e2e/package.json carries the repo's license; sign-media gets a handler test for every branch (bounds, 402 cap, 403/400, PGRST301, no message text in logs, finalize sizes, CORS). Still open from QA-R4: serving the real function on edge-runtime in CI (P2).
- **CI PR #131 merged** (96729ff); e2e Playwright pinned to ~1.63.0 so CI's browser matches the sandbox (VID-18 failed on 1.56).
- **SEC-R1 PR:** migration 0027 keeps group titles with the parents (managers) in the raw API and the data export; relatives see only Everyone and event groups they're in. Merged as a file only: NOT deployed. `deploy.sh` applies every unapplied migration, so Chase's next "deploy" ships 0026 and 0027 together.
- **SEC-R1 PR #132 merged** (73f541f), migration file only.
- **ENG-R5 PR:** the Fake backend, the sample family and the laptop demo frame now ship only in fake and demo builds. Metro swaps `fakeRuntime` and `demo/DemoChrome` for `.off` stand-ins unless `EXPO_PUBLIC_HEARTH_FAKE` or `EXPO_PUBLIC_HEARTH_DEMO` is set; a real web export has no FakeBackend, sample family or demo strings.
- **Next exact step (after that):** the summary for Chase; open P2s are in `docs/reviews/2026-11-19-tech-debt/README.md`.

## Nov 19: demo bar review, no bar on a laptop (Chase, DEC-71, R60; branch claude/project-thread-mmmmnh, PR)
- **Chase:** "do we need the demo bar?" and its portfolio link went to an old page. Picked "Laptop off, phone stays slim".
- **Done, test-first:** DEMO-LINK-1 (`PORTFOLIO_URL` = `https://chaseholroyd.com/#p-hearth`, the portfolio's case study dialog; `family-photos.html` is orphaned, old nav), DEMO-LINK-2 (badge reads DEMO; small caps drew "DEмо"), DEMO-BAR-LAPTOP-1 (`DemoChrome`: at `WIDE` no bar, `DemoActions` in the `DemoFrame` panel under Try this; Try this step 2 says "below"). Phone unchanged apart from the link and badge.
- **Next exact step:** Chase says "merge 1NN"; the demo rebuilds; live check fresh and returning at 390 and 1280.
- **Portfolio / public presence:** the public demo loses its bar on laptops and its ways back open the current Hearth case study. Product Studio: redirect the orphaned `family-photos.html` (intake holroydchase-afk.github.io#75).

## Nov 19: Paper's light page is Linen #F7F7F4 and iPhone's own tab bar (Chase, DEC-69, DEC-70, RD-105..107, R58, R59; branch claude/project-thread-ox4dz4, PR)
- **Chase:** picked Linen `#F7F7F4` from six near-whites ("Remember barely warm. But go with linen for now"); Barely warm `#F9F9F7` is the runner-up. Dark `#131210` and the other themes unchanged.
- **Done, test-first:** tests retargeted to `#F7F7F4` (7 red), then `theme.ts` Paper light `bg`, `app.json` splash and adaptive icon, `docs/design/tokens.json` regenerated (the soft tints mixed into the page move with it). Persona check `decisions/2026-11-19-paper-linen.md` all Green.
- **Tab bar built (Chase: "Build them now"; DEC-70, RD-106/107, R59):** `usesNativeTabs(os, easyView)`: iPhone with Easy view Off uses `NativeTabs` (glass on iOS 26, classic before; labels hidden, spoken names, no background color); Easy view On keeps `HearthTabBar`. Android and web unchanged. Switching Easy view swaps the navigator, so it lands on Gallery. Needs an iPhone check in Expo Go.
- **Next exact step:** Chase says "merge"; the demo rebuilds; live check that the page computes `rgb(247, 247, 244)`.
- **Portfolio / public presence:** the public demo's light page turns Linen once this merges.

## Nov 18: themes built, Paper default, Avocado, Pomegranate (RD-94..RD-99, RD-104, DEC-68, R57; branch claude/project-thread-253q4i, local commit)
- **Engineer, jest 1476 green and typecheck:** `theme.ts` has `ThemeName`, `THEME_NAMES`, `ThemeContext` (replaces ColorContext / COLOR_NAMES) and one full palette per theme (spec values; Avocado and Pomegranate `surface` is halfway between page and fill; `photo` = fill; status colors shared, `safeSoft` and `accentSoft` mixed into each theme's page; high contrast picks light or dark from `accentInk`). `prefs.theme` (owner only, the old `color` key is not read or written). More's "Theme" row opens "Paper theme" etc. radios with a page-plus-accent swatch. Tab bar is `c.surface` with a 1 px `c.line` top border (RD-104). app.json splash and adaptive icon on Paper. `photoShadow` uses Paper's ink (`rgba(30, 27, 23, 0.1)`), same strength. tokens.json regenerated (`themes` replaces `colorChoices`).
- **GUX-R18 / R19 built (engineer, jest 1503 green, typecheck):** new `c.tabLine` (c.line nudged toward ink by the least 0.01 step that is 3:1 on surface and page, every theme x light/dark x high; e.g. Paper `#928E87` / `#696661`); tab bar top border uses it, `c.line` unchanged. Theme radios show a 48 pt split swatch (`swatch-<theme>`, `-page`, `-accent`) with a hairline `c.tabLine` edge. tokens.json regenerated. Next: grandparent-ux recheck.
- **Test edits for qa-tdd to confirm:** redesignPolish `PAGE_GRAYS` passed `'ember'` (type error now; changed to `'paper'`); plainBackground RD-34 allowlist gains `TabBar.tsx` `HearthTabBar` (RD-104 requires `c.surface` there).
- **Next exact step:** qa-tdd all suites 3x incl. `npm run e2e:demo` (RD-102; Playwright isn't installed under `e2e/node_modules` in this container, so it wasn't run), then grandparent-ux on shots of the three themes. Not pushed.

## Nov 18: grandparent-ux paper fixes built (GUX-R15 reworked to a stronger tint, R16, R17; branch claude/project-thread-iyml94, local commit)
- **GUX-R15 reworked (staff-pm, keeps Chase's Nov 5 LIVE-3 call):** no outline. The 1.5 pt reaction border and its -1.5 margin are gone; a picked capsule is the new `c.accentPicked` (accent mixed into the page, about 0.30 page in light and 0.47 in dark, nudged by 0.01 per family color so it is 3:1 on the page and the ink count 4.5:1 on it; light Forest lands at 0.29; high contrast recomputes it). `accentSoft` unchanged. tokens.json regenerated. Engineer, green once: jest 1416 (the 12 red pass), typecheck, build-demo, e2e:demo 25, e2e:web 5, e2e:site 14. Shots: `/mnt/project-files/design/2026-11-18-warm-picked-{light,dark}.png` (393 px).
- Still from the first pass: kit `Field` on iPhone and the web is a `c.fill` box with no border (GUX-R16); `safeSoft` mixed into the paper (GUX-R17).
- **Next exact step:** qa-tdd all suites 3x, then grandparent-ux on the picked shots (watch the red heart on the Ember tint). Not pushed.

## Nov 18: warm paper, photo shadows, reaction pop built (RD-84..92, DEC-67, R55; branch claude/project-thread-iyml94, local commit)
- **Engineer, green once (jest 1398, typecheck, e2e:demo 25 incl. RD-92, e2e:web 5, e2e:site 14 with build-demo):** `theme.ts` paper palette (light `#F1E9D2`, fill `#E6DFC9`, line `#DBD4BF`, ink `#1F1A14`, muted `#5E554A`; dark `#14100D`, ink `#F3EDE4`, muted `#B3AA9F`), Ember `#AD371D` and Forest `#276B43` in light (RD-86), `accentSoft` mixed into the page (high contrast recomputes it); tokens.json regenerated. `photoShadow(dark)` (boxShadow `0px 2px 12px rgba(31, 26, 20, 0.1)`, light only) on a wrapper around each Gallery, New for you and Feed collage tile (same sizing as the tile, so no layout change; New for you's scroll gets 8 pt room above and below with -8 margin so shadows aren't cut). PostCard `ReactionButton`: emoji in an `Animated.View` that pops 1→1.25→1 (100+120 ms, native driver on phones) on turn-on only, none with Reduce Motion; the count slot keeps one digit's width at 0 (empty View, 0.7 em x font scale). Web html/body follow `c.bg` (`_layout.tsx`). app.json splash and adaptive icon on paper. B20 fixed (case study says 67 decisions). DESIGN-SYSTEM Colors bullet and RD-88/89 notes (Chase's two calls) updated.
- **Test edits for qa-tdd to confirm (each marked "engineer, flagged for qa-tdd"):** warmPaper.test.tsx `tilesIn` (findAll already counts the node itself, so no wrapper could ever pass), reviewRound2 UX-R13 (a row kid may be a tile's wrapper), redesignLook RD-1/RD-3 (paper bg, paper-family grays, ink ≥ 14:1 since paper caps near 16), designSystem DS-11, familyColor and demo.spec RD-27 (new Ember/Forest), redesignLint accent list, redesignPolish GUX-R9 (palette grays count as neutral), videoGux title, plainBackground comment.
- **Shots:** `/mnt/project-files/design/2026-11-18-warm-{light,dark}-{gallery,feed}.png` (393 px). **Next exact step:** qa-tdd all suites 3x, then grandparent-ux on the shots, RD-93 on Chase's phone. Not pushed.

## Nov 18: warm paper, photo shadows, reaction pop specced (DEC-67, R55)
- **Staff-pm, docs only:** Chase picked mockup A's warm paper (his tested `#F1E9D2`; dark `#14100D`) and option C's photo shadows and reaction pop; no date line above the greeting. `SPEC-REDESIGN.md` 1h RD-84..93 (RD-1 and RD-34 superseded), DEC-67, persona check `decisions/2026-11-18-warm-paper.md` (LG Red, mitigated), DS-11 and DS-14 wording. Contrast worked out: Forest `#2E7D4F` misses on paper (4.2:1) and Ember is 4.5 on fill, so RD-86 darkens them in light mode. Engineer also updates DESIGN-SYSTEM's "Colors" bullet when built. Next (after #119 merges): qa-tdd red, engineer. Then R56 avocado and pomegranate palette mockups. Not pushed.

## Nov 17: Easy view specced (DEC-66, R54)
- **Engineer, GUX-R11 and RD-83 built:** Easy view's On/Off rows are kit `Choice kind="radio"` (accent check, 48 pt+); `Choice` now passes `aria-checked`. RD-83: Gallery's month title is one pinned block with the search bar: on the web it is CSS `position: sticky` at `top` = the search backing's height (no per-scroll JS, so no lag on iPhone Safari); on a phone it still moves by the scroll offset (JS-driven; native-driver follow-up if it lags in Expo Go). Title backing full width in `c.bg`; RD-82's shade moves under the pinned title. Jest, typecheck, demo, web, site e2e green once; shots `/mnt/project-files/design/2026-11-17-rd83-pinned-{down,back-up}.png`. Tests changed (engineer, flagged for qa-tdd): reviewRound2 R18 rewritten (T21/QA-R1), easyViewReview aria-checked read on the Pressable (RN folds it into accessibilityState on the host), photosStyle RD-44 skips month headers, demo.spec RD-83 backs up 250 not 500 (500 measured the release point) and checks sticky/no transform. Next: qa-tdd 3x, grandparent-ux. Not pushed.
- **Engineer, Easy view built (R54) plus RD-82:** `Prefs.easyView` replaces bigText (viewer On, owner/adult Off; saved bigText migrates, saves drop it). Off: icon-only tabs (Android's own bar unlabeled) keeping spoken names; On: words under tabs and 21 pt text. More row "Easy view" with On/Off, page with one line and On/Off rows; Me shows the same block. RD-82: Gallery's pinned Search photos backing spans the screen in `c.bg`, hairline shade once scrolled. Jest, typecheck, demo, web, site e2e green once. Updated tests (flagged for qa-tdd): redesignNav, redesignPolish, reviewRound2, hig, tabs, plainBackground, help, demoMe, screenColors, searchBacking (helper picked the scroll, not its content), demo.spec.js RD-27 and RD-9. Next: qa-tdd 3x, grandparent-ux, RD-81 on phones. Not pushed.
- **Staff-pm, docs only:** Chase: Easy view On for grandparents (viewer), Off for parents. One More setting replaces Bigger text: words under tabs plus bigger text; icon-only tabs keep spoken names and 48 pt; saved bigText carries over; demo Chase Off, Grandma Jo On. `SPEC-REDESIGN.md` 1g RD-74..81, persona check `decisions/2026-11-17-easy-view.md` (FA Red, mitigated), CLAUDE.md rule 3, DS-3/5/10, AGENT-NOTES (engineer) updated by hand to match `sync-agents.sh` output (no studio-agents clone here; `--check` passes). Next: qa-tdd red tests, then engineer.

## Nov 18: milestone and testing status taken out of the README and case study (Chase's correction; TRACKER R50; branch claude/project-thread-9m9i56, PR)
- **Chase:** "we shouldn't have any info about my milestones or releases or testing... those were randomly generated by you to create some guiding gates."
- **Done (docs only):** README Status now says what works, what is switched off and the known limits; no milestones, user count, beta target or tracker link. Case study loses "What isn't proven yet" and the milestone line in "What's next". The review file carries a correction: the finding that scored Hearth against the tracker's gates is withdrawn; backlog item 2 is now "keep planning scaffolding out of the public story".
- **Rule for agents:** milestones, gates and dates in TRACKER, MILESTONE-1, REMAINING and BETA-SPEC are agent-written guides. Never present them as Chase's commitments, and never report progress against them on a public page.
- **Open, Chase's call:** whether those planning docs stay in the public repo at all.
- **Portfolio / public presence:** the README's Status section changes when this merges.

## Nov 18: portfolio review from three seats; item 1, the front door is true (TRACKER R49..R53; branch claude/project-thread-9m9i56, PR)
- **Done:** a blunt review as a recruiter, a staff PM and an engineering manager: `docs/reviews/2026-11-18-portfolio-review.md` (full version with citations: https://claude.ai/artifact/NrhDHPJuKetHTXkGs5HYpZ). 15 ranked items; the top five are TRACKER R49..R53.
- **Built (docs only):** README and case study now match the live demo. Totals rerun today: 1,291 app tests in 141 files, 1,199 database checks (`scripts/test-totals.sh`; jest and backend SQL each ran once, green). Three current screenshots in `docs/portfolio/screens/` (`iphone-gallery.jpg`, `iphone-feed-who-can-see.jpg`, `iphone-grandma-jo-feed.jpg`, from a local demo build of main; the old `iphone-0*.png` files stay because the portfolio site may link them). README: search listed as built, a Status table (proven, not proven yet, built but switched off, next), Lessons in "Start here". Case study: 65 decisions, "What went wrong", "What isn't proven yet". LESSONS: the Oct 29 real-names post mortem, written up from HANDOFF and TRACKER R26.
- **Found on the way:** `app/e2e-web/demo-screens.spec.js` fails since the redesign (it waits for "Bridge walk on the trail" on the first screen), so the documented way to retake portfolio screenshots is broken; in R52. Local backend runs need a Postgres role for the shell user (`createuser -s root` in a cloud container).
- **Not done:** no app, backend or workflow file changed. The demo guide's "the family here is made up" line (`app/src/demo/DemoFrame.tsx`) is review item 13, left for the redesign thread's files.
- **Next exact step:** Chase runs the 2-day demo (TRACKER step 9) so R50's scorecard has numbers; meanwhile R51's failing test.
- **Portfolio / public presence:** the repo's README changes when this merges. The portfolio page's Hearth counts (1,011 app / 1,199 database in intake #66) are now behind on app tests: 1,291.

## Nov 17: returning visitors see the current demo family (DEMO-FRESH-1..3, TRACKER R48; branch claude/project-thread-s1r7xd, PR)
- **Done, test-first:** `freshenDemoStorage` in `app/src/demo/seed.ts` runs before `runtime.ts` reads the saved demo; a missing or different `hearth.demoSeed` clears Hearth's demo keys (as Start over) and saves the current version. Tests: `app/src/demo/__tests__/demoFreshen.test.ts`, e2e `DEMO-FRESH-1` in `app/e2e-web/demo.spec.js`.
- **Why:** Chase saw the old demo (Kai) after #116/#117 went live; see `docs/eng/LESSONS.md` Nov 17.

## Nov 17: review rounds 4-6 done; round 6 fixes built (UX-R39..R40; branch claude/project-thread-iyml94, local commit)
- **Engineer:** New for you "See all" has 16 pt side padding and -16 right margin (box ends at the screen edge, words on the gutter), min height 48. Comment input line is 1.3x the text rounded to even (`commentLine` in PostCard: 22 at 17 pt, 28 at 21 pt Bigger text; not `t.line`, which gives 27) in (48 - line)/2 padding, so it stays 48 tall and centered on Post. Green once: jest 1288, typecheck, demo site rebuilt, e2e:demo 20 (stray :8090 server reused via scratch config), e2e:web 5.
- **Next exact step:** qa-tdd all suites 3x, then ux-reviewer round-6 recheck. Not pushed.

## Nov 17: review round 4 fixes built (UX-R31..R35; branch claude/project-thread-iyml94, local commit)
- **Engineer, green once (jest 1277, typecheck, e2e:demo 20, e2e:web 5):** web comment field: browser outline off, 2 pt accent ring on the rounded edge while focused (kit `useWebFocusRing` / `noWebOutline`, so RD-4 keeps c.accent in the kit). Feed description has no name prefix; a title reads "Title – words". Own-post Post options: no heading, "Shared with <group>, N people", then Edit description, Delete post; members keep the heading and get "... can see this." in c.ink. Bigger text names one person then "and N more"; who line sits 12 pt under the time in both views (flex-start + 8 pt padding).
- **Test edits for qa-tdd to confirm (each marked "engineer, flagged for qa-tdd"):** QA-R2 photosStyle RD-50; photosStyle RD-48 x2 (UX-R32, `descriptionOf` removed); photos BETA-AUD-1 and moments MOMENT-6 ("·" to ","); moments MOMENT-6 viewer and who WHO-7 (period, UX-R34); photos BETA-AUD-10 and who WHO-10 (Jo's Bigger text, UX-R35); redesignPolish GUX-R6 x2 now set bigText off to keep RD-70's two names; e2e core-loop line 59.
- **Next exact step:** qa-tdd all suites 3x, then ux-reviewer round-4 recheck. Not pushed. A stray `serve-dist.js dist-demo 8090` from an earlier run was still up; e2e:demo ran against it (same fresh build) via a scratch reuse config.

## Nov 17: review round 3 fixes built (UX-R24..R30, RD-67..73; branch claude/project-thread-iyml94, local commit)
- **Engineer, green (jest 1265 x3, typecheck, e2e:demo 20, e2e:web 5, e2e:site 14):** Delete post opens `AlertDialog` (kit): "Delete this post?", Semibold "Keep it" in ink, Regular red "Delete", no fills. New `c.dangerText` token (light #B3261E, dark #FF453A) for red words; `c.danger`/`onDanger` unchanged so the filled-button contrast pair holds. Month title has 12 pt under it. "Same people" line only while the field is focused or holds words. `namesLine`: two names then "and N more", one name when the line passes 44 characters. Title opens the description in Medium (`post-title-<id>` testID kept on it), name shown only when there's no title. Exactly 2 photos in a month are two squares.
- **Test edits for qa-tdd to confirm:** old tests that still held the replaced behavior: changeWords CAP-6/7 (title header to text in `desc-`), photosStyle RD-50 (new Delete words), photos BETA-AUD-10 (/Earl/ to /and 1 more/, RD-70), plainBackground allowlists `AlertDialog`; tokens.json regenerated.
- **Shots:** `/mnt/project-files/design/2026-11-17-r4-*.png`. **Next exact step:** qa-tdd all suites 3x, then ux-reviewer and grandparent-ux on the r4 shots. Not pushed.

## Nov 17: review round 2 gate green; round 3 failing tests (UX-R24..R30, RD-67..73; branch claude/project-thread-iyml94, local commit)
- **QA green (r38):** all suites 3x green at 1ea6b4f (jest 1249, typecheck, e2e:demo 19, e2e:web 5, e2e:site 14, backend SQL 0 failed, agents.verify). Engineer test edits (MOMENT-1, BETA-AUD-1, core-loop via Post options; T20 waits) weaken no guarantee (`e2e/results/rd-56-green-3x-2026-11-17.txt`).
- **qa-tdd, red on purpose (r39):** new `app/src/screens/__tests__/reviewRound3.test.tsx` (contract in its header), UX-R30 in `feed/__tests__/gallery.test.ts`, UX-R27 at 390 px in `e2e-web/demo.spec.js`. jest 20 failed (13 new, 7 moved), e2e:demo 1 failed, e2e:web 1 failed (core-loop's new Delete words). Moved: moments, sessions, photos, reviewRound1, reviewRound2, redesignPolish, who, captions, core-loop (`e2e/results/review-r3-red-2026-11-17.txt`).
- **Next exact step:** engineer builds RD-67..73. Watch: a dark #FF453A as `c.danger` breaks designSystem's onDanger-on-danger contrast pair unless the filled danger button keeps its own color. Not pushed.

## Nov 17: review round 2 fixes built (UX-R13..R23, RD-56..66; branch claude/project-thread-iyml94, local commit)
- **Engineer, green (jest 1249 x3, typecheck, e2e:demo 19, e2e:web 5, e2e:site 14):** Gallery has one wide photo per month, quiet days join into ranges ("Nov 2–8"), and no square sits alone (`feed/gallery.ts` `mosaicRows`). The group date shows once above each group. The search field is now the scroll's sticky header (index 1), and month titles stick under it with an Animated translate (`GalleryGrid.tsx`; on the web, places are re-read via offsetTop because onLayout misses moves). Post options use plain rows with red "Delete post" text, and the confirm still asks. The card has one who-can-see line, with no "Sent to" and no reader line on your own post. There's no Comments heading; one rounded field holds Post inside. More uses outline icons and inset `MenuLine`. Share's sections are plain blocks on one 16 pt edge. Small tiles show a spinner spoken "Loading". The first emoji sits on the 16 pt edge. Names follow Bigger text. Month titles are h2.
- **Test edits for qa-tdd to confirm:** moments MOMENT-1, photos BETA-AUD-1 and e2e core-loop still expected the card's "Sent to" line. RD-58 removes it, so they now check the names line and the group name in Post options. T20: familyColor RD-24/25 now uses 4 s waits plus a waitFor on the reopened color (a wait fix only).
- **Not on a phone yet:** the sticky month (custom Animated) and the sticky search (native stickyHeaderIndices) need an iPhone and Android look (RD-28). A month with exactly 2 photos still shows one square alone, because the wide photo plus one square leaves no other option.
- **Shots:** `/mnt/project-files/design/2026-11-17-r3-*.png`. **Next exact step:** qa-tdd all suites 3x, then ux-reviewer and grandparent-ux on the r3 shots. Not pushed.

## Nov 17: round 2 built, Apple Photos months, Search photos field, Instagram-style posts (RD-44..55, DEC-65; branch claude/project-thread-iyml94, local commit)
- **Engineer, green:** Gallery = 34 pt Semibold greeting, a "Search photos" field (a 48 pt button that opens Search; pins under the bar on scroll), New for you, then months: month 24 pt Semibold, day groups with a wide 3:2 opener (most-loved, else newest) and the day number on a radial fade, squares 3 across, 16 pt corners, 8 pt gaps, 16 pt margins (pure layout `feed/gallery.ts`, tests `feed/__tests__/gallery.test.ts`). Top bar has no buttons; By date opens only from Feed's Older photos ("Back to Feed"). Posts: face + name (Medium), "⋯" Post options (Edit description, Delete post for own), mosaic max 4 with a solid "+N" chip (`collageTiles`), 4 emoji each with its count (value read out), "<name> <words>", `relativeTime`, who line, comments; no lines, 32 pt apart; Feed list has no side padding (card owns its 16 pt edge). No Bold: `WEIGHT` is regular/medium/semibold; `RADIUS.photo` 16; tokens.json regenerated.
- **Test edits for qa-tdd to confirm:** photosStyle RD-53 uses Alex not Earl (Jo may not see a relative's reaction, AUD reply scope) and RD-48 maps the composite description Text to its host; old stale tests moved: opening OPEN-9 (squares, not the wide opener), OPEN-10 (full month), OPEN-7 and moments MOMENT-1 (name also in the description), search SEARCH-UI-1 (field, not top bar), photos/sessions "1 love" label → Love it value 1, captions CAP-4 (folds the `desc-` Text), plainBackground allowlists `SearchField`; e2e `name: 'Post'` now `exact: true` (collides with "Post options").
- **QA green (r37):** all suites 3x green at f731805 (jest 1227, e2e:demo 17, e2e:web 5, e2e:site 14, backend SQL 0 failed, agents.verify); engineer test edits reviewed, none weakens a guarantee (RD-53 Alex matches BETA-AUD-8); new `app/src/screens/__tests__/groupTitles.test.tsx` holds DEC-49 both ways on the new Feed and Gallery (`e2e/results/rd-44-green-3x-2026-11-17.txt`).
- **Not on a phone yet:** the day-number fade uses RN 0.88 `backgroundImage` (check RD-28 on iPhone and Android). RD-49 profile photos still a todo (initials).
- **Next exact step:** qa-tdd all suites 3x; grandparent-ux and ux-reviewer on `/mnt/project-files/design/2026-11-17-r2-*.png`. Not pushed.

## Nov 17: review round 1 built (UX-R1, R2, R5..R10, R12; RD-35..43, DEC-63, DEC-64; branch claude/project-thread-iyml94, local commits)
- **Engineer, green:** tab bar hides while any field is focused (`app/src/ui/typing.ts`; comes back 250 ms after blur; web keeps the field in view on visualViewport resize; iPhone uses KeyboardAvoidingView in the walk and keyboard insets on Feed/Screen). Walk: one `walk-bar` under the scroll (Previous off on the first, "Next photo"/"Done"), post edge to edge with one 16 pt edge, Back and Options in ink. Comments: no 💬; "Comments" heading, "Add a comment…" field, Post text button; "Your comment goes to the same people." when readers equal viewers. Gallery grid edge to edge. Demo parent is Chase.
- **Tests moved by engineer (qa-tdd please confirm):** photos.test BETA-AUD-10 now expects the "same people" line (RD-42 conflicted with it); UXG-07 allows the one word "Post" (DEC-63).
- **Persona checks:** `docs/product/decisions/2026-11-17-no-comment-emoji.md`, `2026-11-17-demo-parent-is-chase.md` (all Green). Screenshots `/mnt/project-files/design/2026-11-17-r1-*.png`.
- **Next exact step:** qa-tdd all suites 3x; grandparent-ux recheck; manual M-19 on a real iPhone keyboard. UX-R3, R4, R11 wait on Chase. Not pushed.

## Nov 17: review round 1 failing tests (UX-R1, R2, R5..R10, R12; RD-35..43, DEC-63, DEC-64; branch claude/project-thread-iyml94, local commit)
- **qa-tdd, red on purpose (run r33):** new `app/src/screens/__tests__/reviewRound1.test.tsx`; e2e `demo.spec.js` UX-R1 (keyboard), UX-R7 (edge-to-edge grid; tiles are already square), UX-R12 (greeting "Chase"). Contract in the test file's header: tab bar hides while any field is focused; `walk-bar` outside the scroll, Previous always there (off on the first), forward spoken "Next new photo", shown "Next photo"; "Comments" heading, field "Add a comment…" spoken "Add a comment for <sender>", Post text button; "Your comment goes to the same people." only when readers equal viewers.
- **Old tests moved to the new words:** moments (REACT-7 four emoji; MOMENT-4 cursor test retired), photos, familyShape, sessions, redesignNav, opening (OPEN-7/8 Previous on every step), redesignPolish, redesignGallery, seed DEMO-3 and demoBar (Chase), core-loop/demo/demo-showcase/site specs.
- **Next exact step:** engineer builds against them; manual M-19 on a real iPhone keyboard. Persona check for DEC-63 not written (staff-pm). `e2e/results/review-r1-red-2026-11-17.txt`. Not pushed.

## Nov 16: the demo shows Chase's own photos (DEC-62, TRACKER R47; branch claude/project-thread-s1r7xd, PR)
- **Done, test-first:** `app/public/demo-pictures/` now holds 10 of Chase's photos (beach, dunes, museum, playground, porch, bike, splash, bridge, overlook, hug), re-saved from HEIC with no EXIF/GPS/XMP, 1200px long side, 400px thumbs. `DEMO_PICTURE_SIZES` in `app/src/demo/pictures.ts` gives each its own shape. `DEMO_POSTS` captions match the photos; "lake" still finds one photo; Alex's two new posts are the overlook and the hug.
- **Tests:** `app/src/demo/__tests__/realPhotos.test.ts` (DEMO-PHOTO-1..3); e2e captions moved to "Bridge walk on the trail", "Bike day at the lake", "Life jackets on and in all afternoon".
- **Next:** Chase's "merge"; then regenerate `og-hearth.png` in the new look with a real photo.

## Nov 16: plain white content, names on posts, less clutter (RD-34, DEC-60, DEC-61; branch claude/project-thread-iyml94, local commit)
- **Done, test-first (qa-tdd's red tests d6734ab, 241b265):** kit `Card` is plain (no fill or outline); new kit `GroupedSection` keeps the grey grouped look, used only on More's settings screens (Preferences, Me, Help, Your name, Notice timing). Post cards sit on white/black with a hairline under each. Tab bar and native tabs on `c.bg`. The card's who-can-see line is names ("Alex, Grandma Jo and 2 more can see this."), people only; tap still opens the Who sheet. "Tap a photo to start" and the demo's numbered steps are gone (`demoTip` returns null).
- **Test changes to tell qa-tdd:** chief of staff's call, text input fields (Share caption, reply) may keep their grey fill: `plainBackground.test.tsx` allows `TextInput` and kit `Field`; SPEC RD-34 line says so. `redesignLook.test.tsx` RD-8 corner and no-nesting checks now target `GroupedSection` (Card is plain by RD-34).
- **Shots:** `/mnt/project-files/design/2026-11-16-nogrey-*.png`.
- **QA green (r32):** all suites 3x green at 7ac44ff, test edits reviewed, no guarantee weakened (`e2e/results/rd-34-green-3x-2026-11-16.txt`).
- **Next exact step:** grandparent-ux recheck on the nogrey shots. Not pushed.

## Nov 16: redesign polish built (GUX-R1..R5, R7..R10; branch claude/project-thread-iyml94, local commit)
- **Done, test-first (qa-tdd's red tests at ad655d6):** kit `BackButton` is now a top-left text button (chevron + place word, accent, 48 pt, spoken "Back to More"/"Back to Gallery"; optional `label` keeps "Back to events"/"Back to all messages") above the title on every More sub-screen, Search, By date, Events, Messages and the walk. `Choice` is a plain grouped row (no border or tint): radio shows an accent check at the end, checkbox an empty circle that fills with an accent check. Share's Pick/Remove buttons are quiet text buttons. Post "··· More" is "Options" ("Options for this photo/these photos"). Feed's title is "Feed". Demo tip: "a parent's Gallery". Done on the walk clears New for you for those posts (in memory; the next load's save covers the rest). Previous left, Next/Done right on one row. Avatars and Who faces neutral grey (`c.line`). Help drops Bigger text and Light or dark, names the inviter with the number and a Call button, and shows the owner no "ask someone" card.
- **GUX-R6 not built (waits on Chase: names vs initials, reverses WHO-10 / LIVE-4):** its three names-line tests are `it.skip`; the privacy and Who-sheet ones run (they hold today). who/firstMin initials tests restored to guard today's circles.
- **Web note:** the web build shows Material icons (arrow_back, check_box), so the demo's back button reads "← More"; iPhone gets the chevron.
- **Next exact step:** qa-tdd all suites 3x; grandparent-ux on shots `polish-*.png` (session scratchpad). Not pushed.

## Nov 15: redesign 1c built, Gallery grid and New for you (RD-18..23; B19 fixed; branch claude/project-thread-iyml94, local commits)
- **B19 / QA-R1, QA-R4 (commit 1):** `app/src/app/groups|me|help.tsx` redirect to `/more?open=<row>`; `MoreScreen initialOpen` opens it only if the role has that row (a viewer asking for Groups gets the menu). `build-demo.sh` copies index.html for those routes. "Back to Photos", "Done, back to Photos", "Go to Photos" now say Gallery. Tests: `oldTabLinks.test.tsx`, DEMO-5 (now also /help and checks Back to More).
- **1c (commit 2):** `feed/gallery.ts` (months, sorted by date taken else shared: QA-R2, written into SPEC RD-18), `screens/GalleryGrid.tsx`, `NewForYouRow` in `NewForYou.tsx` ("N new" accent chip on the first tile, 12 pt corners, "Tap a photo to start", "From Alex since Thursday" per QA-R3, See all text button). Gallery is a ScrollView; Feed keeps the list, "Sent by" and Older photos cards. PhotoWall removed. Demo "Try this" step 1 reworded.
- **Tests moved (flag for qa-tdd):** e2e-web `core-loop`, `perf`, `video` open the Feed tab before reading captions (perf goes back to Gallery to time it); `site.spec` RR-15 taps a grid tile instead of "Open photo 1 of". Guarantees unchanged.
- **Next exact step:** qa-tdd all suites 3x; grandparent-ux on shots `1c-*.png` (session scratchpad). Demo tip still says "a parent's Photos" (words pass). Not pushed.

## Nov 15: redesign 1c failing tests written (RD-18..23, RD-8 New for you corners; branch claude/project-thread-iyml94, local commit)
- **qa-tdd, red on purpose (run r27):** `app/src/screens/__tests__/redesignGallery.test.tsx` (new) plus the old rules moved over: `opening.test.tsx`, `timeline.test.tsx` (BETA-TIME-1 card now checked on Feed), `demoFrame.test.tsx`, `e2e-web/demo.spec.js`, `e2e-web/site.spec.js`. Jest 44 red the same on 3 runs; typecheck clean. The engineer's contract (header of redesignGallery): testIDs `gallery-grid`, `gallery-tile-<mediaId>`, `new-for-you`, `new-tile-<mediaId>`; a "See all" text button; Gallery shows no post cards and no "Sent by" line (spec: greeting then grid); "See the new photos" and All photos go.
- **Open calls:** where old photos added today sit in the grid (QA-R2); the today form of the sender line, assumed "From Chase today" (QA-R3); the walk's "Back to Photos" words with no Photos tab (QA-R4). `e2e/results/rd-1c-red-2026-11-15.txt`.
- **Next exact step:** engineer builds 1c against these tests; fix B19 (1b's /groups and /me links) first.

## Nov 15: redesign 1b built, getting around (RD-9..17; branch claude/project-thread-iyml94, local commit)
- **Done, test-first (qa-tdd's red tests at 2613c20):** tabs Gallery, Share, Feed, More (viewers Gallery, Feed, More), routes `(tabs)/gallery|share|feed|more`, the app opens on `/gallery` (old `/photos` links redirect). Gallery (`GalleryScreen` = `PhotosScreen mode="gallery"`): "Good morning/afternoon/evening, <family name>" large title (`ui/greeting.ts`, from `myProfile`, never an email) that folds into a solid top bar on scroll (`GalleryTop.tsx`; shrinks, or fades with Reduce Motion); top bar right is only Search and By date; New for you, All photos, then today's posts (1c replaces this). The old toolbar is gone. Feed (`FeedScreen`) = today's post list, title "Photos of <family>", no New for you (Gallery alone moves the last visit). More (`MoreScreen.tsx`): full-width rows (kit `MenuRow`: icon, word, chevron) in spec order with role filtering; each opens today's screen with "Back to More"; tapping the More tab again shows the menu. Family color moved from Me to More (owner only). RD-14: `messenger/newMessages.ts` counts others' message rows since the last one seen on this phone (KV `hearth.chatSeen.v1.<user>.<chat>`, never decrypted, never sent), dot on More's tab ("More, new message"), "N new" on the Messages row; opening a chat marks it seen. Architecture 06 updated. Android native tabs get a Badge (not checked on a phone).
- **Tests changed (plainly wrong, flagged for qa-tdd):** `redesignNav` RD-16 used `findByRole` for "Open the chat" but Jo has two chats (now `findAllByRole`); `demo.spec.js` RD-9/10/15 read More's rows before the menu drew (now waits for the More heading) and asserted the file-wide `errors` list, which holds HARD-7's deliberate storage error (now only errors from this test); `core-loop.spec.js` signOut matched the row "Me" by substring, which also hits "Write a comment" (now `^Me(,|$)`); `site.spec.js` DEMO-5 path `/photos` is now `/gallery`. Tab `aria-selected` added for the web.
- **"Feed" word bans:** none tripped. Feed's large title stays "Photos of <family>", so no test that bans "feed" on a screen needed changing; staff-pm to confirm the title (Apple would title it "Feed").
- **Waits on Chase:** CLAUDE.md rule 3 words line and `docs/eng/AGENT-NOTES.md` (then `sync-agents.sh`, which needs a studio-agents clone) still say "Photos (not feed)". New text: "Words: group (not circle); tabs Gallery, Share, Feed, More (DEC-59)". Not edited by the engineer (CLAUDE.md and agent config need Chase's own word).
- **Next exact step:** qa-tdd runs all suites 3x; grandparent-ux on the shots (session scratchpad `shots/1b-*.png`); then 1c (RD-18..23). Not pushed.
- **qa-tdd gate (run r26): red on one suite.** Requested suites 3x at f2695cb, same counts each run: jest 1087/0, typecheck, e2e:demo 11/0, e2e:web 5/0, backend 1208/0, agents.verify OK; the four test edits above hold their guarantees. But e2e:site (run once) fails DEMO-5's cold loads of `/demo/hearth/groups` and `/me`: 1b removed those routes and only `/photos` redirects (QA-R1, P1, ticket B19; the demo-site pre-upload check would stop the deploy). Engineer: redirect them (likely to `/more`) or staff-pm retires them from DEMO-5. Deno, CI not run. `e2e/results/rd-1b-green-3x-2026-11-15.txt`.

## Nov 15: redesign 1a built, the look (RD-1..8, RD-24..27; branch claude/project-thread-iyml94, local commit)
- **Done, test-first (qa-tdd's red tests at 652a1d6):** `theme.ts` white/true-black neutral palette, one `accent` per family color (Ember, Forest, Plum; Sage gone), high-contrast set kept; phone's own font, `WEIGHT` Regular/Semibold, Bold only in the large title; Atkinson and `@expo-google-fonts/atkinson-hyperlegible-next` removed (package.json + lock, one line; `expo-font` kept for the app.json plugin); `RADIUS.large` gone; outline icons; filled buttons only per RD-7 (others `secondary`, the main tap word the new `tinted` capsule, the demo's "Read the case study" a text link); "Family color" picker on the owner's Me (`FamilyColor` in Preferences.tsx), saved in `prefs.color`, others Ember (`loadPrefs` by role, sage→forest); launch screen white/black; `docs/design/tokens.json` regenerated.
- **Tests changed (stale against RD-7/RD-8, flagged for qa-tdd):** `a11ySweep` DS-13 corners now `[4, 12, 999]`; `opening.test.tsx` OPEN-4/OPEN-7 "filled" now means the accent-tinted capsule; `redesignLint` RD-7 confirm allowlist adds "Yes, sign out" (SPEC RD-7 line added).
- **Next exact step:** qa-tdd runs all suites 3x; grandparent-ux on the new look (shots in the session scratchpad); then 1b. Not pushed.

## Nov 15: redesign specced (DEC-59, `SPEC-REDESIGN.md` RD-1..33, TRACKER R46; branch claude/project-thread-iyml94, docs only)
- **Why:** Chase, Nov 14-15, picked look B ("black and white and an accent", "Go with the 4 new chip on the pic", "Make the color a variable that can be set in the admin", "Go Claude go"). Persona check `decisions/2026-11-15-redesign.md`: CU Red on the word "Feed", Chase override. DESIGN-SYSTEM DS-3, -7, -9, -11, -12, -13 rewritten.
- **Next exact step:** qa-tdd writes RD-1..8 (phase 1a, the look) red; engineer builds; one PR. Then 1b (RD-9..17), then 1c (RD-18..23). Family color phase 1 = owner-only picker on `prefs.color` (owner's phone only; everyone else Ember); phase 2 `spaces.accent` after the beta.
- **Open:** CLAUDE.md rule 3 and `docs/eng/AGENT-NOTES.md` still say "Photos (not feed)" and "Help (not Me)"; update them (then `sync-agents.sh`) in the 1b PR.

## Nov 13: the demo opens on New for you, with a link preview (TRACKER R45 step 2; branch claude/project-thread-s1r7xd, PR)
- **Done, test-first:** `seedDemo(be, load, kv)` writes a last visit 3 days ago for Kai and Grandma Jo (kept if one is saved; Start over clears it) and two new posts from Alex (Apple picking, First snow), so a first visit lands on the New for you card (DEMO-NEW-1..5). New drawings `apples` and `balloons` (`make-demo-pictures.py [name ...]`); no drawing repeats (DEMO-NEW-3). Laptop Try this: See the new photos, See it as Grandma Jo, Search for lake (DEMO-NEW-6). `scripts/add-site-meta.sh` adds a description, Open Graph and Twitter tags and `og-hearth.png` (made by `scripts/make-og-picture.py`) to the site build only (DEMO-META-1/2, `site_meta_test.sh` in test-all). Proof pill now "Stored in the US", the claims register's words (POS-R1). Photos toolbar: when its buttons don't fit one row (bigger text), two to a row instead of one left alone (TOOLBAR-1, UX-R1).
- **Reviews:** positioning (POS-R1 fixed; POS-R2 P2 "groups you pick" left). ux-reviewer showcase 8/10, UX-R1 P1 fixed; P2s left: UX-R2 (phone tip steps style), UX-R3 (reply placeholder cut off), UX-R4 ("Sent since Tuesday by Alex" wording, grandparent-ux's call), UX-R5 (the preview says Hearth without "working name").
- **Portfolio / public presence:** the live demo changes when this merges: New for you first, new Try this steps, link previews on LinkedIn and texts.

## Nov 13: the public demo is checked before and after it goes live (TRACKER R45 step 1, DEMO-LIVE-1..4; branch claude/project-thread-s1r7xd, PR)
- **Why:** Chase, Nov 13: "a stable, quality version demo on the site". Plan: https://claude.ai/artifact/KfZxVmpdEa8qRAh5BfMPne. Live audit that day: 8/8 site checks on chaseholroyd.com/hearth/, desktop and phone (light and dark) walk with 0 errors; gaps G1 (New for you never shows in the demo), G3 (no link preview), G4 (guide steps out of date) are steps 2 and 3.
- **Done, test-first:** `e2e/site-target.js` (DEMO-LIVE-1, jest `siteTarget.test.ts`): `SITE_URL=https://…` points the site checks at the live demo with no local server. `site.spec.js` adds DEMO-LIVE-2 (Search "lake" finds 1 photo), DEMO-LIVE-3 (All photos wall), DEMO-LIVE-4 (`version.txt` names the commit; `build-demo.sh` writes it from `GITHUB_SHA`, else `local`). DEMO-5's failed-request check only counts the demo's own files (ARCH-R3). `demo-site.yml`: the checks run on the build before upload; a `live-check` job waits until the live `version.txt` is this commit (ARCH-R1), runs once with `--max-failures=1` (ARCH-R2), and also runs daily at 11:17 UTC (ARCH-R4).
- **If live-check is red:** the live demo needs a look; re-run demo-site by hand (Run workflow) on the last good commit.
- **Portfolio / public presence:** no visible change to the demo in this step.

## Nov 11: New for you opening screen built (OPEN-1..11, DEC-58, TRACKER R44; branch claude/project-thread-eh13m5, local only under the GitHub hold)
- **Done:** `feed/newForYou.ts` (others' posts since the last visit, oldest first; "New since Today/Yesterday/Monday/Nov 4"), `state/lastSeen.ts` (`hearth.lastSeen.v1.<user>`, on this phone only, read once when Photos loads then set to now), `NewForYouCard` + `OneAtATime` (`screens/NewForYou.tsx`), `PhotoWall.tsx` (month headers, three columns, Show older photos), Photos toolbar "Wall" (now "All photos", below). `PhotoCollage` tiles can now come from several posts. No server change.
- **Test changed:** OPEN-10's `waitFor` uses `.length).toBe(21)` instead of `toHaveLength(21)`: a failed toHaveLength pretty-prints every tile's React fiber, which blocked waitFor past its timeout (74 s, red even with the right UI).
- **Open:** Back is hidden on the first new post (no dead button), spec says Back and Next; staff-pm/grandparent-ux to confirm. Not pushed (GitHub hold); not tried on a phone.
- **GUX-R1..R8, QA-R1 built (Nov 11, later; OPEN-12):** "Sent today by Chase and Alex" / "Sent since yesterday|Tuesday|Nov 3 by …" (`newSinceDay` lowercase today/yesterday); no collage until a photo is ready; heading "New photos: 1 of N"; filled full-width Next always first, full-width "Previous" (spoken "Previous new photo") under it from step 2, last step "Done" (spoken "Done, back to Photos"); toolbar "All photos" (spoken "See all the photos, three to a row"). Last visit is now saved only after the first successful network load, as that load's start time (`FeedState.fetchedAt`); a failed or offline load saves nothing. `Txt` got an optional `label` (screen-reader words). Supersedes the "Open" Back note above. App jest green 3x (996 passed, 1 skipped), typecheck clean.
- **Next exact step:** qa-tdd runs all suites 3x; then grandparent-ux re-checks the card and one-at-a-time words; then a phone check.

## Nov 10: video part 2, poster frame and player (VID-14..18, 20, 21; SPEC-MEDIA 4.1, TRACKER R27; local only under the GitHub hold, branch claude/project-thread-ontg2j)
- **GitHub hold (Chase, Nov 10):** no push, PR, merge, deploy, CI or Actions until Chase says "lift GitHub hold". This work is local commits only.
- **Done:** `prepareItem(item, deps?)` sends a video: cleaned MP4 as `display`, a JPEG poster as `thumb` (expo-video frame at 1 s, or 0 for clips under 1 s, re-encoded through the photo thumb steps; `src/media/expoPoster.ts`); no frame → the plain dark `app/assets/video-poster.jpg` (inlined in `videoPosterPlaceholder.ts`), still sends, nothing logged. `MediaCache.videoUri` decrypts into `<media_id>.mp4` (`platform/videoFiles.ts`; a blob: URL on web), deleted on Close, sign-out and start-up. `VideoPoster` ("Play" word button at the poster's bottom left, label "Play video"; the rest of the poster opens the post screen) on Photos, the post screen, Events and By date; `VideoPlayer` full screen in place (see GUX-R1..R4 below for its final words and behaviour). Bulk pick sends videos when `video_posting` is on (`planBatch(..., { videos })`). No migration, no deploy; `video_posting` stays off in production.
- **Also fixed:** the web picker gives video length in seconds, phones in ms (`pickedDurationMs`, engineer-written test `pickDuration.test.ts` for qa-tdd to review). Web e2e: the pinned Playwright browser isn't found here; run with a throwaway config setting `launchOptions.executablePath: '/opt/pw-browsers/chromium'`.
- **GUX-R1..R4 and QA-R3 built (Nov 10, later):** on the post screen and By date the whole poster is the Play video button; the player is on the color's dark palette; one Play tap plays with sound ("Turn sound off"/"Turn sound on"); can't-play words name who to call (`cantPlayVideo` in errors/messages.ts); a web picker length of 0 is unknown (null) and refused. qa-tdd then updated VID-18 to match GUX-R3.
- **Not built:** "Save to my phone" for a video (hidden on videos; `saveToPhone` writes a JPEG). Video ciphertext isn't kept on the phone (too big for the photo store), so a video replays only online.
- **Verified (qa-tdd, 3x):** app jest 804/0, typecheck, web e2e 5/0 (local executablePath wrapper, T12), backend 1038/0, check-agents. privacy-security: no P0/P1; PRIV-R1 (clear decrypted videos at start-up even when signed out), R2 (posting copies in the cache, M7), R3 (iOS file protection, accepted) are P2. Drafts: /mnt/project-files/drafts/video-player-2026-11-10/ (bundle + patches + README).
- **Next exact step:** after "lift GitHub hold", push this branch (one push) and open a PR (app/** waits for Chase's merge, DEC-48). Then VID-19 on an iPhone and an Android phone in Expo Go, FLAG-7/VID-22 exiftool check on Chase's iPhone, then Chase's word turns `video_posting` on. PRIV-R1 is a small follow-up.
## Nov 10: text message sign-in built, off (BETA-SMS-1..15, DEC-57, migration 0026, TRACKER R43; branch claude/project-thread-y94vb7, local only under the GitHub hold)
- **Done:** migration 0026 (E.164 phone invites via an `invites` trigger, redeem matches `auth.users.phone` with or without `+`, `invite_preview.sign_in_with`, no email batch without an email, `[phone]` in error reports, QA-R1: a phone is never a placeholder name). `config.toml` `[auth.sms]` template in Hearth's words. App: `sendTextCode`/`verifyTextCode`, `api/phone.ts` (E.164, last 4, scrub, flag), `SignInFlow` + `TextCodeFlow`, join screen by `sign_in_with`, invite card's "Their mobile number", no-family "Signed in with email before?", Help/Preferences push-only for phone accounts. check-logs flags phone names. API.md, architecture 02/05 footers.
- **Tests changed (plainly wrong or asked for):** api_test and contract exact-keys now include `sign_in_with` (QA-R3); sms_test's `position('phone"' …)` check contradicted `sign_in_with = 'phone'`, now checks no key names a phone.
- **Open:** grandparent-ux on the words (QA-R2 "newest text"; the invite card's "Use email instead" makes today's link invite, which has no email field: staff-pm call); privacy-security review; StartFamily's first invite stays link-only; Twilio facts unverified live. e2e:web needed a local browser-version workaround (Playwright 1194 vs installed 1243).
- **Next exact step:** qa-tdd runs all suites 3x; then grandparent-ux and privacy-security.

## Nov 10: SMS provider pick (architect, SPEC-SMS-SIGN-IN §6, TRACKER R43; branch claude/project-thread-y94vb7, local only under the GitHub hold)
- **Done:** pick Twilio Verify via Supabase `twilio_verify` (`docs/eng/SMS-PROVIDER.md`, spec §8); `config.toml` `[auth.sms.twilio_verify]` off with env() secrets, `max_frequency = "60s"`, local-only `test_otp` guidance; architecture 01/02/04 and ACCOUNTS row (not created yet).
- **Open:** supabase.com and twilio.com didn't load in the session; Verify's no-registration claim, pricing, template rules and `auth.users.phone` form are unverified.
- **Next exact step:** a session with those sites allowed confirms the unverified facts; then Chase's one step (Twilio sign-up, $20).

## Nov 10: photo search (DEC-56, SEARCH-1..14, SEARCH-UI-1..8, migration 0025, TRACKER R42; branch claude/project-thread-bsaqxe, local only)
- **Why:** Chase's go-live list, item 9 "Search". Plain words only; AI search stays on the paid tier (DEC-37).
- **Done:** `search_posts` (0025): every typed word must be in the title, caption or sender's name; From one person; a capture-date range; candidates from `private.visible_posts`, rows from `private.feed_rows`, so hidden posts never match and group titles never show to non-senders; STABLE, nothing stored. App: `searchPosts` (Supabase + Fake), `SearchScreen.tsx` opened by a Search button in the Photos toolbar. Spec `SPEC-SEARCH.md`, persona check, API.md, architecture 05.
- **privacy-security:** no P0/P1. SEARCH-R1 (drafts, removed people, a parent who didn't send) fixed with SEARCH-15 tests; SEARCH-R2 wording softened, Supabase log settings to check (TRACKER R42); SEARCH-R3 accepted: Supabase's 8 s timeout for signed-in calls bounds a search at family scale (from Supabase's docs, not checked live).
- **Open:** the real-stack contract (PostgREST harness) wasn't run; grandparent-ux words pass; no Playwright walk.
- **Next exact step:** after "lift GitHub hold", push Start a family first, then this branch on top as its own PR (it sits on R41's commits).

## Nov 6: Apple design guidelines fixes (HIG-1..12, DEC-54, TRACKER R39; branch claude/project-thread-bellss, PR)
- **Why:** Chase asked for a full sweep against Apple's Human Interface Guidelines (doc https://claude.ai/artifact/3N1G5jF4ezeQ2Gtf2jFwZU), then "handle all the p1s". HIG is readable here through Apple's JSON feed (`developer.apple.com/tutorials/data/design/human-interface-guidelines/<page>.json`).
- **Done:** notices asked after the first photo with a Hearth card (HIG-1, DS-15); zoom (HIG-2, BETA-SEE-4); tab and toolbar words capped at 1.5x with Apple's large pop-up label (HIG-3); Ember launch screen light and dark (HIG-4); iPad in every direction (HIG-5); Increase Contrast, Reduce Motion, VoiceOver sender, swipe-down sheets, scaling icons, haptics (HIG-7..12, DS-14). New dependency `expo-haptics` (version from `npx expo install`). Tests `app/src/screens/__tests__/hig.test.tsx`.
- **Decided:** HIG-6 dropped; Chase kept emoji only (Nov 6 card, REACT-7).
- **Nov 10 (GitHub hold, local only):** pinch on Android and the web (QA-R1, `pinchZoom()`), plus tests for swipe-down close (QA-R2), Allow sending the token (QA-R3) and a live Reduce Motion change (QA-R4). Saved as a git bundle and patches in `/mnt/project-files/drafts/hig-fixes-2026-11-10/`, not pushed.
- **Open:** owner account deletion; nothing tried on a phone yet.
- **Next exact step:** Chase says "merge" on the PR, then republish the Expo preview and try the largest text size and the zoom on his iPhone.
## Nov 7: Start a family (DEC-55, BETA-START-1..13, migration 0024, TRACKER R41; branch claude/project-thread-eaq4hr, PR)
- **Why:** Chase picked "Yes, build it now" on Nov 7: level 5 needs a family to start without Chase's script. Reverses the Oct 16 "Not now (M7)" call (DEC-3 superseded).
- **Done:** spec `docs/product/SPEC-START-FAMILY.md` with privacy-security (PRIV-R1..8) and architect design; persona check `decisions/2026-11-07-start-a-family.md`. Migration 0024: `start_family`, `can_start_family`, switch `start_family_open` (ships OFF), 3 starts a day, photo/storage cap for app-started families (HF001), empty started family retired on redeem, `create_household`/`create_space` revoked from app users (setup scripts make the family as admin first). App: `StartFamily.tsx` (ask, name + 18+ line, who's in it, first invite, Skip for now), entry on the no-family screen only when the switch is on; words per grandparent-ux (GUX-R1..R5). Architecture 04 (gap 6, open starting) and 05, API.md, MARKETING row 28. Shots `docs/reviews/2026-11-07-start-family/`. Backend 1126/0, app 819/0, e2e green.
- **Open:** real-stack contract cases for 0024 skip (QA-R1: need a starter user and a service-only switch flip); no Playwright walk of the flow (QA-R2); first invite has no email field.
- **Before the switch goes on (blocks the deploy turning it on, not the merge):** an abuse contact in Help and a suspend-a-family runbook (PRIV-R7); the 18+ and legal review (PRIV-R5, M7); confirm Help reaches Chase (GUX-R3).
- **Next exact step:** Chase says merge and deploy; deploy 0024 with the switch off; then the PRIV-R7 Help contact, then turn it on.

## Nov 6: demo first minute, raising 3s toward 5s (FIRSTMIN-1..3, TRACKER R40; branch claude/project-thread-eaq4hr, PR)
- **Why:** Chase, Nov 6: bring the readiness doc's level-3 features to 5 before new dev (doc https://claude.ai/artifact/EBrvRki1RMkdHtApKSX48e, fix #5).
- **Done:** `initialOf` gives two letters for two-word names (GJ, GE), one rule for the faces, Who sheet and post header; the phone-width demo shows 3 numbered steps; face letters cap at 1.3x (GUX-R1). Shots: `docs/reviews/2026-11-06-firstmin/`. Pretend sign-in cut (staff-pm).
- **Checked on hosted (read only):** `HEARTH_KEYS_PENDING` is already gone; the outbox has 0 rows because only one person (Chase) has signed in, so TRACKER step 7's email check needs account B, which is step 9.
- **Waiting on Chase:** merge this PR; sign in account B on the web build to start the 2-day demo. (The Start a family card: Chase picked build it, Nov 7.)
- **Next exact step:** Chase merges; the demo rebuilds on merge.

## Nov 6: studio agents really run in cloud threads (AGENTRUN-1..6, TRACKER R38; branch claude/project-thread-7zjm6h, PR)
- **Why:** Chase's recruiter-readiness review (Nov 6, doc https://claude.ai/artifact/EBrvRki1RMkdHtApKSX48e) found PRs #99-#103 all say "qa-tdd skipped: the studio agent types can't be loaded", which contradicts the README's nine-agent claim. Chase: "Start 2".
- **Cause:** in cloud project threads the Agent tool offers only built-in types (`subagent_type: qa-tdd` → "not found", even from ~/.claude/agents), and repo hooks never fire (CLAUDE_PROJECT_DIR empty), so nothing logged runs.
- **Done:** `bash scripts/agent-prompt.sh <agent> "<task>"` builds a general-purpose prompt from the agent file; the subagent logs itself with `bash scripts/log-agent-run.sh --as <agent>` (`<agent> via-general-purpose`), which `check-agent-runs.sh` accepts. Test `scripts/tests/agent_runs_test.sh` (20 checks) in test-all and agents.verify. This PR used it: qa-tdd red, engineer, qa-tdd 3x green.
- **Open:** QA-R1 (test runs with stdin closed), QA-R2 (`--as` is honest by convention; only qa-tdd has a CI backstop). The same change belongs in studio-agents (Product Studio) so `sync.sh` doesn't overwrite it.
- **Next exact step:** merges itself on green (non-live, DEC-48).

## Nov 6: memes and GIFs in comments chosen (DEC-53, TRACKER R37; branch claude/project-thread-qvd39c)
- **Why:** Chase, Nov 5: "support memes and gifs in the comments... slack meets instagram". Plan doc https://claude.ai/artifact/N3wzTESDf3LXhhRYnBdgUi; he picked "Picture reply + GIF shelf" on Nov 6.
- **Done:** decision logged with a persona check (`docs/product/decisions/2026-11-06-gifs-in-comments.md`), ideas log row, TRACKER R37. No code.
- **Next exact step:** after the Nov 22 beta, staff-pm spec, then a failing test for GIF-3 (comment pictures signed only for reply readers).

## Nov 5: live review fixes (DEC-52, TRACKER R36; branch claude/project-thread-o1veol, PR)
- **Why:** Chase reviewed the preview on his iPhone: tab words overlapped the icons; "Messages should be a single icon so should filters"; "Yes" to toning down the picked ❤️ and labeling the circles.
- **Done:** iPhone uses Hearth's own tab bar (tabs.test.tsx LIVE-1, Test Log B14); Messages, By date and Events are `IconButton`s in a toolbar above the title (photosHeader.test.tsx LIVE-2); my reaction is a soft fill (moments.test.tsx LIVE-3); "Can see" before the circles (who.test.tsx LIVE-4). Shot: /mnt/project-files/hearth-look/2026-11-05-live-review-fixes.png (web build).
- **Next exact step:** Chase merges; republish the Expo preview; Chase checks the tab bar on his iPhone.

## Nov 5: 🎉 Hooray reaction (DEC-51, TRACKER R35; branch claude/project-thread-pfr7l7, PR)
- **Why:** Chase, Nov 5: add 🎉 alongside ❤️ 😂 👍.
- **Done:** migration 0023 widens `set_reaction` and the table check (reactions_test.sql REACT-12); the app has a fourth reaction button, "Hooray" (moments.test.tsx, contract test). PRs #99 and #100 merged, 0022 deployed (smoke 9/9).
- **Status:** merged (PR #101), 0023 deployed (smoke 9/9) and the Expo preview republished Nov 5 (update group accc030f).

## Nov 5: three colors, faces for who can see it, the phone's own emoji (DEC-50, TRACKER R34; branch claude/project-thread-pfr7l7 on top of PR #99)
- **Why:** Chase, Nov 5: "I'd like all three color options", "a contact circle component or chips... a discreet icon", "the standard not 3d emojis not line icons".
- **Done:** Ember (default), Sage and Plum, light and dark, under Colors on Help and Me (colors.test.tsx, COLOR-1..4; tokens.json `colorChoices`). The names sentence became up to three initial circles under the photo that open a sheet of name chips (who.test.tsx, WHO-10). Reactions are the phone's own emoji again, with chat-style count chips (moments.test.tsx, REACT-11). Shots: docs/reviews/2026-11-05-look/.
- **Next exact step:** Chase merges; then 0022 deploy. Open question: add 🎉 as a reaction (needs a migration on 0017/0018's list).

## Nov 4: every post names who can see it (WHO-1..9, DEC-49; migration 0022; branch claude/project-thread-v54okb, PR #99)
- **Why:** Chase, Nov 4: relatives shouldn't know they're in a group ("gparents dads side is offputting"), but should see who's in it with them.
- **Done:** `post_viewers` (0022) returns the people `sees_post` lets see each post, names and ids only (backend/tests/viewers_test.sql, WHO-1..5). Everyone but the sender gets "You, Alex, Chase and 2 others can see this" under the date and the full list under More (who.test.tsx, WHO-6..9); the sender keeps "Sent to <group>". API.md, architecture 05, DEC-49 and a persona check updated.
- **Next exact step:** Chase says merge and deploy; deploy 0022 (`backend/scripts/deploy.sh`) before or with the app, since an app on an older server just leaves the line off.

## Nov 4: post card cleanup (intake #95 part 2, LOOK-1..3; branch claude/project-thread-v54okb, PR)
- **Why:** #95 says the look reads dated; Chase kept Atkinson (Nov 4 card), so the fix is spacing and layout.
- **Done:** the post card's date and "Sent to <group>" are two lines instead of one wrapped run (LOOK-1); the initial lines up with the name (LOOK-2); every inset on the card is on the 4 pt SPACE scale, 16 pt sides (LOOK-3). Before/after: `docs/reviews/2026-11-04-look/`.
- **Next exact step:** Chase looks at the before/after and says merge (it changes the app and the live demo).

## Nov 4: design tokens, roadmap labels and demo-site analytics (intake #95 part 1, TRACKER R32; branch claude/project-thread-v54okb, PR)
- **Why:** Product Studio intake #95 (Chase, Nov 4): Hearth gets the full "shipped" treatment for PM hiring managers.
- **Done:** README "Not built yet (roadmap)": the family vault, a privacy guardian, a memory engine and the photo frame, each plainly not built. `docs/design/tokens.json` is generated from `app/src/ui/theme.ts` (DS-TOKENS test fails on drift); DESIGN-SYSTEM.md points to it. `app/scripts/add-site-analytics.sh` adds Umami to the demo *site* only, run by `build-demo.sh`; off unless repo variables `UMAMI_SCRIPT_URL` and `UMAMI_WEBSITE_ID` are both set; the id must be a UUID and the address https (ANALYTICS-1, 10 checks); nothing in `app/src` mentions Umami (ANALYTICS-2). MARKETING claim narrowed to "the app has no trackers"; architecture 01 notes the demo-site exception.
- **Not verified live:** Umami's docs were unreachable from this environment (rule 8), so no script address is baked in; Chase copies both values from Umami's "Tracking code" page.
- **Next exact step:** Chase, when ready: make an Umami Cloud site for chaseholroyd.com, then add the two values under repo Settings → Secrets and variables → Actions → Variables. Then #95's look cleanup.

## Nov 4: public-repo cleanup and real test totals (intake #94, TRACKER R31; branch claude/project-thread-v54okb, PR)
- **Why:** Product Studio intake #94 (Chase, Nov 4): Hearth stays public, so the repo must read well to an interviewer and match the site.
- **Done:** `scripts/test-totals.sh` prints both totals from the suites' own output (TOTALS-1 test, run by test-all): **734 app tests (94 files, 1 skipped), 1,029 database checks**. README: "Start here" table, demo link chaseholroyd.com/hearth, SDK 58, real totals, the nine agents, the "no outside security review yet" line. CASE-STUDY: same counts, roster and link. The five old `docs/portfolio/INTAKE-*` files carry a "Historical" note. Claim check: AES-256-GCM (`03-encryption-and-keys.md`), MLS RFC 9420 (`06-messenger.md`), row-level security (`01-system-overview.md`) and D10 (`04-threat-model.md`) all match the site.
- **Flagged, not changed:** `prototype/` and `e2e/` (the throwaway HTML prototype, still under test-all); `docs/product/REMAINING.md` (Oct 16 critical path, mostly superseded by TRACKER); the hosted join link `*.expo.app/join/` in `app/src/api/links.ts` is the app's real invite host, not a private link.
- **Next exact step:** reply on #94 with the totals once merged; Product Studio fixes the site's Hearth page.

## Nov 4: demo path follows the repo rename (branch claude/project-thread-v54okb, PR)
- **Why:** Chase renamed the repo to lowercase `hearth` (Nov 4), so Pages now serves chaseholroyd.com/hearth/ and the old /Hearth/ build's asset paths broke the demo.
- **Done:** `demo-site.yml` builds with `BASE: /hearth`; the PAGES-1 site checks use `SITE_BASE=/hearth`. `e2e:site` under /hearth passed 3x locally (8/8). Old /Hearth/ links in past entries below stay as history.
- **Portfolio / public presence:** live and browser-checked at https://chaseholroyd.com/hearth/ (no errors); /Hearth/ is now 404. Portfolio intake filed: holroydchase-afk/holroydchase-afk.github.io#51 (links to /hearth/, repo link, real totals).
- **Next exact step:** Product Studio works #51.

## Nov 2: merge rule (DEC-48; branch claude/project-thread-v54okb, PR)
- **Why:** Chase answered the merge-gate card "Yes, studio rule" (Nov 2), and said "Merge 92" (merged).
- **Done:** `docs/eng/MERGING.md` and the CLAUDE.md line now say threads merge their own non-live PRs (docs, tests, CI, agent files, scripts) on green, oldest first; anything touching `app/**`, `packages/**`, the Pages workflow or `backend/**` still waits for Chase, and merging is never deploying. DEC-48 logged. Intake #91 closed by #92.
- **Next exact step:** none; this PR is non-live, so it merges itself on green.

## Nov 1: studio standard adopted (intake #91; branch claude/project-thread-v54okb, PR)
- **Why:** Chase, Nov 1: standardize every project on the merged Product Studio + Hearth rules (studio-agents `docs/studio-standard.md`), filed to Hearth as intake #91 and picked up by the Intake check.
- **Done:** CLAUDE.md opens with the "Studio standard" line, and its agent section is the current studio template (moments table, one-task order, qa-tdd relay, `Agents:` line) with `grandparent-ux` kept and the new `story-keeper` row. Re-ran `sync.sh`, `sync-tools.sh`, `install-rules.sh` and `sync-agents.sh` (story-keeper now gets the "Every agent" Hearth notes). Took the template's `handoff-check.yml` (status-header step), `log-agent-run.sh` (logs from cloud sessions, which start above the repo) and `check-agents.sh` (both table formats; Hearth's AGENT-NOTES check kept). Kept Hearth's own `check-logs.mjs` (stricter: it also bans "title"), `studio-checks.json` and `settings.json` (Expo plugin). This file now has the status header.
- **Section 3 docs:** all present under Hearth's names: TRACKER = PLAN, DECISION-LOG = DECISIONS, `docs/eng/LESSONS.md`, `docs/product/ACCOUNTS.md`, `docs/product/MARKETING.md`, `docs/architecture/`. Hearth's `docs/product/STORY.md` is the product story, not the Atlas Story mirror; no `docs/STORY.md` yet.
- **Not changed, needs Chase:** the intake also asks to replace "merge only on Chase's word" (CLAUDE.md, `docs/eng/MERGING.md`) with "threads merge their own PRs on green; live product and live demo wait for Chase". That loosens a rule Chase set in this repo, and the only source here is another project's write-up, so it waits for Chase's own words. In Hearth almost every app PR changes the live demo (Pages rebuilds on `app/**`), so it would still wait for him either way.
- **Next exact step:** done: merged Nov 2 on Chase's "Merge 92"; the merge gate became DEC-48.

## Nov 1: UX pass: accessibility sweep, design tokens, palette and familiar patterns (TRACKER R30, branch claude/project-thread-iazy1z, PR)
- **Chase's ask:** copy the standard photo-app patterns ("the more familiar the easier"), an accessibility sweep, and build out the design system and palette. Colors and font stay as PR #88 set them.
- **Sweep:** `docs/design/a11y-sweep-2026-11-01.md`. Hearth passes text size, names, 48 pt targets, reflow and AA contrast in light and dark. Fixed test-first: A11Y-1 one level-1 heading per screen (Me had 14), A11Y-2 web switch thumb no longer teal, A11Y-3 switch Off track at 3:1. DS-13 `SPACE` and `RADIUS` tokens; the kit uses only them.
- **Docs:** DESIGN-SYSTEM gains DS-13, a palette table (what each color is for, measured contrast) and familiar patterns P-1..P-12. Ideas log: header photo, Who row, black full-screen viewer, double-tap to Love.
- **Not checked:** VoiceOver, TalkBack and 200% text on a real phone.
- **Portfolio / public presence:** the public demo picks up the heading and switch fixes once this merges.
- **Next exact step:** Chase says "merge"; then grandparent-ux takes A11Y-4..8 and the ideas need a staff-pm scope call.

## Nov 1: light or dark screen, warmer colors, Atkinson Hyperlegible (TRACKER R29, branch claude/project-thread-dul1po, PR)
- **Chase's ask:** "We need a dark and light mode", then "review and fix the color scheme across the board, these are rough" (iPhone screenshots of the demo in dark).
- **Built, test-first:** DS-10 "Light or dark screen" (Same as my phone, Light screen, Dark screen) after Bigger text on Help and Me, saved with the prefs; the native tab bar, keyboard and status bar follow it. DS-11 one warm palette on every phone (no pure black, no system gray), body text 7:1, waiting buttons solid gray instead of see-through blue, reply box and demo bar on the card color. DS-12 Atkinson Hyperlegible Next (Chase's pick from three on his phone) in Regular, Medium and SemiBold only, one bundled file per weight. DEC-47, persona check `decisions/2026-11-01-light-dark-colors.md`, DESIGN-SYSTEM updated.
- **Tests:** app Jest, typecheck, 3 runs. Web demo screenshotted light and dark at phone width (`docs/design/versions/v3-warm-atkinson/`); not yet on a phone. The font research came from web search summaries: brailleinstitute.org and fonts.google.com are not on this environment's allowed hosts, so their pages weren't read directly.
- **Portfolio / public presence:** the public demo picks up the new colors, font and the choice on Me once this merges (Pages rebuilds from main). The case study now says 47 decisions.
- **Next exact step:** Chase says "merge", then opens Expo Go to check the font and dark screen on his iPhone (needs an Expo preview republish after merge).

## Oct 31, night shift: the owner's photo helpers switch (TRACKER R17, branch claude/project-thread-kzt7by-n1031, draft PR)
- **Where things stood:** the release plan (M1.1) is finished and every PR through #84 is merged; 0020 and 0021 are deployed. So tonight took the next unblocked P2 row that needs nothing from Chase.
- **Built, test-first (HELP-R6, DEC-46, persona check all Green):** the family's owner gets a "Photo helpers" card on Me with two switches, "Set aside repeats" and "Set aside screenshots and blurry photos", for the whole family. Nobody else sees it. A failed save says so and leaves the switch as it was. The switch shows what `my_features` says, so Hearth's global kill switch still wins. Words from grandparent-ux (7/10 first draft; its replacement lines are what was built).
- **App only, no migration or deploy:** the owner could already write `space_features` under RLS (0013). `setFamilyFeature` updates, then inserts if there was no row (a PostgREST upsert also sets the key columns, which authenticated can't update).
- **Tests:** contract HELP-R6 (fake and the real PostgREST harness: off, viewer refused 42501, back on), `helperSwitch.test.tsx` ×5. Docs: API.md, architecture 05 (Last checked), SPEC-PHOTO-HELPERS HELP-R6, TRACKER R17.
- **Decisions to review:** DEC-46.
- **Next exact step:** merged on Chase's "Merge all" (Nov 1; renumbered DEC-47 to DEC-46 because #86 took DEC-45). Republish the Expo preview and look at Me as the owner.

## Oct 31: studio demo bar (intake #82, TRACKER R28, DEC-45; branch claude/project-thread-v54okb, PR)
- **Why:** Product Studio intake #82 (Chase, Oct 31: one demo banner standard, pm-tools `docs/DEMO-BANNER.md`). Picked up by the new "Intake check" scheduled task (4x a day, owned by thread "Set up intake check routine").
- **Done, test-first:** `app/src/demo/DemoBar.tsx` is the slim Demo bar (← Portfolio, Demo badge, Details) with a push-down drawer: standard copy, See it as Grandma Jo, Reset demo that asks first and says "Sample data restored." once, and the way back. `DemoTip.tsx` adds one tip line on the phone's Photos. The old chip bar is gone. Tests: DEMO-BAR in `demoBar.test.tsx` and `demoTip.test.tsx`, browser cases in `e2e-web/demo.spec.js`; the demo, site and showcase specs open Details first.
- **Review:** `docs/reviews/2026-10-31-demo-bar.md` with before/after screenshots (390/1280, light/dark). ux-reviewer: 5/10 before, 7/10 after its first pass; its two P1s and two P2s are fixed.
- **Portfolio / public presence:** the demo is self-hosted at https://chaseholroyd.com/Hearth/ (PR #87) and rebuilds on merge, so no re-copy is needed; Product Studio re-shoots `assets/home/hearth-*.webp` after.
- **Next exact step:** Chase says "merge" for this PR.

## Oct 31: the demo goes on GitHub Pages at chaseholroyd.com/Hearth/ (TRACKER R26, issue #83 step 2)
- **Privacy scan re-run on the rewritten history (all branches):** 0 real-family names, gitleaks clean, only made-up test emails and one public office phone number.
- **Built, test-first (PAGES-1):** the static-site e2e takes `SITE_BASE`. Under `/Hearth` it failed on the old `/demo/hearth` build (red) and passes 8/8 on a `/Hearth` build (3 runs). The default `/demo/hearth` still passes 8/8.
- **`demo-site.yml`** now builds with base `/Hearth` on every push to main that touches the app (or by hand) and deploys to Pages (`upload-pages-artifact@v5`, `deploy-pages@v4`, versions from GitHub's releases pages via web search).
- **Next exact step:** Chase sets Settings → Pages → Source: GitHub Actions and merges. Then check https://chaseholroyd.com/Hearth/ and reply on #83 with the URL. **Portfolio / public presence:** Product Studio then points the portfolio at that URL and drops its demo/hearth/ copy.

## Oct 31: old commits cleaned of real-family details (TRACKER R26)
- **Chase's call:** rewrite history in place. Chase ran the prepared git-filter-repo script from a Codespace (the cloud session can't force-push main). All branches are rewritten: main is now `5e5c338`, and its files are byte-identical to before (same tree). A fresh mirror shows 0 real names across all 64 branches and every commit message.
- **Every clone or branch from before Oct 31 15:35Z is stale.** Re-clone or `git reset --hard origin/<branch>` before pushing, and never push old-history commits: that brings the names back.
- **Left:** GitHub Support purge of the cached old PR pages (Chase, one form). After that, Pages for the demo (R26).
- **Portfolio / public presence:** the repo is public with clean history once the purge is done.

## Oct 31: open PRs merged, 0020 and 0021 deployed, AGPL headers (branch claude/project-thread-rmj7at, PR)
- **Chase's ask:** "fix all issues, determine the correct order including merge 73, deploy 0020", then "also do the AGPL work".
- **CI:** Actions started no jobs while the repo was private (no runner, no logs: the billing limit). Public again Oct 31, so CI runs; every PR below was green before it merged.
- **Merged in order:** #70 (bug sweep), #73 (video part 1, 0020), #74 (change the words, 0021), #75 (bulk title), #76 (words pass), #78 (HARD-16), #71 (root LICENSE). Conflicts were docs only (HANDOFF, TRACKER, the Test Log seed); the video row became TRACKER R27 (R25 is the agent re-sync, R26 the demo scrub); a real first name in DEC-43 became "the least-savvy grandparent".
- **Deployed (Chase's word):** migrations 0020 and 0021 (smoke 9/9, 21 migrations); functions unchanged. Expo preview republished from main 89a5864 (group d84933ed, iOS 01a1903e-...-063598d9f5d6), verified on the standing link. Video stays off.
- **AGPL follow-up (this PR):** DEC-44, every source file in `app/src`, the edge functions and the messenger carries `SPDX-License-Identifier: AGPL-3.0-or-later`; `app/package.json` license; `scripts/check-spdx.sh` plus LIC-1..3 in `test-all.sh`.
- **#77** (scrub real-family details) merged Oct 31 by its own thread before this PR; old commits still hold the names until the history cleanup ("Host the Hearth demo publicly").
- **Next exact step:** Chase says "merge" for this PR; check "Change the words" and a bulk title on the phone.

## Oct 30: demo parent rename kept as "Kai" (main, PR #81); PR #77 brought up to date
- PR #77 had renamed the parent to "Max" in parallel; that commit is reverted and main (458236e) merged in, so the demo says Kai. Product Studio uses `portfolio/hearth-demo-site-2026-10-30-kai.tgz` (issue #79). App Jest 677 + 1 skipped and typecheck, 3 runs, local (Actions is off while private).

## Oct 29: host the demo publicly; real-family details scrubbed (TRACKER R26, branch claude/project-thread-h2kh6k, PR #77)
- **Why:** Product Studio INTAKE (Oct 29): the repo was public, so Hearth hosts its own demo, after a privacy check of the whole history.
- **Scan (all branches, 208 commits):** gitleaks found 0 leaks. No Supabase, Backblaze or API keys (the one JWT is a fake test token), so nothing needs rotating. The emails are made-up test addresses, and the one phone number is a public office line. **Found:** real-family details (names, surnames, relationships) in docs, tests and commit messages. Chase made the repo private again (Oct 29, 20:19Z).
- **Chase, Oct 29:** keep the name Hearth for now. Each product hosts its own demo and the portfolio page links to it ("fix the issues, then proceed").
- **Done, today's files (43):** real names are now the kids' nicknames (Mom, Gammy, Grandaddy, Grandmomma, Memaw, Pawpaw, Granny, Gigi, Bebar, Great-Grandma). Made-up test names that matched real ones changed too (Sue, Tess). The surnames, birthplaces and the private details are gone. `family-setup.sh`'s poster-invite flag is now `--mom-email`, and its new families get "Mom's side". **The live family still has the old side name:** rename it in the app (Groups) before any re-run of `family-setup.sh`, or the re-run adds a second side. New rule in CLAUDE.md (privacy invariants). The real-name key is in the project's private files (`plans/family-names-key.md`).
- **Done, demo:** `.github/workflows/demo-site.yml`, manual only. It builds the demo with `app/scripts/build-demo.sh`, fails if the build holds a Supabase address or key, and keeps it as the `hearth-demo-site` artifact. The demo already links back to chaseholroyd.com/family-photos.html (DEMO-3).
- **Tests (3 green runs):** backend `tests/run.sh` all suites; app Jest 677 + 1 skipped; typecheck; agents, persona checks and the PRIV-2 log check.
- **Portfolio / public presence:** INTAKE for Product Studio at `/mnt/project-files/portfolio/INTAKE-2026-10-29-demo-host.md`, with a fresh build tarball beside it. To update once Pages is live: Pages URL instead of /demo/hearth/.
- **Next exact step:** Chase picks how to clean the old commits (card; recommended: rewrite in place right after #70-#77 merge, then one GitHub Support form to purge cached PR pages). Then the repo goes public, the workflow gains a Pages deploy at chaseholroyd.com/Hearth/, and the INTAKE gets that URL.

## Oct 29: repo public, root LICENSE added (branch claude/project-thread-l5pj6x, PR)
- Chase made the repo public Oct 29 (it also unblocked GitHub Actions, which had stopped on the private repo's billing limit). A read-only scan of every branch's history found no secrets (only AWS's documentation example key and a dummy test JWT). The web app URL is in the code because invite links use it; invites still gate sign-in.
- Added the root `LICENSE` (AGPL-3.0 text, copied from `packages/messenger/LICENSE`) so the public code is under the license Chase picked (DEC-7). DEC-7 planned going public after milestone 1 and a final name; Chase went public earlier, so the name "Hearth" is now more visible, and the README says so. Still open: whether Hearth's notices say AGPL-3.0-only or -or-later (the messenger library uses -or-later); SPDX headers on Hearth's own files.
- Also Oct 29 in thread "Check all open PRs": #69, #58 and #57 merged (decisions renumbered DEC-41 and DEC-42).
- Next exact step: Chase says "merge" for this PR.

## Oct 30, night shift: HARD-16, Haha or Like never takes away a heart (branch claude/project-thread-kzt7by-n1030, draft PR, stacked on #76)
- **Fixed, test-first (B12):** on a server before 0017 (no `set_reaction`), the app's fallback flipped the heart, so Haha or Like on a hearted post removed the heart. Now only Love takes a heart back; a non-heart tap that flipped it off flips it back. `SupabaseApi.test.ts` HARD-16 ×2. App only; the hosted server has 0017, so this guards older or self-hosted servers.
- **Also tonight:** #74-#76 brought up to date with main (#72's HANDOFF/TRACKER conflicts resolved, R25 marked merged) and given the new required `Agents:` line.
- **Test Log:** B12 marked fixed in `tracker/build_seed.py`; the found/fixed dates and the seed JSON wait for #70 (which adds B12's dates) to avoid a conflict.
- **Next exact step:** Chase says "merge #74 to #78" in order, then "deploy 0021" and an app update.

## Oct 29, night shift: grandparent-ux words pass (branch claude/project-thread-kzt7by-n1029c, draft PR, stacked on CAP-9)
- **Score:** grandparent-ux (reading the code) 7/10 for the new title and change-the-words flows, 8.5/10 with these fixes. It confirmed "What's happening?" without "(optional)", plus "Change the words", "Edited" and Read more.
- **Built, test-first (WORDS-1..4, DEC-43, persona check all Green):** the caption hint says "The groups you pick will see it." (it said "Grandma will see this", untrue for a one-side post); a refused edit says "These words can't be changed now. Your old words are kept."; Messages says "Not even Hearth can read it: …"; on Share and the bulk review a group shows its name alone and the count starts the names line. Spoken labels unchanged.
- **Decisions to review:** DEC-43 (all four word changes). WORDS-4 should be checked on an older Android at 200% text.
- **Next exact step:** Chase says "merge" after #74 and the CAP-9 PR.

## Oct 29, night shift: one title on a bulk send (CAP-9) (branch claude/project-thread-kzt7by-n1029b, draft PR, stacked on #74)
- **Built, test-first:** the bulk review screen has one optional "Title (optional)" box (80 characters) and nothing else; every post in the batch carries that title, captions stay empty (`bulk.test.tsx` CAP-9 ×2). App only: `create_post` already takes a title (0019, live), so this needs no deploy.
- **Next exact step:** Chase says "merge" after #74.
## Oct 29: video, part 1: location stripping and a fair video limit (branch claude/project-thread-ponhs5, PR)
- **Why:** Chase, Oct 29: "build video". Video was "in v1" (Oct 18) but blocked on stripping location from video on the phone (FLAG-7), plus S14 (the free cap reset per family space).
- **Built, test-first:** `app/src/media/cleanVideo.ts`, a pure-TypeScript QuickTime/MP4 cleaner and verifier that runs in Expo Go with no re-encode: location boxes (Apple's ISO6709 key, `©xyz`), make, model, software, XMP, face boxes, metadata and timecode tracks (their samples too), dates, vendor names and trailers are zeroed in place; picture and sound bytes stay identical (VID-1..11, plus two real ffmpeg-made files that still decode). `processVideo` in `pipeline.ts` (VID-12); iPhone picks come as 720p H.264 MP4 (VID-13, BETA-SHARE-6). Migration **0020** counts the 10 free videos a month per person across every free family (`private.video_usage`; S14-1..7 in `backend/tests/video_cap_test.sql`). Test Log: S14 fixed. Spec: SPEC-MEDIA section 4.
- **Still off:** `video_posting` stays off and `prepare.ts` still stops videos: no poster frame or player yet (TRACKER R27).
- **Next exact step:** Chase says "merge", then "deploy 0020". Then part 2: poster frame, player, grandparent-ux words, the FLAG-7 check on Chase's iPhone, and turning video on.

## Oct 29, bug sweep: B11 and T11 fixed, TRACKER brought up to date (branch claude/project-thread-ewmmb7, PR)
- **Chase's ask:** list every known bug, then "fix whatever you think is priority". Open list was 7 tickets, none High: S19, S20, S18, B11 (Medium); S14, B12, T11 (Low). No open GitHub issues; every UAT item is fixed or is a feature ask.
- **Fixed, test-first:** B11 (HARD-14): a reaction summary read before a tap no longer hides the confirmed reaction (`store.test.ts`). T11 (HARD-15): the fake now matches 0017, so an author can react to their own unsent post and nobody else sees it; the contract test passes on the fake and on the real API (PostgREST harness, 66/66).
- **TRACKER:** milestone 1 steps 3-6 and 8 marked done with evidence; step 7 left open (one email notice, and confirm `HEARTH_KEYS_PENDING` is gone). R16, R20 and R22 marked merged. App-only change, so no migration or deploy.
- **Left, needs Chase or bigger work:** S18 means clearing the test bucket before real photos (can't be undone, needs Chase's word, and B2 isn't reachable from the cloud). S19 safety numbers is day 3 of the vault plan (R24). S20 needs an outside reviewer. S14 and B12 don't matter today (video is off, hosted has 0017).
- **Next exact step:** Chase says "merge".

## Oct 29, night shift: change the words after posting (branch claude/project-thread-kzt7by-n1029, draft PR)
- **Built, test-first (CAP-6..8, SPEC-CAPTIONS, DEC-39 CAP-D2):** the sender's More menu has "Change the words": one sheet with the Title and "What's happening?" boxes filled in, Save and Cancel. The card then says "Edited" after the date for everyone. Nobody else gets the button; a refusal shows plain words and keeps the old words. No notice goes out; comments and reactions stay.
- **Migration 0021 (not deployed):** `posts.words_edited_at`, `edit_post_words(p_post, p_title, p_caption)` (sender only, while they can still send to one of the post's groups; P0002 for a post you can't see), `words_edited_at` on `get_feed` / `get_timeline`. **HARD-18:** authors could `UPDATE` caption and taken_at straight in the table (no "Edited" mark); 0021 revokes it. Nothing in the app used it.
- **Tests:** `captions_test.sql` (32), `rls_test.sql` updated to the HARD-18 contract, contract CAP-6/7/8 (Fake and real PostgREST), `changeWords.test.tsx` (4).
- **Docs:** API.md, architecture 02 and 05 (Last checked), SPEC-CAPTIONS, TRACKER R21/R22.
- **Next exact step:** Chase says "merge", then "deploy 0021" and an app update (the button needs 0021 live; older servers answer "can't do that").

## Oct 29: studio agents re-synced (TRACKER R25, branch claude/project-thread-jt1p84, PR #72, merged Oct 29)
- **Why:** Chase, Oct 29: re-sync from studio-agents main (b6a9a8b) to get the upgraded ux-reviewer and the ux tools; keep project-only agents.
- **Done:** ran studio-agents `scripts/sync.sh`, `sync-tools.sh` and `install-rules.sh` on this repo, then `scripts/sync-agents.sh` to put the Hearth notes back (sync.sh had dropped them from all 7). ux-reviewer is now the visual critic (Layer V, 0-10 score, 8 is the bar) and preloads the `review-rounds` skill; `.claude/design-rules.md` is the studio rules (incl. older-adult rules A1-A6). New `scripts/ux-shots.mjs` and `scripts/ux-rules.mjs` (need Playwright). New PR checks `agents-check.yml` (Agents: line, qa-tdd on code PRs, run log) and `handoff-check.yml`, plus `scripts/log-agent-run.sh` and `check-agent-runs.sh`. `.claude/settings.json` hand-merged: Expo plugin kept, SessionStart HANDOFF hook and Agent-run log hook added. `studio-checks.json` set to Hearth's log roots, `caption` and `kek` banned, and a light verify command. Hearth's own `check-agents.sh` and `check-logs.mjs` kept (install-rules never overwrites; ours also checks the notes). `grandparent-ux` untouched. Only privacy-security and ux-reviewer actually changed text.
- **Tests:** AGENTS-4 (4 checks in `scripts/tests/sync_agents_test.sh`): ux-reviewer's skills present, design rules and tools synced, settings hooks wired with Expo kept, studio-checks config. Red before the settings and config merge, green after; check-agents, sync-agents, logs, persona checks, test-all run 3x.
- **Next exact step:** Chase says "merge". From then on every PR body needs an `Agents:` line, and agents it names need a logged run in `.claude/agent-runs/`.

## Oct 26: the messenger is now a shared library (branch claude/project-thread-tzgzk8, PR #57, merged Oct 29)
- **Why:** Chase, Oct 26: "proceed. Build the library" so Crew Clock can use it too (STU-DEC-1, DEC-42). No change to what users see.
- **Done:** `packages/messenger` (`@holroyd/messenger`): the engine and noble-only ciphersuite behind Relay, Roster and Store, plus `relay/supabase.sql` (0015 without Hearth; each product writes `private.messenger_people`). **License: AGPL-3.0-or-later, copyright Chase Holroyd**: `packages/messenger/LICENSE`, plus SPDX headers on every file. Hearth's `app/src/messenger/client.ts` and `mlsCrypto.ts` are now thin adapters. Storage keys are unchanged, so phones keep their chats. Wiring: the app links the library with `file:../packages/messenger`; `app/metro.config.js` (watchFolders, nodeModulesPaths), `preserveSymlinks` in tsconfig, and Jest `roots` and `modulePaths`.
- **Tests:** PKG-1..6 (engine on test fakes, run in the app suite), RELAY-1..9 (`packages/messenger/relay/test.sql`, run by `backend/tests/run.sh` and `run_supabase.sh`), all MSG tests unchanged. The iOS bundle compiles with the library inside.
- Oct 29: brought up to date with main after release M1.1; decision renumbered DEC-39 → DEC-42 (DEC-39 is captions, DEC-40 the photo frame, DEC-41 PR #58).
- **Next exact step:** Chase says "merge". Then he pastes the Product Studio and Crew Clock prompts from the thread "Built-in messenger". No deploy is needed (no migration change).

## Oct 26: Photos screen UI review and fixes (branch claude/project-thread-vhp0f2, PR #58, merged Oct 29)
- ux-reviewer on Chase's phone screenshot plus the web demo at 390 and 1280: 5/10 → 6/10. Review: `docs/reviews/2026-10-26-photos-screen.md`.
- Built test-first: UI-26 no "Check for new photos" button (auto-refresh on open and return, plus pull-down), "By date" with the system sort icon beside Messages in one row (DEC-41); UI-27 avatar letter skips "The".
- The gear in Chase's screenshot is Expo Go's developer button, not ours.
- **Parked:** filter Photos by group (Chase, Oct 26; not scheduled).
- Oct 29: brought up to date with main after release M1.1; decision renumbered DEC-39 → DEC-41 (DEC-39 is captions, DEC-40 is PR #69).
- Next: publish to Expo Go after merge (Chase's word). Next gap: tall cards from the always-open reply box (DEC-30 keeps it).

## Oct 29, bleeding-edge features: photo frame spec and family vault plan (branch claude/project-thread-5ifxmu, docs only, PR #69, merged Oct 29)
- **Chase's call (DEC-40):** of three ideas (photo frame, MLS vault, AI audience guard), "Start with 1", plus a day-by-day plan for 2.
- **Specced:** `docs/product/SPEC-PHOTO-FRAME.md` (FRAME-R1..R5, FRAME-1..8), with a persona check (`decisions/2026-10-29-photo-frame.md`, LG Red mitigated: optional, set up by a helper). Live Activity moved to the poster's send progress, because Apple allows them only for things in progress. TRACKER R23.
- **Planned:** `docs/product/PLAN-FAMILY-VAULT.md`, 14 one-PR days reusing the messenger's MLS, with an MLS explainer. TRACKER R24. Ideas log row added.
- **Next exact step:** Chase answers day 1's two picks (vault per family; recovery card yes) and says "merge" for this docs PR. The frame build waits for milestone 2's real build.

## Oct 28, release M1.1 phase 7: reusable blocks (branch claude/project-thread-kzt7by-rel6, PR #68, merged Oct 28)
- **Lesson written:** `docs/eng/LESSONS.md` Oct 28 (every proof runs in CI; a flaky test is a finding; heavy RPCs plan with JIT off).
- **Give-back (INTAKE only, per STACK.md: no extraction until a second product needs it):** `docs/portfolio/INTAKE-2026-10-28-reusable-blocks.md` (also in the project files) offers Product Studio the jest-expo fetch snippet, the Supabase JIT rule and the CI rule for studio-agents and pm-tools.
- **Done Oct 28 (Chase's word):** #63-#68 merged in order, 0018 and 0019 deployed (smoke 9/9), Expo preview republished from main 565f65b. **Next exact step:** Chase pastes the two Oct 28 INTAKEs to Product Studio.

## Oct 28, release M1.1 phase 6: demo (branch claude/project-thread-kzt7by-rel5, PR #67, merged Oct 28)
- **Live today (verified 08:00 UTC):** chaseholroyd.com/demo/hearth/ answers, passes the showcase sweep at phone and laptop width with no console errors (the not-found page's 404 is expected), first card in about 2.1 s. It's the older build: two-line bar, no titles.
- **New build:** `app/dist-demo-site` from this branch passes `npm run e2e:site` 8/8 on a Pages-like host; first card in about 1.2 s; titles and the new bar and laptop frame show.
- **Portfolio / public presence:** `docs/portfolio/INTAKE-2026-10-28-demo-refresh.md` asks Product Studio to re-copy the demo after Chase merges #63-#66 (a ready tarball is in the project files, `portfolio/hearth-demo-site-2026-10-28.tgz`) and to refresh the page's test counts (660+ app, 960+ database).
- **Next exact step:** Chase merges #63-#66, then pastes the INTAKE to Product Studio.

## Oct 28, release M1.1 phase 5: post titles (branch claude/project-thread-kzt7by-rel4, PR #66, merged Oct 28)
- **Why this enhancement:** of everything waiting, it's the one a recruiter sees in the first ten seconds of the demo: cards read like real posts ("Mia's 5th birthday", then the caption, then photos). Chase approved the spec's picks (DEC-39), so it's the highest-value item that needs no new call from him.
- **Built, test-first (CAP-1..5, 10..12):** an optional Title box (80 characters) on Share; the card shows the title as a heading above the caption; a long caption folds to 4 lines with Read more / Show less; By date shows titles too; two demo moments carry titles. Migration **0019** adds `posts.title`, `create_post(p_title)` and the title on `get_feed` / `get_timeline` (not deployed: needs Chase's word, after 0018). The log check now treats `title` like `caption`.
- **Left:** change the words after posting (CAP-6..8), a bulk title (CAP-9), and a grandparent-ux pass on the words.
- **Tests (3 green runs):** app Jest 664 + 1 skipped, typecheck, web e2e 4, demo e2e 5, real-API contract 65/65, backend SQL all suites (new `captions_test.sql`), PRIV-2 12/12.
- **Portfolio / public presence:** demo cards now show titles once the demo is rebuilt (phase 6).
- **Next exact step:** Chase says "merge" (after phases 2-4), then "deploy 0018 and 0019" and an app update.

## Oct 28, release M1.1 phase 4: harden (branch claude/project-thread-kzt7by-rel3, PR #65, merged Oct 28)
- **Review:** privacy-security (with the qa-tdd lens) read everything since Oct 24 (`docs/reviews/2026-10-28-harden.md`).
- **Fixed, test-first:** HARD-12 (P1): members could write reactions straight to the table, skipping the three-emoji list and "replies off". Migration **0018** closes it (not deployed: needs Chase's word). HARD-13: sign out now deletes the cached feed (captions, names, reactions). HARD-17 (P1, found by running the real-API contract 3×): Postgres JIT-compiled the feed query once a family had a few dozen posts, 1.5-2 s per Photos page instead of 20-50 ms; 0018 turns JIT off for it.
- **Open tickets:** HARD-14 (B11), HARD-15 (T11), HARD-16 (B12), all P2/P3. Captions' sketched migration is now 0019.
- **Tests (3 green runs):** backend SQL all suites, app Jest, real-API contract, typecheck, PRIV-2 log check.
- **Next exact step:** Chase says "merge" (after phases 2 and 3), then "deploy 0018" (it speeds up Photos and closes the reactions hole).

## Oct 28, release M1.1 phase 3: UI to 8/10 (branch claude/project-thread-kzt7by-rel2, PR #64, merged Oct 28)
- **Score:** the studio ux-reviewer scored the public demo 5/10 before and 8/10 after (`docs/reviews/2026-10-28-ui-8.md`).
- **Built, test-first (UI-1..5):** a one-line demo bar with one row of matching chips; a centred laptop frame with proof points and a "Read the case study" link; gray Open buttons in Messages; the demo's Me names Sam instead of a placeholder email; the showcase sweep waits for each screen. Persona check all Green (`docs/product/decisions/2026-10-28-ui-polish.md`).
- **Tests (3 green runs):** app 654 + 1 skipped, typecheck clean, demo e2e 9, showcase sweep 48 shots with a clean console.
- **Portfolio / public presence:** the demo's bar and laptop frame change; the live site still serves the Oct 22 build until phase 6's INTAKE re-hosts it.
- **Next exact step:** Chase says "merge" (after phase 2's PR). The release continues with phase 4 (harden).

## Oct 28, release M1.1 phase 2: works for real (branch claude/project-thread-kzt7by-rel1, PR #63, merged Oct 28)
- **Found (REAL-1, P0 for testing):** since the SDK 58 move, jest-expo swaps the global fetch for Expo's native-only one. So `scripts/contract-real.sh` (the app's HearthApi contract against the real Postgres + PostgREST API) got no answers at all: 60 of 63 checks failed with UNKNOWN. CI never ran it, so nobody saw it. The app itself was fine; the proof that it works against the real backend was gone.
- **Fixed, test-first:** `app/jest.environment.js` keeps Node's network fetch, and the harness uses it (`netFetch.test.ts`, REAL-1). Two contract tests assumed a fresh database per test (T10 now makes its own group; TIME-2 allows more than one page), and the harness now knows who each JWT client is. All 63 real-API checks pass, and so do all backend SQL suites (local Postgres 16). A new CI job, "App contract on the real API (PostgREST)", runs this on every PR.
- **Tests (3 green runs):** app 648 + 1 skipped, typecheck clean, web e2e 4, real-API contract 63/63, backend SQL all suites.
- **Next exact step:** Chase says "merge". The release continues with phase 3 (UI to 8/10) on a stacked branch.

## Oct 28: Hearth moved onto the generic studio agents (TRACKER R16, branch claude/project-thread-0hdj2z, PR)
- **Why:** Chase, Oct 28: "go over the generic agent updates". This pulls R16 forward from after the beta. It's process only, with no app change.
- **Done:** synced from studio-agents main (2f27166): staff-pm, qa-tdd, engineer (replaces app-engineer), privacy-security, positioning (replaces marketing), ux-reviewer and architect (new). grandparent-ux stays Hearth's own. funding-analyst is archived in `docs/archive/agents/`. On Chase's ask ("the strongest agents, don't lose anything, combine and build"), each agent is the studio text plus a built-in "Hearth notes" section generated from `docs/eng/AGENT-NOTES.md` by the new `scripts/sync-agents.sh` (AGENTS-1..3, `scripts/tests/sync_agents_test.sh`). `check-agents.sh` now fails on drift. All the old Hearth agents are kept whole in `docs/archive/agents/`. The CLAUDE.md roster and the live references are updated.
- **Give-back:** an INTAKE asks Product Studio to add the persona check and the crypto bar to the generic staff-pm and privacy-security (`/mnt/project-files/portfolio/INTAKE-2026-10-28-agent-giveback.md`).
- **Next exact step:** Chase says "merge".

## Oct 27: plan for post titles and captions (branch claude/project-thread-095lsp, PR)
- **Why:** Chase, Oct 27: "the poster should be able to have a social media type post describing the set of pictures. Similar to Instagram and Facebook." The Polish Freeze is on, so this is a plan, not a build.
- **Planned:** an optional 80-character title plus today's caption for the whole set, folded with Read more, changeable by the sender from More (no notice, comments kept), one title for a bulk send; no per-photo captions, mentions, hashtags, links or AI help (AI-FEATURES R6). Words stay out of every notice and log. Migration sketched (now 0019), size M.
- **Next exact step:** Oct 28, Chase took all four picks (DEC-39) and said merge. Chase lifted all freezes Oct 28; the Oct 28 2:15am release run decides whether and when captions get built (TRACKER R21).

## Oct 27: Supabase starter pieces for the studio (branch claude/project-thread-0hdj2z, PR)
- **Why:** Chase, Oct 27, asked to work through the reuse list one item at a time ("Let's go"). That's new scope under the Polish Freeze, on his explicit word. This is Hearth's half of pm-tools `docs/intakes/hearth-supabase-starter.md` (Crew Clock needs Supabase next).
- **Built, test-first:** `docs/supabase-starter/` holds invite codes on the studio template's orgs (STARTER-INV-1..7, 25 checks) and token-only `deploy.sh` and `smoke-check.sh` with no Hearth defaults (STARTER-DEPLOY-1..5, STARTER-SMOKE-1..2, 17 checks). There's a new CI job `supabase-starter` (studio-agents pinned at 5a90300, PR #11). Hearth's own backend is unchanged.
- **Also from the list:** the other gaps (ACCOUNTS template, architecture skeleton, check-agents and check-logs scripts) went to Product Studio as an INTAKE. The photo privacy library and the other Expo-only pieces are skipped: STACK.md says to extract only once a second product needs something.
- **Next exact step:** Chase says "merge". Then Product Studio copies the four files into studio-agents `templates/supabase/` (see the folder's README).

## Oct 26: SDK 58 (branch claude/project-thread-d16zyx, PR)
- **Why:** Chase's Expo Go moved to SDK 58, so the SDK 57 reactions update wouldn't open ("No launchable updates"). The Expo Go check missed it because Expo's `expoGoSdkVersion` lagged (LESSONS.md, Oct 26).
- **Done:** expo 58.0.19, React Native 0.88, jest-expo 58, jest 30; `app/.npmrc` keeps legacy peer deps until the tests move to @testing-library/react-native 14. Check fixed (EXPO-5). 0017 and the Oct 25 reactions are already on the server.
- **Next exact step:** Chase says "merge, publish"; then he opens the standing Expo Go link.

## Oct 25: Love, Haha, Like and Comment reactions (branch claude/project-thread-d16zyx, draft PR)
- **Why:** Chase, Oct 25: "I want the love, haha, like, comment. Just emojis/icons, no label." New scope under the Polish Freeze, on his explicit word; icon-only overrides DS-3 (DEC-38, persona check `decisions/2026-10-25-reactions.md`).
- **Built, test-first:** migration 0017 (`set_reaction`, `reaction_summary`; `backend/tests/reactions_test.sql`, REACT-1..6), `HearthApi.setReaction` / `reactionSummary` (Fake, Supabase with a hearts-only fallback before 0017, contract tests), the store's `react()`, and the card row ❤️ 😂 👍 💬 with per-kind counts (REACT-7..9 in `moments.test.tsx`).
- **Next exact step:** Chase says "merge"; then deploy 0017 and publish to Expo Go on his word.

## Oct 24: moment cards in Photos (merged, PR #54)
- **Why:** Chase saw the old stacked card on Oct 24. The Oct 19 thread had only made a prototype (`prototype/moments.html`) and then waited on questions, so nothing reached the app.
- **Built, test-first (MOMENT-1..8, `app/src/screens/__tests__/moments.test.tsx`):** one compact card per upload, with a photo collage (`PhotoCollage.tsx`), a Love and Comment row, the newest comment, a one-row reply box (DEC-30 kept), and More for "Who can see this" and Delete. Uploads within an hour are separate cards (SESS-1..3 retired; `feed/sessions.ts` is kept unused until Chase confirms). The SWIPE tests now cover the swipe in the event timeline.
- **Next exact step:** merged Oct 25. Publishing to Expo Go and rebuilding the demo and portfolio screenshots wait on his word.

## Oct 24, night shift 4: recruiter-share readiness, hardening round 2 (branch claude/project-thread-kzt7by-ready, draft PR)
- **Recruiter check:** the published demo works end to end, live, on phone and laptop, and matches the repo build. The README and case study now link it, and the case study's decision count is right (RD-1, RD-2). It's ready to send.
- **Fixed test-first:** HARD-8 (full screen kept the same photo when a new post arrived), HARD-9 (a double tap on Love it), HARD-10 (no signal while joining: honest words and Try again), HARD-11 ("Saved" only once the server has her notice choice). Review: `docs/reviews/2026-10-24-share-ready.md`.
- **Tests (3 green runs):** app 633 + 1 skipped, typecheck clean, web e2e 4, demo e2e 9, sweep unchanged.
- **Next exact step:** Chase says "merge". After the merge, rebuild the demo for Product Studio (`cd app && bash scripts/build-demo.sh`) so the live demo gets HARD-8 to HARD-11; that's optional, since the live one already works.

## Oct 23, night shift 3: harden existing features (branch claude/project-thread-kzt7by-harden, draft PR)
- **Done, test-first:** review `docs/reviews/2026-10-23-harden.md` (6 fixed: 0 P0, 3 P1, 3 P2; HARD-6 checked out fine). P1s: a lost signal while making a group no longer makes a duplicate on retry (HARD-1); Share says plainly when there's no group to send to (HARD-3); the demo opens when a browser blocks storage (HARD-7, `app/src/platform/webStorage.ts`, architecture 03 updated).
- **Tests (3 green runs):** app 626 + 1 skipped, typecheck clean, web e2e 4, demo e2e 9 + 44 screenshots (no console errors, no visual change).
- **Next exact step:** Chase reviews and says "merge" (MERGING.md). Nothing to deploy; publish to Expo Go only on Chase's word.

## Oct 22–23, power hour (Chase)
- Merged on Chase's word: #33, #34, #36, the recruiter-ready stack #37 to #45 (no-login demo + fixes), and #32 (on-device opt-in AI, renumbered DEC-28 to DEC-31 because the night shift used DEC-28).
- Oct 23: `EXPO_PUBLIC_SUPABASE_ANON_KEY` saved in Expo's preview environment (Chase's "ok 3"; both public settings now live there, so `eas update --environment preview` needs no export step). Published main 3cd7eb7 to the preview channel (group 80906a4a); the standing Expo Go link serves it.
- Oct 23: D1, D2, D5, D7, D9 decided (DEC-32 to DEC-36, persona check `decisions/2026-10-23-notice-sender-names.md`).
- Oct 23: name check: Fridge Door is taken ("Fridge Door: Kids Drawings" app and several FridgeDoor products), so it's dropped. MARKETING.md shortlist updated; Front Room and Homeplace are next to re-check. Name final: still no. PR #49 merged. Five more Kinfolk-style names logged (Our Folks, Porch Swing, Sunday Supper, Homecoming, Kith); Chase still deciding.
- Chase pasted the demo INTAKE into Product Studio (Oct 22). Next: messenger test MS3.

## Portfolio / public presence
- **Nov 19:** the demo's glass tab bar shrinks on scroll and comes back on scroll up once the R64 PR merges (DEC-75).
- **Nov 19:** the demo's tab bar floats as a glass capsule (Easy view Off) and Grandma Jo's view no longer enlarges the laptop panel, once the R61 PR merges (DEC-72).
- **Nov 19:** the demo's Paper light page becomes Linen `#F7F7F4` when the R58 PR merges (DEC-69).
- **Oct 30, demo parent renamed (Product Studio INTAKE):** Hearth is featured on the portfolio homepage (portfolio PR #38), and the site credits Chase's real brother Sam, so the demo's made-up parent "Sam" is now "Kai" (no family member has that name; three letters keeps the demo bar on one line). Changed `app/src/demo/seed.ts`, `DemoBar.tsx`, their tests and the web e2e specs; re-shot `docs/portfolio/screens/` (the old shots said "Sam"). Rebuilt the demo from main: `portfolio/hearth-demo-site-2026-10-30.tgz` in the project files. Checks: 677 app tests, 993 database checks, demo + showcase sweep green. Reply to Product Studio: `docs/portfolio/INTAKE-2026-10-30-demo-rename.md`. Backend SQL fixtures still use a child named Sam; they are never shown publicly. **Next:** Product Studio re-copies demo/hearth/ and the screenshots.
- **Oct 22, shipped (portfolio PR #15, merged and deploying):** Product Studio hosts the no-login demo at chaseholroyd.com/demo/hearth/ (copied from `app/dist-demo-site/`, built from main 10001df) and refreshed family-photos.html per `INTAKE-2026-10-22-demo.md`. The page now has "Try the demo", named groups, AES-256-GCM and MLS, no "Seen by" count, eight agents, 600+ app tests and 800+ database checks, a laptop shot and three phone shots. The placeholder name is kept, and neither expo.app nor the repo is linked. To update the hosted demo later, rebuild here and send Product Studio an intake to re-copy `dist-demo-site/`. Note: the demo bundle's Expo config includes the Expo owner slug (not a link or a secret). **Next:** open chaseholroyd.com/demo/hearth/ on a phone and a laptop and re-run the review against the live URL.
- **Oct 22:** chaseholroyd.com/family-photos.html already shows Hearth under a placeholder name ("name coming"); Product Studio owns that page. Hearth handed Product Studio an INTAKE block (`docs/portfolio/INTAKE-2026-10-22.md`): refresh the test counts, add three sample-data iPhone screenshots from `docs/portfolio/screens/`, add the encryption and "no Seen by" points.
- **Oct 22, recruiter-ready sprint v2:** review in `docs/reviews/2026-10-22-recruiter-ready.md` (RR-1..16: 5 P0, 7 P1, 4 P2). Main gap: no no-login sample-data demo. Fix loop builds one (demo build, sample pictures, demo bar, laptop frame) for Product Studio to host at chaseholroyd.com/demo/hearth/. Round 1a done: demo build with a sample family, demo bar, Grandma's view (`npm run export:web:demo`, `npm run e2e:demo`). Round 1b done: laptop frame with a story panel, plain not-found page. Round 1c done: `npm run build:demo-site` builds the demo for chaseholroyd.com/demo/hearth/ (tested on a Pages-like static server). Round 1d done: README and case study agree (600+ app tests, 800+ database checks, eight agents, demo), portfolio screenshots re-shot from the demo, new INTAKE. Round 2 done: every demo screen re-checked (no new P0/P1), RR-11 groups words, RR-13 test-all exit code, RR-17 shorter demo bar. **Exact next step:** RR-4 waits on Product Studio (Chase pastes `docs/portfolio/INTAKE-2026-10-22-demo.md`). Round 3 done: RR-15 (full-screen photo survives a reload on a static host). Left: RR-16 (confirm disabled buttons with a real user; nothing to build). Round 4 (nightly run, Oct 22): fresh re-check found RR-18 (Messages counted parents without saying so; fixed with "Parents are in every chat.") and RR-19 (a stale next-step line in this file; fixed). **Oct 24: published and checked live.** chaseholroyd.com/demo/hearth/ passed the full showcase sweep at phone and laptop width, light and dark (`SHOWCASE_BASE=https://chaseholroyd.com/demo/hearth/ SHOWCASE_DIR=<dir> npm run e2e:demo -- demo-showcase.spec.js`). Full screen survives a reload, and family-photos.html carries the Oct 22 INTAKE. Review: `docs/reviews/2026-10-24-share-ready.md`.
- **Don't link publicly:** the expo.app web build (the live app on the family's real backend, sign-in only). (Oct 22 note; the repo itself has been public under AGPL-3.0 since Oct 31.) The public no-login demo is built (`app/scripts/build-demo.sh`) for chaseholroyd.com/demo/hearth/; Product Studio hosts it from `docs/portfolio/INTAKE-2026-10-22-demo.md` (Chase pastes it there), which also fixes the page's households wording and test counts and swaps in screenshots from the demo.

## Oct 22: photo helper off-switches (R15, HELP-R4; branch claude/project-thread-u4hx6x)
- **Built, test-first:** migration 0016 adds `photo_helpers_duplicates` (same photo twice, already sent, look-alikes) and `photo_helpers_screens_blur` (screenshots, blurry) to the 0013 flag system. They are off-switches: on unless Hearth's global row or the family's row says off, for anyone who can post, never for a viewer who can't. The app reads them from `my_features` and each helper obeys its own switch; with both off no preview is read. Tests: `backend/tests/photo_helpers_test.sql` (13), HELP-R4 app tests in `helpers.test.ts`, `bulk.test.tsx`, `groupsV2.test.ts`, contract test.
- **Tests (3 green runs):** app 619 + 1 skipped, typecheck clean, backend SQL all suites green (HELPERS 13/13), prototype e2e 33, web e2e 4.
- **Done:** 0016 is live on hosted (deployed Oct 23, smoke 9/9) and the Expo Go update is published.
- **Decisions to review:** the app treats the helpers as off until `my_features` answers (same as video, FLAG-5), so a failed read on a bad network means no helpers that time. Only the family's owner can switch them (FLAG-3 rule). No on-screen switch yet (TRACKER R17).

## Oct 22: studio ux-reviewer synced (recruiter-ready sprint)
- Synced `ux-reviewer` from studio-agents (PR #6 branch `claude/project-thread-wvkxmq`, showcase review mode) with `scripts/sync.sh`; roster row added to `CLAUDE.md`. The rest of `examples/hearth/MIGRATION.md` (swap staff-pm, qa-tdd, privacy-security, app-engineer and marketing for the generic ones, archive funding-analyst) is not done: those Hearth agents carry Hearth-only facts, so it waits for after the Nov 22 beta (TRACKER row R16). Decision to review.

## Oct 21, night shift 1: freeze lifted, review, ranked list, first fixes (branch claude/project-thread-kzt7by)
- **Done:** app review (`docs/product/reviews/2026-10-21-app-review.md`); ranked list in `TRACKER.md` "Sequence to milestone 2"; `docs/eng/PERFORMANCE.md` with measured encryption speed; DEC-28, DEC-29 and the speed-architecture persona check. Built test-first: R1 parallel sending (PERF-UP-1..3), R2 no "Seen by", R3 photos fill the card.
- **R4 (part):** `app/src/crypto/aesGcm.ts` picks native, then crypto.subtle, then JavaScript; upload and viewing use the async path. The native module is installed with the first development build (registerNativeAesGcm), not now: Expo Go can't load it.
- **R5 done:** T8 (RFC 9180 A.2.1 vector passes: our HPKE matches the standard), T9 (QA-3 test pins seed.sql's post dates), T10 (fake chatFetch has the joined-at cutoff, contract test).
- **R7 done:** root README, case study, iPhone screenshots (`SNAPSHOT_DIR=../docs/portfolio/screens npm run e2e:web`). e2e core-loop now expects no "Seen by". R6 moved to P2 (LG persona, REPLY-11).
- **R9 done:** cold start 260 ms median (web + fake). **R10 done:** `SPEC-PHOTO-HELPERS.md` + persona check; build is R15.
- **R8 done (A3):** photos seen before open from the phone, offline too. `media/cache.ts` keeps ciphertext files (`platform/mediaStore.ts`, cache folder, 400 max) and item keys sealed under a Keychain/Keystore key; `FeedStore.onRefreshed` prunes them, sign-out wipes them. Web keeps nothing. Tests A3-1..6. Docs: 02, 03 "On the phone", 04 former-member row.
- **R12 done:** thumbnail loop starts from a guess based on the display JPEG (`media/pipeline.ts`, R12 RV-P5 tests).
- **R15 part 1 done:** `share/helpers.ts` (HELP-R5, DUP-1, SHOT-1), BatchReview lines with "Send them too" and "Show what we left out"/"Put back" (HELP-ALL-1), picker reads library id and screenshot flag (`media/pick.ts`), `media/pixels.ts` (dHash, sharpness, darkness) tested on synthetic pictures.
- **R14 done:** audit unchanged on expo 57.0.30; one advisory ships (decode-uri-component in expo-router, crafted link could freeze the app). Review RV-X4 corrected.
- **R15 part 2 done:** look-alikes from a 160 px preview (`media/preview.ts`, jpeg-js 0.4.4 from npm, `pixels.ts`), lines appear after the screen opens; blur built but off (`BLUR_UNDER` null) until tuned. PERF-HELP-1: 30 ms per photo without JIT.
- **R11 done:** Photos header buttons two to a row (`PhotosScreen.tsx`, `photosHeader.test.tsx`); sketch and persona check in `docs/product/decisions/2026-10-21-photos-header.md`. Portfolio iPhone screenshots refreshed.
- **R15 DUP-2 done:** "already sent" from a 30-day list of preview fingerprints on the phone (`share/sentBefore.ts`).
- **R6 dropped** by Chase Oct 21, kept in mind (DEC-30).
- **Next exact step (Oct 21 plan):** everything left is blocked. R15 blur tuning needs Chase's 40 labeled photos; R15 server flags need a migration Chase deploys; R4 needs a development build; R13 needs FLAG-7. The nightly task now runs the recruiter-ready fix loop instead.
- **Decisions to review:** "already sent" compares a fingerprint of the small preview, not the full file (HELP-DUP-2). Photos header buttons two to a row, labels may wrap to two lines (R11). Look-alike lines appear a moment after the review screen opens (Send never waits). R15 helpers are on by default with an in-code switch, not a server flag yet (HELP-R4); Android screenshots come from the "Screenshots" album only. R3 crops tall or wide photos in the card to fill the frame (the full photo is one tap away). A3 keeps photo keys on the phone, sealed under a Keychain/Keystore key (RV-X6); a removed member's offline phone keeps showing kept photos until its next refresh.
- **Blockers:** none. A1 can't be checked on a phone until a development build exists.

## Earlier: end of day 2 (Thu Oct 15, 2026, 10:30 pm)

## Oct 18: anchor A4 White-paper ready, architecture docs started (Chase's ask)
- Chase: build documentation as we go so it turns into white papers easily, for intelligent, privacy-focused tech readers. Logged as anchor A4 and an ideas-log row in `docs/product/ANCHORS.md`.
- New `docs/architecture/`: README (reader, writing rules, keep-current rule), system overview, data flow, encryption and keys, threat model. Each claim is labeled Built, Planned or Gap and cites code.
- CLAUDE.md rule 6: PRs that change how data is stored, moved, encrypted, logged or shared update the matching section in the same PR.
- Found while writing: `deploy.sh` doesn't schedule `purge_soft_deleted` on hosted (tracker row added).

## Oct 17, evening: milestone 1 runs in Expo Go (Chase's call)
1. **Decided:** milestone 1 runs fully in Expo Go. NOTIFY-3 (tap a push and the post opens) moves to milestone 2, so the $99 Apple account is off the M1 path; M1 notices come by email. Updated BETA-SPEC (criterion map, M1 and M2 gates), MILESTONE-1 and REMAINING.
2. **Focus:** milestone 1 only. Nothing new gets built until Chase has signed in and run the demo; the demo shows what to fix.
3. **Waiting on Chase, in order:**
   - [ ] Paste the two code email templates in the Supabase dashboard, then sign in once (Claude then runs `family-setup.sh` and sends account B's code).
   - [ ] Add the Backblaze B2 keys and `MEDIA_KEK` as Hearth environment secrets (photos), plus Resend (email notices). Never in chat.
   - [ ] Run the 2-day demo in Expo Go, with account B on the web build.
   - [ ] Later: Mom's email for her poster invite (M2), the "Seen by" call (before M4), the phone survey (Oct 20).
4. **Stale items below, now closed:** PR #9 merged; 0010 and 0011 deployed to an empty database (Oct 17), so the v2 dry run, the apply step and the re-seed family list aren't needed.

## Oct 17, afternoon: family setup in one command, no database password (SETUP-API)
1. **Built, test-first (`backend/tests/setup_api_test.sh`, 34 checks; in `tests/run.sh` and on the real stack in CI):** `bash backend/scripts/family-setup.sh --chase-email <yours> --space-name 'Our kids' [--mom-email <hers>]` sets up your family in the groups shape through the Management API, like `deploy.sh`. It needs only `SUPABASE_ACCESS_TOKEN` (no `SUPABASE_DB_URL`, no `psql`) and runs as you through the app's RPCs and RLS. It makes Everyone, both sides, each grandparent's house, a Test house for account B, the two events, and prints the invite codes. It stops once anyone else has joined (then use `family-setup-v2.sql`'s dry run).
2. **Why:** hosted now runs 0001–0011 and is empty, so the v1 `family-setup.sql` then v2 would hand account B an invite to a group v2 retires. MILESTONE-1 step 5 and the demo rows now use this script and the Test house.
3. **Next for you:** paste the sign-in code email templates (action item below), sign in once in Expo Go or the web build, then Claude runs the script and gives you account B's code.

## Oct 17 overnight: bulk upload + timeline, family shape, two review rounds (PR #9)
1. **Built, test-first:** bulk upload by date taken + timeline + Jump to year (migration 0010; one batch notice per bulk import); family shape: Everyone, groups, households, events, Parents, share history (migration 0011) and `backend/scripts/family-setup-v2.sql` (dry run by default). 0012 (households only) is not built.
2. **Reviews and fixes:** privacy-security on 0010 and 0011 (S-0011-1..8: replies fixed by when a house joined a post or when someone's share history was widened; Everyone can't be retired even by a direct update; retiring is one-way, so a direct update can't un-retire a group or household; stale invites refused). grandparent-ux (UX-G1..G9: plainer share and group words; an invite that no longer works says "Ask Chase for a new one." before anyone types, signed in or out; signed in, that screen has a "Go to Photos" button).
3. **Tests (3 green runs, Oct 17 morning):** backend SQL 639 (RLS 120, API 169, notify 60, setup 5, reply 47, timeline 38, groups 168, timeline-future 6, AUD-16 11, setup v2 15), deploy 20, EAS 6, prototype 33, Jest 340 + 1 skipped, typecheck clean, web e2e 1.
4. **Known gaps:** `get_timeline` p95 is 2–5.5 ms on a 2-CPU box against a 5 ms target (re-measure on hosted); without `expo-media-library` there's no fallback to a photo's creation time when it has no EXIF date; Deno tests run only in CI (not installed here); "Seen by" still conflicts with A2 (your call); M-13..M-16 (bulk-pick on your iPhone, airplane mode mid-batch, location stripped) need your phone.
5. **Action items for Chase:** see the checkboxes at the top of the list below (merge, then the v2 dry run before any deploy).

## Oct 17: groups, households, events built (SPEC-GROUPS first build, app-engineer)
1. **Built, test-first (qa-tdd's red tests now green):** migration 0011 (family shape, section 10 privacy review), `backend/scripts/family-setup-v2.sql` (dry run by default), and the app (share-history pick with no default, comment box names its readers, per-group switch gone, events in the share sheet, timeline card opens the post, future capture dates ignored). 0012 (households only) is not built yet. Contract notes: `docs/eng/API.md` "As built (0011)".
2. **Tests:** backend SQL 607, deploy 20, EAS 6, prototype 33, Jest 329 + 1 skipped, typecheck clean, web e2e 1. Deno is not installed in this sandbox.
3. **Chase:** don't deploy 0011 yet. Run the v2 dry run on a copy of the database with `-v sister_name=...`, read the gains/losses with staff-pm, then take a backup and apply with `-v apply=yes`.

## Oct 17, 3 am: groups, households, events, roles (spec only, staff-pm; replaces "one family hierarchy")
1. **Specced, not built:** `docs/product/SPEC-GROUPS.md` (renamed from SPEC-HIERARCHY.md), from your 2:47 am answer. Fixed shape: Everyone, set groups (your side, Mom's side), households just under them; a person can be in several households and groups (Mom's sister in Memaw's and Pawpaw's houses). Events combine any groups and households (Charleston trip, Gigi's birthday, custom groups). Only parents send to Everyone. Adding anyone asks "Share all past photos" or "Only new photos", no default. Criteria BETA-AUD-11 to 22, REPLY-7 to 13; AUD-9 retires.
2. **Migration order (also in the overnight plan):** 0010 timeline, 0011 family shape (removes the 0009 switch), `family-setup.sql` v2 re-seed, 0012 households-only. Next: privacy-security review, then qa-tdd failing tests. Before milestone 3; doesn't block M1 or M2.

## Oct 17, 2 am: first real deploy (Chase's ask, without function keys)
1. **Live on `jqvgjfbhzbvfdhtnvgzr`:** migrations 0001–0009 (the Management API accepts begin/commit, so the migration-transaction question is settled), both edge functions, `NOTIFY_CRON_SECRET`, and the `hearth-notify` and `hearth-purge-client-errors` cron jobs.
2. **Failed, step 5/5 (sign-in email: 6-digit code):** `PATCH config/auth` returned 403 "Missing required permission(s): project_admin_write". The access token is scoped and can't change project settings. Until this is fixed, sign-in emails send Supabase's default link, not a code.
3. **Action items for Chase:**
   - [x] **Merge PR #9** (bulk upload + timeline, family shape, review fixes).
   - [x] *(Moot: deployed Oct 17 to an empty database.)* **DON'T run `deploy.sh` from main until the v2 dry run is reviewed.** Deploying applies 0010 and 0011; 0011 changes who reads replies and needs the v2 re-seed right after.
   - [x] *(Moot, empty database.)* **v2 dry run, on a copy of the database** (a restored backup or a Supabase branch with 0010 and 0011 applied, never the live one): `psql "$SUPABASE_DB_URL" -v chase_email=you@example.com -v space_name='Our kids' -v sister_name='<her name>' -f backend/scripts/family-setup-v2.sql`. Read each person's "gains N posts, loses M posts" line with staff-pm (expected: Mom gains 3 posts as a Parent, since Parents see every post). It needs `SUPABASE_DB_URL` (the database connection string from the Supabase dashboard; `SUPABASE_ACCESS_TOKEN` alone isn't enough, since the script runs through `psql`), `psql` installed, and your account signed in once in the app.
   - [x] *(Done: 0010 and 0011 deployed Oct 17.)* **Then apply:** take a backup, run `deploy.sh` (applies 0010 and 0011), and right after run the same command on the live database with `-v apply=yes` added.
   - [ ] **Sign-in code email.** Either paste the templates in the Supabase dashboard (Authentication → email templates: Magic Link and Confirm signup, subject `Your Hearth code: {{ .Token }}`, bodies from `backend/supabase/templates/`; code length 6, expiry 3600 s), or make a token with project admin write, replace the `SUPABASE_ACCESS_TOKEN` secret, and rerun `deploy.sh` (applied steps are skipped).
   - [ ] **Function keys.** Fill the values in `backend/supabase/functions/.env.example` (Backblaze B2, `MEDIA_KEK`, `ALLOWED_ORIGINS`, Resend, `APP_LINK_BASE`, Expo). Add them as Hearth environment secrets so a session can write `.env` and rerun the deploy. Until then, photos (sign-media) and notifications (notify) are deployed but can't work.
   - [ ] **Cleanup after the keys are in:** delete the placeholder Supabase secret `HEARTH_KEYS_PENDING`. It was set only because `supabase secrets set --env-file` rejects an empty file.
   - [x] **Groups spec, 3 one-word answers** (Oct 17, 3:26 am: Groups, Parents; event replies default to Event) (`docs/product/SPEC-GROUPS.md` §9): event replies Event or Household (rec. Event); a relative's post goes to Groups or Everyone (rec. Groups); who sends to Everyone and makes events, Parents or Owner (rec. Parents).
   - [x] *(Moot: `family-setup.sh` makes a fresh family.)* **Family list for the re-seed** (spec §2): Mom's sister's name; put her in both Memaw's and Pawpaw and Granny's houses (rec. yes); who was at Gigi's birthday; any sibling of yours to place in both your parents' houses.

## Oct 17: deploy review fixes (DEPLOY-2, DEPLOY-3)
1. **Built, test-first (`backend/tests/deploy/deploy_test.sh`, now 20 checks):** function deploys pass `--use-api`, so Supabase bundles them and no Docker is needed (DEPLOY-2). A migration the API rejects now prints its file name and the Postgres error, with the cron secret redacted; before, it said only "failed" (DEPLOY-3).
2. **Doc:** `docs/product/MILESTONE-1.md` step 2 now says the hosted test runs and `family-setup.sql` still need `SUPABASE_DB_URL`.
3. **Not verified live:** the Management API has not yet run a migration transaction on the hosted project; the first real deploy will show it.

## Oct 16 afternoon: deploy needs only the access token
1. **Built, test-first (DEPLOY-1, `backend/tests/deploy/deploy_test.sh`, 16 checks, stubbed, in CI and `test-all.sh`):** `backend/scripts/deploy.sh` now applies migrations and the notify cron through the Supabase Management API (`POST /v1/projects/{ref}/database/query`) instead of `supabase db push` and `psql`. Each migration runs in one transaction and is recorded in `supabase_migrations.schema_migrations` (the CLI's own table), so reruns skip what's applied. The `link` step is gone; steps are now 1/5–5/5.
2. **Needs you:** only `SUPABASE_ACCESS_TOKEN`. `SUPABASE_DB_PASSWORD` and `SUPABASE_DB_URL` are no longer needed to deploy. The hosted SQL suites and `family-setup.sql` still use `psql`, so they will need a connection string or the same API route later.

## Oct 16: who reads replies (Chase's call), and the real family
1. **Family:** `docs/product/PERSONAS.md` is now your real family (Gammy … Great-Grandma, Gigi, Bebar with the smart frame). Docs live in `docs/product` and `docs/eng`; `docs/product/STORY.md` is the story agents read.
2. **Built (migration 0009, AUD-8/9/10):** by default only the parents (and the post's author) read a relative's comment or heart; counts leave hidden ones out; parents' replies reach everyone. A group can turn on "members see each other's replies". The owner can open replies to everyone (Me screen). The comment box says who will read it. privacy-security fixes: raw counters hidden, no profile leak through replies, no setting leak.
3. **Tests (3 green runs):** SQL 116 + 169 + 48 + 5 + 37 reply; Deno 26; Jest 245 + 1 skipped; typecheck clean; web e2e 1; app contract vs real PostgREST 85 passed (9 skipped).
4. **Next (your direction):** nested groups (a group inside a group, e.g. person → household → side → whole family), set up by a guided flow or by select/drag. This changes who sees posts, so it gets its own spec and review.
5. **Your calls:** should adults (Mom) also flip the group switch, or only you? A viewer who posts (off by default) has their replies treated like a parent's on their own post.

## Oct 16 morning: sign-in and sign-up for every persona (Chase's ask)
1. **Day-1 blocker fixed:** Supabase's default sign-in email sends a link, not a code. New templates show the 6-number code big and in the subject, have no links, and warn "Never read this code to anyone who calls or texts you". `deploy.sh` step 5 pushes them to the hosted project.
2. **Built, test-first, grandparent-ux reviewed:** pasted codes with spaces or dashes work; "I have an invite code" on the first screen and on "Almost there" (BETA-JOIN-8), with the code on your invite card and in the text ("Hi, it's Chase… call me and I'll help. Your code is …"); a Junk/Spam hint and a 60 s wait before a new code; "Did you mean june@yahoo.com?"; a clear wrong-email message, while the server still gives no oracle (JOIN-3).
3. **Not built (staff-pm call):** an in-app "Start a family" (deferred to milestone 7 so Hearth stays invite-only); you still use `family-setup.sql`. Couples sharing one email work as one account; that needs a line in the guide, not code.
4. **Tests (3 green runs):** SQL 116 + 169 + 48 + 5; Deno 26; Jest 237 + 1 skipped; typecheck clean; web e2e 1.
5. **Next:** deploy (MILESTONE-1 steps 1–4), then the Expo Go demo. The first real sign-in checks that the email template took.

## Overnight Oct 16, part 4 (staff-pm build queue, unattended)
1. **Built, test-first, reviewed:** real names (0007; posters set theirs once, invites carry "Grandma June", notices use the full chosen name; privacy-security fixes: no bypass, header-safe, no impersonation). `rename_circle` RPC (0008; duplicates were 23505). No dead `hearth.family` link in emails until the site exists. SHARE-4 kill-at-every-step coverage. On-phone notice timing log + Me-screen report (AE-10, cleared on sign-out). "Take me off Hearth" (JOIN-7) for non-owners. grandparent-ux: the comment box names who can read it; no nameless emails.
2. **Tests (3 green runs):** SQL 116 + 169 + 48 + 5; Deno 23; Jest 223 + 1 skipped; typecheck clean; web e2e 1. **App contract vs real PostgREST: 79 passed** (local harness; 9 skipped need a joiner email or B2). One earlier run had 1 app test fail and ~35 reruns couldn't reproduce it; failure names are captured from now on.
3. **Your calls (logged in docs/product/ANCHORS.md):** who sees comments; Seen by; what happens when the space owner deletes their account.
4. **Skipped:** demo rehearsal in a browser against the local stack (needs GoTrue for sign-in); do it on staging.
5. **Next:** deploy (MILESTONE-1 steps 1–4), then the family setup script and the Expo Go demo.

## Overnight Oct 16, part 3 (staff-pm product review)
1. **Found:** comments are readable by everyone a post was shared with, but the app said "Sent. Chase will see it." Fixed the words (BETA-REPLY-6). *Who should see comments* (story: Grandma A without Grandpa B) is logged in docs/product/ANCHORS.md for Chase; staff-pm leans "the poster plus people who share a group with the commenter".
2. **Built:** `backend/scripts/family-setup.sql` (space, starter groups, test-viewer invite, Mom's poster invite; run as Chase through RPCs; 5 tests). `backend/scripts/deploy.sh` (one-command deploy; dry-run only). `docs/product/MILESTONE-1.md` (Chase's steps, the $99 answer, Expo Go yes/no, 2-day demo).
3. **Tests, 3 green runs:** SQL 116 + 141 + 48 + 5 setup; Deno 19; Jest 196 + 1 skipped; typecheck clean; web e2e 1 ×3.
4. **Reflection point armed** (docs/product/REMAINING.md): no more backend/test polish until a deploy or a device run.
5. **Resume at 4 am ET:** a scheduled check-in restarts this session; next is whatever doesn't need access (staff-pm's list), then deploy once Chase finishes MILESTONE-1 steps 1–4.

## Overnight Oct 16–17, part 2 (after reading ANCHORS + the story doc)
1. **staff-pm:** BETA-SPEC and REMAINING now follow your milestones. Every criterion maps to a milestone and traces to a story problem or anchor; new NOTIFY-7 and AUD-7; ring dates dropped. Flagged: NOTIFY-6 vs A2, JOIN-7 (Apple rule only), AUD-4 (persona-only), SHARE-6 video (still deferred).
2. **Built, test first:** app saves push token + notification choice to the server; emails arrive when Help promises (6 pm / Sunday 8 am Eastern); notices say "From Chase on Hearth" (NOTIFY-7); posters can no longer read *when* each person last looked (AUD-7; "Seen by" unchanged); removed authors can't edit old captions (S12, migration 0005); our own error reports with fixed fields only, no SDKs (OPS-1, migration 0006).
3. **Tests, 3 green runs:** SQL 116 RLS + 141 API + 48 NOTIFY; Deno 19; Jest 195 + 1 skipped; typecheck clean; web e2e 1. CI on main was green before this batch.
4. **Needs you:** same as part 1 (network allow-list + `SUPABASE_ACCESS_TOKEN`, then keys). Decide NOTIFY-6 / "Seen by" before milestone 4.
5. **Next:** deploy to staging once access exists; check whether Expo Go can run milestone 1 without the $99 Apple account; tracker hygiene (close S12).

## Overnight Oct 16: notification sender (AE-2)
1. **Built:** migration 0003 adds an outbox filled on publish/comment/heart and a batching claim (at most 1 push per 10 min and 1 email per day; access is re-checked at send time). New RPCs `register_push_token` and `set_notification_prefs` are in docs/eng/API.md. The `notify` edge function sends through Expo Push and Resend with the first name and post id only, retries failed sends, and drops dead phone tokens.
2. **Tests (one full run):** SQL 110 RLS + 130 API + 46 NOTIFY green; Deno 17 (5 sign-media + 12 notify); Jest 179 passed + 1 skipped; typecheck clean; web e2e 1 passed (the day-2 note said 3/3, worth a look). Nothing is deployed.
3. **Needs you, access:** in the environment's network settings, allow `mcp.supabase.com`, `api.supabase.com` and `jqvgjfbhzbvfdhtnvgzr.supabase.co`, and add `SUPABASE_ACCESS_TOKEN` as an environment secret. Then Claude can run `bash backend/scripts/deploy.sh` (migrations and cron go through the Management API).
4. **Needs you, keys:** put the values listed in `backend/supabase/functions/.env.example` into Supabase secrets, the values in `app/.env.example` into `app/.env.local`, and add GitHub secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF`. The service_role key stays inside Supabase only.
5. **Open:** the 1-minute cron for `notify` (after deploy); the app doesn't call the two new RPCs yet (contract test first); email links go to `hearth.family/p/<id>`, which needs the website plus an Android `/p` link filter. **PM call:** with "3 posts in 10 min", the first post buzzes right away (to keep NOTIFY-1 within 60 s) and the rest go out as 1 notice.

## Verified state (rerun independently at 1:30 pm)
- **Backend:** 110 RLS + 130 API SQL tests green. Deno sign-media tests 5/5. Integration smoke test 4/4 over real PostgREST. `get_feed` p95 is under 2 ms at 1M posts.
- **App:** typecheck clean; Jest 179 passed + 1 skipped (live-API block); web e2e 3/3. Contract tests against real PostgREST: 19/19 of the runnable ones.
- **Prototype + Test Log:** 32/32 prototype cases green. The Test Log page is published; its data covers runs through day 2 morning only.

## Not done
1. **GitHub: done (Oct 15, 10:45 pm).** Code lives at github.com/holroydchase-afk/Hearth, and Claude can push to it. Start every session at claude.ai/code with Hearth selected. No more zips or bundles.
2. **CI (`.github/workflows/ci.yml`)** runs on every push. Getting it green closes S16: the backend tests on a real Supabase stack. Check the Actions tab for the latest result.
3. **Notifications aren't built**, push or email. This is the biggest gap. NOTIFY-1/2/3 and REPLY-3 depend on it.
4. **Nothing has run on a real phone yet.** Unverified: resize, save to phone, OTP email, deep links, push.
5. **Missing API endpoints:** push-token save, notification prefs, profile name, who hearted, re-signing an upload after a crash (see `app/README.md`, "docs/eng/API.md gaps").
6. **The Test Log isn't updated.**
   - S9 and S10 still show open there.
   - New app suites and runs aren't recorded.
   - Run `tracker/build_seed.py` and push it to the Test Log artifact (claude.ai/artifact/XnfnBsuPL7ayedPHBpvctD).
7. **Video is off for the beta.** iOS location metadata can't be stripped without a transcoder.

## Chase's to-dos (blocking)
- **Intake #83 (stock photos in the demo), Oct 31:** this cloud environment can't reach any stock photo site (Unsplash, Pexels, Openverse and Wikimedia all refused). Add `images.unsplash.com`, `unsplash.com`, `images.pexels.com`, `api.pexels.com`, `api.openverse.org` and `upload.wikimedia.org` under Allowed domains (Project settings, Cloud environment, gear), then the next Intake check does it. Labeled needs-chase.
- Confirm Apple Developer enrollment.
- Create the accounts:
  - Supabase: a staging and a prod project, both East US
  - Backblaze B2: US East, which can't be changed later
  - Expo, Resend, and the Google Play Console
- Run the name check, then buy the domain.
- Phone survey by Oct 20: each person's phone model, OS version, and the email they actually check.
- Decisions (picks in `docs/product/CORE-FEATURES.md`): an Android test phone (~$100), upgrading the Claude plan, and the 5 product questions.

## Next session, in order
- **Native look (Oct 19, PR #30):** the app follows Apple's rules on iPhone and Material 3 on Android, plus Hearth's overrides (`docs/product/DESIGN-SYSTEM.md`). Every look is saved in `docs/design/versions/`; add a folder with `app/e2e-web/snapshot.spec.js` whenever the look changes.
- **Agent update (Oct 19): `grandparent-ux` is Hearth's UI/UX designer.** It designs as well as reviews, introduces itself to Chase, uses the ranked family personas (Bebar, Gigi, Great-Grandma first; Grandaddy and Pawpaw on Android) instead of "Grandma June", and measures sizes and contrast rather than guessing.
- **New agent (Oct 16): `marketing`.** Logs and develops Chase's positioning ideas in `docs/product/MARKETING.md`. The chief of staff (main session) routes by the roster in `CLAUDE.md`; `scripts/check-agents.sh` keeps it in sync.
0. **Read `docs/product/ANCHORS.md` (added Oct 16, midnight).** Chase reframed Hearth as a proof of concept with new milestones. staff-pm: reconcile `docs/product/BETA-SPEC.md`, `docs/product/REMAINING.md` and the ring gates to those milestones (Ring 0 ≈ Chase only, then wife, then 1 savvy relative). Raise the A2 "Seen by" conflict as a decision for Chase before milestone 4. Don't delete built features.
1. Confirm the repo is pushed and CI is running. Fix CI until it's green; that closes S16.
2. **staff-pm:** daily triage. Update the Test Log.
3. **app-engineer + qa-tdd, test-first:** the notification sender (Expo push + Resend email, batched, with no image or caption in the payload) plus the missing RPCs.
4. **Infra:** staging Supabase deploy, Resend sending domain, an invite-link/privacy-policy page.
5. First Android internal build (EAS), then iPhone TestFlight once Apple approves.

## Links
- **Plans (claude.ai docs):** Hearth Beta Plan (with a Personas tab), Hearth Funding Plan.
- **Published pages:** Hearth Family Photos prototype (claude.ai/artifact/SbUX3TQP2crBZ5o68Kho2a), Hearth Test Log (claude.ai/artifact/XnfnBsuPL7ayedPHBpvctD).
- **Project docs:** `claude/hearth-*.md` and `claude/agents/*.md` in the "Family photo sharing" Project.
