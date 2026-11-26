#!/usr/bin/env bash
# INTAKE-206: tests for scripts/check-no-fixed-sleeps.sh. NOSLEEP-3 runs the guard on this repo.
set -u
cd "$(dirname "$0")/../.."
G=$PWD/scripts/check-no-fixed-sleeps.sh
pass=0; fail=0
ok()  { echo "ok      $1"; pass=$((pass+1)); }
bad() { echo "NOT OK  $1"; fail=$((fail+1)); }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/r/app/e2e-web"
echo "await expect(x).toBeVisible();" > "$T/r/app/e2e-web/a.spec.js"
out=$(bash "$G" "$T/r"); rc=$?
[ $rc -eq 0 ] && ok "NOSLEEP-1 a tree with only condition waits passes" || bad "NOSLEEP-1 [rc=$rc: $out]"
echo "await page.waitForTimeout(300);" > "$T/r/app/e2e-web/b.spec.js"
out=$(bash "$G" "$T/r"); rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q 'b.spec.js' && ok "NOSLEEP-2 a waitForTimeout fails and names the file" || bad "NOSLEEP-2 [rc=$rc: $out]"
out=$(bash "$G"); rc=$?
[ $rc -eq 0 ] && ok "NOSLEEP-3 this repo has no fixed sleeps in app/e2e-web" || bad "NOSLEEP-3 [rc=$rc: $out]"
echo "$pass passed, $fail failed"; [ $fail -eq 0 ]
