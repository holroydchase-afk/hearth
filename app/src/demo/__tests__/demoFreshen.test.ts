// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-FRESH-1..3 (Chase, Nov 17: "the site hasn't updated"): a returning visitor's browser kept the
// sample family it saved on the first visit (Kai, the old pictures), so a new demo never showed.
// When the sample family changes, a saved copy from an older one is thrown out, like Start over.
import { DEMO_POSTS, DEMO_SEED_KEY, demoSeedVersion, freshenDemoStorage, DEMO_NAMES } from '../seed';

function storage(init: Record<string, string>) {
  const m = new Map(Object.entries(init));
  return {
    m,
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
  };
}

describe('DEMO-FRESH saved demo family follows the current sample family', () => {
  it('DEMO-FRESH-1 a copy saved by an older demo (no version) is cleared, other sites\' keys stay', () => {
    const ls = storage({ 'hearth.fakeBackend.v1': '{"users":"Kai"}', 'hearth.lastSeen.u1': 'x', hs_session: 's', 'role-radar.jobs': 'keep' });
    expect(freshenDemoStorage(ls)).toBe(true);
    expect([...ls.m.keys()].sort()).toEqual([DEMO_SEED_KEY, 'role-radar.jobs'].sort());
    expect(ls.getItem(DEMO_SEED_KEY)).toBe(demoSeedVersion());
  });

  it('DEMO-FRESH-2 a copy saved by this demo is kept (photos you added survive a reload)', () => {
    const ls = storage({ 'hearth.fakeBackend.v1': '{"mine":1}', [DEMO_SEED_KEY]: demoSeedVersion() });
    expect(freshenDemoStorage(ls)).toBe(false);
    expect(ls.getItem('hearth.fakeBackend.v1')).toBe('{"mine":1}');
  });

  it('DEMO-FRESH-3 the version changes when a caption or a name changes', () => {
    const v = demoSeedVersion();
    expect(demoSeedVersion({ posts: [{ ...DEMO_POSTS[0]!, caption: 'other' }, ...DEMO_POSTS.slice(1)], names: DEMO_NAMES })).not.toBe(v);
    expect(demoSeedVersion({ posts: DEMO_POSTS, names: { ...DEMO_NAMES, x: 'Kai' } })).not.toBe(v);
    expect(demoSeedVersion()).toBe(v);
  });
});
