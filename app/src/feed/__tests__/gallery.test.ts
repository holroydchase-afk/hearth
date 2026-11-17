// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-44 / RD-45 (DEC-65): the months mosaic as a pure layout, so the screen only draws it.
import type { FeedPost } from '../../api/HearthApi';
import { dayTiles, galleryMonths, loveOf, mosaicRows } from '../gallery';

const at = (m: number, d: number, h: number) => new Date(2025, m, d, h).toISOString();
function post(id: string, when: string, photos: number, extra: Partial<FeedPost> = {}): FeedPost {
  return {
    post_id: id, author_id: 'u1', author_name: 'Chase', caption: null, published_at: when, taken_at: when,
    media: Array.from({ length: photos }, (_, i) => ({ media_id: `${id}-${i}`, position: i, kind: 'photo', status: 'ready' })) as never,
    heart_count: 0, i_hearted: false, comment_count: 0, audience: null, seen_count: null, reach_count: null, ...extra,
  };
}

describe('RD-44 months mosaic layout (pure)', () => {
  it('RD-44 groups by month, then by day, newest first; each day opens on one wide tile', () => {
    const months = galleryMonths([post('a', at(9, 17, 10), 2), post('b', at(9, 17, 15), 2), post('c', at(9, 4, 11), 3), post('d', at(8, 30, 9), 1)]);
    expect(months.map((m) => m.title)).toEqual(['October 2025', 'September 2025']);
    expect(months[0]!.groups.map((g) => g.tiles.map((t) => t.mediaId))).toEqual([['b-0', 'b-1', 'a-0', 'a-1'], ['c-0', 'c-1', 'c-2']]);
    expect(months[0]!.tiles.map((t) => t.wide)).toEqual([true, false, false, false, true, false, false]);
    expect(months[0]!.groups.map((g) => g.tiles[0]!.day)).toEqual(['17', '4']);
    expect(months[0]!.tiles.filter((t) => !t.wide).every((t) => t.day === null)).toBe(true);
    expect(months[1]!.tiles).toEqual([expect.objectContaining({ mediaId: 'd-0', wide: true, day: '30' })]);
  });

  it('RD-44 the most-loved post gives the wide tile its first photo; a tie goes to the newest', () => {
    const a = post('a', at(9, 17, 10), 2, { reaction_counts: { '❤️': 1, '🎉': 1 } as never });
    const b = post('b', at(9, 17, 15), 2, { reaction_counts: { '😂': 1 } as never });
    expect(dayTiles([b, a], new Date(at(9, 17, 15))).map((t) => t.mediaId)).toEqual(['a-0', 'b-0', 'b-1', 'a-1']);
    const tie = post('t', at(9, 17, 9), 1, { reaction_counts: { '😂': 1 } as never });
    expect(dayTiles([b, tie], new Date(at(9, 17, 15)))[0]!.mediaId).toBe('b-0');
  });

  it('RD-44 love counts every reaction, or hearts on an older server', () => {
    expect(loveOf({ reaction_counts: { '❤️': 2, '👍': 1 } as never, heart_count: 0 })).toBe(3);
    expect(loveOf({ heart_count: 4 })).toBe(4);
  });

  it('RD-45 every spoken label names the sender and the full date', () => {
    const [m] = galleryMonths([post('a', at(9, 4, 10), 2)]);
    expect(m!.tiles.map((t) => t.label)).toEqual(['Open photo from Chase, October 4, full screen', 'Open photo from Chase, October 4, full screen']);
  });

  it('RD-44 rows: the wide tile alone, then squares three across, the last row may be short', () => {
    const t = (wide: boolean, id: string) => ({ wide, id });
    const rows = mosaicRows([t(true, 'w'), t(false, '1'), t(false, '2'), t(false, '3'), t(false, '4'), t(true, 'w2'), t(false, '5')]);
    expect(rows.map((r) => r.map((x) => x.id))).toEqual([['w'], ['1', '2', '3'], ['4'], ['w2'], ['5']]);
  });

  it('RD-44 a post with no ready photos leaves no empty month or day', () => {
    const p = post('p', at(9, 4, 10), 1);
    p.media[0]!.status = 'pending' as never;
    expect(galleryMonths([p])).toEqual([]);
  });
});
