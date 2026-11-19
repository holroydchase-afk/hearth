// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// ENG-R5 (Nov 19 tech-debt review): the fake backend, the sample family and the demo's frame ship only in the
// builds that use them (EXPO_PUBLIC_HEARTH_FAKE=1 or EXPO_PUBLIC_HEARTH_DEMO=1). Metro swaps them for small
// ".off" stand-ins in every other build, so the phone app doesn't carry 1,200 lines of fixture family.
import fs from 'fs';
import path from 'path';

type Ctx = { resolveRequest: jest.Mock; originModulePath: string };

function metroWith(env: Record<string, string | undefined>) {
  const keep = { ...process.env };
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  jest.isolateModules(() => {});
  let config: { resolver: { resolveRequest?: (c: Ctx, m: string, p: string | null) => unknown } } | undefined;
  jest.isolateModules(() => { config = require('../../../metro.config.js'); });
  process.env = keep;
  return config!;
}

const ctx = (): Ctx => ({ resolveRequest: jest.fn((_c, m: string) => ({ type: 'sourceFile', filePath: m })), originModulePath: '/x/src/state/runtime.ts' });

describe('ENG-R5 demo and fake code stay out of the real app', () => {
  it('ENG-R5 a real build resolves fakeRuntime and DemoChrome to their .off stand-ins', () => {
    const resolve = metroWith({ EXPO_PUBLIC_HEARTH_FAKE: undefined, EXPO_PUBLIC_HEARTH_DEMO: undefined }).resolver.resolveRequest!;
    const c = ctx();
    expect(resolve(c, './fakeRuntime', 'ios')).toEqual({ type: 'sourceFile', filePath: './fakeRuntime.off' });
    expect(resolve(c, '../demo/DemoChrome', 'ios')).toEqual({ type: 'sourceFile', filePath: '../demo/DemoChrome.off' });
    expect(resolve(c, '../ui/kit', 'ios')).toEqual({ type: 'sourceFile', filePath: '../ui/kit' });
  });

  it('ENG-R5 the demo build and the fake web build keep the real files', () => {
    for (const env of [{ EXPO_PUBLIC_HEARTH_DEMO: '1' }, { EXPO_PUBLIC_HEARTH_FAKE: '1' }]) {
      const resolve = metroWith(env).resolver.resolveRequest!;
      const c = ctx();
      expect(resolve(c, './fakeRuntime', 'web')).toEqual({ type: 'sourceFile', filePath: './fakeRuntime' });
    }
  });

  it('ENG-R5 runtime.ts reaches the fake backend and the demo only through fakeRuntime', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'runtime.ts'), 'utf8');
    expect(src).not.toMatch(/from '\.\.\/api\/fake\/|from '\.\.\/demo\/(seed|pictures)'/);
    expect(src).toMatch(/from '\.\/fakeRuntime'/);
  });
});
