#!/usr/bin/env bash
# VIS-12 (SPEC-VISIBILITY-CORE Phase 2, TRACKER R51): the oracle on a fresh database, written to a dated file.
#   bash backend/tests/vis_oracle/nightly.sh [--seed N] [--fixture]
#     --seed N     the generator's seed (default: a random one, named in the file name and the file)
#     --fixture    instead: rewrite fixtures/seed-N.json (vis_oracle.fixture_json(); the app's Jest suite reads it)
# Local Postgres, PGUSER a superuser; database name from $DB (default hearth_vo_nightly).
# Writes backend/tests/results/vis-oracle-<UTC date>-seed<N>.txt: the result list, the
# "VIS ORACLE MATRIX seed=N" block (path | kind | checked | wrong_yes | wrong_no), the mismatches and the
# "VIS ORACLE RESULT:" line. Ids and counts only; anything shaped like an email is masked as a safety net.
# Exits 0 only when the oracle suite passed.
set -uo pipefail
cd "$(dirname "$0")/../.."     # backend/
DB=${DB:-hearth_vo_nightly}
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
SEED=""; FIXTURE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --seed) SEED=${2:-}; shift 2 ;;
    --fixture) FIXTURE=1; shift ;;
    *) echo "usage: nightly.sh [--seed N] [--fixture]" >&2; exit 2 ;;
  esac
done
[ -z "$SEED" ] && SEED=$(( (RANDOM << 15 | RANDOM) % 1000000 + 1 ))
case "$SEED" in ''|*[!0-9]*) echo "nightly.sh: --seed takes a whole number" >&2; exit 2 ;; esac

build() {
  dropdb --if-exists "$DB" >/dev/null 2>&1
  createdb "$DB" || return 1
  local files=(-f tests/supabase_stub.sql) m
  for m in supabase/migrations/*.sql; do files+=(-f "$m"); done
  files+=(-f supabase/seed.sql)
  psql -d "$DB" -v ON_ERROR_STOP=1 -X -q "${files[@]}" >/dev/null
}

if ! build; then echo "nightly.sh: could not build the database $DB" >&2; exit 1; fi

if [ "$FIXTURE" = 1 ]; then
  out=tests/vis_oracle/fixtures/seed-$SEED.json
  mkdir -p tests/vis_oracle/fixtures
  psql -d "$DB" -v ON_ERROR_STOP=1 -X -q -At -f tests/vis_oracle/generate.sql \
       -c "select vis_oracle.generate($SEED)" -c "select jsonb_pretty(vis_oracle.fixture_json())" \
    | grep -v '^$' > "$out.tmp" && [ -s "$out.tmp" ] && mv "$out.tmp" "$out" || { rm -f "$out.tmp"; echo "nightly.sh: fixture failed" >&2; dropdb --if-exists "$DB" >/dev/null 2>&1; exit 1; }
  dropdb --if-exists "$DB" >/dev/null 2>&1
  echo "wrote $out"
  exit 0
fi

mkdir -p tests/results
file=tests/results/vis-oracle-$(date -u +%F)-seed$SEED.txt
psql -d "$DB" -X -q -v vo_seed="$SEED" -f tests/vis_oracle_test.sql > "$file.tmp" 2>&1
code=$?
{ echo "# VIS-12 nightly oracle, seed $SEED, $(date -u +%FT%TZ) (ids and counts only)"
  sed -E 's/[^[:space:]|]+@[^[:space:]|]+/<masked>/g' "$file.tmp"; } > "$file"
rm -f "$file.tmp"
dropdb --if-exists "$DB" >/dev/null 2>&1
grep -q 'VIS ORACLE RESULT:' "$file" || code=1
grep -q 'SOME TESTS FAILED' "$file" && code=1
echo "wrote $file (exit $code)"
exit $code
