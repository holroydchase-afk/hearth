#!/usr/bin/env bash
# INTAKE-176B REF-REQ-1..6: every backend script needs SUPABASE_PROJECT_REF from the environment. Unset, it stops
# at once with one plain line naming the variable, before any network call. curl is stubbed; no ref is baked in.
#   bash tests/ref_required_test.sh
set -uo pipefail
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok()  { echo "ok   - $1"; PASS=$((PASS + 1)); }
bad() { echo "FAIL - $1"; FAIL=$((FAIL + 1)); }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin"
printf '#!/usr/bin/env bash\necho "$*" >> "$STUB_LOG"\nexit 22\n' > "$T/bin/curl"; chmod +x "$T/bin/curl"
runit() { # name args... : the script with a fake token, a stub curl and NO project ref
  local s=$1; shift; : > "$T/log"
  env -u SUPABASE_PROJECT_REF SUPABASE_ACCESS_TOKEN=fake-token PATH="$T/bin:$PATH" STUB_LOG="$T/log" bash "scripts/$s" "$@" 2>&1
}
case_() { # id script args...
  local id=$1 s=$2; shift 2
  local out rc; out=$(runit "$s" "$@"); rc=$?
  if (( rc != 0 )) && (( $(printf '%s\n' "$out" | grep -c .) == 1 )) && [[ $out == *SUPABASE_PROJECT_REF* ]] \
     && [[ ! -s $T/log ]] && ! grep -qE 'projects/[a-z0-9]{20}' <<< "$out"; then ok "$id $s without SUPABASE_PROJECT_REF stops with one line naming it, no network call"
  else bad "$id $s without SUPABASE_PROJECT_REF  [rc=$rc, curl calls: $(wc -l < "$T/log"), out: $(printf '%s' "$out" | head -2 | tr '\n' '|' | cut -c1-120)]"; fi
}
case_ REF-REQ-1 deploy.sh --dry-run
case_ REF-REQ-2 family-setup.sh --chase-email a@example.com --space-name Kids
case_ REF-REQ-3 suspend-family.sh --space 00000000-0000-0000-0000-000000000001
case_ REF-REQ-4 start-family-switch.sh status
case_ REF-REQ-5 smoke-check.sh
case_ REF-REQ-6 sent-vs-received.sh --sender-email a@example.com --receiver-email b@example.com
echo; echo "REF REQUIRED RESULT: $PASS passed, $FAIL failed"
[ $FAIL -eq 0 ]
