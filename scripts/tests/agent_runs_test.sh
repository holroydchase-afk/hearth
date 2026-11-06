#!/usr/bin/env bash
# AGENTRUN-1..6: tests for running a studio agent as a general-purpose subagent and still leaving an
# honest run-log entry. Cloud project threads can't load the studio agent types, so the PreToolUse hook
# never fires; scripts/log-agent-run.sh --as <agent> logs "<time> <agent> via-general-purpose" instead,
# scripts/check-agent-runs.sh accepts that line, and scripts/agent-prompt.sh builds the subagent prompt.
# Fixtures live in a temp dir; the real repo is only read (AGENTRUN-6 runs from its root).
set -u
cd "$(dirname "$0")/../.."
ROOT=$PWD
pass=0; fail=0
ok()  { echo "ok      $1"; pass=$((pass+1)); }
bad() { echo "NOT OK  $1"; fail=$((fail+1)); }
check() { if (eval "$2"); then ok "$1"; else bad "$1"; fi; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

# A git repo fixture on branch claude/x-y with two agents and copies of the real scripts.
F=$T/repo; LOG=$F/.claude/agent-runs/claude-x-y.log
mkdir -p "$F/.claude/agents" "$F/scripts"
printf -- '---\nname: qa-tdd\ntools: Read, Bash\n---\nQA body.\n' > "$F/.claude/agents/qa-tdd.md"
printf -- '---\nname: engineer\ntools: Read, Bash\n---\nEngineer body.\n' > "$F/.claude/agents/engineer.md"
printf '{"agents":{"verify":"true","runs":1}}\n' > "$F/studio-checks.json"
for s in log-agent-run.sh check-agent-runs.sh; do [ -f "$ROOT/scripts/$s" ] && cp "$ROOT/scripts/$s" "$F/scripts/"; done
git -C "$F" init -q -b claude/x-y 2>/dev/null || { git -C "$F" init -q && git -C "$F" checkout -q -b claude/x-y; }
reset_log() { rm -rf "$F/.claude/agent-runs"; }
logas() { (cd "$F" && env -u CLAUDE_PROJECT_DIR timeout 5 bash scripts/log-agent-run.sh "$@" </dev/null >/dev/null 2>&1); }
checkruns() { (cd "$F" && BODY="$1" HEAD_REF=claude/x-y bash scripts/check-agent-runs.sh >/dev/null 2>&1); }

# AGENTRUN-1
reset_log; logas --as qa-tdd; rc=$?
check "AGENTRUN-1 --as qa-tdd exits 0 without reading stdin or hanging" '(( rc == 0 ))'
check "AGENTRUN-1 --as qa-tdd appends one '<UTC time> qa-tdd via-general-purpose' line to the branch log" \
  '[[ -f $LOG ]] && (( $(wc -l < "$LOG") == 1 )) && grep -qE "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8}Z qa-tdd via-general-purpose$" "$LOG"'
logas --as qa-tdd
check "AGENTRUN-1 a second --as run appends rather than overwrites" '[[ -f $LOG ]] && (( $(wc -l < "$LOG") == 2 ))'

# AGENTRUN-2
reset_log; logas --as nobody; rc=$?
check "AGENTRUN-2 --as with no .claude/agents/<name>.md exits non-zero" '(( rc != 0 ))'
check "AGENTRUN-2 --as with an unknown agent writes nothing" '[[ ! -s $LOG ]]'
reset_log; logas --as; rc=$?
check "AGENTRUN-2 --as with no name exits non-zero and writes nothing" '(( rc != 0 )) && [[ ! -s $LOG ]]'

# AGENTRUN-3
reset_log
printf '{"tool_input":{"subagent_type":"qa-tdd"},"cwd":"%s"}' "$F" | (cd "$F" && CLAUDE_PROJECT_DIR=$F timeout 5 bash scripts/log-agent-run.sh >/dev/null 2>&1); rc=$?
check "AGENTRUN-3 hook mode still exits 0" '(( rc == 0 ))'
check "AGENTRUN-3 hook mode still appends '<UTC time> qa-tdd' with no via suffix" \
  '[[ -f $LOG ]] && (( $(wc -l < "$LOG") == 1 )) && grep -qE "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8}Z qa-tdd$" "$LOG"'

# AGENTRUN-4
reset_log; mkdir -p "$F/.claude/agent-runs"
echo "2026-11-06T12:00:00Z qa-tdd via-general-purpose" > "$LOG"
check "AGENTRUN-4 check-agent-runs accepts a 'qa-tdd via-general-purpose' log line" 'checkruns "Agents: qa-tdd red then green, 3x"'
echo "2026-11-06T12:00:00Z qa-tdd" > "$LOG"
check "AGENTRUN-4 check-agent-runs still accepts a plain hook line" 'checkruns "Agents: qa-tdd red then green, 3x"'

# AGENTRUN-5
echo "2026-11-06T12:00:00Z engineer via-general-purpose" > "$LOG"
check "AGENTRUN-5 check-agent-runs fails when only another agent ran via general-purpose" '! checkruns "Agents: qa-tdd red then green, 3x"'
echo "2026-11-06T12:00:00Z qa-tddx via-general-purpose" > "$LOG"
check "AGENTRUN-5 check-agent-runs fails on a lookalike name (qa-tddx via-general-purpose)" '! checkruns "Agents: qa-tdd red then green, 3x"'
echo "2026-11-06T12:00:00Z qa-tdd via-something-else" > "$LOG"
check "AGENTRUN-5 check-agent-runs fails on an unknown suffix (qa-tdd via-something-else)" '! checkruns "Agents: qa-tdd red then green, 3x"'

# AGENTRUN-6 (real repo root)
task="Write the failing test for X"
out=$(cd "$ROOT" && timeout 5 bash scripts/agent-prompt.sh qa-tdd "$task" </dev/null 2>/dev/null); rc=$?
tools=$(awk 'NR>1&&$0=="---"{exit} /^tools:/{sub(/^tools:[[:space:]]*/,"");print}' "$ROOT/.claude/agents/qa-tdd.md")
check "AGENTRUN-6 agent-prompt.sh qa-tdd exits 0" '(( rc == 0 )) && [[ -n $out ]]'
check "AGENTRUN-6 the prompt holds the agent body" '[[ $out == *"You never fix product code"* ]]'
check "AGENTRUN-6 the prompt drops the YAML frontmatter" '! printf "%s\n" "$out" | grep -qE "^(description|name|tools):"'
check "AGENTRUN-6 the prompt tells the subagent to run 'bash scripts/log-agent-run.sh --as qa-tdd' first" \
  'pre=${out%%You never fix product code*}; [[ $out == *"bash scripts/log-agent-run.sh --as qa-tdd"* && $pre == *"bash scripts/log-agent-run.sh --as qa-tdd"* ]]'
check "AGENTRUN-6 the prompt names the frontmatter tools" '[[ -n $tools && $out == *"$tools"* ]]'
check "AGENTRUN-6 the prompt ends with the task under a '## Your task' heading" \
  '[[ $(printf "%s\n" "$out" | grep -E "^## " | tail -n 1) == "## Your task" ]] && [[ $(printf "%s\n" "$out" | sed "/^[[:space:]]*$/d" | tail -n 1) == "$task" ]]'
(cd "$ROOT" && timeout 5 bash scripts/agent-prompt.sh nobody "x" </dev/null >/dev/null 2>&1); rc=$?
check "AGENTRUN-6 agent-prompt.sh with an unknown agent exits non-zero" '(( rc != 0 ))'

echo "AGENT RUNS RESULT: $pass passed, $fail failed"
[ $fail -eq 0 ]
