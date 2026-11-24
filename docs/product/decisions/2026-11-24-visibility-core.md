# Decision: one visibility core (registry, coverage gate, oracle), the co-parent bridge, and one Share composer
Date: Nov 24, 2026 · Status: draft, pending Chase · Spec: `docs/product/SPEC-VISIBILITY-CORE.md` (VIS-1..22, BR-1..7, SHARE-U-1..7) · Model: `docs/architecture/07-visibility-model.md` · TRACKER R77

What changes: every kind of data gets one registered reach class and rule; CI fails on any unregistered table, RPC or edge function; one oracle checks every read path (folds R51). Widening a sent post asks first; a 2-minute "Take back" holds notices; a nightly count-only check of live data. The postcard adds "Write news" and "Add a date" under "Add photos"; each is one post, one audience, To: unchanged. Fungible: a new kind is one registry call, no new rule; the core is generic (`@holroyd/visibility`). Co-parent bridge (after the beta): a two-key link between two family spaces about one child, read only by the two named parents.
Note: no co-parent persona exists (Rob retired); the spec recommends adding one before bridge B1 is built.
Over: leaving rules per feature (today; each new feature re-asks "who sees this?"); an outside authorization service (another vendor, A3); a separate "What do you want to share?" menu before the postcard (an extra step, reopens DEC-79 harder).

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Email follows the same rule; frame skips words-only posts (GUX-VC-R9) |
| LG Least-savvy grandparent | Red | Two more buttons; "Add a date" could read as dating a photo |
| AG Android grandpa | Green | Rules live on the server; identical on Android |
| SG Step or other-household grandparent | Green | Names, never group titles; bridge admits no relative without both parents' yes |
| CU Cousin | Green | News and dates reach the same people; nothing pre-picked |
| PA Posting parent | Green | One card for all kinds; held-post words and Take back; bridge is one pick |
| FA Far-away inviter | Green | Names before Send let a far-away helper check the setup |
| TR Tech reader | Green | One registry, CI coverage gate and oracle are auditable white-paper material |

Resolution: LG mitigation: the two new buttons show only to parents until the grandparent test passes; posting stays off for most grandparents (can_post); stacked rows with verb labels and helper lines ("A day to remember, like a game or a visit"), 48pt, 17pt+ (SHARE-U-1, SHARE-U-2, GUX-VC-R1).

Co-parent (advisory; the card is retired, so no table row until staff-pm restores it in PERSONA-CHECK.md): Red for B1 until the setup and yes screens are designed and a split parent pair tries them (GUX-VC-R8). Both sides see "Only you and <the other parent> can see this"; replies say "Only <author> will read this"; closing is one worded confirm. Open: does a re-share to the receiver's family tell the author (A1)?
