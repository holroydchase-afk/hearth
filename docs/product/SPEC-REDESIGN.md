# Redesign: clean, Apple-first, black and white with one accent (RD-*)

Owner: staff-pm. Decision: DEC-59, persona check `decisions/2026-11-15-redesign.md`. Mockups: look B in the Nov 14 redesign page (three looks, four New for you options, six accents, the rules table).

Chase, Nov 14: "This needs to look like a clean modern app. Follow Apple to the T, black and white and an accent." "I don't want all of the buttons at the top.. it should be large 'good morning or whatever gammy' then you scroll down and it goes up to the left side. I only want like search or search and maybe 1 more in the upper right." "Gallery (timelines) to be starting screen but with a good morning or hello first then it rolls into the gallery, then like share in the middle, feed, more (a menu that takes over the screen and makes it easy to navigate)." Picked look B; upper right is Search and By date.
Nov 15: "I don't want giant buttons anywhere except when it's intentional like a big delete. It looks dated." "Go with the 4 new chip on the pic." "Make the color a variable that can be set in the admin." Tailwind: no; native components and the `theme.ts` tokens.
Then: "Go Claude go".

## What stays (not up for change)
17 pt minimum text (DS-2), 48 pt targets (DS-1), a word under or beside every icon and tab (DS-3), tab labels never hide (DS-5), solid backing behind text (DS-6), a button for every gesture (DS-4), Increase Contrast and Reduce Motion (DS-14), members never see group names (DEC-49), every privacy rule in CLAUDE.md. The one-at-a-time walk (OPEN-5, -7, -8) and "last visit" on the phone only (OPEN-5) stay as built.

## Where things go
| Today | After |
|---|---|
| Tabs Photos, Share, Groups, Me (parents); Photos, Help (viewers) | Parents: **Gallery, Share, Feed, More** (Share in the middle). Viewers: **Gallery, Feed, More** (no Share, as today) |
| Photos tab, posts newest first | **Feed** tab, same list |
| All photos wall (OPEN-9) | **Gallery** is the wall, and the start screen |
| Toolbar: Messages, By date, Events, All photos, Search | Header right: **Search** and **By date** only. Messages and Events move to More |
| Groups tab | More → Groups (owner and adult only) |
| Me tab, Help tab | More → Me, More → Help (same content) |
| Bigger text, Light or dark, Colors on Help or Me | More → Bigger text, Light or dark. Colors becomes **Family color**, owner only |

## Phase 1: app only, visible in the demo, no backend change
Split into three PRs, in order, one at a time (small PRs, no bursts). Each is shippable alone.

### 1a. The look (theme, font, icons, accent, buttons)
| ID | Given / When / Then | Type |
|---|---|---|
| RD-1 | Given light mode, then the screen is white `#FFFFFF` and text is near-black; in dark mode the screen is true black `#000000` and text is near-white. No warm off-white or charcoal remains in `paletteFor`. Superseded Nov 18 by RD-84/85 (warm paper, DEC-67). | auto |
| RD-2 | Given any screen, then text uses the phone's font (SF Pro on iPhone, Roboto on Android, the system stack on the web) in Regular or Semibold only; Bold appears only in the large title. Atkinson is no longer loaded. | auto |
| RD-3 | `theme.ts` has one `accent` token per palette (light and dark), resolved from one setting; no component hard-codes an accent hex. Default is Ember: light `#B23A1E`, dark `#FF8A65`. | auto |
| RD-4 | The accent appears only on: the main tap word or chip on a screen (e.g. "4 new"), the picked tab, the new-message dot, links in text, and switches On. Search, By date and row titles are ink, not accent. | auto (lint of `c.accent` uses) + manual |
| RD-5 | Every accent choice passes 4.5:1 against the screen in light and dark, and Increase Contrast still gives its high-contrast set. | auto |
| RD-6 | Icons are outline SF Symbols on iPhone (regular weight) and Material Symbols Outlined on Android; the picked tab changes color, not fill. | auto |
| RD-7 | No large filled button anywhere except: Delete and Leave confirms, sign-in and Start a family (first-run setup), and Post on Share. Everything else is a tappable row, a photo, a text button or a small tinted capsule, each still 48 pt tall to tap. The walk's Next and Previous become capsules (positions unchanged). The "Yes, sign out" confirm also stays filled: it is a deliberate confirm (signing back in needs a new code). | auto (kit audit) + manual |
| RD-8 | Corners: 12 for rows and New for you photos, 14 dialogs (28 dp Android), square in the Gallery grid. No card inside a card. | auto |

### 1b. Getting around (tabs, header, greeting, More)
| ID | Given / When / Then | Type |
|---|---|---|
| RD-9 | Given a parent, then the tabs read Gallery, Share, Feed, More, in that order, each with an icon and its word. Given a viewer, then Gallery, Feed, More. | auto |
| RD-10 | Given the app opens, then Gallery is the picked tab. | auto |
| RD-11 | Given Gallery at rest, then a large title reads "Good morning, <name>" (before 12:00), "Good afternoon" (12:00–16:59) or "Good evening" (17:00 on), using the name the family gave this person. No name: "Good morning" alone. | auto |
| RD-12 | When Gallery scrolls, the greeting shrinks into the top bar on the left, on a solid background (DS-6); scrolling back up restores it. On iPhone this is the system large title; Android the Material large top bar; web the same look. With Reduce Motion it fades. | auto (web) + manual (iPhone, Android) |
| RD-13 | The top bar's right side holds exactly two items: Search and By date, each a thin icon with its word. Search opens today's Search (SEARCH-*); By date opens today's By date. | auto |
| RD-14 | Given a new message, then More's tab shows an accent dot (spoken "More, new message"), and the Messages row in More says "N new". No dot otherwise. | auto |
| RD-15 | Tapping More fills the screen with big rows (icon, word, chevron, 48 pt+), in this order: Messages, Groups (owner and adult only), Events, Bigger text, Light or dark, Family color (owner only), Me, Help. Each opens today's screen with a Back word button. | auto |
| RD-16 | A viewer's More never shows Groups or Family color, and no screen reached from More shows a group's name to anyone who isn't owner or adult (DEC-49). | auto |
| RD-17 | Feed shows today's posts list (newest first, posts' reactions, who can see it by name, replies); nothing on it is lost. | auto |

### 1c. Gallery and New for you
| ID | Given / When / Then | Type |
|---|---|---|
| RD-18 | Given posts, Gallery shows every photo by month ("November 2026") in a tight square grid, newest first, with Show older photos; every tile is 48 pt+ and its spoken label names the sender and day (OPEN-10 kept). The grid orders by the date the photo was taken when the phone knew it, otherwise the date it was shared, like Apple Photos (QA-R2, Nov 15), so old photos added today sit in their own months. | auto |
| RD-19 | Given new posts from others since the last visit (OPEN-1, OPEN-5), then above the grid sits "New for you" with a sideways row of large photo tiles; the first tile carries a solid accent chip "N new" (N = new photos, not posts). | auto |
| RD-20 | Under "New for you" only the sender line ("From Alex since Wednesday", OPEN-2's day rules); See all and the tappable tiles are the way in (DS-4). No "Tap a photo to start" line (Chase, Nov 16: "that is messy", DEC-61). | auto |
| RD-21 | Tapping any New for you tile opens the one-at-a-time walk at the oldest new post (OPEN-7, OPEN-8 unchanged); Done returns to Gallery. The row also has a "See all" text button that opens the same walk (no swipe needed to reach it, DS-4). | auto |
| RD-22 | Nothing new: no New for you section; Gallery opens on the greeting and the grid. First ever open: no section. | auto |
| RD-23 | No group name appears on Gallery, New for you or the walk. | auto |

### 1 (any PR). Family color, phase 1 storage
| ID | Given / When / Then | Type |
|---|---|---|
| RD-24 | Given the family's owner, More → Family color shows Ember (default), Forest (`#2E7D4F` / `#6FCF97`) and Plum (`#8E3A8F` / `#D9A0E0`), each a row with a swatch, its name and a check on the picked one. | auto |
| RD-25 | Phase 1 storage: the owner's pick is saved in today's per-device prefs (`prefs.color`) and recolors only that phone. Everyone else sees Ember; any saved Sage or Plum from COLOR-1 is ignored (Sage maps to Forest on the owner's phone). | auto |
| RD-26 | Given an adult or viewer, there is no color picker anywhere. | auto |
| RD-27 | Demo: Chase (owner; was Kai until DEC-64) can switch Family color and the demo recolors; Grandma Jo's view stays Ember. | auto (Playwright) |

### 1d. Plain background (Chase, Nov 16: "why is everything grey?"; Apple HIG Color)
| ID | Given / When / Then | Type |
|---|---|---|
| RD-34 | Content screens (Gallery, Feed, post cards, New for you, Share, walk, top bar, tab bar) sit on the plain background (warm paper `#F1E9D2` light / `#14100D` dark since RD-87, DEC-67; was white / black), with no grey card fill; posts are separated by hairline dividers (c.line) and spacing. Grey (grouped background) only on Settings-style lists under More (Bigger text, Light or dark, Family color, Help, Me), on text input fields (the reply field, Share's caption), and on reaction/tinted capsules. | auto (`app/src/screens/__tests__/plainBackground.test.tsx`) |

The demo's numbered Try-this steps on Gallery and Feed (FIRSTMIN-3, PR #113) are gone too (Chase, Nov 16, DEC-61); the demo bar's Details menu keeps "See it as Grandma Jo".

### 1e. Review round 1 of the live demo (ux-reviewer, Chase's iPhone screenshots, Nov 17)
Tests: `app/src/screens/__tests__/reviewRound1.test.tsx` and `app/e2e-web/demo.spec.js` (UX-R*). UX-R3 (walk without the tab bar), UX-R4 (search field and Months | All photos) and UX-R11 (tab turned Plum) wait on Chase.
| ID | Given / When / Then | Type |
|---|---|---|
| RD-35 | UX-R1 (P0): while any text field is focused (comment field, Share's caption) the tab bar is hidden and the field sits fully above the keyboard, uncovered; the tab bar returns when typing ends. | auto (jest + Playwright) + manual M-19 |
| RD-36 | UX-R2: in the New for you walk, Previous (left; shown but off on the first) and "Next photo" (right; "Done" on the last) sit together in one bar pinned at the bottom, outside the scroll, with a hairline on top. | auto |
| RD-37 | UX-R5 (Chase, Nov 17, DEC-63): no comment emoji. The reaction row is ❤️ 😂 👍 🎉 only, emoji with no words (REACT-7 stands). Every post, even with no comments, shows a "Comments" heading, an "Add a comment…" field and a Post button. | auto |
| RD-38 | UX-R6: the comment field's label is the visible "Comments" heading and its spoken name is "Add a comment for <sender>" ("Add a comment" on your own post). Post is a text button: grey and off while the field is empty, accent and on once there's text. | auto |
| RD-39 | UX-R7: Gallery's grid is square tiles, three across, edge to edge (no side margins). | auto (Playwright) |
| RD-40 | UX-R8 (P2): in the walk, the heading, avatar row, title, caption and reaction row share one 16 pt left edge. | auto |
| RD-41 | UX-R9 (P2): in the walk the accent appears only on "Next photo"; "‹ Gallery" and "Options" are ink (RD-4). | auto |
| RD-42 | UX-R10 (P2): when the people who will read my comment are exactly the people who can see the post, the line under the field reads "Your comment goes to the same people."; when fewer read it (the safe default), it still names them. | auto |
| RD-43 | UX-R12 (Chase, Nov 17, DEC-64): the demo's parent is "Chase", so the greeting reads "Good morning/afternoon/evening, Chase"; "Kai" is gone from the demo. Kids stay Mia and Leo; Alex and Grandma Jo stay. | auto (jest + Playwright) |

### 1f. Apple Photos months, a search field, Instagram-style posts (Chase's picks, Nov 17, DEC-65)
Mockup: the Nov 17 "Gallery and Feed, the Apple Photos way" page, sections 1 to 3 (round 2). Persona check `decisions/2026-11-17-photos-style.md`. Tests (written first, red): `app/src/screens/__tests__/photosStyle.test.tsx`, `app/src/ui/__tests__/relativeTime.test.ts`, `app/e2e-web/demo.spec.js` (RD-44, RD-47). Supersedes: RD-2's Bold large title, RD-8's square Gallery corners, RD-13 (Search and By date top right), RD-34's hairline dividers between posts, RD-39 (edge to edge), GUX-R3's "Options" word, REACT-11's separate count chips.
| ID | Given / When / Then | Type |
|---|---|---|
| RD-44 | Gallery is a months mosaic like the newest Apple Photos: the month's name ("November 2026", Semibold), then that month's photos grouped by day (or a day range, RD-56). Each MONTH's first tile is wide (3:2, full width; the month's most-loved photo, else the newest; UX-R13 replaced one wide tile per day), then squares 3 across, newest first; a short last row widens to fill, never one square alone. Every tile has 16 pt corners and 8 pt gaps, inside the 16 pt side margins (not edge to edge). Tiles stay 48 pt+ buttons that open that photo. | auto (jest + Playwright 360 px) |
| RD-45 | The day number ("4", "17") sits at the top left of each group's first tile, 20 pt Semibold white over a soft dark fade (the one DS-6 exception: decoration). The tile's spoken label carries the full date ("November 16"). | auto |
| RD-46 | No sender lines on the months ("From Grandma Jo…" never shows over or under the grid). New for you stays above the months when there's something new (RD-19..22 unchanged). | auto |
| RD-47 | Search is a "Search photos" field under the greeting, above New for you and the months; tapping it opens today's Search (SEARCH-*). When Gallery scrolls, it pins under the bar. The top-right Search and By date buttons are gone. The Months / All photos switch is hidden for now (Chase): Gallery shows months only. The timeline (BETA-TIME-2) stays, reached from Feed's Older photos card; its Back reads "Back to Feed". | auto (jest + Playwright) |
| RD-48 | Feed post order, top to bottom: the sender's round face and name at left, a small "⋯" at far right; the photos; the reaction row; the description (the name in Medium, then the words: "Alex First snow!"); the relative time; the quiet "who can see this" line (DEC-60); then comments, "Add a comment…" and Post (DEC-63). | auto |
| RD-49 | The face is the person's round profile photo, 36 pt; initials only until they add one. | auto (initials) + blocked (profile photos need a schema and storage call, architect) |
| RD-50 | The "⋯" is icon only, spoken "Post options", 48 pt target; the "Options" word is gone. It opens the post's menu: "Who can see this" (heading and names, as today) for everyone; Edit description and Delete post (asks first) only on your own posts. | auto |
| RD-51 | The time reads "Just now" (under a minute, or a clock ahead), "5 minutes ago", "3 hours ago" (under a day), "Yesterday", "2 days ago" up to "6 days ago", then "Nov 3", and "Nov 3, 2025" for another year. "· Edited" still follows when the words changed (CAP-6). | auto |
| RD-52 | No divider lines between posts or inside a post: 32 pt of space between posts (A-1). | auto |
| RD-53 | Reactions (B3): ❤️ 😂 👍 🎉 always in one row, each with its count beside it inside its own button; a zero shows no number. Your pick is highlighted; one tap reacts, the same tap takes it back (REACT-8). Emoji only, no words (REACT-7); each keeps its spoken name ("Love it") and reads its count as the value. No separate count chips. | auto |
| RD-54 | More than one photo (C1): a rounded mosaic of at most 4 tiles (1 large, then up to 3 small), inset 16 pt with 16 pt corners like Gallery; with more than 4 photos the 4th tile shows "+N" on a solid chip (not a dark wash over the photo). Tapping any tile opens that photo. | auto |
| RD-55 | Lighter type: no Bold anywhere, the large title included (greeting 34 pt Semibold, month 24 pt Semibold); names 17 pt Medium; everything else Regular. Outline icons only (RD-6). | auto (kit + source lint) |

Review round 2 (ux-reviewer, Nov 17). Tests (written first, red): `app/src/screens/__tests__/reviewRound2.test.tsx`, `app/src/feed/__tests__/gallery.test.ts` (UX-R13), `app/e2e-web/demo.spec.js` (RD-44/UX-R13, R18, R23). Supersedes: RD-45's day number on every day's wide tile, UX-R6's "Comments" heading, LOOK-1/WHO-8's "Sent to" line on the card (the sender finds the group's name in Post options, DEC-49 kept).

| ID | Given / When / Then | Type |
|---|---|---|
| RD-56 | UX-R13 (P1): one wide 3:2 photo per month, then squares 3 across. Days with fewer than 3 photos join the next older days into one group until it holds 3, shown as a range ("Nov 11–15"); a range never crosses a month. Each group's date shows once ("Oct 17"). No square sits alone in a row (rows of 2 or 3 that fill the width, no empty fillers). | auto (jest unit + screen, Playwright 360/390) |
| RD-57 | UX-R14 (P1): Post options are plain iOS-style rows (no filled capsule, words not centered, 48 pt+). "Delete post" is red text on a normal row, never a solid red pill; it still asks first ("No, keep it" keeps the post). | auto |
| RD-58 | UX-R15 (P1): on your own post, who can see it is said once (the names line). No "Sent to" line and no "can read this" line under the comment field on your own post; the group's name stays in Post options (DEC-49). Others' posts unchanged. | auto |
| RD-59 | UX-R16 (P1): no "Comments" heading. One rounded "Add a comment…" field, 48 pt+ tall (rule 3), no second box around the text, with Post inside it at the right end; Post is hidden or off until there are words. | auto |
| RD-60 | R17 (P2): More's rows all use outline symbols (no `.fill`/`filled`); separators are inset from the left (start after the icon, iOS style), never full width. | auto |
| RD-61 | R18 (P2): while Gallery scrolls, the current month's title sticks right under the pinned "Search photos" field. | auto (jest + Playwright) |
| RD-62 | R19 (P2): Share has one 16 pt left edge: the title, Pick photos, the boxes' labels, "Who can see it" and the group rows. | auto |
| RD-63 | R20 (P2): a photo still loading in a small square (Gallery squares, Feed mosaic's small tiles) shows "Loading…" or a spinner with a spoken "Loading" label, never the long "Loading the photo…" that clips. | auto |
| RD-64 | R21 (P2): the reaction row's first emoji starts at the 16 pt content edge, like the name, photos and words. | auto |
| RD-65 | R22 (P2): names (post head, description, comments) are body size and grow with Bigger text (21 pt on, 17 pt off). | auto |
| RD-66 | R23 (P2, G9): each tab (Gallery, Share, Feed, More) has exactly one h1, its title; month titles and other headings are level 2. | auto (Playwright) |

Review round 3 (ux-reviewer, Nov 17). Tests (written first, red): `app/src/screens/__tests__/reviewRound3.test.tsx`, `app/src/feed/__tests__/gallery.test.ts` (UX-R30), `app/e2e-web/demo.spec.js` (UX-R27 at 390 px), `app/e2e-web/core-loop.spec.js` (the new Delete words). Supersedes: RD-57's "No, keep it" words, GUX-R6's "up to three others all named", CAP-3's title heading, RD-56's lone square in a 2-photo month.

| ID | Given / When / Then | Type |
|---|---|---|
| RD-67 | UX-R24 (P1): Delete post asks in an iOS-style alert over the screen (a Modal, never inline in the feed): title "Delete this post?" (one photo or many), "Keep it" (Semibold, the default) and "Delete" (Regular, red text); neither is a filled button. Keep it keeps the post; Delete deletes it. | auto |
| RD-68 | UX-R25 (P2): the sticky month title box is the page color with 12 pt of padding under the words, so photos sliding under it never touch them. | auto |
| RD-69 | UX-R26 (P2): "Your comment goes to the same people." shows only while the comment field is focused or holds words. When fewer people read the comment, that line ("Alex and Chase will read this.") still shows at rest. | auto |
| RD-70 | UX-R27 (P2): the who-can-see line names at most 2 others, then "and N more" ("Alex, Chase and 1 more can see this."), and fits one line at default size on a 390 pt screen. The Who sheet still lists everyone; the spoken label keeps the full list. | auto (jest + Playwright 390) |
| RD-71 | UX-R28 (P2): a post's title is never a heading above the words; the description starts with the title in Medium, after the name row, then the caption. | auto |
| RD-72 | UX-R29 (P2): "Delete post" and the alert's "Delete" are #FF453A (iOS systemRed, dark) in dark mode; in light, #D70015 or the palette red, at 4.5:1 or better on the sheet. | auto |
| RD-73 | UX-R30 (P2): a month or group with exactly 2 photos shows two squares side by side: no wide photo and no lone square. One photo alone in a month stays wide. | auto (jest unit) |

### 1g. Easy view (Chase, Nov 17, DEC-66)
Chase: words under the tab icons are off by default, behind one setting, "Easy view", that bundles the grandparent comforts; on for invited grandparents (viewer), off for parents (owner, adult). Easy view replaces Bigger text. Tests (written first, red): `app/src/state/__tests__/easyView.test.ts`, `app/src/screens/__tests__/easyView.test.tsx`, `app/e2e-web/demo.spec.js` (RD-80). Supersedes: RD-9's "each with an icon and its word" (now only with Easy view on), RD-15's "Bigger text" row, DS-5 for Easy view off, RD-65's and RD-29's "Bigger text" wording.
| ID | Given / When / Then | Type |
|---|---|---|
| RD-74 | Given no saved choices on this phone, when a viewer signs in, then Easy view is On; when an owner or adult signs in, then it is Off. `Prefs.easyView` replaces `Prefs.bigText`; nothing reads `bigText` after loading. | auto (jest unit) |
| RD-75 | Given saved choices from before (`hearth.prefs.v1.<user>` with `bigText` and no `easyView`), when they load, then Easy view equals the saved `bigText` (true or false), for any role. When choices are next saved, they hold `easyView` and no `bigText`. Unreadable or missing values fall back to RD-74's role default. | auto (jest unit) |
| RD-76 | Given Easy view Off, then the tab bar shows icons only, no visible words. Each tab keeps its spoken name ("Gallery", "Share", "Feed", "More"; "More, new message" with the dot, RD-14), the tab role and the selected state; each target is 48 pt+ (DS-1). Text uses the default sizes (names 17 pt, RD-65). | auto |
| RD-77 | Given Easy view On, then every tab shows its icon with its word under it, 17 pt+ (DS-2), never hidden or shown only when picked (DS-5); text uses today's Bigger text sizes (names 21 pt, RD-65). At the largest text the words don't clip and the tab bar never covers content (LIVE-1 class). | auto (jest + Playwright 360) |
| RD-78 | More's "Bigger text" row becomes "Easy view", in the same place in RD-15's order, showing "On" or "Off" in words at its right end (spoken "Easy view, On"). Tapping it opens a page titled "Easy view" with one line, "Bigger words, and a word under each button at the bottom of the screen.", and two rows, "On" and "Off", with a check on the current one (like Light or dark), 48 pt+. Picking one changes the tabs and text at once, no restart, and saves it for this person on this phone. The Back word returns to More. Me shows the same Easy view block (title, line, On and Off). | auto |
| RD-79 | Easy view changes only the tab words and the text size. Every other button keeps its word or spoken name as today (DS-3; RD-50's "⋯" stays as it is), and no action is gesture-only, On or Off. | auto |
| RD-80 | In the public demo, as Chase, Easy view is Off (icon-only tabs). "See it as Grandma Jo" shows words under the tabs and bigger text; switching back to Chase restores Off. Each person's pick is kept separately in the browser. | auto (jest + Playwright) |
| RD-81 | On Chase's iPhone (Expo Go) and one Android: Easy view On at the largest text, the viewer's three tab words fit with no clipping; Easy view Off, VoiceOver and TalkBack read each tab's name. | manual |
| RD-82 | Chase on iPhone (Nov 17): while Gallery scrolls, the pinned "Search photos" bar's backing spans the full screen width in the page color (`c.bg`, no gray); the field keeps its 16 pt gutters inside it, so nothing (New for you's sideways photos) shows past its right edge. Once content is under the bar a soft hairline shade shows below it (`search-bar-shade`); none at the top. Test: `app/src/screens/__tests__/searchBacking.test.tsx`. | auto |
| RD-83 | Chase on iPhone (Nov 17): scrolling Gallery back down, the sticky month title came apart from the pinned search bar and a strip of photo showed between them. The greeting, search bar and current month title behave as one pinned block: the month title's top sits exactly on the search backing's bottom (sticky offset = the backing's measured height; no gap, no overlap, ±0.5 px), its backing spans the full screen width in `c.bg`, and RD-82's shade sits under the whole block (below the month title when one is pinned). Tests: `app/src/screens/__tests__/pinnedBlock.test.tsx`, `app/e2e-web/demo.spec.js` RD-83 (393 px, down then back up); the frame-by-frame look on a real iPhone stays manual. | auto + manual (iPhone) |

### 1h. Warm paper, photo shadows, reaction pop (Chase, Nov 18, DEC-67)
Chase, Nov 18: "use the warm paper, the photo shadows, pop reactions." Mockup: the Nov 18 look page, section 1, option A (warm paper) and option C's photo shadows and reaction pop. He then tried paper `#F1E9D2` in a tester; that is the page color. Nov 18: "Leave out the Tuesday Nov 17 above the greeting." Not picked: option B (family moments), C's accent band and Ember month titles (RD-4 stands: accent means "tap here"), A's date line. Persona check `decisions/2026-11-18-warm-paper.md`. Tests (written first, red): `app/src/ui/__tests__/warmPaper.test.ts`, `app/src/screens/__tests__/warmPaper.test.tsx`, `app/e2e-web/demo.spec.js` (RD-92). Supersedes: RD-1 (white `#FFFFFF`, true black, "no warm off-white"), RD-34's "white light / black dark", DS-11's "white and true black screens".
| ID | Given / When / Then | Type |
|---|---|---|
| RD-84 | Given light mode, then `paletteFor` gives page `bg` `#F1E9D2` (paper), `fill` 4.5% darker (`#E6DFC9`, ±1 per channel), `line` 9% darker (`#DBD4BF`, ±1), warm near-black `ink` (`#1F1A14` or similar, R ≥ G ≥ B) and warm `muted` (`#5E554A` or similar, R ≥ G ≥ B). No cool gray from before remains in the light palette (`#FFFFFF` as bg, `#F7F7F9`, `#F2F2F7`, `#D1D1D6`, `#EFEFF4`, `#1C1C1E`, `#5F5F64`); `surface` and `photo` are paper-family too. Values mirrored in `docs/design/tokens.json`. | auto (jest unit) |
| RD-85 | Given dark mode, then `bg` is warm near-black `#14100D`, `ink` warm near-white (`#F3EDE4` or similar), `muted` warm gray (`#B3AA9F` or similar), and `fill`, `line`, `surface`, `photo` warm dark grays (R ≥ G ≥ B; e.g. fill `#2A241F`, line `#3A322B`). No `#000000` page and no cool gray (`#1C1C1E`, `#2C2C2E`, `#38383A`, `#AEAEB2`, `#F5F5F7`) remains. | auto (jest unit) |
| RD-86 | Contrast (WCAG AA) in light and dark: `ink` and `muted` ≥ 4.5:1 on `bg`, `fill` and `surface` (ink ≥ 7:1 on `bg`); every accent (Ember, Forest, Plum) ≥ 4.5:1 on `bg`, `fill` and its `accentSoft`; `danger` and `safe` ≥ 4.5:1 on `bg`. An accent that misses on paper is darkened in light mode until it passes (Forest `#2E7D4F` is 4.2:1 on paper, e.g. `#276B43`; Ember `#B23A1E` is 4.9 on paper but 4.5 on fill, e.g. `#AD371D`). `accentSoft` mixes the accent with the page color, not white or black. Increase Contrast still gives its high-contrast set (DS-14) on paper. | auto (jest unit, every accent x light/dark x normal/high) |
| RD-87 | Every page backing uses `c.bg` (paper): Gallery, Feed, New for you, Share, the walk, More and its pages, sign-in, the top bar, the pinned search and month block (RD-82, RD-83), the tab bar, and the web demo's page around the app. RD-34's rule still holds: no gray card fill on content; text fields (Search photos, the comment field, Share's caption) and capsules use `c.fill`. No screen or kit file hard-codes `#FFFFFF`, `#000000` or `white`/`black` as a background (photo viewer's black stays: it shows a photo, not a page). | auto (`plainBackground.test.tsx` updated + lint) |
| RD-88 | Given light mode, then Gallery tiles, New for you tiles and Feed post photos have one soft shadow: warm ink color, opacity ≤ 0.12, offset y 1 to 2, radius 4 to 8 (Android `elevation` ≤ 2), drawn on a wrapper so the rounded corners still clip the photo and the shadow isn't cut off. Given dark mode, then no shadow; a 1 px `c.line` hairline is allowed. Nothing else (rows, capsules, fields, the tab bar) gets a shadow; RD-82's search-bar-shade stays as it is (a scroll edge, not a decoration; Chase's call via the chief of staff, Nov 18). Layout is unchanged: tile sizes, gaps and positions are the same with and without it (±0.5 px). | auto (jest style check) + manual |
| RD-89 | Given a reaction emoji (❤️ 😂 👍 🎉) on a Feed post, when it is tapped to turn on, then the emoji scales 1 → 1.25 → 1 in ≤ 250 ms total, by `transform` only: the count, the other emoji and the post don't move (positions ±0.5 px before, during and after). The count's width is kept even at 0, so the first reaction's "1" doesn't widen the button (Nov 18 call). Tapping to turn it off changes state with no pop. The reaction is saved on the first tap whether or not the animation finishes; a second tap during the pop doesn't double-count. Uses the native driver on phones. | auto (jest) |
| RD-90 | Given Reduce Motion on (phone setting, `PhoneA11yContext.reduceMotion`), when a reaction is tapped on, then no scale: the emoji's picked state fades in (opacity, ≤ 200 ms) or appears at once. Same rule on the web via `prefers-reduced-motion`. | auto (jest + Playwright with reduced motion) |
| RD-91 | Given any screen, then no date line ("Tuesday, Nov 17" or any weekday or date) appears above or beside the greeting; the greeting is still the first text on Gallery (RD-10). | auto (jest + Playwright) |
| RD-92 | In the public demo (light, 393 px): the page behind the app and Gallery's backing compute to `rgb(241, 233, 210)`; a Gallery tile and a Feed photo have a non-`none` box shadow; tapping ❤️ on a post shows a scale above 1 within 250 ms and the heart's box doesn't shift its neighbours; with reduced motion emulated, no scale. In dark, the page is `rgb(20, 16, 13)` and tiles have no box shadow. Screenshots light and dark saved for the review. | auto (Playwright) |
| RD-93 | On Chase's iPhone (Expo Go) and one Android, light and dark, outdoors or in a bright room: paper reads warm, not dirty or yellow; shadows look soft, not muddy, and don't flicker while scrolling; the pop feels quick and stops with Reduce Motion on; every word is still easy to read. | manual |

RD-89 / GUX-R15 (staff-pm, Nov 18, keeping Chase's Nov 5 "not a heavy outlined pill", LIVE-3): the picked reaction gets no outline; instead its capsule is an opaque tint with ≥ 3:1 against `c.bg` (light and dark, every family color), its count ≥ 4.5:1 on that tint, no background when unpicked, and the same size and padding either way (tests: `app/src/screens/__tests__/guxPaper.test.tsx`).

### Phase 1 gate (manual)
| ID | Given / When / Then | Type |
|---|---|---|
| RD-28 | On Chase's iPhone (Expo Go) and one Android: light, dark, largest text. The greeting collapses, every word fits, no overlap with the tab bar (LIVE-1 class). | manual |
| RD-29 | Grandparent test on the new look (GOALS): "Open the new photos", "Find a photo from October", "Send Mom a message", "Turn Easy view off, then on again", "Go back to the start"; each under 60 s with no help, 4 of 5 testers. | manual |

## Phase 2: the family's color is set once for everyone (after the beta)
Needs: architect (schema), privacy-security (low risk: a color word, no personal data), a migration Chase deploys, the `docs/architecture/` data section (rule 6), API contract test first.
| ID | Given / When / Then | Type |
|---|---|---|
| RD-30 | `spaces.accent` text, one of `ember`, `forest`, `plum`, default `ember`, readable by every member through the existing space read. | auto (SQL) |
| RD-31 | Only the owner can change it, through an RPC; an adult or viewer gets `42501` (branch on `error.code`, rule 7). | auto (SQL, contract) |
| RD-32 | After the owner changes it, every member's app shows the new accent on its next load; `prefs.color` is no longer read. | auto |
| RD-33 | The web viewer and email notices keep Ember (no per-family email theming). | auto |

## Not doing
- Quieter Feed post (mockup's P-3: one "Shared with" line, "Reply to Alex" word button): after phase 1 lands and only if time remains before Nov 22; otherwise after the beta.
- More than three accents (mockup had six): Apple blue loses Hearth's look; Teal and Amber add choice without need.
- A per-person color: Chase moved it to the admin.
- Option B family moments, C's accent band, Ember month titles and A's date line above the greeting (Chase, Nov 18, DEC-67): only the paper, photo shadows and reaction pop were picked; RD-4's accent rule stands.
- Avocado and pomegranate palettes (Chase, Nov 18): mockups only after 1h merges (TRACKER R56); not built until he picks one.
- More comforts inside Easy view (simpler Feed, fewer rows in More): not before the beta; Easy view ships as tab words plus bigger text (DEC-66).
- Tailwind or any new UI library.
- Per-family email theming.

## Risks
- **Timing.** The beta is Nov 22. Phase 1 touches every screen. Stop: if 1c isn't merged and phone-checked by Thu Nov 19, the beta runs on what has merged; never a half-done PR.
- **Sideways row is easy to miss** (mockup note). Handled by RD-20's words, RD-21's See all, and RD-29.
- **"Feed" is social-media wording** (CU card). Chase's call; RD-17 keeps it family-only, newest first, no suggestions.
