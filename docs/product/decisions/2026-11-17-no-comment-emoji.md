# Decision: No comment emoji; a standard "Add a comment…" field and Post on every post
Date: Nov 17, 2026 · Status: Chase's ("I also don't think given our UI we need a comment emoji. Use standard comment ui for the first comment", Nov 17) · DEC-63 · Spec: `docs/product/SPEC-REDESIGN.md` (RD-37, RD-38, RD-42)

What changes: the 💬 button leaves the reaction row (❤️ 😂 👍 🎉 stay, emoji only, REACT-7). Every post shows a "Comments" heading, an "Add a comment…" field (spoken "Add a comment for <sender>") and a Post text button, grey until there are words. When the same people who see the post read the comment, one line says "Your comment goes to the same people."
Over: keeping 💬 as a shortcut that focuses the box (MOMENT-4), a comment screen behind a tap, "Write something back" with a Send capsule.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Frame and email unchanged |
| LG Least-savvy grandparent | Green | The box is always there, labeled; nothing to find first |
| AG Android grandpa | Green | Same field and Post word on Android |
| SG Step or other-household grandparent | Green | Still says who reads her comment when fewer people do |
| CU Cousin | Green | Looks like every photo app's comment box |
| PA Posting parent | Green | One less icon in the row; replies unchanged |
| FA Far-away inviter | Green | "Type in Add a comment, tap Post" is easy over the phone |
| TR Tech reader | Green | No data change; reply audience rules (AUD-8) unchanged |
