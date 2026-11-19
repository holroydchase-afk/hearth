// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEC-73 (Chase, Nov 19): Share is a postcard. docs/product/SPEC-REDESIGN.md 1j, SHARE-PC-1..SHARE-PC-12 (SHARE-PC-13 is
// Playwright in app/e2e-web/demo.spec.js; SHARE-PC-14 is a manual phone check). Reference look: direction B of
// /mnt/project-files/design/share-redo-2026-11-19/share-tester.html. Written first (red), Nov 19, by qa-tdd.
//
// Seams the engineer builds (named here so the tests can find them; the behaviour is what is checked):
//   - testID "share-card" on the card, testID "share-to" on its To: section (the line "To: <names>" lives inside).
//   - Each face tile's spoken label is "<name>, N people, picked" / "..., not picked" (any role).
//   - The big photo shows "1 of 3" in words; each thumbnail is a button "Show photo N"; the Add tile is a button
//     whose words are "Add".
//   - Nav gets goFeed() (wired to /feed in app/_layout.tsx and the demo); Send calls it instead of goPhotos().
//   - "Shared with <names>." is app state Feed reads (shown when Share and Feed share one AppProvider).
//   - src/share/postcard.ts  export function namesLine(names: string[]): string   (SHARE-PC-9's wording).
// How Share opens the picker is the engineer's call (auto on open, or a "Pick photos" button); `openPostcard` copes
// with both.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { ApiError } from '../../api/HearthApi';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import type { Circle, Space } from '../../api/types';
import { memoryKV, type KV } from '../../platform/kv';
import { saveLastAudience } from '../../share/audienceMemory';
import { expectGrandparentSafe, renderApp, screenWords, type FixtureUser } from '../../test/renderApp';
import { seedPost } from '../../test/seed';
import { paletteFor, photoShadow } from '../../ui/theme';
import { UploadQueue } from '../../upload/queue';
import type { AppDeps } from '../../state/AppContext';
import { FeedScreen } from '../FeedScreen';
import { ShareScreen } from '../ShareScreen';

const DAD = "Grandparents – Dad's side";
const MOM = "Grandparents – Mom's side";
const { chase, jo } = FIXTURE.users;
const light = () => paletteFor(Platform.OS as 'ios', false);
const slow = { timeout: 5000 };

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const isHost = (n: Inst) => typeof n.type === 'string';
const hostOrder = () => screen.UNSAFE_root.findAll(isHost) as Inst[];
const inside = (n: Inst, root: Inst) => { for (let p: Inst | null = n; p; p = p.parent) if (p === root) return true; return false; };
function wordsIn(root: Inst): string {
  const parts: string[] = [];
  const walk = (c: unknown) => {
    if (typeof c === 'string' || typeof c === 'number') parts.push(String(c));
    else if (Array.isArray(c)) c.forEach(walk);
  };
  for (const t of root.findAll((n: Inst) => n.type === Text)) walk(t.props.children);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

const photo = (i: number) => ({ uri: `file:///pick/${i}.jpg`, kind: 'photo' as const, width: 4032, height: 3024 });
const photos = (n: number, from = 1) => Array.from({ length: n }, (_, i) => photo(from + i));
const easyKV = (u: FixtureUser) => memoryKV({ [`hearth.prefs.v1.${FIXTURE.users[u].id}`]: JSON.stringify({ easyView: true }) });

/** Render Share (with Feed beside it when asked, in one AppProvider) and get to the "New post" page with `n` photos. */
async function openPostcard(opts: { user?: FixtureUser; n?: number; kv?: KV; be?: FakeBackend; deps?: Partial<AppDeps>; withFeed?: boolean } = {}) {
  const pickPhotos = jest.fn(async () => ({ items: photos(opts.n ?? 1) }));
  const ui = opts.withFeed ? <><ShareScreen /><FeedScreen /></> : <ShareScreen />;
  const r = await renderApp(ui, { user: opts.user ?? 'chase', kv: opts.kv, be: opts.be, deps: { pickPhotos, ...opts.deps } });
  await waitFor(async () => {
    const pickBtn = screen.queryAllByRole('button', { name: /^Pick photos/ })[0];
    if (pickBtn && !(r.deps.pickPhotos as jest.Mock).mock.calls.length) fireEvent.press(pickBtn);
    expect((r.deps.pickPhotos as jest.Mock).mock.calls.length).toBeGreaterThan(0);
  }, slow);
  await screen.findByRole('header', { name: 'New post' }, slow);
  return { ...r, pickPhotos: r.deps.pickPhotos as jest.Mock };
}

const tile = (name: string | RegExp) => screen.getByLabelText(typeof name === 'string' ? new RegExp(`^${esc(name)}, \\d+ (person|people), (not )?picked$`) : name);
const tiles = () => screen.UNSAFE_root.findAll((n: Inst) => isHost(n) && /, \d+ (person|people), (not )?picked$/.test(String(n.props.accessibilityLabel ?? ''))) as Inst[];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The "To:" line: the first words in the To: section up to the first tile. */
function toWords(): string {
  const to = screen.getByTestId('share-to');
  const firstTile = tiles()[0];
  const order = hostOrder();
  const stop = firstTile ? order.indexOf(firstTile) : Infinity;
  const parts: string[] = [];
  for (const n of order) {
    if (order.indexOf(n) >= stop) break;
    if (!inside(n, to) || (n.type as unknown) !== 'Text') continue;
    const c = n.props.children;
    const text = (Array.isArray(c) ? c : [c]).filter((x: unknown) => typeof x === 'string' || typeof x === 'number').join('');
    if (text) parts.push(text);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
const sendButton = () => screen.getAllByRole('button').find((b) => /^(Send to |Pick who gets it$)/.test(String(b.props.accessibilityLabel ?? wordsIn(b))))!;

/** A family with Everyone and 5 groups, for SHARE-PC-5. */
function sixCircles(): Circle[] {
  const g = (id: string, name: string, names: string[], kind: Circle['kind'] = 'group'): Circle => ({ circle_id: id, name, member_count: names.length, member_names: names, kind, parent_ids: [] });
  return [
    g(FIXTURE.circles.everyone.id, 'Everyone', ['Alex', 'Chase', 'Grandma Jo', 'Grandpa Earl', 'Nana Ruth'], 'everyone'),
    g(FIXTURE.circles.dadSide.id, DAD, ['Chase', 'Grandma Jo', 'Grandpa Earl']),
    g(FIXTURE.circles.momSide.id, MOM, ['Alex', 'Chase', 'Nana Ruth']),
    g('00000000-0000-4000-8000-000000000301', 'Our house', ['Alex', 'Chase']),
    g('00000000-0000-4000-8000-000000000302', 'Aunts and uncles', ['Aunt Kim', 'Chase', 'Tammy']),
    g('00000000-0000-4000-8000-000000000303', 'Cousins', ['Aunt Kim', 'Chase', 'Tammy']),
  ];
}

afterEach(() => jest.restoreAllMocks());

describe('SHARE-PC-1 one "New post" page holding a card', () => {
  it('SHARE-PC-1 the card (c.surface, photo shadow) holds the big photo, the note, a dashed c.line divider and To:, in that order; nothing but the pinned button below it', async () => {
    await openPostcard({ n: 3 });
    const card = screen.getByTestId('share-card');
    const c = light();
    const shadowed = [card, card.parent].filter(Boolean).some((n) => flat(n!.props.style).boxShadow === photoShadow(false)!.boxShadow);
    expect({ fill: flat(card.props.style).backgroundColor, shadowed }).toEqual({ fill: c.surface, shadowed: true });

    const order = hostOrder();
    const at = (n: Inst) => order.indexOf(n);
    const big = screen.getByText('1 of 3');
    const note = screen.getByLabelText('Add a note (optional)');
    // Nov 19, engineer for GUX-R2 (flagged for qa-tdd): the Add tile is dashed too now, so the divider is the dashed
    // host that isn't a button.
    const divider = (card.findAll((n: Inst) => isHost(n) && flat(n.props.style).borderStyle === 'dashed' && n.props.accessibilityRole !== 'button') as Inst[])[0];
    const to = screen.getByTestId('share-to');
    expect({ divider: !!divider, dividerColor: divider && (flat(divider.props.style).borderColor ?? flat(divider.props.style).borderTopColor) })
      .toEqual({ divider: true, dividerColor: c.line });
    expect([big, note, divider!, to].map((n) => inside(n, card))).toEqual([true, true, true, true]);
    expect([at(big) < at(note), at(note) < at(divider!), at(divider!) < at(to)]).toEqual([true, true, true]);

    // Below the card: only the pinned Send button's words.
    const send = sendButton();
    const after = order.filter((n) => at(n) > at(card) && !inside(n, card) && (n.type as unknown) === 'Text' && !inside(n, send));
    expect(after.map((n) => wordsIn(n))).toEqual([]);
    expect(screen.queryByRole('header', { name: 'Who can see it' })).toBeNull();
  });
});

describe('SHARE-PC-2 the big photo, thumbnails and Add', () => {
  it('SHARE-PC-2 3 photos: "1 of 3", thumbnails, tapping one makes it "2 of 3"; Add (48 pt, word under the icon) reopens the picker', async () => {
    const { pickPhotos } = await openPostcard({ n: 3 });
    expect(screen.getByText('1 of 3')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Show photo 2' }));
    expect(await screen.findByText('2 of 3')).toBeTruthy();
    const add = screen.getAllByRole('button').find((b) => wordsIn(b) === 'Add');
    expect(add).toBeTruthy();
    const calls = pickPhotos.mock.calls.length;
    fireEvent.press(add!);
    await waitFor(() => expect(pickPhotos.mock.calls.length).toBe(calls + 1));
    expectGrandparentSafe();
  });

  it('SHARE-PC-2 HARD-2 Add keeps the 10 max and says how many were left out', async () => {
    const { pickPhotos } = await openPostcard({ n: 3 });
    pickPhotos.mockResolvedValueOnce({ items: photos(9, 10) });
    fireEvent.press(screen.getAllByRole('button').find((b) => wordsIn(b) === 'Add')!);
    expect(await screen.findByText('1 of 10')).toBeTruthy();
    expect(screen.getByText(/10 at a time.*2 photos were left out/)).toBeTruthy();
  });

  it('SHARE-PC-2 one photo: no "1 of 1"', async () => {
    await openPostcard({ n: 1 });
    expect(screen.queryByText('1 of 1')).toBeNull();
    expect(screen.getAllByRole('button').some((b) => wordsIn(b) === 'Add')).toBe(true);
  });
});

describe('SHARE-PC-3 one note field, no title', () => {
  it('SHARE-PC-3 exactly one text field, "Add a note (optional)" with its label always shown; no Title, no "What\'s happening?"', async () => {
    await openPostcard({ n: 1 });
    const inputs = screen.UNSAFE_queryAllByType(TextInput);
    expect(inputs.map((i) => i.props.accessibilityLabel)).toEqual(['Add a note (optional)']);
    expect(screen.getByText('Add a note (optional)')).toBeTruthy(); // visible words, not only a placeholder
    expect(screenWords()).not.toMatch(/\bTitle\b|What's happening\?/);
    expectGrandparentSafe();
  });

  it('SHARE-PC-3 Send saves the note as the caption and title null; an empty note sends caption null', async () => {
    const enqueue = jest.spyOn(UploadQueue.prototype, 'enqueue');
    const first = await openPostcard({ n: 1 });
    fireEvent.changeText(screen.getByLabelText('Add a note (optional)'), '  First snow! ');
    fireEvent.press(tile(DAD));
    fireEvent.press(sendButton());
    await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(1));
    expect(enqueue.mock.calls[0]![0]).toMatchObject({ caption: 'First snow!', title: null });
    first.unmount();

    await openPostcard({ n: 1 });
    fireEvent.press(tile(DAD));
    fireEvent.press(sendButton());
    await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(2));
    expect(enqueue.mock.calls[1]![0]).toMatchObject({ caption: null, title: null });
  });
});

describe('SHARE-PC-4 old titles still show; new posts have none', () => {
  it('SHARE-PC-4 an old post\'s title shows on Feed; a post sent from the postcard shows no title line', async () => {
    const be = FakeBackend.withFixture();
    const old = await seedPost(be, { title: 'Mia turns 5', caption: 'Cake' });
    await openPostcard({ be, withFeed: true });
    expect(await screen.findByTestId(`post-title-${old.id}`, {}, slow)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Add a note (optional)'), 'Leaf pile');
    fireEvent.press(tile(DAD));
    fireEvent.press(sendButton());
    await waitFor(() => expect(Object.values(be.state.posts).some((p) => p.caption === 'Leaf pile' && p.status === 'published')).toBe(true), slow);
    const mine = Object.values(be.state.posts).find((p) => p.caption === 'Leaf pile')!;
    expect(mine.title ?? null).toBeNull();
    await screen.findByText('Leaf pile', {}, slow);
    expect(screen.queryByTestId(`post-title-${mine.id}`)).toBeNull();
  });
});

describe('SHARE-PC-5 face tiles inside the card (parents)', () => {
  async function six(kv?: KV) {
    const be = FakeBackend.withFixture();
    const api = be.clientFor(null, { trackAppSession: true });
    jest.spyOn(api, 'myCircles').mockResolvedValue(sixCircles());
    await openPostcard({ be, kv, deps: { api } });
    await waitFor(() => expect(tiles()).toHaveLength(6));
  }
  /** Columns from a tile's width (or flexBasis) as a share of its row, on the tile or one of its two wrappers. */
  const across = (t: Inst) => {
    for (let n: Inst | null = t, i = 0; n && i < 3; n = n.parent, i++) {
      const s = flat(n.props.style);
      const w = s.width ?? s.flexBasis;
      if (typeof w === 'string' && w.endsWith('%')) return Math.floor(100 / parseFloat(w) + 0.05);
    }
    return null;
  };

  it('SHARE-PC-5 Everyone and 5 groups: 6 tiles in the card, Everyone first, each "<name>, N people, not picked", 2 across here (GUX-R1), no sideways scroll', async () => {
    await six();
    const card = screen.getByTestId('share-card');
    const all = tiles();
    expect(all.every((t) => inside(t, card))).toBe(true);
    expect(String(all[0]!.props.accessibilityLabel)).toMatch(/^Everyone, \d+ people, not picked$/);
    expect(all.map((t) => String(t.props.accessibilityLabel).split(',')[0])).toEqual(['Everyone', DAD, MOM, 'Our house', 'Aunts and uncles', 'Cousins']);
    // Retargeted Nov 19 by engineer for GUX-R1, flagged for qa-tdd: "Grandparents" is wider than a 3-across tile on
    // this 375 pt test phone, so these tiles go 2 across (the column rule is in shareGux.test.tsx).
    expect(all.map(across)).toEqual(Array(6).fill(2));
    const to = screen.getByTestId('share-to');
    expect((to.findAll((n: Inst) => n.type === ScrollView && n.props.horizontal) as Inst[]).length).toBe(0);
    expect(wordsIn(all[1]!)).toMatch(/3 people/);
    expectGrandparentSafe();
  });

  it('SHARE-PC-5 Easy view On: 2 across', async () => {
    await six(easyKV('chase'));
    expect(tiles().map(across)).toEqual(Array(6).fill(2));
    expectGrandparentSafe();
  });
});

describe('SHARE-PC-6 a relative who can post sees people, never group names', () => {
  it('SHARE-PC-6 tiles and the To: line name people (≤2, then "and N more"); no group name anywhere; no Everyone (BETA-AUD-21)', async () => {
    const be = FakeBackend.withFixture();
    const api = be.clientFor(null, { trackAppSession: true });
    const space: Space = { space_id: FIXTURE.space.id, name: FIXTURE.space.name, role: 'viewer', inviter_name: 'Chase', can_post: true, reply_audience: 'parents' };
    jest.spyOn(api, 'mySpaces').mockResolvedValue([space]);
    jest.spyOn(api, 'myCircles').mockResolvedValue(sixCircles().concat([
      { circle_id: '00000000-0000-4000-8000-000000000304', name: 'Kids', member_count: 5, member_names: ['Alex', 'Chase', 'Grandma Jo', 'Nana Ruth', 'Tammy'], kind: 'group', parent_ids: [] },
    ]));
    await openPostcard({ user: 'jo', be, deps: { api } });
    await waitFor(() => expect(tiles().length).toBeGreaterThan(0));
    const labels = tiles().map((t) => String(t.props.accessibilityLabel));
    const GROUP = /Everyone|Grandparents|Dad's side|Mom's side|Our house|Aunts and uncles|Cousins|Kids/;
    expect(labels.filter((l) => GROUP.test(l))).toEqual([]);
    // Grandma Jo is the sender, so she isn't named on her own tiles.
    expect(labels.some((l) => /^Chase and Grandpa Earl, \d+ (person|people), not picked$/.test(l))).toBe(true);
    expect(labels.some((l) => /^Alex, Chase and 2 more, \d+ people, not picked$/.test(l))).toBe(true);
    expect(wordsIn(screen.getByTestId('share-card'))).not.toMatch(GROUP);
    fireEvent.press(tile(/^Chase and Grandpa Earl, /));
    expect(toWords()).toBe('To: Chase and Grandpa Earl');
    expect(toWords()).not.toMatch(GROUP);
  });
});

describe('SHARE-PC-7 nothing is picked at the start', () => {
  it('SHARE-PC-7 a saved last audience ticks nothing: every tile "not picked", the To: line is just "To:"', async () => {
    const kv = memoryKV();
    await saveLastAudience(kv, chase.id, [FIXTURE.circles.dadSide.id]);
    await openPostcard({ kv });
    await waitFor(() => expect(tiles().length).toBe(3));
    expect(tiles().map((t) => String(t.props.accessibilityLabel)).filter((l) => !l.endsWith('not picked'))).toEqual([]);
    expect(toWords()).toBe('To:');
  });

  it('SHARE-PC-7 bulk: a saved last audience ticks nothing on the review either; Send waits', async () => {
    const kv = memoryKV();
    await saveLastAudience(kv, chase.id, [FIXTURE.circles.dadSide.id]);
    const day = Array.from({ length: 4 }, (_, i) => ({ uri: `file:///picked/IMG_pc7_${i}.jpg`, type: 'image' as const, mimeType: 'image/jpeg', width: 4032, height: 3024, exif: { DateTimeOriginal: `2024:07:04 0${i + 1}:00:00` } }));
    await renderApp(<ShareScreen />, { user: 'chase', kv, deps: { pickBulk: jest.fn(async () => ({ assets: day })) } });
    fireEvent.press(await screen.findByRole('button', { name: 'Pick up to 100 photos at once' }, slow));
    await screen.findByText('4 photos from 1 day');
    expect(screen.queryByText(`Send to: ${DAD}`)).toBeNull();
    const boxes = await screen.findAllByRole('checkbox');
    for (const b of boxes) expect(b.props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByRole('button', { name: 'Send 4 photos' }).props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('SHARE-PC-8 tapping a tile picks it', () => {
  it('SHARE-PC-8 tap: "picked", accent check and accent border (not color alone); tap again: "not picked"', async () => {
    await openPostcard();
    await waitFor(() => expect(tiles().length).toBe(3));
    fireEvent.press(tile(DAD));
    const picked = screen.getByLabelText(new RegExp(`^${esc(DAD)}, \\d+ people, picked$`));
    const c = light();
    const borders = [picked, ...(picked.findAll((n: Inst) => isHost(n)) as Inst[])].map((n) => flat(n.props.style)).filter((s) => Number(s.borderWidth ?? 0) > 0 && s.borderColor === c.accent);
    // Widened Nov 19 by engineer for GUX-R4, flagged for qa-tdd: the check may sit in accentInk on a filled accent disc.
    const checks = picked.findAll((n: Inst) => (/check/.test(JSON.stringify(n.props.name ?? '')) && n.props.tintColor === c.accent) || (n.type === Text && /[✓✔]/.test(String(n.props.children)) && flat(n.props.style).color === c.accent)
      || (isHost(n) && flat(n.props.style).backgroundColor === c.accent && n.findAll((m: Inst) => /check/.test(JSON.stringify(m.props.name ?? '')) && m.props.tintColor === c.accentInk).length > 0));
    expect({ border: borders.length > 0, check: checks.length > 0 }).toEqual({ border: true, check: true });
    fireEvent.press(picked);
    expect(screen.getByLabelText(new RegExp(`^${esc(DAD)}, \\d+ people, not picked$`))).toBeTruthy();
  });
});

describe('SHARE-PC-9 the To: line names the people', () => {
  const namesLine = (names: string[]): string => (require('../../share/postcard') as { namesLine: (n: string[]) => string }).namesLine(names); // eslint-disable-line @typescript-eslint/no-require-imports
  it('SHARE-PC-9 unit: ≤2 names, then "and N more"', () => {
    expect(namesLine([])).toBe('');
    expect(namesLine(['Gammy'])).toBe('Gammy');
    expect(namesLine(['Gammy', 'Pawpaw'])).toBe('Gammy and Pawpaw');
    expect(namesLine(['Gammy', 'Pawpaw', 'Mom'])).toBe('Gammy, Pawpaw and 1 more');
    expect(namesLine(['Gammy', 'Pawpaw', 'Mom', 'Aunt Kim', 'Tammy'])).toBe('Gammy, Pawpaw and 3 more');
  });

  it('SHARE-PC-9 Everyone gives "Everyone in the family"; two groups give the union of their people (not me), each once', async () => {
    await openPostcard();
    await waitFor(() => expect(tiles().length).toBe(3));
    fireEvent.press(tile(DAD));
    expect(toWords()).toBe('To: Grandma Jo and Grandpa Earl');
    fireEvent.press(tile(MOM));
    // Dad's side (Jo, Earl) + Mom's side (Alex, Ruth); Chase is the sender.
    expect(toWords()).toMatch(/^To: [^,]+, [^,]+ and 2 more$/);
    fireEvent.press(tile('Everyone'));
    expect(toWords()).toBe('To: Everyone in the family');
  });
});

describe('SHARE-PC-10 the pinned button', () => {
  it('SHARE-PC-10 nothing picked: "Pick who gets it", off; a pick: "Send to <names>", on', async () => {
    await openPostcard();
    await waitFor(() => expect(tiles().length).toBe(3));
    const off = screen.getByRole('button', { name: 'Pick who gets it' });
    expect(off.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(tile(DAD));
    const on = screen.getByRole('button', { name: 'Send to Grandma Jo and Grandpa Earl' });
    expect(on.props.accessibilityState?.disabled ?? false).toBe(false);
    expect(screen.queryByRole('button', { name: 'Post' })).toBeNull();
  });

  it('SHARE-PC-10 the button sits outside the scrolling page (pinned above the keyboard and tab bar)', async () => {
    await openPostcard();
    const btn = screen.getByRole('button', { name: 'Pick who gets it' });
    const card = screen.getByTestId('share-card');
    let scroller: Inst | null = null;
    for (let p: Inst | null = card.parent; p; p = p.parent) if (p.type === ScrollView || (p.type as unknown) === 'RCTScrollView') { scroller = p; break; }
    expect(scroller).toBeTruthy();
    expect(inside(btn, scroller!)).toBe(false);
  });
});

describe('SHARE-PC-11 Send lands on Feed', () => {
  it('SHARE-PC-11 Send queues the post to the picked groups, goes to Feed (not Gallery) and says "Shared with <names>."', async () => {
    const be = FakeBackend.withFixture();
    const enqueue = jest.spyOn(UploadQueue.prototype, 'enqueue');
    const { nav } = await openPostcard({ be, withFeed: true, n: 2 });
    fireEvent.changeText(screen.getByLabelText('Add a note (optional)'), 'Pumpkin patch');
    fireEvent.press(tile(DAD));
    fireEvent.press(screen.getByRole('button', { name: 'Send to Grandma Jo and Grandpa Earl' }));
    await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(1));
    expect(enqueue.mock.calls[0]![0]).toMatchObject({ space: FIXTURE.space.id, circleIds: [FIXTURE.circles.dadSide.id], caption: 'Pumpkin patch' });
    expect(enqueue.mock.calls[0]![0].items).toHaveLength(2);
    const goFeed = (nav as unknown as { goFeed: jest.Mock }).goFeed;
    await waitFor(() => expect(goFeed).toHaveBeenCalled());
    expect(nav.goPhotos).not.toHaveBeenCalled();
    expect(await screen.findByText('Shared with Grandma Jo and Grandpa Earl.', {}, slow)).toBeTruthy();
    await waitFor(async () => expect((await be.clientFor(jo.id).getFeed({ space: FIXTURE.space.id }))[0]?.caption).toBe('Pumpkin patch'), slow);
  });
});

describe('SHARE-PC-12 a send error keeps everything', () => {
  it('SHARE-PC-12 the notice shows on the page; photos, note and picks stay; no Feed', async () => {
    jest.spyOn(UploadQueue.prototype, 'enqueue').mockRejectedValue(new ApiError('FAMILY_FULL'));
    const { nav } = await openPostcard({ n: 3 });
    fireEvent.changeText(screen.getByLabelText('Add a note (optional)'), 'Leaf pile');
    fireEvent.press(tile(DAD));
    fireEvent.press(screen.getByRole('button', { name: 'Send to Grandma Jo and Grandpa Earl' }));
    expect(await screen.findByText(/Your family is full for now/)).toBeTruthy();
    expect(screen.getByRole('header', { name: 'New post' })).toBeTruthy();
    expect(screen.getByText('1 of 3')).toBeTruthy();
    expect(screen.getByLabelText('Add a note (optional)').props.value).toBe('Leaf pile');
    expect(screen.getByLabelText(new RegExp(`^${esc(DAD)}, \\d+ people, picked$`))).toBeTruthy();
    expect((nav as unknown as { goFeed: jest.Mock }).goFeed).not.toHaveBeenCalled();
    expect(nav.goPhotos).not.toHaveBeenCalled();
  });
});
