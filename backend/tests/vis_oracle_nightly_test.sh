#!/usr/bin/env bash
# VIS-12 (SPEC-VISIBILITY-CORE Phase 2, TRACKER R51): the nightly oracle job writes a dated matrix into
# backend/tests/results/. Written FIRST (Nov 24, 2026, qa-tdd): red until backend/tests/vis_oracle/nightly.sh exists.
#
# Contract for the engineer:
#   bash backend/tests/vis_oracle/nightly.sh [--seed N]      (from anywhere; local Postgres; DB from $DB)
#     - no --seed: picks a random seed and says which in the file name and the file
#     - builds a fresh database (stub, migrations, seed.sql), runs tests/vis_oracle_test.sql with -v vo_seed=N
#     - writes backend/tests/results/vis-oracle-<UTC date YYYY-MM-DD>-seed<N>.txt containing the
#       "VIS ORACLE MATRIX seed=N" block (path | kind | checked | wrong_yes | wrong_no), the mismatches and the
#       "VIS ORACLE RESULT:" line; ids and counts only (no emails, captions or names)
#     - exits 0 only when the oracle suite passed, so a nightly red is a red job
#   CI wiring (fixed seed on every PR via run.sh; random seed nightly in a workflow) is the architect's lane.
# Usage: bash backend/tests/vis_oracle_nightly_test.sh
set -uo pipefail
cd "$(dirname "$0")/.."
pass=0; fail=0
ok()  { echo "ok      $1"; pass=$((pass+1)); }
bad() { echo "NOT OK  $1"; fail=$((fail+1)); }

JOB=tests/vis_oracle/nightly.sh
SEED=4242
if [ -f "$JOB" ]; then
  ok "VIS-12 $JOB exists"
  d1=$(date -u +%F)
  out=$(DB=hearth_vo_nightly_test bash "$JOB" --seed "$SEED" 2>&1); code=$?
  d2=$(date -u +%F)
  f=""
  for d in "$d1" "$d2"; do [ -f "tests/results/vis-oracle-$d-seed$SEED.txt" ] && f="tests/results/vis-oracle-$d-seed$SEED.txt"; done
  if [ -n "$f" ]; then
    ok "VIS-12 --seed $SEED writes a dated matrix: $f"
    grep -q "VIS ORACLE MATRIX seed=$SEED" "$f" && ok "VIS-12 the matrix names its seed" || bad "VIS-12 the matrix names its seed (VIS ORACLE MATRIX seed=$SEED)"
    grep -Eq 'path.*kind.*checked.*wrong_yes.*wrong_no' "$f" && ok "VIS-12 the matrix has path, kind, checked, wrong_yes, wrong_no" \
      || bad "VIS-12 the matrix has path, kind, checked, wrong_yes, wrong_no"
    missing=""
    for p in feed timeline search post_by_id comments reply_readers reactions post_viewers sign_media family_dates chat_roster export table; do
      grep -Eq "^ *$p +\|" "$f" || missing="$missing $p"
    done
    [ -z "$missing" ] && ok "VIS-12 the matrix has a row for every read path" || bad "VIS-12 the matrix has a row for every read path  [missing:$missing]"
    grep -q '@' "$f" && bad "VIS-12 the matrix carries no email or other personal text ('@' found)" \
      || ok "VIS-12 the matrix carries no email or other personal text"
    if grep -q 'VIS ORACLE RESULT:' "$f"; then
      ok "VIS-12 the matrix ends with the suite's result line"
      if grep -q 'SOME TESTS FAILED' "$f"; then failed=1; else failed=0; fi
      { [ "$failed" = 1 ] && [ "$code" -ne 0 ]; } || { [ "$failed" = 0 ] && [ "$code" -eq 0 ]; } \
        && ok "VIS-12 the job's exit code follows the oracle (exit $code)" \
        || bad "VIS-12 the job's exit code follows the oracle (exit $code, failed=$failed)"
    else
      bad "VIS-12 the matrix ends with the suite's result line (VIS ORACLE RESULT:)"
    fi
    rm -f "$f"   # a test run leaves no results file behind
  else
    bad "VIS-12 --seed $SEED writes tests/results/vis-oracle-<date>-seed$SEED.txt  [exit $code: $(echo "$out" | tail -3 | tr '\n' ' ')]"
  fi
else
  bad "VIS-12 $JOB exists (the nightly oracle job; not built yet)"
fi
dropdb --if-exists hearth_vo_nightly_test >/dev/null 2>&1 || true
echo "VIS-12 nightly: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
