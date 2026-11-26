# Spec: the two-step Share flow (all composers)

Status: Chase's call, Nov 26, 2026 (DEC-90) · Owner: staff-pm · Persona check: `decisions/2026-11-26-share-flow.md` · TRACKER R112
Look source: the "Share flow, in two steps" tester, look B "Say it first" (a published tester; its source stays in the scratchpad, not the repo). Reads with SPEC-TYPE and DESIGN-SYSTEM (DS-1..DS-9).

## The bet

Chase, Nov 26: "I don't like the lines, the to: line... overwhelming... everything should be broken into flows, at most 1-2 steps. Always move who it's to to its own step. Make the rest look better." Anchor A1 (Anxiety-less): a grandparent sees one question per page. Proof: GOALS "no help": a first-time tester posts one Photos, one Event, one News and one Saying with no help, each under 60 s (the 5-task test; 4 of 5 pass). Stop condition: if two of the beta grandparents tap Back from step 2 to hunt for a "To" field, or ask where the audience went, stop and rework step 2's title.

## The flow (Photos, Event, News, Saying)

**Step 1 of 2: the words.** Title row: "New post" (Photos) or the kind's verb ("Add an event", "Share news", "Add a saying") and "Step 1 of 2". One big open box on the page (no underline, no ruled line, no label row): placeholder asks the question ("What's happening?", "What's your news?", "What did they say?"). Quiet chips under it for the rest, per kind: Event: What day (required), Add a place; News: none; Saying: Who said it? (required), Add their age; Photos: the photos on top (as today), the note box below ("Say something, optional"). A chip is a 48 pt tinted pill with an icon and a verb ("Pick a day", "Add a place"); once set it shows the value in the same pill. A hint line above the pinned button names what is missing ("Add what's happening and the day to go on."). Pinned button: "Next: who gets it", off until required fields hold words.

**Step 2 of 2: Who gets it?** Its own page: "‹ Back", "Step 2 of 2", the title "Who gets it?", the group face tiles 2 across (same tiles and names as the postcard's: `tileName`, `othersIn`; a member never sees a group's title, DEC-73), nothing picked to start. Under them one summary line: "**Mom's side, Dad's side** will see this event." (or "Nothing is picked yet. Tap one or more."). Pinned "Send to <names>", off until one pick. A saying also says what is shown (SHARE-U-21's `sayingSeen` line moves to the summary). Then a sent page: "Sent", who will see it, "See it in Feed" and "Share another".

No underline fields, no ruled lines and no "To:" line on any Share page, empty card included.

## What changes in code (engineer's freedom inside the criteria)

`ShareScreen.tsx` becomes a step state (words, who, sent) over the existing send paths: `app.queue.enqueue` (photos, PRIV-aware `stageAll`) and `createPost` + `publishPost` with the client-id draft (PRIV-SK-R1) are untouched. `ShareKinds.tsx` loses `Field underline` and the "To:" row; its `FIELDS` become one big box plus chips. A new month-calendar bottom sheet replaces the typed `YYYY-MM-DD` day (`realDay` stays as the guard before send). Bulk review (11+ photos, `BatchReview`) keeps its own screen for now; its look is parked (Not doing).

## Acceptance (FLOW-1..FLOW-26)

| ID | Given / When / Then | Type |
|---|---|---|
| FLOW-1 | Given any composer (Photos, Event, News, Saying) in step 1, then the title row says "Step 1 of 2" and the pinned button is "Next: who gets it"; no group tile and no "To:" text is on the page. | auto (jest) |
| FLOW-2 | Given step 1 of Event, News and Saying, then the words are one multiline box with the question as placeholder and an accessibility label; no `Field underline`, no ruled-line view, no label above it. | auto |
| FLOW-3 | Given Event, then chips "Pick a day" and "Add a place"; Saying: "Who said it?" and "Add their age"; News: no chip; each chip is >= 48 pt tall with an icon and a verb, tap opens its editor. | auto |
| FLOW-4 | Given a chip with a value, then the pill shows that value (the day as "Saturday, Nov 28", the place, the name, "Age 4") and tapping it edits it. | auto |
| FLOW-5 | Given required fields empty (Event: words and day; Saying: words and who; News: words), then "Next: who gets it" is disabled and the hint line names exactly the missing ones ("Add what's happening and the day to go on."); once filled the hint is empty and the button is on. | auto |
| FLOW-6 | Given Photos with photos picked, then the big photo, thumbnails and "Say something, optional" box show; the button is on with no note; the empty Share card is still the one "Add photos" button (SHARE-ST-19..22, 24) with the "To:" and ruled lines removed (stamp kept). | auto |
| FLOW-7 | Given a ready step 1 and a tap on "Next: who gets it", then step 2 shows: "Step 2 of 2", "‹ Back", the title "Who gets it?", the keyboard is dismissed, the words and chips are kept. | auto |
| FLOW-8 | Given step 2, when "Back" is tapped, then step 1 returns with every word, chip value, photo and note exactly as left; the group picks are kept too. | auto |
| FLOW-9 | Given step 2, then the tiles lay out 2 across (1 across in Easy view if a name would spill, GUX-R1 `tileColumns`), nothing is picked, the summary says "Nothing is picked yet. Tap one or more." and "Send" is disabled with the hint "Pick who gets it to send." | auto |
| FLOW-10 | Given a member (non-parent) on step 2, then no tile, summary line or accessibility label shows a group's title (DEC-73, SHARE-PC-6); a parent still gets no "Everyone" unless allowed (BETA-AUD-21 unchanged). | auto |
| FLOW-11 | Given one or more picks, then each tile reads "<name>, N people, picked", the summary names them ("A and B", then "and N more", as `recipientsLine`) with the kind's noun ("this event", "your news", "this saying", "your photos"), and the button reads "Send to <names>". | auto |
| FLOW-12 | Given a Send on step 2, then the same API call as today fires once (photos: `queue.enqueue` with `circleIds`; kinds: `createPost` then `publishPost`, one client id per draft, PRIV-SK-R1 reuse and change rules unchanged); a double tap sends one post. | auto (contract + jest) |
| FLOW-13 | Given a successful Send, then a sent page shows "Sent", who will see it, "See it in Feed" (goes to Feed, post on top) and "Share another" (a clean step 1); no "Shared with ..." banner is left behind. | auto |
| FLOW-14 | Given a refused or lost Send, then step 2 stays, the notice shows at the top, every word and pick is kept, and "Send" works again (SHARE-U-22, GUX-SK-R2, `kindSendMessage` by `error.code`). | auto |
| FLOW-15 | Given "Pick a day" tapped, then a bottom sheet opens with a month grid (weekday initials, the month's name and year, earlier and later month buttons), today ringed, quick chips Today, Tomorrow and the coming Saturday (named by its day, like "Sat, Nov 28", GUX-FL-R6), and a Done button; the page behind is covered and the sheet closes on Done or on a tap outside. | auto |
| FLOW-16 | Given the sheet, when a day or quick chip is tapped, then exactly one day is selected (a quick chip moves the grid to its month), and on Done the day chip shows "Saturday, Nov 28"; the value sent is the real `YYYY-MM-DD` date, so `realDay` passes and the typed-date notices (`DAY_NOT_REAL`) can no longer show. | auto |
| FLOW-17 | Given the sheet, then month buttons and every day cell are >= 48 pt tall and at least 44 wide at a 360-wide screen, in Easy view too, with day numbers at `body` (17 / 21 Easy view); no cell is clipped at 360 or 412 wide. | auto (Playwright 360, 412) |
| FLOW-18 | Given the age chip, then its editor opens the number keypad and takes digits only, so the non-number age notice (`AGE_NOT_NUMBER`) can no longer show; an empty age is fine. | auto |
| FLOW-19 | Given Easy view off and on, light and dark, every step-1 and step-2 `Text` is Body 17 or larger for reading text (SPEC-TYPE; chips, hint and summary are `body` or `callout` with Easy view off, never under 17 with it on); targets >= 48 pt (60 in Easy view); the `a11ySweep` screens and TYPE-3 pass. | auto |
| FLOW-20 | Given VoiceOver or TalkBack, then step 1 reads title, "Step 1 of 2", box, chips as buttons with their value, hint, button; step 2 reads title, "Step 2 of 2", tiles with picked state, summary, button; the focus moves to the step's title on each change. | manual (iPhone, Android) |
| FLOW-21 | Given step 2 and a hardware or gesture Back, then it returns to step 1 (not out of Share); on step 1 with words, Cancel still asks "Throw away this card?" (GUX-SK-R11); the empty card cancels at once. | auto |
| FLOW-22 | Given the public demo (393 px) as Kevin, then Photos, Event, News and Saying each go step 1, step 2, sent, light and dark, with no "To:" text and no underline field anywhere on Share. | auto (Playwright) |
| FLOW-23 | Given the real-backend web build at 360 and 412 wide, then FLOW-1..14 pass with no sideways scroll and the pinned button sits above the floating tab bar (RD-109, `useTabBarSpace`). | auto (Playwright) |
| FLOW-24 | Given a source search of Share's screens, then `underline`, `strongLine`, `share-to-rule`, `share-note-rule`, `dash` and the string "To:" appear in none of them (a lint test, like `redesignLint`). | auto |
| FLOW-25 | Given a first-time tester (grandparent persona, or Chase's wife) on a real phone, when asked to post an event with a day and a place, then done with no help in under 60 s. | manual |
| FLOW-26 | Given the same tester, when asked to send a photo to one group, then done with no help in under 60 s and no tap on Back from step 2. | manual |

## Superseded tests

These assert the old look and are rewritten (not deleted) in the qa-tdd red step; each keeps its ID in the new title with "(DEC-90)".
- `app/src/screens/__tests__/shareStart.test.tsx`: SHARE-ST-23 (two ruled lines, "To:", one To: rule), SHARE-ST-24's "To:" and rule presses, SHARE-ST-17 "To:" press scale, GUX-W4 and GUX-T5 (rule and "To:" contrast), SHARE-ST-31 (kind card shows "To:" and a disabled "Pick who gets it"), SHARE-ST-26 (postcard with note box, To: tiles and Send in one card), GUX-R1 and GUX-R3 as they point at the "share-to" row.
- `app/src/screens/__tests__/sharePostcard.test.tsx`: SHARE-PC-1 (the card holds photo, note, dashed divider and To:), SHARE-PC-6, SHARE-PC-7, SHARE-PC-9 (the `To: <names>` line; the naming rules move to the summary line), SHARE-PC-10 (the "Pick who gets it" button becomes "Next: who gets it" then "Send to ...").
- `app/src/screens/__tests__/share.test.tsx` (the "Pick who gets it" disabled button) and `wordsPass.test.tsx` WORDS-1 (the To: line).
- `app/src/screens/__tests__/shareKindsSave.test.tsx`: SHARE-U-17 ("Pick who gets it" opens the tiles in place), GUX-SK-R1 and R2 (typed day, age checked on "Pick who gets it"), GUX-SK-R4 (`scrollToEnd` to the tiles), GUX-SK-R3 (`KIND_HINT` wording moves to the new hint).
- `app/src/screens/__tests__/reviewRound2.test.tsx` R19 (the note label and "To:" start 16 pt in).
- `app/src/ui/__tests__/redesignLint.test.ts` and `typeScale.test.tsx` where they list Share's underline fields or "To:" `testID`s.
- `app/src/demo/__tests__/demoFrame.test.tsx`, `demoKinds.test.ts` and e2e `demo.spec.js` DEMO-KINDS-7..14 and SHARE-ST-34 where they type the fields or tap "Pick who gets it".
- Also reconciled after the build (qa-tdd, Nov 26): `shareGux.test.tsx` GUX-R1 (tiles 2 across, 1 across in Easy view, never 3), GUX-R2 and GUX-R3 (the note is an open box, no underline); `sharePostcard.test.tsx` SHARE-PC-5 Easy (1 across); `shareStart.test.tsx` SHARE-ST-4, ST-7, ST-25, GUX-W5; `share.test.tsx` BETA-SHARE-1 (goFeed only after "See it in Feed"), QA-R2 and "is grandparent-safe"; `guxPaper.test.tsx` GUX-R3; `wordsPass.test.tsx` WORDS-4; `groupsWords.test.tsx` UX-G1..3; `problemDetails.test.tsx` DBG-3/4; `uploadFailure.test.tsx` MEDIA-3; `plainBackground.test.tsx` RD-34 Share; `redesignPolish.test.tsx` GUX-R9; `shareKindsSave.test.tsx` SHARE-U-19 retry. Each carries "(DEC-90)".
Unchanged on purpose: SHARE-ST-19..22 (empty card is one Add photos button), SHARE-U-19/22 and PRIV-SK-R1 (send paths), `bulk.test.tsx`, all contract tests.

## Review findings (Nov 26, grandparent-ux and privacy-security)
Failing tests first, in `app/src/screens/__tests__/shareFlowReview.test.tsx`: GUX-FL-R1 (P1: a closed outline >= 3:1 on the words box, chips and unpicked tiles; light, dark, Easy view), R2 (Easy view step 2 never hidden behind the dock), R3 (Easy tile caption >= 21), R5 ("Said by Leo"), R6 ("Sat, Nov 28"), R7 (sent page: check mark, first words, "Still sending..."), R8 ("Step 1 of 2" only after a kind is picked), PRIV-FL-R1 (orphan key `hearth.lastShared.v1.<userId>` deleted once at startup).

### Open P2 (deferred, no test yet)
GUX-FL-R4, R9, R10, R11 (grandparent-ux review, Nov 26): parked by Chase's chief of staff; take them up after R1..R8 and the real-phone tests FLOW-25 and FLOW-26.

## Not doing (ideas log, ANCHORS)
- Bulk review (11+ photos) look and its Title box: still one screen; revisit after beta feedback.
- Saved or suggested audiences, "Same as last time": nothing pre-picked stays (SHARE-PC-7).
- Typing a day by hand, relative words ("next Friday"): the sheet only.
- Post from the Feed or More: Share stays the one composer.

## Biggest risk
Two steps turns a one-page post into an extra tap for the posting parent (PA), and a grandparent may not notice step 2 exists. Handled by "Step 1 of 2" always in view, the button naming the next step, and FLOW-25 and FLOW-26 on a real phone before anything else ships.

Last checked: Nov 26, 2026 (against `ShareScreen.tsx` and `ShareKinds.tsx` on main).
