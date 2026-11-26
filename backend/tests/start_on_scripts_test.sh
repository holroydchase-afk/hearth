#!/usr/bin/env bash
# START-ON-3, START-ON-4 (SPEC-START-FAMILY section 8, PRIV-R7): Chase's two service-role scripts, sent through the
# Supabase Management API (POST /v1/projects/{ref}/database/query) with only SUPABASE_ACCESS_TOKEN, like family-setup.sh.
#   bash scripts/suspend-family.sh --space <uuid> [--undo | --known] [--apply] [--print-sql]
#   bash scripts/start-family-switch.sh on|off|status [--apply] [--print-sql]
# Dry run by default: without --apply nothing changes and the output says so. Output carries only the space id: no
# family name, member name or email. What the SQL does to the data is tests/suspend_family_test.sql; this checks the
# wrappers: arguments, the dry-run default, the output, the token, one request, no psql.
# curl is stubbed: the stub runs the posted SQL with psql against a local test database, so the SQL is real.
#   bash tests/start_on_scripts_test.sh
set -uo pipefail
cd "$(dirname "$0")/.."
# INTAKE-176B: the scripts take the project ref from the environment only; tests use a fake one.
export SUPABASE_PROJECT_REF=abcdefghijklmnopqrst
PASS=0; FAIL=0
ok() { if [ "$1" = 0 ]; then PASS=$((PASS+1)); echo "ok      $2"; else FAIL=$((FAIL+1)); echo "NOT OK  $2"; fi; }

DB=${DB:-hearth_test}_start_on
dropdb --if-exists "$DB" 2>/dev/null; createdb "$DB"
files=(-f tests/supabase_stub.sql)
for m in supabase/migrations/*.sql; do files+=(-f "$m"); done
psql -d "$DB" -v ON_ERROR_STOP=1 -q "${files[@]}" -f supabase/seed.sql >/dev/null 2>&1
DBC="dbname=$DB"
q() { psql "$DBC" -X -q -t -A -c "$1" 2>/dev/null; }

# A stranger's app-started family: Parent Pat (pat@example.com) starts "Zebra Picnic Family" with a post.
q "insert into auth.users (id, email, raw_user_meta_data) values
   ('d0000000-0000-0000-0000-0000000000d1', 'pat@example.com', '{\"display_name\":\"Parent Pat\"}');
   insert into private.feature_flags (feature, enabled) values ('start_family_open', true)
     on conflict (feature) do update set enabled = true" >/dev/null
SPACE=$(q "select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-0000000000d1', false);
           set role authenticated; select public.start_family(gen_random_uuid(), 'Zebra Picnic Family', array['Walrus side', 'Otter side'])" | tail -1)
q "update private.feature_flags set enabled = false where feature = 'start_family_open'" >/dev/null
[[ $SPACE =~ ^[0-9a-f-]{36}$ ]]; ok $? "START-ON setup: Pat started a family (got '${SPACE}')"

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin" "$T/log"; : > "$T/log/requests"
# Stub curl: like the Management API, runs the posted SQL (one request) and answers with the rows as JSON lines,
# or HTTP 400 {"message": "..."} (curl exit 22) on an error. Logs every request.
cat > "$T/bin/curl" <<'STUB'
#!/usr/bin/env bash
url=""; data=""; headers=""
while (( $# )); do
  case $1 in
    -H) headers+="$2"$'\n'; shift ;;
    --data-binary) data=$2; shift ;;
    -X) shift ;;
    http*) url=$1 ;;
  esac; shift
done
[[ $data == @- ]] && data=$(cat)
printf '%s\n%s\n%s\n' "$url" "$headers" "$data" >> "$STUB_LOG/requests"
echo x >> "$STUB_LOG/count"
[[ $url == https://api.supabase.com/v1/projects/*/database/query ]] || { echo '{"message":"unexpected url"}'; exit 22; }
sql=$(python3 -I -c 'import json, sys; print(json.load(sys.stdin)["query"])' <<< "$data")
if out=$("$REAL_PSQL" "$STUB_DB" -X -q -t -A -v ON_ERROR_STOP=1 -c "$sql" 2>"$STUB_LOG/err"); then
  python3 -I -c 'import json, sys; print(json.dumps([{"line": l} for l in sys.stdin.read().splitlines() if l]))' <<< "$out"
else
  python3 -I -c 'import json, sys; print(json.dumps({"message": sys.stdin.read().strip()}))' < "$STUB_LOG/err"; exit 22
fi
STUB
chmod +x "$T/bin/curl"
printf '#!/usr/bin/env bash\necho "psql was called" >> "$STUB_LOG/psql"; exit 1\n' > "$T/bin/psql"
chmod +x "$T/bin/psql"
REAL_PSQL=$(command -v psql)
TOKEN=sbp_start_on_test_token_do_not_print
run() { local s=$1; shift; : > "$T/log/count"; env -u SUPABASE_DB_URL PATH="$T/bin:$PATH" STUB_LOG="$T/log" STUB_DB="$DBC" REAL_PSQL="$REAL_PSQL" \
          SUPABASE_ACCESS_TOKEN=$TOKEN bash "scripts/$s" "$@" 2>&1; }
sent() { wc -l < "$T/log/count" | tr -d ' '; }
deleted() { q "select deleted_at is not null from public.spaces where id = '$SPACE'"; }
known() { q "select known_at is not null from private.started_families where space_id = '$SPACE'"; }
flag() { q "select enabled from private.feature_flags where feature = 'start_family_open'"; }
# No family name, side name, member name or email in what Chase sees (the space id is the only identifier).
private_free() { ! grep -qiE 'Zebra|Picnic|Walrus|Otter|Parent Pat|pat@example\.com|example\.com' <<< "$1"; }

# ================= START-ON-3: suspend-family.sh =================
test -f scripts/suspend-family.sh; ok $? "START-ON-3 backend/scripts/suspend-family.sh exists"

out=$(env -u SUPABASE_ACCESS_TOKEN PATH="$T/bin:$PATH" STUB_LOG="$T/log" bash scripts/suspend-family.sh --space "$SPACE" 2>&1); rc=$?
[ $rc != 0 ] && grep -q "SUPABASE_ACCESS_TOKEN" <<< "$out"; ok $? "START-ON-3 without SUPABASE_ACCESS_TOKEN it stops and names the secret"
out=$(run suspend-family.sh); rc=$?
[ $rc != 0 ] && grep -q -- "--space" <<< "$out" && [ "$(sent)" = 0 ]; ok $? "START-ON-3 without --space it stops, says what's missing and sends nothing"
out=$(run suspend-family.sh --space "x'); drop table public.posts; --"); rc=$?
[ $rc != 0 ] && [ "$(sent)" = 0 ] && [ "$(q "select to_regclass('public.posts') is not null")" = t ]
ok $? "START-ON-3 a --space that isn't a uuid is refused before anything is sent"
out=$(run suspend-family.sh --space "$SPACE" --frobnicate); rc=$?
[ $rc != 0 ] && [ "$(sent)" = 0 ]; ok $? "START-ON-3 an unknown option is refused before anything is sent"
out=$(run suspend-family.sh --space "$SPACE" --undo --known); rc=$?
[ $rc != 0 ] && [ "$(sent)" = 0 ]; ok $? "START-ON-3 --undo and --known together are refused (one action at a time)"

# dry run is the default
out=$(run suspend-family.sh --space "$SPACE"); rc=$?
ok $rc "START-ON-3 the dry run runs without error"
echo "$out" | sed 's/^/        | /'
[ "$(deleted)" = f ]; ok $? "START-ON-3 without --apply nothing changes (dry run is the default)"
grep -qi "dry run" <<< "$out" && grep -q -- "--apply" <<< "$out"; ok $? "START-ON-3 the dry run says it is a dry run and to add --apply"
grep -q "purge_soft_deleted" <<< "$out" && grep -q "30 days" <<< "$out"; ok $? "START-ON-3 the dry run names purge_soft_deleted and 30 days"
grep -q "not scheduled" <<< "$out" && ! grep -q "removes a suspended family for good after 30 days" <<< "$out"; ok $? "SEC-R1 the dry run says the purge is not scheduled, never that it runs on its own"
grep -q "$SPACE" <<< "$out"; ok $? "START-ON-3 the dry run names the space id"
private_free "$out"; ok $? "START-ON-3 the dry run prints no family, side or member name and no email"

# apply
out=$(run suspend-family.sh --space "$SPACE" --apply); rc=$?
ok $rc "START-ON-3 --apply runs without error"
echo "$out" | sed 's/^/        | /'
[ "$(deleted)" = t ]; ok $? "START-ON-3 --apply suspends the family (spaces.deleted_at set)"
grep -q "purge_soft_deleted" <<< "$out" && grep -q "30 days" <<< "$out"; ok $? "START-ON-3 --apply names purge_soft_deleted and 30 days"
grep -q "not scheduled" <<< "$out"; ok $? "SEC-R1 --apply says the purge is not scheduled"
grep -q -- "--undo" <<< "$out"; ok $? "START-ON-3 --apply says how to undo"
private_free "$out"; ok $? "START-ON-3 --apply prints no family, side or member name and no email"
[ "$(sent)" = 1 ]; ok $? "START-ON-3 one Management API request (got $(sent))"
grep -q "Authorization: Bearer $TOKEN" "$T/log/requests"; ok $? "START-ON-3 the token goes in the Authorization header"
! grep -q "$TOKEN" <<< "$out"; ok $? "START-ON-3 the token is never printed"

# undo
out=$(run suspend-family.sh --space "$SPACE" --undo); rc=$?
[ "$(deleted)" = t ] && grep -qi "dry run" <<< "$out"; ok $? "START-ON-3 --undo without --apply is a dry run (still suspended)"
out=$(run suspend-family.sh --space "$SPACE" --undo --apply); rc=$?
ok $rc "START-ON-3 --undo --apply runs without error"
[ "$(deleted)" = f ]; ok $? "START-ON-3 --undo --apply brings the family back"
private_free "$out"; ok $? "START-ON-3 --undo prints no family, side or member name and no email"

# known
out=$(run suspend-family.sh --space "$SPACE" --known); rc=$?
[ "$(known)" = f ] && grep -qi "dry run" <<< "$out"; ok $? "START-ON-3 --known without --apply is a dry run (cap still on)"
out=$(run suspend-family.sh --space "$SPACE" --known --apply); rc=$?
ok $rc "START-ON-3 --known --apply runs without error"
[ "$(known)" = t ] && [ "$(deleted)" = f ]; ok $? "START-ON-3 --known --apply lifts the cap and does not suspend"
private_free "$out"; ok $? "START-ON-3 --known prints no family, side or member name and no email"

# an unknown space: fails plainly, changes nothing
out=$(run suspend-family.sh --space 99999999-0000-0000-0000-000000000099 --apply); rc=$?
[ $rc != 0 ] && [ "$(deleted)" = f ]; ok $? "START-ON-3 an unknown space id fails and changes nothing"

# --print-sql
: > "$T/log/requests"
out=$(env -u SUPABASE_ACCESS_TOKEN PATH="$T/bin:$PATH" STUB_LOG="$T/log" bash scripts/suspend-family.sh --space "$SPACE" --apply --print-sql 2>&1); rc=$?
ok $rc "START-ON-3 --print-sql works without the token"
[ ! -s "$T/log/requests" ]; ok $? "START-ON-3 --print-sql sends nothing"
grep -qF "'$SPACE'" <<< "$out" && ! grep -qE ":'?(space_id|action|apply)'?" <<< "$out"
ok $? "START-ON-3 --print-sql shows the SQL with the psql variables filled in as quoted literals"
[ ! -f "$T/log/psql" ]; ok $? "START-ON-3 psql is never called"

# ================= START-ON-4: start-family-switch.sh =================
test -f scripts/start-family-switch.sh; ok $? "START-ON-4 backend/scripts/start-family-switch.sh exists"
out=$(run start-family-switch.sh); rc=$?
[ $rc != 0 ] && grep -qE "on\|off\|status|on, off or status" <<< "$out" && [ "$(sent)" = 0 ]; ok $? "START-ON-4 with no argument it stops, says on|off|status and sends nothing"
out=$(run start-family-switch.sh maybe); rc=$?
[ $rc != 0 ] && [ "$(sent)" = 0 ]; ok $? "START-ON-4 an argument other than on, off or status is refused"
out=$(env -u SUPABASE_ACCESS_TOKEN PATH="$T/bin:$PATH" STUB_LOG="$T/log" bash scripts/start-family-switch.sh status 2>&1); rc=$?
[ $rc != 0 ] && grep -q "SUPABASE_ACCESS_TOKEN" <<< "$out"; ok $? "START-ON-4 without SUPABASE_ACCESS_TOKEN it stops and names the secret"

out=$(run start-family-switch.sh status); rc=$?
ok $rc "START-ON-4 status runs without error"
grep -qiE "\boff\b" <<< "$out"; ok $? "START-ON-4 status prints off while it is off"
out=$(run start-family-switch.sh on); rc=$?
[ "$(flag)" = f ] && grep -qi "dry run" <<< "$out" && grep -q -- "--apply" <<< "$out"; ok $? "START-ON-4 on without --apply is a dry run (still off) and says to add --apply"
out=$(run start-family-switch.sh on --apply); rc=$?
ok $rc "START-ON-4 on --apply runs without error"
[ "$(flag)" = t ]; ok $? "START-ON-4 on --apply turns it on"
out=$(run start-family-switch.sh status); rc=$?
grep -qiE "\bon\b" <<< "$out" && ! grep -qiE "\boff\b" <<< "$out"; ok $? "START-ON-4 status prints on while it is on"
[ "$(flag)" = t ]; ok $? "START-ON-4 status changes nothing"
out=$(run start-family-switch.sh off --apply); rc=$?
[ "$(flag)" = f ]; ok $? "START-ON-4 off --apply turns it off"
! grep -q "$TOKEN" <<< "$out"; ok $? "START-ON-4 the token is never printed"
[ ! -f "$T/log/psql" ]; ok $? "START-ON-4 psql is never called"

dropdb --if-exists "$DB" 2>/dev/null
echo
echo "START-ON SCRIPTS RESULT: $PASS passed, $FAIL failed"
[ $FAIL = 0 ]
