#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Chase Holroyd
# INTAKE-205-1 (HEA-FR104/106): a real build (no EXPO_PUBLIC_HEARTH_FAKE or _DEMO) must carry no sample family and
# no demo frame. Metro swaps fakeRuntime and DemoChrome for their ".off" files (metro.config.js, ENG-R5); this
# exports nothing itself, it checks a bundle that was exported without the flags.
#   bash app/scripts/check-release-bundle.sh <dist dir>        (CI: app job "Real build has no fakes")
# Fails when the JS contains a sample-family marker, and when it lacks the ".off" stub's own sentence (so an empty
# or wrong folder can't pass). Never prints bundle contents, only which marker matched.
set -uo pipefail
DIR=${1:-}
[[ -n $DIR && -d $DIR ]] || { echo "usage: check-release-bundle.sh <dist dir>" >&2; exit 2; }
JS="$DIR/_expo/static/js"
compgen -G "$JS/*/*.js" > /dev/null || { echo "FAIL - $DIR has no exported JavaScript (export the web build first)"; exit 1; }
rc=0
# Sample-family strings from app/src/demo/seed.ts and the fake backend; each must be absent.
MARKERS=("First ride on the balance bike" "Sample data restored." "Nana Eloise" "Grandpa Hollis")
for m in "${MARKERS[@]}"; do
  if cat "$JS"/*/*.js | grep -qF "$m"; then echo "FAIL - the real build contains a sample-family marker (#${#m}-char marker: ${m:0:6}...)"; rc=1; fi
done
if ! cat "$JS"/*/*.js | grep -qF "This build has no sample backend."; then
  echo "FAIL - the real build lacks the fakeRuntime.off stub, so the swap may not have happened"; rc=1
fi
(( rc == 0 )) && echo "ok - the real build has no sample family or demo frame"
exit $rc
