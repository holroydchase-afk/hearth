# Decision: the glass tab bar shrinks on scroll (Easy view Off)
Date: Nov 19, 2026 · Status: Chase's ("I also want the full iOS glass oval interaction on scroll", Nov 19) · DEC-75 · Spec: `docs/product/SPEC-REDESIGN.md` (RD-110)

What changes: with Easy view Off, scrolling down shrinks the tab bar to a small glass oval with only the current tab; scrolling up, the top, or a tap brings it back. iPhone and the web demo. Easy view On and Android unchanged.
Over: a bar that never shrinks for anyone.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Frame and email unchanged |
| LG Least-savvy grandparent | Green | Easy view On keeps the fixed bar with words |
| AG Android grandpa | Green | Android bar never shrinks |
| SG Step or other-household grandparent | Green | Easy view On by default for viewers |
| CU Cousin | Red | Other tabs hide while scrolling; she may not know to scroll up |
| PA Posting parent | Green | Same as Apple's own apps; more room for photos |
| FA Far-away inviter | Green | Relatives on Easy view never see it shrink |
| TR Tech reader | Green | Look only; no data, vendor or storage change |

Resolution: CU mitigation: the shrunk oval stays visible with the current tab, a tap on it brings every tab back (spoken "show all tabs"), and Easy view On in More turns shrinking off.
