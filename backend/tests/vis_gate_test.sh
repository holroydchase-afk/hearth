#!/usr/bin/env bash
# VIS-2, VIS-23 (second policy), VIS-6, VIS-24 (config): the coverage gate is proven to bite
# (SPEC-VISIBILITY-CORE C3, Phase 1 and 1b). Written FIRST (Nov 24, 2026): red until the vis registry lands.
#   control  : all migrations + seed            -> tests/vis_registry_test.sql must PASS
#   VIS-2    : + a table with no registry row   -> it must FAIL, naming that table
#   VIS-23   : + a 2nd permissive select policy on public.posts -> it must FAIL, naming posts (PRIV-VC-R4)
#   VIS-6    : every folder in supabase/functions/ is in vis.edge_functions; verify_jwt = false names a reason
#   VIS-24   : PostgREST never exposes the vis or private schema (config.toml [api] schemas)
# A bite only counts when the control passes, so a gate that fails everything never looks green.
# Usage (from backend/): bash tests/vis_gate_test.sh   (local Postgres 15+, superuser PGUSER, like tests/run.sh)
set -uo pipefail
cd "$(dirname "$0")/.."
DB=${DB:-hearth_test}_visgate
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"; dropdb --if-exists "$DB" >/dev/null 2>&1' EXIT
pass=0; fail=0
ok()  { echo "ok      $1"; pass=$((pass+1)); }
bad() { echo "NOT OK  $1"; fail=$((fail+1)); }

build() {  # build [extra sql file]: fresh DB, stubs, every migration, seed, then the scratch migration if given
  dropdb --if-exists "$DB" >/dev/null 2>&1; createdb "$DB"
  local files=(-f tests/supabase_stub.sql)
  for m in supabase/migrations/*.sql; do files+=(-f "$m"); done
  files+=(-f supabase/seed.sql)
  [ -n "${1:-}" ] && files+=(-f "$1")
  PGOPTIONS="-c client_min_messages=warning" psql -d "$DB" -v ON_ERROR_STOP=1 -q "${files[@]}" >/dev/null
}
gate() { psql -d "$DB" -X -q -f tests/vis_registry_test.sql >"$OUT/$1.txt" 2>&1; }

# ---------- control ----------
build; gate control; control=$?
if [ $control -eq 0 ]; then ok "VIS-2 control: the gate passes on main's migrations"
else bad "VIS-2 control: the gate passes on main's migrations  [$(grep -c 'NOT OK' "$OUT/control.txt") NOT OK; first: $(grep -m1 'NOT OK' "$OUT/control.txt" | cut -c1-140)]"; fi

# ---------- VIS-2 an unregistered table fails the build, by name ----------
cat >"$OUT/scratch_table.sql" <<'SQL'
create table public.vis_scratch_unregistered (id uuid primary key, body text);
alter table public.vis_scratch_unregistered enable row level security;
SQL
build "$OUT/scratch_table.sql"; gate scratch_table; rc=$?
if [ $control -eq 0 ] && [ $rc -ne 0 ] && grep -q 'NOT OK | VIS-1 public.vis_scratch_unregistered has a reach class' "$OUT/scratch_table.txt"; then
  ok "VIS-2 a scratch table with no registry row fails the gate, naming public.vis_scratch_unregistered"
else bad "VIS-2 a scratch table with no registry row fails the gate, naming public.vis_scratch_unregistered  [control rc=$control, scratch rc=$rc]"; fi

# ---------- VIS-23 a second permissive select policy on a Post-class table fails the gate (PRIV-VC-R4) ----------
cat >"$OUT/scratch_policy.sql" <<'SQL'
create policy vis_scratch_wider on public.posts for select to authenticated
  using (private.sees_post((select auth.uid()), id) or author_id = (select auth.uid()));
SQL
build "$OUT/scratch_policy.sql"; gate scratch_policy; rc=$?
if [ $control -eq 0 ] && [ $rc -ne 0 ] && grep -q 'NOT OK | VIS-4 public.posts has exactly one permissive select policy' "$OUT/scratch_policy.txt"; then
  ok "VIS-23 a second permissive select policy on public.posts fails the gate (PRIV-VC-R4)"
else bad "VIS-23 a second permissive select policy on public.posts fails the gate (PRIV-VC-R4)  [control rc=$control, scratch rc=$rc]"; fi

# ---------- VIS-6 every edge function folder is registered ----------
build
for d in supabase/functions/*/; do
  name=$(basename "$d")
  case "$name" in _*) continue;; esac   # _shared and friends are code, not deployed functions
  got=$(psql -d "$DB" -X -At -c "select count(*) from vis.edge_functions where name = '$name'" 2>&1)
  if [ "$got" = "1" ]; then ok "VIS-6 edge function $name is in vis.edge_functions"
  else bad "VIS-6 edge function $name is in vis.edge_functions  [$got]"; fi
  if awk -v f="[functions.$name]" '$0==f{s=1;next} /^\[/{s=0} s && /verify_jwt *= *false/{found=1} END{exit !found}' supabase/config.toml; then
    got=$(psql -d "$DB" -X -At -c "select length(btrim(coalesce(note, ''))) > 0 from vis.edge_functions where name = '$name'" 2>&1)
    if [ "$got" = "t" ]; then ok "VIS-6 $name has verify_jwt = false and names a reason"
    else bad "VIS-6 $name has verify_jwt = false and names a reason  [$got]"; fi
  fi
done
got=$(psql -d "$DB" -X -At -c "select coalesce(string_agg(name, ','), '') from vis.edge_functions" 2>&1)
stale=""
for n in ${got//,/ }; do [ -d "supabase/functions/$n" ] || stale="$stale $n"; done
if [ -z "$stale" ] && [[ "$got" != *ERROR* ]]; then ok "VIS-6 no registered edge function is missing its folder"
else bad "VIS-6 no registered edge function is missing its folder  [${stale:-$got}]"; fi

# ---------- VIS-24 the API never exposes the core's schemas ----------
schemas=$(awk '/^\[api\]/{s=1;next} /^\[/{s=0} s && /^schemas *=/' supabase/config.toml)
if [ -n "$schemas" ] && ! grep -q -E '"(vis|private)"' <<<"$schemas"; then
  ok "VIS-24 config.toml [api] schemas exposes neither vis nor private ($schemas)"
else bad "VIS-24 config.toml [api] schemas exposes neither vis nor private  [$schemas]"; fi

echo "VIS GATE RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
