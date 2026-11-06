# Decision: fix the gaps from the Apple design guidelines sweep
Date: Nov 6, 2026 · Status: Chase asked ("handle all the p1s, handle 1,6,8,4,etc") · DEC-54

What changes (sweep doc https://claude.ai/artifact/3N1G5jF4ezeQ2Gtf2jFwZU):
- **HIG-1:** the phone's "Allow notifications?" no longer pops up at sign-in. After the first photo, a card explains it, then one button asks. Not now hides it.
- **HIG-2 (BETA-SEE-4):** photos zoom by pinch (iPhone), double tap, or a Zoom button.
- **HIG-3, HIG-11:** tab and toolbar words and icons grow with Larger Text up to 1.5x; tabs show the large pop-up label.
- **HIG-4, HIG-5:** the launch screen is Ember's background in light and dark; iPad turns every way.
- **HIG-7..10, HIG-12:** Increase Contrast colors, Reduce Motion, VoiceOver says who sent a photo and when, bottom sheets with a grabber and swipe down, light haptics.
- **Not done:** HIG-6 words under the emoji (Chase kept emoji only on the Nov 6 card; REACT-7 stands), owner account deletion (needs Chase's call on the family's photos), Share stays a tab.
- Over: leaving the app as it was until the App Store build.

| Persona | Green/Red | Why |
|---|---|---|
| PA Posting parent | Green | Zoom and haptics feel like the phone's own photo apps |
| FA Far-away inviter | Green | No cold notice prompt she might refuse and can't undo |
| LG Least-savvy grandparent | Green | Zoom on faces; bigger text no longer spills off tabs |
| AG Android grandpa | Green | High contrast, Reduce Motion and zoom button work on Android |
| SG Step or other-household grandparent | Green | Nothing new is shared with anyone |
| GG Great-grandparent who won't install | Green | Web view gets zoom and the warm launch colors |
| CU Cousin | Green | Swipe-down sheets and haptics match other apps |
| TR Tech reader | Green | Follows Apple's guidelines, each gap tested by ID |
