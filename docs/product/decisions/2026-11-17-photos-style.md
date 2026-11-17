# Decision: Apple Photos months, a "Search photos" field, Instagram-style posts
Date: Nov 17, 2026 · Status: Chase's picks on the Nov 17 mockup ("A - 1", "B3", "C1 - 5 photos seems like a lot.. 1 large, 2 small, 1 small or 1 small with the +x", "Search- B but hide the months vs all toggle for now") · DEC-65 · Spec: `docs/product/SPEC-REDESIGN.md` (RD-44..RD-55)

What changes: Gallery becomes a months mosaic (a wide photo per day group, then rounded squares, day number on the photo, no sender lines). Search is a "Search photos" field under the greeting; By date and the top-right buttons go; the Months / All photos switch stays hidden. Feed posts read face and name, photos, reactions with counts, description, "3 hours ago", who can see it, comments; 32 pt of space instead of lines; at most 4 photo tiles with "+N"; a small "⋯" replaces "Options"; no Bold.
Over: the edge-to-edge square grid (RD-39), Search and By date top right (RD-13), hairline dividers (RD-34), separate count chips (REACT-11), "Sun, Nov 15" dates, the "Options" word.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Frame and email unchanged |
| LG Least-savvy grandparent | Red | The "⋯" has no word under it |
| AG Android grandpa | Green | Same layout and words on Android; no gesture needed |
| SG Step or other-household grandparent | Green | Who-can-see line stays on every post |
| CU Cousin | Green | Looks like Apple Photos and Instagram, apps she knows |
| PA Posting parent | Green | Edit and Delete still one tap away under "⋯" |
| FA Far-away inviter | Green | "Type in the box that says Search photos" is one sentence |
| TR Tech reader | Green | No data change; relative times computed on the phone |

Resolution: LG mitigation: "⋯" is spoken "Post options", 48 pt; it holds only rare actions (Edit, Delete); reacting and commenting stay in sight. Easy view (words under icons) is the next ask (mockup section 2).
