#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Chase Holroyd
# DEMO-META-1 (TRACKER R45): a shared link to the public demo shows a title, a description and a preview
# picture (Open Graph and Twitter cards). Site build only; the app itself is unchanged.
#   bash scripts/add-site-meta.sh dist-demo-site /hearth
set -euo pipefail
DIR=${1:?usage: add-site-meta.sh SITE_DIR BASE}
BASE=${2:?usage: add-site-meta.sh SITE_DIR BASE}
ORIGIN=${SITE_ORIGIN:-https://chaseholroyd.com}
URL="$ORIGIN$BASE/"
TITLE='Hearth demo: a private photo app for split families'
DESC='Try Hearth, a private family photo app for split families and grandparents who stay off social media. Every photo goes only to the people you pick, by name. A made-up family, no sign-in.'
TAGS="<meta name=\"description\" content=\"$DESC\"><meta property=\"og:type\" content=\"website\"><meta property=\"og:title\" content=\"$TITLE\"><meta property=\"og:description\" content=\"$DESC\"><meta property=\"og:url\" content=\"$URL\"><meta property=\"og:image\" content=\"${URL}og-hearth.png\"><meta property=\"og:image:width\" content=\"1200\"><meta property=\"og:image:height\" content=\"630\"><meta property=\"og:image:alt\" content=\"Hearth, a private photo app for split families, beside its Photos screen showing a New for you card\"><meta name=\"twitter:card\" content=\"summary_large_image\">"
n=0
while IFS= read -r -d '' f; do
  grep -q 'property="og:title"' "$f" && continue
  TAGS="$TAGS" TITLE="$TITLE" perl -0pi -e 's{<title>[^<]*</title>}{<title>$ENV{TITLE}</title>}; s{</head>}{$ENV{TAGS}</head>}' "$f"; n=$((n + 1))
done < <(find "$DIR" -name index.html -print0)
echo "Site link preview: added to $n pages"
