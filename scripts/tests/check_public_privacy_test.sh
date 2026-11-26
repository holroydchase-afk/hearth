#!/usr/bin/env bash
# INTAKE-176B (privacy sweep part 2): tests for scripts/check-public-privacy.sh. The fixtures use the fake ref
# abcdefghijklmnopqrst; the real hosted ref is never written here. PRIV-PUB-5 runs the guard on this repo.
set -u
cd "$(dirname "$0")/../.."
G=$PWD/scripts/check-public-privacy.sh
pass=0; fail=0
ok()  { echo "ok      $1"; pass=$((pass+1)); }
bad() { echo "NOT OK  $1"; fail=$((fail+1)); }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
FAKE=abcdefghijklmnopqrst
fixture() { rm -rf "$T/r"; mkdir -p "$T/r/backend/scripts" "$T/r/backend/tests/results" "$T/r/e2e/results" "$T/r/docs"; }

fixture; echo 'REF=${SUPABASE_PROJECT_REF:?set SUPABASE_PROJECT_REF}' > "$T/r/backend/scripts/deploy.sh"
echo '{"url":"https://mcp.supabase.com/mcp?project_ref=${SUPABASE_PROJECT_REF}&read_only=true"}' > "$T/r/.mcp.json"
echo 'Lake weekend' > "$T/r/docs/a.md"
out=$(bash "$G" "$T/r"); rc=$?
[ $rc -eq 0 ] && ok "PRIV-PUB-1 a clean tree passes (env-only REF, env expansion in .mcp.json, no Charleston, no artifact link)" || bad "PRIV-PUB-1 clean tree  [rc=$rc: $out]"

fixture; echo "REF=\${SUPABASE_PROJECT_REF:-$FAKE}" > "$T/r/backend/scripts/deploy.sh"
out=$(bash "$G" "$T/r"); rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q 'deploy.sh' && ! echo "$out" | grep -q "$FAKE" && ok "PRIV-PUB-2 a :-<20-char> REF default in backend/scripts fails, naming the file but not the ref" || bad "PRIV-PUB-2 REF default  [rc=$rc: $out]"

fixture; echo "{\"url\":\"https://mcp.supabase.com/mcp?project_ref=$FAKE&read_only=true\"}" > "$T/r/.mcp.json"
out=$(bash "$G" "$T/r"); rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q '.mcp.json' && ! echo "$out" | grep -q "$FAKE" && ok "PRIV-PUB-3 a 20-char ref in .mcp.json fails, without printing it" || bad "PRIV-PUB-3 .mcp.json ref  [rc=$rc: $out]"

fixture; echo 'x trip: Charleston' > "$T/r/docs/a.md"; echo 'Charleston' > "$T/r/backend/tests/results/old.txt"; echo 'Charleston' > "$T/r/e2e/results/old.txt"
out=$(bash "$G" "$T/r"); rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q 'docs/a.md' && ! echo "$out" | grep -q 'results' && ok "PRIV-PUB-4a 'Charleston' in a doc fails; the frozen results history is left alone" || bad "PRIV-PUB-4a Charleston  [rc=$rc: $out]"
fixture; echo 'Charleston' > "$T/r/backend/tests/results/old.txt"; echo 'Charleston' > "$T/r/e2e/results/old.txt"
bash "$G" "$T/r" >/dev/null; [ $? -eq 0 ] && ok "PRIV-PUB-4b only the results history mentions it: passes" || bad "PRIV-PUB-4b results history only"
fixture; echo 'see https://claude.ai/artifact/abc' > "$T/r/docs/a.md"
out=$(bash "$G" "$T/r"); rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q 'docs/a.md' && ok "PRIV-PUB-4c a claude.ai artifact link fails" || bad "PRIV-PUB-4c artifact link  [rc=$rc: $out]"
fixture; echo 'see https://claude.ai/code/artifact/abc' > "$T/r/docs/a.md"
bash "$G" "$T/r" >/dev/null; [ $? -ne 0 ] && ok "PRIV-PUB-4d a claude.ai/code/artifact link fails" || bad "PRIV-PUB-4d code artifact link"

out=$(bash "$G"); rc=$?
[ $rc -eq 0 ] && ok "PRIV-PUB-5 this repo has no REF default, no ref in .mcp.json, no Charleston outside the results history, no artifact link" || bad "PRIV-PUB-5 this repo  [$(echo "$out" | wc -l) hits; first: $(echo "$out" | head -1)]"
grep -q 'check-public-privacy' test-all.sh && grep -q 'check-public-privacy' .github/workflows/ci.yml && ok "PRIV-PUB-6 test-all.sh and CI both run the guard" || bad "PRIV-PUB-6 wired into test-all.sh and CI"
echo; echo "PUBLIC PRIVACY RESULT: $pass passed, $fail failed"
[ $fail -eq 0 ]
