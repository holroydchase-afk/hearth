#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Chase Holroyd
# DEMO-META-1 (TRACKER R45, plan gap G3): a shared link to the public demo shows a title, a description and a
# preview picture (Open Graph and Twitter cards), on every page of the site build, once.
#   bash app/scripts/tests/site_meta_test.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
PASS=0; FAIL=0
ok()  { echo "ok   - $1"; PASS=$((PASS + 1)); }
bad() { echo "FAIL - $1"; FAIL=$((FAIL + 1)); }
check() { if (eval "$2"); then ok "$1"; else bad "$1"; fi; }

T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
site() { rm -rf "$T/s"; mkdir -p "$T/s/photos"; for f in "$T/s/index.html" "$T/s/photos/index.html"; do echo '<html><head><title>Hearth</title></head><body></body></html>' > "$f"; done; }

check "DEMO-META-1: the script exists" "[[ -f scripts/add-site-meta.sh ]]"
site; bash scripts/add-site-meta.sh "$T/s" /hearth > "$T/out" 2>&1; rc=$?
check "DEMO-META-1: it runs" "(( rc == 0 ))"
for f in index.html photos/index.html; do
  check "DEMO-META-1: $f has a description" "grep -q '<meta name=\"description\" content=\"[^\"]\{60,\}\"' '$T/s/$f'"
  check "DEMO-META-1: $f has og:title, og:description, og:type and og:url" "grep -q 'property=\"og:title\"' '$T/s/$f' && grep -q 'property=\"og:description\"' '$T/s/$f' && grep -q 'property=\"og:type\" content=\"website\"' '$T/s/$f' && grep -q 'property=\"og:url\" content=\"https://chaseholroyd.com/hearth/\"' '$T/s/$f'"
  check "DEMO-META-1: $f has an absolute https preview picture" "grep -q 'property=\"og:image\" content=\"https://chaseholroyd.com/hearth/og-hearth.png\"' '$T/s/$f'"
  check "DEMO-META-1: $f has a large Twitter card" "grep -q 'name=\"twitter:card\" content=\"summary_large_image\"' '$T/s/$f'"
  check "DEMO-META-1: $f says demo in its title" "grep -q '<title>Hearth demo: [^<]*</title>' '$T/s/$f'"
done
bash scripts/add-site-meta.sh "$T/s" /hearth > /dev/null 2>&1
check "DEMO-META-1: running twice adds nothing twice" "[[ \$(grep -o 'og:title' '$T/s/index.html' | wc -l) -eq 1 && \$(grep -o '<title>' '$T/s/index.html' | wc -l) -eq 1 ]]"
check "DEMO-META-1: the preview picture ships in public/ at 1200x630" "python3 -c 'import struct,sys;b=open(\"public/og-hearth.png\",\"rb\").read(24);sys.exit(0 if struct.unpack(\">II\",b[16:24])==(1200,630) else 1)'"
check "DEMO-META-1: build-demo.sh runs it with the base" "grep -q 'add-site-meta.sh \"\$OUT\" \"\$BASE\"' scripts/build-demo.sh"

echo "SITE META RESULT: $PASS passed, $FAIL failed"
(( FAIL == 0 ))
