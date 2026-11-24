# Decision: keep text sign-in in the repo, switched off, and finish it
Date: Nov 19, 2026 · Status: Chase's ("We need to keep the switched off features. Start a thread for each") · DEC-74 · Answers PM-R5 (docs/reviews/2026-11-19-tech-debt/pm.md) for text sign-in · Spec: `docs/product/SPEC-SMS-SIGN-IN.md`

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Email copies unchanged; the switch stays off until the phone test passes |
| LG Least-savvy grandparent | Green | Keeps the no-inbox sign-in on the way; email works meanwhile |
| AG Android grandpa | Red | Android code autofill is still untested on a real phone (BETA-SMS-16) |
| SG Step or other-household grandparent | Green | Same sign-in for everyone; nothing new is shown to others |
| CU Cousin | Green | No change while off; faster sign-in once on |
| PA Posting parent | Green | Nothing changes for parents until Chase turns it on |
| FA Far-away inviter | Red | Twilio's default text lacks the "never read this code" line |
| TR Tech reader | Green | Dark code is reviewed, tested in CI and documented, not dead weight |

Resolution: AG mitigation: BETA-SMS-16 on an Android phone must pass before the switch turns on.
Resolution: FA mitigation: ask Twilio Support to register Hearth's wording (BETA-SMS-7) before the switch turns on; the guide says type it yourself (BETA-SMS-17).
