#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Chase Holroyd
# SITEBAR-1 (intake #183): add the portfolio's shared top bar to the public demo SITE only, never the app.
# The script is served by the portfolio site itself (same address, no other host), on a white page.
#   bash scripts/add-site-bar.sh dist-demo-site
set -euo pipefail
DIR=${1:?usage: add-site-bar.sh SITE_DIR}
TAG='<script src="/assets/demo-bar.js" data-page="white" defer></script>'
n=0
while IFS= read -r -d '' f; do
  grep -qF 'demo-bar.js' "$f" && continue
  TAG="$TAG" perl -0pi -e 's{</body>}{$ENV{TAG}</body>}' "$f"; n=$((n + 1))
done < <(find "$DIR" -name index.html -print0)
echo "Site bar: added to $n pages"
