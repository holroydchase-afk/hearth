# Decision: Share is two steps in every composer: the words, then "Who gets it?" on its own page
Date: Nov 26, 2026 · Status: Chase's call ("everything should be broken into flows, at most 1-2 steps. Always move who it's to to its own step"; picked look B "Say it first") · DEC-91

What changes: no underline fields and no "To:" line; one big open box plus quiet chips for the words; a 2-across face-tile page for the audience; a month-calendar sheet for the day. `docs/product/SPEC-SHARE-FLOW.md`, FLOW-1..26.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Never posts; her family's posts are unchanged |
| LG Least-savvy grandparent | Green | One question per page; big box, big buttons, nothing pre-picked |
| AG Android grandpa | Red | Calendar cells must fit 360-wide Android screens at 48 pt in Easy view |
| SG Step or other-household grandparent | Green | Nothing pre-picked and no group titles, so no wrong-audience surprise |
| CU Cousin | Green | Looks like the composers she already knows |
| PA Posting parent | Red | One more tap per post; hand-typed day replaced by a sheet |
| FA Far-away inviter | Green | Easier to talk a grandparent through one page at a time |
| TR Tech reader | Green | Same send paths, same privacy rules, no new data moves |

Resolution: AG mitigation: day cells 48 pt tall and 44+ wide at 360 and 412, checked in Easy view (FLOW-17, FLOW-23); stop if a cell clips.
Resolution: PA mitigation: Photos keep the one-button start, the quick chips Today, Tomorrow and Saturday make the day one tap, and the step is 1 tap (FLOW-7, FLOW-15, FLOW-26).
