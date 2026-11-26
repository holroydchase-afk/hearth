// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SPEC-REDESIGN 1h (DEC-67, Chase Nov 18): warm paper backings, soft photo shadows (light only), the reaction pop
// with its Reduce Motion fallback, and no date line above the greeting. Written first (red), Nov 18, by qa-tdd.
// Retargeted Nov 18 (DEC-68, Chase 14:55Z): the tan paper #F1E9D2 / #14100D is replaced by Paper #F7F7F4 / #131210
// (RD-94; palettes in src/ui/__tests__/themes.test.ts, which replaces warmPaper.test.ts). Shadows and the pop stay
// for now (Chase deciding), so RD-88..RD-90 are unchanged. Paper's surface is white, so RD-87's render check now bars
// white only in dark mode; black is barred in both. The web demo: e2e-web/demo.spec.js (RD-92, RD-102).
//
// The engineer's contract:
//   - RD-87: screens draw on c.bg (Paper by default); no screen, kit or demo file hard-codes #FFFFFF / #000000 / white /
//     black as a background (the photo viewer, swipe and video player keep black: they show a photo).
//   - RD-88: light mode, each Gallery tile, New for you tile and Feed post photo sits in its own wrapper that carries
//     one soft warm shadow (opacity ≤ 0.12, offset y 1..2, radius 4..8, elevation ≤ 2, or the same as a boxShadow);
//     the tile inside keeps overflow hidden + its corners; the wrapper has no margin, padding or border. Nothing
//     else has a shadow (except RD-82's search-bar-shade, flagged to staff-pm). Dark: no shadow at all.
//   - RD-89: tapping a reaction on scales only the emoji (Animated transform scale 1 → 1.25 → 1, ≤ 250 ms total,
//     useNativeDriver on phones); turning it off has no pop; the count and the other buttons keep their styles;
//     the save doesn't wait for the animation; a second tap never counts twice.
//   - RD-90: Reduce Motion on, no scale (an opacity fade ≤ 200 ms, or nothing).
//   - RD-91: no weekday or date line on Gallery; the greeting is the first text.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { FeedScreen, GalleryScreen, MoreScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';

const { dadSide } = FIXTURE.circles;
const { jo } = FIXTURE.users;
const SEEN = (u: string) => `hearth.lastSeen.v1.${u}`;
const PREFS = (u: string) => `hearth.prefs.v1.${u}`;
const HOUR = 3600e3;
const slow = { timeout: 5000 };
const GREETING = /^Good (morning|afternoon|evening), Grandma Jo$/;
const lookName = (dark: boolean) => (dark ? 'dark' : 'light');

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const isHost = (n: Inst) => typeof n.type === 'string';
const hostParent = (n: Inst): Inst | null => {
  let p = n.parent;
  while (p && !isHost(p)) p = p.parent;
  return p;
};
const name = (n: Inst) => `${String(n.type)}${n.props.testID ? `#${n.props.testID}` : ''}${n.props.accessibilityLabel ? ` "${String(n.props.accessibilityLabel).slice(0, 30)}"` : ''}`;

/** kv: Jo's look, and lastSeen before or after the seeded posts (so New for you shows or not). */
const kvFor = (dark: boolean, showNew: boolean) => memoryKV({
  [SEEN(jo.id)]: new Date(Date.now() + (showNew ? -HOUR : HOUR)).toISOString(),
  [PREFS(jo.id)]: JSON.stringify({ look: lookName(dark), bigText: false, notify: 'push', color: 'ember' }),
});

// ---------- shadows ----------
interface Shadow { color: string; opacity: number; y: number; radius: number; elevation: number }
function parseColor(v: string): { r: number; g: number; b: number; a: number } | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) return { r: parseInt(hex[1]!.slice(0, 2), 16), g: parseInt(hex[1]!.slice(2, 4), 16), b: parseInt(hex[1]!.slice(4, 6), 16), a: 1 };
  const short = /^#([0-9a-f]{3})$/i.exec(v);
  if (short) return { r: parseInt(short[1]![0]! + short[1]![0], 16), g: parseInt(short[1]![1]! + short[1]![1], 16), b: parseInt(short[1]![2]! + short[1]![2], 16), a: 1 };
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(v);
  return m ? { r: +m[1]!, g: +m[2]!, b: +m[3]!, a: m[4] === undefined ? 1 : +m[4] } : null;
}
/** A node's shadow, from shadow* / elevation props or a boxShadow (string or RN 0.76+ object form); null if none. */
function shadowOf(n: Inst): Shadow | null {
  const s = flat(n.props.style);
  const box = s.boxShadow;
  if (box && box !== 'none') {
    if (typeof box === 'string') {
      const m = /(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+([\d.]+)(?:px)?(?:\s+-?[\d.]+(?:px)?)?\s+(rgba?\([^)]*\)|#[0-9a-f]{3,6})/i.exec(box);
      if (!m) return { color: box, opacity: 1, y: NaN, radius: NaN, elevation: 0 };
      const col = parseColor(m[4]!);
      return { color: m[4]!, opacity: col?.a ?? 1, y: +m[2]!, radius: +m[3]! / 2, elevation: 0 };
    }
    const first = (Array.isArray(box) ? box[0] : box) as Record<string, unknown>;
    const col = parseColor(String(first.color ?? '#000000'));
    return { color: String(first.color), opacity: col?.a ?? 1, y: Number(first.offsetY ?? 0), radius: Number(first.blurRadius ?? 0) / 2, elevation: 0 };
  }
  const opacity = Number(s.shadowOpacity ?? 0);
  const elevation = Number(s.elevation ?? 0);
  if (opacity <= 0 && elevation <= 0) return null;
  const off = (s.shadowOffset ?? {}) as { height?: number };
  return { color: String(s.shadowColor ?? '#000000'), opacity, y: Number(off.height ?? 0), radius: Number(s.shadowRadius ?? 0), elevation };
}
const warmColor = (v: string) => {
  const c = parseColor(v);
  return !!c && c.r >= c.g && c.g >= c.b && c.r > c.b;
};
/** RD-88's soft shadow: warm ink color, opacity ≤ 0.12, offset y 1..2, radius 4..8, Android elevation ≤ 2. */
const softShadow = (sh: Shadow) => warmColor(sh.color) && sh.opacity > 0 && sh.opacity <= 0.12 && sh.y >= 1 && sh.y <= 2 && sh.radius >= 4 && sh.radius <= 8 && sh.elevation <= 2;

const isPhotoTile = (n: Inst) => isHost(n) && (/^(gallery-tile|new-tile)-/.test(String(n.props.testID ?? '')) || /^Open photo \d+ of \d+/.test(String(n.props.accessibilityLabel ?? '')));
// engineer, flagged for qa-tdd: findAll already includes the node itself, so a tile counted itself twice (2) and
// no wrapper could ever be reached; count once.
const tilesIn = (n: Inst) => (n.findAll(isPhotoTile) as Inst[]).length;
const shadowed = () => (screen.UNSAFE_root.findAll(isHost) as Inst[]).filter((n) => shadowOf(n) && n.props.testID !== 'search-bar-shade');

/** RD-88 for one tile: its shadow is on a wrapper (the tile, or up to 2 host levels up, holding only this tile). */
function checkTile(tile: Inst) {
  const tileStyle = flat(tile.props.style);
  let wrap: Inst | null = null;
  for (let n: Inst | null = tile, i = 0; n && i < 3 && tilesIn(n) === 1; n = hostParent(n), i++) {
    if (shadowOf(n)) { wrap = n; break; }
  }
  const ws = wrap ? flat(wrap.props.style) : {};
  const layoutExtras = Object.keys(ws).filter((k) => /^(margin|padding)/.test(k) || (/^border.*Width$/.test(k) && Number(ws[k]) > 0));
  const sh = wrap ? shadowOf(wrap)! : null;
  return {
    tile: name(tile),
    hasShadow: !!wrap,
    onWrapper: !!wrap && wrap !== tile,
    wrapperClips: ws.overflow === 'hidden',
    tileClips: tileStyle.overflow === 'hidden' && Number(tileStyle.borderRadius ?? 0) > 0,
    soft: sh ? softShadow(sh) : false,
    shadow: sh,
    layoutExtras,
  };
}
const goodTile = (r: ReturnType<typeof checkTile>) => ({ ...r, hasShadow: true, onWrapper: true, wrapperClips: false, tileClips: true, soft: true, layoutExtras: [] });

async function galleryWithNew(dark: boolean) {
  const be = FakeBackend.withFixture();
  await seedPost(be, { caption: 'Lake day', photos: 2, circles: [dadSide.id] });
  await seedPost(be, { caption: 'Cake time', photos: 1, circles: [dadSide.id] });
  await renderApp(<GalleryScreen />, { be, user: 'jo', kv: kvFor(dark, true) });
  await screen.findByRole('header', { name: GREETING }, slow);
  await waitFor(() => expect(screen.getAllByTestId(/^gallery-tile-/).length).toBeGreaterThan(0), slow);
  await waitFor(() => expect(screen.getAllByTestId(/^new-tile-/).length).toBeGreaterThan(0), slow);
}
async function feedWithPhotos(dark: boolean, photos = 2) {
  const be = FakeBackend.withFixture();
  const post = await seedPost(be, { caption: 'First snow!', photos, circles: [dadSide.id] });
  await renderApp(<FeedScreen />, { be, user: 'jo', kv: kvFor(dark, false) });
  const card = await screen.findByTestId(`post-${post.id}`, {}, slow);
  await waitFor(() => expect(within(card).getAllByLabelText(/^Open photo \d+ of \d+/).length).toBeGreaterThan(0), slow);
  return { be, id: post.id, card };
}

// ---------- RD-87 ----------
describe('RD-87 every page backing is Paper (c.bg)', () => {
  for (const dark of [false, true]) {
    const want = dark ? '#131210' : '#F7F7F4';
    const screens: Array<[string, () => Promise<void>]> = [
      ['Gallery', async () => { await galleryWithNew(dark); }],
      ['Feed', async () => { await feedWithPhotos(dark); }],
      ['More', async () => {
        await renderApp(<MoreScreen />, { user: 'jo', kv: kvFor(dark, false) });
        await screen.findAllByRole('button', {}, slow);
      }],
    ];
    for (const [label, open] of screens) {
      it(`RD-87 RD-94 ${label} (${lookName(dark)}): the page draws on ${want}, with no ${dark ? 'white or black' : 'black or tan'} backing anywhere`, async () => {
        await open();
        const hosts = screen.UNSAFE_root.findAll(isHost) as Inst[];
        const bgs = hosts.map((n) => String(flat(n.props.style).backgroundColor ?? '').toUpperCase());
        expect({ pageColor: bgs.includes(want) }).toEqual({ pageColor: true });
        const BW = dark
          ? /^(#FFF|#FFFFFF|#000|#000000|WHITE|BLACK|RGB\(255, ?255, ?255\)|RGB\(0, ?0, ?0\)|#14100D)$/
          : /^(#000|#000000|BLACK|RGB\(0, ?0, ?0\)|#F1E9D2)$/;
        expect(hosts.filter((n) => BW.test(String(flat(n.props.style).backgroundColor ?? '').toUpperCase())).map(name)).toEqual([]);
      }, 20000);
    }
  }

  it('RD-87 no screen, kit or demo file hard-codes #FFFFFF, #000000, white or black as a background (viewer, swipe and video keep black)', () => {
    const src = path.join(__dirname, '..', '..');
    const PHOTO_SHOWERS = new Set(['ViewerScreen.tsx', 'PhotoSwipe.tsx', 'VideoPlayer.tsx']);
    const files = [
      ...fs.readdirSync(path.join(src, 'screens')).filter((f) => f.endsWith('.tsx') && !PHOTO_SHOWERS.has(f)).map((f) => path.join(src, 'screens', f)),
      ...fs.readdirSync(path.join(src, 'demo')).filter((f) => f.endsWith('.tsx')).map((f) => path.join(src, 'demo', f)),
      path.join(src, 'ui', 'kit.tsx'),
    ];
    const BAD = /background(Color)?\s*[:=]\s*['"`](#fff(fff)?|#000(000)?|white|black|rgb\(\s*(255,\s*255,\s*255|0,\s*0,\s*0)\s*\))['"`]/gi;
    const hits = files.flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').flatMap((line, i) => (line.match(BAD) ? [`${path.basename(f)}:${i + 1} ${line.trim().slice(0, 80)}`] : [])));
    expect(hits).toEqual([]);
  });
});

// ---------- RD-88 ----------
describe('RD-88 soft photo shadows, light mode only', () => {
  it('RD-88 Gallery (light): every Gallery tile and New for you tile has one soft warm shadow on a wrapper that does not clip or change layout', async () => {
    await galleryWithNew(false);
    const tiles = [...screen.getAllByTestId(/^gallery-tile-/), ...screen.getAllByTestId(/^new-tile-/)] as Inst[];
    expect(tiles.length).toBeGreaterThanOrEqual(2);
    for (const t of tiles) {
      const r = checkTile(t);
      expect(r).toEqual(goodTile(r));
    }
  }, 20000);

  it('RD-88 Feed (light): every post photo has one soft warm shadow on a wrapper that does not clip or change layout', async () => {
    const { card } = await feedWithPhotos(false, 3);
    const tiles = within(card).getAllByLabelText(/^Open photo \d+ of \d+/).filter(isHost) as Inst[];
    expect(tiles.length).toBeGreaterThanOrEqual(1);
    for (const t of tiles) {
      const r = checkTile(t);
      expect(r).toEqual(goodTile(r));
    }
  }, 20000);

  it('RD-88 Gallery and Feed (light): nothing but a photo tile wrapper has a shadow (rows, capsules, fields, tab bar)', async () => {
    await galleryWithNew(false);
    expect(shadowed().filter((n) => tilesIn(n) !== 1).map(name)).toEqual([]);
    screen.unmount();
    await feedWithPhotos(false);
    expect(shadowed().filter((n) => tilesIn(n) !== 1).map(name)).toEqual([]);
  }, 20000);

  it('RD-88 Gallery and Feed (dark): no shadow at all', async () => {
    await galleryWithNew(true);
    expect(shadowed().map(name)).toEqual([]);
    screen.unmount();
    await feedWithPhotos(true);
    expect(shadowed().map(name)).toEqual([]);
  }, 20000);
});

// ---------- RD-89 / RD-90 ----------
type Call = { value: unknown; toValue: unknown; duration: number; native: unknown; kind: string };
function spyAnimated(neverFinish = false) {
  const calls: Call[] = [];
  const realTiming = Animated.timing;
  const realSpring = Animated.spring;
  const stub = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
  jest.spyOn(Animated, 'timing').mockImplementation(((v: unknown, cfg: Animated.TimingAnimationConfig) => {
    calls.push({ value: v, toValue: cfg.toValue, duration: Number(cfg.duration ?? 500), native: cfg.useNativeDriver, kind: 'timing' });
    return neverFinish ? stub : realTiming(v as Animated.Value, cfg);
  }) as never);
  jest.spyOn(Animated, 'spring').mockImplementation(((v: unknown, cfg: Animated.SpringAnimationConfig) => {
    calls.push({ value: v, toValue: cfg.toValue, duration: Infinity, native: cfg.useNativeDriver, kind: 'spring' });
    return neverFinish ? stub : realSpring(v as Animated.Value, cfg);
  }) as never);
  return calls;
}
const heart = (card: Inst) => within(card).getByRole('button', { name: 'Love it' });
const others = (card: Inst) => ['Haha', 'Like it', 'Hooray'].map((l) => within(card).getByRole('button', { name: l }));
const LAYOUT = /^(width|height|min|max|margin|padding|flex|gap|fontSize|lineHeight|position|top|left|right|bottom|aspectRatio)/;
// Retargeted Nov 20 for DEC-76 / RD-116: the 1 to 2 pt border change is absorbed in padding, so compare padding + border.
const layoutOf = (n: Inst) => {
  const s = flat(n.props.style);
  const v = (...x: unknown[]) => Number(x.find((y) => typeof y === 'number') ?? 0);
  const box = (side: 'Left' | 'Right' | 'Top' | 'Bottom', axis: 'Horizontal' | 'Vertical') =>
    v(s[`padding${side}`], s[`padding${axis}`], s.padding) + v(s[`border${side}Width`], s.borderWidth);
  const rest = Object.fromEntries(Object.entries(s).filter(([k]) => LAYOUT.test(k) && !/^padding/.test(k)));
  return { ...rest, box: [box('Left', 'Horizontal'), box('Right', 'Horizontal'), box('Top', 'Vertical'), box('Bottom', 'Vertical')] };
};
/** Every node in the heart button whose transform has a scale, and what it holds. */
function scaled(btn: Inst) {
  return (btn.findAll(isHost) as Inst[]).concat(isHost(btn) ? [btn] : []).flatMap((n) => {
    const tf = flat(n.props.style).transform as Array<Record<string, unknown>> | undefined;
    const sc = Array.isArray(tf) ? tf.find((x) => 'scale' in x) : undefined;
    if (!sc) return [];
    const texts = (n.findAll((x: Inst) => x.type === Text) as Inst[]).map((t) => String(t.props.children));
    return [{ node: n, scale: Number(sc.scale), texts }];
  });
}
afterEach(() => jest.restoreAllMocks());

describe('RD-89 reaction pop', () => {
  it('RD-89 tapping ❤️ on: the emoji scales 1 → 1.25 → 1 in ≤ 250 ms, by transform, on the native driver', async () => {
    const { card } = await feedWithPhotos(false, 1);
    const calls = spyAnimated();
    fireEvent.press(heart(card));
    await waitFor(() => expect(heart(card).props.accessibilityState?.selected).toBe(true), slow);
    const up = calls.find((c) => c.toValue === 1.25);
    expect({ popTo125: !!up }).toEqual({ popTo125: true });
    const same = calls.filter((c) => c.value === up!.value);
    expect({
      total: same.reduce((a, c) => a + c.duration, 0) <= 250,
      endsAt1: same[same.length - 1]!.toValue === 1,
      native: same.every((c) => c.native === true),
    }).toEqual({ total: true, endsAt1: true, native: true });
    // The scale is on the emoji only: the node with the transform holds ❤️ and not the count.
    const s = scaled(heart(card));
    expect(s.map((x) => ({ emoji: x.texts.includes('❤️'), count: x.texts.some((t) => /^\d+$/.test(t)) }))).toEqual([{ emoji: true, count: false }]);
  }, 20000);

  it('RD-89 during the pop the count, the other emoji and the heart button keep their layout', async () => {
    const { card } = await feedWithPhotos(false, 1);
    const before = { heart: layoutOf(heart(card)), others: others(card).map(layoutOf) };
    spyAnimated(true); // the pop starts and never ends: we are "during" it
    fireEvent.press(heart(card));
    await waitFor(() => expect(heart(card).props.accessibilityState?.selected).toBe(true), slow);
    expect({ heart: layoutOf(heart(card)), others: others(card).map(layoutOf) }).toEqual(before);
    // and the pop really is under way (a scale transform on the emoji)
    expect(scaled(heart(card)).length).toBe(1);
  }, 20000);

  it('RD-89 tapping ❤️ off changes state with no pop', async () => {
    const { card } = await feedWithPhotos(false, 1);
    fireEvent.press(heart(card));
    await waitFor(() => expect(heart(card).props.accessibilityState?.selected).toBe(true), slow);
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const calls = spyAnimated();
    fireEvent.press(heart(card));
    await waitFor(() => expect(heart(card).props.accessibilityState?.selected).toBe(false), slow);
    expect(calls.filter((c) => Number(c.toValue) > 1).length).toBe(0);
  }, 20000);

  it('RD-89 the reaction is saved on the first tap even if the pop never finishes', async () => {
    const { be, id, card } = await feedWithPhotos(false, 1);
    spyAnimated(true);
    fireEvent.press(heart(card));
    await waitFor(() => expect(be.reactionSummary(jo.id, [id])[0]?.my_reaction).toBe('❤️'), slow);
  }, 20000);

  it('RD-89 a second tap during the pop never counts twice', async () => {
    const { be, id, card } = await feedWithPhotos(false, 1);
    spyAnimated(true);
    fireEvent.press(heart(card));
    fireEvent.press(heart(card));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const n = be.reactionSummary(jo.id, [id])[0]?.counts['❤️'] ?? 0;
    expect({ saved: n <= 1, shown: heart(card).props.accessibilityValue?.text !== '2' }).toEqual({ saved: true, shown: true });
  }, 20000);
});

describe('RD-90 Reduce Motion: no pop', () => {
  it('RD-90 with Reduce Motion on, tapping ❤️ on shows the picked state with no scale (opacity ≤ 200 ms or at once)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { card } = await feedWithPhotos(false, 1);
    await act(async () => { await Promise.resolve(); });
    const calls = spyAnimated();
    fireEvent.press(heart(card));
    await waitFor(() => expect(heart(card).props.accessibilityState?.selected).toBe(true), slow);
    expect(calls.filter((c) => Number(c.toValue) > 1).map((c) => c.toValue)).toEqual([]);
    expect(calls.filter((c) => c.duration > 200).map((c) => `${c.kind} ${String(c.toValue)} ${c.duration}`)).toEqual([]);
    expect(scaled(heart(card)).filter((x) => x.scale !== 1).length).toBe(0);
  }, 20000);
});

// ---------- RD-91 ----------
describe('RD-91 no date line above the greeting', () => {
  const WEEKDAY = /\b(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b/;
  const SHORT_DATE = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? \d{1,2}(?!\d)/;
  for (const dark of [false, true]) {
    it(`RD-91 Gallery (${lookName(dark)}): the greeting is the first text, and no weekday or date sits above or beside it`, async () => {
      const be = FakeBackend.withFixture();
      await seedPost(be, { caption: 'Lake day', circles: [dadSide.id] });
      await renderApp(<GalleryScreen />, { be, user: 'jo', kv: kvFor(dark, false) });
      await screen.findByRole('header', { name: GREETING }, slow);
      const texts = (screen.UNSAFE_root.findAll((n: Inst) => n.type === Text) as Inst[])
        .map((t) => ([t.props.children] as unknown[]).flat(Infinity).filter((x) => typeof x === 'string' || typeof x === 'number').join(''))
        .filter((s) => s.trim());
      expect(texts[0]).toMatch(GREETING);
      // The top of Gallery: everything before the first month title (photos below may carry their own day).
      const MONTH = /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/;
      const firstMonth = texts.findIndex((s) => MONTH.test(s));
      const top = firstMonth < 0 ? texts : texts.slice(0, firstMonth);
      expect(top.filter((s) => WEEKDAY.test(s) || SHORT_DATE.test(s))).toEqual([]);
    }, 20000);
  }
});
