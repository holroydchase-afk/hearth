# Decision: keep video, built and switched off, and get it ready to turn on
Date: Nov 19, 2026 · Status: Chase's ("We need to keep the switched off features. Start a thread for each", Nov 19 12:39Z) · DEC-89 · Answers PM-R5 (docs/reviews/2026-11-19-tech-debt/pm.md) for video · Tests: VID-1..22, ENG-R2, ENG-R11, SEC-R7, PRIV-R1

What changes: nothing a relative sees yet. Video's code, migration 0020 and tests stay on main with `video_posting` off. One thread owns getting it ready: fix ENG-R2, ENG-R11, SEC-R7 and PRIV-R1 test-first, then VID-19 on phones, the FLAG-7 check (VID-22) on Chase's iPhone, and Chase's word to turn it on.
Over: moving video to an archive branch until a relative asks for it (PM-R5's option for features shipped dark).

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Nothing changes while the switch is off |
| LG Least-savvy grandparent | Green | Nothing changes now; one Play tap when it is on |
| AG Android grandpa | Green | Android playback is checked by hand (VID-19) before turning on |
| SG Step or other-household grandparent | Green | Same audience rules as photos |
| CU Cousin | Green | Nothing changes while the switch is off |
| PA Posting parent | Green | Retries stop using up the month's free videos (ENG-R2) |
| FA Far-away inviter | Green | Nothing changes while the switch is off |
| TR Tech reader | Green | Location is stripped on the phone and checked by hand first |
