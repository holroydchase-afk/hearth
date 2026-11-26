// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Chase's picks, Nov 17 (DEC-65; SPEC-REDESIGN RD-44..RD-55): Gallery as Apple Photos' months mosaic, a "Search photos"
// field under the greeting, and Feed posts in Instagram's order. Written first (red), Nov 17.
// Mockup: the "Gallery and Feed, the Apple Photos way" page, sections 1 to 3 (round 2).
//
// The engineer's contract (everything else is found by role, label and words):
//   - Gallery keeps testIDs `gallery-scroll`, `gallery-grid` and `gallery-tile-<mediaId>` (one per photo, a button).
//     Tiles appear in reading order: per month, per day group, the wide first tile then the squares.
//   - The search field is anything with the spoken name "Search photos" (a TextInput, or a button drawn as a field).
//   - The description is one Text: the name in a nested Medium Text, then the words in their own nested Text.
//   - PostCard keeps testIDs `post-<id>`, `card-head-<id>`, `collage-<id>`, `actions-<id>`, `when-<id>`, `who-<id>`,
//     `reply-<id>` and the menu sheet `more-<id>`.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { Platform, StyleSheet, Text, TextInput } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { FeedScreen, GalleryScreen } from '../../test/redesignScreens';
import { expectGrandparentSafe, renderApp } from '../../test/renderApp';
import { Txt } from '../../ui/kit';
import { paletteFor, type Colors } from '../../ui/theme';
import { MediaImage } from '../MediaImage';

const { dadSide } = FIXTURE.circles;
const { jo, chase, earl, alex } = FIXTURE.users;
const KEY = (u: string) => `hearth.lastSeen.v1.${u}`;
const HOUR = 3600e3;
const GREETING = /^Good (morning|afternoon|evening), Grandma Jo$/;
const slow = { timeout: 4000 };
const light = (): Colors => paletteFor(Platform.OS as 'ios', false);

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
/** FONT-3 (DEC-78, qa-tdd Nov 21): the weight is carried by the Atkinson family (Android can't synthesize it), so
 *  read it from the family name; a Text with no Atkinson family reports that instead of a weight. */
const famWeight = (s: Record<string, unknown>) => /^AtkinsonHyperlegibleNext_(\d00)/.exec(String(s.fontFamily ?? ''))?.[1] ?? `no Atkinson family (fontWeight ${String(s.fontWeight ?? 'none')})`;
const isHost = (n: Inst) => typeof n.type === 'string';
const hostOrder = (root: Inst = screen.UNSAFE_root as unknown as Inst) => root.findAll(isHost) as Inst[];
function textOf(n: Inst): string {
  const parts: string[] = [];
  const walk = (c: unknown) => {
    if (typeof c === 'string' || typeof c === 'number') parts.push(String(c));
    else if (Array.isArray(c)) c.forEach(walk);
    else if (c && typeof c === 'object' && 'props' in (c as object)) walk((c as { props: { children?: unknown } }).props.children);
  };
  walk(n.props.children);
  return parts.join('');
}
/** Every visible word inside a node, Text by Text, joined by spaces. */
function wordsIn(root: Inst): string {
  const parts: string[] = [];
  const walk = (c: unknown) => {
    if (typeof c === 'string' || typeof c === 'number') parts.push(String(c));
    else if (Array.isArray(c)) c.forEach(walk);
  };
  for (const t of root.findAll((n: Inst) => n.type === Text)) walk(t.props.children);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
/** The largest corner radius on a tile or anything inside it (the photo may carry the clip). */
function cornerOf(tile: Inst): number {
  const all = [tile, ...tile.findAll(isHost)];
  return Math.max(0, ...all.map((n) => Number(flat(n.props.style).borderRadius ?? 0)));
}
function isDivider(n: Inst, c: Colors): boolean {
  const s = flat(n.props.style);
  const edge = (w: unknown, col: unknown) => Number(w ?? 0) > 0 && Number(w) <= 1 && col === c.line;
  return edge(s.borderBottomWidth, s.borderBottomColor ?? s.borderColor) || edge(s.borderTopWidth, s.borderTopColor ?? s.borderColor)
    || (s.backgroundColor === c.line && Number(s.height ?? 99) <= 1);
}
const opaque = (col: unknown) => typeof col === 'string' && !/^transparent$/i.test(col)
  && !/^rgba\([^)]*,\s*(0?\.\d+|0)\s*\)$/i.test(col) && !/^#[0-9a-f]{6}[0-9a-e][0-9a-f]$/i.test(col);
const mediaOf = (be: FakeBackend, postId: string) =>
  Object.values(be.state.media).filter((m) => m.post === postId).sort((a, b) => a.position - b.position).map((m) => m.id);
const tileIds = () => within(screen.getByTestId('gallery-grid')).getAllByTestId(/^gallery-tile-/);
const idOf = (t: Inst) => String(t.props.testID).slice('gallery-tile-'.length);

/** Oct 2025: two posts on the 17th (2 photos each; B is the later one), one on the 4th (4 photos). Nothing new for Jo. */
async function october() {
  const be = FakeBackend.withFixture();
  const at = (d: number, h: number) => new Date(2025, 9, d, h, 0, 0).toISOString();
  const a = await seedPost(be, { caption: 'Pumpkin patch', photos: 2, takenAt: at(17, 10) });
  const b = await seedPost(be, { caption: 'Hay ride', photos: 2, takenAt: at(17, 15) });
  const c = await seedPost(be, { caption: 'Apple picking', photos: 4, takenAt: at(4, 11) });
  return { be, a: a.id, b: b.id, c: c.id, kv: memoryKV({ [KEY(jo.id)]: new Date(Date.now() + HOUR).toISOString() }) };
}
async function gallery(be: FakeBackend, kv = memoryKV({ [KEY(jo.id)]: new Date(Date.now() + HOUR).toISOString() })) {
  const r = await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
  await screen.findByRole('header', { name: GREETING }, slow);
  await waitFor(() => expect(tileIds().length).toBeGreaterThan(0), slow);
  return r;
}

// =================================================================================================================
describe('RD-44 Gallery is a months mosaic, like the newest Apple Photos', () => {
  it('UX-R13 RD-44 one wide (3:2) tile per month, then squares, newest first', async () => {
    const { be, a, b, c, kv } = await october();
    await gallery(be, kv);
    await waitFor(() => expect(tileIds().length).toBe(8));
    const tiles = tileIds();
    expect(tiles.map(idOf)).toEqual([...mediaOf(be, b), ...mediaOf(be, a), ...mediaOf(be, c)]);
    // UX-R13 (review round 2): only the month opens on a wide photo; both day groups (Oct 17, Oct 4) are squares after it.
    expect(tiles.map((t) => Number(flat(t.props.style).aspectRatio))).toEqual([1.5, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('RD-44 the wide tile is the most-loved photo of its group, else the newest', async () => {
    const { be, a, b, kv } = await october();
    await be.clientFor(chase.id).setReaction(a, '❤️');
    await be.clientFor(earl.id).setReaction(a, '🎉');
    await gallery(be, kv);
    await waitFor(() => expect(tileIds().length).toBe(8));
    const tiles = tileIds();
    expect(idOf(tiles[0]!)).toBe(mediaOf(be, a)[0]); // A was loved twice, B never
    expect(Number(flat(tiles[0]!.props.style).aspectRatio)).toBe(1.5);
    expect(tiles.slice(1, 4).map(idOf).sort()).toEqual([...mediaOf(be, b), mediaOf(be, a)[1]!].sort());
  });

  // qa-tdd, Nov 24 (TYPE-6, DEC-84): the month name is title2, 22 pt in Standard; Jo (a viewer) has Easy view on by
  // default, so 26 here.
  it('RD-44 TYPE-6 the month title is its own header ("October 2025"), Semibold title2 (Jo\'s Easy view: 26 pt), never Bold', async () => {
    const { be, kv } = await october();
    await gallery(be, kv);
    const grid = screen.getByTestId('gallery-grid');
    const month = within(grid).getByRole('header', { name: 'October 2025' });
    const words = month.findAll((n: Inst) => n.type === Text && textOf(n) === 'October 2025')[0] ?? month;
    const s = flat(words.props.style);
    expect({ weight: famWeight(s), size: s.fontSize }).toEqual({ weight: '600', size: 26 });
  });

  it('RD-44 every tile has 16 pt corners, 8 pt gaps and sits inside the 16 pt margins (not edge to edge)', async () => {
    const { be, kv } = await october();
    await gallery(be, kv);
    await waitFor(() => expect(tileIds().length).toBe(8));
    const grid = screen.getByTestId('gallery-grid');
    for (const t of tileIds()) expect({ tile: idOf(t), corner: cornerOf(t) }).toEqual({ tile: idOf(t), corner: 16 });
    // The squares sit in rows that space them 8 pt apart (gap, or columnGap and rowGap).
    const square = tileIds()[1]!;
    let gap = 0;
    for (let n: Inst | null = square.parent; n && gap === 0; n = n.parent) {
      if (isHost(n)) { const st = flat(n.props.style); gap = Number(st.columnGap ?? st.gap ?? 0); }
    }
    expect(gap).toBe(8);
    // UX-R7's negative side margins are gone: nothing in the grid steps outside the screen's 16 pt padding.
    // engineer, flagged for qa-tdd: RD-83's month title backing spans the full width on purpose (pinnedBlock.test),
    // so the month headers are left out; the photos and rows still stay inside.
    const negative = [grid, ...grid.findAll(isHost)].filter((n) => n.props.accessibilityRole !== 'header').map((n) => flat(n.props.style))
      .filter((s) => [s.marginHorizontal, s.marginLeft, s.marginRight, s.marginStart, s.marginEnd].some((m) => Number(m ?? 0) < 0));
    expect(negative).toEqual([]);
  });

  it('RD-44 tiles stay 48 pt+ buttons, and each opens that photo full screen', async () => {
    const { be, a, kv } = await october();
    const { nav } = await gallery(be, kv);
    await waitFor(() => expect(tileIds().length).toBe(8));
    const t = within(screen.getByTestId('gallery-grid')).getByTestId(`gallery-tile-${mediaOf(be, a)[1]}`);
    expect(t.props.accessibilityRole).toBe('button');
    fireEvent.press(t);
    expect(nav.openViewer).toHaveBeenLastCalledWith(a, 1);
    expectGrandparentSafe();
  });
});

// =================================================================================================================
describe('RD-45 the day number sits on each group\'s first photo', () => {
  // UX-R13 (review round 2) replaces the day number on each day's wide tile: one wide tile per month, and each group
  // (a day, or a range of quiet days) shows its date once ("Oct 17"). Where it sits is the engineer's call.
  it('UX-R13 RD-45 each group\'s date shows once in the grid, in order: "Oct 17", then "Oct 4"', async () => {
    const { be, kv } = await october();
    await gallery(be, kv);
    await waitFor(() => expect(tileIds().length).toBe(8));
    const words = wordsIn(screen.getByTestId('gallery-grid'));
    expect(words.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}(–\d{1,2})?\b/g)).toEqual(['Oct 17', 'Oct 4']);
  });

  it('RD-45 every tile\'s spoken label carries the full date ("October 17", "October 4")', async () => {
    const { be, a, c, kv } = await october();
    await gallery(be, kv);
    await waitFor(() => expect(tileIds().length).toBe(8));
    const grid = screen.getByTestId('gallery-grid');
    for (const m of mediaOf(be, a)) expect(within(grid).getByTestId(`gallery-tile-${m}`).props.accessibilityLabel).toMatch(/\bOctober 17\b/);
    for (const m of mediaOf(be, c)) expect(within(grid).getByTestId(`gallery-tile-${m}`).props.accessibilityLabel).toMatch(/\bOctober 4\b/);
  });
});

// =================================================================================================================
describe('RD-46 no sender lines on the months; New for you stays on top', () => {
  it('RD-46 the months show only month names and day numbers: no "From …" line, no sender names', async () => {
    const { be, kv } = await october();
    await gallery(be, kv);
    await waitFor(() => expect(tileIds().length).toBe(8));
    const words = wordsIn(screen.getByTestId('gallery-grid'));
    expect(words).not.toMatch(/\bFrom\b|Chase|Alex|Grandma|Grandpa|Nana/);
    // UX-R13: month names, and each group's date ("Oct 17", "Nov 11–15").
    expect(words.replace(/October 2025/g, '').replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, '').replace(/\b\d{1,2}\b|–/g, '').trim()).toBe('');
  });

  it('RD-46 with something new, New for you sits above the months (and under the search field)', async () => {
    const be = FakeBackend.withFixture();
    const old = await seedPost(be, { caption: 'Seen last week', circles: [dadSide.id] });
    be.state.posts[old.id]!.published_at = new Date(Date.now() - 7 * 24 * HOUR).toISOString();
    be.state.posts[old.id]!.created_at = be.state.posts[old.id]!.published_at!;
    await seedPost(be, { caption: 'Just in', circles: [dadSide.id] });
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const kv = memoryKV({ [KEY(jo.id)]: new Date(Math.max(midnight.getTime(), Date.now() - HOUR)).toISOString() });
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    const nfy = await screen.findByTestId('new-for-you', {}, slow);
    const order = hostOrder();
    const at = (n: Inst) => order.indexOf(n);
    const search = screen.getAllByLabelText('Search photos').find(isHost)!;
    expect(at(search)).toBeGreaterThan(-1);
    expect(at(search)).toBeLessThan(at(nfy));
    expect(at(nfy)).toBeLessThan(at(screen.getByTestId('gallery-grid')));
  });
});

// =================================================================================================================
describe('RD-47 a "Search photos" field under the greeting; no top-right buttons; no Months | All photos switch', () => {
  it('RD-47 the field sits under the greeting and above the months', async () => {
    const { be, kv } = await october();
    await gallery(be, kv);
    const order = hostOrder();
    const greeting = screen.getByRole('header', { name: GREETING });
    const field = screen.getAllByLabelText('Search photos').find(isHost);
    expect(field).toBeTruthy();
    expect(order.indexOf(greeting)).toBeLessThan(order.indexOf(field!));
    expect(order.indexOf(field!)).toBeLessThan(order.indexOf(screen.getByTestId('gallery-grid')));
    expect(wordsIn(screen.UNSAFE_root as unknown as Inst)).toMatch(/Search photos/); // the field shows its words
  });

  it('RD-47 tapping the field opens today\'s Search; Back returns to Gallery', async () => {
    const { be, kv } = await october();
    await gallery(be, kv);
    const field = screen.getAllByLabelText('Search photos').find(isHost)!;
    if ((field.type as unknown) === 'TextInput' || (field.type as unknown) === TextInput) fireEvent(field, 'focus');
    else fireEvent.press(field);
    expect(await screen.findByRole('header', { name: 'Search photos' })).toBeTruthy();
    expect(screen.getByLabelText('Words to look for')).toBeTruthy(); // SEARCH-UI-1's own screen
    fireEvent.press(screen.getByRole('button', { name: /^Back/ }));
    expect(await screen.findByRole('header', { name: GREETING })).toBeTruthy();
  });

  it('RD-47 the top-right Search and By date buttons are gone, and so is any Months | All photos switch', async () => {
    const { be, kv } = await october();
    await gallery(be, kv);
    expect(screen.queryByRole('button', { name: 'Search the photos' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show photos by the date they were taken' })).toBeNull();
    expect(screen.queryByText('By date')).toBeNull();
    const bar = screen.queryByTestId('top-bar');
    if (bar) expect(within(bar).queryAllByRole('button')).toHaveLength(0);
    // Hidden for now (Chase, Nov 17): no switch, no tab, no "All photos" words.
    expect(screen.queryByText('Months')).toBeNull();
    expect(screen.queryByText('All photos')).toBeNull();
    expect(screen.queryAllByRole('tab', { name: /Months|All photos/ })).toHaveLength(0);
  });

  it('RD-47 when Gallery scrolls, the field pins under the bar (outside the scroll, or a sticky header)', async () => {
    const { be, kv } = await october();
    await gallery(be, kv);
    const scroll = screen.getByTestId('gallery-scroll');
    await act(async () => {
      fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y: 600 }, contentSize: { width: 390, height: 3000 }, layoutMeasurement: { width: 390, height: 844 } } });
    });
    const fields = screen.getAllByLabelText('Search photos').filter(isHost);
    const inScroll = (n: Inst) => { for (let p: Inst | null = n.parent; p; p = p.parent) if (p === scroll) return true; return false; };
    const outside = fields.some((f) => !inScroll(f));
    // A sticky header: the scroll's stickyHeaderIndices names the child that holds the field.
    const sticky = (scroll.props.stickyHeaderIndices as number[] | undefined) ?? [];
    const content = scroll.findAll(isHost)[0];
    const kids = (content?.children ?? []) as Inst[];
    const pinned = sticky.some((i) => kids[i] && fields.some((f) => kids[i] === f || (kids[i] as Inst).findAll(isHost).includes(f)));
    expect({ outside, pinned }).toEqual(expect.objectContaining(outside ? { outside: true } : { pinned: true }));
    expect(outside || pinned).toBe(true);
  });
});

// =================================================================================================================
async function feedWith(opts: { user?: 'jo' | 'chase'; photos?: number; caption?: string } = {}) {
  const be = FakeBackend.withFixture();
  const { id } = await seedPost(be, { caption: opts.caption ?? 'First snow!', photos: opts.photos ?? 1, circles: [dadSide.id] });
  const r = await renderApp(<FeedScreen />, { be, user: opts.user ?? 'jo' });
  const card = await screen.findByTestId(`post-${id}`, {}, slow);
  return { ...r, be, id, card };
}

describe('RD-48 a Feed post in Instagram\'s order', () => {
  it('RD-48 face and name, then photos, reactions, description, time, who can see it, then comments', async () => {
    const { id, card } = await feedWith();
    const who = await within(card).findByTestId(`who-${id}`, {}, slow);
    const order = hostOrder(card);
    const at = (n: Inst | undefined) => (n ? order.indexOf(n) : -1);
    const head = within(card).getByTestId(`card-head-${id}`);
    const name = within(head).getByText('Chase');
    const desc = within(card).getByTestId(`desc-${id}`); // UX-R32 (engineer, flagged for qa-tdd): no name to find it by
    const seq = {
      name: at(name),
      photos: at(within(card).getByTestId(`collage-${id}`)),
      reactions: at(within(card).getByTestId(`actions-${id}`)),
      description: at(desc && (isHost(desc) ? desc : desc.findAll(isHost)[0])), // engineer, Nov 17: desc is the composite Text; order holds hosts
      time: at(within(card).getByTestId(`when-${id}`)),
      who: at(who),
      comments: at(within(card).getByTestId(`reply-${id}`)),
    };
    const vals = Object.values(seq);
    expect({ seq, found: vals.every((v) => v >= 0), inOrder: vals.every((v, i) => i === 0 || v > vals[i - 1]!) })
      .toEqual({ seq, found: true, inOrder: true });
  });

  // UX-R32 (round 4; engineer, flagged for qa-tdd): replaces RD-48's "Chase First snow!"; the name is on the row above.
  it('RD-48 UX-R32 the description is just the words ("First snow!"), without the sender\'s name', async () => {
    const { id, card } = await feedWith();
    const desc = within(card).getByTestId(`desc-${id}`);
    expect(textOf(desc).trim()).toBe('First snow!');
    expect((desc.findAll((n: Inst) => n.type === Text && n !== desc) as Inst[]).some((t) => textOf(t).trim() === 'Chase')).toBe(false);
    // The words keep their own nested Text, so "First snow!" is still found by its words (CAP-*, MOMENT-* tests).
    expect(within(card).getByText('First snow!')).toBeTruthy();
    // The words are not repeated anywhere above the photos any more.
    const order = hostOrder(card);
    const above = order.slice(0, order.indexOf(within(card).getByTestId(/^collage-/)));
    expect(above.filter((n) => n.type === Text && /First snow!/.test(textOf(n)))).toEqual([]);
  });

  it('RD-48 R22 the head: a round 36 pt face, the name Medium at body size (17 pt; Grandma Jo\'s Bigger text grows it); no time or "Sent to" line beside the name', async () => {
    const { id, card } = await feedWith();
    const head = within(card).getByTestId(`card-head-${id}`);
    const face = (head.findAll(isHost) as Inst[]).find((n) => {
      const s = flat(n.props.style);
      return Number(s.width) === 36 && Number(s.height) === 36 && Number(s.borderRadius) >= 18;
    });
    expect(face).toBeTruthy();
    const name = within(head).getByText('Chase');
    const s = flat(name.props.style);
    // R22 (review round 2): Jo has Bigger text on (viewer default), so the name matches the words' size, not a fixed 17.
    const body = flat(within(card).getByText('First snow!').props.style).fontSize;
    expect({ weight: famWeight(s), size: s.fontSize }).toEqual({ weight: '500', size: body });
    expect(within(head).queryByTestId(`when-${id}`)).toBeNull();
  });

  it('RD-49 with no profile photo yet, the face shows the initials', async () => {
    const { id, card } = await feedWith();
    expect(within(within(card).getByTestId(`card-head-${id}`)).getByText('C', { includeHiddenElements: true })).toBeTruthy();
  });
  it.todo('RD-49 a person\'s own round profile photo replaces the initials (blocked: profile photos need a schema and storage call, architect)');
});

// =================================================================================================================
describe('RD-50 a small "⋯" (spoken "Post options") replaces the Options word', () => {
  it('RD-50 icon only, at the far right of the head, 48 pt to tap; no "Options" word anywhere on the card', async () => {
    const { id, card } = await feedWith();
    const head = within(card).getByTestId(`card-head-${id}`);
    const btns = within(head).getAllByRole('button');
    const more = within(head).getByRole('button', { name: 'Post options' });
    expect(btns[btns.length - 1]).toBe(more);
    expect(wordsIn(more)).toMatch(/^[⋯…·\s]*$/);
    const s = flat(more.props.style);
    expect(Number(s.minHeight ?? s.height ?? 0)).toBeGreaterThanOrEqual(48);
    expect(Number(s.minWidth ?? s.width ?? 0)).toBeGreaterThanOrEqual(48);
    expect(within(card).queryByText('Options')).toBeNull();
    expect(within(card).queryByRole('button', { name: /^Options/ })).toBeNull();
  });

  it('RD-50 on my own post: Shared with (UX-R33, no heading), Edit description and Delete post (which asks first)', async () => {
    const { be, id, card } = await feedWith({ user: 'chase' });
    fireEvent.press(within(card).getByRole('button', { name: 'Post options' }));
    const menu = await screen.findByTestId(`more-${id}`);
    expect(within(menu).queryByText('Who can see this')).toBeNull(); // UX-R33 (QA-R2): no heading on my own post
    expect(within(menu).getByText(/^Shared with .+, \d+ (people|person)$/)).toBeTruthy();
    expect(within(menu).getByRole('button', { name: 'Edit description' })).toBeTruthy();
    fireEvent.press(within(menu).getByRole('button', { name: 'Delete post' }));
    expect(await screen.findByText('Delete this post?')).toBeTruthy(); // UX-R24 (RD-67): the iOS-style alert
    expect(be.state.posts[id]!.deleted).toBe(false);
    fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(be.state.posts[id]!.deleted).toBe(true));
  });

  it('RD-50 on someone else\'s post: Who can see this only, no Edit description or Delete post', async () => {
    const { id, card } = await feedWith({ user: 'jo' });
    fireEvent.press(within(card).getByRole('button', { name: 'Post options' }));
    const menu = await screen.findByTestId(`more-${id}`);
    expect(within(menu).getByText('Who can see this')).toBeTruthy();
    expect(within(menu).queryByRole('button', { name: 'Edit description' })).toBeNull();
    expect(within(menu).queryByRole('button', { name: 'Delete post' })).toBeNull();
  });
});

// =================================================================================================================
describe('RD-51 the time on a post reads like Instagram\'s', () => {
  it('RD-51 a post just shared reads "Just now"; three hours back reads "3 hours ago"', async () => {
    const be = FakeBackend.withFixture();
    const fresh = await seedPost(be, { caption: 'Fresh', circles: [dadSide.id] });
    const older = await seedPost(be, { caption: 'Earlier', circles: [dadSide.id] });
    const three = new Date(Date.now() - 3 * HOUR - 60e3).toISOString();
    be.state.posts[older.id]!.published_at = three;
    be.state.posts[older.id]!.created_at = three;
    await renderApp(<FeedScreen />, { be, user: 'jo' });
    await screen.findByTestId(`post-${fresh.id}`, {}, slow);
    expect(textOf(screen.getByTestId(`when-${fresh.id}`))).toBe('Just now');
    expect(textOf(await screen.findByTestId(`when-${older.id}`))).toBe('3 hours ago');
  });
});

// =================================================================================================================
describe('RD-52 no lines between posts: 32 pt of space', () => {
  it('RD-52 Feed has no hairline divider anywhere (between posts or inside one)', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Lake day', circles: [dadSide.id] });
    await seedPost(be, { caption: 'Cake time', circles: [dadSide.id] });
    await renderApp(<FeedScreen />, { be, user: 'jo' });
    await screen.findByText(/Cake time/, {}, slow);
    const c = light();
    const cards = hostOrder().filter((n) => /^post-/.test(String(n.props.testID ?? '')));
    expect(cards.length).toBe(2);
    const dividers = cards.flatMap((card) => [card, ...card.findAll(isHost)]).filter((n) => isDivider(n as Inst, c))
      .map((n) => n.props.testID ?? n.type);
    expect(dividers).toEqual([]);
  });

  it('RD-52 posts sit 32 pt apart (the list gap plus the card\'s own outer space)', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Lake day', circles: [dadSide.id] });
    await seedPost(be, { caption: 'Cake time', circles: [dadSide.id] });
    await renderApp(<FeedScreen />, { be, user: 'jo' });
    await screen.findByText(/Cake time/, {}, slow);
    const card = hostOrder().find((n) => /^post-/.test(String(n.props.testID ?? '')))!;
    let list: Inst | null = card.parent;
    while (list && !list.props.contentContainerStyle) list = list.parent;
    const gap = Number(flat(list?.props.contentContainerStyle).gap ?? flat(list?.props.contentContainerStyle).rowGap ?? 0);
    const s = flat(card.props.style);
    const outer = gap + Number(s.marginBottom ?? s.marginVertical ?? 0) + Number(s.marginTop ?? s.marginVertical ?? 0) + Number(s.paddingBottom ?? s.paddingVertical ?? 0);
    expect(outer).toBe(32);
  });
});

// =================================================================================================================
describe('RD-53 B3: all four emoji in one row, each with its count beside it', () => {
  async function reacted() {
    const be = FakeBackend.withFixture();
    const { id } = await seedPost(be, { caption: 'At the lake', circles: [dadSide.id] });
    await be.clientFor(chase.id).setReaction(id, '❤️');
    await be.clientFor(jo.id).setReaction(id, '❤️');
    await be.clientFor(alex.id).setReaction(id, '😂'); // engineer, Nov 17: was Earl, whose reaction Jo may not see (AUD reply scope 'parents'); Alex is a parent
    await renderApp(<FeedScreen />, { be, user: 'jo' });
    const card = await screen.findByTestId(`post-${id}`, {}, slow);
    const row = within(card).getByTestId(`actions-${id}`);
    return { be, id, card, row };
  }
  const btn = (row: Inst, name: string) => within(row).getByRole('button', { name });

  it('RD-53 one row: ❤️ 2, 😂 1, 👍 and 🎉 (a zero shows no number); mine is highlighted', async () => {
    const { row } = await reacted();
    await waitFor(() => expect(wordsIn(btn(row, 'Love it'))).toBe('❤️ 2'));
    expect(flat(row.props.style).flexDirection).toBe('row');
    expect(within(row).getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['Love it', 'Haha', 'Like it', 'Hooray']);
    expect({ love: wordsIn(btn(row, 'Love it')), haha: wordsIn(btn(row, 'Haha')), like: wordsIn(btn(row, 'Like it')), hooray: wordsIn(btn(row, 'Hooray')) })
      .toEqual({ love: '❤️ 2', haha: '😂 1', like: '👍', hooray: '🎉' });
    expect(btn(row, 'Love it').props.accessibilityState.selected).toBe(true);
    expect(btn(row, 'Haha').props.accessibilityState.selected).toBe(false);
  });

  it('RD-53 each button reads its count as its value ("Love it, 2"); none for a zero', async () => {
    const { row } = await reacted();
    await waitFor(() => expect(btn(row, 'Love it').props.accessibilityValue?.text).toBe('2'));
    expect(btn(row, 'Haha').props.accessibilityValue?.text).toBe('1');
    expect(btn(row, 'Like it').props.accessibilityValue?.text ?? '').toBe('');
  });

  it('RD-53 no separate count chips under the photo any more', async () => {
    const { id, card } = await reacted();
    await waitFor(() => expect(within(card).queryAllByText(/❤️/).length).toBeGreaterThan(0));
    expect(within(card).queryByTestId(`reactions-${id}`)).toBeNull();
    expect(within(card).queryAllByTestId(/^chip-/)).toHaveLength(0);
  });

  it('RD-53 one tap switches my pick and the counts change right there; the same tap again takes it back', async () => {
    const { be, id, row } = await reacted();
    await waitFor(() => expect(wordsIn(btn(row, 'Love it'))).toBe('❤️ 2'));
    fireEvent.press(btn(row, 'Like it'));
    await waitFor(() => expect({ love: wordsIn(btn(row, 'Love it')), like: wordsIn(btn(row, 'Like it')) }).toEqual({ love: '❤️ 1', like: '👍 1' }));
    expect(btn(row, 'Like it').props.accessibilityState.selected).toBe(true);
    expect(be.state.hearts.filter((h) => h.post === id && h.user === jo.id).map((h) => h.emoji)).toEqual(['👍']);
    fireEvent.press(btn(row, 'Like it'));
    await waitFor(() => expect(wordsIn(btn(row, 'Like it'))).toBe('👍'));
    expect(btn(row, 'Like it').props.accessibilityState.selected).toBe(false);
  });
});

// =================================================================================================================
describe('RD-54 C1: a rounded mosaic of at most 4 photos', () => {
  it('RD-54 six photos: 4 tiles (1 large, 3 small), the 4th says "+2" on a solid chip, not a dark wash', async () => {
    const { id, card } = await feedWith({ photos: 6 });
    const collage = within(card).getByTestId(`collage-${id}`);
    expect(within(collage).UNSAFE_queryAllByType(MediaImage)).toHaveLength(4);
    const tiles = within(collage).getAllByRole('button', { name: /^Open photo \d of 6/ });
    expect(tiles).toHaveLength(4);
    const plus = within(tiles[3]!).getByText('+2');
    // The chip: the nearest box behind "+2" is opaque and smaller than the tile (not a full-tile overlay).
    let chip: Inst | null = plus.parent;
    while (chip && !(isHost(chip) && flat(chip.props.style).backgroundColor !== undefined)) chip = chip.parent;
    expect(chip).toBeTruthy();
    const cs = flat(chip!.props.style);
    const fullCover = cs.position === 'absolute' && [cs.top, cs.right, cs.bottom, cs.left].every((v) => Number(v ?? -1) === 0);
    expect({ opaque: opaque(cs.backgroundColor), fullCover, isTile: chip === tiles[3] }).toEqual({ opaque: true, fullCover: false, isTile: false });
  });

  it('RD-54 four photos: four tiles, no "+N"', async () => {
    const { id, card } = await feedWith({ photos: 4 });
    const collage = within(card).getByTestId(`collage-${id}`);
    expect(within(collage).getAllByRole('button', { name: /^Open photo \d of 4/ })).toHaveLength(4);
    expect(within(collage).queryByText(/^\+\d+$/)).toBeNull();
  });

  it('RD-54 every tile has 16 pt corners, like Gallery; tapping one opens that photo', async () => {
    const { id, card, nav } = await feedWith({ photos: 6 });
    const tiles = within(within(card).getByTestId(`collage-${id}`)).getAllByRole('button', { name: /^Open photo \d of 6/ });
    for (const [i, t] of tiles.entries()) expect({ i, corner: cornerOf(t) }).toEqual({ i, corner: 16 });
    fireEvent.press(tiles[2]!);
    expect(nav.openViewer).toHaveBeenLastCalledWith(id, 2);
    fireEvent.press(tiles[3]!);
    expect(nav.openViewer).toHaveBeenLastCalledWith(id, 3);
  });

  it('RD-54 one photo is rounded too (16 pt), keeping its own shape', async () => {
    const { id, card } = await feedWith({ photos: 1 });
    const tile = within(within(card).getByTestId(`collage-${id}`)).getByRole('button', { name: /^Open photo 1 of 1/ });
    expect(cornerOf(tile)).toBe(16);
  });
});

// =================================================================================================================
describe('RD-55 lighter type: no Bold anywhere', () => {
  // qa-tdd, Nov 24 (TYPE-6, DEC-84): largeTitle is 34 in Standard and 38 in Easy view (Jo's default as a viewer).
  it('RD-55 TYPE-6 the greeting (largeTitle) is Semibold, not Bold: 38 pt in Jo\'s Easy view', async () => {
    const { be, kv } = await october();
    await gallery(be, kv);
    const h = screen.getByRole('header', { name: GREETING });
    const t = (h.type as unknown) === Text || (h.type as unknown) === 'Text' ? h : h.findAll((n: Inst) => n.type === Text)[0]!;
    const s = flat(t.props.style);
    expect({ weight: famWeight(s), size: s.fontSize }).toEqual({ weight: '600', size: 38 });
  });

  it('RD-55 TYPE-4 the kit\'s largeTitle is Semibold', async () => {
    render(<Txt variant="largeTitle">Large title</Txt>);
    expect(famWeight(flat(screen.getByText('Large title').props.style))).toBe('600');
  });

  it('RD-55 nothing on Gallery or Feed is Bold (700 or heavier)', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'At the lake', photos: 6, circles: [dadSide.id] });
    const r = await renderApp(<GalleryScreen />, { be, user: 'jo' });
    await screen.findByRole('header', { name: GREETING }, slow);
    const heavy = () => (screen.UNSAFE_root.findAll((n: Inst) => n.type === Text) as Inst[])
      .map((n) => { const st = flat(n.props.style); return { words: textOf(n), w: String(/_(\d00)/.exec(String(st.fontFamily ?? ''))?.[1] ?? st.fontWeight ?? '400') }; })
      .filter((x) => /^(700|800|900|bold)$/.test(x.w));
    expect(heavy()).toEqual([]);
    r.unmount();
    await renderApp(<FeedScreen />, { be, user: 'jo' });
    await screen.findByText(/At the lake/, {}, slow);
    await screen.findByText('+2');
    expect(heavy()).toEqual([]);
  });
});

