#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Chase Holroyd
# TOTALS-1 (intake #94): print Hearth's real test totals, summed from the suites' own output.
#   bash scripts/test-totals.sh                 run app Jest and backend SQL, then print both totals
#   bash scripts/test-totals.sh --jest-json F   only sum an existing Jest --json file
#   bash scripts/test-totals.sh --sql-log F     only sum an existing backend tests/run.sh log
# Needs a local Postgres 15+ for the database checks (see CLAUDE.md "Commands").
set -uo pipefail
cd "$(dirname "$0")/.."

jest_totals() {
  node -e '
    const r = require(require("path").resolve(process.argv[1]));
    console.log(`App tests: ${r.numPassedTests} passed, ${r.numFailedTests} failed, ${r.numPendingTests} skipped (${r.numTotalTestSuites} files)`);
    process.exit(r.numFailedTests ? 1 : 0);
  ' "$1"
}
sql_totals() {
  grep -oE 'RESULT: [0-9]+ passed, [0-9]+ failed' "$1" |
    awk '{p += $2; f += $4} END {printf "Database checks: %d passed, %d failed\n", p, f; exit (f > 0)}'
}

case "${1:-}" in
  --jest-json) jest_totals "$2"; exit ;;
  --sql-log) sql_totals "$2"; exit ;;
esac

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
rc=0
(cd app && npx jest --silent --json --outputFile="$T/jest.json" >/dev/null 2>&1)
if [[ -s "$T/jest.json" ]]; then jest_totals "$T/jest.json" || rc=1; else echo "App tests: Jest did not run"; rc=1; fi
if pg_isready -q 2>/dev/null; then
  (cd backend && bash tests/run.sh) > "$T/sql.log" 2>&1 || rc=1
  sql_totals "$T/sql.log" || rc=1
else
  echo "Database checks: skipped (no local Postgres running)"; rc=1
fi
exit $rc
