#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Chase Holroyd
# ANALYTICS-1 (intake #95): add Umami's page-view script to the public demo SITE only, never the app.
# Off unless both are set (GitHub repo variables, passed in by demo-site.yml):
#   UMAMI_SCRIPT_URL   the https script address from Umami's "Tracking code" page
#   UMAMI_WEBSITE_ID   the website id (a UUID) from the same page
#   bash scripts/add-site-analytics.sh dist-demo-site
set -euo pipefail
DIR=${1:?usage: add-site-analytics.sh SITE_DIR}
URL=${UMAMI_SCRIPT_URL:-}; ID=${UMAMI_WEBSITE_ID:-}
if [[ -z "$URL" || -z "$ID" ]]; then echo "Site analytics: off (set UMAMI_SCRIPT_URL and UMAMI_WEBSITE_ID to turn on)"; exit 0; fi
[[ "$ID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] || { echo "UMAMI_WEBSITE_ID must be a UUID" >&2; exit 1; }
[[ "$URL" =~ ^https://[A-Za-z0-9.-]+(/[A-Za-z0-9._/-]*)?$ ]] || { echo "UMAMI_SCRIPT_URL must be a plain https address" >&2; exit 1; }
TAG="<script defer src=\"$URL\" data-website-id=\"$ID\"></script>"
n=0
while IFS= read -r -d '' f; do
  grep -q 'data-website-id=' "$f" && continue
  TAG="$TAG" perl -0pi -e 's{</head>}{$ENV{TAG}</head>}' "$f"; n=$((n + 1))
done < <(find "$DIR" -name index.html -print0)
echo "Site analytics: on for $n pages"
