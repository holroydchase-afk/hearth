// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Easy view (docs/product/SPEC-REDESIGN.md 1g, RD-74 / RD-75, DEC-66). One setting bundles the grandparent comforts
// (words under the tabs, bigger text) and replaces Bigger text. On for viewers, Off for owners and adults, unless this
// phone already holds a choice. Written first (Nov 17), red until Prefs.easyView exists.
import type { Role } from '../../api/HearthApi';
import { memoryKV } from '../../platform/kv';
import { defaultPrefs, loadPrefs, savePrefs, type Prefs } from '../prefs';

// Typed loosely so this file typechecks before `easyView` replaces `bigText` on Prefs.
type Loose = Record<string, unknown>;
const loose = (p: Prefs) => p as unknown as Loose;
const KEY = 'hearth.prefs.v1.u-1';
const stored = (kv: ReturnType<typeof memoryKV>) => JSON.parse(kv.dump()[KEY] ?? '{}') as Loose;

describe('RD-74 Easy view role defaults', () => {
  it.each([
    ['viewer', true],
    ['owner', false],
    ['adult', false],
  ] as const)('RD-74 a %s with no saved choices gets Easy view on: %s', async (role, on) => {
    expect(loose(defaultPrefs(role as Role)).easyView).toBe(on);
    const p = loose(await loadPrefs(memoryKV(), 'u-1', role as Role));
    expect(p.easyView).toBe(on);
  });

  it('RD-74 Prefs carries easyView and no bigText after loading', async () => {
    for (const role of ['viewer', 'owner', 'adult'] as const) {
      expect({ role, has: 'bigText' in loose(defaultPrefs(role)) }).toEqual({ role, has: false });
      const p = loose(await loadPrefs(memoryKV({ [KEY]: '{"bigText":true,"notify":"push"}' }), 'u-1', role));
      expect({ role, has: 'bigText' in p }).toEqual({ role, has: false });
    }
  });
});

describe('RD-75 saved Bigger text becomes Easy view', () => {
  it.each([
    ['owner', true],
    ['owner', false],
    ['adult', true],
    ['viewer', false],
    ['viewer', true],
  ] as const)('RD-75 a %s whose phone saved bigText %s loads the same Easy view', async (role, saved) => {
    const kv = memoryKV({ [KEY]: JSON.stringify({ bigText: saved, notify: 'evening', look: 'dark' }) });
    const p = await loadPrefs(kv, 'u-1', role as Role);
    expect(loose(p).easyView).toBe(saved);
    expect(p.notify).toBe('evening'); // the other choices survive the move
    expect(p.look).toBe('dark');
  });

  it('RD-75 the next save holds easyView and no bigText', async () => {
    const kv = memoryKV({ [KEY]: '{"bigText":true}' });
    const p = await loadPrefs(kv, 'u-1', 'owner');
    await savePrefs(kv, 'u-1', p);
    const s = stored(kv);
    expect(s.easyView).toBe(true);
    expect('bigText' in s).toBe(false);
  });

  it('RD-75 a saved easyView wins over an old bigText left beside it', async () => {
    const kv = memoryKV({ [KEY]: '{"easyView":false,"bigText":true}' });
    expect(loose(await loadPrefs(kv, 'u-1', 'viewer')).easyView).toBe(false);
  });

  it.each([
    ['not JSON', 'not json at all'],
    ['bigText not a yes/no', '{"bigText":"yes"}'],
    ['easyView not a yes/no', '{"easyView":1}'],
    ['neither saved', '{"notify":"push"}'],
  ])('RD-75 unreadable or missing (%s) falls back to the role default', async (_why, raw) => {
    for (const [role, on] of [['viewer', true], ['owner', false], ['adult', false]] as const) {
      const p = loose(await loadPrefs(memoryKV({ [KEY]: raw }), 'u-1', role));
      expect({ role, easyView: p.easyView }).toEqual({ role, easyView: on });
    }
  });
});
