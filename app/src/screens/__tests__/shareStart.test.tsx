// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEC-79 (Chase, Nov 20): Share opens on an empty postcard. docs/product/SPEC-REDESIGN.md 1j-2, SHARE-ST-1..7
// (SHARE-ST-8 is Playwright in app/e2e-web/demo.spec.js; SHARE-ST-9 is a manual phone check). Reference look: option B
// of /mnt/project-files/design/share-start-2026-11-20/share-start-tester.html. Written first (red), Nov 21, by qa-tdd.
//
// Seams the engineer builds (named here so the tests can find them; the behaviour is what is checked):
//   - The empty card carries testID "share-card" (the same card the postcard uses), c.surface and the photo shadow.
//   - The photo spot is one button, spoken "Add photos, up to N at a time" ("Add photos or videos, ..." with videos
//     on); its words are "Add photos" (or "Add photos or videos") and "Up to N at a time".
//   - A parent (owner/adult) with deps.pickBulk gets N = 100 and pickBulk; anyone else gets N = 10 and pickPhotos.
//     With no pickBulk in deps (most older tests), a parent's target falls back to pickPhotos.
//   - The note and To: sit in one View hidden from screen readers (accessibilityElementsHidden and
//     importantForAccessibility="no-hide-descendants"); nothing inside it is tappable.
//
// Round 2, B+ (Chase, Nov 21, DEC-79 amended): SHARE-ST-10..18, written first (red), Nov 23, by qa-tdd. They win over
// SHARE-ST-1's subline and SHARE-ST-3's fading (the old tests below are updated to match). Seams for the engineer:
//   - Subline: "Only the people you pick will see it." (c.muted, fontSize >= 17).
//   - The dashed photo spot is the button itself or a host View inside it: borderStyle 'dashed', borderWidth 2,
//     borderColor c.accent, borderRadius 14, aspectRatio 4/3, backgroundColor c.surface (or none). Its outer edge sits
//     12 px in from the card ("share-card") on left, right and top: card padding + margins in between add up to 12.
//   - Inside the spot: a host View 72 x 72, borderRadius 36, backgroundColor c.accentSoft, holding the add-photo
//     SystemIcon at size 32; "Add photos" Text at fontSize 22, FONT.semibold, color c.accent; then the helper Text.
//     Helper and spoken label say 100 only for a parent with Easy view off; 10 otherwise.
//   - testID "share-stamp": the stamp, style width 44, height 52, transform [{ rotate: '4deg' }], hidden from screen
//     readers (accessibilityElementsHidden + importantForAccessibility "no-hide-descendants"), pointerEvents "none",
//     no onPress in it or above it; its Text shows today's day of month and month (e.g. "23" and "NOV").
//   - "Add a note (optional)" and "To: you pick after your photos" Texts: opacity 1 all the way up, >= 4.5:1 on c.surface.
//   - testID "share-to": the To: row (no accessibilityRole "button", no onPress in it or above it). Inside it,
//     testID "share-to-faces" (the stack: host Views 32 x 32) and testID "share-to-names" (one Text, numberOfLines 1):
//     group names for a parent ("Everyone", "Dad's side", "Mom's side" as tileName gives them, no people's names);
//     people's names for anyone else (never a group title).
//   - testID "share-last": "Last shared <today|weekday>, to <names>" under the card, only once a post was sent; it
//     must survive a fresh mount with the same kv (the engineer may add the date to audienceMemory's storage).
//   - Press feedback: on pressIn the spot runs Animated.timing to 0.98 over 120 ms, and back to 1 on pressOut;
//     with Reduce Motion on (AccessibilityInfo.isReduceMotionEnabled) no timing goes below 1.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo, Animated, Image, Platform, StyleSheet, Text, TextInput } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV, type KV } from '../../platform/kv';
import type { PickedAsset } from '../../share/bulk';
import { expectGrandparentSafe, renderApp, screenWords, type FixtureUser } from '../../test/renderApp';
import type { AppDeps } from '../../state/AppContext';
import { FONT, contrast, mix, paletteFor, photoShadow } from '../../ui/theme';
import { ShareScreen } from '../ShareScreen';

const slow = { timeout: 5000 };
type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const isHost = (n: Inst) => typeof n.type === 'string';
const pal = (dark: boolean) => paletteFor(Platform.OS as 'ios', dark);
function wordsIn(root: Inst): string {
  const parts: string[] = [];
  const walk = (c: unknown) => {
    if (typeof c === 'string' || typeof c === 'number') parts.push(String(c));
    else if (Array.isArray(c)) c.forEach(walk);
  };
  for (const t of root.findAll((n: Inst) => n.type === Text)) walk(t.props.children);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
const prefs = (u: FixtureUser, p: Record<string, unknown>) => memoryKV({ [`hearth.prefs.v1.${FIXTURE.users[u].id}`]: JSON.stringify(p) });

let n = 0;
/** A picked photo as pickBulk hands it over: with EXIF, GPS and the camera's make (BETA-BULK-1). */
const asset = (hour = 9): PickedAsset => ({
  uri: `file:///picked/ST_${++n}.jpg`, type: 'image', mimeType: 'image/jpeg', width: 4032, height: 3024,
  exif: { DateTimeOriginal: `2024:07:04 ${String(hour).padStart(2, '0')}:00:00`, OffsetTimeOriginal: '-04:00', GPSLatitude: 35.2271, GPSLongitude: -80.8431, Make: 'Apple' },
});
const assets = (count: number) => Array.from({ length: count }, (_, i) => asset(8 + (i % 12)));
const item = (i: number) => ({ uri: `file:///pick/${i}.jpg`, kind: 'photo' as const, width: 4032, height: 3024 });
const items = (count: number, from = 1) => Array.from({ length: count }, (_, i) => item(from + i));

function videoOn(): FakeBackend {
  const be = FakeBackend.withFixture();
  be.state.featureFlags = { video_posting: true };
  be.state.spaceFeatures = { [`${FIXTURE.space.id}:video_posting`]: true };
  return be;
}
/** Ruth is a relative; milestone 4 lets a relative post. */
function relativeCanPost(be = FakeBackend.withFixture()): FakeBackend {
  const real = be.mySpaces.bind(be);
  jest.spyOn(be, 'mySpaces').mockImplementation((u) => real(u).map((s) => ({ ...s, can_post: true })));
  // engineer, flagged for qa-tdd: the fake also checks the role in myCircles and createPost, so without this a relative
  // has no groups to list or send to (SHARE-ST-15/16 could never find her names or tiles).
  const poster = be.isPoster.bind(be);
  const relatives = new Set([FIXTURE.users.ruth.id, FIXTURE.users.jo.id]);
  jest.spyOn(be, 'isPoster').mockImplementation((space, user) => relatives.has(user) || poster(space, user));
  return be;
}

async function start(opts: { user?: FixtureUser; kv?: KV; be?: FakeBackend; deps?: Partial<AppDeps> } = {}) {
  const pickBulk = jest.fn(async () => ({ assets: [] as PickedAsset[] }));
  const pickPhotos = jest.fn(async () => ({ items: [] as ReturnType<typeof items> }));
  const r = await renderApp(<ShareScreen />, { user: opts.user ?? 'chase', kv: opts.kv, be: opts.be, deps: { pickBulk, pickPhotos, ...opts.deps } });
  await screen.findByRole('header', { name: 'New post' }, slow);
  return { ...r, pickBulk: r.deps.pickBulk as jest.Mock, pickPhotos: r.deps.pickPhotos as jest.Mock };
}
const target = (limit?: number) => screen.getByRole('button', { name: limit ? `Add photos, up to ${limit} at a time` : /^Add photos( or videos)?, up to \d+ at a time$/ });
const TO = 'To: you pick after your photos'; // SHARE-ST-15 (was "To: pick after your photos", SHARE-ST-3)
/** The note and To: part: the View hidden from screen readers that holds the To: words. */
function fadedPart(): Inst {
  const words = screen.getByText(TO, { includeHiddenElements: true }); // engineer: the part is hidden from screen readers by design
  for (let p: Inst | null = words; p; p = p.parent) {
    if (isHost(p) && (p.props.accessibilityElementsHidden === true || p.props.importantForAccessibility === 'no-hide-descendants' || p.props['aria-hidden'] === true)) return p;
  }
  throw new Error(`"${TO}" is not inside a part hidden from screen readers`);
}
/** Opacity of a node times every host parent's. */
function opacityOf(node: Inst): number {
  let o = 1;
  for (let p: Inst | null = node; p; p = p.parent) if (isHost(p)) o *= Number(flat(p.props.style).opacity ?? 1);
  return o;
}

afterEach(() => jest.restoreAllMocks());

describe('SHARE-ST-1 the Share tab opens on "New post", an empty postcard', () => {
  for (const user of ['chase', 'ruth'] as const) {
    it(`SHARE-ST-1 ${user}: large title "New post", the DEC-73 card; none of the old start page (subline: SHARE-ST-10)`, async () => {
      const be = user === 'ruth' ? relativeCanPost() : undefined;
      await start({ user, be });
      const c = pal(false);
      const card = screen.getByTestId('share-card');
      const shadowed = [card, card.parent].filter(Boolean).some((x) => flat(x!.props.style).boxShadow === photoShadow(false)!.boxShadow);
      expect({ fill: flat(card.props.style).backgroundColor, shadowed }).toEqual({ fill: c.surface, shadowed: true });
      const words = screenWords();
      expect(words).not.toMatch(/Share photos|Lots of photos\?|Pick lots of photos|Pick photos|add a note, then pick who gets them/);
      expect(screen.queryByRole('header', { name: 'Share photos' })).toBeNull();
      expect(screen.queryByRole('button', { name: /lots of photos|^Pick up to 100/i })).toBeNull();
    });
  }
});

describe('SHARE-ST-2 the photo spot is one "Add photos" button', () => {
  it('SHARE-ST-2 a parent: icon, "Add photos", "Up to 100 at a time"; spoken "Add photos, up to 100 at a time"; inside the card, where the big photo goes', async () => {
    await start();
    const btn = target(100);
    expect(wordsIn(btn)).toBe('Add photos Up to 100 at a time');
    expect(btn.findAll((x: Inst) => x.props.name !== undefined && x.props.tintColor !== undefined).length).toBeGreaterThan(0); // the add-photo icon
    const card = screen.getByTestId('share-card');
    let inCard = false;
    for (let p: Inst | null = btn; p; p = p.parent) if (p === card) inCard = true;
    expect(inCard).toBe(true);
    // Same size and place as the postcard's big photo (4:3, full card width, first thing in the card).
    const s = flat(btn.props.style);
    expect(s.aspectRatio).toBeCloseTo(4 / 3);
    expectGrandparentSafe();
    // Only one way in: no other button on the page starts a pick.
    expect(screen.getAllByRole('button').filter((b) => /photo/i.test(String(b.props.accessibilityLabel ?? '')))).toHaveLength(1);
  });

  it('SHARE-ST-2 an adult parent (Alex) also reads "Up to 100 at a time"', async () => {
    await start({ user: 'alex' });
    expect(target(100)).toBeTruthy();
    expect(screen.getByText('Up to 100 at a time')).toBeTruthy();
  });

  it('SHARE-ST-2 a relative who can post reads "Up to 10 at a time"', async () => {
    await start({ user: 'ruth', be: relativeCanPost() });
    expect(wordsIn(target(10))).toBe('Add photos Up to 10 at a time');
    expect(screen.queryByText('Up to 100 at a time')).toBeNull();
  });

  it('SHARE-ST-2 videos on: "Add photos or videos", spoken "Add photos or videos, up to 100 at a time"', async () => {
    await start({ be: videoOn() });
    const btn = await screen.findByRole('button', { name: 'Add photos or videos, up to 100 at a time' }, slow);
    expect(wordsIn(btn)).toBe('Add photos or videos Up to 100 at a time');
  });

  for (const user of ['chase', 'jo'] as const) {
    it(`SHARE-ST-2 Easy view and Bigger text (${user}): the words stay inside the target (no cut lines, no fixed height)`, async () => {
      const be = user === 'jo' ? relativeCanPost() : undefined;
      await start({ user, be, kv: prefs(user, { easyView: true, bigText: true }) });
      const btn = target();
      const s = flat(btn.props.style);
      expect({ height: s.height, overflow: s.overflow === 'hidden' && s.height !== undefined }).toEqual({ height: undefined, overflow: false });
      for (const t of btn.findAll((x: Inst) => x.type === Text)) {
        expect({ text: wordsIn(t), lines: t.props.numberOfLines, size: Number(flat(t.props.style).fontSize) >= 21 })
          .toEqual({ text: wordsIn(t), lines: undefined, size: true });
      }
      expectGrandparentSafe();
    });
  }
});

describe('SHARE-ST-3 the note and To: wait below, faded and out of reach', () => {
  for (const dark of [false, true]) {
    // Updated Nov 23 for SHARE-ST-14/15 (B+): no longer faded, no 3 empty outlines (a face stack instead), new To: words.
    it(`SHARE-ST-3 (${dark ? 'dark' : 'light'}) "Add a note (optional)" and the To: line: words 4.5:1, hidden from VoiceOver/TalkBack, not tappable; no Send`, async () => {
      await start({ kv: prefs('chase', { look: dark ? 'dark' : 'light' }) });
      const c = pal(dark);
      const faded = fadedPart();
      expect(wordsIn(faded)).toMatch(new RegExp(`^Add a note \\(optional\\) ${TO} `));
      expect({ hidden: faded.props.accessibilityElementsHidden, important: faded.props.importantForAccessibility })
        .toEqual({ hidden: true, important: 'no-hide-descendants' });
      const o = opacityOf(faded);
      // RD-96: the words read at 4.5:1 on the card.
      for (const t of faded.findAll((x: Inst) => x.type === Text)) {
        const color = String(flat(t.props.style).color);
        const seen = mix(c.surface, color, o * Number(flat(t.props.style).opacity ?? 1));
        expect({ text: wordsIn(t), ok: contrast(seen, c.surface) >= 4.5 }).toEqual({ text: wordsIn(t), ok: true });
      }
      // Nothing in it can be focused or tapped.
      expect(faded.findAll((x: Inst) => typeof x.props.onPress === 'function' || typeof x.props.onResponderGrant === 'function' || x.props.accessible === true)).toHaveLength(0);
      expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
      expect(screen.queryByRole('button', { name: /^(Send to |Pick who gets it$)/ })).toBeNull();
      expect(screen.queryByText(/^(Send to |Pick who gets it$)/)).toBeNull();
    });
  }
});

describe('SHARE-ST-4 a parent taps Add photos: one picker, up to 100', () => {
  it('SHARE-ST-4 3 picked: pickBulk (not pickPhotos) opens; the postcard shows them in picked order, "1 of 3"', async () => {
    const picked = assets(3);
    const { pickBulk, pickPhotos } = await start({ deps: { pickBulk: jest.fn(async () => ({ assets: picked })) } });
    fireEvent.press(target(100));
    await waitFor(() => expect(pickBulk).toHaveBeenCalledWith({ videos: false }));
    expect(pickPhotos).not.toHaveBeenCalled();
    expect(await screen.findByText('1 of 3', {}, slow)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel this post' })).toBeTruthy();
    const big = screen.UNSAFE_getAllByType(Image).find((i) => i.props.accessibilityLabel === 'Photo 1 of 3')!;
    expect(big.props.source).toEqual({ uri: picked[0]!.uri });
    fireEvent.press(screen.getByRole('button', { name: 'Show photo 3' }));
    expect(screen.UNSAFE_getAllByType(Image).find((i) => i.props.accessibilityLabel === 'Photo 3 of 3')!.props.source).toEqual({ uri: picked[2]!.uri });
    expect(screen.queryByText(/photos? from \d+ days?/)).toBeNull();
  });

  it('SHARE-ST-4 10 picked still opens the postcard, "1 of 10"', async () => {
    await start({ deps: { pickBulk: jest.fn(async () => ({ assets: assets(10) })) } });
    fireEvent.press(target(100));
    expect(await screen.findByText('1 of 10', {}, slow)).toBeTruthy();
    expect(screen.queryByText(/left out/)).toBeNull();
  });

  for (const count of [11, 100]) {
    it(`SHARE-ST-4 ${count} picked open today's bulk review (BETA-BULK)`, async () => {
      await start({ deps: { pickBulk: jest.fn(async () => ({ assets: assets(count) })) } });
      fireEvent.press(target(100));
      expect(await screen.findByText(`${count} photos from 1 day`, {}, slow)).toBeTruthy();
      expect(screen.getByRole('button', { name: `Send ${count} photos` })).toBeTruthy();
    });
  }

  it('SHARE-ST-4 nothing picked (Cancel) leaves the empty postcard as it was', async () => {
    const { pickBulk } = await start();
    fireEvent.press(target(100));
    await waitFor(() => expect(pickBulk).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(target(100)).toBeTruthy();
    expect(screen.getByText(TO, { includeHiddenElements: true })).toBeTruthy(); // engineer: hidden from screen readers by design
    expect(screen.queryByRole('button', { name: 'Cancel this post' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('SHARE-ST-5 a relative who can post: one picker, up to 10; bulk never', () => {
  it('SHARE-ST-5 pickPhotos (10), never pickBulk; 3 picked open the postcard', async () => {
    const pickPhotos = jest.fn(async () => ({ items: items(3) }));
    const { pickBulk } = await start({ user: 'ruth', be: relativeCanPost(), deps: { pickPhotos } });
    fireEvent.press(target(10));
    await waitFor(() => expect(pickPhotos).toHaveBeenCalledWith({ videos: false }));
    expect(pickBulk).not.toHaveBeenCalled();
    expect(await screen.findByText('1 of 3', {}, slow)).toBeTruthy();
  });

  it('SHARE-ST-5 13 back from a picker that ignores the limit: the first 10, and HARD-2\'s notice with no "Pick lots of photos" hint', async () => {
    const pickPhotos = jest.fn(async () => ({ items: items(13) }));
    await start({ user: 'ruth', be: relativeCanPost(), deps: { pickPhotos } });
    fireEvent.press(target(10));
    expect(await screen.findByText('1 of 10', {}, slow)).toBeTruthy();
    expect(screen.UNSAFE_getAllByType(Image).find((i) => i.props.accessibilityLabel === 'Photo 1 of 10')!.props.source).toEqual({ uri: 'file:///pick/1.jpg' });
    expect(screen.getByText('You can send 10 at a time, so 3 photos were left out.')).toBeTruthy();
    expect(screenWords()).not.toMatch(/Pick lots of photos|photos from \d+ day/);
  });
});

describe('SHARE-ST-6 the postcard\'s Add tile still adds up to 10 for everyone', () => {
  it('SHARE-ST-6 a parent at 8 adds 5 through the Add tile: 10 kept, HARD-2\'s notice with no "Pick lots of photos" hint', async () => {
    const pickPhotos = jest.fn(async () => ({ items: items(5, 50) }));
    const { pickBulk } = await start({ deps: { pickBulk: jest.fn(async () => ({ assets: assets(8) })), pickPhotos } });
    fireEvent.press(target(100));
    expect(await screen.findByText('1 of 8', {}, slow)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Add photos' }));
    await waitFor(() => expect(pickPhotos).toHaveBeenCalled());
    expect(pickBulk).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('You can send 10 at a time, so 3 photos were left out.', {}, slow)).toBeTruthy();
    expect(screen.getByText(/of 10$/)).toBeTruthy();
    expect(screenWords()).not.toMatch(/Pick lots of photos|tap Cancel/);
  });

  it('SHARE-ST-6 a relative at 9 adds 2 through the Add tile: 10 kept, the same notice', async () => {
    const pickPhotos = jest.fn().mockResolvedValueOnce({ items: items(9) }).mockResolvedValueOnce({ items: items(2, 50) });
    await start({ user: 'ruth', be: relativeCanPost(), deps: { pickPhotos } });
    fireEvent.press(target(10));
    expect(await screen.findByText('1 of 9', {}, slow)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Add photos' }));
    expect(await screen.findByText('You can send 10 at a time, so 1 photo was left out.', {}, slow)).toBeTruthy();
    expect(screenWords()).not.toMatch(/Pick lots of photos/);
  });
});

describe('SHARE-ST-7 privacy: a parent\'s 1-10 pick through pickBulk sends no EXIF or GPS (SHARE-2, BETA-BULK-1)', () => {
  it('SHARE-ST-7 3 photos with GPS EXIF picked through pickBulk: only uri, size and the date reach the upload; nothing in the backend carries EXIF or GPS', async () => {
    const be = FakeBackend.withFixture();
    const { deps, pickBulk } = await start({ be, deps: { pickBulk: jest.fn(async () => ({ assets: assets(3) })) } });
    fireEvent.press(target(100));
    await waitFor(() => expect(pickBulk).toHaveBeenCalled());
    await screen.findByText('1 of 3', {}, slow);
    fireEvent.press(await screen.findByLabelText(/^Grandparents – Dad's side, \d+ people, not picked$/, {}, slow));
    fireEvent.press(screen.getByRole('button', { name: /^Send to / }));
    await waitFor(() => expect((deps.prepare as jest.Mock).mock.calls.length).toBe(3), slow);
    const given = (deps.prepare as jest.Mock).mock.calls.map(([i]) => i as Record<string, unknown>);
    for (const i of given) {
      expect(Object.keys(i).filter((k) => !['uri', 'kind', 'width', 'height', 'durationMs', 'takenAt'].includes(k))).toEqual([]);
      expect(JSON.stringify(i)).not.toMatch(/GPS|35\.22|80\.84|Apple|DateTimeOriginal|exif/i);
    }
    await waitFor(() => expect(Object.values(be.state.posts).filter((p) => p.status === 'published')).toHaveLength(1), slow);
    // T5: leave out ciphertext and keys, which can spell "GPS" by chance; the bytes are checked by the pipeline tests.
    const { objects: _ciphertext, ...meta } = be.state;
    expect(JSON.stringify(meta, (k, v) => (k === 'dek' ? undefined : v))).not.toMatch(/GPS|35\.22|80\.84|Apple|DateTimeOriginal/);
  });

  it('SHARE-ST-7 denied access shows today\'s "Hearth needs your OK" notice on the empty postcard', async () => {
    await start({ deps: { pickBulk: jest.fn(async () => ({ denied: true as const })) } });
    fireEvent.press(target(100));
    expect(await screen.findByText('Hearth needs your OK to see your photos. Tap "Allow" when your phone asks.', {}, slow)).toBeTruthy();
    expect(screen.getByRole('header', { name: 'New post' })).toBeTruthy();
    expect(screen.getByTestId('share-card')).toBeTruthy();
    expect(target(100)).toBeTruthy();
  });
});

// ---------- Round 2, B+ (DEC-79 amended): SHARE-ST-10..18 ----------
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
/** Host nodes from `node` up to and including `top`. */
function chain(node: Inst, top: Inst): Inst[] {
  const out: Inst[] = [];
  for (let p: Inst | null = node; p; p = p.parent) {
    if (isHost(p)) out.push(p);
    if (p === top) return out;
  }
  throw new Error('node is not inside top');
}
/** The node in the photo spot (the button or inside it) that carries the dashed border. */
function dashed(btn: Inst): Inst {
  const all = [btn, ...(btn.findAll(isHost) as Inst[])].filter(isHost);
  const d = all.find((x) => flat(x.props.style).borderStyle === 'dashed');
  if (!d) throw new Error('no dashed border on the photo spot');
  return d;
}
const num = (...x: unknown[]) => Number(x.find((y) => typeof y === 'number') ?? 0);
/** How far `node`'s outer edge sits in from `card`'s outer edge on one side: card padding + margins/paddings between. */
function inset(node: Inst, card: Inst, side: 'Left' | 'Right' | 'Top'): number {
  const axis = side === 'Top' ? 'Vertical' : 'Horizontal';
  let total = 0;
  for (const n of chain(node, card)) {
    const s = flat(n.props.style);
    if (n !== card) total += num(s[`margin${side}`], s[`margin${axis}`], s.margin);
    if (n !== node) total += num(s[`padding${side}`], s[`padding${axis}`], s.padding) + num(s[`border${side}Width`], s.borderWidth);
  }
  return total;
}
function noPressUp(node: Inst): boolean {
  for (let p: Inst | null = node; p; p = p.parent) if (typeof p.props.onPress === 'function' || p.props.accessibilityRole === 'button') return false;
  return node.findAll((x: Inst) => typeof x.props.onPress === 'function').length === 0;
}
type Call = { toValue: unknown; duration: number };
function spyTiming(): Call[] {
  const calls: Call[] = [];
  const real = Animated.timing;
  jest.spyOn(Animated, 'timing').mockImplementation(((v: Animated.Value, cfg: Animated.TimingAnimationConfig) => {
    calls.push({ toValue: cfg.toValue, duration: Number(cfg.duration ?? 500) });
    return real(v, cfg);
  }) as never);
  return calls;
}
const PEOPLE = /Chase|Alex|Grandma Jo|Nana Ruth|Grandpa Earl/;
const GROUPS = /Everyone|Dad's side|Mom's side|Grandparents/;

describe('SHARE-ST-10 the subline says who sees it', () => {
  for (const user of ['chase', 'ruth'] as const) {
    it(`SHARE-ST-10 ${user}: "Only the people you pick will see it." muted, 17 pt+; the old subline is gone`, async () => {
      await start({ user, be: user === 'ruth' ? relativeCanPost() : undefined });
      const s = flat(screen.getByText('Only the people you pick will see it.').props.style);
      expect({ color: s.color, big: Number(s.fontSize) >= 17 }).toEqual({ color: pal(false).muted, big: true });
      expect(screen.queryByText('For your family, nobody else.')).toBeNull();
    });
  }
});

describe('SHARE-ST-11 the photo spot is a dashed outline on the card', () => {
  for (const dark of [false, true]) {
    it(`SHARE-ST-11 (${dark ? 'dark' : 'light'}) 4:3, 2 px dashed accent border, 14 px corners, surface (no tint), 12 px in from the card`, async () => {
      await start({ kv: prefs('chase', { look: dark ? 'dark' : 'light' }) });
      const c = pal(dark);
      const btn = target(100);
      const d = dashed(btn);
      const s = flat(d.props.style);
      const bg = s.backgroundColor;
      expect({ ratio: Number(s.aspectRatio ?? flat(btn.props.style).aspectRatio).toFixed(3), width: s.borderWidth, color: s.borderColor, radius: s.borderRadius,
        noTint: bg === undefined || bg === 'transparent' || bg === c.surface })
        .toEqual({ ratio: (4 / 3).toFixed(3), width: 2, color: c.accent, radius: 14, noTint: true });
      const card = screen.getByTestId('share-card');
      expect({ left: inset(d, card, 'Left'), right: inset(d, card, 'Right'), top: inset(d, card, 'Top') }).toEqual({ left: 12, right: 12, top: 12 });
    });
  }
});

describe('SHARE-ST-12 inside the spot: tinted circle, icon, "Add photos", helper', () => {
  it('SHARE-ST-12 a parent, Easy view off: 72 px accent-tint circle, 32 px icon, "Add photos" 22 pt SemiBold accent, "Up to 100 at a time"', async () => {
    await start({ kv: prefs('chase', { easyView: false }) });
    const c = pal(false);
    const btn = target(100);
    const circle = (btn.findAll(isHost) as Inst[]).find((x) => { const s = flat(x.props.style); return s.width === 72 && s.height === 72; });
    expect(circle && { radius: flat(circle.props.style).borderRadius, fill: flat(circle.props.style).backgroundColor }).toEqual({ radius: 36, fill: c.accentSoft });
    const icon = circle!.findAll((x: Inst) => x.props.name !== undefined && x.props.tintColor !== undefined);
    // engineer, flagged for qa-tdd: SymbolView passes name/tintColor/size down through several nodes, so one icon shows
    // up more than once here; check they all say 32 (was toEqual([32]), which no SymbolView can meet).
    expect([...new Set(icon.map((i: Inst) => i.props.size))]).toEqual([32]);
    const add = btn.findAll((x: Inst) => x.type === Text && wordsIn(x) === 'Add photos')[0]!;
    const s = flat(add.props.style);
    expect({ size: s.fontSize, font: s.fontFamily, color: s.color }).toEqual({ size: 22, font: FONT.semibold, color: c.accent });
    expect(wordsIn(btn)).toBe('Add photos Up to 100 at a time');
  });

  it('SHARE-ST-12 a parent with Easy view on reads and hears "Up to 10 at a time"', async () => {
    await start({ kv: prefs('chase', { easyView: true }) });
    expect(wordsIn(target(10))).toBe('Add photos Up to 10 at a time');
    expect(screen.queryByText('Up to 100 at a time')).toBeNull();
  });

  it('SHARE-ST-12 a relative (Easy view off) reads and hears "Up to 10 at a time"', async () => {
    await start({ user: 'ruth', be: relativeCanPost(), kv: prefs('ruth', { easyView: false }) });
    expect(wordsIn(target(10))).toBe('Add photos Up to 10 at a time');
  });
});

describe('SHARE-ST-13 a decorative stamp in the corner', () => {
  it('SHARE-ST-13 44 x 52, rotated 4 degrees, postmark with today\'s day and month; not tappable, hidden from VoiceOver/TalkBack', async () => {
    await start();
    const stamp = screen.getByTestId('share-stamp', { includeHiddenElements: true });
    const s = flat(stamp.props.style);
    const rot = (Array.isArray(s.transform) ? (s.transform as Array<Record<string, unknown>>) : []).find((x) => 'rotate' in x);
    expect({ w: s.width, h: s.height, rot: rot?.rotate }).toEqual({ w: 44, h: 52, rot: '4deg' });
    expect({ hidden: stamp.props.accessibilityElementsHidden, important: stamp.props.importantForAccessibility, pe: stamp.props.pointerEvents ?? s.pointerEvents })
      .toEqual({ hidden: true, important: 'no-hide-descendants', pe: 'none' });
    expect(noPressUp(stamp)).toBe(true);
    const now = new Date();
    const words = wordsIn(stamp).toUpperCase();
    expect({ day: new RegExp(`\\b${now.getDate()}\\b`).test(words), month: words.includes(MONTHS[now.getMonth()]!) }).toEqual({ day: true, month: true });
    let inCard = false;
    for (let p: Inst | null = stamp; p; p = p.parent) if (p === screen.getByTestId('share-card')) inCard = true;
    expect(inCard).toBe(true);
  });
});

describe('SHARE-ST-14 the note and To: at full contrast', () => {
  const cases = [
    { name: 'light', p: { look: 'light' }, dark: false },
    { name: 'dark', p: { look: 'dark' }, dark: true },
    { name: 'Easy view', p: { look: 'light', easyView: true }, dark: false },
  ];
  for (const k of cases) {
    it(`SHARE-ST-14 (${k.name}) "Add a note (optional)" and the To: words: no lowered opacity, >= 4.5:1 on the surface`, async () => {
      await start({ kv: prefs('chase', k.p) });
      const c = pal(k.dark);
      for (const words of ['Add a note (optional)', TO]) {
        const t = screen.getByText(words, { includeHiddenElements: true });
        const color = String(flat(t.props.style).color);
        expect({ words, opacity: opacityOf(t), ok: contrast(color, c.surface) >= 4.5 }).toEqual({ words, opacity: 1, ok: true });
      }
    });
  }
});

describe('SHARE-ST-15 To: shows who it can go to', () => {
  it('SHARE-ST-15 a parent: "To: you pick after your photos", a 32 px face stack, one line of group names (no people)', async () => {
    await start();
    expect(screen.getByText(TO, { includeHiddenElements: true })).toBeTruthy();
    const faces = await screen.findByTestId('share-to-faces', { includeHiddenElements: true }, slow);
    const dots = (faces.findAll(isHost) as Inst[]).filter((x) => { const s = flat(x.props.style); return s.width === 32 && s.height === 32; });
    expect(dots.length).toBeGreaterThan(0);
    const names = await screen.findByTestId('share-to-names', { includeHiddenElements: true }, slow);
    const line = wordsIn(names) || String(names.props.children);
    expect({ everyone: /Everyone/.test(line), dad: /Dad's side/.test(line), mom: /Mom's side/.test(line), people: PEOPLE.test(line), lines: names.props.numberOfLines })
      .toEqual({ everyone: true, dad: true, mom: true, people: false, lines: 1 });
  });

  it('SHARE-ST-15 a relative: people\'s names (Chase, Alex), never a group title', async () => {
    await start({ user: 'ruth', be: relativeCanPost() });
    const names = await screen.findByTestId('share-to-names', { includeHiddenElements: true }, slow);
    const line = wordsIn(names) || String(names.props.children);
    expect({ chase: /Chase/.test(line), alex: /Alex/.test(line), groups: GROUPS.test(line), me: /Ruth/.test(line), lines: names.props.numberOfLines })
      .toEqual({ chase: true, alex: true, groups: false, me: false, lines: 1 });
  });

  it('SHARE-ST-15 the To: row is not a button and does nothing when tapped', async () => {
    const { pickBulk, pickPhotos } = await start();
    const row = await screen.findByTestId('share-to', { includeHiddenElements: true }, slow);
    expect(noPressUp(row)).toBe(true);
    fireEvent.press(row);
    fireEvent.press(screen.getByText(TO, { includeHiddenElements: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect({ bulk: pickBulk.mock.calls.length, photos: pickPhotos.mock.calls.length }).toEqual({ bulk: 0, photos: 0 });
    expect(target(100)).toBeTruthy();
  });
});

describe('SHARE-ST-16 "Last shared" under the card', () => {
  it('SHARE-ST-16 nothing sent yet: no "Last shared" line', async () => {
    await start();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/^Last shared/)).toBeNull();
    expect(screen.queryByTestId('share-last')).toBeNull();
  });

  it('SHARE-ST-16 a parent sends to Dad\'s side: back on the start, and on a fresh open, "Last shared today, to ... Dad\'s side"', async () => {
    const be = FakeBackend.withFixture();
    const kv = memoryKV();
    const { unmount } = await start({ be, kv, deps: { pickBulk: jest.fn(async () => ({ assets: assets(1) })) } });
    fireEvent.press(target(100));
    fireEvent.press(await screen.findByLabelText(/^Grandparents – Dad's side, \d+ people, not picked$/, {}, slow));
    fireEvent.press(screen.getByRole('button', { name: /^Send to / }));
    const want = /^Last shared (today|(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day), to (Grandparents – )?Dad's side$/;
    expect(await screen.findByText(want, {}, slow)).toBeTruthy();
    unmount();
    await start({ be, kv });
    const last = await screen.findByTestId('share-last', {}, slow);
    expect(wordsIn(last) || String(last.props.children)).toMatch(want);
  });

  it('SHARE-ST-16 a relative sends to Mom\'s side: the line names people, not the group', async () => {
    const be = relativeCanPost();
    const kv = memoryKV();
    const pickPhotos = jest.fn(async () => ({ items: items(1) }));
    await start({ user: 'ruth', be, kv, deps: { pickPhotos } });
    fireEvent.press(target(10));
    fireEvent.press(await screen.findByLabelText(/^(Alex and Chase|Chase and Alex), \d+ people, not picked$/, {}, slow));
    fireEvent.press(screen.getByRole('button', { name: /^Send to / }));
    expect(await screen.findByText(/^Last shared (today|\w+day), to (Alex and Chase|Chase and Alex)$/, {}, slow)).toBeTruthy();
  });
});

describe('SHARE-ST-17 press feedback on the photo spot', () => {
  it('SHARE-ST-17 pressIn scales to 0.98 over 120 ms; pressOut goes back to 1', async () => {
    await start();
    const calls = spyTiming();
    fireEvent(target(100), 'pressIn');
    expect(calls.filter((c) => c.toValue === 0.98).map((c) => c.duration)).toEqual([120]);
    fireEvent(target(100), 'pressOut');
    expect(calls[calls.length - 1]).toEqual({ toValue: 1, duration: 120 });
  });

  it('SHARE-ST-17 Reduce Motion on: no scale on press', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await start();
    await new Promise((r) => setTimeout(r, 20));
    const calls = spyTiming();
    fireEvent(target(100), 'pressIn');
    fireEvent(target(100), 'pressOut');
    expect(calls.filter((c) => Number(c.toValue) < 1)).toEqual([]);
    const scaledNodes = [target(100), ...(target(100).findAll(isHost) as Inst[])].filter((n) => {
      const tf = flat(n.props.style).transform as Array<Record<string, unknown>> | undefined;
      return Array.isArray(tf) && tf.some((x) => 'scale' in x && Number(x.scale) !== 1);
    });
    expect(scaledNodes).toHaveLength(0);
  });
});

describe('SHARE-ST-18 nothing moves on by itself', () => {
  const wait = () => new Promise((r) => setTimeout(r, 400));
  const posts = (be: FakeBackend) => Object.keys(be.state.posts).length;

  it('SHARE-ST-18 the start page never opens a picker by itself', async () => {
    const { pickBulk, pickPhotos } = await start();
    await wait();
    expect({ bulk: pickBulk.mock.calls.length, photos: pickPhotos.mock.calls.length }).toEqual({ bulk: 0, photos: 0 });
    expect(target(100)).toBeTruthy();
  });

  it('SHARE-ST-18 3 picked with a saved last audience: the postcard waits, nothing picked for you, nothing sent', async () => {
    const be = FakeBackend.withFixture();
    const kv = memoryKV({ [`hearth.lastAudience.v1.${FIXTURE.users.chase.id}`]: JSON.stringify([FIXTURE.circles.dadSide.id]) });
    await start({ be, kv, deps: { pickBulk: jest.fn(async () => ({ assets: assets(3) })) } });
    fireEvent.press(target(100));
    expect(await screen.findByText('1 of 3', {}, slow)).toBeTruthy();
    await wait();
    expect(screen.getByText('1 of 3')).toBeTruthy();
    expect(screen.queryAllByLabelText(/, picked$/)).toHaveLength(0);
    expect(posts(be)).toBe(0);
  });

  it('SHARE-ST-18 a parent picks 11: bulk review opens and waits for a tap; nothing picked or sent', async () => {
    const be = FakeBackend.withFixture();
    const kv = memoryKV({ [`hearth.lastAudience.v1.${FIXTURE.users.chase.id}`]: JSON.stringify([FIXTURE.circles.dadSide.id]) });
    await start({ be, kv, deps: { pickBulk: jest.fn(async () => ({ assets: assets(11) })) } });
    fireEvent.press(target(100));
    expect(await screen.findByRole('button', { name: 'Send 11 photos' }, slow)).toBeTruthy();
    await wait();
    expect(screen.getByRole('button', { name: 'Send 11 photos' })).toBeTruthy();
    expect(screen.queryAllByLabelText(/, picked$/)).toHaveLength(0);
    expect(posts(be)).toBe(0);
  });
});
