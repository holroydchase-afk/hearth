#!/usr/bin/env bash
# Fails when parallel threads claimed the same number: migration prefixes,
# DEC-n headings, tracker ticket ids, tracker run ids. Usage: [repo_root]
set -u
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
rc=0
dupes() { sort | uniq -d; }
report() { # $1 label, stdin = duplicate keys; prints, returns 1 if any
  local n=0 k
  while read -r k; do [ -n "$k" ] && { echo "DUPLICATE $1: $k"; n=1; }; done
  return $n
}
ls "$ROOT/backend/supabase/migrations" 2>/dev/null | grep -oE '^[0-9]{4}' | dupes | report "migration number" || rc=1
grep -oE '^### DEC-[0-9]+ ' "$ROOT/docs/product/DECISION-LOG.md" 2>/dev/null | tr -d '# ' | dupes | report "decision" || rc=1
S="$ROOT/tracker/build_seed.py"
if [ -f "$S" ]; then
  grep -oE '^ *\("[A-Za-z]+[0-9]+",' "$S" | grep -oE '"[^"]+"' | tr -d '"' | dupes | report "ticket id" || rc=1
  grep -oE 'run\("r[0-9]+"' "$S" | grep -oE 'r[0-9]+' | dupes | report "run id" || rc=1
fi
[ $rc -eq 0 ] && echo "check-unique-numbers: ok"
exit $rc
