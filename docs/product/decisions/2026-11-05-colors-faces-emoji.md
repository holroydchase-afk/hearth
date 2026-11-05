# Decision: three colors to pick from, faces for who can see it, the phone's own emoji
Date: Nov 5, 2026 · Status: Chase asked ("I'd like all three color options"; "a contact circle component or chips for the group members in a post... a discreet icon"; "the standard not 3d emojis not line icons") · DEC-50

What changes:
- **COLOR-1..4:** Ember (default), Sage and Plum, each with a light and a dark screen, picked under "Colors" on Help or Me, right after Light or dark. Saved on the phone. Replaces the Nov 1 blue. Every pair keeps 4.5:1, body text 7:1.
- **WHO-10:** the "You, Alex, Chase and 2 others can see this" sentence under the date becomes up to three small initial circles and "+n", on the right of the row under the photo. One 48 pt button that reads every name aloud; a tap opens "Who can see this" with one name chip per person. Never the group's name. The sender gets the circles too and keeps "Sent to <group>".
- **REACT-11:** the reaction and comment buttons show the phone's own emoji again (the ones on its keyboard), and the counts are emoji chips ("❤️ 1"), like a chat app. Replaces REACT-10's line icons.
- Over: one fixed color (Chase wanted all three); the names sentence on every card (louder than Chase wanted); line icons or a custom 3D emoji set.

| Persona | Green/Red | Why |
|---|---|---|
| PA Posting parent | Green | Picks the color he likes; sees at a glance who a post reached |
| FA Far-away inviter | Green | "Tap the little circles to see who can see it" is one step to explain |
| LG Least-savvy grandparent | Green | Emoji match her keyboard; circles are a big button; nothing to choose |
| AG Android grandpa | Green | Same circles and chips on Android; his phone's own emoji |
| SG Step or other-household grandparent | Green | Sees people, never a "side" |
| GG Great-grandparent who won't install | Green | Same on the web view |
| CU Cousin | Green | Chat-style emoji chips feel familiar |
| TR Tech reader | Green | Colors are local only; names still come from `post_viewers` (0022), nothing new leaves the phone |
