#!/usr/bin/env bash
# START-ON-3 (SPEC-START-FAMILY section 8, PRIV-R7): suspend a family someone reported, bring it back, or mark it
# known (lift its cap), through the Supabase Management API (POST /v1/projects/{ref}/database/query), like
# family-setup.sh: no psql, no database password or URL. The SQL is scripts/suspend-family.sql.
#   bash scripts/suspend-family.sh --space <space id> [--undo | --known] [--apply] [--print-sql]
# Dry run by default: without --apply nothing changes and it says what would. Suspending hides the family from every
# member (not found) and refuses uploads; purge_soft_deleted removes it for good after 30 days, and --undo before
# then brings it back unchanged. Output carries only the space id. Needs SUPABASE_ACCESS_TOKEN (an environment
# secret, never in chat or git). --print-sql prints the request instead of sending it (no token needed).
# Runbook: docs/eng/RUNBOOK-START-FAMILY.md.
set -euo pipefail
cd "$(dirname "$0")/.."

REF=${SUPABASE_PROJECT_REF:-jqvgjfbhzbvfdhtnvgzr}
API=https://api.supabase.com/v1/projects/$REF/database/query
die() { echo "suspend-family: $*" >&2; exit 1; }

SPACE=""; ACTION=suspend; SET=0; APPLY=no; PRINT=0
while (( $# )); do
  case $1 in
    --space) SPACE=${2:-}; shift ;;
    --undo|--known)
      (( SET == 0 )) || die "use one of --undo or --known, not both"
      ACTION=${1#--}; SET=1 ;;
    --apply) APPLY=yes ;;
    --print-sql) PRINT=1 ;;
    *) die "unknown option $1 (see the top of $0)" ;;
  esac; shift
done
[[ -n $SPACE ]] || die "missing --space (the family's space id)"
[[ $SPACE =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] \
  || die "--space must be a space id (a uuid like 01234567-89ab-cdef-0123-456789abcdef)"
(( PRINT )) || [[ -n ${SUPABASE_ACCESS_TOKEN:-} ]] || die "missing SUPABASE_ACCESS_TOKEN (add it as an environment secret)"

# The psql variables become SQL string literals (quotes doubled), never spliced raw.
SQL=$(python3 -I -c '
import sys
lit = lambda s: "'"'"'" + s.replace("'"'"'", "'"'"''"'"'") + "'"'"'"
body = open(sys.argv[1]).read()
for name, value in zip(("space_id", "action", "apply"), sys.argv[2:]):
    body = body.replace(":'"'"'" + name + "'"'"'", lit(value))
sys.stdout.write(body)
' scripts/suspend-family.sql "$SPACE" "$ACTION" "$APPLY")

if (( PRINT )); then echo "POST $API"; echo "$SQL"; exit 0; fi

if out=$(python3 -I -c 'import json, sys; sys.stdout.write(json.dumps({"query": sys.stdin.read()}))' <<< "$SQL" |
  curl -sS --fail-with-body -X POST "$API" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
    --data-binary @-); then
  python3 -I -c 'import json, sys; [print(r["line"]) for r in json.load(sys.stdin)]' <<< "$out"
else
  msg=$(python3 -I -c 'import json, sys; print(json.load(sys.stdin).get("message", ""))' <<< "$out" 2>/dev/null || echo "$out")
  die "nothing was changed. The API said: $msg"
fi
