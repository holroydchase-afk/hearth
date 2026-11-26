#!/usr/bin/env bash
# Run every Hearth automated suite, save results, rebuild Test Log seed data.
# QA-ALL-1: fails if any suite that ran failed; names suites it had to skip (no Postgres, no Deno).
set -u
cd "$(dirname "$0")"
source scripts/lib/suite.sh
suite_reset
mkdir -p e2e/results
quiet() { local out=$1; shift; "$@" > "$out" 2>&1; local rc=$?; tail -1 "$out"; return $rc; }
suite "agent roster" bash scripts/check-agents.sh
suite "agent sync" quiet e2e/results/sync-agents.txt bash scripts/tests/sync_agents_test.sh
suite "agent runs" quiet e2e/results/agent-runs.txt bash scripts/tests/agent_runs_test.sh
suite "agents check skip" quiet e2e/results/agents-check-skip.txt bash scripts/tests/agents_check_skip_test.sh
suite "persona checks" quiet e2e/results/persona-checks.txt bash scripts/tests/check_persona_checks_test.sh
suite "unique numbers" quiet e2e/results/unique-numbers.txt bash scripts/tests/check_unique_numbers_test.sh
suite "Expo Go SDK" bash scripts/check-expo-go.sh
suite "Expo Go check test" quiet e2e/results/expo-go.txt bash scripts/tests/check_expo_go_test.sh
suite "log check" quiet e2e/results/priv2-logs.txt bash scripts/tests/check_logs_test.sh
suite "public privacy" bash scripts/check-public-privacy.sh
suite "public privacy guard" quiet e2e/results/public-privacy.txt bash scripts/tests/check_public_privacy_test.sh
suite "no fixed sleeps" bash scripts/check-no-fixed-sleeps.sh
suite "no fixed sleeps guard" quiet e2e/results/no-fixed-sleeps.txt bash scripts/tests/check_no_fixed_sleeps_test.sh
suite "secret scan" bash scripts/check-secrets.sh
suite "secret scan guard" quiet e2e/results/secrets.txt bash scripts/tests/check_secrets_test.sh
suite "real bundle guard" quiet e2e/results/release-bundle.txt bash app/scripts/tests/release_bundle_test.sh
suite "license headers" quiet e2e/results/spdx.txt bash scripts/tests/check_spdx_test.sh
suite "grandparent guide" quiet e2e/results/grandparent-guide.txt bash scripts/tests/grandparent_guide_test.sh
suite "test-all helper" quiet e2e/results/test-all.txt bash scripts/tests/test_all_test.sh
suite "test totals" quiet e2e/results/test-totals.txt bash scripts/tests/test_totals_test.sh
suite "EAS script" quiet e2e/results/app-eas.txt bash app/scripts/tests/eas_test.sh
suite "site analytics" quiet e2e/results/site-analytics.txt bash app/scripts/tests/site_analytics_test.sh
suite "site meta" quiet e2e/results/site-meta.txt bash app/scripts/tests/site_meta_test.sh
suite "site bar" quiet e2e/results/site-bar.txt bash app/scripts/tests/site_bar_test.sh
suite "prototype e2e" bash -c 'cd e2e && npx playwright test'
# QA-R1 (Nov 19 review): the app's own suites, so "everything" means everything.
suite "app jest" quiet e2e/results/app-jest.txt bash -c 'cd app && npx jest --ci --silent'
suite "app typecheck" quiet e2e/results/app-typecheck.txt bash -c 'cd app && npm run -s typecheck'
suite "app e2e demo" quiet e2e/results/app-e2e-demo.txt bash -c 'cd app && npm run -s e2e:demo'
suite "app e2e web" quiet e2e/results/app-e2e-web.txt bash -c 'cd app && npm run -s e2e:web'
# INTAKE-80: React Compiler. The bundle check reads the exports the two e2e suites above just built.
suite "compiler bundle" quiet e2e/results/compiler-bundle.txt bash app/scripts/check-compiler-bundle.sh
suite "compiler rules" quiet e2e/results/compiler-rules.txt node app/scripts/compiler-check.js
suite "deploy script" quiet e2e/results/backend-deploy.txt bash -c 'cd backend && bash tests/deploy/deploy_test.sh'
suite "project ref required" quiet e2e/results/ref-required.txt bash -c 'cd backend && bash tests/ref_required_test.sh'
if pg_isready -q 2>/dev/null; then
  suite "backend SQL" quiet e2e/results/backend-sql.txt bash -c 'cd backend && bash tests/run.sh'
else
  suite_skip "backend SQL" "no local Postgres running"
fi
if pg_isready -q 2>/dev/null; then
  suite "Supabase starter scripts" quiet e2e/results/starter-scripts.txt bash docs/supabase-starter/tests/scripts_test.sh
else
  suite_skip "Supabase starter scripts" "no local Postgres running"
fi
if [ -n "${STUDIO_SUPABASE_TEMPLATE:-}" ] && pg_isready -q 2>/dev/null; then
  suite "Supabase starter invites" quiet e2e/results/starter-invites.txt bash docs/supabase-starter/tests/run-with-template.sh "$STUDIO_SUPABASE_TEMPLATE"
else
  suite_skip "Supabase starter invites" "set STUDIO_SUPABASE_TEMPLATE to studio-agents/templates/supabase; CI runs it"
fi
if command -v deno >/dev/null 2>&1; then
  suite "Deno functions" quiet e2e/results/backend-deno.txt bash -c 'cd backend && deno test --allow-env --allow-read supabase/functions/sign-media/ supabase/functions/notify/ tests/templates/'
else
  suite_skip "Deno functions" "Deno isn't installed; CI runs them"
fi
echo "Rebuild the Test Log data with: python3 tracker/build_seed.py (add a new run entry first)"
suite_report
