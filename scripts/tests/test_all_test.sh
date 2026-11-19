#!/usr/bin/env bash
# QA-ALL-1 (RR-13): test-all.sh fails when any suite that ran failed, and says which suites were
# skipped and why (no Postgres, no Deno), instead of passing on Playwright's result alone.
#   bash scripts/tests/test_all_test.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
PASS=0; FAIL=0
ok()  { echo "ok   - $1"; PASS=$((PASS + 1)); }
bad() { echo "FAIL - $1"; FAIL=$((FAIL + 1)); }
check() { if (eval "$2"); then ok "$1"; else bad "$1"; fi; }

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
check "QA-ALL-1: the suite helper exists" "[[ -f scripts/lib/suite.sh ]]"
# shellcheck source=/dev/null
source scripts/lib/suite.sh 2>/dev/null || true

( suite_reset; suite "passing" true; suite "failing" false; suite_skip "deno" "Deno isn't installed"; suite_report ) >"$T/out" 2>&1; rc=$?
check "QA-ALL-1: one failing suite makes the run fail" "(( rc != 0 ))"
check "QA-ALL-1: the failing suite is named" "grep -q 'FAILED: failing' '$T/out'"
check "QA-ALL-1: a skipped suite is named with why" "grep -q \"SKIPPED: deno (Deno isn't installed)\" '$T/out'"

( suite_reset; suite "passing" true; suite_skip "deno" "Deno isn't installed"; suite_report ) >"$T/out" 2>&1; rc=$?
check "QA-ALL-1: skips alone don't fail the run (a sandbox without Deno can still pass)" "(( rc == 0 ))"
check "QA-ALL-1: the summary counts passed and skipped" "grep -q 'SUITES: 1 passed, 0 failed, 1 skipped' '$T/out'"

check "QA-ALL-1: test-all.sh uses the helper" "grep -q 'suite_report' test-all.sh"

# Nov 19 tech-debt review: "everything" really is everything, and CI runs what the docs say it runs.
check "QA-R1: test-all.sh runs the app's Jest" "grep -q 'app jest' test-all.sh"
check "QA-R1: test-all.sh runs the app's typecheck" "grep -q 'app typecheck' test-all.sh"
check "QA-R1: test-all.sh runs the demo and core-loop browser tests" "grep -q 'app e2e demo' test-all.sh && grep -q 'app e2e web' test-all.sh"
check "QA-R2: pull requests run the app's browser tests in CI" "grep -q 'npm run e2e:demo' .github/workflows/ci.yml && grep -q 'npm run e2e:web' .github/workflows/ci.yml"
check "QA-R3: qa-tdd's 3x rerun on CI includes the app's Jest" "python3 -c 'import json,sys; sys.exit(0 if \"jest\" in json.load(open(\"studio-checks.json\"))[\"agents\"][\"verify\"] else 1)'"
check "ENG-R8: app e2e scripts don't hard-code one machine's browser path" "! grep -q '/opt/pw-browsers' app/package.json"
check "ENG-R8: e2e/package.json is the repo's license, not npm init's" "grep -q '\"license\": \"AGPL-3.0-or-later\"' e2e/package.json"

echo "TEST-ALL RESULT: $PASS passed, $FAIL failed"
(( FAIL == 0 ))
