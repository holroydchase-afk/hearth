#!/usr/bin/env bash
# Contract tests against the backend's real PostgREST harness. Restarts it (fresh DB) each run,
# because the S10 rate-limit test locks one user out for 10 minutes.
set -euo pipefail
cd "$(dirname "$0")/.."
BACKEND=../backend/tests/integration
J=$(mktemp)
bash "$BACKEND/start.sh" > "$J"
trap 'bash "$BACKEND/stop.sh" >/dev/null 2>&1 || true; rm -f "$J"' EXIT
get() { python3 -c "import json,sys;d=json.load(open('$J'));print(json.dumps(d$1) if isinstance(d$1,(dict,list)) else d$1)"; }
# QA-R1: jest keeps only one -t, so a -t given here is merged into the SupabaseApi filter instead of replacing it
# (or, before, being dropped so every case skipped).
PATTERN=""; ARGS=()
while (( $# )); do
  case $1 in
    -t|--testNamePattern) PATTERN=${2:-}; shift ;;
    -t=*|--testNamePattern=*) PATTERN=${1#*=} ;;
    -t?*) PATTERN=${1#-t} ;;
    *) ARGS+=("$1") ;;
  esac; shift
done
FILTER=SupabaseApi
[[ -z $PATTERN ]] || FILTER="SupabaseApi.*(?:$PATTERN)"
# START-ON-6: the harness flips start_family_open straight in its database (superuser, local only), so the 0024
# cases run with the starter_01.. pool instead of skipping.
HEARTH_DB_URL=${HEARTH_DB_URL:-dbname=${HARNESS_DB:-hearth_it}} \
HEARTH_API_URL=$(get "['url']") HEARTH_ANON_KEY=$(get "['anonKey']") HEARTH_SERVICE_KEY=$(get "['serviceRoleKey']") \
HEARTH_USERS_JSON=$(get "['users']") npx jest --ci src/api/contract -t "$FILTER" --verbose ${ARGS[@]+"${ARGS[@]}"}
