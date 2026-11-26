#!/usr/bin/env bash
# INTAKE-206 (QA-A8): the web e2e tests wait on a condition, never on a fixed sleep.
# Fails when `waitForTimeout` appears under app/e2e-web (use helpers/settle.js or an expect). Usage: [repo_root]
set -u
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
hits=$(grep -rn "waitForTimeout" "$ROOT/app/e2e-web" --include='*.js' 2>/dev/null | grep -v node_modules | grep -v "/results/")
if [ -n "$hits" ]; then
  echo "check-no-fixed-sleeps: fixed sleeps found (wait on a condition; see app/e2e-web/helpers/settle.js):"
  echo "$hits" | cut -c1-160
  exit 1
fi
echo "check-no-fixed-sleeps: ok"
