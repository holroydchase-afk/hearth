# Decision: keep Start a family, switched off, and finish what turning it on needs
Date: Nov 19, 2026 · Status: Chase's ("We need to keep the switched off features. Start a thread for each", Nov 19 12:39Z) · DEC-74 · Spec: `docs/product/SPEC-START-FAMILY.md` section 8 (START-ON-1..7)

What changes: Start a family (DEC-55, migration 0024) stays in the repo with `start_family_open` off. Before it can go on: a way to reach Hearth from Help, a suspend-a-family script and runbook, a switch script, a browser walk and the real-server contract tests. Turning it on still needs Chase's words.
Over: parking the code until a relative asks (tech-debt review PM-R5's recommendation); deleting it.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Nothing changes for frame or email viewers |
| LG Least-savvy grandparent | Green | Code entry stays first; start button only for signed-in parents |
| AG Android grandpa | Green | Same screens on Android; nothing new until switched on |
| SG Step or other-household grandparent | Green | Joining stays invite-only; no new way into a family |
| CU Cousin | Green | No change for invited cousins |
| PA Posting parent | Green | A parent can start a family without Chase's script, later |
| FA Far-away inviter | Green | Help gains a way to reach Hearth for problems |
| TR Tech reader | Green | Switch, caps, suspend path and abuse contact documented |
