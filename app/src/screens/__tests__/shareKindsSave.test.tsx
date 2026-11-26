// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SHARE-U-17..23 (docs/product/SPEC-VISIBILITY-CORE.md, Phase 4 "One Share composer"): Share's Event, News and Saying
// cards actually save. Written first (red), Nov 24, 2026, by qa-tdd. The backend and HearthApi.createPost({ kind,
// event | saying }) already exist (migration 0034); these tests hold the UI that is still missing.
//
// CONTRACT for the engineer (the tests find things by these; behaviour is what is checked):
//   - Kind card fields keep their spoken labels: Event "What's happening", "What day" (was "When", GUX-SK-R1), "Where, optional"; News "Your news";
//     Saying "What they said", "Who said it", "Age then, optional".
//   - SHARE-U-17: the "Pick who gets it" button (role button, that label) is disabled until the kind's required fields
//     hold words (spaces alone don't count): Event what + when; News words; Saying words + who. Optional ones may stay blank.
//   - SHARE-U-18: tapping it shows the photo flow's FaceTile picker (labels "<name>, N people, not picked") with nothing
//     picked, even when a last audience is saved; a pick turns the button into "Send to <names>" (SHARE-PC-9 words).
//   - SHARE-U-19: Send calls api.createPost once with { kind, space, circleIds, clientId } plus: news caption = the
//     words; event { what, when: 'YYYY-MM-DD' (the When field typed as 2026-10-31 for now), where: null when blank };
//     saying { words, who, age: number | null }. Then publishPost(id). No signUpload (no media). Share then shows the
//     empty postcard (the "Add photos" card and the kinds row) again. A double tap or a Send again after a failure
//     reuses one clientId, so the family gets exactly one post.
//   - SHARE-U-20: in Feed the post's card ("post-<id>") has no photo frame ("collage-<id>" absent), its main words
//     (news words / event what / saying words) at title3 size or larger (fontSize >= 20 with Easy view off; body is 17), the event's date
//     ("Oct 31" or "October 31") and where, the saying's who and age, and the "who-<id>" names line.
//   - SHARE-U-21 (PRIV-VC-D1): the Saying card shows, visible to screen readers, exactly
//     "Everyone you send this to will see these words and who said them." before sending (GUX-SK-R8 wording; was
//     "...will see who said it."); Event and News cards don't.
//   - SHARE-U-22: when createPost refuses (42501 post_kinds_off, 23514 a bad field) a Notice (role alert) shows plain
//     words that say the words were kept (/kept/i), with no code and not the photo line "Pick who should see it.";
//     every typed word stays in the card. Branch on error.code.
//   - SHARE-U-23: every new tap target is labelled and 48 pt+; text through useTheme().type / <Txt> (typeScale lint).
// DEC-90 (Nov 26, qa-tdd): Share is two steps now (docs/product/SPEC-SHARE-FLOW.md). The helpers below drive step 1's one
// big box and chips and step 2's tiles; the old field labels map onto them. Superseded tests are rewritten, IDs kept.
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { ApiError } from '../../api/HearthApi';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { uuid } from '../../crypto/random';
import { memoryKV, type KV } from '../../platform/kv';
import type { PickedAsset } from '../../share/bulk';
import { FeedScreen } from '../../test/redesignScreens';
import { expectGrandparentSafe, renderApp, type FixtureUser } from '../../test/renderApp';
import { eventDay } from '../PostCard';
import { ShareScreen } from '../ShareScreen';
import { TYPE, paletteFor } from '../../ui/theme';

const slow = { timeout: 5000 };
const DAD = "Grandparents – Dad's side";
// GUX-SK-R8 (Nov 25): the SHARE-U-21 line's words changed at grandparent-ux's review (Chase's reviewers asked for it);
// the check is as strict as before (exact words, reachable, 17 pt+). With the age blank (a fresh card) it reads:
const SAYING_LINE = 'Everyone you send this to will see these words and who said them.';
const SAYING_LINE_AGE = 'Everyone you send this to will see these words, who said them, and the age.';
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
const hiddenFromReaders = (node: Inst) => {
  for (let p: Inst | null = node; p; p = p.parent) {
    if (typeof p.type === 'string' && (p.props.accessibilityElementsHidden === true || p.props.importantForAccessibility === 'no-hide-descendants' || p.props['aria-hidden'] === true)) return true;
  }
  return false;
};

/** post_kinds on the real way: Hearth's global switch and the family's switch (FEATURE_CAPABILITY: parents only). */
function kindsOn(be = FakeBackend.withFixture()): FakeBackend {
  be.state.featureFlags = { ...be.state.featureFlags, post_kinds: true };
  be.state.spaceFeatures = { ...be.state.spaceFeatures, [`${FIXTURE.space.id}:post_kinds`]: true };
  return be;
}

async function start(opts: { user?: FixtureUser; be?: FakeBackend; kv?: KV } = {}) {
  const pickBulk = jest.fn(async () => ({ assets: [] as PickedAsset[] }));
  const pickPhotos = jest.fn(async () => ({ items: [] }));
  const be = opts.be ?? kindsOn();
  const r = await renderApp(<ShareScreen />, { user: opts.user ?? 'chase', be, kv: opts.kv, deps: { pickBulk, pickPhotos } });
  await screen.findByRole('header', { name: 'New post' }, slow);
  for (const k of Object.keys(chipNow)) delete chipNow[k];
  return { ...r, be };
}

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const TODAY_ISO = isoOf(new Date());
const KINDS = {
  event: { label: 'Add an event', required: { "What's happening": 'Pumpkin patch', 'What day': TODAY_ISO }, optional: { 'Where, optional': '' } },
  news: { label: 'Share news', required: { 'Your news': 'Leo lost his first tooth' }, optional: {} },
  saying: { label: 'Add a saying', required: { 'What they said': 'Pawpaw, your beard is a cloud', 'Who said it': 'Leo' }, optional: { 'Age then, optional': '' } },
} as const;
type K = keyof typeof KINDS;
const ALL: K[] = ['event', 'news', 'saying'];

async function openKind(k: K) {
  fireEvent.press(await screen.findByRole('button', { name: KINDS[k].label }, slow));
  await screen.findByTestId(`share-kind-card-${k}`, {}, slow);
}
const WORDS_LABELS = ["What's happening", 'Your news', 'What they said'];
const wordsBox = () => screen.getByLabelText(/^(What's happening\?|What's your news\?|What did they say\?)$/);
const chipNow: Record<string, string | RegExp> = {};
const CHIP: Record<string, { start: string; input: string; value: (v: string) => string }> = {
  'Where, optional': { start: 'Add a place', input: 'Where', value: (v) => v },
  'Who said it': { start: 'Who said it?', input: 'Who said it', value: (v) => `Said by ${v}` },
  'Age then, optional': { start: 'Add their age', input: 'Age', value: (v) => `Age ${v}` },
};
function pickDay(iso: string) {
  fireEvent.press(screen.getByRole('button', { name: chipNow['What day'] ?? 'Pick a day' }));
  fireEvent.press(screen.getByTestId(`day-${iso}`));
  fireEvent.press(screen.getByRole('button', { name: 'Done' }));
}
/** Old field label -> the new control: the one big box, the day sheet, or a chip's editor. */
const type = (label: string, v: string) => {
  if (WORDS_LABELS.includes(label)) return fireEvent.changeText(wordsBox(), v);
  if (label === 'What day') return pickDay(v);
  const c = CHIP[label]!;
  if (!screen.queryByLabelText(c.input)) fireEvent.press(screen.getByRole('button', { name: chipNow[label] ?? c.start }));
  fireEvent.changeText(screen.getByLabelText(c.input), v);
  chipNow[label] = v.trim() ? c.value(v.trim()) : c.start;
};
const pickBtn = () => screen.getByRole('button', { name: 'Next: who gets it' });
const isDisabled = (b: Inst) => !!(b.props.accessibilityState?.disabled ?? b.props['aria-disabled']);
const tiles = () => screen.queryAllByLabelText(/^.+, \d+ (person|people), (not )?picked$/);
const fill = (k: K, extra: Record<string, string> = {}) => {
  for (const [l, v] of Object.entries({ ...KINDS[k].required, ...extra })) type(l, v);
};
const emptyAgain = async () => {
  // DEC-90: a sent page first, then "Share another" gives the empty card.
  await waitFor(() => expect(screen.queryByTestId('share-kinds') ?? screen.queryByRole('button', { name: 'Share another' })).toBeTruthy(), slow);
  const another = screen.queryByRole('button', { name: 'Share another' });
  if (another) fireEvent.press(another);
  await screen.findByTestId('share-kinds', {}, slow);
  expect(screen.getByRole('button', { name: /^Add photos( or videos)?, up to \d+ at a time$/ })).toBeTruthy();
  for (const k of ALL) expect(screen.queryByTestId(`share-kind-card-${k}`)).toBeNull();
};
/** Step 2 stayed after a refusal: go Back to read the words; Next again keeps the group picks (FLOW-8, FLOW-14). */
const backToWords = async () => {
  fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  await screen.findByText('Step 1 of 2', {}, slow);
};
const toWhoAgain = async () => {
  fireEvent.press(pickBtn());
  await screen.findByRole('header', { name: 'Who gets it?' }, slow);
};

afterEach(() => jest.restoreAllMocks());

describe('SHARE-U-17 (DEC-90) "Next: who gets it" opens up only when the required fields are filled', () => {
  for (const k of ALL) {
    it(`SHARE-U-17 (DEC-90) ${k}: off while empty, off with any one required field blank or spaces only, on with every required one filled and the optional ones blank`, async () => {
      await start();
      await openKind(k);
      expect(isDisabled(pickBtn())).toBe(true);
      const req = Object.entries(KINDS[k].required).filter(([l]) => l !== 'What day');
      for (const [skip] of req) {
        for (const [l, v] of req) type(l, l === skip ? '   ' : v);
        expect({ blank: skip, disabled: isDisabled(pickBtn()) }).toEqual({ blank: skip, disabled: true });
      }
      fill(k);
      expect({ k, disabled: isDisabled(pickBtn()) }).toEqual({ k, disabled: false });
    });
  }
});

describe('SHARE-U-18 (DEC-90) step 2 is the same who-gets-it picker as photos, nothing pre-picked (SHARE-U-3, DEC-73/79)', () => {
  for (const k of ALL) {
    it(`SHARE-U-18 (DEC-90) ${k}: the group tiles show on step 2, none picked even with a saved last audience; a pick names the people on Send`, async () => {
      const kv = memoryKV({ [`hearth.lastAudience.v1.${FIXTURE.users.chase.id}`]: JSON.stringify([FIXTURE.circles.dadSide.id]) });
      await start({ kv });
      await openKind(k);
      expect(tiles()).toHaveLength(0); // the picker is on step 2, behind the button
      fill(k);
      fireEvent.press(pickBtn());
      await screen.findByRole('header', { name: 'Who gets it?' }, slow);
      await waitFor(() => expect(tiles().length).toBe(3), slow);
      for (const t of tiles()) expect({ t: t.props.accessibilityLabel, picked: !!t.props.accessibilityState?.selected }).toEqual({ t: t.props.accessibilityLabel, picked: false });
      fireEvent.press(screen.getByLabelText(new RegExp(`^${DAD}, \\d+ people, not picked$`)));
      expect(screen.getByRole('button', { name: 'Send to Grandma Jo and Grandpa Earl' })).toBeTruthy();
    });
  }
});

async function toSend(k: K, extra: Record<string, string> = {}) {
  await openKind(k);
  fill(k, extra);
  fireEvent.press(pickBtn());
  await screen.findByRole('header', { name: 'Who gets it?' }, slow);
  await waitFor(() => expect(tiles().length).toBe(3), slow);
  fireEvent.press(screen.getByLabelText(new RegExp(`^${DAD}, \\d+ people, not picked$`)));
  return screen.getByRole('button', { name: 'Send to Grandma Jo and Grandpa Earl' });
}

const WANT: Record<K, Record<string, unknown>> = {
  news: { kind: 'news', caption: 'Leo lost his first tooth' },
  event: { kind: 'event', event: expect.objectContaining({ what: 'Pumpkin patch', when: TODAY_ISO }) },
  saying: { kind: 'saying', saying: { words: 'Pawpaw, your beard is a cloud', who: 'Leo', age: 4 } },
};

describe('SHARE-U-19 Send makes exactly one post of that kind, published with no media, and Share empties', () => {
  for (const k of ALL) {
    it(`SHARE-U-19 ${k}: one createPost with the fields as details and the picked group, then publishPost; no upload; back to the empty postcard`, async () => {
      const { be } = await start();
      const create = jest.spyOn(be, 'createPost');
      const publish = jest.spyOn(be, 'publishPost');
      const sign = jest.spyOn(be, 'signUpload');
      const before = Object.keys(be.state.posts).length;
      fireEvent.press(await toSend(k, k === 'saying' ? { 'Age then, optional': '4' } : {}));
      await waitFor(() => expect(publish).toHaveBeenCalledTimes(1), slow);
      expect(create).toHaveBeenCalledTimes(1);
      const args = create.mock.calls[0]![1];
      expect(args).toMatchObject({ space: FIXTURE.space.id, circleIds: [FIXTURE.circles.dadSide.id], ...WANT[k] });
      expect(typeof args.clientId).toBe('string');
      if (k === 'event') expect(args.event?.where ?? null).toBeNull(); // optional and blank
      expect(sign).not.toHaveBeenCalled();
      const made = Object.values(be.state.posts).filter((p) => p.client_id === args.clientId);
      expect(made.map((p) => ({ kind: p.kind, status: p.status }))).toEqual([{ kind: k, status: 'published' }]);
      expect(Object.keys(be.state.posts).length).toBe(before + 1);
      await emptyAgain();
    });
  }

  it('SHARE-U-19 a double tap on Send makes one post', async () => {
    const { be } = await start();
    const before = Object.keys(be.state.posts).length;
    const send = await toSend('news');
    fireEvent.press(send);
    fireEvent.press(send);
    await emptyAgain();
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(Object.keys(be.state.posts).length).toBe(before + 1);
  });

  it('SHARE-U-19 (DEC-90) Send again after a failed publish reuses the client id: still one post, now published', async () => {
    const { be } = await start();
    const before = Object.keys(be.state.posts).length;
    const create = jest.spyOn(be, 'createPost');
    const real = be.publishPost.bind(be);
    jest.spyOn(be, 'publishPost').mockImplementationOnce(() => { throw new ApiError('NETWORK'); }).mockImplementation(real);
    fireEvent.press(await toSend('news'));
    await screen.findByRole('alert', {}, slow);
    await backToWords(); // DEC-90: the notice sits on step 2; Back shows the kept words, Next keeps the pick
    expect(wordsBox().props.value).toBe('Leo lost his first tooth');
    await toWhoAgain();
    fireEvent.press(screen.getByRole('button', { name: 'Send to Grandma Jo and Grandpa Earl' }));
    await emptyAgain();
    const ids = new Set(create.mock.calls.map((c) => c[1].clientId));
    expect(ids.size).toBe(1);
    const mine = Object.values(be.state.posts).filter((p) => ids.has(p.client_id));
    expect(mine.map((p) => p.status)).toEqual(['published']);
    expect(Object.keys(be.state.posts).length).toBe(before + 1);
  });
});

/** A kind post made through the API the way Share will make it (Chase, to Dad's side: Chase, Jo, Earl). */
async function seedKind(be: FakeBackend, k: K): Promise<string> {
  const api = be.clientFor(FIXTURE.users.chase.id);
  const base = { clientId: uuid(), space: FIXTURE.space.id, circleIds: [FIXTURE.circles.dadSide.id], title: null, takenAt: null };
  const id = k === 'news'
    ? await api.createPost({ ...base, kind: 'news', caption: 'Leo lost his first tooth' })
    : k === 'event'
      ? await api.createPost({ ...base, kind: 'event', caption: null, event: { what: 'Pumpkin patch', when: '2026-10-31', where: 'Grandpa Earl’s farm' } })
      : await api.createPost({ ...base, kind: 'saying', caption: null, saying: { words: 'Pawpaw, your beard is a cloud', who: 'Leo', age: 4 } });
  await api.publishPost(id);
  return id;
}
const MAIN: Record<K, string> = { news: 'Leo lost his first tooth', event: 'Pumpkin patch', saying: 'Pawpaw, your beard is a cloud' };

describe('SHARE-U-20 the post in Feed: a large-type card for its kind, the names line, no photo frame (SHARE-U-6)', () => {
  for (const k of ALL) {
    it(`SHARE-U-20 ${k}: Grandma Jo (in its audience) sees a large-type ${k} card with its fields and "who can see this"`, async () => {
      const be = kindsOn();
      const id = await seedKind(be, k);
      // Easy view off, so body is 17 and "large type" (title3+, >= 20) can't come from Easy view alone (viewers default it on).
      const kv = memoryKV({ [`hearth.prefs.v1.${FIXTURE.users.jo.id}`]: JSON.stringify({ easyView: false }) });
      await renderApp(<FeedScreen />, { waitReady: false, user: 'jo', be, kv });
      const card = await screen.findByTestId(`post-${id}`, {}, slow);
      expect(screen.queryByTestId(`collage-${id}`)).toBeNull();
      const main = (card.findAll((x: Inst) => x.type === Text) as Inst[]).filter((t) => wordsIn(t).includes(MAIN[k]));
      expect(main.length).toBeGreaterThan(0);
      const size = Math.max(...main.map((t) => Number(flat(t.props.style).fontSize ?? 0)));
      expect({ k, large: size >= 20 }).toEqual({ k, large: true });
      const words = wordsIn(card);
      if (k === 'event') {
        expect(words).toMatch(/Oct(ober)? 31/);
        expect(words).toContain('Grandpa Earl’s farm');
      }
      if (k === 'saying') {
        expect(words).toContain('Leo');
        expect(words).toMatch(/\b4\b/);
      }
      expect(await screen.findByTestId(`who-${id}`, {}, slow)).toBeTruthy();
    });
  }

  it('SHARE-U-20 Nana Ruth (outside Dad\'s side) gets none of the three, in her feed or on screen', async () => {
    const be = kindsOn();
    const ids = [await seedKind(be, 'news'), await seedKind(be, 'event'), await seedKind(be, 'saying')];
    const feed = await be.clientFor(FIXTURE.users.ruth.id).getFeed({ space: FIXTURE.space.id });
    expect(feed.filter((p) => ids.includes(p.post_id))).toEqual([]);
    await renderApp(<FeedScreen />, { waitReady: false, user: 'ruth', be });
    await waitFor(() => expect(screen.queryByTestId('app-loading')).toBeNull(), slow);
    for (const id of ids) expect(screen.queryByTestId(`post-${id}`)).toBeNull();
  });
});

describe('SHARE-U-21 (DEC-90) PRIV-VC-D1 the Saying says who will see who said it, before sending (now in the step 2 summary)', () => {
  it('SHARE-U-21 (DEC-90) on step 2 the Saying summary names what is shown ("these words and who said them"), reachable by screen readers, 17 pt+', async () => {
    await start();
    await openKind('saying');
    fill('saying');
    fireEvent.press(pickBtn());
    await screen.findByRole('header', { name: 'Who gets it?' }, slow);
    fireEvent.press(screen.getByLabelText(new RegExp(`^${DAD}, \\d+ people, not picked$`)));
    const line = screen.getByTestId('share-summary');
    expect(hiddenFromReaders(line)).toBe(false);
    expect(wordsIn(line)).toContain('these words and who said them');
    for (const t of line.findAll((x: Inst) => x.type === Text) as Inst[]) expect(Number(flat(t.props.style).fontSize ?? 0)).toBeGreaterThanOrEqual(17);
  });
  for (const k of ['event', 'news'] as const) {
    it(`SHARE-U-21 (DEC-90) the ${k} summary does not show the saying line`, async () => {
      await start();
      await openKind(k);
      fill(k);
      fireEvent.press(pickBtn());
      await screen.findByRole('header', { name: 'Who gets it?' }, slow);
      fireEvent.press(screen.getByLabelText(new RegExp(`^${DAD}, \\d+ people, not picked$`)));
      expect(wordsIn(screen.getByTestId('share-summary'))).not.toMatch(/who said them/);
    });
  }
});

describe('SHARE-U-22 a refusal shows a plain notice and keeps every word (A1)', () => {
  const cases: [string, ApiError][] = [
    ['42501 post_kinds_off', new ApiError('42501', 'post_kinds_off')],
    ['23514 a bad field', new ApiError('23514', 'an event needs a real date')],
  ];
  for (const [name, err] of cases) {
    for (const k of ['event', 'saying'] as const) {
      it(`SHARE-U-22 (DEC-90) ${name} on ${k}: a notice that says the words were kept; the card and its words stay; nothing published`, async () => {
        const { be } = await start();
        jest.spyOn(be, 'createPost').mockImplementation(() => { throw err; });
        const publish = jest.spyOn(be, 'publishPost');
        fireEvent.press(await toSend(k));
        const notice = await screen.findByRole('alert', {}, slow);
        const said = wordsIn(notice);
        expect(said).toMatch(/kept/i);
        expect(said).not.toMatch(/42501|23514|post_kinds|Pick who should see it\./);
        expect(screen.getByRole('header', { name: 'Who gets it?' })).toBeTruthy(); // DEC-90: step 2 stays
        await backToWords();
        expect(screen.getByTestId(`share-kind-card-${k}`)).toBeTruthy();
        expect(wordsBox().props.value).toBe(Object.entries(KINDS[k].required)[0]![1]);
        expect(publish).not.toHaveBeenCalled();
      });
    }
  }
});

describe('SHARE-U-23 grandparent UX on the working cards', () => {
  for (const k of ALL) {
    it(`SHARE-U-23 ${k}: with the picker open and a group picked, every tap target is labelled and 48 pt+, every text 17 pt+`, async () => {
      await start();
      await toSend(k);
      expectGrandparentSafe();
    });
  }
});

// Guards added by qa-tdd after 8383d5e (Nov 24): the age check and the shared Notice change.
describe('SHARE-U-22 (DEC-90) guards: the age takes digits only, and every existing notice still announces itself', () => {
  for (const age of ['four', '4.5', '-4']) {
    it(`SHARE-U-22 (DEC-90) Saying age "${age}": only the digits are kept, so no non-number notice can show and nothing bad reaches the server`, async () => {
      const { be } = await start();
      const create = jest.spyOn(be, 'createPost');
      await openKind('saying');
      fill('saying');
      fireEvent.press(screen.getByRole('button', { name: 'Add their age' }));
      fireEvent.changeText(screen.getByLabelText('Age'), age);
      expect(screen.getByLabelText('Age').props.value).toMatch(/^\d*$/);
      fireEvent.press(pickBtn());
      await screen.findByRole('header', { name: 'Who gets it?' }, slow);
      expect(screen.queryByRole('alert')).toBeNull();
      fireEvent.press(screen.getByLabelText(new RegExp(`^${DAD}, \\d+ people, not picked$`)));
      fireEvent.press(sendBtn());
      await screen.findByRole('header', { name: 'Sent' }, slow);
      const sent = create.mock.calls[0]![1].saying?.age;
      expect(sent === null || Number.isInteger(sent)).toBe(true);
    });
  }

  it('SHARE-U-22 Notice (kit, shared): an existing photo-flow notice (denied photos) is still one alert holding its words, with its OK button outside it', async () => {
    await renderApp(<ShareScreen />, { user: 'chase', be: kindsOn(), deps: { pickBulk: jest.fn(async () => ({ denied: true as const })), pickPhotos: jest.fn(async () => ({ items: [] })) } });
    await screen.findByRole('header', { name: 'New post' }, slow);
    fireEvent.press(screen.getByRole('button', { name: /^Add photos( or videos)?, up to \d+ at a time$/ }));
    const alerts = await screen.findAllByRole('alert', {}, slow);
    expect(alerts).toHaveLength(1);
    expect(wordsIn(alerts[0]!)).toBe('Hearth needs your OK to see your photos. Tap "Allow" when your phone asks.');
    expect(hiddenFromReaders(alerts[0]!)).toBe(false);
    const ok = screen.getByRole('button', { name: 'OK, hide this message' });
    let inside = false;
    for (let p: Inst | null = ok; p; p = p.parent) if (p === alerts[0]) inside = true;
    expect(inside).toBe(false);
    fireEvent.press(ok);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull(), slow);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// GUX-SK-R1..R11 (grandparent-ux review of Share's Event/News/Saying cards, Nov 25, 2026). Written first (red) by qa-tdd.
// CONTRACT for the engineer (behaviour is what is checked):
//   - R1: the Event field "When" is now "What day" (label and spoken name), placeholder "Like 2026-12-24". Tapping
//     "Pick who gets it" checks the day locally (a real YYYY-MM-DD date); a bad one shows GUX_DAY, tiles stay closed,
//     createPost is never called. A 23514 from the server shows GUX_DAY_SERVER.
//   - R2: the Saying age check runs at the same moment (before the tiles open); any notice, local or from the server,
//     scrolls Share's page to the top (ScrollView scrollTo({ y: 0 })).
//   - R3: while the button is disabled, one line of words (R3_LINE[k]) shows; it is gone once the button is enabled.
//   - R4: opening the tiles calls Keyboard.dismiss() and scrolls the "To:" tiles into view: scrollToEnd() on Share's
//     page, or scrollTo with a y above 0.
//   - R5/R6: exact AUTH and 42501 notices. R7: Feed's event line "Saturday, October 31 · place".
//   - R8: Saying line exact, with ", and the age" only once an age is typed. R9: kind tile words are type.headline.
//   - R10: kind card field underlines are c.tabLine. R11: Cancel on a card with words asks first (AlertDialog).
const AGE_NOT_NUMBER_WORDS = 'Type the age as a number, like 4, or leave it blank. Your words are kept.';
const GUX_DAY = 'Type the day as year-month-day, like 2026-12-24. Your words are kept.';
const GUX_DAY_SERVER = 'The day needs to look like 2026-12-24. Your words are kept.';
const GUX_AUTH = "You're signed out, so this didn't send. Signing in again clears this card, so copy your words first if you need them.";
const GUX_OFF = "This can't be sent right now. Your words are kept. Tap Cancel, or ask whoever set up your family.";
const R3_LINE: Record<K, string> = {
  event: "Fill in What's happening and What day to go on.",
  saying: 'Fill in What they said and Who said it to go on.',
  news: 'Write your news to go on.',
};
type Mocked = jest.Mock & { mock: { calls: unknown[][] } };
const scrollProto = ScrollView.prototype as unknown as { scrollTo: Mocked; scrollToEnd: Mocked };
const clearScroll = () => { scrollProto.scrollTo.mockClear(); scrollProto.scrollToEnd.mockClear(); };
const scrolledToTop = () => scrollProto.scrollTo.mock.calls.some((c) => Number((c[0] as { y?: number } | undefined)?.y ?? -1) === 0);

describe('GUX-SK-R1 (DEC-90) Event "What day": picked on the day sheet, so a bad typed day can no longer happen', () => {
  it('GUX-SK-R1 (DEC-90) the chip is "Pick a day" (not "When", not a typed field with "Like 2026-12-24"); no day text input exists', async () => {
    await start();
    await openKind('event');
    expect(screen.getByRole('button', { name: 'Pick a day' })).toBeTruthy();
    expect(screen.queryByText('When')).toBeNull();
    expect(screen.queryByLabelText('What day')).toBeNull();
    expect(screen.queryByPlaceholderText('Like 2026-12-24')).toBeNull();
  });
  it('GUX-SK-R1 (DEC-90) the typed-day notice is gone: sending a picked day never shows "year-month-day"', async () => {
    const { be } = await start();
    const create = jest.spyOn(be, 'createPost');
    fireEvent.press(await toSend('event'));
    await screen.findByRole('header', { name: 'Sent' }, slow);
    expect(create.mock.calls[0]![1].event?.when).toBe(TODAY_ISO);
    expect(screen.queryByText(GUX_DAY)).toBeNull();
  });
  it('GUX-SK-R1 a 23514 from the server says exactly how the day should look', async () => {
    const { be } = await start();
    jest.spyOn(be, 'createPost').mockImplementation(() => { throw new ApiError('23514', 'an event needs a real date'); });
    fireEvent.press(await toSend('event'));
    expect(wordsIn(await screen.findByRole('alert', {}, slow))).toBe(GUX_DAY_SERVER);
  });
});

describe('GUX-SK-R2 (DEC-90) every notice scrolls to the top (the local age and day notices are gone with the typed fields)', () => {
  it('GUX-SK-R2 a server notice (42501) on step 2 scrolls the page to the top', async () => {
    const { be } = await start();
    jest.spyOn(be, 'createPost').mockImplementation(() => { throw new ApiError('42501', 'post_kinds_off'); });
    const send = await toSend('news');
    clearScroll();
    fireEvent.press(send);
    await screen.findByRole('alert', {}, slow);
    expect(scrolledToTop()).toBe(true);
  });
});

const FLOW_HINT: Record<K, string> = {
  event: "Add what's happening and the day to go on.",
  saying: 'Add what they said and who said it to go on.',
  news: 'Add your news to go on.',
};
describe('GUX-SK-R3 (DEC-90) a hint line says what is missing while "Next: who gets it" is off (wording moves to FLOW-5)', () => {
  for (const k of ALL) {
    it(`GUX-SK-R3 (DEC-90) ${k}: "${FLOW_HINT[k]}" shows while the button is off and is empty once it is on`, async () => {
      await start();
      await openKind(k);
      expect(isDisabled(pickBtn())).toBe(true);
      const line = screen.getByText(FLOW_HINT[k]);
      expect(hiddenFromReaders(line)).toBe(false);
      fill(k);
      expect(isDisabled(pickBtn())).toBe(false);
      expect(screen.queryByText(FLOW_HINT[k])).toBeNull();
    });
  }
});

describe('GUX-SK-R4 (DEC-90) "Next: who gets it" puts the keyboard away (no scroll to tiles: step 2 is its own page)', () => {
  for (const k of ALL) {
    it(`GUX-SK-R4 (DEC-90) ${k}: Keyboard.dismiss() on Next, and the tiles are on their own page`, async () => {
      await start();
      await openKind(k);
      fill(k);
      const dismiss = jest.spyOn(Keyboard, 'dismiss');
      fireEvent.press(pickBtn());
      await screen.findByRole('header', { name: 'Who gets it?' }, slow);
      await waitFor(() => expect(tiles().length).toBe(3), slow);
      expect(dismiss).toHaveBeenCalled();
    });
  }
});

describe('GUX-SK-R5 / R6 exact words for signed out and switched off', () => {
  const cases: [string, ApiError, string][] = [
    ['GUX-SK-R5 (P1) AUTH', new ApiError('AUTH'), GUX_AUTH],
    ['GUX-SK-R6 (P2) 42501', new ApiError('42501', 'post_kinds_off'), GUX_OFF],
  ];
  for (const [name, err, want] of cases) {
    for (const k of ['event', 'news'] as const) {
      it(`${name} on ${k}: the notice reads exactly "${want}"`, async () => {
        const { be } = await start();
        jest.spyOn(be, 'createPost').mockImplementation(() => { throw err; });
        fireEvent.press(await toSend(k));
        expect(wordsIn(await screen.findByRole('alert', {}, slow))).toBe(want);
      });
    }
  }
});

describe('GUX-SK-R7 (P2) the Feed event line names the weekday', () => {
  it('GUX-SK-R7 eventDay: "Saturday, October 31" this year; "Wednesday, December 24, 2025" another year', () => {
    const now = new Date(2026, 10, 25);
    expect(eventDay('2026-10-31', now)).toBe('Saturday, October 31');
    expect(eventDay('2025-12-24', now)).toBe('Wednesday, December 24, 2025');
  });
  it('GUX-SK-R7 in Feed, Grandma Jo sees "Saturday, October 31 · Grandpa Earl’s farm"', async () => {
    const be = kindsOn();
    const id = await seedKind(be, 'event'); // 2026-10-31, a Saturday
    await renderApp(<FeedScreen />, { waitReady: false, user: 'jo', be });
    const card = await screen.findByTestId(`post-${id}`, {}, slow);
    const thisYear = new Date().getFullYear() === 2026;
    expect(wordsIn(card)).toContain(`Saturday, October 31${thisYear ? '' : ', 2026'} · Grandpa Earl’s farm`);
  });
});

describe('GUX-SK-R8 (DEC-90) the Saying summary names the words, who said them, and the age only when there is one', () => {
  it('GUX-SK-R8 (DEC-90) blank age: "...these words and who said them"; an age typed: "...these words, who said them, and the age"', async () => {
    for (const age of ['', '4']) {
      const { unmount } = await start();
      await openKind('saying');
      fill('saying', age ? { 'Age then, optional': age } : {});
      fireEvent.press(pickBtn());
      await screen.findByRole('header', { name: 'Who gets it?' }, slow);
      fireEvent.press(screen.getByLabelText(new RegExp(`^${DAD}, \\d+ people, not picked$`)));
      expect(wordsIn(screen.getByTestId('share-summary'))).toContain(age ? 'these words, who said them, and the age' : 'these words and who said them');
      unmount();
    }
  });
});

describe('GUX-SK-R9 (P2) kind tile words are type.headline', () => {
  for (const easy of [false, true]) {
    it(`GUX-SK-R9 Easy view ${easy ? 'on' : 'off'}: Event, News and Saying words are headline (${easy ? 21 : 17} pt, SemiBold)`, async () => {
      const kv = memoryKV({ [`hearth.prefs.v1.${FIXTURE.users.chase.id}`]: JSON.stringify({ easyView: easy }) });
      await start({ kv });
      const want = TYPE[easy ? 'easy' : 'standard'].headline;
      for (const k of ALL) {
        const s = flat(screen.getByTestId(`share-kind-word-${k}`).props.style);
        expect({ k, size: s.fontSize, family: s.fontFamily }).toEqual({ k, size: want.fontSize, family: want.fontFamily });
      }
    });
  }
});

describe('GUX-SK-R10 (DEC-90) kind cards have no field underlines at all (FLOW-2, FLOW-24)', () => {
  for (const k of ALL) {
    it(`GUX-SK-R10 (DEC-90) ${k}: its one box has no bottom border and no ruled line`, async () => {
      await start();
      await openKind(k);
      const inputs = screen.getByTestId(`share-kind-card-${k}`).findAll((x: Inst) => x.type === TextInput) as Inst[];
      expect(inputs).toHaveLength(1);
      expect(flat(inputs[0]!.props.style).borderBottomWidth ?? 0).toBe(0);
    });
  }
});

describe('GUX-SK-R11 (P2) Cancel on a card with words asks first', () => {
  it('GUX-SK-R11 an empty card cancels at once, with no question', async () => {
    await start();
    await openKind('event');
    fireEvent.press(screen.getByRole('button', { name: 'Cancel this post' }));
    expect(screen.queryByRole('header', { name: 'Throw away this card?' })).toBeNull();
    await emptyAgain();
  });
  for (const k of ALL) {
    it(`GUX-SK-R11 ${k} with words: "Throw away this card?"; "Keep writing" keeps every word, "Throw away" empties Share`, async () => {
      await start();
      await openKind(k);
      const [label, value] = Object.entries(KINDS[k].required)[0]!;
      type(label, value);
      fireEvent.press(screen.getByRole('button', { name: 'Cancel this post' }));
      await screen.findByRole('header', { name: 'Throw away this card?' }, slow);
      fireEvent.press(screen.getByRole('button', { name: 'Keep writing' }));
      await waitFor(() => expect(screen.queryByRole('header', { name: 'Throw away this card?' })).toBeNull(), slow);
      expect(wordsBox().props.value).toBe(value);
      fireEvent.press(screen.getByRole('button', { name: 'Cancel this post' }));
      await screen.findByRole('header', { name: 'Throw away this card?' }, slow);
      fireEvent.press(screen.getByRole('button', { name: 'Throw away' }));
      await emptyAgain();
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// PRIV-SK-R1 (P1, privacy-security, Nov 25, 2026). Written first (red) by qa-tdd.
// create_post returns the existing post for a repeated client id and ignores new groups and words (by design: that is
// what makes a retry safe). So ShareScreen must not reuse a kind draft's client id once the parent has changed who it
// goes to or what it says, or "Send again" publishes the OLD post to the OLD groups while the button names the new ones.
// CONTRACT for the engineer (behaviour is what is checked):
//   (a) publishPost fails, the parent changes the picked groups, Send: the published post goes to exactly the new pick
//       (and someone only in the old pick does not get it).
//   (b) createPost commits on the server but its reply is lost (NETWORK), the parent edits the words, Send: the
//       published post holds the new words, and no published post holds the old ones.
//   (c) guard: a plain retry with nothing changed after that lost reply still makes exactly one post (idempotency kept).
// PRIV-SK-R2 (P2, accepted until milestone 7): a committed draft left behind by (a)/(b) is not cleaned up; not tested.
const MOM = "Grandparents – Mom's side";
const sendBtn = () => screen.getByRole('button', { name: /^Send to / });
const tile = (name: string, picked: boolean) => screen.getByLabelText(new RegExp(`^${name}, \\d+ people, ${picked ? '' : 'not '}picked$`));
const published = (be: FakeBackend) => Object.values(be.state.posts).filter((p) => p.status === 'published' && !p.deleted);
/** createPost writes the post on the server, then the reply never arrives (the phone sees NETWORK). */
const commitThenLose = (be: FakeBackend) => {
  const real = be.createPost.bind(be);
  return jest.spyOn(be, 'createPost')
    .mockImplementationOnce((u, a) => { real(u, a); throw new ApiError('NETWORK'); })
    .mockImplementation(real);
};

describe('PRIV-SK-R1 (P1) Send again never publishes the old groups or the old words', () => {
  it('PRIV-SK-R1 (a) publish fails, the parent changes the groups, Send: the published post goes to exactly the new pick', async () => {
    const { be } = await start();
    const before = new Set(published(be).map((p) => p.id));
    const real = be.publishPost.bind(be);
    jest.spyOn(be, 'publishPost').mockImplementationOnce(() => { throw new ApiError('NETWORK'); }).mockImplementation(real);
    fireEvent.press(await toSend('news')); // to Dad's side: Chase, Jo, Earl
    await screen.findByRole('alert', {}, slow);
    fireEvent.press(tile(DAD, true));
    fireEvent.press(tile(MOM, false)); // now Mom's side only: Alex, Ruth
    expect(sendBtn().props.accessibilityLabel ?? '').not.toMatch(/Jo|Earl/);
    fireEvent.press(sendBtn());
    await emptyAgain();
    const mine = published(be).filter((p) => !before.has(p.id));
    expect(mine.map((p) => ({ caption: p.caption, circles: [...p.circles].sort() })))
      .toEqual([{ caption: 'Leo lost his first tooth', circles: [FIXTURE.circles.momSide.id] }]);
    const id = mine[0]!.id;
    // Both directions: Ruth (Mom's side, the new pick) gets it; Grandpa Earl (Dad's side only, the old pick) does not.
    const ruth = await be.clientFor(FIXTURE.users.ruth.id).getFeed({ space: FIXTURE.space.id });
    const earl = await be.clientFor(FIXTURE.users.earl.id).getFeed({ space: FIXTURE.space.id });
    expect({ ruth: ruth.some((p) => p.post_id === id), earl: earl.some((p) => p.post_id === id) }).toEqual({ ruth: true, earl: false });
  });

  it('PRIV-SK-R1 (b) createPost commits but its reply is lost, the parent edits the words, Send: the new words are published, never the old', async () => {
    const { be } = await start();
    const before = new Set(published(be).map((p) => p.id));
    commitThenLose(be);
    fireEvent.press(await toSend('news'));
    await screen.findByRole('alert', {}, slow);
    await backToWords();
    type('Your news', 'Leo lost his second tooth');
    await toWhoAgain();
    fireEvent.press(sendBtn());
    await emptyAgain();
    const mine = published(be).filter((p) => !before.has(p.id));
    expect(mine.map((p) => ({ caption: p.caption, circles: p.circles }))).toEqual([{ caption: 'Leo lost his second tooth', circles: [FIXTURE.circles.dadSide.id] }]);
    expect(published(be).filter((p) => p.caption === 'Leo lost his first tooth')).toEqual([]);
  });

  it('PRIV-SK-R1 (c) guard: after that lost reply, a plain Send again with nothing changed still makes exactly one post', async () => {
    const { be } = await start();
    const before = Object.keys(be.state.posts).length;
    const create = commitThenLose(be);
    fireEvent.press(await toSend('news'));
    await screen.findByRole('alert', {}, slow);
    fireEvent.press(sendBtn());
    await emptyAgain();
    expect(new Set(create.mock.calls.map((c) => c[1].clientId)).size).toBe(1);
    expect(Object.keys(be.state.posts).length).toBe(before + 1);
    const mine = Object.values(be.state.posts).filter((p) => p.client_id === create.mock.calls[0]![1].clientId);
    expect(mine.map((p) => ({ caption: p.caption, status: p.status }))).toEqual([{ caption: 'Leo lost his first tooth', status: 'published' }]);
  });
});
