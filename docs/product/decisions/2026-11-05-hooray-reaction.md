# Decision: add 🎉 Hooray as a fourth reaction
Date: Nov 5, 2026 · Status: Chase asked ("add", answering whether 🎉 joins ❤️ 😂 👍 or replaces one) · DEC-51

What changes:
- **REACT-12:** a fourth button, 🎉, read aloud as "Hooray", after Like. Same rules as the others: one reaction per person per post, tap again to take it back, counts follow the reply rules. Migration 0023 widens `set_reaction` and the table check (HARD-12).
- Over: replacing ❤️ (hearts are the oldest reaction, and old apps still send them); a full emoji picker (wide, not deep; GIFs and pictures are their own thread).

| Persona | Green/Red | Why |
|---|---|---|
| PA Posting parent | Green | Birthdays and firsts get a cheer, not just a heart |
| FA Far-away inviter | Green | Nothing new to explain; same row of buttons |
| LG Least-savvy grandparent | Green | One more big button with her keyboard's emoji |
| AG Android grandpa | Green | Same button on Android |
| SG Step or other-household grandparent | Green | Same rules as hearts; nothing new is shared |
| GG Great-grandparent who won't install | Green | Shows on the web view too |
| CU Cousin | Green | Feels like a chat app |
| TR Tech reader | Green | Still a closed list checked by the server and the table |
