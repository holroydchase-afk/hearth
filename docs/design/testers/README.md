# Design testers

Small, single-file pages Chase used to make a design call by trying options live instead of looking at static mockups (lesson Nov 17: "give a live tester, not pictures"). Each one is plain HTML with no build step, no sign-in and no data sent anywhere, so other people (and other studio projects, "Atlas") can open and reuse them. Only made-up photos (colour gradients) and the demo family's names (Chase, Grandma Jo, Alex, Mom, Gammy) appear.

## How to open one

- **On a computer:** open the file on GitHub, press the download button ("Download raw file"), then double-click the downloaded `.html` file. It opens in your browser.
- **Agents and scripts:** fetch the raw file, for example
  `https://raw.githubusercontent.com/holroydchase-afk/hearth/main/docs/design/testers/share-start.html`
- Each page explains itself at the top ("How to use").

## Testers

| File | What it compares | Chase's pick |
|---|---|---|
| [share-start.html](share-start.html) | What happens when you tap Share (round 2, Nov 20, 2026). **B+** postcard first for everyone: a dashed "Add photos" spot, a stamp, who it can go to, your last share. **Split by Easy view**: parents go straight to their photos, grandparents get the postcard. **A** (round 1) straight to the photos, for comparison. Switch between a parent (Chase) and a grandparent (Grandma Jo, Easy view), light and dark. | **B+, postcard first for everyone.** Older relatives want control, not automation: nothing is picked or sent for you, and every relative learns the same two words, "Share, then Add photos". |

## Adding one

Save the page as one `.html` file here (inline CSS and JS; fonts from Google Fonts only), put a "How to use" note and the decision at the top of the page, add a row above, and log it in the project's tools log. Check it for real names, faces, places and emails first: this repo is public.
