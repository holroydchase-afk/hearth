#!/usr/bin/env bash
# Builds the public demo for a static host (RR-5): the no-login sample-data web export under a
# sub-path, ready to copy into the portfolio repo at demo/hearth/. Nothing is published from here.
#   bash scripts/build-demo.sh [/demo/hearth]   -> dist-demo-site/
set -euo pipefail
cd "$(dirname "$0")/.."
BASE=${1:-/demo/hearth}
OUT=dist-demo-site
HEARTH_BASE_URL="$BASE" EXPO_PUBLIC_HEARTH_DEMO=1 npx expo export --platform web --output-dir "$OUT" --clear
# HRT-WEB.2 (QA-R1): the manifest link is root-relative to the build's base path, so it resolves from every route.
MANIFEST_HREF="${BASE%/}/manifest.webmanifest" perl -pi -e 's{href="/manifest\.webmanifest"}{href="$ENV{MANIFEST_HREF}"}' "$OUT/index.html"
grep -q "href=\"${BASE%/}/manifest.webmanifest\"" "$OUT/index.html" || { echo "build-demo: manifest link missing from $OUT/index.html" >&2; exit 1; }
# A static host has no fallback to index.html, so each address a visitor can reload gets its own copy.
for route in gallery gallery/search share feed feed/timeline more more/messages more/groups more/events more/easy-view more/look more/theme more/me more/help photos groups me help sign-in viewer; do
  mkdir -p "$OUT/$route"
  cp "$OUT/index.html" "$OUT/$route/index.html"
done
# DEMO-LIVE-4 (ARCH-R1): which commit this build is, so demo-site.yml's live check waits for the new copy.
sha=${GITHUB_SHA:-local}
[[ "$sha" =~ ^([0-9a-f]{40}|local)$ ]] || sha=local
echo "$sha" > "$OUT/version.txt"
# DEMO-META-1: a title, description and preview picture for shared links.
bash scripts/add-site-meta.sh "$OUT" "$BASE"
# ANALYTICS-1: page views on the demo site only, off unless the two Umami values are set.
bash scripts/add-site-analytics.sh "$OUT"
# SITEBAR-2: the portfolio's shared top bar on every page of the demo site.
bash scripts/add-site-bar.sh "$OUT"
echo "Built $OUT for $BASE/ (copy its contents to that folder of the site)"
