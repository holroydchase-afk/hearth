// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SHARE-U-4, 5, 11..14 (docs/product/SPEC-VISIBILITY-CORE.md "One Share composer", Phase 4, migration 0034): News,
// Event and Saying posts through HearthApi. Same cast as contract.test.ts: FakeApi always; SupabaseApi when the env
// is set (`bash scripts/contract-real.sh`) AND the harness can flip Hearth's global switch (else those tests skip).
// Written FIRST (Nov 24, 2026, qa-tdd): red until the Fake and SupabaseApi speak it. The server side of the same
// contract is backend/tests/post_kinds_test.sql (its header is the contract).
//
// The shape these tests fix (engineer: add to types.ts like this, then drop the casts below):
//   type PostKind = 'photos' | 'news' | 'event' | 'saying'
//   CreatePostArgs + { kind?: PostKind; event?: { what, when: 'YYYY-MM-DD', where?: string | null };
//                      saying?: { words, who, age?: number | null } }
//     -> create_post p_kind / p_details. Send p_kind only when kind isn't photos (an older server keeps working).
//     News words are `caption`.
//   FeedPost (and so TimelinePost) + { kind?: PostKind (missing = photos); event?: { what, when, where } | null;
//                                      saying?: { words, who, age } | null }
//     kind from get_feed / get_timeline / search_posts; the fields from post_events / post_sayings under RLS.
//   Errors: 23514 rule broken (no words, no when, no who, bad age, media on news); 42501 not a parent or post_kinds off.
import { ApiError, type HearthApi } from '../HearthApi';
import type { CreatePostArgs, FeedPost } from '../types';
import { uuid } from '../../crypto/random';
import { fakeHarness } from './fakeHarness';
import type { ContractHarness, HarnessFactory } from './harness';
import { supabaseEnvReady, supabaseHarness } from './supabaseHarness';

type PostKind = 'photos' | 'news' | 'event' | 'saying';
interface EventFields { what: string; when: string; where?: string | null }
interface SayingFields { words: string; who: string; age?: number | null }
interface KindArgs { kind?: PostKind; event?: EventFields; saying?: SayingFields }
interface KindRow { kind?: PostKind; event?: { what: string; when: string; where: string | null } | null;
  saying?: { words: string; who: string; age: number | null } | null }
type Row = FeedPost & KindRow;

// flip: the harness can turn Hearth's global switch on (the real-stack harness can't yet: those tests skip, honestly)
const factories: [string, HarnessFactory, { flip: boolean }][] = [['FakeApi', fakeHarness, { flip: true }]];
if (supabaseEnvReady()) factories.push(['SupabaseApi', supabaseHarness, { flip: false }]);

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof ApiError ? e.code : `non-ApiError: ${String(e)}`;
  }
}

describe.each(factories)('%s post kinds contract (SHARE-U)', (_name, factory, caps) => {
  const itOn = caps.flip ? it : it.skip;
  let h: ContractHarness;
  let parent: HearthApi;
  let inside: HearthApi;
  let outside: HearthApi;

  beforeEach(async () => {
    h = await factory();
    parent = h.as('poster');
    inside = h.as('viewerIn');
    outside = h.as('viewerOut');
  });

  /** Both switches on (Hearth's global one and the family's, set by the owner). */
  async function turnOn() {
    await h.setGlobalFeature!('post_kinds', true);
    await parent.setFamilyFeature(h.spaceId, 'post_kinds', true);
  }
  const make = (api: HearthApi, a: Partial<CreatePostArgs> & KindArgs) =>
    api.createPost({ clientId: uuid(), space: h.spaceId, caption: null, circleIds: [h.circleIn], ...a } as unknown as CreatePostArgs);
  async function published(a: Partial<CreatePostArgs> & KindArgs): Promise<string> {
    const id = await make(parent, a);
    await parent.publishPost(id);
    return id;
  }
  const feedRow = async (api: HearthApi, id: string) =>
    (await api.getFeed({ space: h.spaceId, limit: 50 })).find((p) => p.post_id === id) as Row | undefined;

  it('SHARE-U-12 off by default: my_features has no post_kinds, news is refused (42501), photos still work', async () => {
    expect(await parent.myFeatures(h.spaceId)).not.toContain('post_kinds');
    expect(await code(make(parent, { kind: 'news', caption: 'Gammy is coming for Thanksgiving!' }))).toBe('42501');
    expect(await code(make(parent, { kind: 'photos', caption: 'Pumpkin patch' }))).toBe('ok');
    expect(await code(make(parent, { caption: 'Older app build' }))).toBe('ok');
  });

  itOn('SHARE-U-12 the family switch alone is not enough: Hearth\'s global switch must be on too', async () => {
    await parent.setFamilyFeature(h.spaceId, 'post_kinds', true);
    expect(await code(make(parent, { kind: 'news', caption: 'Family switch only' }))).toBe('42501');
    await h.setGlobalFeature!('post_kinds', true);
    expect(await parent.myFeatures(h.spaceId)).toContain('post_kinds');
  });

  itOn('SHARE-U-4 news: words, no media; publishes; the group sees it as kind news, someone outside does not', async () => {
    await turnOn();
    const id = await published({ kind: 'news', caption: 'Gammy is coming for Thanksgiving!' });
    const row = await feedRow(inside, id);
    expect(row).toMatchObject({ kind: 'news', caption: 'Gammy is coming for Thanksgiving!', media: [] });
    expect(await feedRow(outside, id)).toBeUndefined();
  });

  itOn('SHARE-U-4 news without words (23514), with no audience (23514), or with media (23514) is refused', async () => {
    await turnOn();
    expect(await code(make(parent, { kind: 'news', caption: '   ' }))).toBe('23514');
    expect(await code(make(parent, { kind: 'news', caption: null }))).toBe('23514');
    expect(await code(make(parent, { kind: 'news', caption: 'Big news', circleIds: [] }))).toBe('23514');
    const draft = await make(parent, { kind: 'news', caption: 'A news draft' });
    expect(await code(parent.signUpload(draft, [{ kind: 'photo', mime_type: 'image/jpeg', width: 4, height: 3, duration_ms: null,
      byte_size: 100, thumb_byte_size: 50, exif_stripped: true }]))).toBe('23514');
  });

  itOn('SHARE-U-11 event: what, when, where; the group reads the fields, someone outside gets nothing', async () => {
    await turnOn();
    const id = await published({ kind: 'event', event: { what: 'Pawpaw\'s 80th birthday picnic', when: '2026-12-12', where: 'the church hall' } });
    expect(await feedRow(inside, id)).toMatchObject({
      kind: 'event', media: [], event: { what: 'Pawpaw\'s 80th birthday picnic', when: '2026-12-12', where: 'the church hall' },
    });
    const noWhere = await published({ kind: 'event', event: { what: 'Gammy\'s pie night', when: '2026-11-27' } });
    expect((await feedRow(inside, noWhere))?.event).toEqual({ what: 'Gammy\'s pie night', when: '2026-11-27', where: null });
    expect(await feedRow(outside, id)).toBeUndefined();
  });

  itOn('SHARE-U-11 an event without when, with a when that isn\'t a date, or without what is refused (23514)', async () => {
    await turnOn();
    expect(await code(make(parent, { kind: 'event', event: { what: 'Pie night' } as EventFields }))).toBe('23514');
    expect(await code(make(parent, { kind: 'event', event: { what: 'Pie night', when: 'soon' } }))).toBe('23514');
    expect(await code(make(parent, { kind: 'event', event: { what: '  ', when: '2026-11-27' } }))).toBe('23514');
    expect(await code(make(parent, { kind: 'event' }))).toBe('23514');
  });

  itOn('SHARE-U-13 saying: the words, who said it, their age; the group reads it, someone outside gets nothing', async () => {
    await turnOn();
    const id = await published({ kind: 'saying', saying: { words: 'Pawpaw, your hair went on vacation', who: 'Mia', age: 4 } });
    expect(await feedRow(inside, id)).toMatchObject({
      kind: 'saying', media: [], saying: { words: 'Pawpaw, your hair went on vacation', who: 'Mia', age: 4 },
    });
    const noAge = await published({ kind: 'saying', saying: { words: 'I want the crunchy water', who: 'Mia' } });
    expect((await feedRow(inside, noAge))?.saying).toEqual({ words: 'I want the crunchy water', who: 'Mia', age: null });
    expect(await feedRow(outside, id)).toBeUndefined();
  });

  itOn('SHARE-U-13 a saying without words or who, or with an age outside 0..120, is refused (23514)', async () => {
    await turnOn();
    expect(await code(make(parent, { kind: 'saying', saying: { who: 'Mia' } as SayingFields }))).toBe('23514');
    expect(await code(make(parent, { kind: 'saying', saying: { words: 'Crunchy water', who: ' ' } }))).toBe('23514');
    expect(await code(make(parent, { kind: 'saying', saying: { words: 'Crunchy water', who: 'Mia', age: -1 } }))).toBe('23514');
    expect(await code(make(parent, { kind: 'saying', saying: { words: 'Crunchy water', who: 'Mia', age: 200 } }))).toBe('23514');
  });

  itOn('SHARE-U-14 parents only: a relative never gets post_kinds and her news, event and saying are refused (42501)', async () => {
    await turnOn();
    expect(await inside.myFeatures(h.spaceId)).not.toContain('post_kinds');
    expect(await code(make(inside, { kind: 'news', caption: 'Grandma news' }))).toBe('42501');
    expect(await code(make(inside, { kind: 'event', event: { what: 'Bingo', when: '2026-12-01' } }))).toBe('42501');
    expect(await code(make(inside, { kind: 'saying', saying: { words: 'Crunchy water', who: 'Mia' } }))).toBe('42501');
  });

  itOn('SHARE-U-5 someone outside the audience gets nothing on any path: feed, timeline, search, by id, viewers', async () => {
    await turnOn();
    const ids = [
      await published({ kind: 'news', caption: 'Thanksgiving plans for the grandparents' }),
      await published({ kind: 'event', event: { what: 'Pawpaw\'s 80th birthday picnic', when: '2026-12-12' } }),
      await published({ kind: 'saying', saying: { words: 'Pawpaw, your hair went on vacation', who: 'Mia', age: 4 } }),
    ];
    // allowed: every path has them
    expect((await inside.getFeed({ space: h.spaceId, limit: 50 })).map((p) => p.post_id)).toEqual(expect.arrayContaining(ids));
    expect((await inside.getTimeline({ space: h.spaceId, limit: 50 })).map((p) => p.post_id)).toEqual(expect.arrayContaining(ids));
    expect((await inside.searchPosts({ space: h.spaceId, words: 'thanksgiving' })).map((p) => p.post_id)).toContain(ids[0]);
    expect((await inside.postViewers(ids)).map((v) => v.post_id).sort()).toEqual([...ids].sort());
    // excluded: none of them, anywhere, and a hidden one answers like a missing one
    const none = (rows: { post_id: string }[]) => rows.filter((p) => ids.includes(p.post_id));
    expect(none(await outside.getFeed({ space: h.spaceId, limit: 50 }))).toEqual([]);
    expect(none(await outside.getTimeline({ space: h.spaceId, limit: 50 }))).toEqual([]);
    expect(none(await outside.searchPosts({ space: h.spaceId, words: 'thanksgiving' }))).toEqual([]);
    expect(await outside.postViewers(ids)).toEqual([]);
    for (const id of ids) expect(await code(outside.toggleHeart(id))).toBe(await code(outside.toggleHeart(uuid())));
  });
});
