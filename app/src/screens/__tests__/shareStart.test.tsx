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
//
// grandparent-ux round on B+ (Nov 23): GUX-R1..R5, written first (red), Nov 23, by qa-tdd. They win over SHARE-ST-3's
// and SHARE-ST-15's "not tappable / does nothing", SHARE-ST-15's one line and parent face stack, and SHARE-ST-13's
// stamp placement and day-then-month order. Seams for the engineer:
//   - GUX-R1: pressing "Add a note (optional)" or the To: row ("share-to") on the empty postcard shows the Text
//     "Add photos first, then write your note and pick who sees it." where screen readers reach it (not inside the
//     hidden part), and announces it: AccessibilityInfo.announceForAccessibility(<that line>) or the line (or a host
//     parent) carries accessibilityLiveRegion "polite"/"assertive" or accessibilityRole "alert". No picker, no note
//     box, no group tiles, no Send open. The line is not shown before a tap.
//   - GUX-R2: "share-to-names" has numberOfLines 2 (never 1).
//   - GUX-R3: a parent's To: row has no "share-to-faces" (it lists groups); anyone else keeps the 32 px face stack.
//   - GUX-R4: the stamp's words read month first, then day ("NOV" above "23", or "Nov 23").
//   - GUX-R5: "share-stamp"'s nearest host parent is "share-card" (not the dashed spot or anything inside the spot
//     button); if absolute and top-anchored, its top + 52 stays at or above the spot's 12 px top inset (no overlap);
//     bottom-anchored or in normal flow outside the spot is fine.
//
// ===== Round 3, A "Quiet postcard", wordless (Chase, Nov 24, DEC-79 amended): SHARE-ST-19..27 =====
// Written first (red), Nov 24, by qa-tdd. They win over everything above where they differ. Superseded and removed
// from this file: SHARE-ST-3, SHARE-ST-10, SHARE-ST-11, SHARE-ST-12's 72 px circle and visible helper, SHARE-ST-13's
// placement, SHARE-ST-14, SHARE-ST-15, SHARE-ST-16, GUX-R1, GUX-R2, GUX-R3, GUX-R5 (and their seams above). Stand:
// SHARE-ST-1's title and card, SHARE-ST-2's one target and spoken label, SHARE-ST-4..7, SHARE-ST-17, SHARE-ST-18,
// GUX-R4. CONTRACT for the engineer (the round 3 tests find things by these):
//   - The whole empty card is the one button: pressing the host node "share-card" itself (its padding) must reach the
//     picker, so "share-card" is the Pressable's host or sits inside it. Role button, label "Add photos, up to N at a
//     time" ("Add photos or videos, ..." with videos on); N = 100 for a parent (owner/adult) with pickBulk and Easy
//     view off, else 10. Min 48 pt (expectGrandparentSafe reads its minHeight/height and width/flex/alignSelf). No
//     other host node in the card is focusable: no accessibilityRole, no accessible={true} (Text aside), no
//     responder/onPress handlers, no focusable. After photos, "share-card" is not a button (DEC-73 postcard unchanged).
//   - testID "share-spot": host View, aspectRatio 4/3, borderRadius 14, backgroundColor c.accentSoft (the accent
//     tint), no border (borderWidth 0 or unset, never borderStyle 'dashed'); outer edge 12 px in from "share-card" on
//     left, right and top (card padding + margins between add up to 12; see inset()). No fixed height, no overflow
//     hidden with a height.
//   - Inside the spot: a host View 76 x 76, borderRadius 38, backgroundColor c.surface, holding the add-photo icon
//     (name + tintColor props); then one Text "Add photos" (or "Add photos or videos"): fontSize 22, FONT.semibold,
//     c.accent; fontSize > 22 in Easy view; no numberOfLines. No "Up to N at a time" Text anywhere.
//   - testID "share-stamp" inside "share-spot": position 'absolute', numeric top and right (no left), 44 x 52,
//     rotate '4deg', accessibilityElementsHidden + importantForAccessibility "no-hide-descendants", no onPress of its
//     own; month then day ("NOV" "24"). pointerEvents "none" is fine (taps fall to the spot).
//   - Below the spot: testID "share-note-rule" x 2 (the note's blank ruled lines), a Text exactly "To:" and testID
//     "share-to-rule" x 1. All hidden from screen readers (a host ancestor with accessibilityElementsHidden or
//     importantForAccessibility "no-hide-descendants" or aria-hidden), none with pointerEvents "none"/"box-only" (a tap
//     on them must bubble to the card's onPress). "To:" opacity 1, >= 4.5:1 on c.surface in light, dark, Easy view.
//   - Gone from the empty start: any subline, "Add a note (optional)", "To: you pick after your photos", testIDs
//     "share-to", "share-to-faces", "share-to-names", "share-last", the "Last shared ..." line and the
//     "Add photos first, ..." line (GUX-R1). The empty card's words are only "Add photos", "To:" and the stamp's.
//   - Playwright SHARE-ST-27 (app/e2e-web/demo.spec.js) reads the same testIDs as data-testid on the web.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo, Animated, Image, Platform, StyleSheet, Text, TextInput } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV, type KV } from '../../platform/kv';
import type { PickedAsset } from '../../share/bulk';
import { expectGrandparentSafe, renderApp, screenWords, type FixtureUser } from '../../test/renderApp';
import type { AppDeps } from '../../state/AppContext';
import { FONT, THEME_NAMES, contrast, paletteFor, photoShadow } from '../../ui/theme';
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
  exif: { DateTimeOriginal: `2024:07:04 ${String(hour).padStart(2, '0')}:00:00`, OffsetTimeOriginal: '-04:00', GPSLatitude: 0.5123, GPSLongitude: -0.4567, Make: 'Apple' },
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
const TO = 'To:'; // SHARE-ST-23 (was "To: you pick after your photos", SHARE-ST-15; "To: pick after your photos", SHARE-ST-3)
const HIDDEN = { includeHiddenElements: true } as const;
const spotOf = () => screen.getByTestId('share-spot', HIDDEN);
/** Every word under `root`, hidden parts included. */
const allWords = () => wordsIn(screen.UNSAFE_root as unknown as Inst);
/** Opacity of a node times every host parent's. */
function opacityOf(node: Inst): number {
  let o = 1;
  for (let p: Inst | null = node; p; p = p.parent) if (isHost(p)) o *= Number(flat(p.props.style).opacity ?? 1);
  return o;
}
/** True when a host node at or above `node` hides it from VoiceOver/TalkBack. */
function hiddenFromReaders(node: Inst): boolean {
  for (let p: Inst | null = node; p; p = p.parent) {
    if (isHost(p) && (p.props.accessibilityElementsHidden === true || p.props.importantForAccessibility === 'no-hide-descendants' || p.props['aria-hidden'] === true)) return true;
  }
  return false;
}
const within = (node: Inst, top: Inst) => { for (let p: Inst | null = node; p; p = p.parent) if (p === top) return true; return false; };
/** The "Add photos" title Text(s) inside the spot. */
const titlesIn = (root: Inst) => root.findAll((x: Inst) => x.type === Text && /^Add photos( or videos)?$/.test(wordsIn(x))) as Inst[];

afterEach(() => jest.restoreAllMocks());

describe('SHARE-ST-1 the Share tab opens on "New post", an empty postcard', () => {
  for (const user of ['chase', 'ruth'] as const) {
    it(`SHARE-ST-1 ${user}: large title "New post", the DEC-73 card; none of the old start page (subline: SHARE-ST-19)`, async () => {
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
  // Retargeted Nov 24 for round 3 (SHARE-ST-20/24): the button is now the whole card, the words are "Add photos" only
  // (no visible "Up to N"), and the 4:3 shape is on "share-spot".
  it('SHARE-ST-2 a parent: icon and "Add photos" in the spot; spoken "Add photos, up to 100 at a time"; inside the card, where the big photo goes', async () => {
    await start();
    const btn = target(100);
    const spot = spotOf();
    expect(titlesIn(spot).map(wordsIn)).toEqual(['Add photos']);
    expect(spot.findAll((x: Inst) => x.props.name !== undefined && x.props.tintColor !== undefined).length).toBeGreaterThan(0); // the add-photo icon
    const card = screen.getByTestId('share-card');
    expect({ spotInCard: within(spot, card), spotInButton: within(spot, btn) }).toEqual({ spotInCard: true, spotInButton: true });
    // Same size and place as the postcard's big photo (4:3, first thing in the card).
    expect(Number(flat(spot.props.style).aspectRatio)).toBeCloseTo(4 / 3);
    expectGrandparentSafe();
    // Only one way in: no other button on the page starts a pick.
    expect(screen.getAllByRole('button').filter((b) => /photo/i.test(String(b.props.accessibilityLabel ?? '')))).toHaveLength(1);
  });

  it('SHARE-ST-2 an adult parent (Alex) also hears "up to 100 at a time" (no visible helper, SHARE-ST-20)', async () => {
    await start({ user: 'alex' });
    expect(target(100)).toBeTruthy();
    expect(screen.queryByText(/Up to \d+ at a time/, HIDDEN)).toBeNull();
  });

  it('SHARE-ST-2 a relative who can post hears "up to 10 at a time"', async () => {
    await start({ user: 'ruth', be: relativeCanPost() });
    expect(target(10)).toBeTruthy();
    expect(titlesIn(spotOf()).map(wordsIn)).toEqual(['Add photos']);
    expect(screen.queryByText(/Up to \d+ at a time/, HIDDEN)).toBeNull();
  });

  it('SHARE-ST-2 videos on: "Add photos or videos", spoken "Add photos or videos, up to 100 at a time"', async () => {
    await start({ be: videoOn() });
    await screen.findByRole('button', { name: 'Add photos or videos, up to 100 at a time' }, slow);
    expect(titlesIn(spotOf()).map(wordsIn)).toEqual(['Add photos or videos']);
  });

  for (const user of ['chase', 'jo'] as const) {
    it(`SHARE-ST-2 SHARE-ST-21 Easy view and Bigger text (${user}): "Add photos" stays inside the spot (no cut lines, no fixed height)`, async () => {
      const be = user === 'jo' ? relativeCanPost() : undefined;
      await start({ user, be, kv: prefs(user, { easyView: true, bigText: true }) });
      expect(target(10)).toBeTruthy();
      const spot = spotOf();
      const s = flat(spot.props.style);
      expect({ height: s.height, clipped: s.overflow === 'hidden' && s.height !== undefined }).toEqual({ height: undefined, clipped: false });
      const titles = titlesIn(spot);
      expect(titles).toHaveLength(1);
      for (const t of titles) {
        expect({ lines: t.props.numberOfLines, shrink: t.props.adjustsFontSizeToFit ?? false, size: Number(flat(t.props.style).fontSize) >= 21 })
          .toEqual({ lines: undefined, shrink: false, size: true });
      }
      expectGrandparentSafe();
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
    expect(screen.getByText(TO, HIDDEN)).toBeTruthy(); // SHARE-ST-23: "To:" stays, hidden from screen readers
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

// ---------- Round 2, B+ (DEC-79 amended): SHARE-ST-17, SHARE-ST-18 (SHARE-ST-10..16 superseded by round 3) ----------
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

// GUX-R1, GUX-R2, GUX-R3 and GUX-R5 (grandparent-ux on B+) are superseded by round 3 and removed.
describe('GUX-R4 P2 the stamp reads month, then day (US)', () => {
  it('GUX-R4 the month comes before the day in the stamp\'s words', async () => {
    await start();
    const now = new Date();
    const words = wordsIn(screen.getByTestId('share-stamp', { includeHiddenElements: true })).toUpperCase();
    const month = words.indexOf(MONTHS[now.getMonth()]!);
    const day = words.search(new RegExp(`\\b${now.getDate()}\\b`));
    expect({ words, monthFirst: month >= 0 && day >= 0 && month < day }).toEqual({ words, monthFirst: true });
  });
});

// ---------- Round 3, A "Quiet postcard", wordless (Chase, Nov 24, DEC-79 amended): SHARE-ST-19..26 ----------
// SHARE-ST-27 is Playwright in app/e2e-web/demo.spec.js. Contract at the top of this file.
const SUBLINES = ['Only the people you pick will see it.', 'For your family, nobody else.'];
const GONE = [/Add a note \(optional\)/, /To: you pick after your photos/, /To: pick after your photos/, /Up to \d+ at a time/, /^Last shared/, /Add photos first/, /^Your groups/];
/** The empty card's words, hidden parts included, as a sorted list of tokens. */
function cardTokens(): string[] {
  return wordsIn(screen.getByTestId('share-card')).split(' ').filter(Boolean).map((w) => w.toUpperCase()).sort();
}
function allowedTokens(title = 'Add photos'): string[] {
  const now = new Date();
  return [...title.toUpperCase().split(' '), 'TO:', MONTHS[now.getMonth()]!, String(now.getDate())].sort();
}
/** Host nodes in the card that a screen reader or keyboard could stop on, other than the one button. */
function extraStops(btn: Inst): Inst[] {
  const card = screen.getByTestId('share-card');
  const nodes = [card, ...(card.findAll(isHost) as Inst[])].filter(isHost);
  return nodes.filter((n) => n !== btn && (
    (n.props.accessible === true && String(n.type) !== 'Text')
    || (n.props.accessibilityRole !== undefined && n.props.accessibilityRole !== 'none')
    || n.props.role !== undefined
    || typeof n.props.onResponderGrant === 'function' || typeof n.props.onClick === 'function' || typeof n.props.onPress === 'function'
    || n.props.focusable === true));
}

describe('SHARE-ST-19 "New post" with no subline', () => {
  for (const user of ['chase', 'ruth'] as const) {
    it(`SHARE-ST-19 ${user}: the large title "New post" (header) and no subline at all`, async () => {
      await start({ user, be: user === 'ruth' ? relativeCanPost() : undefined });
      expect(screen.getByRole('header', { name: 'New post' })).toBeTruthy();
      for (const s of SUBLINES) expect({ s, found: screen.queryByText(s, HIDDEN) !== null }).toEqual({ s, found: false });
    });
  }
});

describe('SHARE-ST-20 the photo spot: accent tint, no border, a surface circle, "Add photos"', () => {
  for (const dark of [false, true]) {
    // Retargeted Nov 24 for round 4 (SHARE-ST-29, DEC-84): the circle is 52 px (radius 26) and "Add photos" is headline
    // (17 / 22 SemiBold) in the accent; was 76 px and 22 pt.
    it(`SHARE-ST-20 SHARE-ST-29 (${dark ? 'dark' : 'light'}) 4:3, 14 px corners, 12 px in, accent tint fill, no border; 52 px surface circle with the icon; "Add photos" headline 17 / 22 SemiBold accent; no "Up to N"`, async () => {
      await start({ kv: prefs('chase', { look: dark ? 'dark' : 'light' }) });
      const c = pal(dark);
      const btn = target(100);
      const spot = spotOf();
      const s = flat(spot.props.style);
      expect({ ratio: Number(s.aspectRatio).toFixed(3), radius: s.borderRadius, fill: s.backgroundColor, border: Number(s.borderWidth ?? 0), dashed: s.borderStyle === 'dashed' })
        .toEqual({ ratio: (4 / 3).toFixed(3), radius: 14, fill: c.accentSoft, border: 0, dashed: false });
      const anyDashed = [btn, ...(btn.findAll(isHost) as Inst[])].filter(isHost).some((x) => flat(x.props.style).borderStyle === 'dashed');
      expect(anyDashed).toBe(false);
      const card = screen.getByTestId('share-card');
      expect({ left: inset(spot, card, 'Left'), right: inset(spot, card, 'Right'), top: inset(spot, card, 'Top') }).toEqual({ left: 12, right: 12, top: 12 });
      const circle = (spot.findAll(isHost) as Inst[]).find((x) => { const z = flat(x.props.style); return z.width === 52 && z.height === 52; });
      expect(circle && { radius: flat(circle.props.style).borderRadius, fill: flat(circle.props.style).backgroundColor }).toEqual({ radius: 26, fill: c.surface });
      expect(circle!.findAll((x: Inst) => x.props.name !== undefined && x.props.tintColor !== undefined).length).toBeGreaterThan(0);
      const title = titlesIn(spot)[0];
      const ts = flat(title?.props.style);
      expect({ size: ts.fontSize, line: ts.lineHeight, font: ts.fontFamily, color: ts.color }).toEqual({ size: 17, line: 22, font: FONT.semibold, color: c.accent });
      expect(screen.queryByText(/Up to \d+ at a time/, HIDDEN)).toBeNull();
    });
  }

  // Retargeted Nov 24 (SHARE-ST-29): Easy view is headline's 21 / 26 and a 60 px circle (was "larger than 22").
  it('SHARE-ST-20 SHARE-ST-29 Easy view: "Add photos" is 21 / 26; the circle is 60 px', async () => {
    await start({ kv: prefs('chase', { easyView: true }) });
    const title = titlesIn(spotOf())[0];
    expect({ size: flat(title?.props.style).fontSize, line: flat(title?.props.style).lineHeight }).toEqual({ size: 21, line: 26 });
    const circle = (spotOf().findAll(isHost) as Inst[]).find((x) => { const z = flat(x.props.style); return z.width === 60 && z.height === 60; });
    expect(circle && flat(circle.props.style).borderRadius).toBe(30);
  });
});

describe('SHARE-ST-21 the one spoken label keeps the limit', () => {
  const cases = [
    { name: 'a parent, Easy view off', user: 'chase' as const, p: { easyView: false }, n: 100 },
    { name: 'an adult parent (Alex)', user: 'alex' as const, p: {}, n: 100 },
    { name: 'a parent, Easy view on', user: 'chase' as const, p: { easyView: true }, n: 10 },
    { name: 'a relative, Easy view off', user: 'ruth' as const, p: { easyView: false }, n: 10 },
  ];
  for (const k of cases) {
    it(`SHARE-ST-21 ${k.name}: spoken "Add photos, up to ${k.n} at a time", shown "Add photos" only`, async () => {
      await start({ user: k.user, be: k.user === 'ruth' ? relativeCanPost() : undefined, kv: prefs(k.user, k.p) });
      const btn = target(k.n);
      expect(within(spotOf(), btn)).toBe(true);
      expect(screen.queryByText(/Up to \d+ at a time/, HIDDEN)).toBeNull();
    });
  }
});

describe('SHARE-ST-22 the stamp sits top-right inside the photo spot', () => {
  it('SHARE-ST-22 44 x 52, 4 degrees, month then day; inside "share-spot", top-right; decorative and hidden; a tap on it opens the picker', async () => {
    const { pickBulk } = await start();
    const stamp = screen.getByTestId('share-stamp', HIDDEN);
    const s = flat(stamp.props.style);
    const rot = (Array.isArray(s.transform) ? (s.transform as Array<Record<string, unknown>>) : []).find((x) => 'rotate' in x);
    expect({ w: s.width, h: s.height, rot: rot?.rotate }).toEqual({ w: 44, h: 52, rot: '4deg' });
    expect({ hidden: stamp.props.accessibilityElementsHidden, important: stamp.props.importantForAccessibility })
      .toEqual({ hidden: true, important: 'no-hide-descendants' });
    expect({ inSpot: within(stamp, spotOf()), inButton: within(stamp, target(100)) }).toEqual({ inSpot: true, inButton: true });
    expect({ pos: s.position, top: typeof s.top, right: typeof s.right, left: s.left }).toEqual({ pos: 'absolute', top: 'number', right: 'number', left: undefined });
    expect(stamp.findAll((x: Inst) => typeof x.props.onPress === 'function')).toHaveLength(0);
    const now = new Date();
    const words = wordsIn(stamp).toUpperCase();
    const month = words.indexOf(MONTHS[now.getMonth()]!);
    const day = words.search(new RegExp(`\\b${now.getDate()}\\b`));
    expect({ words, monthFirst: month >= 0 && day >= 0 && month < day }).toEqual({ words, monthFirst: true });
    // pointerEvents "none" lets a real tap fall through to the spot (in the button); otherwise the tap must bubble up.
    if ((stamp.props.pointerEvents ?? s.pointerEvents) !== 'none') {
      fireEvent.press(stamp);
      await waitFor(() => expect(pickBulk).toHaveBeenCalledTimes(1));
    }
  });
});

describe('SHARE-ST-23 below the spot: two blank ruled lines, "To:" and one ruled line, all decoration', () => {
  const cases = [
    { name: 'light', p: { look: 'light' }, dark: false },
    { name: 'dark', p: { look: 'dark' }, dark: true },
    { name: 'Easy view', p: { look: 'light', easyView: true }, dark: false },
  ];
  for (const k of cases) {
    it(`SHARE-ST-23 (${k.name}) 2 note rules, "To:" (>= 4.5:1, full opacity), 1 To: rule; all hidden from VoiceOver/TalkBack; none of the old words`, async () => {
      await start({ kv: prefs('chase', k.p) });
      const c = pal(k.dark);
      const card = screen.getByTestId('share-card');
      const noteRules = screen.queryAllByTestId('share-note-rule', HIDDEN);
      const toRules = screen.queryAllByTestId('share-to-rule', HIDDEN);
      expect({ note: noteRules.length, to: toRules.length }).toEqual({ note: 2, to: 1 });
      const to = screen.getByText(TO, HIDDEN);
      for (const n of [...noteRules, ...toRules, to]) {
        expect({ id: n.props.testID ?? wordsIn(n), inCard: within(n, card), hidden: hiddenFromReaders(n), blank: n.props.testID ? wordsIn(n) === '' : true })
          .toEqual({ id: n.props.testID ?? wordsIn(n), inCard: true, hidden: true, blank: true });
      }
      const color = String(flat(to.props.style).color);
      expect({ opacity: opacityOf(to), ok: contrast(color, c.surface) >= 4.5 }).toEqual({ opacity: 1, ok: true });
      // The note area and To: come after the spot (below it), not inside it.
      expect({ noteInSpot: noteRules.some((r) => within(r, spotOf())), toInSpot: within(to, spotOf()) }).toEqual({ noteInSpot: false, toInSpot: false });
      for (const g of GONE) expect({ g: String(g), found: screen.queryAllByText(g, HIDDEN).length }).toEqual({ g: String(g), found: 0 });
      expect(allWords()).not.toMatch(/Everyone|Dad's side|Mom's side|Grandparents|Grandma Jo|Nana Ruth|Grandpa Earl|Alex/);
      for (const id of ['share-to', 'share-to-faces', 'share-to-names', 'share-last']) {
        expect({ id, found: screen.queryAllByTestId(id, HIDDEN).length }).toEqual({ id, found: 0 });
      }
      expect(screen.queryAllByRole('checkbox').length + screen.queryAllByRole('switch').length).toBe(0);
      expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
      expect(screen.queryByRole('button', { name: /^(Send to |Pick who gets it$)/ })).toBeNull();
      // The empty card's words are only "Add photos", "To:" and the stamp's month and day.
      expect(cardTokens()).toEqual(allowedTokens());
    });
  }
});

describe('SHARE-ST-24 a tap anywhere on the empty card opens the picker; the card is one element', () => {
  for (const user of ['chase', 'ruth'] as const) {
    it(`SHARE-ST-24 ${user}: spot, ruled lines, "To:" and the card's padding each open the picker; no "Add photos first" hint`, async () => {
      const be = user === 'ruth' ? relativeCanPost() : undefined;
      const { pickBulk, pickPhotos } = await start({ user, be });
      const picks = () => pickBulk.mock.calls.length + pickPhotos.mock.calls.length;
      const parts: Array<[string, () => Inst]> = [
        ['the spot', () => spotOf()],
        ['the first note rule', () => screen.getAllByTestId('share-note-rule', HIDDEN)[0]!],
        ['the second note rule', () => screen.getAllByTestId('share-note-rule', HIDDEN)[1]!],
        ['"To:"', () => screen.getByText(TO, HIDDEN)],
        ['the To: rule', () => screen.getByTestId('share-to-rule', HIDDEN)],
        ['the card padding', () => screen.getByTestId('share-card')],
      ];
      let want = 0;
      for (const [name, part] of parts) {
        fireEvent.press(part());
        want += 1;
        await waitFor(() => expect({ name, picks: picks() }).toEqual({ name, picks: want }));
        expect(screen.queryByText(/Add photos first/, HIDDEN)).toBeNull();
        expect(target(user === 'chase' ? 100 : 10)).toBeTruthy(); // Cancel in the picker: still the empty card
      }
      expect(user === 'chase' ? pickPhotos.mock.calls.length : pickBulk.mock.calls.length).toBe(0);
    });
  }

  it('SHARE-ST-24 the card is one accessible element: one button (>= 48 pt), nothing inside it separately focusable', async () => {
    await start();
    const btn = target(100);
    expect(within(screen.getByTestId('share-card'), btn) || within(btn, screen.getByTestId('share-card'))).toBe(true);
    const extra = extraStops(btn).map((n) => `${String(n.type)} ${String(n.props.testID ?? n.props.accessibilityLabel ?? n.props.accessibilityRole ?? '')}`);
    expect(extra).toEqual([]);
    expectGrandparentSafe();
  });

  it('SHARE-ST-24 SHARE-ST-17 a press on "To:" gives the same 0.98 scale over 120 ms; none with Reduce Motion', async () => {
    // engineer, flagged for qa-tdd: SHARE-ST-17's Reduce Motion case sets RN's mocked isReduceMotionEnabled to true and
    // restoreAllMocks doesn't undo it on that preset mock, so say "off" here or this case depends on test order.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    await start();
    const calls = spyTiming();
    fireEvent(screen.getByText(TO, HIDDEN), 'pressIn');
    expect(calls.filter((c) => c.toValue === 0.98).map((c) => c.duration)).toEqual([120]);
    fireEvent(screen.getByText(TO, HIDDEN), 'pressOut');
    expect(calls[calls.length - 1]).toEqual({ toValue: 1, duration: 120 });
  });
});

describe('SHARE-ST-25 no words under the card', () => {
  it('SHARE-ST-25 a parent sends to Dad\'s side: back on the start and on a fresh open, no "Last shared" line and no words under the card', async () => {
    const be = FakeBackend.withFixture();
    const kv = memoryKV();
    const { unmount } = await start({ be, kv, deps: { pickBulk: jest.fn(async () => ({ assets: assets(1) })) } });
    fireEvent.press(target(100));
    fireEvent.press(await screen.findByLabelText(/^Grandparents – Dad's side, \d+ people, not picked$/, {}, slow));
    fireEvent.press(screen.getByRole('button', { name: /^Send to / }));
    await screen.findByTestId('share-spot', HIDDEN, slow);
    await waitFor(() => expect(Object.values(be.state.posts).filter((p) => p.status === 'published')).toHaveLength(1), slow);
    await new Promise((r) => setTimeout(r, 50));
    expect({ last: screen.queryAllByText(/^Last shared/, HIDDEN).length, id: screen.queryAllByTestId('share-last', HIDDEN).length }).toEqual({ last: 0, id: 0 });
    unmount();
    await start({ be, kv });
    await new Promise((r) => setTimeout(r, 50));
    expect({ last: screen.queryAllByText(/^Last shared/, HIDDEN).length, id: screen.queryAllByTestId('share-last', HIDDEN).length }).toEqual({ last: 0, id: 0 });
    expect(cardTokens()).toEqual(allowedTokens());
  });

  it('SHARE-ST-25 a saved last audience at open: still no line and the page words are only "New post" and the card\'s', async () => {
    const kv = memoryKV({
      [`hearth.lastAudience.v1.${FIXTURE.users.chase.id}`]: JSON.stringify([FIXTURE.circles.dadSide.id]),
      [`hearth.lastShared.v1.${FIXTURE.users.chase.id}`]: JSON.stringify({ at: new Date().toISOString(), ids: [FIXTURE.circles.dadSide.id] }),
    });
    await start({ kv });
    await new Promise((r) => setTimeout(r, 50));
    const page = allWords().split(' ').filter(Boolean).map((w) => w.toUpperCase()).sort();
    expect(page).toEqual(['NEW', 'POST', ...allowedTokens()].sort());
  });
});

describe('SHARE-ST-26 after a pick, the DEC-73 postcard opens unchanged', () => {
  it('SHARE-ST-26 a parent picks 3: the postcard with its note box, To: tiles and Send; the card is no longer a button; nothing picked for you', async () => {
    await start({ deps: { pickBulk: jest.fn(async () => ({ assets: assets(3) })) } });
    fireEvent.press(screen.getByTestId('share-card'));
    expect(await screen.findByText('1 of 3', {}, slow)).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(TextInput).length).toBeGreaterThan(0);
    const tile = await screen.findByLabelText(/^Grandparents – Dad's side, \d+ people, not picked$/, {}, slow);
    expect(screen.queryAllByLabelText(/, picked$/)).toHaveLength(0);
    let cardIsButton = false;
    for (let p: Inst | null = screen.getByTestId('share-card'); p; p = p.parent) if (p.props.accessibilityRole === 'button' || typeof p.props.onPress === 'function') cardIsButton = true;
    expect(cardIsButton).toBe(false);
    expect(screen.queryByTestId('share-spot', HIDDEN)).toBeNull();
    fireEvent.press(tile);
    expect(screen.getByRole('button', { name: /^Send to / })).toBeTruthy();
  });
});

// ===== grandparent-ux on round 3 (Nov 24): GUX-W1..W5, written first (red), Nov 24, by qa-tdd =====
// Amendments to SHARE-ST-19..27 (SPEC-REDESIGN 1j-2 Round 3). CONTRACT for the engineer:
//   - GUX-W1: on the empty start, "share-card" sits inside a host View testID "share-empty-wrap" with flex 1 and
//     justifyContent 'center', placed after the "New post" header (the header is not inside it); the page's ScrollView
//     contentContainerStyle has flexGrow 1 while empty, so the wrap fills the space down to the tab bar. "share-spot"
//     keeps aspectRatio 4/3.
//   - GUX-W2: the filled postcard also carries "share-stamp": inside "share-card", in the same host View as the big
//     photo (the Image "Photo 1 of N" / "Your photo"), position 'absolute', numeric top and right (no left), hidden from
//     screen readers (accessibilityElementsHidden + importantForAccessibility "no-hide-descendants"), no onPress.
//   - GUX-W3: "New post" sits in one host row View (flexDirection 'row') in both states; after photos, the
//     "Cancel this post" button is inside that same row (no separate Cancel row above the header).
//   - GUX-W4: "share-note-rule" and "share-to-rule" backgroundColor is the theme token c.tabLine (3.26:1 light,
//     3.04:1 dark on c.surface), opaque, opacity 1 up the tree; >= 1.5:1 on c.surface in light and dark. c.line
//     (1.34:1 / 1.23:1) fails; no alpha or opacity tricks on c.muted.
//   - GUX-W5: the filled note field keeps its label/spoken name "Add a note (optional)"; its placeholder is unset or
//     exactly "Add a note (optional)"; no "Like:" text or placeholder anywhere.
const hostParent = (n: Inst): Inst | null => { for (let p = n.parent; p; p = p.parent) if (isHost(p)) return p; return null; };
async function filled(count = 3) {
  const r = await start({ deps: { pickBulk: jest.fn(async () => ({ assets: assets(count) })) } });
  fireEvent.press(screen.getByTestId('share-card'));
  await screen.findByText(`1 of ${count}`, {}, slow);
  return r;
}
/** The host row View that holds the "New post" header. */
function headerRow(): Inst | null {
  const h = screen.getByRole('header', { name: 'New post' });
  for (let p = hostParent(h); p; p = hostParent(p)) if (flat(p.props.style).flexDirection === 'row') return p;
  return null;
}

describe('GUX-W1 P1 the empty postcard sits in the middle of the space under "New post"', () => {
  it('GUX-W1 "share-card" is in "share-empty-wrap" (flex 1; top-aligned per GUX-T2), after the header; the page content can grow; the spot stays 4:3', async () => {
    await start();
    const wrap = screen.queryByTestId('share-empty-wrap', HIDDEN);
    expect(wrap).not.toBeNull();
    const s = flat(wrap!.props.style);
    // GUX-T2 (Nov 24) supersedes the centring: flex 1 stays, the card is top-aligned (GUX-T2 below checks justifyContent).
    expect(s.flex).toBe(1);
    expect({ cardIn: within(screen.getByTestId('share-card'), wrap!), headerIn: within(screen.getByRole('header', { name: 'New post' }), wrap!) })
      .toEqual({ cardIn: true, headerIn: false });
    let grows = false;
    for (let p: Inst | null = wrap; p; p = p.parent) if (p.props.contentContainerStyle !== undefined) { grows = flat(p.props.contentContainerStyle).flexGrow === 1; break; }
    expect(grows).toBe(true);
    expect(Number(flat(spotOf().props.style).aspectRatio)).toBeCloseTo(4 / 3);
  });
});

describe('GUX-W2 P1 the stamp stays on the filled postcard', () => {
  it('GUX-W2 3 picked: "share-stamp" top-right over the big photo, inside the card, hidden from screen readers, no onPress', async () => {
    await filled(3);
    const stamp = screen.queryByTestId('share-stamp', HIDDEN);
    expect(stamp).not.toBeNull();
    const s = flat(stamp!.props.style);
    const photo = screen.getByLabelText('Photo 1 of 3');
    const photoBox = hostParent(photo)!;
    expect({ inCard: within(stamp!, screen.getByTestId('share-card')), overPhoto: within(stamp!, photoBox) }).toEqual({ inCard: true, overPhoto: true });
    expect({ pos: s.position, top: typeof s.top, right: typeof s.right, left: s.left }).toEqual({ pos: 'absolute', top: 'number', right: 'number', left: undefined });
    expect({ hidden: stamp!.props.accessibilityElementsHidden, important: stamp!.props.importantForAccessibility }).toEqual({ hidden: true, important: 'no-hide-descendants' });
    expect(stamp!.findAll((x: Inst) => typeof x.props.onPress === 'function')).toHaveLength(0);
  });
});

describe('GUX-W3 P2 "New post" does not move when photos arrive', () => {
  it('GUX-W3 the header sits in a row on the empty start and after photos; Cancel joins that same row', async () => {
    await start({ deps: { pickBulk: jest.fn(async () => ({ assets: assets(3) })) } });
    expect(headerRow()).not.toBeNull();
    fireEvent.press(screen.getByTestId('share-card'));
    await screen.findByRole('button', { name: 'Cancel this post' }, slow);
    const row = headerRow();
    expect(row).not.toBeNull();
    expect(within(screen.getByRole('button', { name: 'Cancel this post' }), row!)).toBe(true);
  }, 10000);
});

describe('GUX-W4 P2 the ruled lines are visible (>= 1.5:1 on the card)', () => {
  for (const dark of [false, true]) {
    it(`GUX-W4 (${dark ? 'dark' : 'light'}) note and To: rules use c.tabLine, opaque, >= 1.5:1 on c.surface`, async () => {
      await start({ kv: prefs('chase', { look: dark ? 'dark' : 'light' }) });
      const c = pal(dark);
      const rules = [...screen.getAllByTestId('share-note-rule', HIDDEN), ...screen.getAllByTestId('share-to-rule', HIDDEN)];
      expect(rules).toHaveLength(3);
      for (const r of rules) {
        const color = String(flat(r.props.style).backgroundColor);
        const ratio = /^#[0-9A-Fa-f]{6}$/.test(color) ? contrast(color, c.surface) : 0;
        expect({ id: r.props.testID, color, enough: ratio >= 1.5, opacity: opacityOf(r) })
          .toEqual({ id: r.props.testID, color: c.tabLine, enough: true, opacity: 1 });
      }
    });
  }
});

describe('GUX-W5 P2 the filled note field has no example hint', () => {
  it('GUX-W5 no "Like:" anywhere; the note field still reads "Add a note (optional)"', async () => {
    await filled(3);
    const input = screen.getByLabelText('Add a note (optional)');
    expect([undefined, '', 'Add a note (optional)']).toContain(input.props.placeholder);
    expect(screen.UNSAFE_queryAllByType(TextInput).filter((x) => /Like:/.test(String(x.props.placeholder ?? '')))).toHaveLength(0);
    expect(allWords()).not.toMatch(/Like:/);
  });
});

// ===== Round 4, A with standard iPhone sizes plus the kinds row (Chase, Nov 24, DEC-84): SHARE-ST-28..33 =====
// docs/product/SPEC-REDESIGN.md 1j-2 round 4 and docs/product/SPEC-TYPE.md. Written first (red), Nov 24, by qa-tdd.
// They win over SHARE-ST-19's large title and SHARE-ST-20's 76 px circle / 22 pt words (retargeted above).
// CONTRACT for the engineer (on top of typeScale.test.tsx's header):
//   - "New post": Txt variant "title2", role header, in the GUX-W3 row.
//   - Empty card: circle 52 x 52 (Easy view 60 x 60), borderRadius half, c.surface; the add-photo SystemIcon size 26
//     (Easy view 30) before iconSize's phone scale; "Add photos" headline (17 / 22, Easy 21 / 26) in c.accent.
//   - Feature switch: the kinds row shows only when app.features includes 'post_kinds' AND app.space.role is 'owner'
//     or 'adult'. Off, or anyone else: no testID "share-kinds" and none of the three labels anywhere.
//   - testID "share-kinds": a host View after (not inside) "share-card" in the empty start; flexDirection 'row' with
//     Easy view off, 'column' with it on. In it, in order, three Pressables, testID "share-kind-event" / "-news" /
//     "-saying", role button, labels "Add an event", "Share news", "Add a saying"; each backgroundColor c.surface,
//     borderRadius 16, minHeight >= 48 (Easy view >= 60), flex 1 when in a row (equal widths); in Easy view each
//     tile is flexDirection 'row' (icon left of the word) and full width (alignSelf 'stretch' or width '100%' or no
//     fixed width). Each holds an icon (name + tintColor props) and one Text, testID "share-kind-word-<kind>",
//     "Event" / "News" / "Saying", headline (17 / 22 SemiBold; Easy 21 / 26; GUX-SK-R9 superseded subheadline),
//     no numberOfLines, no adjustsFontSizeToFit.
//   - Tapping a tile shows that kind's empty card face (tester option A), testID "share-kind-card-<kind>", in place
//     of the empty photo card and the kinds row; "New post" stays. Fields (TextInput, accessibilityLabel):
//     event "What's happening", "What day" (GUX-SK-R1 renamed "When"), "Where, optional"; news "Your news"; saying "What they said",
//     "Who said it", "Age then, optional". Each card shows "To:" and a disabled button "Pick who gets it".
//     Nothing is sent or created by the tap.
const KINDS = [
  { k: 'event', word: 'Event', label: 'Add an event', fields: ["What's happening", 'What day', 'Where, optional'] },
  { k: 'news', word: 'News', label: 'Share news', fields: ['Your news'] },
  { k: 'saying', word: 'Saying', label: 'Add a saying', fields: ['What they said', 'Who said it', 'Age then, optional'] },
] as const;
/** The post_kinds switch on for everyone the server would ask about (the screen must still gate by role). */
function kindsOn(be = FakeBackend.withFixture()): FakeBackend {
  const real = be.myFeatures.bind(be);
  jest.spyOn(be, 'myFeatures').mockImplementation((u, sp) => [...real(u, sp), 'post_kinds'].sort());
  return be;
}
const order = (a: Inst, b: Inst) => {
  const all = screen.UNSAFE_root.findAll(isHost) as Inst[];
  return all.indexOf(a) < all.indexOf(b);
};
const noKinds = () => {
  expect(screen.queryByTestId('share-kinds', HIDDEN)).toBeNull();
  for (const K of KINDS) expect({ K: K.k, found: screen.queryByRole('button', { name: K.label }) !== null }).toEqual({ K: K.k, found: false });
  expect(allWords()).not.toMatch(/\b(Event|News|Saying)\b/);
};

describe('SHARE-ST-28 "New post" is title2', () => {
  for (const easy of [false, true]) {
    it(`SHARE-ST-28 (${easy ? 'Easy view' : 'Standard'}) "New post" is ${easy ? '26 / 32' : '22 / 28'} SemiBold, a header, in the GUX-W3 row`, async () => {
      await start({ kv: prefs('chase', { easyView: easy }) });
      const h = screen.getByRole('header', { name: 'New post' });
      const st = flat(h.props.style);
      expect({ size: st.fontSize, line: st.lineHeight, font: st.fontFamily }).toEqual({ size: easy ? 26 : 22, line: easy ? 32 : 28, font: FONT.semibold });
    });
  }
});

describe('SHARE-ST-29 the empty card at standard sizes', () => {
  it('SHARE-ST-29 the add-photo icon in the circle is 26 (30 in Easy view)', async () => {
    for (const easy of [false, true]) {
      const r = await start({ kv: prefs('chase', { easyView: easy }) });
      const want = easy ? 60 : 52;
      const circle = (spotOf().findAll(isHost) as Inst[]).find((x) => { const z = flat(x.props.style); return z.width === want && z.height === want; });
      const icon = circle?.findAll((x: Inst) => x.props.tintColor !== undefined && typeof x.props.size === 'number')[0];
      expect({ easy, size: icon?.props.size }).toEqual({ easy, size: easy ? 30 : 26 });
      r.unmount();
    }
  });
});

describe('SHARE-ST-30 post_kinds off: no kind tiles for anyone', () => {
  for (const user of ['chase', 'alex', 'ruth'] as const) {
    it(`SHARE-ST-30 ${user}: the switch off (default), no Event, News or Saying tile`, async () => {
      await start({ user, be: user === 'ruth' ? relativeCanPost() : undefined });
      noKinds();
      expect(target()).toBeTruthy();
    });
  }
});

describe('SHARE-ST-31 post_kinds on, a parent: three tiles under the postcard', () => {
  for (const user of ['chase', 'alex'] as const) {
    it(`SHARE-ST-31 ${user}: "share-kinds" after the card, a row of Event, News, Saying; surface, 16 px corners, >= 48 pt, equal widths; headline words (GUX-SK-R9); spoken labels`, async () => {
      await start({ user, be: kindsOn(), kv: prefs(user, { easyView: false }) });
      const c = pal(false);
      const row = await screen.findByTestId('share-kinds', {}, slow);
      const card = screen.getByTestId('share-card');
      expect({ inside: within(row, card), after: order(card, row), dir: flat(row.props.style).flexDirection }).toEqual({ inside: false, after: true, dir: 'row' });
      const tiles = KINDS.map((K) => screen.getByTestId(`share-kind-${K.k}`));
      expect(tiles.every((t) => within(t, row))).toBe(true);
      expect(order(tiles[0]!, tiles[1]!) && order(tiles[1]!, tiles[2]!)).toBe(true);
      for (const [i, K] of KINDS.entries()) {
        const t = tiles[i]!;
        expect(screen.getByRole('button', { name: K.label })).toBe(t);
        const st = flat(t.props.style);
        expect({ k: K.k, fill: st.backgroundColor, radius: st.borderRadius, tall: Number(st.minHeight ?? st.height ?? 0) >= 48, flex: st.flex })
          .toEqual({ k: K.k, fill: c.surface, radius: 16, tall: true, flex: 1 });
        expect(t.findAll((x: Inst) => x.props.name !== undefined && x.props.tintColor !== undefined).length).toBeGreaterThan(0);
        const w = screen.getByTestId(`share-kind-word-${K.k}`);
        const ws = flat(w.props.style);
        expect({ k: K.k, words: wordsIn(w) || String(w.props.children), size: ws.fontSize, line: ws.lineHeight, font: ws.fontFamily, lines: w.props.numberOfLines, shrink: w.props.adjustsFontSizeToFit ?? false })
          .toEqual({ k: K.k, words: K.word, size: 17, line: 22, font: FONT.semibold, lines: undefined, shrink: false });
        expect(within(w, t)).toBe(true);
      }
      expectGrandparentSafe();
    });
  }
});

describe('SHARE-ST-32 post_kinds on, a parent with Easy view: the tiles stack', () => {
  it('SHARE-ST-32 one tile per row, full width, icon left of the word, >= 60 pt; same order and labels; words headline 21 / 26 (GUX-SK-R9), never cut', async () => {
    await start({ be: kindsOn(), kv: prefs('chase', { easyView: true }) });
    const row = await screen.findByTestId('share-kinds', {}, slow);
    expect(flat(row.props.style).flexDirection).toBe('column');
    const tiles = KINDS.map((K) => screen.getByTestId(`share-kind-${K.k}`));
    expect(order(tiles[0]!, tiles[1]!) && order(tiles[1]!, tiles[2]!)).toBe(true);
    for (const [i, K] of KINDS.entries()) {
      const t = tiles[i]!;
      expect(screen.getByRole('button', { name: K.label })).toBe(t);
      const st = flat(t.props.style);
      const full = st.alignSelf === 'stretch' || st.width === '100%' || (st.width === undefined && st.alignSelf === undefined);
      expect({ k: K.k, dir: st.flexDirection, tall: Number(st.minHeight ?? st.height ?? 0) >= 60, full }).toEqual({ k: K.k, dir: 'row', tall: true, full: true });
      const w = screen.getByTestId(`share-kind-word-${K.k}`);
      const ws = flat(w.props.style);
      expect({ size: ws.fontSize, line: ws.lineHeight, font: ws.fontFamily, lines: w.props.numberOfLines, shrink: w.props.adjustsFontSizeToFit ?? false }).toEqual({ size: 21, line: 26, font: FONT.semibold, lines: undefined, shrink: false });
    }
  });
});

describe('SHARE-ST-33 post_kinds on, not a parent: no tiles', () => {
  for (const user of ['ruth', 'jo'] as const) {
    it(`SHARE-ST-33 ${user}: the switch on, still no kind tile; the postcard alone`, async () => {
      await start({ user, be: kindsOn(relativeCanPost()) });
      await waitFor(() => expect(screen.getByTestId('share-card')).toBeTruthy(), slow);
      noKinds();
      expect(target()).toBeTruthy();
    });
  }
});

describe('SHARE-ST-31 / SHARE-ST-33 a tap on a kind shows its empty card face (tester option A)', () => {
  for (const K of KINDS) {
    it(`SHARE-ST-31 "${K.label}" opens the ${K.k} card: its fields, "To:", a disabled "Pick who gets it"; the photo card and kinds row step aside; nothing sent`, async () => {
      const { be } = await start({ be: kindsOn() });
      const before = Object.keys(be.state.posts).length;
      fireEvent.press(await screen.findByRole('button', { name: K.label }, slow));
      const face = await screen.findByTestId(`share-kind-card-${K.k}`, {}, slow);
      const labels = (face.findAll((x: Inst) => x.type === TextInput) as Inst[]).map((x) => x.props.accessibilityLabel);
      for (const f of K.fields) expect({ f, found: labels.includes(f) }).toEqual({ f, found: true });
      expect(wordsIn(face).split(' ')).toContain('To:');
      const pick = screen.getByRole('button', { name: 'Pick who gets it' });
      expect(pick.props.accessibilityState?.disabled ?? pick.props['aria-disabled']).toBe(true);
      expect(screen.getByRole('header', { name: 'New post' })).toBeTruthy();
      expect(screen.queryByTestId('share-kinds', HIDDEN)).toBeNull();
      expect(screen.queryByRole('button', { name: /^Add photos( or videos)?, up to \d+ at a time$/ })).toBeNull();
      expect(Object.keys(be.state.posts).length).toBe(before);
      expectGrandparentSafe();
    });
  }
});

// ===== PR #174 fix round (grandparent-ux GUX-T2 / GUX-T5), written first (red), Nov 24, by qa-tdd =====
// GUX-T2 (P1): the empty postcard sits right under "New post", not in the middle of the space (it wins over GUX-W1's
// "middle of the space"). Seam: "share-empty-wrap" keeps flex, but never justifyContent 'center' (or 'space-*' /
// 'flex-end'); unset or 'flex-start' only. Playwright GUX-T2 in app/e2e-web/demo.spec.js measures it at 390 px.
describe('GUX-T2 P1 the empty postcard is top-aligned under "New post"', () => {
  for (const dark of [false, true]) {
    it(`GUX-T2 (${dark ? 'dark' : 'light'}) "share-empty-wrap" does not center the card: justifyContent unset or flex-start`, async () => {
      await start({ kv: prefs('chase', { look: dark ? 'dark' : 'light' }) });
      const wrap = screen.getByTestId('share-empty-wrap');
      const jc = flat(wrap.props.style).justifyContent;
      expect({ justifyContent: jc ?? 'unset', topAligned: jc === undefined || jc === 'flex-start' })
        .toEqual({ justifyContent: jc ?? 'unset', topAligned: true });
      expect(within(screen.getByTestId('share-card'), wrap)).toBe(true);
    });
  }
});

// GUX-T5 (P2): in every theme (paper and the nine fruits), light and dark, and with the phone's Increase Contrast on,
// the empty card's "To:" is >= 4.5:1 on the card (text) and the ruled lines are >= 1.5:1 (decoration; qa-tdd keeps
// GUX-W4's floor, since the lines carry no meaning a person must read). Rendered as Chase (owner, can pick a theme).
describe('GUX-T5 P2 "To:" and the ruled lines on the empty card, every theme, light and dark', () => {
  for (const theme of THEME_NAMES) {
    for (const dark of [false, true]) {
      it(`GUX-T5 ${theme} (${dark ? 'dark' : 'light'}) "To:" >= 4.5:1 and rules >= 1.5:1 on c.surface`, async () => {
        await start({ kv: prefs('chase', { look: dark ? 'dark' : 'light', theme }) });
        const card = screen.getByTestId('share-card');
        const surface = String(flat(card.props.style).backgroundColor);
        const want = paletteFor(Platform.OS as 'ios', dark, theme);
        expect({ theme, surface }).toEqual({ theme, surface: want.surface });
        const to = String(flat(screen.getByText(TO, HIDDEN).props.style).color);
        const rules = [...screen.getAllByTestId('share-note-rule', HIDDEN), ...screen.getAllByTestId('share-to-rule', HIDDEN)]
          .map((r) => String(flat(r.props.style).backgroundColor));
        const ratio = (x: string) => (/^#[0-9A-Fa-f]{6}$/.test(x) ? Math.round(contrast(x, surface) * 100) / 100 : 0);
        expect({ theme, to: ratio(to) >= 4.5, rules: rules.map((r) => ratio(r) >= 1.5) })
          .toEqual({ theme, to: true, rules: [true, true, true] });
      }, 10000);
    }
    it(`GUX-T5 ${theme} Increase Contrast (light and dark): c.muted >= 4.5:1 and c.tabLine >= 1.5:1 on c.surface`, () => {
      for (const dark of [false, true]) {
        const c = paletteFor(Platform.OS as 'ios', dark, theme, true);
        expect({ theme, dark, to: contrast(c.muted, c.surface) >= 4.5, rule: contrast(c.tabLine, c.surface) >= 1.5 })
          .toEqual({ theme, dark, to: true, rule: true });
      }
    });
  }
});
