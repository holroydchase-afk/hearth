#!/usr/bin/env bash
# Local test run. For each suite: fresh DB -> Supabase stubs -> every migration (in order) -> seed -> suite.
#   tests/rls_test.sql  privacy rules (110+)
#   tests/api_test.sql  API.md contract: RPCs, error codes, idempotency, rate limits
#   tests/timeline_test.sql  get_timeline / get_timeline_years (BETA-TIME-2..4, migration 0010)
#   tests/groups_test.sql    groups, households, events, roles, share history (SPEC-GROUPS, migration 0011)
#   tests/timeline_future_test.sql  capture dates after the share date (BETA-TIME-2/4)
#   tests/privacy_audit_test.sql  PRIV-1: no raw IP addresses kept (migration 0012)
#   tests/groups_v2_test.sql  GRP-2..14, FLAG-1..4, EVT-1: plain groups, comment settings, feature flags (SPEC-GROUPS v2, migration 0013)
#   tests/chat_test.sql       MSG-1..8: messenger relay, MLS bytes only (SPEC-MESSENGER, migration 0015)
#   tests/photo_helpers_test.sql  HELP-R4: photo helper off-switches, on by default for posters (SPEC-PHOTO-HELPERS, migration 0016)
#   tests/reactions_test.sql  REACT-1..6: Love, Haha, Like (migration 0017); HARD-12: only through the RPCs (0018); REACT-12: Hooray (0023)
#   tests/captions_test.sql   CAP-1..3, 5..8, 10, 11, HARD-18: post titles (0019), changing the words (0021)
#   tests/video_cap_test.sql  S14-1..7: the free video cap counts per person, not per space (migration 0020)
#   tests/viewers_test.sql    WHO-1..5: who can see a post, by name, for everyone who can see it (migration 0022)
#   tests/start_family_test.sql  BETA-START-1, 3..8, 10..13: start a family, the switch, the cap (SPEC-START-FAMILY, migration 0024)
#   tests/suspend_family_test.sql  START-ON-3, -4: suspend/undo/known and the start switch, the SQL behind scripts/suspend-family.sh and start-family-switch.sh
#   tests/sms_test.sql        BETA-SMS-8, -9, -13, -15: phone invites, sign_in_with, push-only phone accounts, no numbers kept (SPEC-SMS-SIGN-IN)
#   tests/group_names_test.sql  SEC-R1: a group's name stays with the parents, also through the raw API and the export (migration 0027)
#   tests/auth_no_passwords_test.sql  TS-SEC-R1: no password hash ever stays in auth.users (migration 0028, docs/eng/AUTH-NO-PASSWORDS.md)
#   tests/family_dates_test.sql  CAL-1..10, CAL-18: the life calendar, birthdays and dates (SPEC-LIFE-CALENDAR, migration 0029)
#   tests/search_test.sql  SEARCH-1..14: find posts by words, sender and dates, only ones you can see (SPEC-SEARCH, migration 0025)
#   tests/vis_registry_test.sql  VIS-1, 3, 4, 5: the visibility coverage gate (SPEC-VISIBILITY-CORE C3; red until 0031+)
#   tests/vis_core_test.sql   VIS-7, 22, 24: vis.can_see / vis.sees_item agree with today's rules, never callable from the app
#   tests/vis_calendar_test.sql  VIS-18: the life calendar (0029) is a Person-class kind; can_see equals its RLS (Phase 5)
#   tests/vis_oracle_test.sql  VIS-8..11: the oracle across readers, fixed seed 42 (Phase 2, R51; generator tests/vis_oracle/generate.sql, migration 0033)
#   tests/vis_oracle_nightly_test.sh  VIS-12: the nightly job (tests/vis_oracle/nightly.sh) writes a dated matrix
#   tests/vis_gate_test.sh    VIS-2, 6, 23, 24: the gate bites (scratch table, second policy), edge functions, API schemas
#   ../packages/visibility/core/test.sql  VIS-19, 20, 23: the generic core's conformance kit, with a toy product (rolls back)
#   ../packages/visibility/core/no_product_words_test.sh  VIS-21: no Hearth words in the generic template
#   tests/vis_core_copy_test.sh  ARCH-VC-R1: 0031_vis_core.sql = packages/visibility/core/supabase.sql below its header
#   ../packages/messenger/relay/test.sql  RELAY-1..9: the shared messenger library's relay template
#   tests/aud16/  BETA-AUD-16: snapshot on 0001-0010, apply 0011+, diff (0011 must change nobody's access)
#   tests/grp1/   GRP-1/GRP-2: snapshot on 0001-0012, apply 0013+, diff (0013 must change nobody's access)
# Usage: tests/run.sh   (needs a local Postgres 15+; PGUSER must be a superuser)
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${DB:-hearth_test}
STATUS=0
# PRIV-R5 (family_dates_test.sql) opens a real second session with dblink, created by the test itself (never by a
# migration). dblink ships in Postgres's contrib modules: on Debian/Ubuntu, `apt-get install postgresql-contrib`.
if ! psql -d postgres -XAtqc "select 1 from pg_available_extensions where name = 'dblink'" | grep -q 1; then
  echo "tests/run.sh: the dblink extension isn't installed (install postgresql-contrib); PRIV-R5 needs it." >&2
  exit 1
fi
for suite in tests/rls_test.sql tests/api_test.sql tests/notify_test.sql tests/setup_test.sql tests/reply_test.sql tests/timeline_test.sql \
             tests/groups_test.sql tests/timeline_future_test.sql tests/privacy_audit_test.sql tests/groups_v2_test.sql tests/chat_test.sql \
             tests/photo_helpers_test.sql tests/reactions_test.sql tests/captions_test.sql tests/video_cap_test.sql tests/viewers_test.sql \
             tests/start_family_test.sql tests/suspend_family_test.sql tests/search_test.sql tests/sms_test.sql tests/group_names_test.sql tests/auth_no_passwords_test.sql \
             tests/family_dates_test.sql tests/vis_registry_test.sql tests/vis_core_test.sql tests/vis_calendar_test.sql \
             tests/vis_oracle_test.sql; do
  dropdb --if-exists "$DB"
  createdb "$DB"
  files=(-f tests/supabase_stub.sql)
  for m in supabase/migrations/*.sql; do files+=(-f "$m"); done
  files+=(-f supabase/seed.sql)
  psql -d "$DB" -v ON_ERROR_STOP=1 -q "${files[@]}"
  psql -d "$DB" -X -q -f "$suite" || STATUS=1
done

# BETA-AUD-16: who-sees-what snapshot before 0011, then 0011 and later, then the diff.
dropdb --if-exists "$DB"
createdb "$DB"
early=(-f tests/supabase_stub.sql); late=()
for m in supabase/migrations/*.sql; do
  n=$(basename "$m" | cut -c1-4)
  if [ "$((10#$n))" -le 10 ]; then early+=(-f "$m"); else late+=(-f "$m"); fi
done
early+=(-f supabase/seed.sql -f tests/aud16/before.sql)
psql -d "$DB" -v ON_ERROR_STOP=1 -q "${early[@]}"
if [ ${#late[@]} -gt 0 ]; then psql -d "$DB" -v ON_ERROR_STOP=1 -q "${late[@]}"; fi
psql -d "$DB" -X -q -f tests/aud16/after.sql || STATUS=1

# GRP-1: who-sees-what and who-reads-what snapshot before 0013, then 0013 and later, then the diff.
dropdb --if-exists "$DB"
createdb "$DB"
early=(-f tests/supabase_stub.sql); late=()
for m in supabase/migrations/*.sql; do
  n=$(basename "$m" | cut -c1-4)
  if [ "$((10#$n))" -le 12 ]; then early+=(-f "$m"); else late+=(-f "$m"); fi
done
early+=(-f supabase/seed.sql -f tests/grp1/before.sql)
psql -d "$DB" -v ON_ERROR_STOP=1 -q "${early[@]}"
if [ ${#late[@]} -gt 0 ]; then psql -d "$DB" -v ON_ERROR_STOP=1 -q "${late[@]}"; fi
psql -d "$DB" -X -q -f tests/grp1/after.sql || STATUS=1

# family-setup v2 dry run (SPEC-GROUPS section 8 step 3, privacy item 14)
bash tests/setup_v2_test.sh || STATUS=1
# one-command family setup through the Management API (SETUP-API; curl stubbed, SQL real)
bash tests/setup_api_test.sh || STATUS=1
# QA-3 sent vs received, read only, through the Management API (curl stubbed, SQL real)
bash tests/sent_received_test.sh || STATUS=1
# D1 read-only hosted smoke check (curl stubbed, SQL real and read-only)
bash tests/smoke_check_test.sh || STATUS=1
# START-ON-3/-4: suspend-family.sh and start-family-switch.sh (dry run by default, arguments, output; curl stubbed, SQL real)
bash tests/start_on_scripts_test.sh || STATUS=1
bash tests/auth_config_test.sh || STATUS=1  # PRIV-R1: phone numbers need a texted code
# RELAY-1..9: the shared messenger library's relay template, with a toy membership rule (rolls back)
dropdb --if-exists "$DB"; createdb "$DB"
psql -d "$DB" -v ON_ERROR_STOP=1 -X -q -f ../packages/messenger/relay/test.sql >/dev/null || { echo "relay template: FAILED" >&2; STATUS=1; }
# VIS-2, 6, 23, 24: the visibility gate bites (builds its own scratch databases)
bash tests/vis_gate_test.sh || STATUS=1
# VIS-19, 20, 23, 21: the generic visibility core's conformance kit (toy product, rolls back) and its word check
dropdb --if-exists "$DB"; createdb "$DB"
psql -d "$DB" -v ON_ERROR_STOP=1 -X -q -f ../packages/visibility/core/test.sql >/dev/null || { echo "visibility kit: FAILED" >&2; STATUS=1; }
bash ../packages/visibility/core/no_product_words_test.sh || STATUS=1
# ARCH-VC-R1: migration 0031 is the package's supabase.sql verbatim below its header (and the check bites)
bash tests/vis_core_copy_test.sh || STATUS=1
# VIS-12: the nightly oracle job, run once with a fixed seed (builds its own database)
bash tests/vis_oracle_nightly_test.sh || STATUS=1
exit $STATUS
