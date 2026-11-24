# Decision: life calendar v1, birthdays and important dates
Date: Nov 24, 2026 · Status: Chase's ask ("Build a v1") · DEC-81

What changes: an optional "When's your birthday?" card on Gallery for every new member (month and day, no year), a "Birthdays" row in More listing every family date soonest first, parents add kids' birthdays and anniversaries, and on the day a "Today is Grandma Jo's birthday" line on Gallery. In-app only; no push or email in v1. `docs/product/SPEC-LIFE-CALENDAR.md`, CAL-1..21.

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | Parents can add her birthday; she loses nothing |
| LG Least-savvy grandparent | Red | One more card on her first screen could feel like a form |
| AG Android grandpa | Green | Worded month and day buttons, no typing, same on Android |
| SG Step or other-household grandparent | Red | Dates are family-wide; an ex's household sees her birthday and anniversaries |
| CU Cousin | Green | Finally a birthday list without Facebook |
| PA Posting parent | Green | Adds the kids' birthdays once; everyone sees them on the day |
| FA Far-away inviter | Green | Parents can enter grandparents' birthdays from far away |
| TR Tech reader | Green | No year stored, family-scoped RLS, labels never logged or sent anywhere |

Resolution: LG mitigation: the card is optional with a big "Not now", needs no typing, says who sees it, and never returns once dismissed (CAL-12, CAL-13); grandparent test CAL-21 is the gate, and the stop condition drops the card for viewers.
Resolution: SG mitigation: the card and the Birthdays screen both say the whole family sees the date; she can skip it or delete her own anytime; per-group dates are parked until a split family asks.
