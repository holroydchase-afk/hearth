# Hearth UX tech-debt review (2026-11-19)

Goal: "is there tech debt or odd choices that fail a seasoned reviewer's sniff test" (UX seat). Build reviewed: origin/main @ eceac67, web demo exported locally (EXPO_PUBLIC_HEARTH_DEMO=1) and opened in Playwright at 390x844 and 1280x800, light only. Not checked: dark mode, native iPhone/Android, 200% text on device. Out of scope: Share screen, web tab bar / Easy view sizing (PR 125). Respected DEC-59..71 look calls.

## Verdict: Needs changes, visual 7/10 (bar 8)
- Grandma Jo (least savvy): core screens pass rule 3 in code (every fontSize >= 17, every Pressable labeled, 48 pt mins via MIN_TARGET); she gets tripped by a "For testing" card and duplicated settings next to Sign out on Help.
- Recruiter on a 1280x800 laptop: the story panel is cut top and bottom and can't scroll; the "family is made up" line is the part cut.
- Critic's line: "Why does the Help page have a sign-out button and a test report on it? Did your nephew leave his tools out?"

## Clean (checked, no finding)
- Dead screens: none. EventsScreen, MessagesScreen (More rows), TimelineScreen and SearchScreen (Gallery, PhotosScreen.tsx:97,107), StartFamily (AppGate) are all reachable. /photos, /me, /groups are deliberate redirects.
- "circle" in UI strings: none found (code identifiers only).
- Text size: every literal fontSize is 17+ (PostCard.tsx:519-520, PhotoCollage.tsx:108, TabBar.tsx:47); Txt/Button use t.base.
- Pressables: 24; all have role and label except ViewerScreen.tsx:167 (photo tap, accessible={false}, buttons cover it: fine) and DemoBar (uses web role/aria-label: fine).
- ux-rules.mjs: G9 "0 h1" on gallery/feed/more was a timing false negative; my DOM probe found the h1s (see R15).

## Findings
| ID | Pri | Where | Problem | Fix | Effort |
|---|---|---|---|---|---|
| TD-UX-R1 | P0 | app/src/demo/DemoFrame.tsx:58-59; shots/gallery-l.png | At 1280x800 the story panel is vertically centered with no scroll: the eyebrow "Hearth (working name) · demo" is cut at the top and "Built test-first... The family here is made up and stays in this browser." at the bottom; mouse wheel does nothing. The sample-data honesty line is the part a recruiter can't see. | Panel becomes a ScrollView (`contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 24 }}`), or trim gap 16 -> 12 and move the footer line under the h1. AC: at 1280x800 and 1280x720, eyebrow top >= 16 px and footer bottom <= viewport height, or the panel scrolls. | S |
| TD-UX-R2 | P1 | app/src/screens/MeScreen.tsx:56; NoticeTiming.tsx:20-22 | "Notice timing ... For testing" card shows to every real relative in Me (only the demo hides it). ProblemDetailsCard is gated by debugEnabled(); NoticeTiming isn't. A1 anxiety, dev tool leak. | `if (!debugEnabled()) return null;` at the top of NoticeTiming, same as ProblemDetails.tsx:42. | S |
| TD-UX-R3 | P1 | app/src/screens/HelpScreen.tsx:38-40 | Help always says "You can look at photos and write back.", also to the owner and adults who can post; Me (MeScreen.tsx:43) words it by can_post. Wrong statement to parents. | Delete the block from Help (Me already says it). | S |
| TD-UX-R4 | P1 | HelpScreen.tsx:34-42; MeScreen.tsx:44-58 | Same settings in 2-3 places: HowToTell, Privacy, SignOut, DeleteAccount in both Help and Me; Easy view and Light or dark are More rows AND in Me (G12). Help, where a confused grandparent goes, ends with "Sign out of Hearth" and "Take me off Hearth". | Help = "Need help?" + "Keeping your photos private" + Problem details (debug). Me keeps HowToTell, ReplyAudience, PhotoHelpers, SignOut, DeleteAccount. Drop EasyView/LightOrDark from Me (More owns them). Grandparent-ux to confirm. | M |
| TD-UX-R5 | P1 | HelpScreen.tsx:41-42 | Demo leak the other way: Me hides SignOut/DeleteAccount in DEMO_MODE (DEMO-8), Help doesn't. As Grandma Jo a visitor sees "Take me off Hearth"; Sign out drops a recruiter on a sign-in screen they can't pass. Verified in code. | Wrap both in `{DEMO_MODE ? null : ...}` (or fixed by R4). | S |
| TD-UX-R6 | P1 | app/src/ui/kit.tsx:336-355 (Confirm) vs :357 (AlertDialog); Preferences.tsx:198,230 | Two confirm dialogs. Confirm stacks a filled red "Yes, sign out" ABOVE the safe choice: destructive as the primary (G2), and unlike Delete post's AlertDialog (safe choice Semibold, RD-67). | Sign out and Take me off Hearth use AlertDialog (keep "Stay signed in" / destroy "Sign out"; keep "Stay on Hearth" / destroy "Take me off"); delete Confirm. | S |
| TD-UX-R7 | P2 | Preferences.tsx:201; MeScreen.tsx:29 | Sign-out body "you'll need a new code from your email" is wrong for text sign-in (TextCodeFlow); "Signed in as " renders blank when session has no email. | Body: "To come back, you'll need a new code. We'll send it to you." Me: `Signed in as ${email ?? phone}`. | S |
| TD-UX-R8 | P2 | MessagesScreen.tsx:48-53; EventsScreen.tsx:72-76 | List rows are Card + title + a secondary "Open" button, while More uses whole-row MenuRow; every visible button reads "Open" (a third row pattern). | Whole-row Pressable like MenuRow: title (17 Semibold), muted subline ("4 people"), chevron; spoken label keeps chatOpenLabel(). | M |
| TD-UX-R9 | P2 | MessagesScreen.tsx:47; EventsScreen.tsx:84 | Empty states name no next step: "No chats yet.", "No events yet." (G6). | Viewer: "When your family starts an event, it shows up here." Parent: "No events yet. To start one, make a group in Groups and check This group is for an event." Chats: "No chats yet. A chat opens with each group you share photos with." (staff-pm confirm the rule). | S |
| TD-UX-R10 | P2 | MessagesScreen.tsx:125,129 (POLL_MS :18) | "Check for new messages" button although it polls every 10 s; Send is secondary, so the chat has no primary action (G1). Default `backTo = 'Gallery'` (:24) is stale since RD-15. | Remove the refresh button; Send `variant="primary"`; default backTo "More". | S |
| TD-UX-R11 | P2 | MessagesScreen.tsx:44,115 | The 3-sentence privacy paragraph repeats on the list and on every chat (G12). | Keep it on the list; chat shows one muted line "Only the people in this chat can read it." | S |
| TD-UX-R12 | P2 | ViewerScreen.tsx:176-177 | "◀ Back" / "Next ▶" use Unicode triangles, not system icons, and "Back" means "previous photo" next to Close, while BackButton means "leave". | text "Previous" with icon chevron.backward / chevron_left, "Next" with chevron.forward; spoken labels unchanged. | S |
| TD-UX-R13 | P2 | PhotoCollage.tsx:107-108; VideoPoster.tsx:34-36; GalleryGrid.tsx:159; DemoFrame.tsx:49 | Hardcoded #1C1C1E, #FFFFFF, rgba(0,0,0,.72), #000 shadows bypass theme tokens (defensible on photos, but untracked). | Add `overlay: 'rgba(0,0,0,0.72)'` and `onOverlay: '#FFFFFF'` to Colors; use them for the +N chip and Play pill. | S |
| TD-UX-R14 | P2 | DemoBar.tsx:146,128-135; DemoFrame.tsx:44 | Demo chrome one-offs: bar row `maxHeight: MIN_TARGET` clips at 200% text; "Reset demo" is a hand-rolled outline Pressable beside a kit Button (two button looks in one stack, gallery-l.png); "Read the case study" sits ~19 px right of the panel's left edge (V4). | minHeight only; Reset demo = `<Button variant="secondary">`; cta `paddingHorizontal: 0`. | S |
| TD-UX-R15 | P2 | DemoFrame.tsx:34 (panel title) | At 1280 the page has two level-1 headings ("A private photo app for split families" and the screen's "Feed"/"More") (G9). | Panel title stays h1; app frame gets `role="region" aria-label="Hearth app"` and the app's display titles... simplest: panel title aria-level 2 inside a region labeled "About this demo". | S |

## Acceptance criteria
- AC-TD-UX-R1: Given the demo at 1280x800 and 1280x720, the eyebrow and the "family here is made up" line are fully in view or reachable by scrolling the panel. (auto, Playwright)
- AC-TD-UX-R2: Given a non-debug build, Me has no "Notice timing" heading. (auto)
- AC-TD-UX-R3/R4/R5: Help shows no "You can look at photos" line, no Sign out, no Take me off Hearth; in DEMO_MODE neither Help nor Me shows them. (auto)
- AC-TD-UX-R6: Sign out confirm renders AlertDialog; the safe button is first and Semibold; no filled danger button. (auto)
- AC-TD-UX-R9: Empty Events and Messages lists each contain a sentence naming the next step. (auto)
- AC-TD-UX-R12: Viewer buttons read "Previous" and "Next"; no ◀ ▶ characters in app/src. (auto)

```findings
verdict: Blocker
score: 7/10
TD-UX-R1 | P0 | S3/V8 | DemoFrame.tsx:58, 1280x800 | Story panel clipped, sample-data line hidden, no scroll | ScrollView panel, flexGrow center, paddingVertical 24
TD-UX-R2 | P1 | A1 | MeScreen.tsx:56 | "For testing" Notice timing card shown to relatives | Gate NoticeTiming on debugEnabled()
TD-UX-R3 | P1 | G6 | HelpScreen.tsx:38 | Help tells parents they can only look and write back | Remove the line from Help
TD-UX-R4 | P1 | G12 | HelpScreen.tsx:34; MeScreen.tsx:44 | Settings duplicated across Help, Me, More; Sign out on Help | Help = help + privacy; settings only in Me
TD-UX-R5 | P1 | S | HelpScreen.tsx:41 | Demo shows Sign out and Take me off Hearth on Help | Hide both in DEMO_MODE
TD-UX-R6 | P1 | G2 | kit.tsx:336 | Confirm makes destructive the filled top button, second dialog style | Use AlertDialog, delete Confirm
TD-UX-R7 | P2 | copy | Preferences.tsx:201 | Sign-out says code comes by email; blank Signed in as | Neutral wording; phone fallback
TD-UX-R8 | P2 | consistency | MessagesScreen.tsx:48 | Card plus Open button rows unlike MenuRow | Whole-row pressable with chevron
TD-UX-R9 | P2 | G6 | EventsScreen.tsx:84 | Empty lists name no next step | Add next-step sentence per role
TD-UX-R10 | P2 | G1 | MessagesScreen.tsx:125 | Manual refresh beside polling; Send not primary | Drop refresh; Send primary; backTo More
TD-UX-R11 | P2 | G12 | MessagesScreen.tsx:115 | Privacy paragraph repeated per chat | One short line in chats
TD-UX-R12 | P2 | V9 | ViewerScreen.tsx:176 | Unicode arrows; Back means previous photo | Previous and Next with system chevrons
TD-UX-R13 | P2 | V6 | PhotoCollage.tsx:107 | Hardcoded overlay colors bypass tokens | Add overlay and onOverlay tokens
TD-UX-R14 | P2 | V5/V4 | DemoBar.tsx:146 | maxHeight clips big text; hand-rolled Reset; cta indented | minHeight only; kit Button; paddingHorizontal 0
TD-UX-R15 | P2 | G9 | DemoFrame.tsx:34, 1280 | Two h1 on laptop demo | Panel title level 2 in labeled region
```

Evidence: local screenshots (gallery-l.png, feed-l.png, more-p.png). Measured: h1 count, no sideways scroll at 390/1280, wheel doesn't scroll the panel, fontSize literals. Inferred from code: R2-R12.
