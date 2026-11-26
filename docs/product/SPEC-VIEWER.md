# Spec: full-screen photo viewer overhaul (VIEWER-*)

Owner: staff-pm · Nov 24, 2026 · TRACKER R113 (P1) · Status: built Nov 25 (look B), VIEWER-20 phone check pending (Chase)
Source: Chase, Nov 24: "We need to overhaul the full screen photo viewer. It is now the worst aspect of the product."
Persona check: `decisions/2026-11-24-photo-viewer.md` (proposed).
Look: A (recommended), live tester (claude.ai artifact), copy in `/mnt/project-files/design/viewer-2026-11-24/`. B adds a thumbnail strip; C uses the page color behind the photo. Chase picked B (Nov 24, DEC-92): A plus the strip, VIEWER-21..23. Earlier text: this spec is A; if Chase picks B or C, only VIEWER-1 (C) or a new VIEWER-21 (B) changes.

## The bet

Today the viewer is a pale page with five pill buttons and a small photo floating in the middle. Parents compare it with iPhone Photos every day and it loses; grandparents get a small photo. Done means: a parent opens a photo and it behaves like Photos with no surprises, and Grandma Jo (Easy view On) still opens, moves, saves and closes with words and no help.

Signal: Chase on his iPhone says it "feels like Photos" (VIEWER-20); grandparent test subset (open, next, back, save, close) passes with no help, each under 60 s.

## What changes

| | Easy view Off (parents, default) | Easy view On (viewers, default) |
|---|---|---|
| Backdrop | Black, light and dark themes | Black, light and dark themes |
| Photo | Fills the screen, contain, edge to edge | Same, between the top and bottom bars |
| Top | Close, round icon (top left). Sender name `headline` (17 SemiBold), date `caption1` (12) centered | Close pill. Sender name `title2` (22), then date `body` (17) and " · Photo 2 of 6" |
| Bottom | Save to my phone, round icon (bottom left). Caption `body` (17) over a gradient | Caption `body` on solid black. Back / Save / Next pills |
| Counter | None | "Photo n of m" (m = photos you can swipe through, as today) |
| Single tap | Hides or shows all controls | Nothing (controls never hide) |
| Zoom | Pinch, double tap | Pinch, double tap, plus a Zoom in / Zoom out pill top right (DS-4) |

Gestures for both: swipe left or right with the photo following the finger; pinch and double-tap zoom (double tap zooms to where you tapped; pan while zoomed; swiping to the next photo waits until unzoomed); swipe down to close while the backdrop fades.

**Text sizes.** Standard iPhone sizes (Chase, Nov 24). Another thread is adding a named type scale; use its tokens (`headline`, `caption1`, `body`, `title3`, `title2`). Until it lands, the viewer keeps the numbers in one `VIEWER_TYPE` map in `theme.ts`, never inline. Sizes grow with the phone's text size.

**Tap targets (CLAUDE.md rule 3, DS-1).** Round icon buttons are drawn as a 44 pt circle inside a 48 pt pressable (the circle is centered; the extra 2 pt each side is the hit area, not `hitSlop`, so tests can measure it). Pills are 48 pt tall. Nothing a finger can hit is under 48 pt.

**Rule exceptions this needs (Chase's call, see Open questions).** Easy view Off breaks DS-2 (12 pt date), DS-3 (icon-only buttons), DS-4 (swipe and zoom with no button) and DS-6 (caption over a photo gradient), and CLAUDE.md rule 3 ("no gesture-only actions"). Precedent: DEC-66 icon-only tabs with Easy view Off. Easy view On keeps every rule. Once Chase confirms, add the exception to DESIGN-SYSTEM DS-2/3/4/6 and CLAUDE.md rule 3 and log a DEC.

**Kept:** HARD-8 (remember which photo, not its index), prefetch, "This was removed.", save messages and haptic, Save hidden on videos (R27), video poster, Close goes back to the same place.

**Accessibility calls (staff-pm).**
- Screen reader on: controls never hide, in either mode (a hidden button VoiceOver can still focus is worse than a visible one). The photo is adjustable: swipe up/down with VoiceOver, or the "Next photo" / "Previous photo" actions, move photos; the escape gesture closes.
- Reduce Motion: no slide. Changing photo cross-fades, swipe down fades, zoom jumps with no animation.

## Build approach

- **No system viewer.** iPhone Quick Look can't show the sender, caption or Easy view pills. It needs the decrypted photo written to disk, and it doesn't run in Expo Go or on the web. Android hands the photo to another app. All of that breaks the privacy rules and the demo.
- **A proven open-source gallery component** built on `react-native-gesture-handler` and `react-native-reanimated` (both run in Expo Go). The architect lane picks and checks it before it's added: license, upkeep, size, and web support, which the demo needs. Versions come from the vendor's pages (LESSONS), never from memory. Gesture-handler is already in the app; reanimated is a new dependency and goes through the same review.
- **Architect's pick (R113, checked Nov 24, 2026 on npm and docs.expo.dev):** `react-native-zoom-toolkit@5.1.1` (MIT, released Aug 30, 2026, ~375 KB unpacked, TypeScript only, no native code), using its `Gallery` component, with `react-native-reanimated@4.7.1` + `react-native-worklets@0.13.0`, the exact versions Expo SDK 58 bundles (`bundledNativeModules.json`; reanimated 4.7.1 peers react-native 0.86 to 0.88). Install with `npx expo install`. `Gallery` gives `renderItem` (MediaImage, VideoPoster), finger-following swipes, pinch up to `maxScale` 4, pan when zoomed, `onVerticalPull` (translateY, velocity, released) for swipe down, and `onTap`/`onIndexChange`. A scratch install with gesture-handler 3.3.0 had no peer conflicts. It uses the `Gesture.*` builder API that gesture-handler 3.3 still exports, but upstream tests on 2.28, so run a spike in Expo Go and the web e2e before the build. Rejected: `react-native-awesome-gallery@0.4.3` (last release Sep 2024; peers gesture-handler ^2 and reanimated ^3, so it clashes with SDK 58), `@likashefqet/react-native-image-zoom@4.3.0` (last release Dec 2024; zooms one image and has no pager), and building on gesture-handler + reanimated directly (about 400 lines of gesture math we'd own). **Two gaps need a staff-pm call:** (1) double tap zooms to `maxScale`, so a 4x pinch limit means a 4x double tap, not the 2x in VIEWER-4; (2) the `Gallery` ref has `setIndex`, `reset` and `getState` but no `zoom()`, so the VIEWER-11 Zoom pill can't drive it. Fixes, in order: an upstream PR (a double-tap scale prop, plus `zoom` on the Gallery ref, which `ResumableZoom` already has), or a pinned local patch, or loosen VIEWER-4/11. All MIT, which is compatible with AGPL-3.0-or-later. To undo: one dependency, used only in the viewer.
- **Pinned patch (engineer, Nov 25):** `app/patches/react-native-zoom-toolkit+5.1.1.patch`, applied by `patch-package@8.0.1` on `npm install` (`postinstall`). Three small changes to the built `lib/module` files plus the ref type: (1) `zoom(scale, point?, animate?)` on the `Gallery` ref, keeping the point where it is (VIEWER-11, and the web double-click); (2) the root-size reaction resets zoom only when the size really changed (on react-native-web it reran on every update and undid each zoom and pull); (3) a new drag clears the last pull's "released" flag. Drop the patch when upstream ships a ref `zoom()`. Babel needs nothing: `babel-preset-expo` adds the worklets plugin when `react-native-worklets` is installed.
- **Web fallbacks (engineer, Nov 25):** gesture-handler's web double tap and vertical pan don't reliably read a mouse, so on the web the viewer also listens for `dblclick` (zooms 3x at the point unless the Gallery already did) and follows the pointer for swipe down (fade and close; the photo itself doesn't follow down on the web). Phones use the Gallery's own gestures. react-native-web always reports a screen reader, so the web ignores that check.
- **Hearth's own controls sit on top**: name, date, caption, the icon buttons, Easy view pills, counter, save messages. The component only handles the photo: swiping, zooming, panning and swipe down.
- **The criteria describe behavior, not a library.** Each VIEWER-* names what a person sees or does, so it holds whichever library is picked. Where jest can't drive real gestures, keep Hearth's decisions in small pure functions (for example `viewerMotion`, `closeProgress`) or the component's callbacks. The web demo e2e drives the real gestures with the mouse. The previous and next photos are rendered so the finger can pull them in.

## Acceptance criteria

Tests live in `app/src/screens/__tests__/viewer.test.tsx` (jest) and `app/e2e-web/demo.spec.js` (demo e2e). The old viewer tests that read "Photo 1 of 3" in Easy view Off move to Easy view On or to the caption.

| ID | Given / When / Then | Type |
|---|---|---|
| VIEWER-1 | Given light or dark theme, any of the 10 themes, when the viewer opens, then the backdrop is `#000000` and the status bar text is light | auto (jest) |
| VIEWER-2 | Given a wide photo, when it opens unzoomed, then it is `contain` with no side padding: its box width equals the screen width (Easy view Off: full height too) | auto (jest style, e2e box) |
| VIEWER-3 | Given an unzoomed photo, when I drag left or right, then it follows the finger; release past a third of the width or a fast flick goes next/back, otherwise it springs back; at the first or last photo it rubber-bands and stays | auto (e2e drag; jest on the callbacks) |
| VIEWER-4 | Given an unzoomed photo, when I double-tap a point, then it zooms in centered on that point (the component's double-tap goes to `maxScale`, set to 3); double-tap again returns to fit (Nov 24: relaxed from 2x to fit the architect's pick, chief of staff default) | auto (e2e dblclick; jest on the callbacks) |
| VIEWER-5 | Given a zoomed photo, when I drag, then it pans and never changes photo; pinch goes 1x to 3x (`maxScale` 3); each photo starts unzoomed | auto (jest) + manual (phone) |
| VIEWER-6 | Given an unzoomed photo, when I drag down, then the backdrop fades with the distance; past 120 pt or a fast flick it closes (`nav.close`), otherwise springs back; zoomed, a drag down pans | auto (e2e drag; jest `closeProgress`) |
| VIEWER-7 | Given Easy view Off, when I single-tap the photo, then all controls and text hide after the double-tap window (350 ms); tap again shows them; a double tap never toggles them; the choice carries to the next photo | auto (jest, fake timers) |
| VIEWER-8 | Given Easy view Off, then Close (top left) and Save to my phone (bottom left) are round icon buttons with those spoken names, a 44 pt circle in a 48 pt target; no Back, Next, Zoom or counter text is drawn | auto (jest) |
| VIEWER-9 | Given Easy view Off, then the sender name (`headline`) and date (`caption1`) are centered at top, the caption (`body`) sits at the bottom over a gradient that is at least 60% black under the text (white text stays 4.5:1 on a white photo) | auto (jest) |
| VIEWER-10 | Given Easy view On, then Close is a pill at top; Back / Save / Next pills at the bottom, 48 pt tall, `title3` text; Back is an empty slot on the first photo and Next on the last (layout never shifts); "Photo n of m" follows the date; a single tap hides nothing | auto (jest) |
| VIEWER-11 | Given Easy view On, then a "Zoom in" pill (top right) zooms in at the center (engineer: the component's own zoom API if one exists, else a pinned patch via patch-package that architect approves; never hand-edit node_modules) and reads "Zoom out" while zoomed (DS-4) | auto (jest) |
| VIEWER-12 | Given Easy view On on a 360 pt wide screen, then every word fits on one line with no truncation and nothing overlaps | auto (e2e 360 px) |
| VIEWER-13 | HARD-8 kept: given I moved to a photo, when a new post arrives, then the same photo stays (checked by media id and caption, not the counter); on arrival the next and previous photos are prefetched | auto (jest) |
| VIEWER-14 | Given the photo was deleted, then "This was removed." shows in white on black with Close; while loading, "Loading the photo…" shows in white | auto (jest) |
| VIEWER-15 | Save keeps today's words ("Saved to your phone." / the "Allow" line) and haptic, shown on a solid backing above the bottom controls; Save is hidden on a video, and a video shows its poster (contain, black) and swipes like a photo | auto (jest) |
| VIEWER-16 | Given a screen reader is on, then controls never hide in either mode; the photo is named "Photo from Kevin, Sun, Oct 11" and its Next photo / Previous photo actions move; the escape action closes | auto (jest) |
| VIEWER-17 | Given Reduce Motion, then `viewerMotion` returns fade: no slide on a photo change, close fades, zoom has no animation | auto (jest) + manual |
| VIEWER-18 | Android back closes the viewer; on the web, arrow keys move, Escape closes, double-click zooms | auto (jest BackHandler, e2e keys) |
| VIEWER-19 | Grandparent-safe: `expectGrandparentSafe` passes in Easy view On; in Easy view Off it passes with only the named viewer exceptions (12 pt date, icon-only Close and Save) and no others | auto (jest) |
| VIEWER-21 | (Look B, Chase Nov 24) Given more than one photo, then a strip of small photos sits above the bottom buttons; the current one is wider and outlined, and the strip keeps it in view as I swipe | auto (jest + e2e) |
| VIEWER-22 | Given the strip, when I tap a small photo, then that photo opens unzoomed and the strip follows; each small photo has a spoken name ("Photo 3 of 6, from Alex") | auto (jest + e2e) |
| VIEWER-23 | Given Easy view Off, the strip hides with the other controls on a single tap and is Photos-sized (named exception to 48pt, like the icon buttons); given Easy view On, each small photo is at least 48 by 48 and never hides | auto (jest) |
| VIEWER-20 | On Chase's iPhone in Expo Go: swipe, pinch, double tap and swipe down feel like Photos with no stutter; a viewer in Easy view On opens, moves, saves and closes with no help | manual (phone) |

## Stop rule

Done when VIEWER-1..19 and 21..23 are green 3x, grandparent-ux has passed the Easy view On shots, ux-reviewer the Off shots, and VIEWER-20 passes on Chase's phone. Stop and come back to staff-pm if the architect finds no gallery component that passes review, web support included. The fallback is building on gesture-handler and reanimated directly, with VIEWER-3 as swipe-then-slide (the photo doesn't follow the finger) if that is not smooth. Not doing: a thumbnail strip (look B, unless picked), Live Photos playback, sharing out of Hearth, comments or reactions inside the viewer, auto-hiding controls on a timer.

## Open questions (Chase)

1. Look: A, B or C? Recommend A.
2. Confirm the Easy view Off exceptions to DS-2/3/4/6 and rule 3 (as DEC-66 did for tabs). Recommend yes; Easy view On keeps every rule.
3. Easy view On "Zoom in" pill (VIEWER-11): kept by default (rule 3 needs a non-gesture zoom).

## Review (grandparent-ux, Nov 26, 2026)

Shots: `/mnt/project-files/design/viewer-2026-11-24/shots/` (390 and 360 wide, light and dark, Grandma Jo and Kevin, plus zoomed, saved and tap-hidden). **Measured** on the demo web build: every Easy view On button is at least 48 high (Close 79x48, Zoom in 103x48, pills 104-114x48, strip photos 52x56, current 72x56); text is 20 (pills), 22 (name), 17 (date, caption); nothing clipped or overlapping at 360; black backdrop in light and dark. **Inferred** (not run): 200% Android text, the video Play button (the demo has no video).

**Verdict: Ready with changes, no P0.** Easy view On passes the walk: Close, Back, Save, Next and Zoom in are all words, never hide, and the strip is a bonus.

| ID | P | Finding | Fix |
|---|---|---|---|
| GUX-R1 | P1 | At 200% text the top stack (22 pt name, wrapped date) plus caption, strip and pills may leave a sliver for the photo; pills are one line (`numberOfLines={1}`), so "Zoom in" and "Next" may clip. Inferred. | Test at 200%. If the photo is under about 35% of the height, hide the strip in Easy view On when text is large (Back and Next do the same job). |
| GUX-R2 | P1 | The demo has no video, so Play was never seen. | Add one video to the demo. Check the "Play" button is 48+ and obvious at 360. |
| GUX-R3 | P2 | The Save pill says "Save" (spoken name "Save to my phone"). Longer text doesn't fit three pills at 360. | Keep "Save". The "Saved to your phone." line covers it. Use "Save" in GRANDPARENT-GUIDE. Confirm with a relative. |
| GUX-R4 | P2 | In landscape photos at 360 the Easy view photo is about 240 pt tall of 740. | Accept. Pinch or Zoom in is there. Confirm with a relative. |
| GUX-R5 | P2 | Easy view Off has only a download icon for Save. A grandparent who turns Easy view Off loses the word. | Already a named exception; add to UAT. |

Not checked: real-phone swipe feel (VIEWER-20).

## Review (ux-reviewer, Easy view Off, Nov 26, 2026)

Looked at `kevin-390-light/dark`, `kevin-360-light`, `kevin-390-light-tap-hidden` (web demo shots; no live device, no ux-rules run, so contrast and sizes are measured by eye). Score vs iPhone Photos: **6.5/10** (bar 8). Critic: "Why is my photo floating in a black box with a tiny arrow at the bottom?"

| ID | Pri | Rule | Finding | Fix |
|---|---|---|---|---|
| UX-R1 | P1 | V1, V12 | Landscape photo sits mid-screen with ~270 pt of black above and ~270 below; Photos centers it too but the strip and caption pull the eye to the bottom, so the photo does not own the screen. | Make the strip the quietest thing: 36 pt thumbs at 60% opacity except the current one; keep photo centered in the space above the strip. |
| UX-R2 | P1 | G7, V6 | Caption/scrim legibility was NOT tested: in every shot the caption sits on pure black. A tall or bright photo would put white text over snow or sky. | Shoot a portrait photo with a bright bottom edge; keep the gradient at 0 to 70% black over the lower 160 pt and add a 1 pt text shadow. |
| UX-R3 | P1 | V3, V4 | Caption, strip and Save are stacked with 8 to 10 pt gaps; the Save icon sits alone at the far left under the strip, looks forgotten. Strip bleeds to the left edge (8 pt) while caption uses 16 pt. | Gutters 16 pt for caption and strip; 16 pt between caption and strip; Save 44 pt circle on a 20% white fill so it reads as a button. |
| UX-R4 | P1 | G8, DS-1 | Strip thumbs look about 44 pt tall and 4 pt apart; under the 48 pt hit rule. | Thumbs 48 pt hit area (visual 40 pt plus padding); current photo outline 2 pt white with 2 pt black inset so it holds on a white-ish thumb. |
| UX-R5 | P2 | V4 | Close glyph (16 px) and the name block do not share a baseline (X at y 76, name at 68); X has no circle so it reads as 16 px, not 44. | Draw the 44 pt circle at 20% white fill, center on the name line. |
| UX-R6 | P2 | V6 | In light mode the pure white demo bar meets pure black with a hard seam; dark mode blends. | Demo only: dark bar over the viewer. In the app, black status bar with light content, top inset respected (confirm on device). |
| UX-R7 | P2 | G7 | Date is 12 pt, about 70% white; thin on a phone. Named exception, but contrast was not measured. | Keep 12 pt, raise to 85% white. |
