#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Chase Holroyd
# SITEBAR-1, SITEBAR-2 (intake #183): the public demo site loads the portfolio's shared top bar
# (/assets/demo-bar.js, served by the portfolio site, not this repo) on every page, the app never does.
# The tag goes in once, just before </body>, and points at the site's own address only (no other host).
#   bash app/scripts/tests/site_bar_test.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
PASS=0; FAIL=0
ok()  { echo "ok   - $1"; PASS=$((PASS + 1)); }
bad() { echo "FAIL - $1"; FAIL=$((FAIL + 1)); }
check() { if (eval "$2"); then ok "$1"; else bad "$1"; fi; }

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
site() { rm -rf "$T/s"; mkdir -p "$T/s/photos" "$T/s/more/help"; for f in "$T/s/index.html" "$T/s/photos/index.html" "$T/s/more/help/index.html"; do echo '<html><head><title>x</title></head><body><div id="root"></div></body></html>' > "$f"; done; echo '<html><body></body></html>' > "$T/s/other.html"; }
TAG='<script src="/assets/demo-bar.js" data-page="white" defer></script>'
count() { grep -oF "$TAG" "$1" | wc -l; }

check "SITEBAR-1: the script exists" "[[ -f scripts/add-site-bar.sh ]]"

site; bash scripts/add-site-bar.sh "$T/s" > "$T/out" 2>&1; rc=$?
check "SITEBAR-1: the run passes" "(( rc == 0 ))"
check "SITEBAR-1: every index.html gets the tag exactly once, right before </body>" \
  "for f in '$T/s/index.html' '$T/s/photos/index.html' '$T/s/more/help/index.html'; do [[ \$(count \"\$f\") -eq 1 ]] && grep -qF '$TAG</body>' \"\$f\" || exit 1; done"
check "SITEBAR-1: the rest of the page is untouched" "grep -qF '<head><title>x</title></head><body><div id=\"root\"></div>' '$T/s/index.html'"
check "SITEBAR-1: files not named index.html are left alone" "! grep -q 'demo-bar' '$T/s/other.html'"

bash scripts/add-site-bar.sh "$T/s" > /dev/null 2>&1; rc=$?
check "SITEBAR-1: running twice passes and adds no second tag" \
  "(( rc == 0 )) && for f in '$T/s/index.html' '$T/s/photos/index.html' '$T/s/more/help/index.html'; do [[ \$(count \"\$f\") -eq 1 ]] || exit 1; done"

site; bash scripts/add-site-bar.sh "$T/s" > /dev/null 2>&1
check "SITEBAR-1: no other host is loaded (no http address in any script tag it adds)" \
  "! grep -rhoE '<script[^>]*src=\"(https?:)?//[^\"]*\"' '$T/s'"
check "SITEBAR-1: the script itself names no outside host" "[[ -f scripts/add-site-bar.sh ]] && ! grep -qE 'https?://' scripts/add-site-bar.sh"
check "SITEBAR-1: a missing SITE_DIR fails with usage" "! bash scripts/add-site-bar.sh > /dev/null 2>&1"

check "SITEBAR-2: build-demo.sh runs it on the site build" "grep -qE '^bash scripts/add-site-bar.sh \"\\\$OUT\"' scripts/build-demo.sh"
check "SITEBAR-2: it runs next to add-site-analytics.sh, after the route copies" \
  "awk '/cp \"\\\$OUT\\/index.html\"/{c=NR} /add-site-bar.sh/{b=NR} /add-site-analytics.sh \"/{a=NR} END{exit !(b>c && c>0 && a>0)}' scripts/build-demo.sh"
check "SITEBAR-2: nothing in the app's own code loads demo-bar.js" "! grep -rq 'demo-bar.js' src app.json app.config.js"

echo "SITE BAR RESULT: $PASS passed, $FAIL failed"
(( FAIL == 0 ))
