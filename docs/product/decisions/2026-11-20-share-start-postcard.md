# Decision: Share opens on an empty postcard with one "Add photos" target
Date: Nov 20, 2026 · Status: Chase's (decision card "Which Share start screen should replace today's?" → "B Empty postcard", 9:19 PM ET) · DEC-79 · Spec: `docs/product/SPEC-REDESIGN.md` 1j-2 (SHARE-ST-1..9)

What changes: the Share tab opens on the DEC-73 postcard, empty: "New post", "For your family, nobody else.", one big "Add photos" target in the photo spot ("Up to 100 at a time" for parents, "Up to 10" for others), note and To: faded below. "Pick lots of photos" goes; a parent's pick over 10 goes to bulk review; others stay at 10 with HARD-2's notice.
Over: A straight to the phone's picker; C recent photos on the page (full library access, A1); today's page of words and two links.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Frame and email copies unchanged |
| LG Least-savvy grandparent | Red | A new start screen if they ever post; faded parts could look tappable |
| AG Android grandpa | Green | Same card and words; Android's picker honors the 10 limit |
| SG Step or other-household grandparent | Green | No audience shown or picked before photos; names-only rule unchanged |
| CU Cousin | Green | One obvious target, "Up to 10" says the limit up front |
| PA Posting parent | Green | One way in for 3 photos or 80; no choosing before seeing a photo |
| FA Far-away inviter | Green | "Tap Add photos" is one phone instruction, words on the target |
| TR Tech reader | Green | No new permission (no full-library access); EXIF still stripped on device |

Resolution: LG mitigation: posting stays off for most grandparents (can_post); where on, one big worded target, faded parts not tappable or read aloud, and "To: pick after your photos" says when (SHARE-ST-2, SHARE-ST-3, SHARE-ST-9).
