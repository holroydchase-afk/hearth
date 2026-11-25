#!/usr/bin/env bash
# ARCH-VC-R1 (P1, architect review of the visibility core, Nov 24, 2026): migration 0031_vis_core.sql must be
# packages/visibility/core/supabase.sql verbatim below its header (the header ends at the first blank line).
# A drift in either file fails the build. The self-test proves the check bites on a scratch drift each way.
# Usage (from anywhere): bash backend/tests/vis_core_copy_test.sh
#   VIS_MIGRATION / VIS_PACKAGE override the two paths (used by the self-test, and to show it red on purpose).
set -uo pipefail
cd "$(dirname "$0")/.."
MIG=${VIS_MIGRATION:-supabase/migrations/0031_vis_core.sql}
PKG=${VIS_PACKAGE:-../packages/visibility/core/supabase.sql}
pass=0; fail=0
ok()  { echo "ok      $1"; pass=$((pass+1)); }
bad() { echo "NOT OK  $1"; fail=$((fail+1)); }

# same_copy <migration> <package>: 0 when the migration minus its header equals the package, byte for byte.
same_copy() {
  [ -f "$1" ] && [ -f "$2" ] || return 2
  diff -q <(awk 'f{print} !f && /^$/{f=1}' "$1") "$2" >/dev/null
}

if same_copy "$MIG" "$PKG"; then
  ok "ARCH-VC-R1 $MIG below its header is $PKG verbatim"
else
  bad "ARCH-VC-R1 $MIG below its header is $PKG verbatim  [$(diff <(awk 'f{print} !f && /^$/{f=1}' "$MIG") "$PKG" 2>&1 | head -4 | tr '\n' ' ')]"
fi

# Self-test: only on the real files (so an override shows plain red), and only when the control passes.
if [ -z "${VIS_MIGRATION:-}${VIS_PACKAGE:-}" ]; then
  T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
  cp "$PKG" "$T/pkg.sql"; echo "-- a scratch change in the package only" >> "$T/pkg.sql"
  cp "$MIG" "$T/mig.sql"; sed -i '0,/vis.can_see/s//vis.can_see_drifted/' "$T/mig.sql"
  if same_copy "$MIG" "$PKG" && ! same_copy "$MIG" "$T/pkg.sql"; then
    ok "ARCH-VC-R1 bites: a scratch change to the package alone fails the check"
  else bad "ARCH-VC-R1 bites: a scratch change to the package alone fails the check"; fi
  if same_copy "$MIG" "$PKG" && ! same_copy "$T/mig.sql" "$PKG"; then
    ok "ARCH-VC-R1 bites: a scratch edit to migration 0031 alone fails the check"
  else bad "ARCH-VC-R1 bites: a scratch edit to migration 0031 alone fails the check"; fi
  if ! same_copy "$T/missing.sql" "$PKG"; then ok "ARCH-VC-R1 a missing migration fails the check, not passes it"
  else bad "ARCH-VC-R1 a missing migration fails the check, not passes it"; fi
fi

echo "VIS CORE COPY RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
