#!/usr/bin/env bash
# Builds the public demo for a static host (RR-5): the no-login sample-data web export under a
# sub-path, ready to copy into the portfolio repo at demo/hearth/. Nothing is published from here.
#   bash scripts/build-demo.sh [/demo/hearth]   -> dist-demo-site/
set -euo pipefail
cd "$(dirname "$0")/.."
BASE=${1:-/demo/hearth}
OUT=dist-demo-site
HEARTH_BASE_URL="$BASE" EXPO_PUBLIC_HEARTH_DEMO=1 npx expo export --platform web --output-dir "$OUT" --clear
# A static host has no fallback to index.html, so each address a visitor can reload gets its own copy.
for route in photos share groups me help sign-in viewer; do
  mkdir -p "$OUT/$route"
  cp "$OUT/index.html" "$OUT/$route/index.html"
done
# ANALYTICS-1: page views on the demo site only, off unless the two Umami values are set.
bash scripts/add-site-analytics.sh "$OUT"
echo "Built $OUT for $BASE/ (copy its contents to that folder of the site)"
