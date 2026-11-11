// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// OPEN-1/2/5/8 (docs/product/SPEC-OPENING.md): the pure helpers behind Photos' "New for you" card.
// newForYou(posts, lastSeen, me): others' posts published after the last visit, oldest first; none on a first open.
// newSinceDay(iso, now): "Today", "Yesterday", a weekday within 6 days, else "Nov 3" (calendar days, local time).
import { newForYou, newSinceDay } from '../newForYou';

const post = (id: string, published: string, author = 'u-chase', name = 'Chase') => ({
  post_id: id, author_id: author, author_name: name, caption: null, published_at: published, taken_at: null,
  media: [{ media_id: `${id}-0`, kind: 'photo' as const, width: 1, height: 1, duration_ms: null, status: 'ready' as const }],
  heart_count: 0, i_hearted: false, comment_count: 0, audience: null, seen_count: null, reach_count: null,
});

const LAST = '2026-11-10T12:00:00.000Z';

describe('OPEN newForYou', () => {
  it("OPEN-1 counts only others' posts that arrived after the last visit; my own posts never count", () => {
    const feed = [
      post('mine', '2026-11-11T09:00:00.000Z', 'u-jo', 'Grandma Jo'),
      post('new', '2026-11-11T08:00:00.000Z'),
      post('same', LAST), // exactly at the last visit: already seen
      post('old', '2026-11-09T08:00:00.000Z'),
    ];
    expect(newForYou(feed, LAST, 'u-jo').map((p) => p.post_id)).toEqual(['new']);
  });

  it('OPEN-5 first ever open (no last visit kept on this phone): nothing is new', () => {
    expect(newForYou([post('a', '2026-11-11T08:00:00.000Z')], null, 'u-jo')).toEqual([]);
  });

  it('OPEN-8 new posts come oldest first, so the story reads in order', () => {
    const feed = [ // the feed is newest first
      post('c', '2026-11-11T10:00:00.000Z'),
      post('b', '2026-11-11T09:00:00.000Z', 'u-alex', 'Alex'),
      post('a', '2026-11-11T08:00:00.000Z'),
    ];
    expect(newForYou(feed, LAST, 'u-jo').map((p) => p.post_id)).toEqual(['a', 'b', 'c']);
  });
});

describe('OPEN-2 newSinceDay', () => {
  // Local time, like the rest of the app (Jest runs in UTC here).
  const now = new Date(2026, 10, 11, 9, 0); // Wed Nov 11 2026, 9 am
  const at = (m: number, d: number, h = 12, min = 0) => new Date(2026, m, d, h, min).toISOString();

  it('OPEN-2 Today and Yesterday go by the calendar day, not 24 hours', () => {
    expect(newSinceDay(at(10, 11, 7), now)).toBe('Today');
    expect(newSinceDay(at(10, 10, 23, 59), new Date(2026, 10, 11, 0, 5))).toBe('Yesterday');
    expect(newSinceDay(at(10, 10, 8), now)).toBe('Yesterday');
  });

  it('OPEN-2 a weekday name within 6 days, else the month and day', () => {
    expect(newSinceDay(at(10, 9), now)).toBe('Monday');
    expect(newSinceDay(at(10, 5), now)).toBe('Thursday'); // 6 days back
    expect(newSinceDay(at(10, 4), now)).toBe('Nov 4'); // 7 days back
    expect(newSinceDay(at(9, 3), now)).toBe('Oct 3');
  });
});
