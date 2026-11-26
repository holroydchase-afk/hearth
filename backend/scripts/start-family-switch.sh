#!/usr/bin/env bash
# START-ON-4 (SPEC-START-FAMILY section 8): turn "start a family" (start_family_open) on or off, or print whether
# it is on, through the Supabase Management API (POST /v1/projects/{ref}/database/query), like family-setup.sh:
# no psql, no database password or URL. The SQL is scripts/start-family-switch.sql; only that one flag changes.
#   bash scripts/start-family-switch.sh on|off|status [--apply] [--print-sql]
# Dry run by default: without --apply nothing changes. Turning it on needs Chase's words and the go-live checklist
# in docs/eng/RUNBOOK-START-FAMILY.md. Needs SUPABASE_ACCESS_TOKEN (an environment secret, never in chat or git).
# --print-sql prints the request instead of sending it (no token needed).
set -euo pipefail
cd "$(dirname "$0")/.."

REF=${SUPABASE_PROJECT_REF:-}
[[ -n $REF ]] || { echo "start-family-switch: set SUPABASE_PROJECT_REF to your Supabase project ref (see ACCOUNTS.md)" >&2; exit 1; }
API=https://api.supabase.com/v1/projects/$REF/database/query
die() { echo "start-family-switch: $*" >&2; exit 1; }

MODE=""; APPLY=no; PRINT=0
while (( $# )); do
  case $1 in
    on|off|status)
      [[ -z $MODE ]] || die "give one of on|off|status, once"
      MODE=$1 ;;
    --apply) APPLY=yes ;;
    --print-sql) PRINT=1 ;;
    *) die "unknown argument $1: use on|off|status [--apply] [--print-sql]" ;;
  esac; shift
done
[[ -n $MODE ]] || die "missing on|off|status (status only prints whether it is on)"
(( PRINT )) || [[ -n ${SUPABASE_ACCESS_TOKEN:-} ]] || die "missing SUPABASE_ACCESS_TOKEN (add it as an environment secret)"

# The psql variables become SQL string literals (quotes doubled), never spliced raw.
SQL=$(python3 -I -c '
import sys
lit = lambda s: "'"'"'" + s.replace("'"'"'", "'"'"''"'"'") + "'"'"'"
body = open(sys.argv[1]).read()
for name, value in zip(("mode", "apply"), sys.argv[2:]):
    body = body.replace(":'"'"'" + name + "'"'"'", lit(value))
sys.stdout.write(body)
' scripts/start-family-switch.sql "$MODE" "$APPLY")

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
