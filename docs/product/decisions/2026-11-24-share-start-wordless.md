# Decision: Share start goes wordless (A Quiet postcard, DEC-79 round 3)
Date: Nov 24, 2026 · Status: proposed (pending Chase's pick on the decision card, A recommended) · Source: Chase, Nov 24: "It doesn't look good. let the [design] do everything don't have the explainer text and instructions." · DEC-79 · Spec: `docs/product/SPEC-REDESIGN.md` 1j-2 (SHARE-ST-19..27)

What changes: the empty postcard drops its words: no subline, no "Up to N" line, no "To: you pick after your photos", names or faces, no "Add photos first..." hint, no "Last shared" line. A tinted photo spot with a 76 px circle and "Add photos", the stamp inside the spot, two ruled lines and "To:" with a ruled line; the whole card is one tap target. After photos, unchanged.
Over: B just the photo spot; C postcard plus Write news and Add a date; keeping B+'s words.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Frame and email copies unchanged |
| LG Least-savvy grandparent | Red | Less guidance: no limit or "pick who sees it" words before photos |
| AG Android grandpa | Green | Same card; whole card is one big target; picker honors 10 |
| SG Step or other-household grandparent | Green | No names or audience shown before photos; fewer names exposed |
| CU Cousin | Green | One obvious target; the picker shows the limit |
| PA Posting parent | Green | Cleaner start; 100 and bulk review unchanged |
| FA Far-away inviter | Green | "Tap the card" is one phone instruction |
| TR Tech reader | Green | No new permission or data; EXIF still stripped on device |

Resolution: LG mitigation: posting stays off for most grandparents (can_post); the whole card is one tap target with no dead taps (SHARE-ST-24); the spoken label keeps "Add photos, up to N at a time" (SHARE-ST-21); "Add photos" stays as words on the target; HARD-2's notice still explains a cut; SHARE-ST-9 checks a first-time tester starts without help in under 10 s.
