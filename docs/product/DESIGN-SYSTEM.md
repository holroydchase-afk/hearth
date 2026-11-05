# Hearth design system: native first, plus Hearth's overrides

Owner: grandparent-ux (Hearth's UI/UX designer). Written Oct 19, 2026, from Chase's ask: "can't we go 100% apple UI/UX. guidelines, guardrails, components, fonts, etc. and maybe the same for android ... that should make it intuitive out of the gate without us guessing. AND you would have tons of constraints". Decision and persona check: `docs/product/decisions/2026-10-19-native-design-system.md`.

## Portable tokens (DS-TOKENS, Nov 4)

The type scale, spacing, corners, tap target, font and both palettes are also in [`docs/design/tokens.json`](../design/tokens.json), generated from `app/src/ui/theme.ts` (a test fails if they drift). Other studio products reuse it and swap the colors. Font: Atkinson Hyperlegible Next only (Chase, Nov 1, reaffirmed Nov 4).

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

| # | Override | Platform default it tightens | Why |
|---|---|---|---|
| DS-1 | Tap targets are **48 pt** on both phones, with space between them | HIG allows 44 pt | CLAUDE.md rule 3; older hands and older phones |
| DS-2 | **No text smaller than 17 pt** at the default size, including captions, timestamps and tab labels | HIG and Material use 11–13 pt for captions and tabs | Rule 3; UX-REVIEW found 11–12 pt labels June couldn't read |
| DS-3 | **Every icon has a word** under or beside it. No icon-only buttons, even in toolbars | HIG and Material allow icon-only toolbar buttons | Rule 3; G3 "tap the one that says…" over the phone |
| DS-4 | **Every swipe, long-press or pinch also has a button** that does the same thing | HIG says offer alternatives; Hearth makes it a must | Rule 3: no gesture-only actions |
| DS-5 | **Tab labels never hide**: no tab bar that minimizes on scroll, no labels that show only when selected | iOS lets the tab bar minimize; Material lets labels show only when selected | The way back must always be visible, with its word |
| DS-6 | **Text sits on a solid background.** No text over translucent glass or a photo without a solid backing | iOS translucent materials | Contrast outdoors and on old screens; honors Reduce Transparency |
| DS-7 | **Hearth's words**: group (not circle), Photos (not feed), Help (not Me) | Platform words like "Library" or "Settings" | Rule 3 |
| DS-8 | **Errors and loading use words**: what happened, what to do, who to call; spinners always have a line of text | Platforms allow a bare spinner | G2, GOALS "never empty, never silent" |
| DS-9 | **One main action per screen**, as one filled button | Platforms allow several prominent buttons | "Just show me the babies" (LG) |
| DS-10 | **Anyone can pick a light or dark screen** (Same as my phone, Light, Dark) on Help or Me, right after Bigger text | Apps usually just follow the phone | Chase, Nov 1 2026 (DEC-47); a relative can be told one step instead of changing the whole phone |
| DS-11 | **Warm Hearth colors on every phone** (Nov 5, DEC-50: Ember, Sage or Plum, picked under Colors on Help or Me; Ember by default): warm off-white and warm charcoal (never pure black), one blue for taps, body text 7:1 (AAA), waiting buttons solid gray (no see-through) | Each platform's own system colors at 4.5:1 | Chase found the system colors "rough" (DEC-47); one look across phones and the web |
| DS-12 | **Atkinson Hyperlegible Next** (Braille Institute, SIL OFL) on every phone and the web, in three weights only: Regular for reading, Medium for Android buttons and unpicked tabs, SemiBold for names, titles, buttons and the picked tab. Never Light, Bold, ExtraBold, italics or all caps | Each phone's own font | Made for low-vision readers; Chase picked it from three side by side and found bold too heavy (DEC-47) |
| DS-13 | **One spacing scale and four corner sizes**: gaps from `SPACE` (4, 8, 12, 16, 24, 32), corners from `RADIUS` (small 4, medium 12, large 20, pill). Dialogs keep each phone's own corner (14 pt iPhone, 28 dp Android) | Platforms give guidance, not one scale | The Nov 1 sweep found 9 corner sizes and 13 gaps picked by hand (V3, V5). New code uses the tokens; old screens move as they're touched (R30) |

## How the app does it (built Oct 19, 2026; Chase picked "All now")

- **Fonts (DS-12, Nov 1 2026):** `@expo-google-fonts/atkinson-hyperlegible-next` (0.4.1, version from the npm registry), imported one weight file at a time so only Regular, Medium and SemiBold ship (48 KB each). `FONT` in `theme.ts` names them; the root layout loads them with `useFonts` and falls back to the phone's font if loading ever fails. Weight comes from the file (`fontFamily`), never from `fontWeight`. Until Oct 31 Hearth used the phone's own font.
- **Colors (DS-11, Nov 1 2026; COLOR-1, Nov 5):** `paletteFor(os, dark, color)` takes `prefs.color` (`ember`, `sage`, `plum`) through `ColorContext`; the values are in `theme.ts` and `docs/design/tokens.json` (`colorChoices`), and the table below is the Nov 1 blue, kept for history. Before Nov 5, `paletteFor(os, dark)` in `theme.ts` returns one Hearth palette on every phone and the web. Light: warm off-white `#F7F5F2`, white cards, ink `#1C1B19`, blue `#0B57D0`. Dark: warm charcoal `#151413`, cards `#232120`, ink `#F4F1EC`, soft blue `#8AB4F8` with navy words on buttons. Until Oct 31 it was Apple's system colors on iPhone and a Material 3 scheme on Android.
- **Light or dark (DS-10):** `prefs.look` (`system`, `light`, `dark`) feeds `LookContext`; `useTheme()` resolves it with `isDark()`. On phones `Appearance.setColorScheme` makes the native tab bar, keyboard and alerts match; the status bar follows `statusBarStyle()`.
- **Tab bar:** the phone's own tab bar (expo-router `NativeTabs`) on Android, with Material Symbols, 17 pt labels and labels always shown (DS-2, DS-5). iPhone and the web use Hearth's own bar in the same style (SF Symbols on iPhone): on Chase's iPhone the glass tab bar drew 17 pt words over the icons (LIVE-1, Nov 5), and the web version of `NativeTabs` puts the tabs at the top of the screen.
- **Toolbar (LIVE-2):** everyday actions at the top of a screen (Messages, By date, Events on Photos) are `IconButton`s: a 28 pt symbol over a 17 pt word, 60 pt targets, right-aligned above the big title.
- **Buttons:** iPhone filled, gray and plain buttons; Android filled, outlined and text buttons with the ripple. Icons come from `expo-symbols` and always sit beside words (DS-3).
- **Switches:** the phone's own switch, with the word On or Off beside it.
- **Fields and cards:** iPhone grouped-list style; Android outlined field and outlined card.
- **Confirm dialogs:** a custom dialog shaped like the phone's own (14 pt corners on iPhone, 28 dp on Android). This is a custom control on purpose: Android's system dialog uses 14 sp buttons (DS-2), and the system alert doesn't work on the web or in tests.
- **Tests:** `app/src/ui/__tests__/designSystem.test.tsx` checks the font and its three weights, the type ramp, every color pair at 4.5:1 (body text 7:1) in light and dark, the waiting-button look, and tab icons and labels.
- **Tokens (DS-13) and the Nov 1 sweep:** `SPACE`, `RADIUS` and `dialogRadius()` in `theme.ts`; `app/src/ui/__tests__/a11ySweep.test.tsx` checks the tokens, that `kit.tsx` has no hand-picked corners, heading levels (A11Y-1) and the switch colors (A11Y-2, A11Y-3).
- **Old look:** saved in `docs/design/versions/` (screenshots of every main screen, before and after).

**Confirm on a phone (milestone 1 UAT):** Hearth's tab bar on an iPhone (LIVE-1) and the native one with 17 pt labels on Android, and whether gray buttons stand out enough on the light gray background.

## Palette (DS-11): what each color is for

Every pair below is measured (WCAG 2 contrast). Text needs 4.5:1, body text aims for 7:1, and a control's edge needs 3:1. `line` is for dividers only, never the only edge of something you tap.

| Token | Use it for | Light | Dark | Contrast (light / dark) |
|---|---|---|---|---|
| `bg` | The screen behind the cards | `#F7F5F2` | `#151413` | |
| `surface` | Cards, sheets, the tab bar | `#FFFFFF` | `#232120` | |
| `ink` | Everything you read | `#1C1B19` | `#F4F1EC` | 17.2 / 14.2 on surface |
| `muted` | Dates, hints, "Sent by"; a switch's Off track | `#5D5953` | `#B9B3AB` | 7.0 / 7.7 on surface |
| `line` | Dividers and card edges only | `#D6D1CA` | `#3D3A36` | 1.5 / 1.4 (decoration) |
| `accent` | Anything you can tap: buttons, links, the picked tab | `#0B57D0` | `#8AB4F8` | 6.4 / 7.6 on surface |
| `accentInk` | Words on a filled blue button | `#FFFFFF` | `#0A2558` | 6.4 / 7.0 on accent |
| `accentSoft` | A picked choice's background, avatar circles | `#E4ECFA` | `#1F2D45` | accent on it 5.4 / 6.6 |
| `fill` | Gray (secondary) buttons, a waiting button | `#ECE8E3` | `#33302D` | accent 5.2 / 6.2, muted 5.7 / 6.3 |
| `safe`, `safeSoft` | "Only these people can see it" and other good news | `#1C6E31` on `#E3F3E7` | `#7DD394` on `#173322` | 5.5 / 7.6 |
| `danger`, `onDanger` | Delete and other cannot-undo actions only | `#B3261E`, white | `#F2B8B5`, `#601410` | 6.5 / 9.4 on surface |
| `photo` | The placeholder while a photo loads | `#E8E4DE` | `#2E2B28` | |
| `scrim` | Behind a dialog | black 40% | black 60% | |

**Rules:** one blue means "tap here", so never use `accent` for decoration. Green and red mean status only. Never put `muted` text on `fill` for anything important. A new color needs a row here and a contrast test in `designSystem.test.tsx`.

## Familiar patterns (P-1..P-12)

Chase, Nov 1 2026: "There are very standardized aspects of the design and design system we need to mimic. The more familiar the easier." The patterns below are the ones every photo-sharing app shares (Facebook, Instagram, Google Photos, Apple Photos, FamilyAlbum, Tinybeans). Copy them unless a Hearth override (DS-1..13) says otherwise. Research and sources: the "How photo apps are laid out" doc (Nov 1) and `docs/design/a11y-sweep-2026-11-01.md`.

| # | Pattern people already know | Hearth today | Gap |
|---|---|---|---|
| P-1 | A bottom tab bar of 2 to 5 tabs, an icon over a word, the picked one in the accent color | Matches (DS-5) | |
| P-2 | The app opens on the newest posts from your people, newest first | Matches: Photos | |
| P-3 | A post card: round avatar, name and time on the left, "⋯" at top right, the photo full width, a reaction row, then comments | Matches, with "⋯ More" as a word (DS-3) | |
| P-4 | Tap a photo to open it full screen on black; Close at the top; swipe for the next one | Opens full screen with Close and Back / Next buttons (DS-4) | The background is the light screen color, not black (A11Y-4) |
| P-5 | Pull down to refresh | Matches | |
| P-6 | Comments open as a sheet over the post, with the box at the bottom | Matches | |
| P-7 | A "+" or Share tab: pick photos from the phone's own picker, add words, choose who sees it, Post | Matches, with "Who can see this" before Post | |
| P-8 | Filters as a row of chips or words just under the title (Instagram's All / Friends / Latest) | Messages, By date and See events buttons | No "who" filter yet (the Who row idea, ANCHORS ideas log) |
| P-9 | Browse by month or by date (Google Photos, FamilyAlbum, Tinybeans) | By date | |
| P-10 | Your account and settings live in the last tab | Me for posters, Help for viewers (DS-7) | |
| P-11 | Double-tap a photo to like it | Not built | Familiar, but gesture-only; allowed only as a second way with the Love button kept (DS-4). Ideas log |
| P-12 | Long-press for more options | Not used; "⋯ More" is a visible button | Keep it that way: hidden gestures are where older relatives get lost |

**Skip on purpose:** a search tab or AI "Ask" box, video-first or suggested posts, stories rings, a hamburger menu, more than 5 tabs, and swipe-only navigation. Each one either needs typing on an old phone, adds anxiety (A1), or hides the way back.

