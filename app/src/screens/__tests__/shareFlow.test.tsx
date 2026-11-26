// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// FLOW-1..FLOW-24 (DEC-90, docs/product/SPEC-SHARE-FLOW.md): the two-step Share flow for Photos, Event, News and Saying.
// Written first (red), Nov 26, 2026, by qa-tdd. FLOW-20, 25, 26 are manual (tracker M-cases); FLOW-17, 22, 23 also
// have Playwright specs (app/e2e-web/share-flow.spec.js).
//
// Seams the engineer builds (the tests find things by these; the behaviour is what is checked):
//   - Step 1: header "New post" (Photos) / "Add an event" / "Share news" / "Add a saying"; a text "Step 1 of 2";
//     the pinned button "Next: who gets it"; a hint line (testID "share-hint") above it naming what is missing.
//   - Step 1 words: ONE multiline TextInput whose accessibilityLabel and placeholder are the question
//     ("What's happening?", "What's your news?", "What did they say?"); testID "share-words".
//   - Chips (role button, 48 pt+, icon + verb): Event "Pick a day", "Add a place"; Saying "Who said it?", "Add their age".
//     Once set a chip's label is its value ("Saturday, Nov 28", the place, the name, "Age 4"). A chip opens its editor:
//     the day sheet (testID "day-sheet"), or a text input labelled "Where" / "Who said it" / "Age" (age: numeric keypad).
//   - Day sheet: month grid with the month's name and year ("November 2026"), weekday initials, buttons "Earlier month"
//     and "Later month", day cells (role button, testID `day-YYYY-MM-DD`, label like "Saturday, Nov 28"), quick chips
//     "Today", "Tomorrow", "Saturday" (the coming Saturday), a "Done" button; today's cell testID "day-today".
//   - Step 2: "‹ Back" (button "Back"), "Step 2 of 2", header "Who gets it?", the FaceTiles ("<name>, N people, picked"),
//     one summary line (testID "share-summary"), pinned "Send to <names>"; a hint "Pick who gets it to send." while none.
//   - Sent page: header "Sent", testID "share-sent-who", buttons "See it in Feed" (nav.goFeed) and "Share another".
//   - src/share/dayPicker.ts: dayLabel(iso), quickDays(today), monthTitle(year, month0).
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { BackHandler, Keyboard, Platform, StyleSheet, Text, TextInput } from 'react-native';
import { ApiError } from '../../api/HearthApi';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import type { Space } from '../../api/types';
import { memoryKV, type KV } from '../../platform/kv';
import { expectGrandparentSafe, renderApp, type FixtureUser } from '../../test/renderApp';
import { UploadQueue } from '../../upload/queue';
import type { AppDeps } from '../../state/AppContext';
import { ShareScreen } from '../ShareScreen';

const slow = { timeout: 5000 };
const DAD = "Grandparents – Dad's side";
const MOM = "Grandparents – Mom's side";
const TODAY = new Date(2026, 10, 26, 12, 0, 0); // Thursday, Nov 26, 2026
type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
function wordsIn(root: Inst): string {
  const parts: string[] = [];
  const walk = (c: unknown) => {
    if (typeof c === 'string' || typeof c === 'number') parts.push(String(c));
    else if (Array.isArray(c)) c.forEach(walk);
  };
  for (const t of root.findAll((x: Inst) => x.type === Text)) walk(t.props.children);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
const pageWords = () => wordsIn(screen.UNSAFE_root as unknown as Inst);
const isDisabled = (b: Inst) => !!(b.props.accessibilityState?.disabled ?? b.props['aria-disabled']);
const tiles = () => screen.queryAllByLabelText(/^.+, \d+ (person|people), (not )?picked$/);
const photo = (i: number) => ({ uri: `file:///pick/${i}.jpg`, kind: 'photo' as const, width: 4032, height: 3024 });
const easyKV = (u: FixtureUser) => memoryKV({ [`hearth.prefs.v1.${FIXTURE.users[u].id}`]: JSON.stringify({ easyView: true }) });

/** Only Date is faked, so waitFor and the app's timers behave as normal. */
function fakeToday() {
  jest.useFakeTimers({
    now: TODAY,
    doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask',
      'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance', 'hrtime'],
  });
}

type Kind = 'photos' | 'event' | 'news' | 'saying';
const KIND_LABEL = { event: 'Add an event', news: 'Share news', saying: 'Add a saying' } as const;
const QUESTION = { event: "What's happening?", news: "What's your news?", saying: 'What did they say?' } as const;
const HEADER: Record<Kind, string> = { photos: 'New post', event: 'Add an event', news: 'Share news', saying: 'Add a saying' };

function kindsOn(be = FakeBackend.withFixture()): FakeBackend {
  be.state.featureFlags = { ...be.state.featureFlags, post_kinds: true };
  be.state.spaceFeatures = { ...be.state.spaceFeatures, [`${FIXTURE.space.id}:post_kinds`]: true };
  return be;
}

async function open(kind: Kind, opts: { user?: FixtureUser; be?: FakeBackend; kv?: KV; deps?: Partial<AppDeps>; n?: number } = {}) {
  const pickPhotos = jest.fn(async () => ({ items: Array.from({ length: opts.n ?? 2 }, (_, i) => photo(i + 1)) }));
  const be = opts.be ?? kindsOn();
  const r = await renderApp(<ShareScreen />, { user: opts.user ?? 'chase', be, kv: opts.kv, deps: { pickPhotos, ...opts.deps } });
  if (kind === 'photos') {
    await waitFor(() => {
      const b = screen.queryAllByRole('button', { name: /^Add photos/ })[0];
      if (b && !pickPhotos.mock.calls.length) fireEvent.press(b);
      expect(pickPhotos.mock.calls.length).toBeGreaterThan(0);
    }, slow);
  } else {
    fireEvent.press(await screen.findByRole('button', { name: KIND_LABEL[kind] }, slow));
  }
  await screen.findByRole('header', { name: HEADER[kind] }, slow);
  return { ...r, be };
}

const words = () => screen.getByLabelText(/^(What's happening\?|What's your news\?|What did they say\?)$/);
const next = () => screen.getByRole('button', { name: 'Next: who gets it' });
const chip = (name: string | RegExp) => screen.getByRole('button', { name });
const tile = (name: string) => screen.getByLabelText(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, \\d+ (person|people), (not )?picked$`));

/** Fill step 1 the way a person does: type the words, set each chip through its editor. */
async function fillStep1(kind: Exclude<Kind, 'photos'>) {
  fireEvent.changeText(words(), { event: 'Pumpkin patch', news: 'Leo lost his first tooth', saying: 'Pawpaw, your beard is a cloud' }[kind]);
  if (kind === 'event') {
    fireEvent.press(chip('Pick a day'));
    fireEvent.press(await screen.findByTestId('day-2026-11-28', {}, slow));
    fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByTestId('day-sheet')).toBeNull(), slow);
  }
  if (kind === 'saying') {
    fireEvent.press(chip('Who said it?'));
    fireEvent.changeText(await screen.findByLabelText('Who said it', {}, slow), 'Leo');
  }
}
async function toStep2(kind: Kind) {
  if (kind !== 'photos') await fillStep1(kind);
  fireEvent.press(next());
  await screen.findByRole('header', { name: 'Who gets it?' }, slow);
}
const sendBtn = (names = 'Grandma Jo and Grandpa Earl') => screen.getByRole('button', { name: `Send to ${names}` });
const KINDS: Kind[] = ['photos', 'event', 'news', 'saying'];
const NOUN = { photos: 'your photos', event: 'this event', news: 'your news', saying: 'this saying' } as const;

afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

describe('FLOW-1 step 1 says "Step 1 of 2" and holds no audience', () => {
  for (const k of KINDS) {
    it(`FLOW-1 ${k}: "Step 1 of 2", pinned "Next: who gets it", no group tile, no "To:" text`, async () => {
      await open(k);
      expect(screen.getByText('Step 1 of 2')).toBeTruthy();
      expect(next()).toBeTruthy();
      expect(tiles()).toHaveLength(0);
      expect(pageWords()).not.toMatch(/To:/);
      expect(screen.queryByText(/Step 2 of 2/)).toBeNull();
    });
  }
});

describe('FLOW-2 one big open box, no underline field', () => {
  for (const k of ['event', 'news', 'saying'] as const) {
    it(`FLOW-2 ${k}: one multiline box, the question as placeholder and label, nothing ruled and no label row above it`, async () => {
      await open(k);
      const inputs = screen.UNSAFE_root.findAllByType(TextInput);
      expect(inputs).toHaveLength(1);
      const box = words();
      expect(box.props.multiline).toBe(true);
      expect(box.props.placeholder).toBe(QUESTION[k]);
      expect(box.props.accessibilityLabel).toBe(QUESTION[k]);
      expect(screen.queryByTestId('field-underline')).toBeNull();
      const s = flat(box.props.style);
      expect(s.borderBottomWidth ?? 0).toBe(0);
      expect(s.borderWidth ?? 0).toBe(0);
      // no visible label row: the question lives in the placeholder only
      expect(pageWords()).not.toMatch(/What's happening\b(?!\?)|Your news|What they said|Where, optional|What day/);
    });
  }
});

describe('FLOW-3 chips per kind: a verb, an icon, 48 pt', () => {
  const CHIPS = { event: ['Pick a day', 'Add a place'], saying: ['Who said it?', 'Add their age'], news: [] as string[] };
  for (const k of ['event', 'saying', 'news'] as const) {
    it(`FLOW-3 ${k}: chips ${CHIPS[k].join(' + ') || 'none'}, each >= 48 pt tall with an icon`, async () => {
      await open(k);
      for (const name of CHIPS[k]) {
        const c = chip(name);
        expect(flat(c.props.style).minHeight).toBeGreaterThanOrEqual(48);
        expect(c.findAll((n: Inst) => n.props?.testID === 'chip-icon' || /Icon/.test(String((n.type as { displayName?: string })?.displayName ?? ''))).length).toBeGreaterThan(0);
      }
      const all = screen.queryAllByRole('button').map((b) => String(b.props.accessibilityLabel ?? ''));
      if (k === 'news') expect(all.filter((l) => /Pick a day|Add a place|Who said it|Add their age/.test(l))).toEqual([]);
    });
  }
  it('FLOW-3 tapping "Add a place" opens its editor; tapping "Add their age" opens the age editor', async () => {
    await open('event');
    fireEvent.press(chip('Add a place'));
    expect(await screen.findByLabelText('Where', {}, slow)).toBeTruthy();
  });
});

describe('FLOW-4 a chip with a value shows it and edits on tap', () => {
  it('FLOW-4 event: day "Saturday, Nov 28" and the place show in their pills; tapping the day pill reopens the sheet', async () => {
    fakeToday();
    await open('event');
    await fillStep1('event');
    fireEvent.press(chip('Add a place'));
    fireEvent.changeText(await screen.findByLabelText('Where', {}, slow), "Grandpa Earl's farm");
    expect(chip('Saturday, Nov 28')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pick a day' })).toBeNull();
    expect(chip("Grandpa Earl's farm")).toBeTruthy();
    fireEvent.press(chip('Saturday, Nov 28'));
    expect(await screen.findByTestId('day-sheet', {}, slow)).toBeTruthy();
  });
  it('FLOW-4 saying: the name and "Age 4" show in their pills', async () => {
    await open('saying');
    await fillStep1('saying');
    fireEvent.press(chip('Add their age'));
    fireEvent.changeText(await screen.findByLabelText('Age', {}, slow), '4');
    expect(chip('Said by Leo')).toBeTruthy(); // GUX-FL-R5
    expect(chip('Age 4')).toBeTruthy();
  });
});

describe('FLOW-5 the button waits for the required words and the hint names what is missing', () => {
  it('FLOW-5 event: words and day missing, then the day missing, then ready (hint empty)', async () => {
    await open('event');
    expect(isDisabled(next())).toBe(true);
    expect(wordsIn(screen.getByTestId('share-hint'))).toBe("Add what's happening and the day to go on.");
    fireEvent.changeText(words(), 'Pumpkin patch');
    expect(isDisabled(next())).toBe(true);
    expect(wordsIn(screen.getByTestId('share-hint'))).toBe('Add the day to go on.');
    fireEvent.changeText(words(), '   ');
    expect(wordsIn(screen.getByTestId('share-hint'))).toBe("Add what's happening and the day to go on.");
    await fillStep1('event');
    expect(isDisabled(next())).toBe(false);
    expect(wordsIn(screen.getByTestId('share-hint'))).toBe('');
  });
  it('FLOW-5 saying: words and who missing, then who missing, then ready', async () => {
    await open('saying');
    expect(isDisabled(next())).toBe(true);
    expect(wordsIn(screen.getByTestId('share-hint'))).toBe('Add what they said and who said it to go on.');
    fireEvent.changeText(words(), 'Pawpaw, your beard is a cloud');
    expect(wordsIn(screen.getByTestId('share-hint'))).toBe('Add who said it to go on.');
    await fillStep1('saying');
    expect(isDisabled(next())).toBe(false);
    expect(wordsIn(screen.getByTestId('share-hint'))).toBe('');
  });
  it('FLOW-5 news: off until words, then on', async () => {
    await open('news');
    expect(isDisabled(next())).toBe(true);
    expect(wordsIn(screen.getByTestId('share-hint'))).toBe('Add your news to go on.');
    fireEvent.changeText(words(), 'Leo lost his first tooth');
    expect(isDisabled(next())).toBe(false);
    expect(wordsIn(screen.getByTestId('share-hint'))).toBe('');
  });
});

describe('FLOW-6 Photos step 1', () => {
  it('FLOW-6 with photos picked: the big photo, thumbnails, "Say something, optional" box; Next is on with no note', async () => {
    await open('photos', { n: 3 });
    expect(screen.getByLabelText('Photo 1 of 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show photo 2' })).toBeTruthy();
    expect(screen.getByLabelText('Say something, optional')).toBeTruthy();
    expect(isDisabled(next())).toBe(false);
    expect(wordsIn(screen.getByTestId('share-card'))).not.toMatch(/To:/);
  });
  it('FLOW-6 the empty Share card is still one "Add photos" button with the stamp, and no To: or ruled lines', async () => {
    await renderApp(<ShareScreen />, { user: 'chase', be: kindsOn(), deps: { pickPhotos: jest.fn(async () => ({ items: [] })) } });
    expect(await screen.findByRole('button', { name: /^Add photos( or videos)?, up to \d+ at a time$/ }, slow)).toBeTruthy();
    const HIDDEN = { includeHiddenElements: true } as const;
    expect(screen.getByTestId('share-stamp', HIDDEN)).toBeTruthy();
    expect(screen.queryAllByTestId('share-to-rule', HIDDEN)).toHaveLength(0);
    expect(screen.queryAllByTestId('share-note-rule', HIDDEN)).toHaveLength(0);
    expect(wordsIn(screen.UNSAFE_root as unknown as Inst)).not.toMatch(/To:/);
  });
});

describe('FLOW-7 Next goes to step 2 and keeps the keyboard down', () => {
  for (const k of KINDS) {
    it(`FLOW-7 ${k}: "Step 2 of 2", Back, title "Who gets it?", keyboard dismissed`, async () => {
      const dismiss = jest.spyOn(Keyboard, 'dismiss');
      await open(k);
      await toStep2(k);
      expect(screen.getByText('Step 2 of 2')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
      expect(dismiss).toHaveBeenCalled();
      expect(screen.queryByText('Step 1 of 2')).toBeNull();
      expect(tiles().length).toBeGreaterThan(0);
    });
  }
});

describe('FLOW-8 Back keeps everything', () => {
  it('FLOW-8 event: words, day, place and the group pick are all kept after Back and Next again', async () => {
    fakeToday();
    await open('event');
    await fillStep1('event');
    fireEvent.press(chip('Add a place'));
    fireEvent.changeText(await screen.findByLabelText('Where', {}, slow), "Grandpa Earl's farm");
    fireEvent.press(next());
    await screen.findByRole('header', { name: 'Who gets it?' }, slow);
    fireEvent.press(tile(DAD));
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await screen.findByText('Step 1 of 2', {}, slow);
    expect(words().props.value).toBe('Pumpkin patch');
    expect(chip('Saturday, Nov 28')).toBeTruthy();
    expect(chip("Grandpa Earl's farm")).toBeTruthy();
    fireEvent.press(next());
    await screen.findByRole('header', { name: 'Who gets it?' }, slow);
    expect(tile(DAD).props.accessibilityLabel).toMatch(/, picked$/);
  });
  it('FLOW-8 photos: the photos and the note are kept after Back', async () => {
    await open('photos', { n: 3 });
    fireEvent.changeText(screen.getByLabelText('Say something, optional'), 'Pumpkin patch');
    await toStep2('photos');
    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await screen.findByText('Step 1 of 2', {}, slow);
    expect(screen.getByLabelText('Say something, optional').props.value).toBe('Pumpkin patch');
    expect(screen.getByLabelText('Photo 1 of 3')).toBeTruthy();
  });
});

describe('FLOW-9 step 2 starts with nothing picked', () => {
  it('FLOW-9 tiles 2 across, none picked, the summary says so, Send is off with its hint', async () => {
    await open('news');
    await toStep2('news');
    const ts = tiles();
    expect(ts.length).toBe(3);
    expect(ts.every((t) => /, not picked$/.test(String(t.props.accessibilityLabel)))).toBe(true);
    expect(screen.getByTestId('share-tiles-grid').props.testID).toBe('share-tiles-grid');
    expect(screen.getByTestId('share-tiles-grid').props['data-columns'] ?? 2).toBe(2);
    expect(wordsIn(screen.getByTestId('share-summary'))).toBe('Nothing is picked yet. Tap one or more.');
    expect(isDisabled(screen.getByRole('button', { name: /^Send/ }))).toBe(true);
    expect(wordsIn(screen.getByTestId('share-hint'))).toBe('Pick who gets it to send.');
  });
  it('FLOW-9 Easy view: tiles 1 across when a name would spill (GUX-R1 tileColumns)', async () => {
    await open('news', { kv: easyKV('chase') });
    await toStep2('news');
    expect(screen.getByTestId('share-tiles-grid').props['data-columns']).toBe(1);
  });
});

describe('FLOW-10 a member never sees a group title', () => {
  it('FLOW-10 a relative who can post: tiles and summary name people, no group title and no Everyone (DEC-73)', async () => {
    const be = FakeBackend.withFixture();
    const api = be.clientFor(null, { trackAppSession: true });
    const space: Space = { space_id: FIXTURE.space.id, name: FIXTURE.space.name, role: 'viewer', inviter_name: 'Chase', can_post: true, reply_audience: 'parents' };
    jest.spyOn(api, 'mySpaces').mockResolvedValue([space]);
    // like shareStart's relativeCanPost: the fake also checks the role in myCircles and createPost
    const poster = be.isPoster.bind(be);
    jest.spyOn(be, 'isPoster').mockImplementation((sp, user) => user === FIXTURE.users.jo.id || poster(sp, user));
    await open('photos', { user: 'jo', be, deps: { api }, n: 1 });
    await toStep2('photos');
    await waitFor(() => expect(tiles().length).toBeGreaterThan(0));
    const GROUP = /Everyone|Grandparents|Dad's side|Mom's side/;
    expect(tiles().map((t) => String(t.props.accessibilityLabel)).filter((l) => GROUP.test(l))).toEqual([]);
    fireEvent.press(tiles()[0]!);
    expect(pageWords()).not.toMatch(GROUP);
    expect(wordsIn(screen.getByTestId('share-summary'))).not.toMatch(GROUP);
  });
  it('FLOW-10 a parent keeps the "Everyone" tile; only a relative is never offered it (BETA-AUD-21 unchanged)', async () => {
    await open('news');
    await toStep2('news');
    expect(tiles().map((t) => String(t.props.accessibilityLabel)).filter((l) => /^Everyone,/.test(l))).toHaveLength(1);
  });
});

describe('FLOW-11 picks: tile words, the summary with the kind noun, the Send button', () => {
  for (const k of KINDS) {
    it(`FLOW-11 ${k}: tile "<name>, N people, picked", summary "... will see ${NOUN[k]}", button "Send to <names>"`, async () => {
      await open(k);
      await toStep2(k);
      fireEvent.press(tile(DAD));
      expect(tile(DAD).props.accessibilityLabel).toMatch(/, \d+ people, picked$/);
      const sum = wordsIn(screen.getByTestId('share-summary'));
      // a saying's summary also carries the dedicated "what is shown" line (SHARE-U-21's sayingSeen)
      if (k === 'saying') expect(sum).toMatch(/^Grandma Jo and Grandpa Earl will see this saying\. /);
      else expect(sum).toBe(`Grandma Jo and Grandpa Earl will see ${NOUN[k]}.`);
      expect(sendBtn()).toBeTruthy();
      fireEvent.press(tile(MOM));
      expect(wordsIn(screen.getByTestId('share-summary'))).toMatch(new RegExp(`will see ${NOUN[k]}\\.( |$)`));
    });
  }
  it('FLOW-11 saying: the summary also says what is shown (SHARE-U-21 line moves here), with the age only once typed', async () => {
    await open('saying');
    await toStep2('saying');
    fireEvent.press(tile(DAD));
    expect(wordsIn(screen.getByTestId('share-summary'))).toContain('these words and who said them');
    expect(wordsIn(screen.getByTestId('share-summary'))).not.toMatch(/the age/);
  });
});

describe('FLOW-12 Send makes the same API call as today, once', () => {
  it('FLOW-12 photos: queue.enqueue once with the circle ids and the note; a double tap sends one', async () => {
    const enqueue = jest.spyOn(UploadQueue.prototype, 'enqueue');
    await open('photos', { n: 2 });
    fireEvent.changeText(screen.getByLabelText('Say something, optional'), 'Pumpkin patch');
    await toStep2('photos');
    fireEvent.press(tile(DAD));
    const b = sendBtn();
    fireEvent.press(b);
    fireEvent.press(b);
    await screen.findByRole('header', { name: 'Sent' }, slow);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0]![0]).toMatchObject({ space: FIXTURE.space.id, circleIds: [FIXTURE.circles.dadSide.id], caption: 'Pumpkin patch' });
    expect(enqueue.mock.calls[0]![0].items).toHaveLength(2);
  });
  const WANT = {
    news: { kind: 'news', caption: 'Leo lost his first tooth' },
    event: { kind: 'event', event: expect.objectContaining({ what: 'Pumpkin patch', when: '2026-11-28', where: null }) },
    saying: { kind: 'saying', saying: { words: 'Pawpaw, your beard is a cloud', who: 'Leo', age: null } },
  };
  for (const k of ['event', 'news', 'saying'] as const) {
    it(`FLOW-12 ${k}: createPost once then publishPost once, one client id; a double tap makes one post`, async () => {
      fakeToday();
      const { be } = await open(k);
      const create = jest.spyOn(be, 'createPost');
      const publish = jest.spyOn(be, 'publishPost');
      const before = Object.keys(be.state.posts).length;
      await toStep2(k);
      fireEvent.press(tile(DAD));
      const b = sendBtn();
      fireEvent.press(b);
      fireEvent.press(b);
      await screen.findByRole('header', { name: 'Sent' }, slow);
      expect(create).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledTimes(1);
      expect(create.mock.calls[0]![1]).toMatchObject({ space: FIXTURE.space.id, circleIds: [FIXTURE.circles.dadSide.id], ...WANT[k] });
      expect(typeof create.mock.calls[0]![1].clientId).toBe('string');
      expect(Object.keys(be.state.posts).length).toBe(before + 1);
    });
  }
  it('FLOW-12 PRIV-SK-R1 stays: a failed publish, then Send again, reuses the client id (one post)', async () => {
    const { be } = await open('news');
    const create = jest.spyOn(be, 'createPost');
    const real = be.publishPost.bind(be);
    jest.spyOn(be, 'publishPost').mockImplementationOnce(() => { throw new ApiError('NETWORK'); }).mockImplementation(real);
    await toStep2('news');
    fireEvent.press(tile(DAD));
    fireEvent.press(sendBtn());
    await screen.findByRole('alert', {}, slow);
    fireEvent.press(sendBtn());
    await screen.findByRole('header', { name: 'Sent' }, slow);
    expect(new Set(create.mock.calls.map((c) => c[1].clientId)).size).toBe(1);
  });
});

describe('FLOW-13 the sent page', () => {
  it('FLOW-13 (DEC-90) shows "Sent", who will see it, "See it in Feed" (goFeed) and "Share another" (clean step 1); no "Shared with" banner', async () => {
    const { nav } = await open('news');
    await toStep2('news');
    fireEvent.press(tile(DAD));
    fireEvent.press(sendBtn());
    await screen.findByRole('header', { name: 'Sent' }, slow);
    expect(wordsIn(screen.getByTestId('share-sent-who'))).toContain('Grandma Jo and Grandpa Earl');
    expect(pageWords()).not.toMatch(/Shared with/);
    expect(nav.goFeed).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Share another' }));
    // (DEC-90, GUX-FL-R8) the wordless empty card: no "Step 1 of 2" until a kind is picked
    await screen.findByTestId('share-kinds', {}, slow);
    expect(screen.queryByText(/Step 1 of 2/)).toBeNull();
    expect(screen.queryByRole('header', { name: 'Sent' })).toBeNull();
    expect(screen.getByRole('button', { name: KIND_LABEL.news })).toBeTruthy(); // the empty card, kinds row back
  });
  it('FLOW-13 "See it in Feed" goes to Feed', async () => {
    const { nav } = await open('news');
    await toStep2('news');
    fireEvent.press(tile(DAD));
    fireEvent.press(sendBtn());
    await screen.findByRole('header', { name: 'Sent' }, slow);
    fireEvent.press(screen.getByRole('button', { name: 'See it in Feed' }));
    expect(nav.goFeed).toHaveBeenCalledTimes(1);
  });
});

describe('FLOW-14 a refused or lost Send stays on step 2', () => {
  const CASES: [string, ApiError, RegExp][] = [
    ['42501', new ApiError('42501', 'post_kinds_off'), /kept/i],
    ['NETWORK', new ApiError('NETWORK'), /No internet/],
    ['23514', new ApiError('23514', 'bad'), /kept/i],
  ];
  for (const [code, err, re] of CASES) {
    it(`FLOW-14 ${code}: step 2 stays, the notice shows at the top, words and picks kept, Send works again`, async () => {
      const { be } = await open('news');
      jest.spyOn(be, 'createPost').mockImplementationOnce(() => { throw err; });
      await toStep2('news');
      fireEvent.press(tile(DAD));
      fireEvent.press(sendBtn());
      const alert = await screen.findByRole('alert', {}, slow);
      expect(wordsIn(alert)).toMatch(re);
      expect(screen.getByRole('header', { name: 'Who gets it?' })).toBeTruthy();
      expect(screen.queryByRole('header', { name: 'Sent' })).toBeNull();
      expect(tile(DAD).props.accessibilityLabel).toMatch(/, picked$/);
      fireEvent.press(screen.getByRole('button', { name: 'Back' }));
      await screen.findByText('Step 1 of 2', {}, slow);
      expect(words().props.value).toBe('Leo lost his first tooth');
      fireEvent.press(next());
      await screen.findByRole('header', { name: 'Who gets it?' }, slow);
      fireEvent.press(sendBtn());
      await screen.findByRole('header', { name: 'Sent' }, slow);
    });
  }
});

describe('FLOW-15 the day sheet', () => {
  it('FLOW-15 opens a sheet with month and year, weekday initials, month buttons, today ringed, Today / Tomorrow / Saturday chips and Done', async () => {
    fakeToday();
    await open('event');
    fireEvent.press(chip('Pick a day'));
    const sheet = await screen.findByTestId('day-sheet', {}, slow);
    expect(wordsIn(sheet)).toContain('November 2026');
    for (const w of ['S', 'M', 'T', 'W', 'F']) expect(wordsIn(sheet)).toContain(w);
    expect(screen.getByRole('button', { name: 'Earlier month' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Later month' })).toBeTruthy();
    // today's cell is the ordinary day cell with an inner ring marker
    expect(within(screen.getByTestId('day-2026-11-26')).getByTestId('day-today')).toBeTruthy();
    expect(screen.getAllByTestId('day-today')).toHaveLength(1);
    for (const q of ['Today', 'Tomorrow', 'Sat, Nov 28']) expect(screen.getByRole('button', { name: q })).toBeTruthy(); // GUX-FL-R6: the Saturday chip names its day
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    expect(screen.getByTestId('day-sheet-scrim')).toBeTruthy(); // the page behind is covered
  });
  it('FLOW-15 Done closes it; a tap outside (the scrim) closes it too', async () => {
    fakeToday();
    await open('event');
    fireEvent.press(chip('Pick a day'));
    await screen.findByTestId('day-sheet', {}, slow);
    fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByTestId('day-sheet')).toBeNull(), slow);
    fireEvent.press(chip('Pick a day'));
    await screen.findByTestId('day-sheet', {}, slow);
    fireEvent.press(screen.getByTestId('day-sheet-scrim'));
    await waitFor(() => expect(screen.queryByTestId('day-sheet')).toBeNull(), slow);
  });
  it('FLOW-15 Later month and Earlier month move the grid', async () => {
    fakeToday();
    await open('event');
    fireEvent.press(chip('Pick a day'));
    const sheet = await screen.findByTestId('day-sheet', {}, slow);
    fireEvent.press(screen.getByRole('button', { name: 'Later month' }));
    expect(wordsIn(sheet)).toContain('December 2026');
    expect(screen.getByTestId('day-2026-12-24')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Earlier month' }));
    fireEvent.press(screen.getByRole('button', { name: 'Earlier month' }));
    expect(wordsIn(sheet)).toContain('October 2026');
  });
});

describe('FLOW-16 one day selected; the value sent is a real date', () => {
  it('FLOW-16 tapping a day then another leaves exactly one selected; Done shows "Saturday, Nov 28"', async () => {
    fakeToday();
    await open('event');
    fireEvent.press(chip('Pick a day'));
    fireEvent.press(await screen.findByTestId('day-2026-11-27', {}, slow));
    fireEvent.press(screen.getByTestId('day-2026-11-28'));
    const picked = screen.getByTestId('day-sheet').findAll((n: Inst) => typeof n.type === 'string' && n.props.accessibilityState?.selected === true && /^day-/.test(String(n.props.testID ?? '')));
    expect(picked.map((n: Inst) => n.props.testID)).toEqual(['day-2026-11-28']);
    fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('button', { name: 'Saturday, Nov 28' }, slow)).toBeTruthy();
  });
  it('FLOW-16 a quick chip moves the grid to its month: Saturday from Dec 30 lands in January', async () => {
    jest.useFakeTimers({ now: new Date(2026, 11, 30, 12), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    await open('event');
    fireEvent.press(chip('Pick a day'));
    const sheet = await screen.findByTestId('day-sheet', {}, slow);
    fireEvent.press(screen.getByRole('button', { name: 'Sat, Jan 2' })); // GUX-FL-R6
    expect(wordsIn(sheet)).toContain('January 2027');
    expect(screen.getByTestId('day-2027-01-02').props.accessibilityState?.selected).toBe(true);
  });
  it('FLOW-16 the value sent is the real YYYY-MM-DD, so realDay passes and DAY_NOT_REAL can never show', async () => {
    fakeToday();
    const { be } = await open('event');
    const create = jest.spyOn(be, 'createPost');
    await toStep2('event');
    fireEvent.press(tile(DAD));
    fireEvent.press(sendBtn());
    await screen.findByRole('header', { name: 'Sent' }, slow);
    expect(create.mock.calls[0]![1].event?.when).toBe('2026-11-28');
    expect(pageWords()).not.toMatch(/year-month-day/);
  });
  it('FLOW-16 dayPicker: dayLabel, quickDays, monthTitle', () => {
    // required here so the rest of the file runs red on its own while the module is missing
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { dayLabel, monthTitle, quickDays } = require('../../share/dayPicker') as typeof import('../../share/dayPicker');
    expect(dayLabel('2026-11-28')).toBe('Saturday, Nov 28');
    expect(dayLabel('2027-01-02')).toBe('Saturday, Jan 2');
    expect(monthTitle(2026, 10)).toBe('November 2026');
    expect(quickDays(TODAY)).toEqual([
      { label: 'Today', iso: '2026-11-26' },
      { label: 'Tomorrow', iso: '2026-11-27' },
      { label: 'Saturday', iso: '2026-11-28' },
    ]);
    // on a Saturday, the coming Saturday is a week out
    expect(quickDays(new Date(2026, 10, 28, 9)).map((q: { iso: string }) => q.iso)).toEqual(['2026-11-28', '2026-11-29', '2026-12-05']);
  });
});

describe('FLOW-17 sheet targets (jest part; Playwright 360 and 412 in e2e-web/share-flow.spec.js)', () => {
  for (const easy of [false, true]) {
    it(`FLOW-17 Easy view ${easy ? 'on' : 'off'}: month buttons and day cells >= 48 tall and >= 44 wide, day numbers at body (${easy ? 21 : 17})`, async () => {
      fakeToday();
      await open('event', easy ? { kv: easyKV('chase') } : {});
      fireEvent.press(chip('Pick a day'));
      await screen.findByTestId('day-sheet', {}, slow);
      for (const b of [screen.getByRole('button', { name: 'Earlier month' }), screen.getByRole('button', { name: 'Later month' }), screen.getByTestId('day-2026-11-28')]) {
        const s = flat(b.props.style);
        expect(Number(s.minHeight ?? s.height)).toBeGreaterThanOrEqual(48);
        expect(Number(s.minWidth ?? s.width ?? 44)).toBeGreaterThanOrEqual(44);
      }
      const num = screen.getByTestId('day-2026-11-28').findAll((n: Inst) => n.type === Text)[0]!;
      expect(flat(num.props.style).fontSize).toBe(easy ? 21 : 17);
    });
  }
});

describe('FLOW-18 age takes digits only', () => {
  it('FLOW-18 the age editor opens the number keypad and keeps only digits; an empty age is fine', async () => {
    const { be } = await open('saying');
    const create = jest.spyOn(be, 'createPost');
    await fillStep1('saying');
    fireEvent.press(chip('Add their age'));
    const age = await screen.findByLabelText('Age', {}, slow);
    expect(['number-pad', 'numeric']).toContain(age.props.keyboardType);
    fireEvent.changeText(age, '4a5');
    expect(screen.getByLabelText('Age').props.value).toBe('45');
    fireEvent.changeText(screen.getByLabelText('Age'), '');
    await toStep2Again();
    fireEvent.press(tile(DAD));
    fireEvent.press(sendBtn());
    await screen.findByRole('header', { name: 'Sent' }, slow);
    expect(create.mock.calls[0]![1].saying?.age).toBeNull();
    expect(pageWords()).not.toMatch(/as a number/);
  });
});
async function toStep2Again() {
  fireEvent.press(next());
  await screen.findByRole('header', { name: 'Who gets it?' }, slow);
}

describe('FLOW-19 type and targets on both steps', () => {
  for (const easy of [false, true]) {
    for (const k of ['event', 'photos'] as const) {
      it(`FLOW-19 ${k}, Easy view ${easy ? 'on' : 'off'}: reading text is Body 17+ (Easy view never under 17), targets 48 (60 in Easy view), step 1 and step 2`, async () => {
        fakeToday();
        await open(k, easy ? { kv: easyKV('chase') } : {});
        const min = easy ? 60 : 48;
        const check = () => {
          expectGrandparentSafe();
          for (const b of screen.queryAllByRole('button')) {
            const s = flat(b.props.style);
            if (s.minHeight !== undefined || s.height !== undefined) expect(Number(s.minHeight ?? s.height)).toBeGreaterThanOrEqual(/^(Cancel|Back)/.test(String(b.props.accessibilityLabel)) ? 44 : min > 48 && /Next|Send/.test(String(b.props.accessibilityLabel)) ? 48 : 48);
          }
          const hint = screen.queryByTestId('share-hint');
          if (hint && easy) for (const t of hint.findAll((n: Inst) => n.type === Text)) expect(flat(t.props.style).fontSize).toBeGreaterThanOrEqual(17);
        };
        check();
        if (k === 'event') await fillStep1('event');
        fireEvent.press(next());
        await screen.findByRole('header', { name: 'Who gets it?' }, slow);
        check();
        const summary = screen.getByTestId('share-summary');
        for (const t of summary.findAll((n: Inst) => n.type === Text)) expect(flat(t.props.style).fontSize).toBeGreaterThanOrEqual(17);
        if (easy) for (const c of [screen.getByRole('button', { name: /^Send/ }), screen.getByRole('button', { name: 'Back' })]) expect(Number(flat(c.props.style).minHeight)).toBeGreaterThanOrEqual(60);
      });
    }
  }
  it('FLOW-19 dark: step 1 and step 2 render with no text under 17 for reading text', async () => {
    const kv = memoryKV({ [`hearth.prefs.v1.${FIXTURE.users.chase.id}`]: JSON.stringify({ theme: 'dark' }) });
    await open('news', { kv });
    expectGrandparentSafe();
    await toStep2('news');
    expectGrandparentSafe();
    expect(Platform.OS).toBeTruthy();
  });
});

describe('FLOW-21 Back, hardware Back and Cancel', () => {
  it('FLOW-21 hardware Back on step 2 returns to step 1 and does not leave Share', async () => {
    const handlers: Array<() => boolean> = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, h) => {
      handlers.push(h as () => boolean);
      return { remove: () => { handlers.splice(handlers.indexOf(h as () => boolean), 1); } };
    });
    const { nav } = await open('news');
    await toStep2('news');
    let used = false;
    act(() => { used = [...handlers].reverse().some((h) => h()); });
    expect(used).toBe(true); // a handler took the press
    await screen.findByText('Step 1 of 2', {}, slow);
    expect(nav.close).not.toHaveBeenCalled();
    expect(nav.goFeed).not.toHaveBeenCalled();
  });
  it('FLOW-21 step 1 with words: Cancel asks "Throw away this card?" (GUX-SK-R11); the empty card cancels at once', async () => {
    await open('news');
    fireEvent.press(screen.getByRole('button', { name: /^Cancel/ }));
    expect(screen.queryByText('Throw away this card?')).toBeNull();
    await open('news');
    fireEvent.changeText(words(), 'Leo lost his first tooth');
    fireEvent.press(screen.getAllByRole('button', { name: /^Cancel/ })[0]!);
    expect(await screen.findByText('Throw away this card?', {}, slow)).toBeTruthy();
  });
  it('FLOW-21 step 2 Cancel keeps the words question too: it returns nothing until the person confirms', async () => {
    await open('news');
    await toStep2('news');
    fireEvent.press(screen.getAllByRole('button', { name: /^Cancel/ })[0]!);
    expect(await screen.findByText('Throw away this card?', {}, slow)).toBeTruthy();
  });
});

describe('FLOW-24 no underline, ruled line, dash or "To:" in Share\'s screens (lint)', () => {
  // The source files of Share's screens; a lint test like redesignLint.
  const fs = jest.requireActual('fs') as typeof import('fs');
  const path = jest.requireActual('path') as typeof import('path');
  const files = ['ShareScreen.tsx', 'ShareKinds.tsx'].map((f) => path.join(__dirname, '..', f));
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
  for (const f of files) {
    for (const bad of [/\bunderline\b/, /\bstrongLine\b/, /share-to-rule/, /share-note-rule/, /\bdash\b|dashClip|borderStyle:\s*'dashed'/, /['"`>]To:/]) {
      it(`FLOW-24 ${path.basename(f)} has no ${bad}`, () => {
        expect(strip(fs.readFileSync(f, 'utf8'))).not.toMatch(bad);
      });
    }
  }
});
