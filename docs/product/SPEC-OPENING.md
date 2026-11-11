# Opening screen: New for you (OPEN-*)

Chase, Nov 11 2026 (DEC-58): "Go with C and all your recommendations." Picked from four sketches
(https://claude.ai/artifact/HzArt7UBv8EhsPpeNmAsyH): A photo wall, B newest posts (what Hearth did), C new for you,
D one photo at a time. C is the front door; A and D are kept as the second ways in; B stays underneath.

## What a relative sees on open
1. If photos came in since their last visit: a **New for you** card at the top of Photos. A collage of the new
   photos, the words "New since <day>, from Mom and Dad", and one filled button **See the new photos**.
2. Under it, the posts as before (newest first), so nothing built is lost.
3. Nothing new: no card. Photos opens on the newest post, as before.

## Criteria
| ID | Criterion |
|---|---|
| OPEN-1 | Photos shows the New for you card above the posts when at least one post from someone else arrived after this person's last visit. Their own posts never count as new. |
| OPEN-2 | The card says "New since <day>" (Today, Yesterday, a weekday within 6 days, else "Nov 3") and "from <names>" (andList of the senders). No numbers, no badges, no "unread" (A1, A2). |
| OPEN-3 | The card's collage uses the existing collage shape over the new photos (one big and three, the last "+N"). Every tile opens the photo full screen, like a post's collage. |
| OPEN-4 | The card has exactly one filled button, "See the new photos" (DS-9). |
| OPEN-5 | "Last visit" is kept on this phone only (no server change, nothing new leaves the phone): read once when Photos first loads, then set to now. Opening the app again later only shows what came after. First ever open: no card. |
| OPEN-6 | Nothing new: no card, and Photos looks exactly as it did before. |
| OPEN-7 | See the new photos opens **one post at a time** (D): the full post card (sender, day, words, who can see, Hooray, comments), "1 of 4" in words, a Back button and a filled Next button, both 48 pt with words. On the last one, Next reads "Done" and returns to Photos. A "Back to Photos" button is always there (DS-4, no swipe needed). |
| OPEN-8 | The one-at-a-time view shows new posts oldest first, so the story reads in order. |
| OPEN-9 | Photos' toolbar gains **Wall** (an icon with the word under it), shown when there are posts. It opens the photo wall (A): photos in three columns under month headers ("November 2026"), newest first. |
| OPEN-10 | Every wall tile is at least 48 pt and opens that photo full screen; its spoken label names the sender and day (so who sent it is never lost). The wall has "Back to Photos" and "Show older photos" buttons; no gesture-only action. |
| OPEN-11 | Words: group never appears on these screens; no group names (DEC-49). Text 17 pt and up. |

## Out of scope
- A server-side "last seen" (would sync across phones; adds a table and an A4 doc update). Later, if relatives use two phones.
- A greeting line ("Good evening, Gammy"); the sketch had it, the title stays "Photos of <family>".
- Notification counts or badges.

## Build notes
- Last visit: a KV key per user next to prefs (`hearth.lastSeen.v1.<user>`), ISO time.
- New = feed posts with `created_at > lastSeen` and `author_id !== me`, not "from earlier" (BETA-TIME-1 cards stay as they are).
- Reuse `collageShape`/`PhotoCollage`, `PostCard`, the viewer (`nav.openViewer`), `andList`, and the in-place screen pattern in `PhotosScreen` (like Messages and Search).
