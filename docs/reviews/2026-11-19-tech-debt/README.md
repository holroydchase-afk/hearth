# Tech-debt review, five seats (Nov 19, 2026)

Chase asked for a full review "as the review team": is there tech debt, or things done oddly, that would fail a seasoned engineer's sniff test? It builds on the Nov 18 portfolio review (`../2026-11-18-portfolio-review.md`) and doesn't repeat it. Each seat read main at eceac67; their full findings, with file and line, are beside this file: `eng.md` (architect), `qa.md` (qa-tdd), `sec.md` (privacy-security, probed all 26 migrations on a scratch Postgres), `ux.md` (ux-reviewer, ran the web demo at 390 and 1280 px), `pm.md` (staff-pm, with recruiter notes, which are notes only).

**One line:** the core is sound (one API port with a contract suite run against both the fake and the real backend, RLS on every table, not-found parity across 14 RPCs, a testable upload queue), but there is one offline bug a grandparent would hit, a few places where the app says or records more than it should, and a test and CI setup that checks less than the docs say.

## Ranked: P0 and P1

Status is kept in `docs/product/TRACKER.md` row R61.

| ID | Pri | Where | Problem | Plan |
|---|---|---|---|---|
| ENG-R1 | P0 | `app/src/state/AppContext.tsx:150` | Opening the app offline (or on a server error) shows "not part of a family yet" with Sign out; the saved feed never loads | Fix: only an empty successful answer means no family; otherwise keep the last family and retry |
| TD-UX-R1 | P0 | `app/src/demo/DemoFrame.tsx:58` | On a 1280×800 laptop the demo's story panel is cut top and bottom and can't scroll | Fix: the panel scrolls |
| SEC-R2 | P1 | `app/src/screens/PostCard.tsx:35`; `0013_groups_v2.sql:322` | Every card records a view on mount; an author can read seen counts through the API (A2: no read receipts) | Fix the app now; the migration that drops the author's read waits for Chase's deploy word |
| SEC-R1 | P1 | `0002_beta_api.sql:234` | A relative can read the names of groups they are in through the raw API (group names are for parents) | Migration, written and tested; deploy waits for Chase |
| TD-UX-R2 | P1 | `MeScreen.tsx:56` | A "For testing" card shows to every real relative | Fix |
| TD-UX-R3 | P1 | `HelpScreen.tsx:38` | Help tells parents they can only look and write back | Fix |
| TD-UX-R5 | P1 | `HelpScreen.tsx:41` | The demo's Help page shows Sign out and "Take me off Hearth" | Fix |
| TD-UX-R6 | P1 | `kit.tsx:336` | A second confirm dialog makes the destructive choice the filled main button | Fix: one dialog |
| ENG-R3 | P1 | `PostCard.tsx:28` | Typing in any comment box redraws every card | Fix |
| ENG-R4 | P1 | `PostCard.tsx:34` | About 3 server calls per card on mount, ~60 per page | Fix |
| ENG-R5 | P1 | `state/runtime.ts:7` | The fake backend and demo code ship in the real phone app | Fix |
| ENG-R7 | P1 | `SupabaseApi.ts:167` | Fallbacks for older server versions that can't exist | Fix: delete |
| ENG-R8 | P1 | `app/package.json:15` | App browser tests borrow Playwright from the throwaway `e2e/` folder and one machine's path | Fix |
| QA-R1 | P1 | `test-all.sh` | "Run everything" skips app Jest, typecheck and app browser tests | Fix |
| QA-R2 | P1 | `.github/workflows/ci.yml` | Pull requests get no browser tests | Fix (R52) |
| QA-R3 | P1 | `studio-checks.json` | CI's 3x rerun covers roster scripts, not the app | Fix |
| QA-R4 | P1 | `sign-media/index_test.ts` | Finalize, the video cap, limits and CORS are untested | Fix |
| QA-R5 | P1 | `HANDOFF.md:47` | Test rewrites ride in the same commit as the code | Rule added to `docs/eng/TESTING.md` |
| PM-R1, PM-R2 | P1 | `README.md:34-35` | README says every icon has a word (not since Easy view) and claims chat E2E as done | Fixed in this PR |
| PM-R3 | P1 | `HANDOFF.md:6`, TRACKER | Status lagged main by days | Swept in this PR |
| PM-R4 | P1 | migrations 0024–0026 | No record of what is live | `docs/eng/DEPLOYS.md` in this PR |
| PM-R6 | P1 | `CLAUDE.md:23,39` | Ring 0 gate and "0001–0011" | Fixed in this PR |

**Moved down or held, with the reason:**
- ENG-R2 (video count never given back on a retried upload): P2, video is switched off.
- ENG-R6 (hand-rolled navigation: no swipe-back, Android back leaves More, Gallery loses its place): stays P1, but waits until PR 125 merges, since both touch the tab layout.
- TD-UX-R4 (settings repeated on Help, Me and More): P2, needs grandparent-ux and touches the same screens the Share redo thread may touch.
- PM-R5 (text sign-in, start a family and video built and switched off): Chase's call, see the summary.
- PM-R7 (BETA-SPEC no longer owns scope; 12 SPEC files with no index): P2, docs.

P2s are in each seat's file.

## Notes only: recruiter (from `pm.md`)
- The first screen clears the 30-second bar: pitch, real screenshots, a no-sign-in demo, honest limits.
- HANDOFF and CLAUDE.md read like agent manuals; one README line naming the AI-native method turns that into a strength.
- The decision log is the most PM-readable artifact; it needs sorting and a top 10.
- Volume reads as velocity and as sprawl at once. Still no result from a real person.
