# Decision: light and dark screens anyone can pick, one warm Hearth palette, and Atkinson Hyperlegible
Date: Nov 1, 2026 · Status: Chase asked ("We need a dark and light mode", "review and fix the color scheme across the board, these are rough") · Changes DESIGN-SYSTEM "Colors" (DS-10, DS-11)

Hearth already had dark colors, but only followed the phone, and nobody could pick. Chase also found the colors rough on his iPhone: cold system grays, pure black at night, a see-through blue Send button before you type, a black reply box inside a gray card, and a navy demo bar that fought the gray buttons.

What changes:
- **DS-10:** "Light or dark screen" on Help (viewers) and Me (posters), right after Bigger text: Same as my phone (Recommended), Light screen, Dark screen. Saved on the phone with the other prefs. The phone's own tab bar, keyboard and status bar follow it.
- **DS-11:** one warm palette on iPhone, Android and the web: warm off-white and warm charcoal instead of system gray and pure black, one calm blue for anything you tap. Body text is 7:1 or better (WCAG AAA) in both looks; every other pair 4.5:1. A waiting button is solid gray with readable words, not a 50% see-through blue. The reply box and demo bar use the card color.
- **DS-12 (Chase picked it from three side by side, Nov 1):** Atkinson Hyperlegible Next, the Braille Institute's free typeface for low-vision readers (SIL OFL 1.1, bundled, no network), on every phone and the web. Only three of its seven weights ship: Regular for everything you read, Medium for Android buttons and tab labels, SemiBold for names, titles, buttons and the picked tab. No Light (thin strokes fade on old screens), no Bold or ExtraBold (Chase: "are they all too bold"), no italics or all caps. Each weight is its own file because Android can't make a custom font bolder with fontWeight. Over: Apple's rounded font (Apple devices only) and keeping the phone's own font.

| Persona | Green/Red | Why |
|---|---|---|
| PA Posting parent | Green | Can match the phone or pin dark for evening posting |
| FA Far-away inviter | Green | Can tell a relative "Help, then Dark screen" in one step |
| LG Least-savvy grandparent | Green | Follows her phone unless she picks; more contrast; no look-alike letters |
| AG Android grandpa | Green | Same colors and font as iPhone, so calls describe the same screen |
| SG Step or other-household grandparent | Green | No effect on who sees what |
| GG Great-grandparent who won't install | Green | The web view gets the same warmer, higher-contrast colors |
| CU Cousin | Green | Dark screen at night, no glare from pure black next to bright photos |
| TR Tech reader | Green | Colors, contrast and font weights are tested; open-licensed font bundled, nothing fetched |
