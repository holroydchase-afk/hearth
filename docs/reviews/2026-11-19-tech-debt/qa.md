# QA seat: test suite and CI review (Hearth @ eceac67, read-only)

## Runs (this container, Node 22, after `npm ci`)
- `npm test -- --silent`, 3 runs: 151/151 suites, 1507 passed, 1 skipped, 1 todo, 0 failed each time (98 s, then about 100 s with --json, then 72 s wall; 4m13s CPU). Same counts all 3 runs, so not flaky.
  - The run printed 8 "accessing the Jest environment after it has been torn down" errors (requestAnimationFrame timer firing after the test ended): opening, warmPaper, redesignGallery, timeline, search, groupTitles, photosHeader, toolbarWrap.
  - Slowest files: photosStyle 12.3 s, opening 12.2 s, redesignPolish 9.3 s, themes.tsx 8.8 s, redesignGallery 8.8 s. No single test took over 4 s. Speed is not a problem.
- `npm run typecheck`: clean on 4 runs, 6.4 s.
- Not run here: e2e:web, e2e:demo, e2e:site, backend SQL, Deno, contract-real.

## Findings

| ID | P | Where | Problem | Fix | Effort |
|---|---|---|---|---|---|
| QA-R1 | P1 | test-all.sh:1-46; CLAUDE.md "Everything: bash test-all.sh"; docs/eng/TESTING.md:27 | The documented "run everything" script never runs app Jest, typecheck, e2e:web, e2e:demo, e2e:site or contract-real. It covers roster and lint scripts, prototype e2e, backend SQL and Deno only. Anyone who trusts it for "all suites green" skips the app. | Add app jest, typecheck and the three Playwright configs as `suite` lines (skip with a reason when there are no browsers). | S |
| QA-R2 | P1 | .github/workflows/ci.yml:151-170 (only app job); demo-site.yml (push to main only) | No browser e2e runs on PRs: e2e:web, e2e:demo and prototype e2e never run in CI. site.spec runs only after merge. Engineer edits to e2e specs (HANDOFF:46,47,75,143) are gated only by a local self-report. This confirms R52 is still open. | Add an e2e job: cache Playwright browsers and run e2e:web and e2e:demo with retries 0 and a 20 min timeout. | M |
| QA-R3 | P1 | studio-checks.json `agents.verify`; agents-check.yml | The CI "3x when qa-tdd ran" rerun covers only roster, log and persona shell checks, not Jest or e2e. The only flake gate for the app is local and self-reported (and T20 was a real 1-in-3 Jest flake). | Point the 3x rerun at `cd app && npm test` (or a nightly `jest --randomize` x3 job). | S |
| QA-R4 | P1 | backend/supabase/functions/sign-media/index_test.ts (4 tests); ci.yml:103 (`-x edge-runtime`); app/src/api/contract/supabaseHarness.ts:28 (HEARTH_MEDIA unset) | sign-media holds key wrap and unwrap and access to media. Its tests skip finalize (index.ts:247), the 402 free video cap (:216), the 1..20 item bounds (:200,:248), CORS (:110), PGRST301 to 401 (:291) and the forbidden branch. The real function never runs in CI: the edge runtime is excluded and the contract media tests skip. | Add one Deno handler test per branch, plus a CI step that serves the function on edge-runtime with a stub B2 and runs `itMedia`. | M |
| QA-R5 | P1 | HANDOFF.md:29,39,46,47,75,80,90,96,151 | The engineer rewrites tests in the same change as the code, nearly every round (up to 12 test files for one feature: Easy view, :47), and qa-tdd reviews afterwards. This is a smell: the tests pin layout and wording, so the product changes and the tests follow it. It also lets "the test was wrong" become the default. | Put engineer test edits in a separate commit that qa-tdd approves before merge (an agents-check rule on `__tests__` diffs), and see QA-R6. | S |
| QA-R6 | P2 | 23 of 150 test files are named by review round or pass (reviewRound1-6, redesign*, gux*, *Polish, wordsPass…); 445 `ByTestId`, 212 style flattens, 93 hex literals (themes.test.ts, reviewRound3.test.tsx:215-218, guxThemeEdges:69) | The suite is organized by when a review happened, not by feature: Gallery behavior is spread over photos, photosStyle, redesignGallery, reviewRound2, warmPaper, groupTitles and searchBacking, so every design tweak touches many files. Test titles are good (behavior plus an ID); the files are the problem. Contrast-ratio checks are good; hex literals are not. | Re-home tests by feature (gallery/, feed/, share/…) as each area is next touched; assert on theme tokens and contrast, not literal hex values. | L |
| QA-R7 | P2 | app/src/ui/__tests__/redesignLint.test.ts:11-50 (hand-rolled JSX brace parser), themes.test.ts:58,179, warmPaper.test.tsx:175-180, plainBackground.test.tsx:13,51, a11ySweep.test.tsx:50, features.test.tsx:30 | About 10 Jest files read .tsx source as text: a home-made linter with regex allowlists that are edited each round (HANDOFF:29,80,96). It breaks on formatting and misses aliased imports. | When R52 adds ESLint, move these to `no-restricted-syntax` and custom rules; keep the rendered-tree checks in Jest. | M |
| QA-R8 | P2 | 8 screen test files (see Runs); warmPaper.test.tsx:291,310 and guxPaper.test.tsx:104 (real 300 ms sleeps) | Timers and rAF leak past teardown, and real-time sleeps are a known source of flakes under load (T20 was this shape). | Unmount and run timers in `afterEach`, or use fake timers for Animated; replace the sleeps with `waitFor` on the state. | S |
| QA-R9 | P2 | tracker/build_seed.py:249 (T20 open) | T20 (familyColor flake) is still "open", but `familyColor.test.tsx` was deleted in 27d0955 (superseded by themes.test.tsx). The root cause (a waitFor under full-suite load) was never found, so the flake may have moved. | Close T20 as "file removed, cause unconfirmed", and file QA-R8 as its successor T#. | S |
| QA-R10 | P2 | app/src/crypto/__tests__/random.test.ts vs randomMs4.test.ts | Near-duplicate files (a merge leftover from PR 25): the same two tests twice. | Delete randomMs4.test.ts. | S |
| QA-R11 | P2 | app/e2e-web/demo-screens.spec.js:22-28 | Confirmed still broken (the first screen no longer shows "Bridge walk on the trail"; it now lives in src/demo/seed.ts:49 further down). It hides behind `test.skip(!SNAPSHOT_DIR)`, so no run ever notices. TRACKER R52 is unchecked. | Wait for a role or heading that is on the redesigned first screen; run it in CI with a temp SNAPSHOT_DIR. | S |
| QA-R12 | P2 | app/package.json (jest block); ci.yml | Confirmed: no coverage report or floor and no lint step (R52). The coverage I read by hand on the risky parts is decent: queue.test.ts 15 tests (kill and resume, backoff, shared phone), store.test.ts 17, SupabaseApi.test.ts 19, crypto KATs and tamper tests. sign-media is the gap (QA-R4). | `jest --coverage` with a floor set at the current level for upload/, api/, crypto/, feed/. | S |
| QA-R13 | P2 | ci.yml vs test-all.sh:21-27 | Some suites run only locally: check_spdx_test, test_totals_test, site_analytics_test, site_meta_test and prototype e2e are in test-all but not in CI. | Add them to the `agents` or `app` job (they take seconds). | S |

Not found (good): no `.only`, no snapshot tests, `it.skip` only on env-gated contract tests, one honest `it.todo` (RD-49), and the only mocks are native or platform edges (no mocks of internals). Queries are mostly by role (911) and label (154). Playwright has retries 0 and workers 1 everywhere.
```qa
verdict: green
suite: app jest | cd app && npm test -- --silent | 1507/0 1507/0 1507/0
suite: app typecheck | cd app && npm run typecheck | 1/0 1/0 1/0
QA-R1 | P1 | test-all.sh | "Everything" script never runs app jest, typecheck or any app e2e | none
QA-R2 | P1 | .github/workflows/ci.yml | no e2e:web / e2e:demo / prototype e2e on PRs | none
QA-R3 | P1 | studio-checks.json agents.verify | CI 3x rerun covers roster scripts only, not jest or e2e | none
QA-R4 | P1 | backend/supabase/functions/sign-media/index_test.ts | finalize, 402 cap, bounds, CORS untested; function never runs in CI | none
QA-R5 | P1 | HANDOFF.md:47 | engineer rewrites tests alongside code nearly every round | none
QA-R6 | P2 | app/src/screens/__tests__/reviewRound*.test.tsx | tests organized by review round; testID, style and hex pins make design tweaks touch many files | none
QA-R7 | P2 | app/src/ui/__tests__/redesignLint.test.ts | about 10 source-grep tests act as a home-made linter | none
QA-R8 | P2 | app/src/screens/__tests__/warmPaper.test.tsx | rAF leaks after teardown in 8 files; real 300 ms sleeps | none
QA-R9 | P2 | tracker/build_seed.py:249 | T20 open but its test file was deleted; cause unconfirmed | none
QA-R10 | P2 | app/src/crypto/__tests__/randomMs4.test.ts | duplicate of random.test.ts | none
QA-R11 | P2 | app/e2e-web/demo-screens.spec.js | still broken, hidden by skip | none
QA-R12 | P2 | app/package.json | no coverage floor or lint (R52 open) | none
QA-R13 | P2 | .github/workflows/ci.yml | spdx, test_totals, site_* and prototype e2e run only locally | none
```
