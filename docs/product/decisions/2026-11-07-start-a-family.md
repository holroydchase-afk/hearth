# Decision: a "Start a family" screen ships before the Nov 22 beta
Date: Nov 7, 2026 · Status: Chase's ("Yes, build it now" on the decision card) · DEC-55 · Spec: `docs/product/SPEC-START-FAMILY.md` (START-1..9)

Reverses DEC-3 (Oct 16: "Start a family" Not now, milestone 7). Why: level 5 of the recruiter-readiness bar, "someone other than Chase can find, start and use it unaided", needs a new family to start without Chase running `backend/scripts/family-setup.sh`.

What changes: a signed-in person with no family can start one (name it, keep Everyone or add two sides, invite one person). Joining stays invite-only: hashed, single-use, email-bound invites, unchanged. Sign-up was already open (`shouldCreateUser: true`, `enable_signup = true`), and `create_household`/`create_space` were already callable by any signed-in account; the old guard was "no screen calls them".

| Persona | Green/Red | Why |
|---|---|---|
| GG Great-grandparent who won't install | Green | They never see it; frame and email copies are unchanged |
| LG Least-savvy grandparent | Red | A second choice beside her code could start an empty family instead |
| AG Android grandpa | Green | Same three screens on Android; nothing platform-specific |
| SG Step or other-household grandparent | Green | Joins by invite as before; side names are equal and optional |
| CU Cousin | Green | Cousins who are parents can start their own family without Chase |
| PA Posting parent | Green | A parent starts alone and shares in minutes, no script, no Chase |
| FA Far-away inviter | Green | Start and invite from far away; every step can be read aloud |
| TR Tech reader | Red | "Invite-only; nothing public" overstates it once anyone can start a family |

Resolution: LG mitigation: the code entry stays first and biggest; Start is a smaller "I'm a parent" button with a "Have a code?" check (START-2), and an empty family she started is retired when she redeems an invite (START-7).
Resolution: TR mitigation: the claim becomes "joining is invite-only"; one family per account and a server kill switch (START-5, START-8); MARKETING claims row updated in the build PR.
