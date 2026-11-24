# Spec: stock photos and parent "Kevin" in the public demo (DEMO-PHOTO-4..18)

Date: Nov 24, 2026 · Status: Chase's call ("go", Nov 23-24) · DEC-82 · TRACKER R79
Amends DEC-62 (Chase's own photos) and DEC-64 (demo parent "Chase").

## Why
The public no-login demo shows Chase's own family photos (DEC-62). They come off main and are replaced with free Pexels stock photos. The parent in the stock photos is a model, so the signed-in demo parent becomes "Kevin"; a visitor must never read the model as Chase. No git history rewrite: the old files leave main only.

## Who and what proves it
A recruiter or relative opens chaseholroyd.com/hearth/ and sees a believable family across three seasons, Grandma Jo's view hides Mom's side, and New for you shows the bike ride. Signal: every DEMO-PHOTO criterion below passes in CI and on the live site check, and a fresh plus a returning browser both show the new set.

## Source and family
- Files: `/mnt/project-files/design/demo-photos-2026-11-23/` (cleaned, 2000px, no metadata) and its `CREDITS.md`. orchard-* and baking-* by Elly Fairytale; bike-* by Yan Krukov; number = Pexels photo id. Only the 19 below ship.
- Picture names in the app keep the file stem, for example `orchard-4543640`.
- Family: Kevin (parent, the visitor, owner) and Alex (mom); Grandma Jo is Kevin's mom (Dad's side); Nana Ruth (Mom's side) and Grandpa Earl stay as today. No surname. "Chase" never appears as a demo person.

## Posts (oldest first, 19 photos)
| # | From | To | Days ago | Title / caption | Pictures |
|---|---|---|---|---|---|
| 1 | Alex | Everyone | 190 | "Apple blossoms at the orchard" | orchard-4543640, 4543633, 4543718, 4543714, 4543720, 4543719 |
| 2 | Kevin | Dad's side | 190 | "Shoulder rides all afternoon" | orchard-4543671, 4543672, 4543642 |
| 3 | Alex | Mom's side | 190 | caption only (mom and the kids at the orchard) | orchard-4543661 |
| 4 | Kevin | Dad's side | 40 | "Pancake morning" / "Aunt Bea taught the kids to make pancakes" | baking-3807194, 3807115, 3806951, 3807313 |
| 5 | Kevin | Everyone | 40 | caption only (tea and pancakes) | baking-3807394 |
| 6 | Alex | Everyone | ≤ 2.5 | "First ride on the balance bike" | bike-6209917, 6209856, 6209923 |
| 7 | Kevin | Dad's side | ≤ 2.5 | caption only (a ride through the leaves) | bike-6209901 |

Captions for rows 3, 5 and 7, plus hearts and replies, are the engineer's to write in the demo's voice; grandparent-ux checks the words. Same-day posts keep this order by a small offset (for example 190.0, 189.9, 189.8).

## Acceptance criteria
| ID | Given / When / Then | Type |
|---|---|---|
| DEMO-PHOTO-4 | Given the web export, when `public/demo-pictures/` is listed, then it holds exactly the 19 names above, each as `<name>.jpg` and `<name>-thumb.jpg`, and none of beach, dunes, museum, playground, porch, bike, splash, bridge, overlook, hug. | auto (Jest) |
| DEMO-PHOTO-5 | Given each of the 38 files, when its JPEG markers are read, then there is no APP1 (EXIF or XMP), APP2 (ICC is fine to drop) or APP13 segment, and no GPS tag anywhere. | auto (Jest) |
| DEMO-PHOTO-6 | Given each display file, when its size is read, then the long side is 1200px (±1) and the thumb's long side is 400px (±1), at the same aspect ratio (±1%). | auto (Jest) |
| DEMO-PHOTO-7 | Given `DEMO_PICTURE_SIZES`, when compared with each display file's real width and height, then every entry matches and there is one entry per shipped picture, no more. | auto (Jest) |
| DEMO-PHOTO-8 | Given `DEMO_POSTS`, then it has 7 posts in the table's order with the table's sender, group, picture list and day bucket (190 ±2, 40 ±2, ≤ 2.5), 19 pictures total, each picture used once. | auto (Jest) |
| DEMO-PHOTO-9 | Given `DEMO_NAMES`, then the parent's name is "Kevin", and no demo name, caption, reply, date label (CAL-19 anniversary reads "Kevin and Alex") or demo bar text contains "Chase". | auto (Jest) |
| DEMO-PHOTO-10 | Given the demo open as the parent, when Gallery, Feed, More, Birthdays and the demo bar are shown, then "Good morning/afternoon/evening, Kevin" and "You're Kevin, a parent." appear and the text "Chase" appears nowhere on the page. | auto (Playwright, e2e:demo) |
| DEMO-PHOTO-11 | Given the demo, when "See it as Grandma Jo" is tapped, then Gallery and Feed show posts 1, 2, 4, 5, 6 and 7 (18 photos) and never post 3 or orchard-4543661; the way back reads "Back to Kevin's view". | auto (Playwright) |
| DEMO-PHOTO-12 | Given a fresh visit (pretend last visit 3 days ago, DEMO-NEW-1), when Gallery opens, then New for you shows Alex's balance bike post first, with its 3 photos. | auto (Playwright) |
| DEMO-PHOTO-13 | Given a browser that saved the Nov 16 demo family (old seed version, old photo bytes in IndexedDB), when the new build loads, then the old family and bytes are cleared and the new 19 photos show without Start over (DEMO-FRESH-1..3; `demoSeedVersion` changes). | auto (Jest + Playwright) |
| DEMO-PHOTO-14 | Given the repo, then `app/public/demo-pictures/CREDITS.md` names Pexels, both photographers, the file prefixes they took, and the Pexels license line; the demo's Details/About text and README each carry one line: "Sample photos: Pexels (Elly Fairytale, Yan Krukov)". | auto (Jest: file and text present) |
| DEMO-PHOTO-15 | Given the repo at main, then no file under `app/`, `docs/portfolio/screens/` or `app/public/` contains one of the Nov 16 photos or a screenshot of them (README screens and `og-hearth.png` retaken from the new demo). | manual (reviewer looks at each image) |
| DEMO-PHOTO-16 | Given the live site after publish, when `demo-site.yml`'s after-publish check runs, then DEMO-PHOTO-10..12 pass on chaseholroyd.com/hearth/. | auto (CI live check) |
| DEMO-PHOTO-17 | Given a phone browser (iPhone Safari, one Android Chrome), when the demo opens fresh and after a prior visit, then the new photos load at their own shape and Grandma Jo's view hides Mom's side. | manual (real phone) |
| DEMO-PHOTO-18 | Given README, CASE-STUDY and code comments, then none says the demo photos are "the founder's own" or "Chase's own". | auto (grep in Jest) |

DEMO-PHOTO-1..3 (DEC-62) are retired by DEMO-PHOTO-4..7; `realPhotos.test.ts` is rewritten, not added to. DEMO-3's "no surname" stands.

## Demo words (GUX-DP, grandparent-ux review, Nov 24)
Each reply sounds like a real grandparent and says what the photo shows; each caption reads as a moment.
| ID | Given / When / Then | Type |
|---|---|---|
| GUX-DP-AC1 | Given post 6, then Nana Ruth's reply is "Look at that little yellow coat go!" and no demo reply contains "smile". | auto (Jest) |
| GUX-DP-AC2 | Given post 7, then its caption is "A ride under the big yellow tree", Grandma Jo's reply is "That's a lot of leaves!", and no caption contains "leaf pile". | auto (Jest) |
| GUX-DP-AC3 | Given post 3, then Nana Ruth's reply is "Three of my favorite faces." | auto (Jest) |
| GUX-DP-AC4 | Given post 2, then Grandma Jo's reply is "Your dad used to carry you just like that." | auto (Jest) |
| GUX-DP-AC5 | Given posts 1 and 5, then their captions are "Everything was in bloom, and the kids ran the whole time." and "Then we all sat down for tea and pancakes." | auto (Jest) |
| GUX-DP-AC6 | Given the seeded demo, then every caption, title and reply is 60 characters or less and none says "Chase" or "circle"; and Grandma Jo's view in the demo bar reads "You're Grandma Jo, Kevin's mom." | auto (Jest) |

## Not doing
- Git history rewrite for the old photos (Chase's call).
- Using the other 22 cleaned photos in the folder (19 is enough; more is wider, not deeper).
- Faces or people tagging, location display, Live Photos in the demo.

## Docs that name "Chase" as the demo parent or his photos (change in the same PR)
- `app/src/demo/seed.ts` (DEMO_NAMES, comments, anniversary "Chase and Alex"), `DemoBar.tsx` (lines 121-125), `pictures.ts` comment.
- Tests: `app/src/demo/__tests__/seed.test.ts`, `realPhotos.test.ts`, `demoBar.test.tsx`, `calendarDemo.test.ts`; `app/e2e-web/demo.spec.js` (UX-R12), `demo-calendar.spec.js` (CAL-19, line 71). `core-loop.spec.js` is the Fake API core loop, not the demo: leave it.
- `docs/product/SPEC-REDESIGN.md` RD-27 and RD-43; `docs/product/decisions/2026-11-17-demo-parent-is-chase.md` (add "Superseded by DEC-82").
- `README.md` line 15 and its screenshots; `docs/portfolio/screens/*` and `app/public/og-hearth.png` (retake).
- `docs/reviews/2026-11-19-tech-debt/sec.md` line 19 (mark resolved).
- Outside the repo: `/mnt/project-files/demo/DEMO-SCRIPT.md` still says parent "Kai" and "drawn pictures" (lines 4, 18, 30); change to Kevin and stock photos.

## Calls made
1. "Aunt Bea", not "Aunt Mia": Mia is already a demo kid (`DEMO_DATES` has "Mia's birthday"). Default taken, no question for Chase.
