# Decision: text message codes are the default sign-in, behind a switch, for M4
Date: Nov 10, 2026 · Status: Chase's (go-live list item 8, Nov 10: build it now; Oct 18: "I want texts to be the primary and default way folks receive their OTP.") · DEC-56 · Spec: `docs/product/SPEC-SMS-SIGN-IN.md` (BETA-SMS-1..17)

Closes TRACKER D11. Ships off (email only, as today) until Chase has an SMS provider and US carrier registration.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Email invites and email copies are unchanged; texts only matter for app users |
| LG Least-savvy grandparent | Green | Code arrives by text and fills itself; no inbox or junk folder to find |
| AG Android grandpa | Red | iPhone offers the code above the keyboard; some Android phones may not |
| SG Step or other-household grandparent | Green | Same sign-in for every grandparent; nothing ranks or shows who signed in |
| CU Cousin | Green | Faster than email; a separate account per number is their only cost |
| PA Posting parent | Green | Sign-in by text is quicker; email stays one tap away |
| FA Far-away inviter | Red | Helpers on a call may ask grandparents to read out the code |
| TR Tech reader | Red | A new vendor sees phone numbers and codes; phone codes risk SIM swap |

Resolution: AG mitigation: Android `sms-otp` autofill hint, and BETA-SMS-16 must pass on an Android phone; SMS Retriever is the fallback if it fails.
Resolution: FA mitigation: the text says never read this code to anyone (BETA-SMS-7); the guide and Help say type it yourself (BETA-SMS-17).
Resolution: TR mitigation: architect picks a US provider with a DPA, docs/architecture data flow and threat model updated before the flag turns on (SPEC §6), no phone numbers in logs (BETA-SMS-15).
