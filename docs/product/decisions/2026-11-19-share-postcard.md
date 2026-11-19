# Decision: Share is a postcard; photo, note and "To:" face tiles in one card, nothing pre-picked
Date: Nov 19, 2026 · Status: Chase's ("This all looks great to me. proceed with the build", 00:27 ET; direction B Postcard; no autoselect of the audience) · DEC-72 · Spec: `docs/product/SPEC-REDESIGN.md` 1j (SHARE-PC-1..14)

What changes: after the photo picker, one "New post" card: big photo with "1 of N" and thumbnails, one "Add a note (optional)" field, then To: face tiles inside the card. Nothing is picked at the start; the button says "Pick who gets it" until it says "Send to <names>". Parents see group names, others see people's names only. After Send, Feed with "Shared with <names>." New posts have no title.
Over: A One page; C One question at a time; Title plus "What's happening?"; the last audience pre-ticked.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Frame and email copies unchanged; only the sender's screen changes |
| LG Least-savvy grandparent | Red | A new picker of faces on their screen if they ever post |
| AG Android grandpa | Green | Same card, tiles and words on Android |
| SG Step or other-household grandparent | Green | Names only, never the other household's group title; nothing pre-picked |
| CU Cousin | Green | Names on the To: line show exactly who gets it |
| PA Posting parent | Green | Faces and "Send to Mom and Gammy" remove doubt; one tap more, no stale pick |
| FA Far-away inviter | Green | "Tap the faces, then Send to" reads aloud; words on every tile |
| TR Tech reader | Green | No data, storage or vendor change; title column simply unused |

Resolution: LG mitigation: posting stays off for most grandparents (can_post); where on, tiles have words, 2 across in Easy view, and the button says what to do (SHARE-PC-5, SHARE-PC-10, SHARE-PC-14).
