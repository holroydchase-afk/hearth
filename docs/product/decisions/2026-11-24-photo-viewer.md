# Decision: Overhaul the full-screen photo viewer to iPhone Photos standards (look A)
Date: Nov 24, 2026 · Status: proposed · Source: Chase, Nov 24: "We need to overhaul the full screen photo viewer. It is now the worst aspect of the product." · Spec: `docs/product/SPEC-VIEWER.md` (VIEWER-1..20), TRACKER R83

What changes: black backdrop, photo fills the screen, swipe with the finger, pinch and double-tap zoom, swipe down to close. Easy view Off: round icon Close and Save, tap to hide controls, no counter. Easy view On: labelled pills, counter, controls never hide.
Over: today's pale page with five pills; one look for both modes.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Frame and email unchanged |
| LG Least-savvy grandparent | Red | Easy view On had no zoom button in look A |
| AG Android grandpa | Green | Back button closes; pills fit at 360 pt (VIEWER-12, VIEWER-18) |
| SG Step or other-household grandparent | Green | Viewer default Easy view On; who sees what unchanged |
| CU Cousin | Green | Behaves like the Photos app she already uses |
| PA Posting parent | Green | Big photo, familiar gestures, no pill clutter |
| FA Far-away inviter | Red | Their viewer has no words while Grandma's has pills |
| TR Tech reader | Green | Display only; no data stored, moved or logged differently |

Resolution: LG mitigation: Easy view On adds a "Zoom in" pill top right (VIEWER-11).
Resolution: FA mitigation: same order and spoken names on both phones; Easy view is one step (RD-78); screen reader never hides controls (VIEWER-16).
