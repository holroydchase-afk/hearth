// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// VIS-11 (SPEC-VISIBILITY-CORE Phase 2, TRACKER R51): the app's Fake backend agrees with the server's oracle
// (vis.can_see) on the same generated family. Written FIRST (Nov 24, 2026, qa-tdd): red until
//   1. backend/tests/vis_oracle/fixtures/seed-42.json exists (vis_oracle.fixture_json() for seed 42; the SQL suite
//      tests/vis_oracle_test.sql keeps the committed copy equal to the generator), and
//   2. FakeBackend.fromOracleFixture(fixture) loads it (users, families, members, groups with share-history
//      cutoffs, posts and their groups, replies, reactions, life-calendar dates).
// Fixture shape (the contract for fixture_json()):
//   { seed, users: [{id, name}], spaces: [{id, name, deleted, reply_audience}], members: [{space, user, role}],
//     circles: [{id, space, name, kind, deleted}], circle_members: [{circle, user, sees_from}],
//     posts: [{id, space, author, status, deleted, published_at, taken_at, title, caption, circles}],
//     comments: [{id, post, author, body, created_at, deleted}], reactions: [{post, user, emoji, created_at}],
//     family_dates: [{id, space, kind, label, month, day, member, created_by}],
//     oracle: { post: [[user, post]], comment: [[user, comment]], family_date: [[user, date]] } }  // can_see = true pairs
// Personas only: the generator's names are the kids' nicknames from docs/product/PERSONAS.md.
import * as fs from 'fs';
import * as path from 'path';
import { ApiError, type HearthApi } from '../HearthApi';
import { FakeBackend } from '../fake/FakeBackend';
import type { FeedPost } from '../types';

const FIXTURE_PATH = path.resolve(__dirname, '../../../../backend/tests/vis_oracle/fixtures/seed-42.json');

interface OracleFixture {
  seed: number;
  users: { id: string; name: string }[];
  spaces: { id: string; deleted: boolean }[];
  posts: { id: string; space: string; status: string; deleted: boolean }[];
  comments: { id: string; post: string; deleted: boolean }[];
  family_dates: { id: string; space: string }[];
  oracle: { post: [string, string][]; comment: [string, string][]; family_date: [string, string][] };
}

type Loader = { fromOracleFixture?: (fx: OracleFixture) => FakeBackend };

function load(): { fx: OracleFixture; be: FakeBackend } {
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error(`VIS-11 fixture missing: ${FIXTURE_PATH} (write it with backend/tests/vis_oracle/nightly.sh --seed 42 --fixture)`);
  }
  const fx = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as OracleFixture;
  const from = (FakeBackend as unknown as Loader).fromOracleFixture;
  if (typeof from !== 'function') throw new Error('VIS-11 FakeBackend.fromOracleFixture(fixture) is missing');
  return { fx, be: from(fx) };
}

const key = (u: string, id: string) => `${u} ${id}`;
const pairs = (list: [string, string][]) => new Set(list.map(([u, id]) => key(u, id)));
const isNotFound = (e: unknown) => e instanceof ApiError && e.code === 'P0002';

/** Every mismatch as "user <name>, kind, path, id: wrong yes (P0) | wrong no (P1)". */
function diff(fx: OracleFixture, kind: string, pathName: string, want: Set<string>, got: Set<string>, domain: [string, string][]): string[] {
  const name = new Map(fx.users.map((u) => [u.id, u.name]));
  const out: string[] = [];
  for (const [u, id] of domain) {
    const w = want.has(key(u, id));
    const g = got.has(key(u, id));
    if (w !== g) out.push(`user ${name.get(u) ?? u} (${u}), ${kind}, ${pathName}, ${id}: ${g ? 'wrong yes (P0)' : 'wrong no (P1)'}`);
  }
  return out;
}

async function allPages<T extends { post_id: string }>(next: (before: T | null) => Promise<T[]>): Promise<string[]> {
  const ids: string[] = [];
  let before: T | null = null;
  for (;;) {
    let rows: T[];
    try { rows = await next(before); } catch { return ids; }
    ids.push(...rows.map((r) => r.post_id));
    if (rows.length < 50) return ids;
    before = rows[rows.length - 1]!;
  }
}

describe('VIS-11 the Fake backend agrees with the oracle (seed 42)', () => {
  let fx: OracleFixture;
  let be: FakeBackend;
  let loadError: Error | null = null;
  const client = (u: string): HearthApi => be.clientFor(u);
  const listed = () => fx.posts.filter((p) => p.status === 'published' && !p.deleted);
  const cross = <T extends { id: string }>(rows: T[]): [string, string][] => fx.users.flatMap((u) => rows.map((r) => [u.id, r.id] as [string, string]));
  const ready = () => { if (loadError) throw loadError; };

  beforeAll(() => {
    try { ({ fx, be } = load()); } catch (e) { loadError = e as Error; }
  });

  it('VIS-11 the seed-42 fixture loads into the Fake backend', () => {
    ready();
    expect(fx.seed).toBe(42);
    expect(fx.users.length).toBeGreaterThanOrEqual(12);
    expect(fx.oracle.post.length).toBeGreaterThan(0);
  });

  for (const pathName of ['feed', 'timeline', 'search'] as const) {
    it(`VIS-11 ${pathName}: every person's posts equal vis.can_see`, async () => {
      ready();
      const got = new Set<string>();
      for (const u of fx.users) {
        const api = client(u.id);
        for (const s of fx.spaces) {
          const ids = pathName === 'feed'
            ? await allPages((b: FeedPost | null) => api.getFeed({ space: s.id, beforeTs: b?.published_at ?? null, beforeId: b?.post_id ?? null, limit: 50 }))
            : pathName === 'timeline'
              ? await allPages((b: { post_id: string; sort_at: string } | null) =>
                api.getTimeline({ space: s.id, beforeAt: b?.sort_at ?? null, beforeId: b?.post_id ?? null, limit: 50 }))
              : await allPages((b: { post_id: string; sort_at: string } | null) =>
                api.searchPosts({ space: s.id, from: '1900-01-01T00:00:00Z', until: '2200-01-01T00:00:00Z', beforeAt: b?.sort_at ?? null, beforeId: b?.post_id ?? null, limit: 50 }));
          ids.forEach((id) => got.add(key(u.id, id)));
        }
      }
      expect(diff(fx, 'post', pathName, pairs(fx.oracle.post), got, cross(listed()))).toEqual([]);
    });
  }

  it('VIS-11 post by id (getComments): visible posts open, the rest say not found (VIS-9)', async () => {
    ready();
    const got = new Set<string>();
    const odd: string[] = [];
    for (const u of fx.users) {
      for (const p of listed()) {
        try { await client(u.id).getComments(p.id, 1000); got.add(key(u.id, p.id)); } catch (e) {
          if (!isNotFound(e)) odd.push(`user ${u.name}, post, getComments, ${p.id}: ${String(e)} (not P0002)`);
        }
      }
    }
    expect([...diff(fx, 'post', 'getComments', pairs(fx.oracle.post), got, cross(listed())), ...odd]).toEqual([]);
  });

  it('VIS-11 replies: each person reads exactly the replies vis.can_see allows', async () => {
    ready();
    const got = new Set<string>();
    for (const u of fx.users) {
      for (const p of listed()) {
        try { (await client(u.id).getComments(p.id, 1000)).forEach((c) => got.add(key(u.id, c.comment_id))); } catch { /* not found */ }
      }
    }
    const onListed = new Set(listed().map((p) => p.id));
    expect(diff(fx, 'comment', 'getComments', pairs(fx.oracle.comment), got, cross(fx.comments.filter((c) => onListed.has(c.post))))).toEqual([]);
  });

  it('VIS-11 postViewers: a post opens to exactly its viewers, and names exactly them', async () => {
    ready();
    const got = new Set<string>();
    const named = new Set<string>();
    for (const u of fx.users) {
      const ids = listed().map((p) => p.id);
      for (let i = 0; i < ids.length; i += 100) {
        try {
          for (const row of await client(u.id).postViewers(ids.slice(i, i + 100))) {
            got.add(key(u.id, row.post_id));
            row.viewers.forEach((v) => named.add(key(v.user_id, row.post_id)));
          }
        } catch { /* nothing visible */ }
      }
    }
    const want = pairs(fx.oracle.post);
    const seenPosts = new Set([...got].map((k) => k.split(' ')[1]!));
    const namesDomain = cross(listed().filter((p) => seenPosts.has(p.id)));
    expect([
      ...diff(fx, 'post', 'postViewers', want, got, cross(listed())),
      ...diff(fx, 'post', 'postViewers:names', want, named, namesDomain),
    ]).toEqual([]);
  });

  it('VIS-11 familyDates: each person sees exactly the life-calendar dates vis.can_see allows', async () => {
    ready();
    const got = new Set<string>();
    for (const u of fx.users) {
      for (const s of fx.spaces) {
        try { (await client(u.id).familyDates(s.id)).forEach((d) => got.add(key(u.id, d.id))); } catch { /* not a member */ }
      }
    }
    expect(diff(fx, 'family_date', 'familyDates', pairs(fx.oracle.family_date), got, cross(fx.family_dates))).toEqual([]);
  });
});
