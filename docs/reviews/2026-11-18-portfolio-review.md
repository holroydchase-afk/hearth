# Portfolio review, three seats (Nov 18, 2026)

Chase asked for a blunt review of Hearth as a portfolio piece shown to established tech companies, from three seats: a recruiter, a staff product manager and an engineering manager. The full review with file and line citations is a Claude Doc: https://claude.ai/artifact/NrhDHPJuKetHTXkGs5HYpZ. This file keeps the findings and the backlog where agents can read them.

**One line:** strong engineering discipline and honest privacy writing, but the front door was out of date and nothing shows that anyone besides the founder has used the app.

## What was checked

Read: README, HANDOFF (top), case study, GOALS, LESSONS, TESTING, PERFORMANCE, TRACKER, architecture 03 and 04, the last four decision log entries, `ci.yml`, `sign-media/index.ts` (top), `upload/queue.ts`, `errors/report.ts`, migration 0006. Loaded the live demo at 390 px and 1280 px (first screen only; 200, no console errors, `version.txt` = main). Pull requests #105 to #119 by title and time only. Not checked: the hosted project, a phone, the messenger code, other migrations.

## Top 3 that lose each reader

| Seat | 1 | 2 | 3 |
|---|---|---|---|
| Recruiter | README screenshots and claims the demo contradicts in one click | No outcome with a number and a person in it | 36 product docs and a 640-line handoff, no two-minute path |
| Staff PM | A month of shipping with milestone 1's gate unmet (TRACKER step 9) | Features built and switched off before anyone asked (text sign-in, video, start a family) | Goal signals proposed, never measured once |
| Engineering | No sign of real use: no hosted numbers, phone timings or error rate | Merges minutes after open on large diffs, with no lint or coverage gate | Threat model lists unscheduled deletion and no key rotation, with no dated plan |

## What already reads as senior

- "Not built yet" in the README, and "not end-to-end" in the third sentence of the keys doc.
- One visibility rule behind every read path; not-allowed looks like not-found.
- The upload queue: every step saved before the next network call, idempotent ids, backoff, a restart cap.
- A contract suite that runs against both the fake and the real API in CI.
- Error reports that can't carry user content, checked on the phone and again in SQL.
- Written post mortems that each added a rule or a guard.

## Ranked backlog

Effort: S under a day, M 2 to 4 days, L a week or more. TRACKER rows R49 to R53 carry the top five.

| # | Item | Type | Impact | Effort | Why a staff PM or engineer would care |
|---|---|---|---|---|---|
| 1 | Make the front door true: README, case study, screenshots, counts and status match the live demo | Fix | H | S | A stale README makes every other claim suspect |
| 2 | Pass the milestone 1 gate and publish a one-page scorecard of targets against actuals | Fix | H | M | A metric measured once beats ten proposed |
| 3 | Audience-leak eval: generated family shapes through every read path, with a published zero-leak matrix | New build | H | M | The core promise becomes a reproducible result |
| 4 | CI obeys the repo's own rules: core-loop web tests, lint, a coverage floor, an audit gate; repair `demo-screens.spec.js` | Hardening | H | S | Shows the post-mortem rules are enforced |
| 5 | Operations: scheduled purge, storage deletion, a rehearsed key rotation, a daily error digest | Hardening | H | M | Closes the threat model's own top gaps with dated proof |
| 6 | One design doc: the problem, three options weighed, the one chosen, a cost table per family | New build | M | S | The artifact every one of these companies asks for |
| 7 | Phone numbers: a development build with native crypto, timed on an old Android | Hardening | M | M | Turns "likely 1 to 2 s" into a measurement |
| 8 | First three relatives: phone survey, first-session notes, word-for-word quotes | New build | H | M | Replaces predicted persona checks with findings |
| 9 | Cut `HANDOFF.md` to current state and archive the log | Fix | M | S | The repo root should read as a product |
| 10 | Scope ledger: every feature on, off or cut, and a freeze until milestone 2 | Fix | M | S | Proves "deep, not wide" is a rule |
| 11 | Blur eval on 40 labeled photos with precision and recall | New build | M | S | A small, real eval with a threshold decision |
| 12 | Smaller PRs, each with one line on what a human read | Fix | M | S | Three-minute merges read as unreviewed |
| 13 | Demo guide says "the family here is made up" beside Chase's name and photos (`app/src/demo/DemoFrame.tsx`) | Fix | L | S | It is on the first screen |
| 14 | Split the tracker into open and done | Fix | L | S | A reader should find what's next in ten seconds |
| 15 | A real-name check CI can run (hashed names), from the Oct 29 post mortem | Hardening | M | S | The one privacy rule still held only by review |

Needs Chase's time, a phone or his photos: 2, 7, 8, 11. Touches app or backend code, so waits for his merge: 3, 4, 5, 7, 13.

## Story angle

A product manager ran a team of AI agents like an engineering org (failing tests first, written post mortems, a threat model that names its own gaps) and shipped a privacy product whose README tells you what it can't do yet. The proof isn't that AI wrote the code. It's that the person directing it knew which claims to refuse to make. It is one step short: it needs one measured result from one real relative.
