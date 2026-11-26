// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// grandparent-ux and privacy-security review of the built two-step Share flow (DEC-91), Nov 26, 2026. Written first
// (red) by qa-tdd: GUX-FL-R1, R2, R3, R5, R6 (R6 also in shareFlow.test.tsx FLOW-15/16), R7, R8 and PRIV-FL-R1.
// Seams (behaviour is what is checked): testID "share-dock" on the pinned bottom block, which reports its height by
// onLayout; the page's ScrollView contentContainerStyle.paddingBottom is at least that height (R2). testID
// "share-sent-check" (a check mark) and "share-sent-words" (the post's first words) on the sent page (R7).
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Dimensions, PixelRatio, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV, type KV } from '../../platform/kv';
import { renderApp, type FixtureUser } from '../../test/renderApp';
import { contrast, paletteFor } from '../../ui/theme';
import { ShareScreen } from '../ShareScreen';

const mockWin = { width: 390, height: 800, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockWin }));

const slow = { timeout: 5000 };
const DAD = "Grandparents – Dad's side";
type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const isHost = (n: Inst) => typeof n.type === 'string';
function wordsIn(root: Inst): string {
  const parts: string[] = [];
  const walk = (c: unknown) => { if (typeof c === 'string' || typeof c === 'number') parts.push(String(c)); else if (Array.isArray(c)) c.forEach(walk); };
  for (const t of root.findAll((x: Inst) => x.type === Text)) walk(t.props.children);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
const prefs = (u: FixtureUser, p: object) => memoryKV({ [`hearth.prefs.v1.${FIXTURE.users[u].id}`]: JSON.stringify(p) });
function phone(width: number) {
  Object.assign(mockWin, { width, height: 800, scale: 3, fontScale: 1 });
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height: 800, scale: 3, fontScale: 1 });
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
}
function kindsOn(be = FakeBackend.withFixture()): FakeBackend {
  be.state.featureFlags = { ...be.state.featureFlags, post_kinds: true };
  be.state.spaceFeatures = { ...be.state.spaceFeatures, [`${FIXTURE.space.id}:post_kinds`]: true };
  return be;
}
async function start(opts: { kv?: KV; be?: FakeBackend; deps?: object } = {}) {
  const be = opts.be ?? kindsOn();
  const r = await renderApp(<ShareScreen />, { user: 'chase', be, kv: opts.kv, deps: { pickPhotos: jest.fn(async () => ({ items: [{ uri: 'file:///pick/1.jpg', kind: 'photo' as const, width: 4032, height: 3024 }] })), ...opts.deps } });
  await screen.findByRole('header', { name: 'New post' }, slow);
  return { ...r, be };
}
const openKind = async (label: string) => { fireEvent.press(await screen.findByRole('button', { name: label }, slow)); await screen.findByText('Step 1 of 2', {}, slow); };
const next = () => screen.getByRole('button', { name: 'Next: who gets it' });
const toStep2 = async () => { fireEvent.press(next()); await screen.findByRole('header', { name: 'Who gets it?' }, slow); };
const BOX = /^(What's happening\?|What's your news\?|What did they say\?)$/;
const pickGroup = () => fireEvent.press(screen.getByLabelText(new RegExp(`^${DAD}, \\d+ people, not picked$`)));

afterEach(() => { jest.restoreAllMocks(); Object.assign(mockWin, { width: 390, height: 800, scale: 3, fontScale: 1 }); });

/** A closed outline on `node` or its next two parents: a width on all four sides (not a bottom line only). */
function outline(node: Inst): { color: string; closed: boolean } | null {
  for (let n: Inst | null = node, i = 0; n && i < 4; n = n.parent, i++) {
    if (!isHost(n)) continue;
    const s = flat(n.props.style);
    const w = Number(s.borderWidth ?? 0);
    if (w > 0 && s.borderColor !== undefined) return { color: String(s.borderColor), closed: s.borderBottomWidth === undefined || Number(s.borderBottomWidth) === w };
    if (Number(s.borderBottomWidth ?? 0) > 0) return { color: String(s.borderBottomColor ?? s.borderColor), closed: false }; // an underline: not enough
  }
  return null;
}
function tileOutline(t: Inst): string | null {
  const ring = (t.findAll((n: Inst) => isHost(n) && Number(flat(n.props.style).borderWidth ?? 0) > 0 && Number(flat(n.props.style).borderRadius ?? 0) > 20) as Inst[])[0]
    ?? (t.findAll((n: Inst) => isHost(n) && Number(flat(n.props.style).borderWidth ?? 0) > 0) as Inst[])[0];
  return ring ? String(flat(ring.props.style).borderColor) : null;
}

describe('GUX-FL-R1 (P1) the words box, chips and unpicked tiles are visible: a closed outline >= 3:1 on the page', () => {
  const LOOKS = [
    { name: 'light', p: { look: 'light' }, dark: false },
    { name: 'dark', p: { look: 'dark' }, dark: true },
    { name: 'Easy view', p: { look: 'light', easyView: true }, dark: false },
  ];
  for (const L of LOOKS) {
    it(`GUX-FL-R1 (${L.name}) step 1 Event: the open box and each chip draw a closed outline, >= 3:1 against c.bg`, async () => {
      const c = paletteFor(Platform.OS as 'ios', L.dark);
      await start({ kv: prefs('chase', L.p) });
      await openKind('Add an event');
      const things: [string, Inst][] = [['words box', screen.getByLabelText(BOX)], ['Pick a day', screen.getByRole('button', { name: 'Pick a day' })], ['Add a place', screen.getByRole('button', { name: 'Add a place' })]];
      for (const [name, node] of things) {
        const o = outline(node);
        expect({ name, drawn: !!o, closed: o?.closed }).toEqual({ name, drawn: true, closed: true });
        expect({ name, ratio: /^#[0-9A-Fa-f]{6}$/.test(o!.color) ? contrast(o!.color, c.bg) >= 3 : false }).toEqual({ name, ratio: true });
      }
    });
    it(`GUX-FL-R1 (${L.name}) step 2: every unpicked group tile has an outline >= 3:1 against c.bg`, async () => {
      const c = paletteFor(Platform.OS as 'ios', L.dark);
      await start({ kv: prefs('chase', L.p) });
      await openKind('Share news');
      fireEvent.changeText(screen.getByLabelText(BOX), 'Leo lost his first tooth');
      await toStep2();
      const ts = screen.getAllByLabelText(/^.+, \d+ (person|people), not picked$/);
      expect(ts.length).toBeGreaterThan(0);
      for (const t of ts) {
        const col = tileOutline(t);
        expect({ tile: String(t.props.accessibilityLabel), ok: !!col && /^#[0-9A-Fa-f]{6}$/.test(col) && contrast(col, c.bg) >= 3 }).toEqual({ tile: String(t.props.accessibilityLabel), ok: true });
      }
    });
  }
});

describe('GUX-FL-R2 Easy view step 2: the tiles and summary are never hidden behind the pinned dock', () => {
  for (const width of [360, 390]) {
    it(`GUX-FL-R2 ${width} px: the page's bottom padding is at least the dock's height`, async () => {
      phone(width);
      await start({ kv: prefs('chase', { look: 'light', easyView: true }) });
      await openKind('Share news');
      fireEvent.changeText(screen.getByLabelText(BOX), 'Leo lost his first tooth');
      await toStep2();
      pickGroup();
      const dock = screen.getByTestId('share-dock');
      fireEvent(dock, 'layout', { nativeEvent: { layout: { x: 0, y: 600, width, height: 188 } } });
      await waitFor(() => {
        const scroller = screen.UNSAFE_getByType(ScrollView);
        expect(Number(flat(scroller.props.contentContainerStyle).paddingBottom ?? 0)).toBeGreaterThanOrEqual(188);
      }, slow);
      expect(wordsIn(screen.getByTestId('share-summary'))).toMatch(/will see your news|will see/);
    });
  }
});

describe('GUX-FL-R3 the Easy view tile caption is 21 pt or more', () => {
  it('GUX-FL-R3 Easy view on: "N people" under each tile is >= 21 (off: unchanged)', async () => {
    await start({ kv: prefs('chase', { look: 'light', easyView: true }) });
    await openKind('Share news');
    fireEvent.changeText(screen.getByLabelText(BOX), 'Leo lost his first tooth');
    await toStep2();
    const counts = screen.getAllByTestId('face-count');
    expect(counts.length).toBeGreaterThan(0);
    for (const t of counts) expect(Number(flat(t.props.style).fontSize)).toBeGreaterThanOrEqual(21);
  });
});

describe('GUX-FL-R5 a filled Saying chip reads "Said by <name>"', () => {
  it('GUX-FL-R5 "Who said it?" becomes "Said by Leo"; edited, it follows', async () => {
    await start();
    await openKind('Add a saying');
    fireEvent.press(screen.getByRole('button', { name: 'Who said it?' }));
    fireEvent.changeText(await screen.findByLabelText('Who said it', {}, slow), 'Leo');
    expect(screen.getByRole('button', { name: 'Said by Leo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Leo' })).toBeNull();
  });
});

describe('GUX-FL-R6 the Saturday quick chip reads like "Sat, Nov 28"', () => {
  it('GUX-FL-R6 the chip names the day, not just the weekday', async () => {
    jest.useFakeTimers({ now: new Date(2026, 10, 26, 12), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    await start();
    await openKind('Add an event');
    fireEvent.press(screen.getByRole('button', { name: 'Pick a day' }));
    await screen.findByTestId('day-sheet', {}, slow);
    expect(screen.getByRole('button', { name: 'Sat, Nov 28' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Saturday' })).toBeNull();
    jest.useRealTimers();
  });
});

describe('GUX-FL-R7 the sent page confirms what went out', () => {
  async function sendNews(deps: object = {}) {
    const r = await start({ deps });
    await openKind('Share news');
    fireEvent.changeText(screen.getByLabelText(BOX), 'Leo lost his first tooth and the tooth fairy came');
    await toStep2();
    pickGroup();
    fireEvent.press(screen.getByRole('button', { name: /^Send to / }));
    await screen.findByRole('header', { name: 'Sent' }, slow);
    return r;
  }
  it('GUX-FL-R7 a kind post: "Sent", who will see it, a check mark, the first words of the post', async () => {
    await sendNews();
    expect(wordsIn(screen.getByTestId('share-sent-who'))).toContain('Grandma Jo and Grandpa Earl');
    expect(screen.getByTestId('share-sent-check', { includeHiddenElements: true })).toBeTruthy();
    expect(wordsIn(screen.getByTestId('share-sent-words'))).toContain('Leo lost his first tooth');
    expect(screen.queryByText(/^Still sending/)).toBeNull();
  });
  it('GUX-FL-R7 photos: the note\'s first words show on the sent page', async () => {
    await start();
    fireEvent.press(await screen.findByRole('button', { name: /^Add photos/ }, slow));
    await screen.findByText('Step 1 of 2', {}, slow);
    fireEvent.changeText(screen.getByLabelText('Say something, optional'), 'Pumpkin patch with the whole family');
    await toStep2();
    pickGroup();
    fireEvent.press(screen.getByRole('button', { name: /^Send to / }));
    await screen.findByRole('header', { name: 'Sent' }, slow);
    expect(wordsIn(screen.getByTestId('share-sent-words'))).toContain('Pumpkin patch');
  });
  it('GUX-FL-R7 "Still sending…" shows on the sent page while the upload queue is not empty', async () => {
    await start({ deps: { prepare: jest.fn(() => new Promise(() => {})) } });
    fireEvent.press(await screen.findByRole('button', { name: /^Add photos/ }, slow));
    await screen.findByText('Step 1 of 2', {}, slow);
    await toStep2();
    pickGroup();
    fireEvent.press(screen.getByRole('button', { name: /^Send to / }));
    await screen.findByRole('header', { name: 'Sent' }, slow);
    expect(await screen.findByText(/^Still sending/, {}, slow)).toBeTruthy();
  });
});

describe('GUX-FL-R8 "Step 1 of 2" shows only once a kind is picked', () => {
  it('GUX-FL-R8 the empty card with the kinds row (a parent, post_kinds on) says no "Step 1 of 2"; picking a kind shows it', async () => {
    await start();
    await screen.findByTestId('share-kinds', {}, slow);
    expect(screen.queryByText(/Step 1 of 2/)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Share news' }));
    expect(await screen.findByText('Step 1 of 2', {}, slow)).toBeTruthy();
  });
  it('GUX-FL-R8 SHARE-ST-25 the wordless empty card stays wordless: its words are only "Add photos" and the stamp', async () => {
    await start();
    const tokens = wordsIn(screen.getByTestId('share-card', { includeHiddenElements: true })).split(' ').filter(Boolean).map((w) => w.toUpperCase());
    expect(tokens).not.toContain('STEP');
    expect(wordsIn(screen.UNSAFE_root as unknown as Inst)).not.toMatch(/Step \d of 2|To:/);
  });
});

describe('PRIV-FL-R1 (P2) the orphan key hearth.lastShared.v1.<userId> is deleted', () => {
  it('PRIV-FL-R1 a saved hearth.lastShared.v1.<id> is removed once the app starts; hearth.lastAudience.v1 stays', async () => {
    const kv = memoryKV({
      [`hearth.lastShared.v1.${FIXTURE.users.chase.id}`]: JSON.stringify({ at: new Date().toISOString(), ids: [FIXTURE.circles.dadSide.id] }),
      [`hearth.lastAudience.v1.${FIXTURE.users.chase.id}`]: JSON.stringify([FIXTURE.circles.dadSide.id]),
    });
    await start({ kv });
    await waitFor(() => expect(kv.dump()[`hearth.lastShared.v1.${FIXTURE.users.chase.id}`]).toBeUndefined(), slow);
    expect(kv.dump()[`hearth.lastAudience.v1.${FIXTURE.users.chase.id}`]).toBeDefined();
  });
});
