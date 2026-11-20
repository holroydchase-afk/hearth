#!/usr/bin/env bash
# TS-GUX-R3 / BETA-SMS-17 (grandparent-ux, Nov 19 text sign-in review): the printed guide teaches the code step,
# never tells her to distrust the real code text, and names only tabs that exist (Gallery, Share, Feed, More; DEC-59).
set -u
cd "$(dirname "$0")/../.."
pass=0; fail=0
ok()  { echo "ok      $1"; pass=$((pass+1)); }
bad() { echo "NOT OK  $1"; fail=$((fail+1)); }
G=docs/product/GRANDPARENT-GUIDE.md
[ -f "$G" ] || { echo "NOT OK  $G missing"; exit 1; }
# A "## Step N." heading whose section has the sign-in words.
awk '/^## Step [0-9]+\./{s=1; next} /^## /{s=0} s' "$G" | grep -q 'Type the 6 numbers into Hearth yourself' \
  && ok "TS-GUX-R3 a step says \"Type the 6 numbers into Hearth yourself\"" \
  || bad "TS-GUX-R3 no step says \"Type the 6 numbers into Hearth yourself\""
grep -qi 'always starts with' "$G" \
  && bad "TS-GUX-R3 still has the \"always starts with\" rule  [$(grep -ni 'always starts with' "$G" | head -1)]" \
  || ok "TS-GUX-R3 no \"always starts with\" rule"
# Any "Tap **X** at the bottom" names a tab; it must be one of the four.
tabs=$(grep -oE 'Tap \*\*[^*]+\*\* at the bottom' "$G" | sed -E 's/Tap \*\*([^*]+)\*\*.*/\1/')
wrong=$(echo "$tabs" | grep -vxE 'Gallery|Share|Feed|More|' || true)
[ -z "$wrong" ] && ok "TS-GUX-R3 every tab named is Gallery, Share, Feed or More" || bad "TS-GUX-R3 names a tab that doesn't exist: $(echo $wrong)"
grep -q 'Easy view' "$G" && ok "TS-GUX-R3 bigger words point to More, Easy view" || bad "TS-GUX-R3 bigger words don't say Easy view"
echo; echo "GRANDPARENT GUIDE RESULT: $pass passed, $fail failed"
[ $fail -eq 0 ]
