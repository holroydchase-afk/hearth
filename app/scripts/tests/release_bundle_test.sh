#!/usr/bin/env bash
# INTAKE-205-1: tests for app/scripts/check-release-bundle.sh on fixture bundles (no Metro needed).
#   bash app/scripts/tests/release_bundle_test.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
G=$PWD/scripts/check-release-bundle.sh
PASS=0; FAIL=0
ok()  { echo "ok   - $1"; PASS=$((PASS + 1)); }
bad() { echo "FAIL - $1"; FAIL=$((FAIL + 1)); }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mk() { rm -rf "$T/d"; mkdir -p "$T/d/_expo/static/js/web"; printf '%s\n' "$1" > "$T/d/_expo/static/js/web/entry.js"; }

mk 'function f(){throw new Error("This build has no sample backend.")}'
out=$(bash "$G" "$T/d"); rc=$?
(( rc == 0 )) && ok "RELBUNDLE-1 a real bundle (the .off stub, no sample family) passes" || bad "RELBUNDLE-1 [rc=$rc: $out]"

mk 'a="First ride on the balance bike";throw new Error("This build has no sample backend.")'
out=$(bash "$G" "$T/d"); rc=$?
(( rc != 0 )) && ! echo "$out" | grep -q 'balance bike' && ok "RELBUNDLE-2 a sample post in the bundle fails, without printing the marker" || bad "RELBUNDLE-2 [rc=$rc: $out]"

mk 'var x=1;'
out=$(bash "$G" "$T/d"); rc=$?
(( rc != 0 )) && echo "$out" | grep -q 'lacks the fakeRuntime.off stub' && ok "RELBUNDLE-3 a bundle without the .off stub fails (the swap may not have happened)" || bad "RELBUNDLE-3 [rc=$rc: $out]"

# RELBUNDLE-5/6 (found by CI on the first run): with a real-sized bundle, `cat | grep -q` closes the pipe early and
# `pipefail` turns a match into a failure, so a present stub looked missing and a present marker looked absent.
big() { rm -rf "$T/d"; mkdir -p "$T/d/_expo/static/js/web"; { printf '%s\n' "$1"; head -c 3000000 /dev/zero | tr '\0' 'x'; echo; } > "$T/d/_expo/static/js/web/entry.js"; }
big 'throw new Error("This build has no sample backend.")'
out=$(bash "$G" "$T/d"); rc=$?
(( rc == 0 )) && ok "RELBUNDLE-5 a large real bundle with the .off stub passes (no broken-pipe false alarm)" || bad "RELBUNDLE-5 [rc=$rc: $out]"
big 'a="Nana Eloise";throw new Error("This build has no sample backend.")'
out=$(bash "$G" "$T/d"); rc=$?
(( rc != 0 )) && echo "$out" | grep -q 'sample-family marker' && ok "RELBUNDLE-6 a sample marker at the start of a large bundle still fails (no broken-pipe false pass)" || bad "RELBUNDLE-6 [rc=$rc: $out]"

rm -rf "$T/e"; mkdir -p "$T/e"
out=$(bash "$G" "$T/e"); rc=$?
(( rc != 0 )) && ok "RELBUNDLE-4 an empty folder fails, so a missing export can't pass" || bad "RELBUNDLE-4 [rc=$rc: $out]"

echo "$PASS passed, $FAIL failed"
(( FAIL == 0 ))
