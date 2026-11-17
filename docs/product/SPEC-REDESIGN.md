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
| RD-1 | Given light mode, then the screen is white `#FFFFFF` and text is near-black; in dark mode the screen is true black `#000000` and text is near-white. No warm off-white or charcoal remains in `paletteFor`. | auto |
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
| RD-34 | Content screens (Gallery, Feed, post cards, New for you, Share, walk, top bar, tab bar) sit on the plain background, white light / black dark, with no grey card fill; posts are separated by hairline dividers (c.line) and spacing. Grey (grouped background) only on Settings-style lists under More (Bigger text, Light or dark, Family color, Help, Me), on text input fields (the reply field, Share's caption), and on reaction/tinted capsules. | auto (`app/src/screens/__tests__/plainBackground.test.tsx`) |

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

### Phase 1 gate (manual)
| ID | Given / When / Then | Type |
|---|---|---|
| RD-28 | On Chase's iPhone (Expo Go) and one Android: light, dark, largest text. The greeting collapses, every word fits, no overlap with the tab bar (LIVE-1 class). | manual |
| RD-29 | Grandparent test on the new look (GOALS): "Open the new photos", "Find a photo from October", "Send Mom a message", "Make the words bigger", "Go back to the start"; each under 60 s with no help, 4 of 5 testers. | manual |

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
- Tailwind or any new UI library.
- Per-family email theming.

## Risks
- **Timing.** The beta is Nov 22. Phase 1 touches every screen. Stop: if 1c isn't merged and phone-checked by Thu Nov 19, the beta runs on what has merged; never a half-done PR.
- **Sideways row is easy to miss** (mockup note). Handled by RD-20's words, RD-21's See all, and RD-29.
- **"Feed" is social-media wording** (CU card). Chase's call; RD-17 keeps it family-only, newest first, no suggestions.
