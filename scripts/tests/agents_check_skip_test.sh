#!/usr/bin/env bash
# AGENTSKIP-1..4: studio rule "qa-tdd cannot be skipped on a code PR" (intake issue #149).
# Extracts the run: block of the "Agents line in the PR body" step from .github/workflows/agents-check.yml
# and runs it in a temp git fixture with BASE/HEAD/BODY set, the way GitHub Actions does.
# A code PR may say "qa-tdd skipped: docs only" or "config only"; any other skip reason fails.
set -u
cd "$(dirname "$0")/../.."
ROOT=$PWD
pass=0; fail=0
ok()  { echo "ok      $1"; pass=$((pass+1)); }
bad() { echo "NOT OK  $1"; fail=$((fail+1)); }
check() { if (eval "$2"); then ok "$1"; else bad "$1"; fi; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

# The step's run: block, with its YAML indent stripped.
STEP=$T/step.sh
awk '
  /^[[:space:]]*- name: Agents line in the PR body[[:space:]]*$/ { instep=1; next }
  instep && !inrun && /^[[:space:]]*- / { exit }
  instep && !inrun && /^[[:space:]]*run: \|[[:space:]]*$/ { inrun=1; match($0,/^[[:space:]]*/); rind=RLENGTH; next }
  inrun {
    if ($0 ~ /^[[:space:]]*$/) { print ""; next }
    match($0,/^[[:space:]]*/)
    if (RLENGTH <= rind) exit
    if (!ind) ind=RLENGTH
    print substr($0, ind+1)
  }' "$ROOT/.github/workflows/agents-check.yml" > "$STEP"
check "AGENTSKIP-0 the 'Agents line in the PR body' run: block is found in agents-check.yml" '[[ -s $STEP ]] && grep -q "agents:" "$STEP"'

# Fixture: one base commit, then a code branch (scripts/x.sh) and a docs-only branch (docs/x.md).
F=$T/repo; mkdir -p "$F"
g() { git -C "$F" -c user.name=t -c user.email=t@t -c commit.gpgsign=false "$@" >/dev/null 2>&1; }
g init -q; echo base > "$F/README.md"; g add -A; g commit -qm base
BASE=$(git -C "$F" rev-parse HEAD)
g checkout -q -b code; mkdir -p "$F/scripts"; echo 'echo hi' > "$F/scripts/x.sh"; g add -A; g commit -qm code
CODE=$(git -C "$F" rev-parse HEAD)
g checkout -q "$BASE"; g checkout -q -b docs; mkdir -p "$F/docs"; echo notes > "$F/docs/x.md"; g add -A; g commit -qm docs
DOCS=$(git -C "$F" rev-parse HEAD)
step() { (cd "$F" && BASE=$BASE HEAD=$1 BODY=$2 bash -e "$STEP" >/dev/null 2>&1); }

# AGENTSKIP-1: a code PR can't skip qa-tdd for just any reason
check "AGENTSKIP-1 code PR + 'Agents: qa-tdd skipped: no run log' fails" '! step "$CODE" "Agents: qa-tdd skipped: no run log"'

# AGENTSKIP-2: the two allowed skip reasons still pass on a code PR
check "AGENTSKIP-2 code PR + 'Agents: qa-tdd skipped: docs only' passes" 'step "$CODE" "Agents: qa-tdd skipped: docs only"'
check "AGENTSKIP-2 code PR + 'Agents: qa-tdd skipped: config only' passes" 'step "$CODE" "Agents: qa-tdd skipped: config only"'

# AGENTSKIP-3: a real qa-tdd run passes; a docs-only PR may skip for any reason
check "AGENTSKIP-3 code PR + 'Agents: qa-tdd red then green, 3x' passes" 'step "$CODE" "Agents: qa-tdd red then green, 3x"'
check "AGENTSKIP-3 docs-only PR + 'Agents: qa-tdd skipped: whatever' passes" 'step "$DOCS" "Agents: qa-tdd skipped: whatever"'

# AGENTSKIP-4: existing rules hold
check "AGENTSKIP-4 code PR with no qa-tdd on the Agents line fails" '! step "$CODE" "Agents: staff-pm scoped it; engineer built it"'
check "AGENTSKIP-4 PR body with no Agents line fails" '! step "$CODE" "Fixes a thing."'

echo "AGENTS SKIP RESULT: $pass passed, $fail failed"
(( fail == 0 ))
