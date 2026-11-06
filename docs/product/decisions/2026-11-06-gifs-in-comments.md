# Decision: picture replies and a GIF shelf in comments
Date: Nov 6, 2026 · Status: Chase picked "Picture reply + GIF shelf" on the decision card · DEC-53

Chase, Nov 5: "support memes and gifs in the comments... essentially slack meets instagram." Plan doc: https://claude.ai/artifact/N3wzTESDf3LXhhRYnBdgUi

What changes (after the Nov 22 beta; not in BETA-SPEC yet):
- **GIF-1 Picture reply:** a comment can carry one picture or GIF from the person's own phone (a saved meme counts), through the same media path as photos: location stripped on the phone, encrypted, US storage.
- **GIF-2 Hearth shelf:** about 40 to 60 family-friendly reaction GIFs bundled in the app (openly licensed or self-made), a grid of big tiles with a word under each. Nothing leaves the phone to pick one.
- **GIF-3 Readers follow the reply rule:** a comment picture's key is signed only for the people `reply_ok` lets read that comment, never the whole post audience (`sign-media` change, failing test first, privacy-security review).
- **GIF-4 Calm motion:** a GIF plays once then shows Play; it stays still under Reduce Motion; notices say "replied with a picture".
- Over: GIPHY search now (it sees searches and every view, needs its analytics calls; Tenor's API closed June 30, 2026); parking it until after the beta. Not AI, so it is on the free base app (DEC-37).

| Persona | Green/Red | Why |
|---|---|---|
| PA Posting parent | Green | Replies feel alive, like the chat apps she already uses |
| FA Far-away inviter | Green | Nothing to set up; it works once relatives can comment |
| LG Least-savvy grandparent | Green | One worded button and big labeled tiles; no typing a search |
| AG Android grandpa | Green | Shelf ships as small video files that play on old Androids |
| SG Step or other-household grandparent | Green | Pictures follow the same reply rule as words |
| GG Great-grandparent who won't install | Green | Pictures show still with words on the web view |
| CU Cousin | Red | No GIF search; the shelf is small next to GIPHY |
| TR Tech reader | Green | No third-party GIF service; keys follow the reply rule |

Resolution: CU mitigation: the shelf grows by request and saved memes from her phone work; search stays a later, opt-in idea after a privacy review of GIPHY's terms.
