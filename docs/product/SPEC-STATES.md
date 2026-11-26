# SPEC-STATES: error, empty and help states on the list screens (STATES-1..STATES-24)

Status: specced Nov 26, 2026 (staff-pm) · Intake #208 (Product Studio factory assessment) · Anchor A1 Anxiety-less · DS-8 "Errors and loading use words: what happened, what to do, who to call" · Persona check due before final: `docs/product/decisions/2026-11-26-states.md` (grandparent-ux writes it; `scripts/check-persona-checks.sh`) · TRACKER row to add by the thread that builds it (this spec does not touch TRACKER)

## The bet
Gammy opens Gallery on a bad signal. Today she sees a blank page and a small note she can wave away with "OK, hide this message", and nothing says her photos are safe. She decides Hearth is broken and calls Chase. Done means: on every list screen, a lost signal shows a plain line that stays until it works, a "Try again" button, and the words "your photos are safe"; an empty list says what to do next with a verb button; Help opens on who to call.

## What exists today (gaps only; read from code Nov 26, not from a device)
- **Gallery and Feed** (`PhotosScreen.tsx`): loading is real ("Loading the photos…"). Empty text exists for both roles, with no button. A failed load only sets `state.notice` (a `Notice` with "OK, hide this message"); `loaded` stays false so the page shows the spinner forever, or the empty text if `loaded` is true. No retry button (pull down only; UI-26 bans a "Check for new photos" button).
- **Timeline** (`TimelineScreen.tsx`): loading real. A failed open sets `loaded: true` plus a dismissible notice, so the page then says "No photos from before then." (wrong: it failed). A failed years load sets `years: []`, so the list says "No photos yet." (wrong). No Try again.
- **Events** (`EventsScreen.tsx`): list is built from the Feed's posts, so a failed feed load shows "No events yet." (wrong). Empty text for a real empty list was fixed since Nov 22: do not redo.
- **Groups** (`GroupsScreen.tsx`): loading real. A failed load does `setCircles([])`, so it looks like "no groups", with a dismissible notice and a filled "New group" button. No empty text. Groups that cannot take an invite show "To invite someone, use their household below." with no button.
- **Help** (`HelpScreen.tsx`): non-owners already get "Need help?" (inviter's name, number if set, "Call {name}") as the first block; the owner has none, so Help opens on the notification picker ("How should we tell you about new photos?", the same `HowToTell` as Me). No state exists for "no one to call".
- **Kit** (`ui/kit.tsx`): has `Loading`, `Notice`, `Card`, `Button`. No `ErrorState`, `EmptyState` or `ScreenHeader`.
- **Already fixed since Nov 22, do not redo:** Share "Add photos" card; Events empty text.

## Scope
Gallery, Feed (same component, same criteria), Timeline, Events list, Groups, Help. Words below are grandparent-ux's house style: plain, no blame, a verb on the button, a person to call. `{helper}` is `app.helper` (the inviter's first name, null for the owner). `messageFor()` in `errors/messages.ts` stays the one source of error words; the screens add the title and button around it.

## Shared pieces (STATES-1..3)
| ID | Type | Criterion |
|---|---|---|
| STATES-1 | auto (jest) | **Given** a list screen's first load fails, **When** it renders, **Then** it shows an error state in place of the list: title, one plain line, and a button named exactly "Try again" (48 pt, label spoken as "Try again"); no spinner and no empty text show. |
| STATES-2 | auto | **Given** the error state is showing, **Then** it has no "OK, hide this message" and no close control; it goes away only when a retry succeeds. **When** "Try again" is tapped, **Then** the screen shows its loading words, and a success replaces the error with the list or the empty state; a second failure shows the error again. |
| STATES-3 | auto | **Given** a refresh fails but posts are already on the phone, **Then** the posts stay on the page and a line sits above them: "No signal right now. Showing the photos saved on this phone." with "Try again"; the line stays until a refresh succeeds. (Today the notice can be hidden.) |

Error words (all screens; the first load only):
- No signal (`NETWORK`): title "No signal right now"; line "Your photos are safe. Check your Wi-Fi or signal, then tap Try again."
- Anything else: title "Something went wrong"; line "Your photos are safe. Tap Try again{, or call {helper}}." (name only when {helper} is set; never a made-up contact).
- "Your photos are safe" is shown only for load failures, never for a failed send (a send keeps its own words in `QueueStatus`).

## Gallery and Feed (STATES-4..8)
| ID | Type | Criterion |
|---|---|---|
| STATES-4 | auto | Gallery, first load fails (no signal): the NETWORK words above and "Try again" show; the greeting and Search field stay. Feed: same, under the "Feed" title. |
| STATES-5 | auto | Gallery or Feed, first load fails with any other error: the "Something went wrong" words show; with {helper} set the line ends "or call {helper}". |
| STATES-6 | auto | Gallery, loaded, no posts, **can post** (parent): title "No photos yet"; line "Share your first photos and your family will see them here."; button "Share photos" that opens the Share tab. |
| STATES-7 | auto | Gallery, loaded, no posts, **viewer** (grandparent): title "No photos yet"; line "When {helper} shares photos, they'll show up here." (no {helper}: "When your family shares photos, they'll show up here."); button "Check again" that runs a refresh. The button exists on this empty page only; UI-26 (no "Check for new photos" on a page that has photos) still holds. |
| STATES-8 | auto | Feed, loaded, nothing to show: same two empty states as STATES-6 and 7 (Feed shows the "Feed" title above it). |

## Timeline (STATES-9..12)
| ID | Type | Criterion |
|---|---|---|
| STATES-9 | auto | Timeline, first open fails: the error state (STATES-1/2) shows, not "No photos from before then." "Try again" re-runs the same open (same start month). The Back button and "Photos by date" title stay. |
| STATES-10 | auto | "Pick a year", years load fails: the error state shows under "Which year?", not "No photos yet." "Try again" reloads the years. |
| STATES-11 | auto | Timeline, loaded, no photos, opened at a month: line "No photos before that month." with button "Show the newest first". |
| STATES-12 | auto | Timeline, loaded, no photos at all: title "No photos yet"; line "Photos show up here by the day they were taken."; button "Go back" (same as Back). |

## Events (STATES-13..14)
| ID | Type | Criterion |
|---|---|---|
| STATES-13 | auto | Events list while the Feed's first load failed: the error state shows, never "No events yet." "Try again" refreshes the Feed. |
| STATES-14 | auto | Events list, loaded, none: the existing text is unchanged (do not redo). A test pins it so the error fix cannot break it. |

## Groups (STATES-15..19)
| ID | Type | Criterion |
|---|---|---|
| STATES-15 | auto | Groups, `myCircles` fails: the error state shows (no signal: "No signal right now. Check your Wi-Fi or signal, then tap Try again."; groups are not photos, so no "photos are safe" line here), "Try again" reloads, and the "New group" button and the list are hidden until it succeeds. `circles` is no longer set to `[]` on failure. |
| STATES-16 | auto | Groups, loaded, no groups: title "No groups yet"; line "A group is the people who get a photo, like Grandparents or Cousins. Make one to choose who sees your photos."; button "Make a group" (opens the New group form). |
| STATES-17 | auto | Groups, **"New group" is no longer a filled button** (not on DS-9's list): it becomes a `tinted` capsule reading "New group", 48 pt. "Make a group" in STATES-16 is the same button, not a second one. |
| STATES-18 | auto | A group that cannot take an invite shows a button "Invite someone" in place of the "To invite someone, use their household below." text; tapping it opens the invite form for the family's household (or the first group that can take one) with the title "Invite someone to {that group}". If none can, the line reads "To invite someone, first make a group, then tap Invite someone under it." and "Make a group" shows. |
| STATES-19 | auto | At the top of Groups, under "Your groups", one muted line says how: "To invite someone, tap Invite someone under a group." (shown whenever at least one group exists). |

## Help (STATES-20..22)
| ID | Type | Criterion |
|---|---|---|
| STATES-20 | auto | Help's first block is a "Who to call" section, above "How should we tell you about new photos?". Viewer or adult with {helper}: "{helper} can help." with "Call {helper}" when a number is set (unchanged behavior, moved and retitled); without a number: "Ask {helper} for help." With no {helper}: "Ask the person who invited you for help." The number comes from `deps.helpPhone` only; nothing is typed in by the code. |
| STATES-21 | auto | Owner: Help's first block is titled "If something isn't working" and says "Check your Wi-Fi or signal and tap Try again. Photos you sent are saved on your phone until they go through." The "Email Hearth" block (START-ON-1) moves up to sit directly under it, and only when a help email is set. With no help email there is no contact line and no dead row. |
| STATES-22 | auto | Help's offline words: **Given** no signal, **When** Help opens, **Then** the page still renders from what the phone has (name, number, steps) and shows no error state. Help makes no network call to draw "Who to call". |
| STATES-23 | auto | Help's number (Chase's default, Nov 26): the name always shows; "Call {helper}" and the number show only when `deps.helpPhone` is set **and** marked as the inviter's. Not marked: the page reads "Ask {helper} for help." and shows no number and no Call button. |
| STATES-24 | auto | Empty viewer Gallery, "Check again" tapped: the page shows "Checking…" at once (a refresh with no change must not look like nothing happened); if still empty, the line becomes "Still nothing yet. We'll show photos here as soon as they're shared." and the button stays; if a check fails, the NETWORK error state shows. |

## Manual (real phone)
- **STATES-M1 (manual):** iPhone with Wi-Fi and data off, open Gallery, Feed, Timeline (More or Gallery's By date), Events and Groups: each shows its error words and "Try again"; turn Wi-Fi on, tap Try again, the list appears. Check Easy view On and Off.
- **STATES-M2 (manual):** same on an Android phone (Pawpaw's shape), 360 dp wide: nothing clips, "Try again" is 48 dp.
- **STATES-M3 (manual):** a brand-new viewer account (no photos): the empty Gallery reads kindly and "Check again" works once a photo is shared.
- **STATES-M4 (manual, grandparent test):** hand a non-technical grandparent the phone in airplane mode and say "show me your photos"; pass is she says what to do next or taps Try again without help, under 60 s (GOALS "never empty, never silent").
- **STATES-M5 (manual):** Help on a viewer's phone: she can read the name and tap Call in one step from the top of the page.

## Build notes (engineer's freedom inside the criteria)
- Stores: `FeedStore` and `TimelineStore` expose a `failed` flag (or `error` code) apart from `notice`, set on a failed first load and cleared on success, so the screens can tell "empty" from "failed". Keep `messageFor` as the only words source. Never log the error text, URLs or captions (rule 2).
- Add `ErrorState` and `EmptyState` to `app/src/ui/kit.tsx` only as small helpers for these screens (title, line, one button). They belong to the component library (intake #192); say so in a comment and in the PR body, and the library hand-over moves them. `ScreenHeader` is not needed here: do not build it.
- Tests: each list screen gets one test for its error and one for its empty state, titled with the STATES-n ID (rule 1). Contract tests are untouched: no API change, no migration, no storage change (rule 6 does not apply).

## Not doing (out of scope)
- Redo of the Share "Add photos" card or the Events empty text (fixed Nov 22).
- A new component library, `ScreenHeader`, or restyling other screens (intake #192).
- Error states on Messages, Birthdays, Search or Me (not named in the intake; one line each in Parked).
- Offline mode, queued reads, or a background retry loop. Try again is a button, not a timer.
- Any new help channel, chat, or a Hearth phone number. No contact is invented anywhere.
- Changing the send-failure words in `QueueStatus` (separate, already specced).

## Success and stop
- Signal: STATES-1..22 green 3x; STATES-M4 passes for 4 of 5 testers with no help; help calls about "a blank screen" drop to 0 in the beta.
- Stop: if the engineer needs a store rewrite beyond a `failed` flag, stop and send it back to staff-pm; this is a 1 to 2 session job.

## Decisions for Chase
1. **Help email (open since "Decide later").** The owner has no one to call, and Hearth's own address hides until set (START-ON-1). Recommend: set it before the beta (one step; it is also the blocker for "start a family"). Until then STATES-21 shows no contact, and nothing is invented.
2. **The number on Help is one build-wide setting** (`EXPO_PUBLIC_HELP_PHONE`), shown as "{helper} ... Their number is ..." for every viewer. If it is not the inviter's, the sentence is wrong. Recommend: keep the name always, show the number only when Chase says it is the inviter's (he is the inviter for all 12 beta grandparents); STATES-20 holds either way.
3. **"Check again" on the empty viewer Gallery** (STATES-7) is the one exception to UI-26. Recommend: yes, on the empty page only, because "nothing here yet" with no button is the anxious moment.

## Parked (ideas log, not built now)
- Same error and empty states for Messages, Birthdays, Search results and Me.
- A small "Last updated" time under the Gallery greeting, so she can see the page is current.
- Retry after the phone regains signal by itself (a quiet auto-refresh), tied to the offline/queue thread.
- A "Call {helper}" button inside the error state when a number is set.

## Handoffs
- grandparent-ux: confirm every word above and write the persona check `decisions/2026-11-26-states.md`; done when each persona has a Green/Red row.
- qa-tdd: failing tests STATES-1..22 (auto), titled by ID; done when red for the right reason.
- engineer: build after red, inside "Build notes"; done when green 3x.
- ux-reviewer: shots at 390 px of every state, Easy view On and Off; done when no P0/P1.

## Grandparent-ux word review (Nov 26, voice of the least savvy relative)
- GUX-ST-R1 (P1): "Check again" gave no sign it worked when nothing had changed. Added STATES-24 ("Checking…", then "Still nothing yet...").
- GUX-ST-R2 (P1): Chase's default on the Help number (name always, number only when confirmed as the inviter's) was not a criterion, so a wrong number could show. Added STATES-23.
- GUX-ST-R3 (P2): "No photos before then." leaves "then" unclear. Now "No photos before that month." (STATES-11).
- GUX-ST-R4 (P2): "Something went wrong" says little; kept because messageFor is the one words source, but confirm with a relative in STATES-M4 that the next line ("Your photos are safe. Tap Try again") is what she acts on.
