// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-1..3, DEMO-10 (docs/reviews/2026-10-22-recruiter-ready.md RR-1..3, RR-10): the no-login
// sample-data demo. A visitor lands in a family with photos already in it, as the parent, with no
// sign-in, and can switch to Grandma Jo's view to see that she gets only what was shared with her.
import { decryptMediaAsync } from '../../crypto/media';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import * as fs from 'fs';
import * as path from 'path';
import { memoryKV } from '../../platform/kv';
import { loadLastSeen } from '../../state/lastSeen';
import { newForYou } from '../../feed/newForYou';
import { DEMO_NAMES, DEMO_POSTS, demoKeysToClear, seedDemo, setDemoViewer, type DemoPicture } from '../seed';

const F = FIXTURE;
const DAY = 864e5;

// Stand-in pictures: distinct bytes per name, so a mix-up shows.
const picture = async (name: string): Promise<DemoPicture> => {
  const fill = name.charCodeAt(0);
  return { display: new Uint8Array(3000).fill(fill), thumb: new Uint8Array(300).fill(fill + 1), width: 1200, height: 900 };
};

async function seeded() {
  const be = FakeBackend.withFixture({ joIsMember: true });
  await seedDemo(be, picture);
  return be;
}

describe('DEMO-1..3, DEMO-10 sample-data demo', () => {
  it('DEMO-1 the visitor is already signed in as the parent: no email, no code', async () => {
    const be = await seeded();
    const api = be.clientFor(null, { trackAppSession: true });
    const s = await api.getSession();
    expect(s?.userId).toBe(F.users.chase.id);
  });

  it('DEMO-2 the parent opens on 6+ posts with pictures, spread over past weeks, with hearts and replies', async () => {
    const be = await seeded();
    const feed = be.getFeed(F.users.chase.id, { space: F.space.id, limit: 50 });
    expect(feed.length).toBeGreaterThanOrEqual(6);
    expect(feed.length).toBe(DEMO_POSTS.length);
    expect(feed.every((p) => p.media.length > 0 && p.caption)).toBe(true);
    const ages = feed.map((p) => (Date.now() - Date.parse(p.published_at)) / DAY);
    expect(Math.max(...ages)).toBeGreaterThan(14);
    expect(Math.min(...ages)).toBeGreaterThan(0.5);
    expect(feed.some((p) => p.heart_count > 0)).toBe(true);
    expect(feed.some((p) => p.comment_count > 0)).toBe(true);
    // Newest first, as the app shows them.
    expect([...feed].sort((a, b) => b.published_at.localeCompare(a.published_at)).map((p) => p.post_id)).toEqual(feed.map((p) => p.post_id));
  });

  it('DEMO-2 each picture opens: the stored copy decrypts to the sample bytes', async () => {
    const be = await seeded();
    const first = DEMO_POSTS[0]!;
    const feed = be.getFeed(F.users.chase.id, { space: F.space.id, limit: 50 });
    const post = feed.find((p) => p.caption === first.caption)!;
    const grant = be.signView(F.users.chase.id, post.post_id);
    expect(grant.items).toHaveLength(first.pictures.length);
    const plain = await decryptMediaAsync(be.getObject(grant.items[0]!.display_url), grant.items[0]!.dek);
    expect(plain).toEqual((await picture(first.pictures[0]!)).display);
  });

  it('DEMO-3 sample data has made-up names only (the parent is "Kai", never the founder)', async () => {
    const be = await seeded();
    const names = Object.values(be.state.users).map((u) => u.name);
    expect(names).toEqual(expect.arrayContaining(['Kai', 'Grandma Jo']));
    expect(JSON.stringify(be.state.users)).not.toMatch(/chase/i);
    expect(Object.values(DEMO_NAMES)).not.toContain('Chase');
    expect(be.state.spaces[F.space.id]!.name).toBe('Mia and Leo');
  });

  it('DEMO-10 Grandma Jo\'s view shows only what was shared with her groups; back to the parent shows all', async () => {
    const be = await seeded();
    const api = be.clientFor(null, { trackAppSession: true });
    setDemoViewer(be, 'grandma');
    expect((await api.getSession())?.userId).toBe(F.users.jo.id);
    const hers = be.getFeed(F.users.jo.id, { space: F.space.id, limit: 50 });
    const expected = DEMO_POSTS.filter((p) => p.to !== 'momSide');
    expect(hers.map((p) => p.caption).sort()).toEqual(expected.map((p) => p.caption).sort());
    expect(hers.length).toBeLessThan(DEMO_POSTS.length);
    setDemoViewer(be, 'parent');
    expect((await api.getSession())?.userId).toBe(F.users.chase.id);
  });

  it('DEMO-2 a picture that fails to load skips its post; the rest still show', async () => {
    const be = FakeBackend.withFixture({ joIsMember: true });
    await seedDemo(be, (name) => (name === 'kite' ? Promise.reject(new Error('offline')) : picture(name)));
    const feed = be.getFeed(F.users.chase.id, { space: F.space.id, limit: 50 });
    expect(feed).toHaveLength(DEMO_POSTS.length - 1);
    expect((await be.clientFor(null, { trackAppSession: true }).getSession())?.userId).toBe(F.users.chase.id);
  });

  it('DEMO-3 Start over clears only Hearth\'s own browser keys, never another demo\'s on the same site', () => {
    const keys = ['hearth.fakeBackend.v1', 'hearth.prefs.v1.u1', 'hs_session', 'role-radar.jobs', 'theme', 'ccwatts.v1'];
    expect(demoKeysToClear(keys)).toEqual(['hearth.fakeBackend.v1', 'hearth.prefs.v1.u1', 'hs_session']);
  });

  it('CAP-12 a few sample moments carry a title, so the portfolio shows the feature', async () => {
    const be = await seeded();
    const feed = await be.clientFor(F.users.chase.id).getFeed({ space: F.space.id, limit: 50 });
    const titled = feed.filter((p) => p.title);
    expect(titled.length).toBeGreaterThanOrEqual(2);
    expect(titled.length).toBeLessThan(feed.length);
    for (const p of titled) expect([...p.title!].length).toBeLessThanOrEqual(80);
  });
});

// DEMO-NEW-1..4 (TRACKER R45 step 2, plan gap G1/G5): a first-time visitor sees the New for you card (DEC-58).
describe('DEMO-NEW New for you in the demo', () => {
  it('DEMO-NEW-1 seeding sets a last visit 3 days ago for Kai and Grandma Jo, on this browser only', async () => {
    const be = FakeBackend.withFixture({ joIsMember: true });
    const kv = memoryKV();
    const before = Date.now();
    await seedDemo(be, picture, kv);
    for (const u of [F.users.chase.id, F.users.jo.id]) {
      const at = Date.parse((await loadLastSeen(kv, u))!);
      expect(before - at).toBeGreaterThanOrEqual(3 * DAY - 60e3);
      expect(before - at).toBeLessThanOrEqual(3 * DAY + 60e3);
    }
  });

  it('DEMO-NEW-1 a visit already saved in this browser is kept', async () => {
    const be = FakeBackend.withFixture({ joIsMember: true });
    const kv = memoryKV({ [`hearth.lastSeen.v1.${F.users.chase.id}`]: '2026-01-02T03:04:05.000Z' });
    await seedDemo(be, picture, kv);
    expect(await loadLastSeen(kv, F.users.chase.id)).toBe('2026-01-02T03:04:05.000Z');
  });

  it('DEMO-NEW-2 Kai has 2+ new photos from Alex, and Grandma Jo has new ones too', async () => {
    const be = FakeBackend.withFixture({ joIsMember: true });
    const kv = memoryKV();
    await seedDemo(be, picture, kv);
    const kai = F.users.chase.id, jo = F.users.jo.id;
    const kaiNew = newForYou(be.getFeed(kai, { space: F.space.id, limit: 50 }), await loadLastSeen(kv, kai), kai);
    expect(kaiNew.length).toBeGreaterThanOrEqual(2);
    expect(kaiNew.every((p) => p.author_id === F.users.alex.id)).toBe(true);
    const joNew = newForYou(be.getFeed(jo, { space: F.space.id, limit: 50 }), await loadLastSeen(kv, jo), jo);
    expect(joNew.length).toBeGreaterThanOrEqual(2);
  });

  it('DEMO-NEW-3 no drawing is used by two posts (the wall shows each picture once)', () => {
    const all = DEMO_POSTS.flatMap((p) => p.pictures);
    expect(new Set(all).size).toBe(all.length);
  });

  it('DEMO-NEW-4 every drawing a post uses ships in public/demo-pictures', () => {
    const dir = path.join(__dirname, '../../../public/demo-pictures');
    for (const name of DEMO_POSTS.flatMap((p) => p.pictures)) {
      expect(fs.existsSync(path.join(dir, `${name}.jpg`))).toBe(true);
      expect(fs.existsSync(path.join(dir, `${name}-thumb.jpg`))).toBe(true);
    }
  });
});
