// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// INTAKE-199 (studio lint gate): lint runs on PRs, warnings only until STUDIO_LINT_STRICT=1, and the
// package pins its Node version. LINT-1..5.
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import pkg from '../../package.json';

const root = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('INTAKE-199 studio lint gate', () => {
  it('LINT-1 package.json has a lint script and the ESLint devDependencies', () => {
    expect((pkg.scripts as Record<string, string>).lint).toMatch(/eslint/);
    const dev = pkg.devDependencies as Record<string, string>;
    for (const d of ['eslint', 'typescript-eslint', 'eslint-plugin-react-hooks', 'eslint-plugin-react-native']) {
      expect(dev[d]).toBeTruthy();
    }
  });

  it('LINT-2 the config lives in app/, warnings only unless STUDIO_LINT_STRICT=1', () => {
    expect(existsSync(join(root, 'app/eslint.config.mjs'))).toBe(true);
    expect(read('app/eslint.config.mjs')).toContain('STUDIO_LINT_STRICT');
  });

  it('LINT-3 a lint job runs on pull requests from app/ in strict mode', () => {
    const y = read('.github/workflows/lint.yml');
    expect(y).toMatch(/pull_request/);
    expect(y).toMatch(/working-directory: app/);
    expect(y).toMatch(/STUDIO_LINT_STRICT: '1'/);
    expect(y).toMatch(/npm run lint/);
  });

  it('LINT-4 engines.node is set and .nvmrc agrees', () => {
    const engines = pkg.engines as { node?: string };
    expect(engines.node).toMatch(/22/);
    expect(read('.nvmrc').trim()).toBe('22');
  });

  it('LINT-5 CI uses the same Node major as .nvmrc', () => {
    expect(read('.github/workflows/lint.yml')).toMatch(/node-version-file: \.nvmrc/);
  });

  // INTAKE-204: every eslint-disable says why (`-- reason`), and none suppresses nothing.
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', 'dist-demo', 'dist-fake', '.expo'].includes(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full, out);
      else if (/\.(tsx?|jsx?|mjs)$/.test(e.name)) out.push(full);
    }
    return out;
  };

  it('LINT-6 every eslint-disable comment carries a reason after " -- "', () => {
    const bad: string[] = [];
    for (const f of walk(join(root, 'app'))) {
      if (f.endsWith('lint.test.ts')) continue;
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/eslint-disable/.test(line) && !/eslint-disable\S*\s[^\n]*\s--\s+\S/.test(line)) {
          bad.push(`${f.replace(root + '/', '')}:${i + 1}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });

  it('LINT-7 the config reports disable comments that suppress nothing', () => {
    expect(read('app/eslint.config.mjs')).toMatch(/reportUnusedDisableDirectives/);
  });
});
