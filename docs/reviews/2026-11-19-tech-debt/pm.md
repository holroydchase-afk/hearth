# Staff PM review: process and doc debt (Nov 19, main @ eceac67, read-only)

Lens: does the repo pass a sniff test at the product/process level. Milestones and gates in TRACKER/REMAINING/BETA-SPEC are agent-written guides; nothing below scores Chase against them.

## Portfolio review (Nov 18) follow-up: 15 items
| # | Item | State |
|---|---|---|
| 1 | Front door true | Mostly done (R49 ◐); hashed real-name CI check left. But see PM-R1: README already drifted again |
| 2 | Scaffolding out of public story | Partial (R50 ◐): README/case study clean; TRACKER/REMAINING/MILESTONE-1/BETA-SPEC still public, Chase's call open |
| 3 | Audience-leak eval | Open (R51 ☐) |
| 4 | CI obeys own rules | Open (R52 ☐) |
| 5 | Operations (purge, B2 delete, KEK rotation, digest) | Open (R53 ☐) |
| 6 | One design doc w/ options + cost table | Open |
| 7 | Phone timings, old Android | Open (needs Chase) |
| 8 | First three relatives, quotes | Open (needs Chase) |
| 9 | Cut HANDOFF | Open, worse: 640 -> 693 lines |
| 10 | Scope ledger + freeze | Partial: README has a "Built, switched off" row; no ledger, no freeze; 5 more scope rows (R55-R60) added since |
| 11 | Blur eval | Open (needs Chase) |
| 12 | Smaller PRs, human-read line | Not evidenced |
| 13 | Demo "made up" line | Done (`app/src/demo/DemoFrame.tsx:45`) |
| 14 | Split tracker open/done | Open |
| 15 | Hashed real-name CI check | Open (tail of R49) |

Score: 1 done, 3 partial, 11 open. Since the review, the next 3 days went to themes, a tab bar and the demo bar (R55-R60, all P2), not R51-R53.

## Findings

| ID | Pri | Where | Problem | Fix | Effort |
|---|---|---|---|---|---|
| PM-R1 | P1 | `README.md:34` | Front door says "every icon has a word under it"; DEC-66/DEC-70 made tabs icon-only with Easy view Off (CLAUDE.md:95 rule 3 exception). Same drift R49 just fixed, one day later | Reword to "words under icons, or icons with spoken names when Easy view is off"; add a README-claims check to the DEC write-up ritual | S |
| PM-R2 | P1 | `README.md:35`; `docs/product/MARKETING.md` (no MLS row); `docs/product/TRACKER.md:107-109` (MS3 hand test ☐, MS6 "add MLS claim once deployed" ☐) | README claims group chat is E2E encrypted with MLS; the repo's own claims register doesn't carry it and its own gate (MS6) says not yet | Either add the claim to MARKETING with limits + evidence, or soften README to "built, not yet proven between two phones". positioning lane | S |
| PM-R3 | P1 | `HANDOFF.md:6` (status says #119 open; git shows merged), `:26-41` ("local commit, not pushed" on work merged in #122), `:170-201` (GitHub hold notes); `TRACKER.md:66-68` (R46-R48 ☐ though merged/live), `:61` (R41 "PR open") | Status in the two "start here" docs lags main by days; nobody can tell what is live from the docs | Status-sweep after every merge (one line per row); HANDOFF header regenerated from TRACKER; handoff-check fails if it names an open PR that is merged | S |
| PM-R4 | P1 | Migrations `0024_start_family`, `0025_search`, `0026_sms_sign_in` on main; no deploy record (last recorded: 0023, `HANDOFF.md:244`) | No ledger of which migrations are on the hosted project. README lists search as built; can't confirm it's live | One table (`docs/eng/DEPLOYS.md` or a TRACKER section): migration, merged, deployed, smoke. Fill from `deploy.sh --dry-run` against hosted | S |
| PM-R5 | P1 | `README.md` Status "Built, switched off"; `TRACKER.md:47` (video, 0020 deployed, off; part 2 local-only branch), `:61` (start_family switch off, needs PRIV-R7 + legal), `:62` (SMS behind flag, no Twilio account) | Three features built, merged and shipped dark, each with open reviews; dead weight in schema, app and tests, built before any relative asked. Reads as "wide, not deep" against GOALS goal 4 | Decide per feature: keep dark with a dated owner, or move behind an archive branch. Recommend: keep video (Chase asked), park SMS and start_family code paths until a relative needs them | M |
| PM-R6 | P1 | `CLAUDE.md:23` (REMAINING = "critical path to the Ring 0 gate (Oct 29)"), `:39` (migrations 0001-0011; there are 26); `BETA-SPEC.md:3,8` ("updated Oct 17", "P0 blocks the current ring"); `REMAINING.md:158-179` (CH-6/CH-8/AE-8..11 still in Ring wording); `PM-REVIEW.md`, `PLAN.md` (Oct 15 day-1 plan) | The project-memory file every agent reads is wrong on layout and points to a dead gate; Ring language survives in 9 files after DEC superseded it | Fix CLAUDE.md layout to "0001-0026, see backend/README"; archive PLAN.md, PM-REVIEW.md, REMAINING.md, MILESTONE-1.md to `docs/archive/` | S |
| PM-R7 | P1 | `BETA-SPEC.md:1` ("single source of truth", 76 IDs, last scope edit Oct 17) vs 12 `SPEC-*.md` files (RD-1..107, SEARCH, SMS, START, OPEN, CAP, LIVE...) | The declared scope source of truth hasn't owned scope for a month; real scope lives in feature specs with no index. CLAUDE.md says 35 criteria | Make BETA-SPEC a 1-page index: each job -> spec file -> ID range -> on/off. Fix the count in CLAUDE.md | M |
| PM-R8 | P2 | `docs/product/` = 36 files + `decisions/` (44) + `reviews/`; `docs/reviews/` 13 more; TRACKER/REMAINING/MILESTONE-1/HANDOFF overlap on "what's next" | Four "what's next" docs; an outsider can't find the current plan in 2 minutes | One "next" doc (TRACKER, open rows only); archive the rest; done rows to `TRACKER-DONE.md` | S |
| PM-R9 | P2 | `HANDOFF.md` 693 lines, 108 sections, dates out of order (`:45` Nov 17 above `:50` Nov 18; `:203` Nov 6 above `:210` Nov 7) | Handoff is a changelog, not current state; it grew after the review said cut it | Keep the status block + last 3 entries; move the rest to `docs/archive/handoff-log.md` | S |
| PM-R10 | P2 | `docs/product/FUNDING-RESEARCH.md:3-8,100` | Public repo carries Chase's 2027 relocation, grant eligibility tactics and "founding-family pre-sale" targets; contradicts the "proof of concept, birthday present" framing (CLAUDE.md:5) and is personal detail | Move to private docs (claude.ai) or `docs/archive/` with a one-line note. Chase's call | S |
| PM-R11 | P2 | `DECISION-LOG.md` (DEC order 1..7, 27, 8..18, 31, 37, 19..21, 26, 22...); 71 DECs vs 44 persona checks (659 lines) | Log is out of numeric order; persona checks are predicted Greens/Reds, never observed, ~15 lines per cosmetic call (e.g. Linen #F7F7F4) | Sort the log; exempt pure-visual calls from persona check or use a 3-line form; replace predictions with real relative quotes once milestone 2 starts | S |
| PM-R12 | P2 | `.claude/agent-runs/` (12 logs incl. `detached.log`, `demo-step2.log`), `docs/portfolio/INTAKE-*.md` (5), `ux-shots/`, `prototype/` ("throwaway", CLAUDE.md:51) at root | Agent plumbing and throwaway artifacts sit at the repo top level of a public portfolio repo | Fine to keep the run logs (they prove the process) but say so in one README line; move prototype/ and INTAKE files to `docs/archive/` | S |

## Biggest risk
Status drift (PM-R1, R3, R4): the review fixed the front door on Nov 18 and it was stale again by Nov 19. Fix is a ritual, not a rewrite: a status sweep + deploy ledger on every merge.

## Decisions for Chase (recommendations)
1. Planning docs public? Recommend: archive REMAINING, MILESTONE-1, PLAN, PM-REVIEW; keep TRACKER (open rows only).
2. SMS and start_family: recommend park (flag off, no further work) until a relative asks.
3. FUNDING-RESEARCH.md: recommend move out of the public repo.

## Recruiter notes (notes only)
- First screen is strong: one-line pitch, three real screenshots, a live no-sign-in demo, honest "what it can't do yet". That clears the 30-second bar.
- "Start here" table is the right idea; the BETA-SPEC link lands on Oct 17 Ring-era text, which undercuts it.
- Root-level HANDOFF (693 lines) and CLAUDE.md read as agent-operating manuals; a recruiter will wonder who the audience is. Fine for an "AI-native PM" story if the README says so in one line.
- 71 logged decisions with "what it beat" is the most PM-legible artifact here; it needs sorting and a top-10 to be skimmable.
- Volume reads as velocity and as sprawl at the same time: 36 product docs, 26 migrations, three dark features. No user outcome yet with a number and a person in it.
- The one line a hiring manager will remember: a PM who wrote down what the product can't claim. Keep that true (PM-R1, PM-R2).
