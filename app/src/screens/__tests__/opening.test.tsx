// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// OPEN-1..OPEN-11 (docs/product/SPEC-OPENING.md, DEC-58): the "New for you" card on Photos, one new post at a time,
// and the photo wall. Last visit is seeded through the KV store renderApp hands the app (`hearth.lastSeen.v1.<user>`).
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { Dimensions, StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { expectGrandparentSafe, renderApp, screenWords } from '../../test/renderApp';
import { paletteFor } from '../../ui/theme';
import { PhotosScreen } from '../PhotosScreen';

const { dadSide, momSide, everyone } = FIXTURE.circles;
const { jo, chase, alex } = FIXTURE.users;
const KEY = (u: string) => `hearth.lastSeen.v1.${u}`;
const HOUR = 3600e3;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type Node = { type: unknown; props: Record<string, unknown> };
const flat = (s: unknown) => (StyleSheet.flatten(typeof s === 'function' ? s({ pressed: false }) : s) ?? {}) as Record<string, unknown>;

/** Move a seeded post back in time (before the last visit, or into an older month). */
function backdate(be: FakeBackend, id: string, iso: string) {
  be.state.posts[id]!.published_at = iso;
  be.state.posts[id]!.created_at = iso;
}
const mediaOf = (be: FakeBackend, postId: string) =>
  Object.values(be.state.media).filter((m) => m.post === postId).sort((a, b) => a.position - b.position).map((m) => m.id);

/** All words inside one part of the screen. */
function wordsIn(root: ReturnType<typeof screen.getByTestId>): string {
  const parts: string[] = [];
  const walk = (c: unknown) => {
    if (typeof c === 'string' || typeof c === 'number') parts.push(String(c));
    else if (Array.isArray(c)) c.forEach(walk);
  };
  for (const t of root.findAll((n: Node) => n.type === Text)) walk(t.props.children);
  return parts.join(' ');
}
/** Document order of testIDs, to check what sits above what. */
const order = () => (screen.UNSAFE_root.findAll((n: Node) => typeof n.type === 'string' && typeof n.props.testID === 'string') as Node[]).map((n) => n.props.testID as string);
const FILLED = new Set([paletteFor('ios', false).accent, paletteFor('ios', true).accent, paletteFor('android', false).accent, paletteFor('android', true).accent]);
const isFilled = (b: Node) => FILLED.has(flat(b.props.style).backgroundColor as string);

/** Jo visited an hour ago; one older post she has seen, then `fresh` new ones from Chase since. */
async function joWithNew(fresh: Array<{ caption: string; photos?: number; author?: string; circles?: string[] }> = [{ caption: 'Pumpkin patch' }]) {
  const be = FakeBackend.withFixture();
  const old = await seedPost(be, { caption: 'Seen last week', circles: [dadSide.id] });
  backdate(be, old.id, ago(7 * 24 * HOUR));
  const ids: string[] = [];
  for (const f of fresh) ids.push((await seedPost(be, { circles: [dadSide.id], ...f })).id);
  const kv = memoryKV({ [KEY(jo.id)]: ago(HOUR) });
  return { be, kv, old: old.id, ids };
}

describe('OPEN New for you card', () => {
  it('OPEN-1 the card sits above the posts when someone else sent photos since the last visit', async () => {
    const { be, kv, ids } = await joWithNew();
    await renderApp(<PhotosScreen />, { be, kv, user: 'jo' });
    const card = await screen.findByTestId('new-for-you');
    expect(card).toBeTruthy();
    const o = order();
    expect(o.indexOf('new-for-you')).toBeLessThan(o.indexOf(`post-${ids[0]}`));
    expect(screen.getByText('Seen last week')).toBeTruthy(); // OPEN-1 the posts are still there underneath
  });

  it("OPEN-1 my own new posts never count (Chase), but someone else's do (Alex to Chase)", async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Mine', circles: [dadSide.id] });
    const kv = memoryKV({ [KEY(chase.id)]: ago(HOUR) });
    const r = await renderApp(<PhotosScreen />, { be, kv, user: 'chase' });
    expect(await screen.findByText('Mine')).toBeTruthy();
    expect(screen.queryByTestId('new-for-you')).toBeNull();
    r.unmount();

    await seedPost(be, { author: alex.id, caption: 'From Alex', circles: [momSide.id] });
    await renderApp(<PhotosScreen />, { be, kv: memoryKV({ [KEY(chase.id)]: ago(HOUR) }), user: 'chase' });
    expect(await screen.findByTestId('new-for-you')).toBeTruthy();
    expect(within(screen.getByTestId('new-for-you')).getByText(/from Alex/)).toBeTruthy();
  });

  it("OPEN-1 a post Jo can't see never makes a card for her; Nana Ruth, who can, gets one", async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Seen before', circles: [everyone.id] });
    for (const id of Object.keys(be.state.posts)) backdate(be, id, ago(7 * 24 * HOUR));
    await seedPost(be, { caption: "Mom's side only", circles: [momSide.id] });
    const r = await renderApp(<PhotosScreen />, { be, kv: memoryKV({ [KEY(jo.id)]: ago(HOUR) }), user: 'jo' });
    expect(await screen.findByText('Seen before')).toBeTruthy();
    expect(screen.queryByTestId('new-for-you')).toBeNull();
    r.unmount();

    await renderApp(<PhotosScreen />, { be, kv: memoryKV({ [KEY(FIXTURE.users.ruth.id)]: ago(HOUR) }), user: 'ruth' });
    expect(await screen.findByTestId('new-for-you')).toBeTruthy();
  });

  it('OPEN-2 "New since Today, from Chase and Alex": the day and the senders in words, no numbers, badges or "unread"', async () => {
    const { be, kv } = await joWithNew([{ caption: 'One' }, { caption: 'Two', author: alex.id, circles: [everyone.id] }]);
    await renderApp(<PhotosScreen />, { be, kv, user: 'jo' });
    const card = await screen.findByTestId('new-for-you');
    expect(within(card).getByText(/New since Today/)).toBeTruthy();
    expect(within(card).getByText(/from (Chase and Alex|Alex and Chase)/)).toBeTruthy();
    const words = wordsIn(card);
    expect(words).not.toMatch(/\d/); // two photos: no "+N", no counts
    expect(words).not.toMatch(/unread|badge/i);
  });

  it('OPEN-2 a last visit yesterday reads "New since Yesterday"', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Fresh' });
    const y = new Date();
    y.setDate(y.getDate() - 1);
    y.setHours(12, 0, 0, 0);
    await renderApp(<PhotosScreen />, { be, kv: memoryKV({ [KEY(jo.id)]: y.toISOString() }), user: 'jo' });
    expect(within(await screen.findByTestId('new-for-you')).getByText(/New since Yesterday/)).toBeTruthy();
  });

  it('OPEN-3 the collage spans the new photos (one big and three, the last "+N") and each tile opens that photo full screen', async () => {
    const { be, kv, ids } = await joWithNew([{ caption: 'Three', photos: 3 }, { caption: 'Two more', photos: 2 }]);
    const { nav } = await renderApp(<PhotosScreen />, { be, kv, user: 'jo' });
    const card = await screen.findByTestId('new-for-you');
    const tiles = within(card).getAllByRole('button', { name: /^Open photo \d of 5 full screen/ });
    expect(tiles).toHaveLength(4);
    expect(within(card).getByText('+1')).toBeTruthy();
    expect(tiles[0]!.props.accessibilityLabel).toMatch(/Chase/); // who sent it is never lost
    fireEvent.press(tiles[0]!);
    expect(nav.openViewer).toHaveBeenLastCalledWith(ids[0], 0); // oldest new post first
    fireEvent.press(tiles[3]!);
    expect(nav.openViewer).toHaveBeenLastCalledWith(ids[1], 0); // the 4th photo is the second post's first
  });

  it('OPEN-4 exactly one filled button on the card: "See the new photos" (DS-9)', async () => {
    const { be, kv } = await joWithNew();
    await renderApp(<PhotosScreen />, { be, kv, user: 'jo' });
    const card = await screen.findByTestId('new-for-you');
    expect(within(card).getByRole('button', { name: 'See the new photos' })).toBeTruthy();
    const filled = (within(card).getAllByRole('button') as unknown as Node[]).filter(isFilled);
    expect(filled.map((b) => b.props.accessibilityLabel)).toEqual(['See the new photos']);
  });
});

describe('OPEN-5 last visit on this phone', () => {
  it('OPEN-5 first ever open shows no card and keeps the visit time; the next open shows only what came after', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Before Jo ever opened it' });
    const kv = memoryKV();
    const first = await renderApp(<PhotosScreen />, { be, kv, user: 'jo' });
    expect(await screen.findByText('Before Jo ever opened it')).toBeTruthy();
    expect(screen.queryByTestId('new-for-you')).toBeNull();
    await waitFor(() => expect(kv.dump()[KEY(jo.id)]).toEqual(expect.stringMatching(/^\d{4}-\d\d-\d\dT/)));
    first.unmount();

    await seedPost(be, { caption: 'Sent after her first visit' });
    const second = await renderApp(<PhotosScreen />, { be, kv, user: 'jo' });
    const card = await screen.findByTestId('new-for-you');
    expect(within(card).getByText(/from Chase/)).toBeTruthy();
    second.unmount();

    await renderApp(<PhotosScreen />, { be, kv, user: 'jo' });
    expect(await screen.findByText('Sent after her first visit')).toBeTruthy();
    expect(screen.queryByTestId('new-for-you')).toBeNull(); // seen on the second visit
  });

  it('OPEN-5 read once when Photos loads, then set to now: the card stays for this visit', async () => {
    const { be, kv } = await joWithNew();
    const before = kv.dump()[KEY(jo.id)]!;
    await renderApp(<PhotosScreen />, { be, kv, user: 'jo' });
    expect(await screen.findByTestId('new-for-you')).toBeTruthy();
    await waitFor(() => expect(kv.dump()[KEY(jo.id)]! > before).toBe(true));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.getByTestId('new-for-you')).toBeTruthy();
  });
});

describe('OPEN-6 nothing new', () => {
  it('OPEN-6 nothing since the last visit: no card, and Photos opens on the newest post as before', async () => {
    const be = FakeBackend.withFixture();
    const p = await seedPost(be, { caption: 'Already seen' });
    backdate(be, p.id, ago(2 * HOUR));
    await renderApp(<PhotosScreen />, { be, kv: memoryKV({ [KEY(jo.id)]: ago(HOUR) }), user: 'jo' });
    expect(await screen.findByText('Already seen')).toBeTruthy();
    expect(screen.queryByTestId('new-for-you')).toBeNull();
    expect(screen.queryByRole('button', { name: 'See the new photos' })).toBeNull();
    expect(screen.getByRole('header', { name: 'Photos of Mia and Leo' })).toBeTruthy();
  });
});

describe('OPEN-7/8 one new post at a time', () => {
  async function openWalk() {
    const { be, kv, ids } = await joWithNew([{ caption: 'First at the park' }, { caption: 'Then the cake' }]);
    const r = await renderApp(<PhotosScreen />, { be, kv, user: 'jo' });
    fireEvent.press(await screen.findByRole('button', { name: 'See the new photos' }));
    const walk = await screen.findByTestId('new-one-at-a-time');
    return { ...r, ids, walk };
  }

  it('OPEN-7 shows the full post card, "1 of 2" in words, and Back, Next and Back to Photos buttons with words at 48 pt', async () => {
    const { walk } = await openWalk();
    expect(within(walk).getByText('First at the park')).toBeTruthy();
    expect(within(walk).getByText('1 of 2')).toBeTruthy();
    expect(within(walk).getByText('Chase')).toBeTruthy(); // sender
    expect(within(walk).getByRole('button', { name: 'Love it' })).toBeTruthy(); // reactions
    expect(within(walk).getByLabelText('Write something back to Chase')).toBeTruthy(); // comments
    expect(within(walk).getByLabelText(/can see this/)).toBeTruthy(); // who can see
    for (const name of ['Next', 'Back to Photos']) {
      const b = within(walk).getByRole('button', { name });
      expect(Number(flat(b.props.style).minHeight)).toBeGreaterThanOrEqual(48);
    }
    expect(within(walk).getByText('Next')).toBeTruthy();
    expect(isFilled(within(walk).getByRole('button', { name: 'Next' }) as unknown as Node)).toBe(true);
    expect(screen.queryByTestId('photos-toolbar')).toBeNull(); // in place of Photos, like Messages
    expectGrandparentSafe();
  });

  it('OPEN-8 oldest first; Next and Back move one post; on the last, Next reads Done and returns to Photos', async () => {
    const { walk } = await openWalk();
    expect(within(walk).queryByText('Then the cake')).toBeNull();
    fireEvent.press(within(walk).getByRole('button', { name: 'Next' }));
    const w2 = await screen.findByTestId('new-one-at-a-time');
    expect(await within(w2).findByText('Then the cake')).toBeTruthy();
    expect(within(w2).getByText('2 of 2')).toBeTruthy();
    expect(within(w2).queryByRole('button', { name: 'Next' })).toBeNull();
    const back = within(w2).getByRole('button', { name: 'Back' });
    expect(Number(flat(back.props.style).minHeight)).toBeGreaterThanOrEqual(48);
    fireEvent.press(back);
    expect(await within(screen.getByTestId('new-one-at-a-time')).findByText('First at the park')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Done' }));
    expect(await screen.findByTestId('photos-toolbar')).toBeTruthy();
    expect(screen.queryByTestId('new-one-at-a-time')).toBeNull();
  });

  it('OPEN-7 "Back to Photos" returns from any post, no swipe needed (DS-4)', async () => {
    await openWalk();
    fireEvent.press(screen.getByRole('button', { name: 'Back to Photos' }));
    expect(await screen.findByTestId('photos-toolbar')).toBeTruthy();
    expect(screen.queryByTestId('new-one-at-a-time')).toBeNull();
  });
});

describe('OPEN-9/10 photo wall', () => {
  const WALL = { name: 'See all photos as a wall' };

  /** Jo with a post from three months back and one from today. */
  async function wallFamily() {
    const be = FakeBackend.withFixture();
    const old = await seedPost(be, { caption: 'Autumn', photos: 2 });
    const back = new Date();
    back.setMonth(back.getMonth() - 3, 15);
    back.setHours(12, 0, 0, 0);
    backdate(be, old.id, back.toISOString());
    const recent = await seedPost(be, { caption: 'Today', photos: 1 });
    return { be, old: old.id, recent: recent.id, back };
  }

  it('OPEN-9 Photos toolbar has Wall (icon with the word) when there are posts, and none when there are no posts', async () => {
    const { be } = await wallFamily();
    const r = await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const bar = await screen.findByTestId('photos-toolbar');
    expect(await within(bar).findByRole('button', WALL)).toBeTruthy();
    expect(within(bar).getByText('Wall')).toBeTruthy();
    const s = flat(within(bar).getByRole('button', WALL).props.style);
    expect(s).toMatchObject({ flexDirection: 'column', alignItems: 'center' });
    r.unmount();

    await renderApp(<PhotosScreen />, { be: FakeBackend.withFixture(), user: 'jo' });
    expect(await screen.findByText(/No photos yet/)).toBeTruthy();
    expect(screen.queryByRole('button', WALL)).toBeNull();
  });

  it('OPEN-9 the wall: three columns under month headers, newest first', async () => {
    const { be, old, recent, back } = await wallFamily();
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    fireEvent.press(await screen.findByRole('button', WALL));
    const wall = await screen.findByTestId('photo-wall');
    const now = new Date();
    const headers = within(wall).getAllByRole('header').map((h) => h.props.accessibilityLabel ?? wordsIn(h));
    const thisMonth = `${LONG_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    const oldMonth = `${LONG_MONTHS[back.getMonth()]} ${back.getFullYear()}`;
    expect(headers.filter((h) => h === thisMonth || h === oldMonth)).toEqual([thisMonth, oldMonth]);
    const tiles = within(wall).getAllByTestId(/^wall-tile-/).map((t) => t.props.testID as string);
    expect(tiles).toEqual([...mediaOf(be, recent), ...mediaOf(be, old)].map((m) => `wall-tile-${m}`));
    // Three to a row: a third of the width (a percent near 33%, or a number at most a third of the window).
    const w = flat(within(wall).getAllByTestId(/^wall-tile-/)[0]!.props.style).width;
    if (typeof w === 'string') {
      expect(parseFloat(w)).toBeGreaterThan(30);
      expect(parseFloat(w)).toBeLessThanOrEqual(34);
    } else expect(Number(w)).toBeLessThanOrEqual(Dimensions.get('window').width / 3);
  });

  it('OPEN-10 every tile is at least 48 pt, names the sender and day, and opens that photo full screen', async () => {
    const { be, old, back } = await wallFamily();
    const { nav } = await renderApp(<PhotosScreen />, { be, user: 'jo' });
    fireEvent.press(await screen.findByRole('button', WALL));
    const wall = await screen.findByTestId('photo-wall');
    for (const t of within(wall).getAllByTestId(/^wall-tile-/)) {
      const s = flat(t.props.style);
      expect(Number(s.minHeight ?? s.height ?? 0)).toBeGreaterThanOrEqual(48);
      expect(t.props.accessibilityRole).toBe('button');
      expect(t.props.accessibilityLabel).toMatch(/Chase/);
    }
    const second = within(wall).getByTestId(`wall-tile-${mediaOf(be, old)[1]}`);
    expect(second.props.accessibilityLabel).toContain(`${MONTHS[back.getMonth()]} ${back.getDate()}`);
    fireEvent.press(second);
    expect(nav.openViewer).toHaveBeenLastCalledWith(old, 1);
    expectGrandparentSafe();
  });

  it('OPEN-10 the wall has "Back to Photos" and "Show older photos" (no gesture-only action)', async () => {
    const be = FakeBackend.withFixture();
    for (let i = 0; i < 21; i++) await seedPost(be, { caption: `Day ${i}` }); // one more than a page
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    fireEvent.press(await screen.findByRole('button', WALL));
    const wall = await screen.findByTestId('photo-wall');
    expect(within(wall).getAllByTestId(/^wall-tile-/)).toHaveLength(20);
    fireEvent.press(within(wall).getByRole('button', { name: 'Show older photos' }));
    // .length, not toHaveLength: a failed toHaveLength prints every tile's React fiber, which blocks waitFor past its timeout.
    await waitFor(() => expect(within(screen.getByTestId('photo-wall')).getAllByTestId(/^wall-tile-/).length).toBe(21));
    fireEvent.press(screen.getByRole('button', { name: 'Back to Photos' }));
    expect(await screen.findByTestId('photos-toolbar')).toBeTruthy();
    expect(screen.queryByTestId('photo-wall')).toBeNull();
  });
});

describe('OPEN-11 words', () => {
  it('OPEN-11 no "group" and no group names on the card, the one-at-a-time view or the wall; text 17 pt and up', async () => {
    const { be, kv } = await joWithNew([{ caption: 'Park' }, { caption: 'Cake', circles: [everyone.id] }]);
    await renderApp(<PhotosScreen />, { be, kv, user: 'jo' });
    const banned = new RegExp(`\\bgroups?\\b|${dadSide.name}|${momSide.name}`, 'i');
    expect(wordsIn(await screen.findByTestId('new-for-you'))).not.toMatch(banned);
    expectGrandparentSafe();

    fireEvent.press(screen.getByRole('button', { name: 'See the new photos' }));
    await screen.findByTestId('new-one-at-a-time');
    expect(screenWords()).not.toMatch(banned);
    expectGrandparentSafe();

    fireEvent.press(screen.getByRole('button', { name: 'Back to Photos' }));
    fireEvent.press(await screen.findByRole('button', { name: 'See all photos as a wall' }));
    await screen.findByTestId('photo-wall');
    expect(screenWords()).not.toMatch(banned);
    expectGrandparentSafe();
  });
});
