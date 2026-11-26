#!/usr/bin/env bash
# INTAKE-176B: the public repo must not carry the real hosted project ref, a real-family event name, or
# claude.ai artifact links. Fails (exit 1, one line per hit, never printing a matched ref) on:
#   1. a :-<20 lowercase letters or digits> default in backend/scripts (REF=${SUPABASE_PROJECT_REF:-<ref>})
#   2. a 20-character project ref in .mcp.json
#   3. the word "Charleston" anywhere but the frozen run histories (backend/tests/results, e2e/results)
#   4. any claude.ai/artifact or claude.ai/code/artifact link
# Usage: bash scripts/check-public-privacy.sh [repo_root]
set -u
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT" || exit 2
rc=0
hit() { echo "PRIVACY: $1"; rc=1; }

if [ -d backend/scripts ]; then
  while IFS= read -r f; do hit "$f has a project ref as a :- default; require SUPABASE_PROJECT_REF from the environment"; done \
    < <(grep -rlE ':-[a-z0-9]{20}([^a-z0-9]|$)' backend/scripts 2>/dev/null)
fi
if [ -f .mcp.json ] && grep -qE '(^|[^a-z0-9])[a-z0-9]{20}([^a-z0-9]|$)' .mcp.json; then
  hit ".mcp.json carries a 20-character project ref; use \${SUPABASE_PROJECT_REF}"
fi
scan() { # $1 label, $2 regex
  grep -rIlE -i "$2" . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=results \
    --exclude=check-public-privacy.sh --exclude=check_public_privacy_test.sh 2>/dev/null |
    while IFS= read -r f; do hit "$f: $1"; done
}
out=$(scan "the word Charleston (a real-family detail; say 'Lake weekend')" 'charleston'; \
      scan "a claude.ai artifact link" 'claude\.ai/(code/)?artifact')
[ -n "$out" ] && { echo "$out"; rc=1; }
[ $rc -eq 0 ] && echo "check-public-privacy: ok"
exit $rc
