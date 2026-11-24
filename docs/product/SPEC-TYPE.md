# SPEC-TYPE: one named type scale, at iPhone's standard sizes (TYPE-1..TYPE-14)

Status: specced Nov 24, 2026 · Pending Chase's OK on DEC-84 (staff-pm recommends yes) · TRACKER R82 · Persona check `decisions/2026-11-24-type-scale.md`

Chase, Nov 24 (verbatim): "Go with A +Standard iphone sizes... If we do not have everything broken down based on the header, body, title, etc. etc. we need to do that now. Then we need to align with iphones standards."

## Why
Today `app/src/ui/theme.ts` has three sizes made by multiplying one number (`typeScale(bigText)`: base 17 or 21, title ×1.3, display ×1.65) plus two loose Gallery numbers (`GALLERY_TYPE` 34 and 24), and about seven raw `fontSize` numbers in screens. Nothing is named for what it is (header, body, caption), so a screen can't be checked against the iPhone and every new screen picks its own size. This spec replaces all of it with Apple's eleven text styles, by name, at Apple's sizes and leading (HIG Typography, "iOS, iPadOS Dynamic Type sizes", read Nov 24, 2026 from developer.apple.com).

## The scale (TYPE-1, TYPE-2)
One table in `theme.ts`, `TYPE`, keyed by style name, with a Standard set (Easy view off; Apple's default **Large** size) and an Easy view set (Apple's **xxLarge**, two steps up, raised to 17 where Apple goes under). Size / leading in points. The phone's text size setting still multiplies both sets (TYPE-9).

| Style | Standard (Large) | Easy view (xxLarge, min 17) | Weight | Use for |
|---|---|---|---|---|
| `largeTitle` | 34 / 41 | 38 / 46 | SemiBold | The title of a tab's top page: Gallery greeting, Feed, More |
| `title1` | 28 / 34 | 32 / 39 | SemiBold | The title of every other full page (pushed pages, sign-in, join, start a family) |
| `title2` | 22 / 28 | 26 / 32 | SemiBold | Section headings, card and dialog-sheet titles, post titles, Share "New post", Gallery month names |
| `title3` | 20 / 25 | 24 / 30 | SemiBold | Reserved: a heading inside a section (no use today) |
| `headline` | 17 / 22 | 21 / 26 | SemiBold | Button and action words, names, counts that are the point, "Add photos" |
| `body` | 17 / 22 | 21 / 26 | Regular | All reading text: captions, comments, notes, menu rows, fields, alert messages |
| `callout` | 16 / 21 | 20 / 25 | Regular | Reserved: none today |
| `subheadline` | 15 / 20 | 19 / 24 | Regular | Secondary words only (see the map): dates, "N people", reaction counts, kind tiles |
| `footnote` | 13 / 18 | 17 / 22 | Regular | Reserved: none today (Easy view raises to 17) |
| `caption1` | 12 / 16 | 17 / 22 | Regular | Tab words (Android's own bar with Easy view off; Hearth's bar in Easy view) |
| `caption2` | 11 / 13 | 17 / 22 | Regular | Reserved: none today (Easy view raises to 17) |

Rules:
- **Weights** (TYPE-4): Hearth's font has Regular, Medium and SemiBold and no Bold (DEC-78, RD-55). Apple's headline is Semibold; Apple's "emphasized" weight is Bold for the titles and Semibold for the rest, so Hearth's titles use SemiBold (as today) and every other style has an `emphasized` form in SemiBold. Medium belongs to no style; its two uses today move to a named style.
- **Easy view** (TYPE-3): nothing is under 17 pt. Apple's xxLarge caption1 (16 / 21) and caption2 (15 / 20) are raised to 17 / 22.
- **Color is separate** from the style: a style never sets color; `Txt` takes `style="body"` and `tone="ink" | "muted" | "accent" | "danger"` (the old `muted` variant is `body` + `tone="muted"`).
- **Smaller styles are for secondary words only**: `callout` through `caption2` never carry a sentence to read, an action word (except tab words) or anything about who sees a post (A1). Reading text is `body`.

## API (engineer's freedom inside these lines)
- `theme.ts` exports `TYPE` (both sets), `type TextStyleName`, and `textStyle(name, easyView, emphasized?) => { fontFamily, fontSize, lineHeight }`. `useTheme()` returns `type` (the current set, so `type.body.fontSize`) in place of `t`.
- `Txt` variants become the style names. Removed: `typeScale`, `t.base / t.title / t.display / t.line`, `GALLERY_TYPE`, the `strong` / `title` / `display` / `muted` variants.
- Two decorative glyph constants may live in `theme.ts` with fixed numbers: `STAMP_MARK` (17 / 18, the postcard stamp, hidden from screen readers, the only `allowFontScaling={false}`) and `EMOJI_GLYPH` (`title2`'s numbers, reactions). Nothing else.

## Map: every use today to its style (TYPE-6)
Counts from `grep` on Nov 24. "No change" means the same size in Standard; Easy view follows the table above.

| Where | Element | Today (Std / Easy) | Style | Change in Standard |
|---|---|---|---|---|
| `GalleryTop` | Greeting ("Good morning, Kevin") | `GALLERY_TYPE.largeTitle` 34 / 34 | `largeTitle` | No change (Easy 38) |
| `GalleryGrid` | Month name | `GALLERY_TYPE.month` 24 / 24, leading 30 | `title2` | 24 → 22 |
| `GalleryGrid` | Date group ("Oct 17") | `t.base` Medium 17 / 21 | `subheadline` emphasized | 17 → 15 |
| `TimelineScreen` (Feed), `MoreScreen` | Page title (`display`) | 28 / 35 | `largeTitle` | 28 → 34 |
| Other screens with `variant="display"` (Groups, Events, Help, Birthdays, Search, Photos, Join, SignIn, AppGate, Messages chat title, BatchReview, Me, StartFamily, DemoFrame; 28 uses) | Page title | 28 / 35 | `title1` | No change (Easy 32). A second `display` in a tab-root file that is not the page title (an empty-state heading) is `title1` too |
| `ShareScreen` | "New post" | 28 / 35 | `title2` | 28 → 22 (Chase's pick, SHARE-ST-28) |
| Any `variant="title"` (58 uses: section headings, card titles, post titles in Feed and PostCard, sheets, ErrorBoundary, NotFound, Preferences, Join) | Heading | 22 / 27 | `title2` | No change (Easy 26) |
| Any `variant="strong"` (36 uses) | Names, emphasized words | 17 / 21 SemiBold | `headline` | No change |
| Any `variant="body"` | Reading text | 17 / 21 | `body` | No change |
| Any `variant="muted"` (60 uses) | Quiet reading text | 17 / 21 | `body` + `tone="muted"` | No change, except the rows below that are secondary |
| `kit` `Button` | Label | `t.base` SemiBold | `headline` | No change |
| `kit` `IconButton` | Word under the icon | `t.base` Regular | `body` | No change (an action word, rule 3) |
| `kit` `BackButton` | "‹ Gallery" | `t.base` | `body` | No change |
| `kit` `MenuRow` | Text / count / value | `t.base` | `body` / `headline` (accent) / `body` muted | No change |
| `kit` `FaceTile` | Initial, name | `t.base` SemiBold | `headline` | No change |
| `kit` `FaceTile` | "N people" | `t.base` muted | `subheadline` muted | 17 → 15 |
| `kit` `AddTile` | "Add" | `t.base` SemiBold | `headline` | No change |
| `kit` `AddPhotoCard` | "Add photos" | `t.title` 22 | `headline` (accent) | 22 → 17 (SHARE-ST-29) |
| `kit` `SwitchWord` | On / Off | `t.base` SemiBold | `headline` | No change |
| `kit` `Field` | Typed text | `t.base` | `body` | No change |
| `kit` `AlertDialog` | Title / message / buttons | `t.base` | `headline` / `body` / `body` (Keep) and `headline` (Delete) | No change |
| `kit` styles `stampMark` | Stamp month and day | raw 17 / 18 | `STAMP_MARK` | No change |
| `PostCard` `SheetRow` | Row label | `t.base` | `body` | No change |
| `PostCard` `ReplyBox` | Typed reply | `t.base`, `commentLine()` | `body` (its leading) | No change |
| `PostCard` `ReactionButton` | Count | `t.base` | `subheadline` | 17 → 15 |
| `PostCard` styles `emoji` | Reaction emoji | raw 22 / 28 | `EMOJI_GLYPH` (= `title2`) | No change |
| `PostCard` styles `faceText` | Initials in a face | raw 17 / 20 SemiBold | `headline` | Leading 20 → 22 |
| `PostCard` `muted` lines | Post date and time | 17 muted | `subheadline` muted | 17 → 15 |
| `PostCard` `muted` lines | Who sees it, "Seen by" | 17 muted | `body` muted | No change (A1: audience words are never small) |
| `PhotoCollage` styles `moreText` | "+3" on the last tile | raw 17 / 20 Medium, white | `headline` | Medium → SemiBold |
| `VideoPoster` | "Play" | `t.base` SemiBold | `headline` | No change |
| `ShareScreen` | "To:" (empty card and postcard) | `t.base` | `headline` muted (empty card), `body` muted (postcard) | No change |
| `ShareScreen` | "1 of N" on the photo | `t.base` SemiBold, white | `headline` | No change |
| `ShareScreen` | To: names line | `t.base` SemiBold | `headline` | No change |
| `ShareScreen` | `tileColumns({ fontSize })` | `t.base` | `type.headline.fontSize` | No change |
| `TabBar` | Android system bar `labelStyle` | raw 17 | `caption1` | Easy view off: 17 → 12 (Material's own 12 sp); Easy view on: 17 |
| `TabBar` | Hearth's bar words (Easy view only) | `t.base` 21 | `caption1` | Easy view 21 → 17 |

## Acceptance (TYPE-1..TYPE-14)

| ID | Given / When / Then | Type |
|---|---|---|
| TYPE-1 | Given `TYPE`, then the Standard set equals the table exactly: each of the 11 styles' fontSize and lineHeight (largeTitle 34/41 … caption2 11/13). | auto (jest) |
| TYPE-2 | Given `TYPE`, then the Easy view set equals the table exactly (largeTitle 38/46 … caption2 17/22), and `useTheme().type` returns the Easy view set when Easy view is on and the Standard set when off. | auto (jest) |
| TYPE-3 | Given the Easy view set, then no style's fontSize is under 17 and every lineHeight is at least its fontSize. Given any screen rendered with Easy view on (the `a11ySweep` screen list), then no `Text` in the tree has a fontSize under 17. | auto (jest) |
| TYPE-4 | Given every style, then fontFamily is `FONT.regular` or `FONT.semibold` (never Medium, never a Bold file); the titles and `headline` are SemiBold; `textStyle(name, easy, true)` returns SemiBold for every style. | auto (jest) |
| TYPE-5 | Lint (`app/src/ui/__tests__/typeLint.test.ts`): scanning `app/src/**/*.tsx?` except `ui/theme.ts` and test files, the test fails on any `fontSize:` or `lineHeight:` followed by a number literal; any `t.base`, `t.title`, `t.display`, `t.line`, `typeScale(`, `GALLERY_TYPE`; any `variant="strong"`, `"title"`, `"display"` or `"muted"` on `Txt`. It names the file and line. | auto (jest) |
| TYPE-6 | Given the map, then rendered samples carry their style: Gallery greeting and Feed and More titles `largeTitle`; a pushed page title (Birthdays) `title1`; Share "New post" `title2`; a `Button` label `headline`; a post date `subheadline`; the who-sees-it line `body`; a FaceTile "N people" `subheadline`; Android tab `labelStyle` `caption1`. Each checks size and leading in both modes. | auto (jest) |
| TYPE-7 | Given Easy view off, then `callout`..`caption2` appear only on the elements the map lists (date group, post date, "N people", reaction count, kind tiles, tab words); a test lists the allowed `testID`s and fails on any other Text under 17 in the `a11ySweep` screens. | auto (jest) |
| TYPE-8 | Given any text on a screen, then nothing sets `allowFontScaling={false}` except the two `STAMP_MARK` texts; `maxFontSizeMultiplier={LABEL_SCALE_CAP}` stays where it is today. | auto (jest) |
| TYPE-9 | Given an iPhone at the largest accessibility text size (and Android font scale 2.0), when Gallery, Feed, a post, Share and More open, then every style grows with the setting, words wrap (nothing cut, nothing overlaps) and labels stop at their cap. | manual (phone) |
| TYPE-10 | Public demo (393 px) as Kevin, light and dark, Easy view off and on: computed font sizes on Gallery greeting, Feed title, a post title, post body, post date, a button, Share "New post" and "Add photos" match the table. | auto (Playwright) |
| TYPE-11 | Given `docs/product/DESIGN-SYSTEM.md` DS-2 and `CLAUDE.md` rule 3, then both name SPEC-TYPE and say Easy view keeps everything 17+ (done in this PR, docs). The old `designSystem.test.tsx` DS-2 test ("never goes under 17") is rewritten to TYPE-3 and TYPE-7, not deleted. | auto (jest) |
| TYPE-12 | Given `docs/design/tokens.json` (generated from `theme.ts` by `app/src/ui/tokens.ts`, checked by `designTokens.test.ts`), then `type` holds the 11 named styles in both sets (`standard`, `easy`) in place of `default.base` / `large.base`, so other studio products read the same names; `docs/design/tokens.json` is regenerated. | auto (jest) |
| TYPE-13 | Given a parent with Easy view off on a 6.1" iPhone, when they read a post date, a group's "N people" and a reaction count, then they read each aloud correctly without zooming. | manual (person) |
| TYPE-14 | Given LG with Easy view on (the default for viewers), when they do the grandparent test's five tasks, then 4 of 5 pass in under 60 s each with no help, as before the change. | manual (person) |

## Not doing
- Per-platform scales (Material 3's own sizes on Android): one named scale for both phones keeps one test and one look (DEC-78's reason); Android parents get Material's 12 sp tab words only through the system bar they already use.
- Using `footnote`, `callout`, `caption2` anywhere now: reserved names, no screen needs them; adding one is a map row and a staff-pm call.
- Real Dynamic Type text styles (`UIFont.preferredFont`): RN scales by the phone's multiplier already (TYPE-9); custom font plus multiplier is close enough for the beta.
- Changing any layout, spacing or icon size beyond the Share start rows below.

## Share start, option A with standard sizes
Owned here: the look. Owned by the thread "Design one visibility core and share flow" (`SPEC-VISIBILITY-CORE.md`): the kinds, their data and what Event, News and Saying open. Criteria SHARE-ST-28..34 live in `SPEC-REDESIGN.md` 1j-2, round 4.

---
Last updated: Nov 24, 2026 (staff-pm; DEC-84 pending)
