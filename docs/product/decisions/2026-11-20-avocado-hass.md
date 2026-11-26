# Decision: Avocado from a Hass avocado's layers; a picked reaction is an outline, not a filled oval
Date: Nov 20, 2026 · Status: Chase's (thread "Add Paper, Avocado and Pomegranate themes": "Haas avacado", "Break down the avacado its multiple layers including the skin", "I love the light mode", dark: "It's too dark", the old accent "looks like green baby poop or mush peas", picked "Fresh leaf"; reactions: "I don't like the background on the emojis (the lighter oval)") · DEC-76 · Spec: `docs/product/SPEC-REDESIGN.md` 1k (RD-111..RD-118) · Tester: saved `/mnt/project-files/design/avocado-hass-tester-2026-11-20.html`

What changes: (1) Avocado's colors come from the fruit. Light: page `#F6F5E4` (inner flesh), fill `#E7ECC6` (middle flesh), ink `#1F1A1B` (ripe skin), muted `#4F4A42`, accent `#2F5419` (the green just under the skin). Dark: a softer charcoal-plum page `#2A2426`, fill `#3A3335`, ink `#F3F1DA`, muted `#C2BDA8`, accent `#7ED69B` (Fresh leaf). (2) In every theme a picked reaction loses its filled oval: it gets a 2 pt accent outline and its count in the accent; unpicked keeps a 1 pt line border. Paper and Pomegranate colors are unchanged.
Over: the Nov 18 Avocado (`#EEEFD3` page, near-black green dark `#10140C`); dark accents `#B3D25B` (mushy), `#EFEBB8` and `#C8EB7E`; the seed brown as an accent; GUX-R15's filled `accentPicked` oval.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Frame and email unchanged |
| LG Least-savvy grandparent | Red | A thin outline is subtler than a filled oval for weak eyes |
| AG Android grandpa | Green | Same colors and outline on Android |
| SG Step or other-household grandparent | Green | Look only; who sees what is unchanged |
| CU Cousin | Green | Cleaner reactions; themes still owner only (DEC-68) |
| PA Posting parent | Green | Chase's own pick; photos stay the star on a pale page |
| FA Far-away inviter | Green | Relatives see Paper; same words to explain reactions |
| TR Tech reader | Green | Colors only; no data, vendor or storage change |

Resolution: LG mitigation: picked differs by width (2 pt vs 1 pt) and count color, not hue alone; the outline is at least 3:1 and the count 4.5:1 on the page in every theme, normal and high contrast (RD-114, RD-115); the pop stays (RD-89); VoiceOver says "selected"; grandparent-ux reviews the screenshots and RD-118 checks it on a phone at arm's length before merge.
