# Decision: every post names who can see it; only parents see group names
Date: Nov 4, 2026 · Status: Chase asked ("I don't really want anyone to know they are in a group… do not have the title of the group visible to anyone but the parents/admins") · DEC-49

Relatives already never saw a group's name (the card said nothing, More said "Shared with you"), but they also couldn't tell who else sees a photo. Chase wants a steady, quiet answer to "who's in this with me" without the group's title, because "Grandparents – Dad's side" is off-putting to the grandparent it describes.

What changes:
- **WHO-6:** under the date on every card, for everyone but the sender: "You, Alex, Chase and Grandpa Earl can see this". You first, then names A to Z; past three other names the rest are counted ("and 2 others"), so it stays one line.
- **WHO-7:** More lists every name in the same words.
- **WHO-8:** the sender still sees "Sent to Grandparents – Dad's side"; another parent sees the names.
- **WHO-1..5 (server, migration 0022):** `post_viewers` returns exactly the people the privacy rule lets see the post, names and ids only, never a group's name; a post you can't see is left out; signed-out callers can't use it.
- Over: a banner or a pop-up (one more thing to dismiss), and showing group names to everyone.

| Persona | Green/Red | Why |
|---|---|---|
| PA Posting parent | Green | Keeps "Sent to" with the group's name; relatives see people, not his filing system |
| FA Far-away inviter | Green | Can tell a relative "it says who can see it right under the date" |
| LG Least-savvy grandparent | Green | Plain words, no tap needed, no label on her like "Dad's side" |
| AG Android grandpa | Green | Same line on Android, no gesture |
| SG Step or other-household grandparent | Green | Never learns which "side" a group is named for; sees only the people |
| GG Great-grandparent who won't install | Green | The web view shows the same line |
| CU Cousin | Green | Knows who else sees the photo before writing back |
| TR Tech reader | Green | The list comes from the post's own `sees_post` rule, tested to match exactly |
