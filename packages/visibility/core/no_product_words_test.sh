#!/usr/bin/env bash
# VIS-21: the generic `vis` template has no Hearth words in it (SPEC-VISIBILITY-CORE C6, Phase 1b), so other
# studio apps can use it. Checks every .sql file in packages/visibility/core except the test kit itself.
# Words: family/families, circle(s), post/posts/post_*, Gammy, Hearth (case-insensitive, whole words, so
# "postgres" and "PostgREST" are fine). Written FIRST (Nov 24, 2026): red until the template exists.
#   bash packages/visibility/core/no_product_words_test.sh
set -uo pipefail
cd "$(dirname "$0")"
pass=0; fail=0
ok()  { echo "ok      $1"; pass=$((pass+1)); }
bad() { echo "NOT OK  $1"; fail=$((fail+1)); }
mapfile -t files < <(ls -1 *.sql 2>/dev/null | grep -v '^test\.sql$')
if [ ${#files[@]} -eq 0 ]; then
  bad "VIS-21 the vis template exists (packages/visibility/core/supabase.sql)"
else
  ok "VIS-21 the vis template exists (${files[*]})"
  hits=$(grep -n -i -E '\b(famil(y|ies)|circles?|posts?|post_[a-z_]+|gammy|hearth)\b' "${files[@]}" || true)
  if [ -z "$hits" ]; then ok "VIS-21 no product words (family, circle, post, Gammy, Hearth) in the template"
  else bad "VIS-21 no product words in the template; found:"; echo "$hits" | sed 's/^/        /'; fi
fi
# The word check must bite: a planted line is caught.
if echo "select * from public.posts;" | grep -q -i -E '\b(posts?|post_[a-z_]+)\b' \
   && ! echo "-- runs on Postgres via PostgREST" | grep -q -i -E '\b(famil(y|ies)|circles?|posts?|post_[a-z_]+|gammy|hearth)\b'; then
  ok "VIS-21 the word check catches 'posts' and lets 'Postgres'/'PostgREST' through"
else bad "VIS-21 the word check catches 'posts' and lets 'Postgres'/'PostgREST' through"; fi
echo "VIS-21 RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
