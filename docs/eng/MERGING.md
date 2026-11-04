# Merging pull requests

How a Hearth PR gets from branch to `main`. Chase is the only human reviewer.

## Who says merge (DEC-48, Chase, Nov 2)
- **Non-live PRs merge on green.** The thread that owns a PR merges it itself once the checks below pass, without asking. Non-live means it touches only docs, tests, CI checks, agent files and scripts.
- **Live PRs wait for Chase's word** ("merge it", "get those merged"). Live means anything under `app/**` or `packages/**` (the app, and the public demo that Pages rebuilds from it), `.github/workflows/demo-site.yml`, `backend/**`, or anything that deploys or builds for a phone. One live file makes the whole PR live.
- Merging is never deploying: deploys and Expo republishes still need Chase's own words.

## Before merging
1. **Allowed to merge.** Non-live and green, or Chase said to merge.
2. **CI is green on the latest commit**: Agent roster, Backend (SQL + Deno), App (Jest + typecheck).
3. **No merge conflict** (`mergeable_state` is `clean`). If it conflicts, merge `main` into the branch (no rebase or force-push), resolve, rerun the checks, then wait for green.
4. **Not a draft.** A draft is marked ready only when the thread that owns it says it is done pushing.
5. **Its owner is done.** A PR driven by another project thread is merged by that thread, or after it confirms.

## Order
- Oldest first, unless a newer PR is one the older builds on.
- Merge PRs that others build on first. When a PR says it already contains another PR (e.g. "this branch also merges #3"), merge the contained one first.
- After each merge, re-check the next PR for conflicts and CI against the new `main` before merging it.

## How
- **Merge commit** (GitHub's "Create a merge commit"), matching the history on `main`. No squash, no rebase.
- Delete nothing by hand; branches can stay.
- After merging, the Claude that drove the PR says so in its thread in one line and resolves the thread when nothing else is owed.

## After merging
- Code that changes the hosted backend is not live until `backend/scripts/deploy.sh` runs (see its header). Merging is not deploying.
- If a merge breaks `main`, open a revert PR (GitHub's "Revert" button) instead of pushing to `main`.
