// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// EF-HE-9 / B18 (qa-tdd review, Nov 24): the edges of FeedStore.loadBackTo, the walk back to the last visit that
// New for you waits on. A walk must always end (no hang), never fetch the same page twice, stop at its cap, and
// leave the feed without a hole when a refresh lands in the middle of it.
import { ApiError, type HearthApi } from '../../api/HearthApi';
import { FakeBackend, FIXTURE } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { FeedStore } from '../store';

const SPACE = FIXTURE.space.id;
const { jo } = FIXTURE.users;
const HOUR = 3600e3;
const T0 = Date.parse('2026-11-20T12:00:00Z');

/** n posts one minute apart, starting at `from` (oldest first); returns ids oldest first. */
async function seedAt(be: FakeBackend, n: number, from: number, tag = 'p') {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const { id } = await seedPost(be, { caption: `${tag} ${i}`, circles: [FIXTURE.circles.dadSide.id] });
    const at = new Date(from + i * 60e3).toISOString();
    be.state.posts[id]!.published_at = at;
    be.state.posts[id]!.created_at = at;
    ids.push(id);
  }
  return ids;
}

const make = (api: HearthApi, pageSize = 5) => new FeedStore({ api, kv: memoryKV(), userId: jo.id, spaceId: SPACE, pageSize });
const ids = (s: FeedStore) => s.getState().posts.map((p) => p.post_id);

describe('EF-HE-9 B18 FeedStore.loadBackTo edges', () => {
  it('EF-HE-9 B18 walks back until the oldest loaded post is at or before the last visit, then stops', async () => {
    const be = FakeBackend.withFixture();
    const old = await seedAt(be, 10, T0 - 2 * HOUR, 'old');
    const fresh = await seedAt(be, 12, T0, 'new');
    const api = be.clientFor(jo.id);
    const s = make(api);
    await s.refresh();
    const spy = jest.spyOn(api, 'getFeed');
    await s.loadBackTo(new Date(T0 - HOUR).toISOString());
    // 12 new posts need 3 pages of 5 (the 3rd reaches past the last visit); no 4th page.
    expect(spy).toHaveBeenCalledTimes(2);
    expect(ids(s).slice(0, 12)).toEqual(fresh.slice().reverse());
    expect(ids(s)).toContain(old[old.length - 1]);
    expect(s.getState().status).toBe('idle');
  });

  it('EF-HE-9 B18 stops at its page cap (10 by default, or what is passed)', async () => {
    const be = FakeBackend.withFixture();
    await seedAt(be, 40, T0);
    const api = be.clientFor(jo.id);
    const s = make(api);
    await s.refresh();
    const spy = jest.spyOn(api, 'getFeed');
    await s.loadBackTo(new Date(T0 - HOUR).toISOString(), 3);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(ids(s)).toHaveLength(20);
    expect(s.getState().hasMore).toBe(true);
  });

  it('EF-HE-9 B18 a page that fails mid-walk ends the walk (no hang), shows the plain notice, and a later walk carries on', async () => {
    const be = FakeBackend.withFixture();
    await seedAt(be, 20, T0);
    const api = be.clientFor(jo.id);
    const s = make(api);
    await s.refresh();
    const real = api.getFeed.bind(api);
    let calls = 0;
    const spy = jest.spyOn(api, 'getFeed').mockImplementation(async (a) => {
      calls += 1;
      if (calls === 2) throw new ApiError('P0002', 'offline');
      return real(a);
    });
    await expect(s.loadBackTo(new Date(T0 - HOUR).toISOString())).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(2); // page 2 loaded, page 3 failed, no retry loop
    expect(ids(s)).toHaveLength(10);
    expect(s.getState().notice).toBeTruthy();
    expect(s.getState().status).toBe('idle');
    await s.loadBackTo(new Date(T0 - HOUR).toISOString());
    expect(ids(s)).toHaveLength(20);
    expect(s.getState().hasMore).toBe(false);
  });

  it('EF-HE-9 B18 a scroll\'s loadMore already in flight is shared: the walk never asks for the same page twice', async () => {
    const be = FakeBackend.withFixture();
    await seedAt(be, 15, T0);
    const api = be.clientFor(jo.id);
    const s = make(api);
    await s.refresh();
    const spy = jest.spyOn(api, 'getFeed');
    const scroll = s.loadMore();
    const walk = s.loadBackTo(new Date(T0 - HOUR).toISOString());
    const scroll2 = s.loadMore();
    await Promise.all([scroll, walk, scroll2]);
    const keys = spy.mock.calls.map(([a]) => `${a.beforeTs}|${a.beforeId}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(ids(s)).toHaveLength(15);
    expect(new Set(ids(s)).size).toBe(15);
  });

  it('EF-HE-9 B18 a refresh that lands mid-walk (with new posts on the server) leaves no hole in the feed', async () => {
    const be = FakeBackend.withFixture();
    await seedAt(be, 20, T0);
    const api = be.clientFor(jo.id);
    const s = make(api);
    await s.refresh();
    // Hold page 2 until a refresh (after 6 new posts) has answered.
    const real = api.getFeed.bind(api);
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let held = false;
    jest.spyOn(api, 'getFeed').mockImplementation(async (a) => {
      if (a.beforeTs && !held) {
        held = true;
        const rows = await real(a);
        await gate;
        return rows;
      }
      return real(a);
    });
    const walk = s.loadBackTo(new Date(T0 - HOUR).toISOString());
    await Promise.resolve();
    await seedAt(be, 6, T0 + HOUR, 'later');
    await s.refresh();
    release();
    await walk;
    await s.loadBackTo(new Date(T0 - HOUR).toISOString()); // the screen walks again for the new fetchedAt
    // Every post the server has, newest first, with none missing between the first page and the oldest loaded.
    const server = be.getFeed(jo.id, { space: SPACE, limit: 50 }).map((p) => p.post_id);
    expect(ids(s)).toEqual(server);
  });
});
