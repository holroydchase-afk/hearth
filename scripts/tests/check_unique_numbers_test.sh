#!/usr/bin/env bash
# NUM-1..NUM-6: tests for scripts/check-unique-numbers.sh [repo_root].
# Parallel threads kept claiming the same migration, DEC, ticket and run numbers.
set -u
cd "$(dirname "$0")/../.."
REAL=$(pwd)
pass=0; fail=0
ok()  { echo "ok      $1"; pass=$((pass+1)); }
bad() { echo "NOT OK  $1"; fail=$((fail+1)); }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

fixture() { # fresh clean root in $T/root
  rm -rf "$T/root"; mkdir -p "$T/root/backend/supabase/migrations" "$T/root/docs/product" "$T/root/tracker"
  : > "$T/root/backend/supabase/migrations/0001_a.sql"
  : > "$T/root/backend/supabase/migrations/0002_b.sql"
  printf '### DEC-1 · One\n\ntext\n\n### DEC-2 · Two\n' > "$T/root/docs/product/DECISION-LOG.md"
  cat > "$T/root/tracker/build_seed.py" <<'P'
TICKETS = [
 ("T1", "ticket", P, "High", "open", "One", []),
 ("B3", "bug", P, "Low", "fixed", "Two", []),
]
run("r1", suite="a", at="x")
run("r2", suite="b", at="x")
P
}
check() { out=$(bash scripts/check-unique-numbers.sh "$1" 2>&1); rc=$?; }
expect_fail() { [ $rc -ne 0 ] && echo "$out" | grep -q "$2" && ok "$1" || bad "$1  [rc=$rc: $out]"; }

fixture; touch "$T/root/backend/supabase/migrations/0002_c.sql"; check "$T/root"
expect_fail "NUM-1 duplicate migration prefix fails and names it" "0002"

fixture; printf '\n### DEC-2 · Again\n' >> "$T/root/docs/product/DECISION-LOG.md"; check "$T/root"
expect_fail "NUM-2 duplicate DEC heading fails and names it" "DEC-2"

fixture; sed -i 's/("B3", /("T1", /' "$T/root/tracker/build_seed.py"; check "$T/root"
expect_fail "NUM-3 duplicate ticket id fails and names it" "T1"

fixture; sed -i 's/run("r2"/run("r1"/' "$T/root/tracker/build_seed.py"; check "$T/root"
expect_fail "NUM-4 duplicate run id fails and names it" "r1"

fixture; check "$T/root"
[ $rc -eq 0 ] && ok "NUM-5 clean fixture passes" || bad "NUM-5 clean fixture passes  [rc=$rc: $out]"

check "$REAL"
[ $rc -eq 0 ] && ok "NUM-6 the real repo passes" || bad "NUM-6 the real repo passes  [rc=$rc: $out]"

echo "NUM RESULT: $pass passed, $fail failed"
[ $fail -eq 0 ]
