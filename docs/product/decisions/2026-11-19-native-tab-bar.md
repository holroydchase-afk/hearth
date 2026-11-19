# Decision: iPhone's own tab bar with Easy view Off, Hearth's fixed bar with Easy view On
Date: Nov 19, 2026 · Status: Chase's ("That's the route I want", "But maybe the fixed bar for grandparents", "Build them now", Nov 19) · DEC-70 · Spec: `docs/product/SPEC-REDESIGN.md` (RD-106, RD-107)

What changes: on iPhone with Easy view Off, the tabs are the phone's own bar (glass on iOS 26, classic before), icons only with spoken names. Easy view On keeps Hearth's fixed bar with words. Android and the web unchanged.
Over: Hearth's bar everywhere on iPhone; a custom glass capsule; a bar that shrinks on scroll.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Frame and email unchanged |
| LG Least-savvy grandparent | Green | Easy view On keeps the fixed bar with words |
| AG Android grandpa | Green | Android bar unchanged |
| SG Step or other-household grandparent | Green | Easy view On by default for viewers |
| CU Cousin | Red | Easy view Off gets icons on glass; harder to read over photos |
| PA Posting parent | Green | Same bar as Apple's own apps and Instagram |
| FA Far-away inviter | Green | Relatives on Easy view see the bar the guide shows |
| TR Tech reader | Green | Look only; no data, vendor or storage change |

Resolution: CU mitigation: the system bar keeps icons legible over content on its own, never shrinks (DS-5), and Easy view On in More brings back the fixed bar with words.
