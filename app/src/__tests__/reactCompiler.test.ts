// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// INTAKE-80: the React Compiler is on (Expo guide, SDK 54+: app.json expo.experiments.reactCompiler, no
// babel config). app.config.js must keep the switch on both paths: plain, and the demo's HEARTH_BASE_URL.
// The bundle check (INTAKE-80-2) is app/scripts/check-compiler-bundle.sh; the rules check (INTAKE-80-3)
// is app/scripts/compiler-check.js.
import appJson from '../../app.json';
// eslint-disable-next-line @typescript-eslint/no-require-imports -- app.config.js is CommonJS and is read as a function
const appConfig = require('../../app.config.js') as (ctx: { config: Record<string, unknown> }) => Record<string, unknown>;

type Experiments = { reactCompiler?: unknown; baseUrl?: unknown };
const experimentsOf = (c: Record<string, unknown>) => (c.experiments ?? {}) as Experiments;

describe('INTAKE-80 React Compiler is turned on', () => {
  const saved = process.env.HEARTH_BASE_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.HEARTH_BASE_URL;
    else process.env.HEARTH_BASE_URL = saved;
  });

  it('INTAKE-80-1 app.json sets expo.experiments.reactCompiler to true', () => {
    expect(experimentsOf(appJson.expo as unknown as Record<string, unknown>).reactCompiler).toBe(true);
  });

  it('INTAKE-80-1 app.config.js keeps reactCompiler with no base URL', () => {
    delete process.env.HEARTH_BASE_URL;
    const out = appConfig({ config: structuredClone(appJson.expo) as unknown as Record<string, unknown> });
    expect(experimentsOf(out).reactCompiler).toBe(true);
  });

  it('INTAKE-80-1 app.config.js keeps reactCompiler on the demo base-URL path', () => {
    process.env.HEARTH_BASE_URL = '/demo/hearth';
    const out = appConfig({ config: structuredClone(appJson.expo) as unknown as Record<string, unknown> });
    expect(experimentsOf(out).reactCompiler).toBe(true);
    expect(experimentsOf(out).baseUrl).toBe('/demo/hearth');
  });
});

// B32 (Nov 25): four new bailouts landed unseen because only test-all.sh ran the rules check. CI's app job
// must run it too, so a new skipped component fails the pull request that adds it.
describe('INTAKE-80-4 CI runs the React Compiler rules check', () => {
  it('INTAKE-80-4 B32 the App (Jest + typecheck) job runs scripts/compiler-check.js', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- app.config.js is re-read after the environment changes
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- app.config.js is re-read after the environment changes
    const path = require('path') as typeof import('path');
    const ci = fs.readFileSync(path.join(__dirname, '../../../.github/workflows/ci.yml'), 'utf8');
    const job = ci.split(/\n {2}[a-z][\w-]*:\n/).find((j) => j.includes('name: App (Jest + typecheck)')) ?? '';
    expect(job).toMatch(/run: node scripts\/compiler-check\.js/);
  });
});
