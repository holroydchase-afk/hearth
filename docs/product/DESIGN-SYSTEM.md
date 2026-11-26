# Hearth design system: native first, plus Hearth's overrides

Owner: grandparent-ux (Hearth's UI/UX designer). Written Oct 19, 2026, from Chase's ask: "can't we go 100% apple UI/UX. guidelines, guardrails, components, fonts, etc. and maybe the same for android ... that should make it intuitive out of the gate without us guessing. AND you would have tons of constraints". Decision and persona check: `docs/product/decisions/2026-10-19-native-design-system.md`.

**Start here (Nov 21, 2026).** The product-neutral rules, token names and scales that Chase's other products copy are in [`docs/design/STUDIO-CORE.md`](../design/STUDIO-CORE.md): each phone's own guidelines for behavior, Material 3 color roles as the token vocabulary, no component library. This file is Hearth's layer on top: the DS overrides, Hearth's themes and components, and the gaps still in the code.

## Portable tokens (DS-TOKENS, Nov 4)

The type scale, spacing, corners, tap target, font and both palettes are also in [`docs/design/tokens.json`](../design/tokens.json), generated from `app/src/ui/theme.ts` (a test fails if they drift). Other studio products reuse it and swap the colors. Font: Atkinson Hyperlegible Next again (DEC-78, Nov 21; the phone's own font Nov 15 to Nov 21).

## The rule

1. **On iPhone, follow Apple's Human Interface Guidelines (HIG)**: https://developer.apple.com/design/human-interface-guidelines
2. **On Android, follow Material Design 3** (https://m3.material.io) and Android's accessibility guidance (https://developer.android.com/guide/topics/ui/accessibility/apps).
3. **The Hearth overrides below win** wherever they are stricter. They exist because the guidelines are written for everyone, and our least savvy relatives (Grandaddy, Memaw and Pawpaw; the great-grandparents) need a few things stricter.
4. **Don't invent.** Before designing a custom control, look for the system one. A custom control needs a written reason in the PR.

Same features, same photo quality and same words on both phones (persona AG). Only the look follows each phone.

## What we take from the platforms

| Area | iPhone (HIG) | Android (Material 3) |
|---|---|---|
| Font | Hearth's own font (DS-12) at the system sizes, so Dynamic Type still works | Hearth's own font (DS-12) in `sp`, so the phone's font size and Android's up-to-200% scaling work |
| Text size | Body is 17 pt at the default size; support enlarging to at least 200% without clipping or truncating (HIG Accessibility, Typography) | Same rule: text in `sp`, tested at the largest font size |
| Tap targets | 44×44 pt minimum (HIG) | 48×48 dp minimum (Android accessibility) |
| Contrast | 4.5:1 minimum for text, in light and dark mode; honor Increase Contrast | 4.5:1 for text under 18 sp (14 sp bold) |
| Navigation | Tab bar with a symbol and a text label on every tab (HIG Tab bars) | Navigation bar with labels always shown |
| Icons | SF Symbols | Material Symbols |
| Buttons | System button styles; labels start with a verb ("Add to Cart" is Apple's own example) | Material buttons (filled, tonal, outlined, text) |
| Sheets, alerts, pickers | System sheets, alerts, share sheet, photo picker | Material bottom sheets and dialogs, the system photo picker |
| Dark mode | Supported; Hearth's own palette (DS-11) | Supported; Hearth's own palette (DS-11) |
| Screen readers | VoiceOver labels on every control | TalkBack labels on every control |

The web viewer (for GG and anyone without the app) follows the iPhone column with the system font stack, so it looks familiar on both phones and on a computer.

## Hearth overrides (stricter than the platform)

DEC-59 (Nov 15, `SPEC-REDESIGN.md`) rewrote DS-3, DS-7, DS-9, DS-11, DS-12 and DS-13. The app follows the old rows until each phase 1 PR merges; phase 1a (fonts, colors, buttons, corners) is in "How the app does it" below; the palette table is history.

| # | Override | Platform default it tightens | Why |
|---|---|---|---|
| DS-1 | Tap targets are **48 pt** on both phones, with space between them | HIG allows 44 pt | CLAUDE.md rule 3; older hands and older phones |
| DS-2 | **Named iPhone text styles** (`SPEC-TYPE.md`, DEC-84, Nov 24; was "no text smaller than 17 pt"): reading text is Body 17; callout..caption2 only for secondary words with Easy view off; Easy view keeps everything 17+ | HIG and Material use 11–13 pt for captions and tabs | Rule 3; UX-REVIEW found 11–12 pt labels June couldn't read |
| DS-3 | **Every icon has a word** under or beside it (the tab bar follows DS-5 and Easy view, DEC-66). No icon-only buttons, even in toolbars. Top right holds only **Search** and **By date**; no row of buttons above the title (DEC-59) | HIG and Material allow icon-only toolbar buttons | Rule 3; G3 "tap the one that says…" over the phone; Chase, Nov 14: "I only want like search … and maybe 1 more in the upper right" |
| DS-4 | **Every swipe, long-press or pinch also has a button** that does the same thing | HIG says offer alternatives; Hearth makes it a must | Rule 3: no gesture-only actions |
| DS-5 | **Tab labels never hide** with Easy view on (the default for viewers): no tab bar that minimizes on scroll, no labels that show only when selected. With Easy view off (the default for parents) the tabs are icons only, each still spoken by name and 48 pt (DEC-66, RD-76), and the bar shrinks to a small glass oval on scroll down and comes back on scroll up (RD-110, DEC-75) | iOS lets the tab bar minimize; Material lets labels show only when selected | The way back must always be visible, with its word |
| DS-6 | **Text sits on a solid background.** No text over translucent glass or a photo without a solid backing | iOS translucent materials | Contrast outdoors and on old screens; honors Reduce Transparency |
| DS-7 | **Hearth's words**: group (not circle). Tabs **Gallery, Share, Feed, More** (viewers: Gallery, Feed, More); Me and Help are rows in More (DEC-59; was Photos, not feed; Help, not Me) | Platform words like "Library" or "Settings" | Rule 3; Chase's tab names, Nov 14 |
| DS-8 | **Errors and loading use words**: what happened, what to do, who to call; spinners always have a line of text | Platforms allow a bare spinner | G2, GOALS "never empty, never silent" |
| DS-9 | **No large filled buttons** except deliberate ones: Delete and Leave confirms, sign-in and Start a family, Post. Main actions are tappable rows, photos, text buttons or small tinted capsules, still 48 pt to tap (DEC-59, RD-7; was one filled button per screen) | Platforms allow several prominent buttons | Chase, Nov 15: giant buttons "look dated" |
| DS-10 | **Anyone can pick a light or dark screen** (Same as my phone, Light, Dark) on Help or Me (More → Light or dark after DEC-59), right after Easy view (was Bigger text, DEC-66) | Apps usually just follow the phone | Chase, Nov 1 2026 (DEC-47); a relative can be told one step instead of changing the whole phone |
| DS-11 | **Three themes the family's owner picks** (DEC-68, DEC-69, DEC-76): Paper (default), Avocado and Pomegranate, each its own page, grays and one `accent` in light and dark (values in "Hearth's themes" below); a soft shadow under photos in light mode only (RD-88), none on anything else; the accent only on the main tap word or chip, the picked tab, a picked reaction's outline and the new-message dot; text 4.5:1 minimum, body 7:1. Replaces warm paper with Ember/Forest/Plum (DEC-67) and the per-person picker (DEC-47, DEC-50) | Each platform's own system colors at 4.5:1 | Chase, Nov 14: "black and white and an accent"; Nov 18: "use the warm paper, the photo shadows, pop reactions"; one colored word is the easiest thing to name over the phone |
| DS-12 | **Atkinson Hyperlegible Next on every phone and the web** (DEC-78, Nov 21; was the phone's own font, DEC-59), bundled, one file per weight: Regular, Medium for a person's name on a post (RD-48), SemiBold for titles, buttons and the picked tab; no Bold. Never Light, italics or all caps. Outline icons (SF Symbols, Material Symbols Outlined) | Each phone's own font | Chase, Nov 21: "hyperlegible next"; the same letters on every phone, built for low-vision readers |
| DS-13 | **One spacing scale and few corners**: gaps from `SPACE` (4, 8, 12, 16, 24, 32); corners 12 for rows and New for you photos, 14 pt dialogs (28 dp Android), square in the Gallery grid. No card inside a card (DEC-59, RD-8) | Platforms give guidance, not one scale | The Nov 1 sweep found 9 corner sizes and 13 gaps picked by hand (V3, V5); Chase's redesign, Nov 14 |
| DS-14 | **Follow the phone's accessibility settings** (Nov 6, HIG-3, -7, -8, -11): Increase Contrast gives each color a high-contrast set (secondary words 7:1, edges 4.5:1); Reduce Motion fades sheets instead of sliding and turns off the reaction pop (RD-90); tab and toolbar words and icons grow with Larger Text up to 1.5x (`LABEL_SCALE_CAP`), then the tab shows Apple's large pop-up label | Apple asks for all of these | Apple design guidelines sweep; DEC-54 |
| DS-15 | **Ask for notices only after the first photo, with a Hearth card first** (HIG-1), one button that opens the phone's prompt, plus Not now. Never at launch | Apple: ask when needed and say why first | A "Don't Allow" can only be undone in iPhone Settings, which nobody can do for Gammy from far away (GOALS); DEC-54 |

## How the app does it (built Oct 19, 2026; Chase picked "All now")

- **Fonts (DS-12; DEC-78, Nov 21 2026):** Atkinson Hyperlegible Next from `@expo-google-fonts/atkinson-hyperlegible-next` 0.4.1, one bundled file per weight (no font service at run time). `FONT` in `theme.ts` names the three families (Regular, Medium for a person's name on a post, SemiBold for titles, buttons and the picked tab); weight comes from the family, never `fontWeight`, because Android can't synthesize weights. The root layout loads `FONT_FILES` with `useFonts` and falls back to the phone's font if loading fails. Tests: `font.test.tsx` (FONT-1..4), demo e2e FONT-5. From Nov 15 to Nov 21 the app used the phone's own font (RD-2).
- **Colors (DS-11; DEC-68, DEC-69, DEC-76):** `paletteFor(os, dark, theme, high)` in `theme.ts` builds each theme from 7 base colors per mode (`BASES`) and derives the rest (`accentInk`, `accentSoft`, `safeSoft`, `tabLine`, the high-contrast set), the recipe in STUDIO-CORE section 3. The theme comes from the family owner's pick (`ThemeContext`). Every page backing is `c.bg`, also the web page around the app; fields and capsules use `c.fill`. Light mode only: one soft shadow (`photoShadow`) on a wrapper around photo tiles (RD-88). Buttons: `tinted` (accent capsule) for a screen's main tap word, `secondary` gray capsule with ink words, `quiet` text link; filled `primary`/`danger` only for RD-7's list (plus the "Yes, sign out" confirm). Tests: `themes.test.ts` checks every contrast pair per theme.
- **Light or dark (DS-10):** `prefs.look` (`system`, `light`, `dark`) feeds `LookContext`; `useTheme()` resolves it with `isDark()`. On phones `Appearance.setColorScheme` makes the native tab bar, keyboard and alerts match; the status bar follows `statusBarStyle()`.
- **Tab bar:** the phone's own tab bar (expo-router `NativeTabs`) on Android, with Material Symbols, 17 pt labels and labels always shown (DS-2, DS-5). On iPhone with Easy view Off (icons only, DEC-66) it is also the phone's own bar (RD-106, DEC-70): iOS 26 draws its floating glass bar, older iPhones the classic one, with no Hearth color behind it and each tab's word kept as its spoken name (RD-107). With Easy view On (words under icons) iPhone keeps Hearth's own fixed bar, because the glass bar drew 17 pt words over the icons (LIVE-1, Nov 5). The web always uses Hearth's bar: the web version of `NativeTabs` puts the tabs at the top of the screen.
- **Toolbar (LIVE-2):** everyday actions at the top of a screen (Messages, By date, Events on Photos) are `IconButton`s: a 28 pt symbol over a 17 pt word, 60 pt targets, right-aligned above the big title.
- **Buttons:** iPhone filled, gray and plain buttons; Android filled, outlined and text buttons with the ripple. Icons come from `expo-symbols` and always sit beside words (DS-3).
- **Switches:** the phone's own switch, with the word On or Off beside it.
- **Fields and cards:** iPhone grouped-list style; Android outlined field and outlined card.
- **Confirm dialogs:** a custom dialog shaped like the phone's own (14 pt corners on iPhone, 28 dp on Android). This is a custom control on purpose: Android's system dialog uses 14 sp buttons (DS-2), and the system alert doesn't work on the web or in tests.
- **Tests:** `app/src/ui/__tests__/designSystem.test.tsx` checks the font and its three weights, the type ramp, every color pair at 4.5:1 (body text 7:1) in light and dark, the waiting-button look, and tab icons and labels.
- **Apple guidelines fixes (DS-14, DS-15; Nov 6):** `paletteFor(os, dark, color, high)`, `LABEL_SCALE_CAP`, `iconSize()` and `sheetShouldClose()` in `theme.ts`; `PhoneA11yContext` follows Increase Contrast and Reduce Motion live (`AppContext.tsx`); `BottomSheet` in `kit.tsx` (grabber, swipe down, Close button); zoom in `ViewerScreen.tsx` (pinch on iPhone, double tap, Zoom button); `platform/haptics.ts` (expo-haptics); the notice card `PushAsk` in `PhotosScreen.tsx`. Tests: `app/src/screens/__tests__/hig.test.tsx` (HIG-1..12).
- **Tokens (DS-13) and the Nov 1 sweep:** `SPACE`, `RADIUS` and `dialogRadius()` in `theme.ts`; `app/src/ui/__tests__/a11ySweep.test.tsx` checks the tokens, that `kit.tsx` has no hand-picked corners, heading levels (A11Y-1) and the switch colors (A11Y-2, A11Y-3).
- **Old look:** saved in `docs/design/versions/` (screenshots of every main screen, before and after).

**Confirm on a phone (milestone 1 UAT):** Hearth's tab bar on an iPhone (LIVE-1) and the native one with 17 pt labels on Android, and whether gray buttons stand out enough on the light gray background.

## Hearth's themes (DS-11)

Base colors from `BASES` in `theme.ts` (the generated full set, derived colors included, is in `docs/design/tokens.json`). Token meanings are in STUDIO-CORE section 3. The Nov 1 blue palette that used to be here is in git history.

| Theme | Mode | `bg` | `surface` | `ink` | `muted` | `line` | `fill` | `accent` |
|---|---|---|---|---|---|---|---|---|
| Paper (default) | Light | `#F7F7F4` Linen | `#FFFFFF` | `#1E1B17` | `#5C564E` | `#E3DED4` | `#EFECE5` | `#AD371D` |
| | Dark | `#131210` | `#1C1A17` | `#F1EEE8` | `#B2ACA2` | `#2E2B27` | `#24221E` | `#FF8A65` |
| Avocado | Light | `#F6F5E4` | halfway page→fill | `#1F1A1B` | `#4F4A42` | `#DCDBCC` | `#E7ECC6` | `#2F5419` |
| | Dark | `#2A2426` | halfway page→fill | `#F3F1DA` | `#C2BDA8` | `#4A4543` | `#3A3335` | `#7ED69B` Fresh leaf |
| Pomegranate | Light | `#F5EADF` | halfway page→fill | `#22161A` | `#62504F` | `#DDCDBE` | `#EBDDD0` | `#A3172F` |
| | Dark | `#170D10` | halfway page→fill | `#F5E9E6` | `#BBA7A6` | `#3A272B` | `#24171A` | `#FF8597` |

Runner-up Paper light page, kept for later: "Barely warm" `#F9F9F7`. Theme names are plain fruit names; never "pit" or "rind".

## Hearth's own components (on top of STUDIO-CORE section 6)

- **Easy view (DEC-66):** a profile setting, on by default for invited grandparents and off for parents. On: words under every icon, bigger text (`typeScale(true)`, body 21), Hearth's fixed tab bar with words. Off: icons-only tabs with spoken names, the phone's own tab bar on iPhone (DEC-70), shrinking on scroll (DEC-75).
- **Share postcard (DEC-73):** the Share screen is a postcard with "who gets it" faces inside its To: section, tiles 3 across (2 in Easy view), nothing pre-picked, one optional "Add a note". Owned by the Share thread; this doc only points to it.
- **Reactions (DEC-76):** the phone's own emoji; a picked reaction is a 2 pt accent outline with an accent count, no filled oval, in every theme.
- **People:** who-can-see is shown as names, not initial circles (Chase, Nov 16); initials only as the avatar until a profile photo exists (RD-49).
- **Group titles (Chase, Nov 4):** only parents and admins see a group's title; others may see who is in it.
- **Gallery:** large-title greeting (34) that collapses on scroll, months by name (24) over a photo mosaic.

## Gaps found in the code (Nov 21, 2026; not fixed yet)

Found while writing STUDIO-CORE. Each needs staff-pm's ranking and a failing test before a fix.

| # | Gap | Where |
|---|---|---|
| DSG-1 | Colors typed by hand instead of tokens: `#1C1C1E`, `#FFFFFF` (photo "+N" overlay), `#000` (Gallery), `#FFFFFF` (video poster, Share) | `PhotoCollage.tsx:107-108`, `GalleryGrid.tsx:159`, `VideoPoster.tsx:36`, `ShareScreen.tsx:247` |
| DSG-2 | About 85 padding or margin numbers typed by hand instead of `SPACE`, and 14 hand-typed corners (most equal a `RADIUS` value) | across `app/src/screens/`, `app/src/demo/` |
| DSG-3 | Three different "picked" looks: reactions use a 2 pt outline with no fill, the To: face tile a 3 pt edge plus a soft fill plus a check, choices a check icon | `PostCard.tsx`, `kit.tsx` `FaceTile`, `Choice` |
| DSG-4 | Two "biggest title" sizes: `display` 28 in the type scale and the Gallery large title 34, which Bigger text doesn't grow | `theme.ts` `typeScale`, `GALLERY_TYPE` |
| DSG-5 | A few font sizes typed by hand (17 and 22, with tight line heights and negative letter spacing on face initials) | `PostCard.tsx:520-521`, `PhotoCollage.tsx:108` |
| DSG-6 | ☑ Nov 21: `tokens.json` now has `roles` (Material 3 role per token) and `themes.css` gives both names (DS-THEMES-1..3) | `app/src/ui/tokens.ts` |
| DSG-8 | The photo shadow uses Paper's ink in every theme, not each theme's own ink | `theme.ts` `photoShadow` |
| DSG-7 | The Familiar patterns table below still describes some pre-redesign screens (P-2 "Photos", P-8, P-10) | this file |

## Familiar patterns (P-1..P-12)

Chase, Nov 1 2026: "There are very standardized aspects of the design and design system we need to mimic. The more familiar the easier." The patterns below are the ones every standard photo app and social feed shares. Copy them unless a Hearth override (DS-1..13) says otherwise. Research and sources: the "How photo apps are laid out" doc (Nov 1) and `docs/design/a11y-sweep-2026-11-01.md`.

| # | Pattern people already know | Hearth today | Gap |
|---|---|---|---|
| P-1 | A bottom tab bar of 2 to 5 tabs, an icon over a word, the picked one in the accent color | Matches (DS-5) | |
| P-2 | The app opens on the newest posts from your people, newest first | Matches: Photos | |
| P-3 | A post card: round avatar, name and time on the left, "⋯" at top right, the photo full width, a reaction row, then comments | Matches, with "⋯ More" as a word (DS-3) | |
| P-4 | Tap a photo to open it full screen on black; Close at the top; swipe for the next one | Opens full screen with Close and Back / Next buttons (DS-4) | The background is the light screen color, not black (A11Y-4) |
| P-5 | Pull down to refresh | Matches | |
| P-6 | Comments open as a sheet over the post, with the box at the bottom | Matches | |
| P-7 | A "+" or Share tab: pick photos from the phone's own picker, add words, choose who sees it, Post | Matches, with "Who can see this" before Post | |
| P-8 | Filters as a row of chips or words just under the title (All / Friends / Latest) | Search and By date in Gallery's top bar (RD-13); Messages and Events are rows in More | No "who" filter yet (the Who row idea, ANCHORS ideas log) |
| P-9 | Browse by month or by date | By date | |
| P-10 | Your account and settings live in the last tab | More, for everyone: Me, Help, Easy view, Light or dark (DS-7, RD-15) | |
| P-11 | Double-tap a photo to like it | Not built | Familiar, but gesture-only; allowed only as a second way with the Love button kept (DS-4). Ideas log |
| P-12 | Long-press for more options | Not used; "⋯ More" is a visible button | Keep it that way: hidden gestures are where older relatives get lost |

**Skip on purpose:** a search tab or AI "Ask" box, video-first or suggested posts, stories rings, a hamburger menu, more than 5 tabs, and swipe-only navigation. Each one either needs typing on an old phone, adds anxiety (A1), or hides the way back.

