// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-44 / RD-45 (DEC-65), UX-R13 (review round 2): the months mosaic as a pure layout, so the screen only draws it.
import type { FeedPost } from '../../api/HearthApi';
import { galleryMonths, loveOf, mosaicRows } from '../gallery';

const at = (m: number, d: number, h: number) => new Date(2025, m, d, h).toISOString();
function post(id: string, when: string, photos: number, extra: Partial<FeedPost> = {}): FeedPost {
  return {
    post_id: id, author_id: 'u1', author_name: 'Chase', caption: null, published_at: when, taken_at: when,
    media: Array.from({ length: photos }, (_, i) => ({ media_id: `${id}-${i}`, position: i, kind: 'photo', status: 'ready' })) as never,
    heart_count: 0, i_hearted: false, comment_count: 0, audience: null, seen_count: null, reach_count: null, ...extra,
  };
}

describe('RD-44 months mosaic layout (pure)', () => {
  // UX-R13 (review round 2, Nov 17): one wide 3:2 photo per MONTH, not per day; days with few photos join into a
  // range ("Nov 11–15"); no lone square left in a row. Replaces the per-day wide opener (RD-44 as first built).
  it('UX-R13 RD-44 groups by month, then by day, newest first; only the month\'s first tile is wide', () => {
    const months = galleryMonths([post('a', at(9, 17, 10), 2), post('b', at(9, 17, 15), 2), post('c', at(9, 4, 11), 4), post('d', at(8, 30, 9), 1)]);
    expect(months.map((m) => m.title)).toEqual(['October 2025', 'September 2025']);
    expect(months[0]!.groups.map((g) => g.tiles.map((t) => t.mediaId))).toEqual([['b-0', 'b-1', 'a-0', 'a-1'], ['c-0', 'c-1', 'c-2', 'c-3']]);
    expect(months[0]!.tiles.map((t) => t.wide)).toEqual([true, false, false, false, false, false, false, false]);
    expect(months[1]!.tiles).toEqual([expect.objectContaining({ mediaId: 'd-0', wide: true })]);
  });

  it('UX-R13 each group carries its date label: "Oct 17" for one day', () => {
    const [m] = galleryMonths([post('b', at(9, 17, 15), 4), post('c', at(9, 4, 11), 3)]);
    expect(m!.groups.map((g) => (g as { label?: string }).label)).toEqual(['Oct 17', 'Oct 4']);
  });

  it('UX-R13 days with few photos join into a range ("Nov 11–15"); a full day stays on its own', () => {
    const [m] = galleryMonths([post('p15', at(10, 15, 9), 1), post('p13', at(10, 13, 9), 1), post('p11', at(10, 11, 9), 1), post('p3', at(10, 3, 9), 3)]);
    expect(m!.groups.map((g) => (g as { label?: string }).label)).toEqual(['Nov 11–15', 'Nov 3']);
    expect(m!.groups.map((g) => g.tiles.map((t) => t.mediaId))).toEqual([['p15-0', 'p13-0', 'p11-0'], ['p3-0', 'p3-1', 'p3-2']]);
    expect(m!.tiles.filter((t) => t.wide).map((t) => t.mediaId)).toEqual(['p15-0']);
  });

  it('UX-R13 a range never crosses a month', () => {
    const months = galleryMonths([post('n1', at(10, 1, 9), 1), post('o31', at(9, 31, 9), 1)]);
    expect(months.map((m) => [m.title, m.groups.map((g) => (g as { label?: string }).label)])).toEqual([['November 2025', ['Nov 1']], ['October 2025', ['Oct 31']]]);
  });

  it('UX-R13 RD-44 the most-loved post in the month gives the wide tile its first photo; a tie goes to the newest', () => {
    const a = post('a', at(9, 17, 10), 2, { reaction_counts: { '❤️': 1, '🎉': 1 } as never });
    const b = post('b', at(9, 17, 15), 2, { reaction_counts: { '😂': 1 } as never });
    const c = post('c', at(9, 4, 11), 3);
    const [m] = galleryMonths([b, a, c]);
    expect(m!.tiles[0]).toEqual(expect.objectContaining({ mediaId: 'a-0', wide: true }));
    expect(m!.tiles.filter((t) => t.wide)).toHaveLength(1);
    const tie = post('t', at(9, 17, 9), 1, { reaction_counts: { '😂': 1 } as never });
    const [n] = galleryMonths([b, tie]);
    expect(n!.tiles[0]!.mediaId).toBe('b-0');
  });

  it('RD-44 love counts every reaction, or hearts on an older server', () => {
    expect(loveOf({ reaction_counts: { '❤️': 2, '👍': 1 } as never, heart_count: 0 })).toBe(3);
    expect(loveOf({ heart_count: 4 })).toBe(4);
  });

  it('RD-45 every spoken label names the sender and the full date', () => {
    const [m] = galleryMonths([post('a', at(9, 4, 10), 2)]);
    expect(m!.tiles.map((t) => t.label)).toEqual(['Open photo from Chase, October 4, full screen', 'Open photo from Chase, October 4, full screen']);
  });

  it('UX-R13 rows: the wide tile alone, then squares up to three across, and never one square left alone in a row', () => {
    const t = (wide: boolean, id: string) => ({ wide, id });
    const sq = (n: number) => Array.from({ length: n }, (_, i) => t(false, String(i + 1)));
    for (const n of [2, 3, 4, 5, 6, 7, 8, 10]) {
      const rows = mosaicRows([t(true, 'w'), ...sq(n)]);
      expect(rows[0]!.map((x) => x.id)).toEqual(['w']);
      const squares = rows.slice(1);
      expect({ n, order: squares.flat().map((x) => x.id) }).toEqual({ n, order: sq(n).map((x) => x.id) });
      expect({ n, sizes: squares.map((r) => r.length).filter((k) => k < 2 || k > 3) }).toEqual({ n, sizes: [] });
    }
    // A group of squares with no wide tile (a later group in the month) follows the same rule.
    expect(mosaicRows(sq(4)).map((r) => r.length).filter((k) => k < 2)).toEqual([]);
  });

  it('RD-44 a post with no ready photos leaves no empty month or day', () => {
    const p = post('p', at(9, 4, 10), 1);
    p.media[0]!.status = 'pending' as never;
    expect(galleryMonths([p])).toEqual([]);
  });
});

// UX-R30 (review round 3, Nov 17; RD-73): a month (or a group) with exactly 2 photos is two squares side by side,
// with no wide photo and no lone square. One photo alone in a month stays wide.
describe('UX-R30 RD-73 exactly 2 photos: two squares side by side', () => {
  it('UX-R30 a month of one post with 2 photos: no wide tile; one row of the two squares', () => {
    const [m] = galleryMonths([post('a', at(9, 17, 10), 2)]);
    expect(m!.tiles.map((t) => t.wide)).toEqual([false, false]);
    expect(m!.groups.flatMap((g) => mosaicRows(g.tiles).map((r) => r.map((t) => t.mediaId)))).toEqual([['a-0', 'a-1']]);
  });

  it('UX-R30 a month of two 1-photo posts on different days: no wide tile; one range with the two squares in one row', () => {
    const [m] = galleryMonths([post('b', at(10, 15, 9), 1), post('c', at(10, 11, 9), 1)]);
    expect(m!.tiles.filter((t) => t.wide)).toEqual([]);
    expect(m!.groups.map((g) => [g.label, mosaicRows(g.tiles).map((r) => r.length)])).toEqual([['Nov 11–15', [2]]]);
  });

  it('UX-R30 one photo alone in a month stays wide; 3 photos keep one wide and two squares', () => {
    expect(galleryMonths([post('d', at(8, 30, 9), 1)])[0]!.tiles.map((t) => t.wide)).toEqual([true]);
    const [m] = galleryMonths([post('e', at(7, 3, 9), 3)]);
    expect(m!.groups.flatMap((g) => mosaicRows(g.tiles).map((r) => r.length))).toEqual([1, 2]);
  });

  it('UX-R30 no group in any month draws a lone square (2..12 photos in a month, spread over days)', () => {
    for (let n = 2; n <= 12; n++) {
      const posts = Array.from({ length: n }, (_, i) => post(`p${n}-${i}`, at(5, 28 - i * 2, 9), 1));
      const [m] = galleryMonths(posts);
      const rows = m!.groups.flatMap((g) => mosaicRows(g.tiles));
      expect({ n, lone: rows.filter((r) => r.length === 1 && !r[0]!.wide).length }).toEqual({ n, lone: 0 });
    }
  });
});
