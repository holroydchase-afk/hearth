# Decision: one named type scale at iPhone's standard sizes; Share start A with standard sizes (DEC-84)
Date: Nov 24, 2026 · Status: proposed (pending Chase's OK, staff-pm recommends yes) · Source: Chase, Nov 24: "Go with A +Standard iphone sizes... If we do not have everything broken down based on the header, body, title, etc. etc. we need to do that now. Then we need to align with iphones standards." · DEC-84, DEC-79 round 4 · Spec: `docs/product/SPEC-TYPE.md` (TYPE-1..14), `SPEC-REDESIGN.md` 1j-2 round 4 (SHARE-ST-28..34)

What changes: Apple's eleven text styles by name (largeTitle 34 … caption2 11 at the default Large size; Apple's xxLarge in Easy view, raised to 17 where Apple goes under). Reading text stays Body 17. With Easy view off, a few secondary words step down: post date, Gallery date groups, "N people", reaction counts (15), Android's tab words (12). Feed and More titles grow 28 → 34; Gallery month names 24 → 22; Share "New post" 28 → 22, "Add photos" 22 → 17, circle 76 → 52. Easy view keeps everything 17+. The Event/News/Saying row stays off until its data lands, parents only.
Over: today's 17-or-bigger rule for everything (DS-2); per-platform scales; Apple's sizes without an Easy view floor.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Frame and email copies unchanged |
| LG Least-savvy grandparent | Green | Easy view on by default for viewers: everything 17+, body 21 as today |
| AG Android grandpa | Green | Easy view on by default: tab words 17 (system bar); body 21 |
| SG Step or other-household grandparent | Red | With Easy view off, post dates and counts drop to 15 |
| CU Cousin | Green | Standard iPhone sizes, like every other app on the phone |
| PA Posting parent | Green | Looks like a native iPhone app; reading text and audience words stay 17 |
| FA Far-away inviter | Green | Nothing changes in the invite flow's words or steps |
| TR Tech reader | Green | One named scale, one lint test; no data or permission change |

Resolution: SG mitigation: Easy view is on by default for every viewer (DEC-66) and one More switch away for anyone; with it on nothing is under 17 (TYPE-3). With it off, smaller styles only carry secondary words (TYPE-7), never reading text, action words or who sees a post (A1). The phone's text size still scales every style (TYPE-8, TYPE-9). TYPE-13 checks an older parent reads the 15 pt words; TYPE-14 reruns the grandparent test with Easy view on. Kind tiles are parents only and off by default (SHARE-ST-30, SHARE-ST-33).
