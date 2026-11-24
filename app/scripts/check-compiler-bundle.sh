#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Chase Holroyd
# INTAKE-80-2: the web exports were really built with the React Compiler. Compiled components cache values
# behind Symbol.for("react.memo_cache_sentinel"), and that string survives minify. react-dom defines the
# symbol once on its own, so one hit proves nothing: we need many (MIN, default 10) across the bundle.
#   bash app/scripts/check-compiler-bundle.sh [dist dir ...]     (default: app/dist-fake app/dist-demo)
# Run after `npm run export:web:fake` / `export:web:demo` (test-all.sh runs it after the e2e suites,
# which export first).
set -uo pipefail
cd "$(dirname "$0")/.."
MIN=${MIN:-10}
PASS=0; FAIL=0
ok()  { echo "ok   - $1"; PASS=$((PASS + 1)); }
bad() { echo "FAIL - $1"; FAIL=$((FAIL + 1)); }

DIRS=("$@"); [[ ${#DIRS[@]} -eq 0 ]] && DIRS=(dist-fake dist-demo)
for d in "${DIRS[@]}"; do
  js="$d/_expo/static/js/web"
  if ! compgen -G "$js/*.js" > /dev/null; then
    bad "INTAKE-80-2 $d has a web export (run the export first)"; continue
  fi
  n=$(cat "$js"/*.js | grep -o 'react\.memo_cache_sentinel' | wc -l)
  if (( n >= MIN )); then ok "INTAKE-80-2 $d is compiled ($n memo-cache sentinels)"
  else bad "INTAKE-80-2 $d is compiled: $n memo-cache sentinel(s), need $MIN+ (1 is react-dom's own)"; fi
done
echo "$PASS passed, $FAIL failed"
(( FAIL == 0 ))
