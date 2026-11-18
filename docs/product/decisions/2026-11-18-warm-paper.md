# Decision: warm paper, soft photo shadows, a reaction pop
Date: Nov 18, 2026 · Status: Chase's ("use the warm paper, the photo shadows, pop reactions"; paper `#F1E9D2` from his tester; "Leave out the Tuesday Nov 17 above the greeting", Nov 18) · DEC-67 · Spec: `docs/product/SPEC-REDESIGN.md` (RD-84..RD-93)

What changes: light pages go from white to warm paper `#F1E9D2` (fields and capsules a shade darker), dark pages from true black to warm near-black `#14100D`, all with warm ink. Photos get a soft shadow in light mode. A reaction pops when tapped on, not with Reduce Motion. No date line above the greeting.
Over: white and true black (RD-1, RD-34); mockup A's `#FBF8F3` and date line; option B; option C's accent band and Ember month titles.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Frame and email unchanged |
| LG Least-savvy grandparent | Red | Paper lowers contrast a little against white, on an old dim phone |
| AG Android grandpa | Green | Same paper and shadows on Android; elevation 2 or less for old phones |
| SG Step or other-household grandparent | Green | Look only; who sees what is unchanged |
| CU Cousin | Green | Warmer look, quick pop feels like the apps she uses |
| PA Posting parent | Green | Photos stand out off the page; Chase picked it |
| FA Far-away inviter | Green | Same layout and words; one less "why is it so white" |
| TR Tech reader | Green | Colors and an animation; no data, vendor or storage change |

Resolution: LG mitigation: ink is 14:1 and gray words 6:1 on paper, above the 7:1 body and 4.5:1 rules (RD-86); Increase Contrast keeps its high set; RD-93 checks it on a real phone in a bright room, and the grandparent test (RD-29) runs on the paper look.
