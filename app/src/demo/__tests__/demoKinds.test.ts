// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-KINDS-1..4 (Chase, Nov 25: "yes, turn post_kinds on for the web demo only, so I can tap through Photos / Event
// / News / Saying"). Written FIRST (red), Nov 25, by qa-tdd. PR #194 built the Event, News and Saying cards behind the
// global post_kinds switch, off everywhere. The demo (the FakeBackend build seeded by seed.ts) turns it on; the real
// Supabase builds, and every other fixture backend, stay off.
// The demo's parent is Graham (T45 renamed Kevin and Chase; fixture id F.users.chase, the owner). Grandma Jo is a viewer.
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { DEMO_SEED_KEY, demoSeedVersion, freshenDemoStorage, seedDemo, type DemoPicture } from '../seed';

const F = FIXTURE;
const picture = async (name: string): Promise<DemoPicture> => {
  const fill = name.charCodeAt(0);
  return { display: new Uint8Array(3000).fill(fill), thumb: new Uint8Array(300).fill(fill + 1), width: 1200, height: 900 };
};
const seeded = async () => { const be = FakeBackend.withFixture({ joIsMember: true }); await seedDemo(be, picture); return be; };
/** demoSeedVersion() on origin/main 07b6751, before the kinds switch went on in the demo. */
const VERSION_BEFORE_KINDS = 'wofmn';

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

describe('DEMO-KINDS the web demo has post_kinds on; nothing else does', () => {
  it('DEMO-KINDS-1 the seeded demo turns the global post_kinds flag on, and the parent (Graham, owner) gets it from myFeatures', async () => {
    const be = await seeded();
    expect(be.state.featureFlags?.post_kinds).toBe(true);
    const parent = be.clientFor(F.users.chase.id);
    expect(await parent.myFeatures(F.space.id)).toContain('post_kinds');
  });

  it('DEMO-KINDS-2 Grandma Jo (a viewer, no Share tab) and the other grandparents do not get post_kinds', async () => {
    const be = await seeded();
    for (const who of [F.users.jo, F.users.ruth, F.users.earl]) {
      expect(await be.clientFor(who.id).myFeatures(F.space.id)).not.toContain('post_kinds');
    }
  });

  it('DEMO-KINDS-3 a plain fixture backend (what real builds and every other test use) stays off for the owner', () => {
    const be = FakeBackend.withFixture({ joIsMember: true });
    expect(be.state.featureFlags?.post_kinds).toBeFalsy();
    expect(be.myFeatures(F.users.chase.id, F.space.id)).not.toContain('post_kinds');
  });

  it('DEMO-KINDS-4 the parent can really send a news post in the seeded demo (create_post accepts the kind)', async () => {
    const be = await seeded();
    const api = be.clientFor(F.users.chase.id);
    const id = await api.createPost({ clientId: 'demo-kinds-4', space: F.space.id, kind: 'news', caption: 'We got the keys!', circleIds: [F.circles.everyone.id] } as never);
    expect(id).toBeTruthy();
  });

  it('DEMO-KINDS-5 a browser that saved the demo before the switch (old seed version) is cleared so it reseeds with post_kinds on', () => {
    const ls = storage({ 'hearth.fakeBackend.v1': '{"old":1}', [DEMO_SEED_KEY]: VERSION_BEFORE_KINDS, 'role-radar.jobs': 'keep' });
    expect(freshenDemoStorage(ls)).toBe(true);
    expect(ls.getItem('hearth.fakeBackend.v1')).toBeNull();
    expect(ls.getItem('role-radar.jobs')).toBe('keep');
  });

  it('DEMO-KINDS-5 the seed version moved off the pre-kinds one (the flag is part of the sample family)', () => {
    expect(demoSeedVersion()).not.toBe(VERSION_BEFORE_KINDS);
  });
});
