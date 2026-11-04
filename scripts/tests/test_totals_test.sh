#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Chase Holroyd
# TOTALS-1 (intake #94): scripts/test-totals.sh prints the real app test and database check totals,
# summed from the suites' own output, so public copy quotes a number a reader can reproduce.
#   bash scripts/tests/test_totals_test.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
PASS=0; FAIL=0
ok()  { echo "ok   - $1"; PASS=$((PASS + 1)); }
bad() { echo "FAIL - $1"; FAIL=$((FAIL + 1)); }
check() { if (eval "$2"); then ok "$1"; else bad "$1"; fi; }

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
check "TOTALS-1: the script exists" "[[ -f scripts/test-totals.sh ]]"

cat > "$T/sql.log" <<'EOF'
psql:tests/rls_test.sql:900: NOTICE:  RLS RESULT: 120 passed, 0 failed
psql:tests/api_test.sql:900: NOTICE:  API RESULT: 174 passed, 2 failed
SMOKE CHECK TEST RESULT: 28 passed, 0 failed
EOF
out=$(bash scripts/test-totals.sh --sql-log "$T/sql.log" 2>&1)
check "TOTALS-1: database checks are summed across every RESULT line" "grep -q 'Database checks: 322 passed, 2 failed' <<<\"\$out\""

cat > "$T/jest.json" <<'EOF'
{"numTotalTests": 700, "numPassedTests": 698, "numFailedTests": 0, "numPendingTests": 2, "numTotalTestSuites": 95}
EOF
out=$(bash scripts/test-totals.sh --jest-json "$T/jest.json" 2>&1)
check "TOTALS-1: app tests come from Jest's own JSON" "grep -q 'App tests: 698 passed, 0 failed, 2 skipped (95 files)' <<<\"\$out\""

check "TOTALS-1: the README says how to get the totals" "grep -q 'scripts/test-totals.sh' README.md"

echo "TEST-TOTALS RESULT: $PASS passed, $FAIL failed"
(( FAIL == 0 ))
