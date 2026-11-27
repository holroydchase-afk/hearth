#!/usr/bin/env bash
# HOOK-1..4 (intake #213): the pre-commit hook formats and lints staged app files, type-checks, and stays out of the
# way of docs-only commits. Uses a throwaway git repo, so nothing real is committed.
set -uo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
fail=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }

# HOOK-1: the hook exists and can run.
[ -x "$root/.githooks/pre-commit" ] && ok "HOOK-1 .githooks/pre-commit is executable" || bad "HOOK-1 .githooks/pre-commit missing or not executable"

# HOOK-2: it is installed by npm install (prepare points git at .githooks) and says what it runs.
grep -qF '"prepare": "git config core.hooksPath .githooks' "$root/app/package.json" && ok "HOOK-2 npm prepare installs the hook" || bad "HOOK-2 prepare script missing"
grep -qF 'lint-staged' "$root/.githooks/pre-commit" 2>/dev/null && grep -qF 'typecheck' "$root/.githooks/pre-commit" 2>/dev/null && ok "HOOK-3 runs lint-staged and typecheck" || bad "HOOK-3 hook does not run lint-staged and typecheck"

# HOOK-4: a docs-only commit passes at once and does not run the app checks.
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
git init -q "$tmp" && cp -r "$root/.githooks" "$tmp/.githooks" 2>/dev/null
echo "hello" > "$tmp/notes.md"; git -C "$tmp" add notes.md
if out=$(cd "$tmp" && bash .githooks/pre-commit 2>&1); then
  printf '%s' "$out" | grep -qi "no app files" && ok "HOOK-4 docs-only commit skips the app checks" || bad "HOOK-4 did not say it skipped"
else bad "HOOK-4 docs-only commit was blocked: $out"; fi
exit $fail
