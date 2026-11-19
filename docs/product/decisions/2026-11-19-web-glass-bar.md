# Decision: the web demo shows a lookalike of the floating glass tab bar
Date: Nov 19, 2026 · Status: Chase's ("Yes, build a web lookalike", Nov 19) · DEC-72 · Spec: `docs/product/SPEC-REDESIGN.md` (RD-108, RD-109, DEMO-EASY-1)

What changes: on the web with Easy view Off, the tab bar floats as a blurred, see-through capsule; screens leave room under it. Easy view On keeps the fixed bar. Easy view no longer enlarges the demo's laptop panel.
Over: the fixed bar on the web.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Frame and email unchanged |
| LG Least-savvy grandparent | Green | Easy view On keeps the fixed bar with words |
| AG Android grandpa | Green | Android app unchanged |
| SG Step or other-household grandparent | Green | Easy view On by default for viewers |
| CU Cousin | Red | Icons on glass over photos are harder to see |
| PA Posting parent | Green | Demo matches the iPhone bar |
| FA Far-away inviter | Green | The demo shows both bars to explain |
| TR Tech reader | Green | Look only; no data, vendor or storage change |

Resolution: CU mitigation: the capsule is 60% opaque with a light edge and shadow, icons only (no text on glass, DS-6), and Easy view On brings back the fixed bar with words.
