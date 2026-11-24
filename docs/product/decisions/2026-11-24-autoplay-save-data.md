# Decision: video autoplay as a setting, plus a "Save data" choice at sign-up
Date: Nov 24, 2026 · Status: Chase's call ("Make it a setting, default to on"; "old people have prepaid phones") · DEC-86

What changes: on the Feed the video most in view plays silently, one at a time, as a setting that is on by default. Sign-up asks one plain prepaid-plan question; "Save data" turns off autoplay, full-size photos on cards and the viewer's look-ahead. `docs/product/SPEC-MEDIA.md` section 5, AUTO-1..9, DATA-1..8.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Never installs; nothing changes for her |
| LG Least-savvy grandparent | Red | One more sign-up question; moving videos may startle; prepaid data burns if she says No |
| AG Android grandpa | Red | Old Android decrypting whole videos while scrolling may stutter, heat up and use data |
| SG Step or other-household grandparent | Green | No audience change; same posts, same groups |
| CU Cousin | Green | Feels like the social apps she already knows |
| PA Posting parent | Green | Their videos get watched instead of skipped past |
| FA Far-away inviter | Green | Can tell Grandma to tap Yes; changeable later in More |
| TR Tech reader | Green | Both settings stay on the phone; nothing sent; decryption stays on the device |

Resolution: LG mitigation: the question is one plain prepaid question with two big word buttons (DATA-1, DATA-8 is the gate); autoplay is silent, one at a time, respects reduce motion and Save data (AUTO-5).
Resolution: AG mitigation: a 1 s scroll pause at 80% on screen before any download, one video at a time, downloads stop on scroll-away (AUTO-2, AUTO-3, AUTO-8); AUTO-7 on the oldest tester Android; stop condition turns autoplay off by default on Android.
