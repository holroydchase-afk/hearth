// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// OPEN-1..OPEN-12 (docs/product/SPEC-OPENING.md, DEC-58): the "New for you" card on Photos, one new post at a time,
// and the photo wall. GUX-R1..R8 (grandparent-ux) and QA-R1/QA-R3 are folded in. RD-10/RD-13 (redesign 1b): this
// opening content now sits on Gallery under the greeting, and the old Photos toolbar is Gallery's two-item top bar. Last visit is seeded through the KV store renderApp hands the app (`hearth.lastSeen.v1.<user>`).
// RD-18..RD-23 (redesign 1c, Nov 15): Gallery is the photo grid itself (testID `gallery-grid`, tiles
// `gallery-tile-<mediaId>`), New for you is a sideways row of photo tiles (no "Tap a photo to start" since Nov 16, DEC-61), the sender
// line "From Chase since yesterday" and a "See all" text button; the collage, "See the new photos" and the separate
// All photos wall are gone. The new rules' own tests are in redesignGallery.test.tsx; these keep OPEN-1..12 on them.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { Dimensions, StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { expectGrandparentSafe, renderApp, screenWords } from '../../test/renderApp';
import { paletteFor } from '../../ui/theme';
import { GalleryScreen } from '../../test/redesignScreens';

const { dadSide, momSide, everyone } = FIXTURE.circles;
const { jo, chase, alex } = FIXTURE.users;
const KEY = (u: string) => `hearth.lastSeen.v1.${u}`;
const HOUR = 3600e3;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
/** An hour ago, but never before midnight, so "today" holds even just after midnight. */
const earlierToday = () => {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return new Date(Math.max(midnight.getTime(), Date.now() - HOUR)).toISOString();
};
/** Noon, `n` calendar days back. */
const daysBack = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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
// RD-7 (DEC-59): the one main button is no longer a big filled one but the accent-tinted capsule (RD-4's "main tap
// word"); "filled" here now means that one highlighted button.
const FILLED = new Set([paletteFor('ios', false).accentSoft, paletteFor('ios', true).accentSoft, paletteFor('android', false).accentSoft, paletteFor('android', true).accentSoft]);
const isFilled = (b: Node) => FILLED.has(flat(b.props.style).backgroundColor as string);
/** RD-18: Gallery shows photos, not captions; wait for the grid to hold `n` tiles (or any). */
const gridCount = () => {
  const g = screen.queryByTestId('gallery-grid');
  return g ? within(g).queryAllByTestId(/^gallery-tile-/).length : 0;
};
const gridReady = (n?: number) => waitFor(() => (n === undefined ? expect(gridCount()).toBeGreaterThan(0) : expect(gridCount()).toBe(n)));
const SEE_ALL = { name: /^See all(?! the photos)/ }; // RD-21: the text button that replaced "See the new photos"

/** Jo visited an hour ago; one older post she has seen, then `fresh` new ones from Chase since. */
async function joWithNew(fresh: Array<{ caption: string; photos?: number; author?: string; circles?: string[] }> = [{ caption: 'Pumpkin patch' }]) {
  const be = FakeBackend.withFixture();
  const old = await seedPost(be, { caption: 'Seen last week', circles: [dadSide.id] });
  backdate(be, old.id, ago(7 * 24 * HOUR));
  const ids: string[] = [];
  for (const f of fresh) ids.push((await seedPost(be, { circles: [dadSide.id], ...f })).id);
  const kv = memoryKV({ [KEY(jo.id)]: earlierToday() });
  return { be, kv, old: old.id, ids };
}

describe('OPEN New for you card', () => {
  it('OPEN-1 RD-19 the section sits above the grid when someone else sent photos since the last visit', async () => {
    const { be, kv, old } = await joWithNew();
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    const card = await screen.findByTestId('new-for-you');
    expect(card).toBeTruthy();
    await gridReady();
    const o = order();
    expect(o.indexOf('new-for-you')).toBeLessThan(o.indexOf('gallery-grid'));
    expect(screen.getByTestId(`gallery-tile-${mediaOf(be, old)[0]}`)).toBeTruthy(); // OPEN-1 every photo is still there underneath
  });

  it("OPEN-1 my own new posts never count (Chase), but someone else's do (Alex to Chase)", async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Mine', circles: [dadSide.id] });
    const kv = memoryKV({ [KEY(chase.id)]: ago(HOUR) });
    const r = await renderApp(<GalleryScreen />, { be, kv, user: 'chase' });
    await gridReady(1);
    expect(screen.queryByTestId('new-for-you')).toBeNull();
    r.unmount();

    await seedPost(be, { author: alex.id, caption: 'From Alex', circles: [momSide.id] });
    await renderApp(<GalleryScreen />, { be, kv: memoryKV({ [KEY(chase.id)]: ago(HOUR) }), user: 'chase' });
    expect(await screen.findByTestId('new-for-you')).toBeTruthy();
    expect(within(screen.getByTestId('new-for-you')).getByText(/^From Alex\b/)).toBeTruthy(); // RD-20
  });

  it("OPEN-1 QA-R3 a post Jo can't see never makes a card for her; Nana Ruth, who can, gets one holding that post", async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Seen before', circles: [everyone.id] });
    for (const id of Object.keys(be.state.posts)) backdate(be, id, ago(7 * 24 * HOUR));
    await seedPost(be, { caption: "Mom's side only", circles: [momSide.id] });
    const r = await renderApp(<GalleryScreen />, { be, kv: memoryKV({ [KEY(jo.id)]: ago(HOUR) }), user: 'jo' });
    await gridReady(1);
    expect(screen.queryByTestId('new-for-you')).toBeNull();
    r.unmount();

    await renderApp(<GalleryScreen />, { be, kv: memoryKV({ [KEY(FIXTURE.users.ruth.id)]: ago(HOUR) }), user: 'ruth' });
    const card = await screen.findByTestId('new-for-you');
    // QA-R3: the card holds the Mom's side post itself, not just any card.
    fireEvent.press(within(card).getByRole('button', SEE_ALL));
    const walk = await screen.findByTestId('new-one-at-a-time');
    expect(within(walk).getByText("Mom's side only")).toBeTruthy();
  });

  it('OPEN-2 RD-20 "From Chase and Alex today" under the New for you heading; the only number is RD-19\'s chip; no "unread"', async () => {
    const { be, kv } = await joWithNew([{ caption: 'One' }, { caption: 'Two', author: alex.id, circles: [everyone.id] }]);
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    const card = await screen.findByTestId('new-for-you');
    expect(within(card).getByRole('header', { name: 'New for you' })).toBeTruthy();
    expect(within(card).getByText('From Chase and Alex today')).toBeTruthy(); // oldest sender first
    const words = wordsIn(card);
    expect(words).not.toMatch(/New since|Sent (today|since)|, from /); // GUX-R5's and the older lines are gone
    expect(words.replace(/\b2 new\b/, '')).not.toMatch(/\d/); // RD-19 (Chase, Nov 15): the "2 new" chip, nothing else counted
    expect(words).not.toMatch(/unread|badge/i);
  });

  it('OPEN-2 RD-20 a last visit yesterday reads "From Chase since yesterday"', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Fresh' });
    await renderApp(<GalleryScreen />, { be, kv: memoryKV({ [KEY(jo.id)]: daysBack(1).toISOString() }), user: 'jo' });
    expect(within(await screen.findByTestId('new-for-you')).getByText('From Chase since yesterday')).toBeTruthy();
  });

  it('OPEN-2 RD-20 within 6 days a weekday ("From Chase since Tuesday"), further back the month and day ("From Chase since Nov 3")', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Fresh' });
    const three = daysBack(3);
    const r = await renderApp(<GalleryScreen />, { be, kv: memoryKV({ [KEY(jo.id)]: three.toISOString() }), user: 'jo' });
    expect(within(await screen.findByTestId('new-for-you')).getByText(`From Chase since ${LONG_DAYS[three.getDay()]}`)).toBeTruthy();
    r.unmount();

    const ten = daysBack(10);
    await renderApp(<GalleryScreen />, { be, kv: memoryKV({ [KEY(jo.id)]: ten.toISOString() }), user: 'jo' });
    expect(within(await screen.findByTestId('new-for-you')).getByText(`From Chase since ${MONTHS[ten.getMonth()]} ${ten.getDate()}`)).toBeTruthy();
  });

  it('OPEN-3 RD-19 RD-21 one tile per new photo, oldest post first; any tile opens the walk at the oldest new post (no collage, no "+N")', async () => {
    const { be, kv, ids } = await joWithNew([{ caption: 'Three', photos: 3 }, { caption: 'Two more', photos: 2 }]);
    const { nav } = await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    const card = await screen.findByTestId('new-for-you');
    const tiles = within(card).getAllByTestId(/^new-tile-/);
    expect(tiles.map((t) => t.props.testID)).toEqual([...mediaOf(be, ids[0]!), ...mediaOf(be, ids[1]!)].map((m) => `new-tile-${m}`));
    expect(within(card).queryByText('+1')).toBeNull();
    expect(within(card).queryByTestId(/^collage-/)).toBeNull();
    expect(tiles[0]!.props.accessibilityLabel).toMatch(/Chase/); // who sent it is never lost
    fireEvent.press(tiles[3]!);
    const walk = await screen.findByTestId('new-one-at-a-time');
    expect(within(walk).getByText('Three')).toBeTruthy(); // the oldest new post, whichever tile
    expect(nav.openViewer).not.toHaveBeenCalled();
  });

  it('OPEN-4 RD-4 RD-21 no filled or tinted button in the section: "See all" is a text button and "See the new photos" is gone (DS-9)', async () => {
    const { be, kv } = await joWithNew();
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    const card = await screen.findByTestId('new-for-you');
    expect(within(card).getByRole('button', SEE_ALL)).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'See the new photos' })).toBeNull();
    const filled = (within(card).getAllByRole('button') as unknown as Node[]).filter(isFilled);
    expect(filled.map((b) => b.props.accessibilityLabel)).toEqual([]);
  });

  it('OPEN-12 GUX-R6 no ready photo in the new posts yet: no tiles, but the line and "See all" stay', async () => {
    const { be, kv, ids } = await joWithNew([{ caption: 'Still on its way' }]);
    for (const m of mediaOf(be, ids[0]!)) be.state.media[m]!.status = 'pending';
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    const card = await screen.findByTestId('new-for-you');
    expect(within(card).queryByTestId(/^collage-/)).toBeNull();
    expect(within(card).queryAllByTestId(/^new-tile-/)).toHaveLength(0);
    expect(within(card).getByText('From Chase today')).toBeTruthy();
    expect(within(card).getByRole('button', SEE_ALL)).toBeTruthy();
  });
});

describe('OPEN-5 last visit on this phone', () => {
  it('OPEN-5 first ever open shows no card and keeps the visit time; the next open shows only what came after', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Before Jo ever opened it' });
    const kv = memoryKV();
    const first = await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    await gridReady(1);
    expect(screen.queryByTestId('new-for-you')).toBeNull();
    await waitFor(() => expect(kv.dump()[KEY(jo.id)]).toEqual(expect.stringMatching(/^\d{4}-\d\d-\d\dT/)));
    first.unmount();

    await seedPost(be, { caption: 'Sent after her first visit' });
    const second = await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    const card = await screen.findByTestId('new-for-you');
    expect(within(card).getByText(/^From Chase\b/)).toBeTruthy();
    second.unmount();

    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    await gridReady(2);
    expect(screen.queryByTestId('new-for-you')).toBeNull(); // seen on the second visit
  });

  it('OPEN-5 read once when Photos loads, then set to now: the card stays for this visit', async () => {
    const { be, kv } = await joWithNew();
    const before = kv.dump()[KEY(jo.id)]!;
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    expect(await screen.findByTestId('new-for-you')).toBeTruthy();
    await waitFor(() => expect(kv.dump()[KEY(jo.id)]! > before).toBe(true));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(screen.getByTestId('new-for-you')).toBeTruthy();
  });

  it('OPEN-5 GUX-R4 QA-R1 a failed or offline first load saves nothing; once the network is back the card still shows', async () => {
    // First ever open while offline: nothing kept.
    const fresh = FakeBackend.withFixture();
    await seedPost(fresh, { caption: 'Before Jo ever opened it' });
    const emptyKv = memoryKV();
    const offApi = fresh.clientFor(null, { trackAppSession: true });
    jest.spyOn(offApi, 'getFeed').mockRejectedValue(new TypeError('Network request failed'));
    const a = await renderApp(<GalleryScreen />, { be: fresh, kv: emptyKv, user: 'jo', deps: { api: offApi } });
    await waitFor(() => expect(offApi.getFeed).toHaveBeenCalled());
    await act(async () => { await sleep(50); });
    expect(emptyKv.dump()[KEY(jo.id)]).toBeUndefined();
    a.unmount();

    // A visit an hour ago, then an offline open: the old visit stays, so the new photos aren't lost.
    const { be, kv } = await joWithNew([{ caption: 'Pumpkin patch' }]);
    const before = kv.dump()[KEY(jo.id)];
    const api = be.clientFor(null, { trackAppSession: true });
    jest.spyOn(api, 'getFeed').mockRejectedValue(new TypeError('Network request failed'));
    const b = await renderApp(<GalleryScreen />, { be, kv, user: 'jo', deps: { api } });
    await waitFor(() => expect(api.getFeed).toHaveBeenCalled());
    await act(async () => { await sleep(50); });
    expect(kv.dump()[KEY(jo.id)]).toBe(before);
    b.unmount();

    // No network, then network: the card is still there for the photos she hasn't seen.
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    expect(within(await screen.findByTestId('new-for-you')).getByText('From Chase today')).toBeTruthy();
  });

  it('OPEN-5 QA-R1 saved only after the first load succeeds, as the time that load started (not when it finished)', async () => {
    const { be, kv } = await joWithNew();
    const before = kv.dump()[KEY(jo.id)]!;
    const api = be.clientFor(null, { trackAppSession: true });
    const real = api.getFeed;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let held = false;
    jest.spyOn(api, 'getFeed').mockImplementation(async (args) => {
      if (!held) { held = true; await gate; }
      return real(args);
    });
    const t0 = Date.now();
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo', deps: { api }, waitReady: false });
    await waitFor(() => expect(held).toBe(true));
    await act(async () => { await sleep(80); });
    expect(kv.dump()[KEY(jo.id)]).toBe(before); // still loading: nothing saved yet
    const releasedAt = Date.now();
    await act(async () => { release(); await sleep(0); });
    await waitFor(() => expect(kv.dump()[KEY(jo.id)]).not.toBe(before));
    const saved = Date.parse(kv.dump()[KEY(jo.id)]!);
    expect(saved).toBeGreaterThanOrEqual(t0);
    expect(saved).toBeLessThan(releasedAt - 40); // the load's start, not its end
    expect(await screen.findByTestId('new-for-you')).toBeTruthy();
  });
});

describe('OPEN-6 nothing new', () => {
  it('OPEN-6 RD-22 nothing since the last visit: no section, and Gallery opens on the greeting and the grid', async () => {
    const be = FakeBackend.withFixture();
    const p = await seedPost(be, { caption: 'Already seen' });
    backdate(be, p.id, ago(2 * HOUR));
    await renderApp(<GalleryScreen />, { be, kv: memoryKV({ [KEY(jo.id)]: ago(HOUR) }), user: 'jo' });
    await gridReady(1);
    expect(screen.queryByTestId('new-for-you')).toBeNull();
    expect(screen.queryByRole('button', SEE_ALL)).toBeNull();
    expect(screen.getByRole('header', { name: /^Good (morning|afternoon|evening), Grandma Jo$/ })).toBeTruthy(); // RD-11
  });
});

describe('OPEN-7/8 one new post at a time', () => {
  async function openWalk(captions = ['First at the park', 'Then the cake']) {
    const { be, kv, ids } = await joWithNew(captions.map((caption) => ({ caption })));
    const r = await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    fireEvent.press(await screen.findByRole('button', SEE_ALL));
    const walk = await screen.findByTestId('new-one-at-a-time');
    return { ...r, ids, walk };
  }
  const walkNow = () => screen.getByTestId('new-one-at-a-time');
  type Inst = ReturnType<typeof screen.getByTestId>;
  const isButton = (n: Inst) => typeof n.type === 'string' && n.props.accessibilityRole === 'button';
  /** The step buttons in screen order: every button in the walk outside the post card, except "Back to Gallery". */
  function stepButtons(postId: string): Inst[] {
    const card = within(walkNow()).getByTestId(`post-${postId}`);
    const inCard = new Set(card.findAll(isButton));
    return walkNow().findAll(isButton).filter((b) => !inCard.has(b) && b.props.accessibilityLabel !== 'Back to Gallery');
  }
  /** How many other buttons share the nearest row with this one. */
  function rowMates(btn: Inst): number {
    for (let n = btn.parent; n && n !== walkNow(); n = n.parent) {
      if (typeof n.type === 'string' && flat(n.props.style).flexDirection === 'row') return n.findAll(isButton).length - 1;
    }
    return 0;
  }
  const NEXT = 'Next new photo'; // UX-R2 (Nov 17): spoken "Next new photo", shown "Next photo"
  const PREV = 'Previous new photo';
  const DONE = 'Done, back to Gallery';

  it('OPEN-7 GUX-R7 the full post card, the heading "New photos: 1 of 2", and Next and Back to Gallery with words at 48 pt', async () => {
    const { walk } = await openWalk();
    expect(within(walk).getByText('First at the park')).toBeTruthy();
    expect(within(walk).getByRole('header', { name: 'New photos: 1 of 2' })).toBeTruthy();
    expect(within(walk).queryByText('1 of 2')).toBeNull(); // GUX-R7: never the bare count
    expect(within(walk).getAllByText('Chase').length).toBeGreaterThan(0); // sender (RD-48: in the head and the description)
    expect(within(walk).getByRole('button', { name: 'Love it' })).toBeTruthy(); // reactions
    expect(within(walk).getByLabelText('Add a comment for Chase')).toBeTruthy(); // comments
    expect(within(walk).getByLabelText(/can see this/)).toBeTruthy(); // who can see
    for (const name of [NEXT, 'Back to Gallery']) {
      const b = within(walk).getByRole('button', { name });
      expect(Number(flat(b.props.style).minHeight)).toBeGreaterThanOrEqual(48);
    }
    expect(within(walk).getByText('Next photo')).toBeTruthy();
    expect(isFilled(within(walk).getByRole('button', { name: NEXT }) as unknown as Node)).toBe(true);
    // UX-R2 (Nov 17): Previous stays in the bottom bar on the first post, switched off, so Next isn't alone.
    expect(within(walk).getByRole('button', { name: PREV }).props.accessibilityState?.disabled).toBe(true);
    expect(screen.queryByTestId('top-bar')).toBeNull(); // in place of Gallery, like Search
    expectGrandparentSafe();
  });

  // Updated Nov 16 for the redesign polish GUX-R8 (Previous left, Next/Done right, one row); it replaces OPEN-12's
  // "Next first, full-width Previous under it" layout. Next stays the one filled step button, 48 pt, never a bare "Back".
  it('OPEN-7 GUX-R8 Next (Done on the last) is the filled step button; from step 2 "Previous" sits left of it on one row; never a bare "Back"', async () => {
    const { ids } = await openWalk(['One', 'Two', 'Three']);
    const expected = [[PREV, NEXT], [PREV, NEXT], [PREV, DONE]]; // UX-R2: Previous on every step (off on the first)
    const headers: string[] = [];
    for (let step = 0; step < 3; step++) {
      const btns = stepButtons(ids[step]!);
      expect(btns.map((b) => b.props.accessibilityLabel)).toEqual(expected[step]);
      const forward = btns[btns.length - 1]!;
      expect(isFilled(forward as unknown as Node)).toBe(true); // the one filled step button, on the right
      {
        expect(isFilled(btns[0] as unknown as Node)).toBe(false);
        expect(rowMates(btns[0]!)).toBe(1); // Previous and the forward button share one row
        expect(within(walkNow()).getByText('Previous')).toBeTruthy();
      }
      for (const b of btns) expect(Number(flat(b.props.style).minHeight)).toBeGreaterThanOrEqual(48);
      expect(within(walkNow()).queryByText('Back')).toBeNull();
      expect(within(walkNow()).queryByRole('button', { name: 'Back' })).toBeNull();
      expect(within(walkNow()).getByRole('button', { name: 'Back to Gallery' })).toBeTruthy();
      headers.push(within(walkNow()).queryAllByRole('header').map((h) => h.props.accessibilityLabel ?? wordsIn(h)).join(' | '));
      if (step < 2) {
        fireEvent.press(forward);
        expect(await within(walkNow()).findByText(['Two', 'Three'][step]!)).toBeTruthy();
      }
    }
    // GUX-R7 (Nov 11): checked last so the layout above fails on its own.
    headers.forEach((h, i) => expect(h).toContain(`New photos: ${i + 1} of 3`));
  });

  it('OPEN-8 GUX-R8 oldest first; Next and Previous move one post; on the last, "Done" (spoken "Done, back to Gallery") returns to Photos', async () => {
    const { walk } = await openWalk();
    expect(within(walk).queryByText('Then the cake')).toBeNull();
    fireEvent.press(within(walk).getByRole('button', { name: NEXT }));
    expect(await within(walkNow()).findByText('Then the cake')).toBeTruthy();
    expect(within(walkNow()).getByRole('header', { name: 'New photos: 2 of 2' })).toBeTruthy();
    expect(within(walkNow()).queryByRole('button', { name: NEXT })).toBeNull();
    const done = within(walkNow()).getByRole('button', { name: DONE });
    expect(within(done).getByText('Done')).toBeTruthy(); // visible word stays short
    fireEvent.press(within(walkNow()).getByRole('button', { name: PREV }));
    expect(await within(walkNow()).findByText('First at the park')).toBeTruthy();
    fireEvent.press(within(walkNow()).getByRole('button', { name: NEXT }));
    fireEvent.press(await screen.findByRole('button', { name: DONE }));
    expect(await screen.findByTestId('top-bar')).toBeTruthy();
    expect(screen.queryByTestId('new-one-at-a-time')).toBeNull();
  });

  it('OPEN-7 "Back to Gallery" returns from any post, no swipe needed (DS-4)', async () => {
    await openWalk();
    fireEvent.press(screen.getByRole('button', { name: 'Back to Gallery' }));
    expect(await screen.findByTestId('top-bar')).toBeTruthy();
    expect(screen.queryByTestId('new-one-at-a-time')).toBeNull();
  });
});

describe('OPEN-9/10 RD-18 the wall is Gallery itself', () => {
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

  it('OPEN-9 GUX-R3 RD-18 no separate "All photos" button: Gallery is the grid; with no posts, the empty words and no grid tiles', async () => {
    const { be } = await wallFamily();
    const r = await renderApp(<GalleryScreen />, { be, user: 'jo' });
    await gridReady(3);
    expect(screen.queryByRole('button', { name: 'See all the photos, three to a row' })).toBeNull();
    expect(screen.queryByText('All photos')).toBeNull();
    expect(screen.queryByText(/Wall/)).toBeNull(); // GUX-R3: no "Wall" anywhere a relative reads
    r.unmount();

    await renderApp(<GalleryScreen />, { be: FakeBackend.withFixture(), user: 'jo' });
    expect(await screen.findByText(/No photos yet/)).toBeTruthy();
    expect(gridCount()).toBe(0);
  });

  it('OPEN-9 RD-18 the grid: three or more to a row under month headers, newest first', async () => {
    const { be, old, recent, back } = await wallFamily();
    await renderApp(<GalleryScreen />, { be, user: 'jo' });
    await gridReady(3);
    const wall = screen.getByTestId('gallery-grid');
    const now = new Date();
    const headers = within(wall).getAllByRole('header').map((h) => h.props.accessibilityLabel ?? wordsIn(h));
    const thisMonth = `${LONG_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    const oldMonth = `${LONG_MONTHS[back.getMonth()]} ${back.getFullYear()}`;
    expect(headers.filter((h) => h === thisMonth || h === oldMonth)).toEqual([thisMonth, oldMonth]);
    const tiles = within(wall).getAllByTestId(/^gallery-tile-/).map((t) => t.props.testID as string);
    expect(tiles).toEqual([...mediaOf(be, recent), ...mediaOf(be, old)].map((m) => `gallery-tile-${m}`));
    // Updated Nov 17 for RD-44 (engineer; qa-tdd to confirm): each day opens on one full-width 3:2 photo, then
    // squares three to a row (a third of the row, flex 1 beside two others).
    const squares = within(wall).getAllByTestId(/^gallery-tile-/).filter((t) => Number(flat(t.props.style).aspectRatio) === 1);
    expect(squares.length).toBeGreaterThan(0);
    for (const sq of squares) {
      const w = flat(sq.props.style).width;
      if (w !== undefined) expect(typeof w === 'string' ? parseFloat(w) <= 34 : Number(w) <= Dimensions.get('window').width / 3).toBe(true);
      else expect(flat(sq.props.style).flex).toBe(1);
    }
  });

  it('OPEN-10 RD-18 every tile is at least 48 pt, names the sender and day, and opens that photo full screen', async () => {
    const { be, old, back } = await wallFamily();
    const { nav } = await renderApp(<GalleryScreen />, { be, user: 'jo' });
    await gridReady(3);
    const wall = screen.getByTestId('gallery-grid');
    for (const t of within(wall).getAllByTestId(/^gallery-tile-/)) {
      const s = flat(t.props.style);
      expect(Number(s.minHeight ?? s.height ?? 0)).toBeGreaterThanOrEqual(48);
      expect(t.props.accessibilityRole).toBe('button');
      expect(t.props.accessibilityLabel).toMatch(/Chase/);
    }
    const second = within(wall).getByTestId(`gallery-tile-${mediaOf(be, old)[1]}`);
    expect(second.props.accessibilityLabel).toContain(`${LONG_MONTHS[back.getMonth()]} ${back.getDate()}`); // RD-45: the full date
    fireEvent.press(second);
    expect(nav.openViewer).toHaveBeenLastCalledWith(old, 1);
    expectGrandparentSafe();
  });

  it('OPEN-10 RD-18 Gallery has "Show older photos" (no gesture-only action)', async () => {
    const be = FakeBackend.withFixture();
    for (let i = 0; i < 21; i++) await seedPost(be, { caption: `Day ${i}` }); // one more than a page
    await renderApp(<GalleryScreen />, { be, user: 'jo' });
    await gridReady(20);
    fireEvent.press(screen.getByRole('button', { name: 'Show older photos' }));
    // .length, not toHaveLength: a failed toHaveLength prints every tile's React fiber, which blocks waitFor past its timeout.
    await gridReady(21);
  });

  it('OPEN-10 T14 exactly one page (20 posts): Show older photos finds nothing more, then goes away with no error', async () => {
    const be = FakeBackend.withFixture();
    for (let i = 0; i < 20; i++) await seedPost(be, { caption: `Day ${i}` }); // exactly a page
    await renderApp(<GalleryScreen />, { be, user: 'jo' });
    await gridReady(20);
    const older = screen.queryByRole('button', { name: 'Show older photos' });
    if (older) fireEvent.press(older); // a full page can't know it was the last; one tap must settle it
    // A boolean, not toBeNull on the element: a failed match prints the whole fiber and stalls waitFor past its timeout.
    await waitFor(() => expect(screen.queryAllByRole('button', { name: 'Show older photos' }).length).toBe(0));
    expect(gridCount()).toBe(20);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('OPEN-11 words', () => {
  it('OPEN-11 RD-23 no "group" and no group names on the section, the one-at-a-time view or the grid; text 17 pt and up', async () => {
    const { be, kv } = await joWithNew([{ caption: 'Park' }, { caption: 'Cake', circles: [everyone.id] }]);
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    const banned = new RegExp(`\\bgroups?\\b|${dadSide.name}|${momSide.name}`, 'i');
    expect(wordsIn(await screen.findByTestId('new-for-you'))).not.toMatch(banned);
    expectGrandparentSafe();

    fireEvent.press(screen.getByRole('button', SEE_ALL));
    await screen.findByTestId('new-one-at-a-time');
    expect(screenWords()).not.toMatch(banned);
    expectGrandparentSafe();

    fireEvent.press(screen.getByRole('button', { name: 'Back to Gallery' }));
    await gridReady();
    expect(screenWords()).not.toMatch(banned);
    expectGrandparentSafe();
  });
});
