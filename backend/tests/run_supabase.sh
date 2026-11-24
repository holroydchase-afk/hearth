#!/usr/bin/env bash
# S16: the SQL suites on a REAL local Supabase stack (`supabase start`), not the auth stub.
# Each suite gets a fresh `supabase db reset` (all migrations + seed.sql, applied by the CLI).
# Usage (from backend/): supabase start && tests/run_supabase.sh
# Env: SUPABASE_CLI (default: npx --yes supabase@2.121.0)
#      SUPABASE_TEST_DB_URL (default: the local stack's superuser, like tests/run.sh uses locally)
set -euo pipefail
cd "$(dirname "$0")/.."
SB=${SUPABASE_CLI:-npx --yes supabase@2.121.0}
DB_URL=${SUPABASE_TEST_DB_URL:-postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres}
STATUS=0
for suite in tests/rls_test.sql tests/api_test.sql tests/notify_test.sql tests/setup_test.sql tests/reply_test.sql tests/privacy_audit_test.sql tests/groups_v2_test.sql \
             tests/vis_registry_test.sql tests/vis_core_test.sql; do
  echo "== $suite (fresh db reset)" >&2
  $SB db reset --local >&2
  psql "$DB_URL" -X -q -f "$suite" || STATUS=1
done
# SETUP-API on the real stack: the setup switches to the authenticated role as Chase, like the hosted API call
echo "== tests/setup_api_test.sh (fresh db reset)" >&2
$SB db reset --local >&2
SETUP_TEST_DB_URL=$DB_URL bash tests/setup_api_test.sh || STATUS=1
# RELAY-1..9: the shared messenger library's relay template on the real stack (one transaction, rolled back)
echo "== ../packages/messenger/relay/test.sql" >&2
psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q -f ../packages/messenger/relay/test.sql >/dev/null || STATUS=1
# VIS-19, 20, 23: the generic visibility core's conformance kit on the real stack (toy product, rolled back);
# VIS-21: its word check. VIS-2/6/23 gate bites (tests/vis_gate_test.sh) build scratch databases, so they run in tests/run.sh.
# The kit installs the template itself, and Hearth's 0030 already made `vis` in postgres, so it gets its own database
# on the same server (Supabase's roles are cluster-wide; the kit stubs auth).
echo "== ../packages/visibility/core/test.sql (scratch database vis_kit)" >&2
KIT_URL="${DB_URL%/*}/vis_kit"
psql "$DB_URL" -X -q -c "drop database if exists vis_kit" -c "create database vis_kit" >&2 || STATUS=1
psql "$KIT_URL" -v ON_ERROR_STOP=1 -X -q -f ../packages/visibility/core/test.sql >/dev/null || STATUS=1
psql "$DB_URL" -X -q -c "drop database if exists vis_kit" >&2 || true
bash ../packages/visibility/core/no_product_words_test.sh || STATUS=1
exit $STATUS
