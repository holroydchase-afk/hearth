// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SHARE-U-17..23 (docs/product/SPEC-VISIBILITY-CORE.md, Phase 4 "One Share composer"): Share's Event, News and Saying
// cards actually save. Written first (red), Nov 24, 2026, by qa-tdd. The backend and HearthApi.createPost({ kind,
// event | saying }) already exist (migration 0034); these tests hold the UI that is still missing.
//
// CONTRACT for the engineer (the tests find things by these; behaviour is what is checked):
//   - Kind card fields keep their spoken labels: Event "What's happening", "When", "Where, optional"; News "Your news";
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
//     "Everyone you send this to will see who said it." before sending; Event and News cards don't.
//   - SHARE-U-22: when createPost refuses (42501 post_kinds_off, 23514 a bad field) a Notice (role alert) shows plain
//     words that say the words were kept (/kept/i), with no code and not the photo line "Pick who should see it.";
//     every typed word stays in the card. Branch on error.code.
//   - SHARE-U-23: every new tap target is labelled and 48 pt+; text through useTheme().type / <Txt> (typeScale lint).
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { ApiError } from '../../api/HearthApi';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { uuid } from '../../crypto/random';
import { memoryKV, type KV } from '../../platform/kv';
import type { PickedAsset } from '../../share/bulk';
import { FeedScreen } from '../../test/redesignScreens';
import { expectGrandparentSafe, renderApp, type FixtureUser } from '../../test/renderApp';
import { ShareScreen } from '../ShareScreen';

const slow = { timeout: 5000 };
const DAD = "Grandparents – Dad's side";
const SAYING_LINE = 'Everyone you send this to will see who said it.';
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
  return { ...r, be };
}

const KINDS = {
  event: { label: 'Add an event', required: { "What's happening": 'Pumpkin patch', When: '2026-10-31' }, optional: { 'Where, optional': '' } },
  news: { label: 'Share news', required: { 'Your news': 'Leo lost his first tooth' }, optional: {} },
  saying: { label: 'Add a saying', required: { 'What they said': 'Pawpaw, your beard is a cloud', 'Who said it': 'Leo' }, optional: { 'Age then, optional': '' } },
} as const;
type K = keyof typeof KINDS;
const ALL: K[] = ['event', 'news', 'saying'];

async function openKind(k: K) {
  fireEvent.press(await screen.findByRole('button', { name: KINDS[k].label }, slow));
  await screen.findByTestId(`share-kind-card-${k}`, {}, slow);
}
const type = (label: string, v: string) => fireEvent.changeText(screen.getByLabelText(label), v);
const pickBtn = () => screen.getByRole('button', { name: 'Pick who gets it' });
const isDisabled = (b: Inst) => !!(b.props.accessibilityState?.disabled ?? b.props['aria-disabled']);
const tiles = () => screen.queryAllByLabelText(/^.+, \d+ (person|people), (not )?picked$/);
const fill = (k: K, extra: Record<string, string> = {}) => {
  for (const [l, v] of Object.entries({ ...KINDS[k].required, ...extra })) type(l, v);
};
const emptyAgain = async () => {
  await screen.findByTestId('share-kinds', {}, slow);
  expect(screen.getByRole('button', { name: /^Add photos( or videos)?, up to \d+ at a time$/ })).toBeTruthy();
  for (const k of ALL) expect(screen.queryByTestId(`share-kind-card-${k}`)).toBeNull();
};

afterEach(() => jest.restoreAllMocks());

describe('SHARE-U-17 "Pick who gets it" opens up only when the required fields are filled', () => {
  for (const k of ALL) {
    it(`SHARE-U-17 ${k}: off while empty, off with any one required field blank or spaces only, on with every required one filled and the optional ones blank`, async () => {
      await start();
      await openKind(k);
      expect(isDisabled(pickBtn())).toBe(true);
      const req = Object.entries(KINDS[k].required);
      for (const [skip] of req) {
        for (const [l, v] of req) type(l, l === skip ? '   ' : v);
        expect({ blank: skip, disabled: isDisabled(pickBtn()) }).toEqual({ blank: skip, disabled: true });
      }
      fill(k);
      for (const l of Object.keys(KINDS[k].optional)) type(l, '');
      expect({ k, disabled: isDisabled(pickBtn()) }).toEqual({ k, disabled: false });
    });
  }
});

describe('SHARE-U-18 it opens the same who-gets-it picker as photos, nothing pre-picked (SHARE-U-3, DEC-73/79)', () => {
  for (const k of ALL) {
    it(`SHARE-U-18 ${k}: the group tiles show, none picked even with a saved last audience; a pick names the people on Send`, async () => {
      const kv = memoryKV({ [`hearth.lastAudience.v1.${FIXTURE.users.chase.id}`]: JSON.stringify([FIXTURE.circles.dadSide.id]) });
      await start({ kv });
      await openKind(k);
      expect(tiles()).toHaveLength(0); // the picker is behind the button
      fill(k);
      fireEvent.press(pickBtn());
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
  await waitFor(() => expect(tiles().length).toBe(3), slow);
  fireEvent.press(screen.getByLabelText(new RegExp(`^${DAD}, \\d+ people, not picked$`)));
  return screen.getByRole('button', { name: 'Send to Grandma Jo and Grandpa Earl' });
}

const WANT: Record<K, Record<string, unknown>> = {
  news: { kind: 'news', caption: 'Leo lost his first tooth' },
  event: { kind: 'event', event: expect.objectContaining({ what: 'Pumpkin patch', when: '2026-10-31' }) },
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

  it('SHARE-U-19 Send again after a failed publish reuses the client id: still one post, now published', async () => {
    const { be } = await start();
    const before = Object.keys(be.state.posts).length;
    const create = jest.spyOn(be, 'createPost');
    const real = be.publishPost.bind(be);
    jest.spyOn(be, 'publishPost').mockImplementationOnce(() => { throw new ApiError('NETWORK'); }).mockImplementation(real);
    fireEvent.press(await toSend('news'));
    await screen.findByRole('alert', {}, slow);
    expect(screen.getByLabelText('Your news').props.value).toBe('Leo lost his first tooth');
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

describe('SHARE-U-21 PRIV-VC-D1 the Saying card says who will see who said it, before sending', () => {
  it(`SHARE-U-21 the Saying card shows "${SAYING_LINE}" where screen readers reach it, 17 pt+`, async () => {
    await start();
    await openKind('saying');
    const line = screen.getByText(SAYING_LINE);
    expect(hiddenFromReaders(line)).toBe(false);
    expect(Number(flat(line.props.style).fontSize ?? 0)).toBeGreaterThanOrEqual(17);
  });
  for (const k of ['event', 'news'] as const) {
    it(`SHARE-U-21 the ${k} card does not show the saying line`, async () => {
      await start();
      await openKind(k);
      expect(screen.queryByText(SAYING_LINE)).toBeNull();
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
      it(`SHARE-U-22 ${name} on ${k}: a notice that says the words were kept; the card and its words stay; nothing published`, async () => {
        const { be } = await start();
        jest.spyOn(be, 'createPost').mockImplementation(() => { throw err; });
        const publish = jest.spyOn(be, 'publishPost');
        fireEvent.press(await toSend(k));
        const notice = await screen.findByRole('alert', {}, slow);
        const said = wordsIn(notice);
        expect(said).toMatch(/kept/i);
        expect(said).not.toMatch(/42501|23514|post_kinds|Pick who should see it\./);
        expect(screen.getByTestId(`share-kind-card-${k}`)).toBeTruthy();
        for (const [l, v] of Object.entries(KINDS[k].required)) expect({ l, v: screen.getByLabelText(l).props.value }).toEqual({ l, v });
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
describe('SHARE-U-22 guards: a non-number age, and every existing notice still announces itself', () => {
  for (const age of ['four', '4.5', '-4', '1000']) {
    it(`SHARE-U-22 Saying age "${age}": a local notice asks for a number, every word stays, and nothing reaches the server`, async () => {
      const { be } = await start();
      const create = jest.spyOn(be, 'createPost');
      const publish = jest.spyOn(be, 'publishPost');
      fireEvent.press(await toSend('saying', { 'Age then, optional': age }));
      const notice = await screen.findByRole('alert', {}, slow);
      expect(wordsIn(notice)).toBe('Type the age as a number, like 4, or leave it blank. Your words are kept.');
      expect(create).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
      expect(screen.getByTestId('share-kind-card-saying')).toBeTruthy();
      for (const [l, v] of Object.entries({ ...KINDS.saying.required, 'Age then, optional': age })) expect({ l, v: screen.getByLabelText(l).props.value }).toEqual({ l, v });
      expect(screen.getByRole('button', { name: 'Send to Grandma Jo and Grandpa Earl' })).toBeTruthy();
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
