#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Chase Holroyd
# ANALYTICS-1 (intake #95): the public demo site can carry Umami's page-view script, the app never does.
# It is off unless both UMAMI_SCRIPT_URL and UMAMI_WEBSITE_ID are set (repo variables in demo-site.yml),
# and the values are checked before they go into the page.
#   bash app/scripts/tests/site_analytics_test.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
PASS=0; FAIL=0
ok()  { echo "ok   - $1"; PASS=$((PASS + 1)); }
bad() { echo "FAIL - $1"; FAIL=$((FAIL + 1)); }
check() { if (eval "$2"); then ok "$1"; else bad "$1"; fi; }

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
site() { rm -rf "$T/s"; mkdir -p "$T/s/photos"; for f in "$T/s/index.html" "$T/s/photos/index.html"; do echo '<html><head><title>x</title></head><body></body></html>' > "$f"; done; }
ID=0b1c2d3e-4f50-4617-8899-aabbccddeeff
URL=https://analytics.example.com/script.js

check "ANALYTICS-1: the script exists" "[[ -f scripts/add-site-analytics.sh ]]"

site; env -u UMAMI_SCRIPT_URL -u UMAMI_WEBSITE_ID bash scripts/add-site-analytics.sh "$T/s" > "$T/out" 2>&1; rc=$?
check "ANALYTICS-1: off by default: no script tag and the run passes" "(( rc == 0 )) && ! grep -rq '<script' '$T/s'"
check "ANALYTICS-1: off is said out loud" "grep -q 'Site analytics: off' '$T/out'"

site; UMAMI_SCRIPT_URL=$URL UMAMI_WEBSITE_ID=$ID bash scripts/add-site-analytics.sh "$T/s" > "$T/out" 2>&1; rc=$?
check "ANALYTICS-1: on: every page gets one deferred tag in the head" "(( rc == 0 )) && [[ \$(grep -l \"<script defer src=\\\"$URL\\\" data-website-id=\\\"$ID\\\"></script></head>\" '$T/s/index.html' '$T/s/photos/index.html' | wc -l) -eq 2 ]]"
UMAMI_SCRIPT_URL=$URL UMAMI_WEBSITE_ID=$ID bash scripts/add-site-analytics.sh "$T/s" > /dev/null 2>&1
check "ANALYTICS-1: running twice adds no second tag" "[[ \$(grep -o 'data-website-id' '$T/s/index.html' | wc -l) -eq 1 ]]"

site; UMAMI_SCRIPT_URL=$URL UMAMI_WEBSITE_ID='x" onload="alert(1)' bash scripts/add-site-analytics.sh "$T/s" > "$T/out" 2>&1; rc=$?
check "ANALYTICS-1: a website id that isn't a UUID fails the build and touches nothing" "(( rc != 0 )) && ! grep -rq '<script' '$T/s'"
site; UMAMI_SCRIPT_URL=http://analytics.example.com/script.js UMAMI_WEBSITE_ID=$ID bash scripts/add-site-analytics.sh "$T/s" > "$T/out" 2>&1; rc=$?
check "ANALYTICS-1: a script address that isn't https fails the build" "(( rc != 0 )) && ! grep -rq '<script' '$T/s'"

check "ANALYTICS-1: build-demo.sh runs it on the site build" "grep -q 'add-site-analytics.sh' scripts/build-demo.sh"
check "ANALYTICS-1: the Pages workflow passes the two repo variables" "grep -q 'vars.UMAMI_WEBSITE_ID' ../.github/workflows/demo-site.yml && grep -q 'vars.UMAMI_SCRIPT_URL' ../.github/workflows/demo-site.yml"
check "ANALYTICS-2: nothing in the app's own code mentions Umami" "! grep -rqi umami src app.json app.config.js"

echo "SITE ANALYTICS RESULT: $PASS passed, $FAIL failed"
(( FAIL == 0 ))
