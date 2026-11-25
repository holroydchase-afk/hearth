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

  // Updated Nov 24 (T45 DEMO-NAMES-1/4; was "Kevin", DEC-82; "Chase", DEC-64): the parent is "Graham", the mom "Eliza",
  // the other grandparents Nana Eloise and Grandpa Hollis; Grandma Jo stays; no surname appears.
  it('DEMO-3 DEMO-NAMES-1 DEMO-NAMES-4 the demo parent is "Graham"; the rest are made-up names and no surname, "Chase" or "Kai" appears', async () => {
    const be = await seeded();
    const names = Object.values(be.state.users).map((u) => u.name);
    expect(names).toEqual(expect.arrayContaining(['Graham', 'Eliza', 'Nana Eloise', 'Grandpa Hollis', 'Grandma Jo']));
    expect(be.state.users[F.users.chase.id]!.name).toBe('Graham');
    expect(be.state.users[F.users.chase.id]!.email).toBe('graham@example.com');
    for (const u of Object.values(be.state.users)) expect(u.email).toMatch(/^[a-z0-9._+-]+@example\.com$/);
    expect(JSON.stringify(be.state.users)).not.toMatch(/\b(Kevin|Alex|Ruth|Earl)\b/);
    expect(JSON.stringify(be.state.users)).not.toMatch(/\bKai\b|Holroyd|Chase/i);
    expect(Object.values(DEMO_NAMES)).not.toContain('Kai');
    expect(be.state.spaces[F.space.id]!.name).toBe('Clara and Leo'); // T45 QA-R1: the demo seed renames the fixture's 'Mia and Leo'
  });

  it('DEMO-PHOTO-9 no seeded caption, title or reply says "Chase"', async () => {
    const be = await seeded();
    const words = [...Object.values(be.state.posts).flatMap((p) => [p.caption ?? '', p.title ?? '']), ...Object.values(be.state.comments).map((c) => c.body)];
    expect(words.filter((w) => /Chase/i.test(w))).toEqual([]);
  });

  it("DEMO-PHOTO-11 Grandma Jo gets posts 1, 2, 4, 5, 6 and 7 (18 photos), never Mom's-side post 3", async () => {
    const be = await seeded();
    const hers = be.getFeed(F.users.jo.id, { space: F.space.id, limit: 50 });
    const want = [0, 1, 3, 4, 5, 6].map((i) => DEMO_POSTS[i]!.caption);
    expect(hers.map((p) => p.caption).sort()).toEqual([...want].sort());
    expect(hers.reduce((n, p) => n + p.media.length, 0)).toBe(18);
    expect(hers.map((p) => p.caption)).not.toContain(DEMO_POSTS[2]!.caption);
    expect(DEMO_POSTS[2]!.pictures).toEqual(['orchard-4543661']);
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
    await seedDemo(be, (name) => (name === 'orchard-4543661' ? Promise.reject(new Error('offline')) : picture(name)));
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
  it('DEMO-NEW-1 seeding sets a last visit 3 days ago for the parent and Grandma Jo, on this browser only', async () => {
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

  // Updated Nov 24 (DEMO-PHOTO-12): the parent's new photos are Alex's one balance-bike post of 3; counts photos, not posts.
  it('DEMO-NEW-2 the parent has 2+ new photos, all from Alex, and Grandma Jo has new ones too', async () => {
    const be = FakeBackend.withFixture({ joIsMember: true });
    const kv = memoryKV();
    await seedDemo(be, picture, kv);
    const kevin = F.users.chase.id, jo = F.users.jo.id;
    const kevinNew = newForYou(be.getFeed(kevin, { space: F.space.id, limit: 50 }), await loadLastSeen(kv, kevin), kevin);
    expect(kevinNew.reduce((n, p) => n + p.media.length, 0)).toBeGreaterThanOrEqual(2);
    expect(kevinNew.every((p) => p.author_id === F.users.alex.id)).toBe(true);
    const joNew = newForYou(be.getFeed(jo, { space: F.space.id, limit: 50 }), await loadLastSeen(kv, jo), jo);
    expect(joNew.length).toBeGreaterThanOrEqual(2);
  });

  it("DEMO-PHOTO-12 a fresh visit's New for you starts with Alex's balance bike post and its 3 photos", async () => {
    const be = FakeBackend.withFixture({ joIsMember: true });
    const kv = memoryKV();
    await seedDemo(be, picture, kv);
    const kevin = F.users.chase.id;
    const first = newForYou(be.getFeed(kevin, { space: F.space.id, limit: 50 }), await loadLastSeen(kv, kevin), kevin)[0];
    expect(first?.author_id).toBe(F.users.alex.id);
    expect([first?.title, first?.caption]).toContain('First ride on the balance bike');
    expect(first?.media).toHaveLength(3);
  });

  it('DEMO-NEW-3 no picture is used by two posts (the wall shows each picture once)', () => {
    const all = DEMO_POSTS.flatMap((p) => p.pictures);
    expect(new Set(all).size).toBe(all.length);
  });

  it('DEMO-NEW-4 every picture a post uses ships in public/demo-pictures', () => {
    const dir = path.join(__dirname, '../../../public/demo-pictures');
    for (const name of DEMO_POSTS.flatMap((p) => p.pictures)) {
      expect(fs.existsSync(path.join(dir, `${name}.jpg`))).toBe(true);
      expect(fs.existsSync(path.join(dir, `${name}-thumb.jpg`))).toBe(true);
    }
  });
});

// GUX-DP-AC1..AC6 (grandparent-ux review of the demo words, Nov 24; SPEC-DEMO-PHOTOS "Demo words"): every word a
// visitor reads in the demo sounds like a real grandparent, says what the photo shows, and stays short.
describe('GUX-DP demo words', () => {
  const post = (n: number) => DEMO_POSTS[n - 1]!;
  const reply = (n: number, who: string) => post(n).replies.filter((r) => r.who === who).map((r) => r.body);

  it('GUX-DP-AC1 post 6: Nana Eloise (fixture ruth) says "Look at that little yellow coat go!" and no reply says "smile"', () => {
    expect(reply(6, 'ruth')).toEqual(['Look at that little yellow coat go!']);
    expect(DEMO_POSTS.flatMap((p) => p.replies.map((r) => r.body)).filter((b) => /smile/i.test(b))).toEqual([]);
  });

  it('GUX-DP-AC2 post 7: caption "A ride under the big yellow tree", Jo "That\'s a lot of leaves!", no "leaf pile"', () => {
    expect(post(7).caption).toBe('A ride under the big yellow tree');
    expect(reply(7, 'jo')).toEqual(["That's a lot of leaves!"]);
    expect(DEMO_POSTS.map((p) => p.caption).filter((c) => /leaf pile/i.test(c))).toEqual([]);
  });

  it('GUX-DP-AC3 post 3: Nana Eloise (fixture ruth) says "Three of my favorite faces."', () => {
    expect(reply(3, 'ruth')).toEqual(['Three of my favorite faces.']);
  });

  it('GUX-DP-AC4 post 2: Grandma Jo says "Your dad used to carry you just like that."', () => {
    expect(reply(2, 'jo')).toEqual(['Your dad used to carry you just like that.']);
  });

  it('GUX-DP-AC5 post 1 and post 5 captions read as a moment, not a label', () => {
    expect(post(1).caption).toBe('Everything was in bloom, and the kids ran the whole time.');
    expect(post(5).caption).toBe('Then we all sat down for tea and pancakes.');
  });

  it('GUX-DP-AC6 every seeded caption, title and reply is 60 characters or less, without "Chase" or "circle"', async () => {
    const be = await seeded();
    const words = [
      ...DEMO_POSTS.flatMap((p) => [p.caption, p.title ?? '', ...p.replies.map((r) => r.body)]),
      ...Object.values(be.state.posts).flatMap((p) => [p.caption ?? '', p.title ?? '']),
      ...Object.values(be.state.comments).map((c) => c.body),
    ];
    expect(words.filter((w) => [...w].length > 60)).toEqual([]);
    expect(words.filter((w) => /Chase|circle/i.test(w))).toEqual([]);
  });
});
