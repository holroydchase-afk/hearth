# Decision: plain-word photo search before go-live
Date: Nov 10, 2026 · Status: Chase listed "Search" as go-live item 9 · DEC-56

What changes: a Search button on Photos (SEARCH-1..14, SEARCH-UI-1..8, `docs/product/SPEC-SEARCH.md`). Words match the title, caption and sender's name; "From" a person and "Taken in" a year narrow it. Only posts you can already see; no group names; no AI; nothing typed is kept.

| Persona | Green/Red | Why |
|---|---|---|
| PA Posting parent | Green | Finds "the birthday one" in seconds instead of scrolling |
| FA Far-away inviter | Green | Nothing to set up; works for every relative on day one |
| LG Least-savvy grandparent | Red | Typing is hard for her; a blank box can feel like a test |
| AG Android grandpa | Green | Worded buttons for person and year work without typing |
| SG Step or other-household grandparent | Green | Search can't reach posts outside her groups or show group names |
| GG Great-grandparent who won't install | Green | Nothing changes for her; Photos stays the same |
| CU Cousin | Green | Familiar search, fast |
| TR Tech reader | Green | Runs inside the same visibility function as the timeline; no AI, no logging |

Resolution: LG mitigation: Search is optional and tucked in the toolbar; "From" and "Taken in" are big worded buttons that search with no typing, and "Nothing found" says what to try.
