// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Redesign 1c, Gallery and New for you (docs/product/SPEC-REDESIGN.md RD-18..RD-23, RD-8's New for you corners;
// DEC-59). Gallery is the photo wall itself: every photo by month in a tight square grid, newest first, with
// Show older photos. Above it, only when others sent photos since the last visit on this phone, "New for you": a
// sideways row of large photo tiles (12 pt corners), the first carrying a solid accent chip "N new" (N = photos),
// then "Tap a photo to start" and the sender line. Any tile, or the "See all" text button, opens the one-at-a-time
// walk at the oldest new post. Written first (Nov 15).
//
// What the screen must expose (the engineer's contract; everything else is found by role and words):
//   testID `gallery-grid`            the grid on Gallery; month headings are headers inside it ("November 2026")
//   testID `gallery-tile-<mediaId>`  one grid tile: a button whose spoken label names the sender and day (OPEN-10)
//   testID `new-for-you`             the New for you section (kept from OPEN-1)
//   testID `new-tile-<mediaId>`      one New for you tile: a button, inside a sideways (horizontal) scroller
// Assumption to confirm (grandparent-ux): a last visit earlier today reads "From Chase today"; other days follow
// OPEN-2's rules ("From Alex since Wednesday", "since yesterday", "since Nov 3").
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { expectGrandparentSafe, renderApp, screenWords } from '../../test/renderApp';
import { paletteFor } from '../../ui/theme';
import { GalleryScreen } from '../../test/redesignScreens';

const { dadSide, momSide, everyone } = FIXTURE.circles;
const { jo, alex, ruth } = FIXTURE.users;
const KEY = (u: string) => `hearth.lastSeen.v1.${u}`;
const HOUR = 3600e3;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const earlierToday = () => {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return new Date(Math.max(midnight.getTime(), Date.now() - HOUR)).toISOString();
};
const daysBack = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
};
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const GREETING = /^Good (morning|afternoon|evening), Grandma Jo$/;
const GROUP_NAMES = /\bgroups?\b|Grandparents –|Dad's side|Mom's side/i;
const light = () => paletteFor(Platform.OS as 'ios', false);

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const ids = (prefix: string, root?: Inst) => (root ? within(root).queryAllByTestId(new RegExp(`^${prefix}`)) : screen.queryAllByTestId(new RegExp(`^${prefix}`))).map((t) => String(t.props.testID).slice(prefix.length));
const gridTiles = () => ids('gallery-tile-', screen.getByTestId('gallery-grid'));
const newTiles = () => within(screen.getByTestId('new-for-you')).getAllByTestId(/^new-tile-/);
/** Document order of testIDs. */
const order = () => (screen.UNSAFE_root.findAll((n: Inst) => typeof n.type === 'string' && typeof n.props.testID === 'string') as Inst[]).map((n) => String(n.props.testID));
function wordsIn(root: Inst): string {
  const parts: string[] = [];
  const walk = (c: unknown) => {
    if (typeof c === 'string' || typeof c === 'number') parts.push(String(c));
    else if (Array.isArray(c)) c.forEach(walk);
  };
  for (const t of root.findAll((n: Inst) => n.type === Text)) walk(t.props.children);
  return parts.join(' ');
}
/** The largest corner radius on a tile or anything inside it (the photo may carry the clip). */
function cornerOf(tile: Inst): number {
  const all = [tile, ...tile.findAll((n: Inst) => typeof n.type === 'string')];
  return Math.max(0, ...all.map((n) => Number(flat(n.props.style).borderRadius ?? 0)));
}
function backdate(be: FakeBackend, id: string, iso: string) {
  be.state.posts[id]!.published_at = iso;
  be.state.posts[id]!.created_at = iso;
}
const mediaOf = (be: FakeBackend, postId: string) =>
  Object.values(be.state.media).filter((m) => m.post === postId).sort((a, b) => a.position - b.position).map((m) => m.id);

/** Jo visited earlier today; one post she has seen (last week), then the `fresh` ones since. */
async function joWithNew(fresh: Array<{ caption: string; photos?: number; author?: string; circles?: string[] }>) {
  const be = FakeBackend.withFixture();
  const old = await seedPost(be, { caption: 'Seen last week', circles: [dadSide.id] });
  backdate(be, old.id, ago(7 * 24 * HOUR));
  const out: string[] = [];
  for (const f of fresh) out.push((await seedPost(be, { circles: [dadSide.id], ...f })).id);
  return { be, kv: memoryKV({ [KEY(jo.id)]: earlierToday() }), old: old.id, ids: out };
}

/** A post from three months back (2 photos) and one from today (1 photo); nothing new for Jo. */
async function twoMonths() {
  const be = FakeBackend.withFixture();
  const old = await seedPost(be, { caption: 'Autumn', photos: 2 });
  const back = new Date();
  back.setMonth(back.getMonth() - 3, 15);
  back.setHours(12, 0, 0, 0);
  backdate(be, old.id, back.toISOString());
  const recent = await seedPost(be, { caption: 'Today', photos: 1 });
  return { be, old: old.id, recent: recent.id, back, kv: memoryKV({ [KEY(jo.id)]: new Date(Date.now() + HOUR).toISOString() }) };
}

describe('RD-18 Gallery is the photo grid', () => {
  // Updated Nov 17 for RD-44 (DEC-65): the months mosaic. Each day group opens on a wide 3:2 tile, then squares; 16 pt
  // corners (RD-8's square grid corners are superseded). Detailed mosaic rules: photosStyle.test.tsx.
  it('RD-18 RD-44 every photo by month ("November 2026"), newest first, in the months mosaic; no post cards on Gallery', async () => {
    const { be, old, recent, back, kv } = await twoMonths();
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    const grid = await screen.findByTestId('gallery-grid');
    await waitFor(() => expect(ids('gallery-tile-', grid).length).toBe(3));
    const now = new Date();
    const months = within(grid).getAllByRole('header').map((h) => h.props.accessibilityLabel ?? wordsIn(h));
    expect(months).toEqual([`${LONG[now.getMonth()]} ${now.getFullYear()}`, `${LONG[back.getMonth()]} ${back.getFullYear()}`]);
    expect(gridTiles()).toEqual([...mediaOf(be, recent), ...mediaOf(be, old)]); // newest first; a post's photos keep their order
    for (const t of within(grid).getAllByTestId(/^gallery-tile-/)) {
      const s = flat(t.props.style);
      expect({ wideOrSquare: [1, 1.5].includes(Number(s.aspectRatio)), corner: cornerOf(t) }).toEqual({ wideOrSquare: true, corner: 16 });
    }
    // Gallery is the grid, not the post list (that's Feed, RD-17): no post cards, no captions.
    expect(screen.queryByTestId(`post-${recent}`)).toBeNull();
    expect(screen.queryByText('Today')).toBeNull();
    expect(screen.getByRole('header', { name: GREETING })).toBeTruthy();
  });

  // Updated Nov 17 for RD-45: the spoken label carries the full date ("October 15"), the sender stays (OPEN-10).
  it('RD-18 OPEN-10 RD-45 every tile is 48 pt+, a button whose spoken label names the sender and full date, and opens that photo full screen', async () => {
    const { be, old, back, kv } = await twoMonths();
    const { nav } = await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    const grid = await screen.findByTestId('gallery-grid');
    await waitFor(() => expect(ids('gallery-tile-', grid).length).toBe(3));
    for (const t of within(grid).getAllByTestId(/^gallery-tile-/)) {
      const s = flat(t.props.style);
      expect(Number(s.minHeight ?? s.height ?? 0)).toBeGreaterThanOrEqual(48);
      expect(Number(s.minWidth ?? s.width ?? 0) || 48).toBeGreaterThanOrEqual(48);
      expect(t.props.accessibilityRole).toBe('button');
      expect(t.props.accessibilityLabel).toMatch(/Chase/);
    }
    const second = within(grid).getByTestId(`gallery-tile-${mediaOf(be, old)[1]}`);
    expect(second.props.accessibilityLabel).toMatch(new RegExp(`\\b${LONG[back.getMonth()]} ${back.getDate()}\\b`));
    fireEvent.press(second);
    expect(nav.openViewer).toHaveBeenLastCalledWith(old, 1);
    expectGrandparentSafe();
  });

  it('RD-18 Show older photos adds the next page to the grid, and goes away when there is nothing older', async () => {
    const be = FakeBackend.withFixture();
    for (let i = 0; i < 21; i++) await seedPost(be, { caption: `Day ${i}` }); // one more than a page
    await renderApp(<GalleryScreen />, { be, user: 'jo' });
    const grid = await screen.findByTestId('gallery-grid');
    await waitFor(() => expect(ids('gallery-tile-', grid).length).toBe(20));
    fireEvent.press(screen.getByRole('button', { name: 'Show older photos' }));
    await waitFor(() => expect(gridTiles().length).toBe(21));
    await waitFor(() => expect(screen.queryAllByRole('button', { name: 'Show older photos' }).length).toBe(0));
  });

  it('RD-18 the separate "All photos" button and the "Sent by …" line under the greeting are gone', async () => {
    const { be, kv } = await twoMonths();
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    await screen.findByTestId('gallery-grid');
    expect(screen.queryByRole('button', { name: 'See all the photos, three to a row' })).toBeNull();
    expect(screen.queryByText('All photos')).toBeNull();
    expect(screen.queryByText(/^Sent by /)).toBeNull();
  });

  it('RD-18 privacy both ways: Jo\'s grid has no Mom\'s side photo; Nana Ruth\'s grid has it', async () => {
    const be = FakeBackend.withFixture();
    const dad = await seedPost(be, { caption: "Dad's side", circles: [dadSide.id] });
    const mom = await seedPost(be, { caption: "Mom's side", author: alex.id, circles: [momSide.id] });
    const r = await renderApp(<GalleryScreen />, { be, user: 'jo' });
    const grid = await screen.findByTestId('gallery-grid');
    await waitFor(() => expect(ids('gallery-tile-', grid)).toEqual(mediaOf(be, dad.id)));
    r.unmount();
    await renderApp(<GalleryScreen />, { be, user: 'ruth' });
    await screen.findByTestId('gallery-grid');
    await waitFor(() => expect(gridTiles()).toEqual(expect.arrayContaining(mediaOf(be, mom.id))));
    // T18 (QA-R3): Ruth's grid is exactly the Mom's side photos; no Dad's side tile leaks in.
    expect(gridTiles()).toEqual(mediaOf(be, mom.id));
    for (const m of mediaOf(be, dad.id)) expect(gridTiles()).not.toContain(m);
  });
});

describe('RD-19 New for you: a sideways row of large photos', () => {
  it('RD-19 above the grid, "New for you" holds a sideways row of large tiles, one per new photo, oldest post first', async () => {
    const { be, kv, ids: fresh, old } = await joWithNew([{ caption: 'Three', photos: 3 }, { caption: 'Two more', photos: 2 }]);
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    const section = await screen.findByTestId('new-for-you');
    expect(within(section).getByRole('header', { name: 'New for you' })).toBeTruthy();
    const o = order();
    expect(o.indexOf('new-for-you')).toBeLessThan(o.indexOf('gallery-grid'));
    expect(ids('new-tile-', section)).toEqual([...mediaOf(be, fresh[0]!), ...mediaOf(be, fresh[1]!)]);
    expect(ids('new-tile-', section)).not.toContain(mediaOf(be, old)[0]); // seen before: grid only
    await waitFor(() => expect(gridTiles()).toContain(mediaOf(be, old)[0]));
    // Sideways: the tiles sit in a horizontal scroller.
    const tile = newTiles()[0]!;
    let n: Inst | null = tile.parent;
    while (n && !n.props.horizontal) n = n.parent;
    expect(n?.props.horizontal).toBe(true);
    // Large: each tile is a big button (well past the 48 pt floor), and it says whose photo it is.
    for (const t of newTiles()) {
      const s = flat(t.props.style);
      expect(t.props.accessibilityRole).toBe('button');
      expect(Number(s.width ?? s.minWidth ?? 0)).toBeGreaterThanOrEqual(120);
      expect(Number(s.height ?? s.minHeight ?? 0)).toBeGreaterThanOrEqual(120);
      expect(t.props.accessibilityLabel).toMatch(/Chase/);
    }
  });

  it('RD-19 the first tile carries a solid accent chip "N new", where N counts photos, not posts', async () => {
    const { be, kv } = await joWithNew([{ caption: 'Three', photos: 3 }, { caption: 'Two more', photos: 2 }]);
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    await screen.findByTestId('new-for-you');
    const [first, ...rest] = newTiles();
    const chip = within(first!).getByText('5 new'); // 5 photos in 2 posts
    expect(within(screen.getByTestId('new-for-you')).queryByText('2 new')).toBeNull();
    for (const t of rest) expect(within(t).queryByText(/\d+ new$/)).toBeNull(); // only the first tile
    // Solid: the chip (or the box right around its words) is filled with the accent, words in accent ink.
    let box: Inst | null = chip;
    while (box && box !== first && !flat(box.props.style).backgroundColor) box = box.parent;
    expect(flat(box!.props.style).backgroundColor).toBe(light().accent);
    expect(flat(chip.props.style).color).toBe(light().accentInk);
    expect(Number(flat(chip.props.style).fontSize)).toBeAtLeast17();
  });

  it('RD-19 one new post with one photo reads "1 new"', async () => {
    const { be, kv } = await joWithNew([{ caption: 'Pumpkin patch' }]);
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    await screen.findByTestId('new-for-you');
    expect(within(newTiles()[0]!).getByText('1 new')).toBeTruthy();
  });

  it('RD-19 OPEN-1 my own new posts never make the section; someone else\'s do (Alex\'s post on Chase\'s phone)', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Mine', circles: [dadSide.id] });
    const r = await renderApp(<GalleryScreen />, { be, kv: memoryKV({ [KEY(FIXTURE.users.chase.id)]: ago(HOUR) }), user: 'chase' });
    await screen.findByTestId('gallery-grid');
    await waitFor(() => expect(gridTiles().length).toBe(1));
    expect(screen.queryByTestId('new-for-you')).toBeNull();
    r.unmount();
    await seedPost(be, { author: alex.id, caption: 'From Alex', circles: [momSide.id] });
    await renderApp(<GalleryScreen />, { be, kv: memoryKV({ [KEY(FIXTURE.users.chase.id)]: ago(HOUR) }), user: 'chase' });
    expect(within(await screen.findByTestId('new-for-you')).getByText(/^From Alex\b/)).toBeTruthy();
  });

  // Updated Nov 17 for RD-44: the months mosaic's tiles have 16 pt corners (were square).
  it('RD-8 RD-44 New for you photos have 12 pt corners; the months mosaic tiles have 16', async () => {
    const { be, kv } = await joWithNew([{ caption: 'Two', photos: 2 }]);
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    await screen.findByTestId('new-for-you');
    for (const t of newTiles()) expect(cornerOf(t)).toBe(12);
    await waitFor(() => expect(gridTiles().length).toBeGreaterThan(0));
    for (const t of within(screen.getByTestId('gallery-grid')).getAllByTestId(/^gallery-tile-/)) expect(cornerOf(t)).toBe(16);
  });
});

describe('RD-20 the words under New for you', () => {
  // Chase, Nov 16 (DEC-61): "get rid of the tap a photo to start ... that is messy." Only the sender line stays;
  // See all and the tappable tiles stay the way in (DS-4).
  it('RD-20 only the sender line, no "Tap a photo to start": today, "From Chase and Alex today" (oldest sender first)', async () => {
    const { be, kv } = await joWithNew([{ caption: 'One' }, { caption: 'Two', author: alex.id, circles: [everyone.id] }]);
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    const section = await screen.findByTestId('new-for-you');
    expect(within(section).getByText('From Chase and Alex today')).toBeTruthy();
    expect(within(section).queryByText(/tap a photo/i)).toBeNull();
    expect(within(section).getByRole('button', { name: /^See all(?! the photos)/ })).toBeTruthy(); // still a way in
    expect(wordsIn(section)).not.toMatch(/Sent (today|since)|unread|badge/i); // the old line and no "unread"
    const o = order();
    expect(o.indexOf('new-tile-' + ids('new-tile-', section)[0])).toBeGreaterThan(o.indexOf('new-for-you'));
  });

  it('RD-20 OPEN-2 day rules: "since yesterday", a weekday within 6 days, else month and day', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Fresh' });
    const cases: Array<[Date, string]> = [
      [daysBack(1), 'From Chase since yesterday'],
      [daysBack(3), `From Chase since ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][daysBack(3).getDay()]}`],
      [daysBack(10), `From Chase since ${SHORT[daysBack(10).getMonth()]} ${daysBack(10).getDate()}`],
    ];
    for (const [since, line] of cases) {
      const r = await renderApp(<GalleryScreen />, { be, kv: memoryKV({ [KEY(jo.id)]: since.toISOString() }), user: 'jo' });
      expect({ line, found: !!within(await screen.findByTestId('new-for-you')).queryByText(line) }).toEqual({ line, found: true });
      r.unmount();
    }
  });
});

describe('RD-21 opening the walk', () => {
  const WALK_FIRST = /^New photos: 1 of 2$/;

  it('RD-21 tapping any tile (here the last) opens the one-at-a-time walk at the oldest new post', async () => {
    const { be, kv } = await joWithNew([{ caption: 'First at the park' }, { caption: 'Then the cake', photos: 2 }]);
    const { nav } = await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    await screen.findByTestId('new-for-you');
    const tiles = newTiles();
    expect(tiles).toHaveLength(3);
    fireEvent.press(tiles[2]!);
    const walk = await screen.findByTestId('new-one-at-a-time');
    expect(within(walk).getByRole('header', { name: WALK_FIRST })).toBeTruthy();
    expect(within(walk).getByText('First at the park')).toBeTruthy();
    expect(nav.openViewer).not.toHaveBeenCalled(); // the walk, not a lone photo
  });

  it('RD-21 a "See all" text button (no swipe needed, DS-4) opens the same walk; Done returns to Gallery', async () => {
    const { be, kv } = await joWithNew([{ caption: 'First at the park' }, { caption: 'Then the cake' }]);
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    const section = await screen.findByTestId('new-for-you');
    const seeAll = within(section).getByRole('button', { name: /^See all(?! the photos)/ });
    expect(within(seeAll).getByText('See all')).toBeTruthy();
    expect(flat(seeAll.props.style).backgroundColor ?? 'transparent').toMatch(/^(transparent|rgba\(0, ?0, ?0, ?0\))$/); // a text button (RD-7)
    expect(Number(flat(seeAll.props.style).minHeight)).toBeGreaterThanOrEqual(48);
    fireEvent.press(seeAll);
    const walk = await screen.findByTestId('new-one-at-a-time');
    expect(within(walk).getByRole('header', { name: WALK_FIRST })).toBeTruthy();
    expect(within(walk).getByText('First at the park')).toBeTruthy();
    fireEvent.press(within(walk).getByRole('button', { name: 'Next new photo' }));
    fireEvent.press(await screen.findByRole('button', { name: /^Done/ }));
    expect(await screen.findByTestId('gallery-grid')).toBeTruthy();
    expect(screen.getByRole('header', { name: GREETING })).toBeTruthy();
    expect(screen.queryByTestId('new-one-at-a-time')).toBeNull();
  });

  it('RD-21 the old "See the new photos" capsule is gone', async () => {
    const { be, kv } = await joWithNew([{ caption: 'Pumpkin patch' }]);
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    await screen.findByTestId('new-for-you');
    expect(screen.queryByRole('button', { name: 'See the new photos' })).toBeNull();
    expect(screen.queryByText('See the new photos')).toBeNull();
    expectGrandparentSafe();
  });

  it('RD-21 OPEN-12 a new post with no ready photo yet: no tiles, but the words and See all stay', async () => {
    const { be, kv, ids: fresh } = await joWithNew([{ caption: 'Still on its way' }]);
    for (const m of mediaOf(be, fresh[0]!)) be.state.media[m]!.status = 'pending';
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    const section = await screen.findByTestId('new-for-you');
    expect(within(section).queryAllByTestId(/^new-tile-/)).toHaveLength(0);
    expect(within(section).getByText('From Chase today')).toBeTruthy();
    fireEvent.press(within(section).getByRole('button', { name: /^See all(?! the photos)/ }));
    expect(within(await screen.findByTestId('new-one-at-a-time')).getByText('Still on its way')).toBeTruthy();
  });
});

describe('RD-22 nothing new', () => {
  it('RD-22 nothing since the last visit: no New for you; Gallery opens on the greeting and the grid', async () => {
    const be = FakeBackend.withFixture();
    const p = await seedPost(be, { caption: 'Already seen' });
    backdate(be, p.id, ago(2 * HOUR));
    await renderApp(<GalleryScreen />, { be, kv: memoryKV({ [KEY(jo.id)]: ago(HOUR) }), user: 'jo' });
    await screen.findByTestId('gallery-grid');
    await waitFor(() => expect(gridTiles()).toEqual(mediaOf(be, p.id)));
    expect(screen.queryByTestId('new-for-you')).toBeNull();
    expect(screen.queryByText('Tap a photo to start')).toBeNull();
    expect(screen.queryByRole('button', { name: /^See all(?! the photos)/ })).toBeNull();
    expect(screen.getByRole('header', { name: GREETING })).toBeTruthy();
  });

  it('RD-22 first ever open on this phone: no New for you, just the greeting and the grid', async () => {
    const be = FakeBackend.withFixture();
    const p = await seedPost(be, { caption: 'Before Jo ever opened it', author: alex.id, circles: [everyone.id] });
    await renderApp(<GalleryScreen />, { be, kv: memoryKV(), user: 'jo' });
    await screen.findByTestId('gallery-grid');
    await waitFor(() => expect(gridTiles()).toEqual(mediaOf(be, p.id)));
    expect(screen.queryByTestId('new-for-you')).toBeNull();
    expect(screen.getByRole('header', { name: GREETING })).toBeTruthy();
  });
});

describe('RD-23 no group names', () => {
  it('RD-23 none on Gallery, New for you or the walk (Jo, a member)', async () => {
    const { be, kv } = await joWithNew([{ caption: 'Park' }, { caption: 'Cake', circles: [everyone.id] }]);
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    const section = await screen.findByTestId('new-for-you');
    await waitFor(() => expect(gridTiles().length).toBeGreaterThan(0));
    const spoken = () => screen.UNSAFE_root.findAll((n: Inst) => typeof n.type === 'string' && typeof n.props.accessibilityLabel === 'string').map((n) => String(n.props.accessibilityLabel)).join(' ');
    expect(screenWords()).not.toMatch(GROUP_NAMES);
    expect(spoken()).not.toMatch(GROUP_NAMES); // tile labels too
    expectGrandparentSafe();
    fireEvent.press(within(section).getByRole('button', { name: /^See all(?! the photos)/ }));
    await screen.findByTestId('new-one-at-a-time');
    expect(screenWords()).not.toMatch(GROUP_NAMES);
    expect(spoken()).not.toMatch(GROUP_NAMES);
  });

  it('RD-23 none for Nana Ruth either, whose new photo was shared with Mom\'s side', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Lake', author: alex.id, circles: [momSide.id] });
    await renderApp(<GalleryScreen />, { be, kv: memoryKV({ [KEY(ruth.id)]: ago(HOUR) }), user: 'ruth' });
    await screen.findByTestId('new-for-you');
    await waitFor(() => expect(gridTiles().length).toBeGreaterThan(0));
    expect(screenWords()).not.toMatch(GROUP_NAMES);
  });
});
