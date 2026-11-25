// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SPEC-VIEWER VIEWER-1..19 (R83, qa-tdd Nov 24, written first, red). The full-screen viewer overhaul, look A:
// a black viewer that behaves like iPhone Photos for parents (Easy view Off: Chase, an owner) and keeps words and
// pills for grandparents (Easy view On: Grandma Jo, a viewer). VIEWER-20 is a manual phone check (M-VIEWER-20).
//
// M-VIEWER-20 (manual, Chase's iPhone, Expo Go): 1. Open a photo as Kevin (Easy view Off); swipe, pinch, double tap,
// drag down. Expected: follows the finger like Photos, no stutter, closes on swipe down. 2. As a viewer (Easy view On),
// open, Next, Back, Save, Close with no help. Expected: each under 60 s, nothing asked.
//
// Seams the engineer builds (named here so the tests hold whatever the library does inside):
//   - ViewerScreen draws the photo with react-native-zoom-toolkit's `Gallery` (jest: src/test/mockZoomGallery.tsx).
//     Its ref's setIndex moves photos for Back / Next / arrows / screen reader; its `zoom` (the pinned patch) zooms.
//   - testID `viewer-backdrop`: the black root. testID `viewer-pills`: Easy view On's bottom row (3 slots, always).
//     testID `viewer-scrim`: Easy view Off's caption gradient.
//   - `VIEWER_TYPE` in src/ui/theme.ts: { headline: 17, caption1: 12, body: 17, title3: 20, title2: 22 }.
//   - src/screens/viewerMotion.ts: `closeProgress(dy)` (0..1), `shouldClose(dy, vy)` (vy in pt/s),
//     `viewerMotion(reduceMotion)` -> { change: 'slide' | 'fade', close: 'slide' | 'fade', zoomAnimated: boolean }.
//   - The photo is one adjustable element named "Photo from <name>, <date>" with Next photo / Previous photo
//     actions (or increment / decrement), and onAccessibilityEscape closes.
jest.mock('react-native-zoom-toolkit', () => require('../../test/mockZoomGallery').zoomToolkitMock, { virtual: true });
jest.mock('../../platform/haptics', () => ({ haptic: jest.fn() }));

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React from 'react';
import { AccessibilityInfo, BackHandler, StatusBar as RNStatusBar, StyleSheet, Text } from 'react-native';
import { FakeBackend, FIXTURE } from '../../api/fake/FakeBackend';
import { MediaCache } from '../../media/cache';
import { haptic } from '../../platform/haptics';
import { gallery } from '../../test/mockZoomGallery';
import { seedPost, seedVideoPost } from '../../test/seed';
import { expectGrandparentSafe, renderApp, screenWords } from '../../test/renderApp';
import { useApp } from '../../state/AppContext';
import * as themeMod from '../../ui/theme';
import { contrast, LookContext, ThemeContext, THEME_NAMES, type ThemeName } from '../../ui/theme';
import { MediaImage } from '../MediaImage';
import { VideoPoster } from '../VideoPoster';
import { ViewerScreen } from '../ViewerScreen';

type Inst = ReturnType<typeof screen.getByTestId>;
type Motion = {
  closeProgress?: (dy: number) => number;
  shouldClose?: (dy: number, vy: number) => boolean;
  viewerMotion?: (reduceMotion: boolean) => { change: string; close: string; zoomAnimated: boolean };
};
const motion = (): Motion => {
  try { return require('../viewerMotion') as Motion; } catch { return {}; }
};
const VIEWER_TYPE = () => ((themeMod as Record<string, unknown>).VIEWER_TYPE ?? {}) as Record<string, number>;

/** VIEWER-22: each small photo in the strip is a button named "Photo 3 of 6, from Alex". */
const STRIP_THUMB = /^Photo \d+ of \d+, from .+$/;
const DATE = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/;
const NAME = /^(From )?Chase$/; // the fixture's sender
const flat = (style: unknown) =>
  (StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false, hovered: false }) : style) ?? {}) as Record<string, unknown>;
const words = () => screenWords().replace(/\s+/g, ' ');
const textOf = (n: Inst): string => {
  const parts: string[] = [];
  const walk = (c: unknown) => { if (typeof c === 'string' || typeof c === 'number') parts.push(String(c)); else if (Array.isArray(c)) c.forEach(walk); };
  walk(n.props.children);
  return parts.join('');
};
const ancestors = (n: Inst): Inst[] => { const out: Inst[] = []; let p = n.parent; while (p) { out.push(p as Inst); p = p.parent; } return out; };
const H_SPACE = ['padding', 'paddingHorizontal', 'paddingLeft', 'paddingRight', 'paddingStart', 'paddingEnd', 'margin', 'marginHorizontal', 'marginLeft', 'marginRight', 'marginStart', 'marginEnd'];
const V_SPACE = ['padding', 'paddingVertical', 'paddingTop', 'paddingBottom', 'margin', 'marginVertical', 'marginTop', 'marginBottom'];
const size = (n: Inst) => { const s = flat(n.props.style); return { h: Number(s.minHeight ?? s.height ?? 0), w: Number(s.minWidth ?? s.width ?? 0) }; };

beforeEach(() => {
  gallery.reset();
  jest.mocked(haptic).mockClear();
  for (const k of ['isReduceMotionEnabled', 'isScreenReaderEnabled'] as const) jest.spyOn(AccessibilityInfo, k).mockResolvedValue(false);
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

/** Three photos: "Two at the lake" (2, newest) then "Older one" (1). */
async function setup() {
  const be = FakeBackend.withFixture();
  const older = await seedPost(be, { caption: 'Older one', photos: 1 });
  const newer = await seedPost(be, { caption: 'Two at the lake', photos: 2 });
  return { be, older, newer };
}
/** Easy view On: Grandma Jo (a viewer). Easy view Off: Chase (the owner). */
async function openViewer(easy: boolean, index = 0, extra: Parameters<typeof renderApp>[1] = {}) {
  const s = await setup();
  const r = await renderApp(<ViewerScreen postId={s.newer.id} index={index} />, { be: s.be, user: easy ? 'jo' : 'chase', ...extra });
  await screen.findByText('Two at the lake');
  return { ...s, ...r };
}
const loaded = () => waitFor(() => expect(screen.queryByText('Loading the photo…')).toBeNull(), { timeout: 5000 });
const zoomPill = () => screen.queryByRole('button', { name: /^Zoom (in|out)$/ });

// ---------------------------------------------------------------------------------------------------------------
describe('VIEWER-1 black backdrop, light status bar, every theme', () => {
  const cases = THEME_NAMES.flatMap((t) => [[t, false], [t, true]] as Array<[ThemeName, boolean]>);
  it.each(cases)('VIEWER-1 %s (dark %s): the backdrop is #000000 and the status bar text is light', async (theme, dark) => {
    const s = await setup();
    await renderApp(
      <LookContext.Provider value={dark ? 'dark' : 'light'}><ThemeContext.Provider value={theme}><ViewerScreen postId={s.newer.id} index={0} /></ThemeContext.Provider></LookContext.Provider>,
      { be: s.be, user: 'chase' },
    );
    await screen.findByText('Two at the lake');
    expect(String(flat(screen.getByTestId('viewer-backdrop').props.style).backgroundColor).toUpperCase()).toBe('#000000');
    const bars = [
      ...screen.UNSAFE_queryAllByType(ExpoStatusBar).map((b) => b.props.style),
      ...screen.UNSAFE_queryAllByType(RNStatusBar).map((b) => (b.props.barStyle === 'light-content' ? 'light' : b.props.barStyle)),
    ];
    expect(bars).toContain('light');
  }, 20000);
});

describe('VIEWER-2 the photo fills the width, contain', () => {
  it.each([['Off', false], ['On', true]] as const)('VIEWER-2 Easy view %s: a wide photo is contain with no side padding between it and the screen edge', async (_l, easy) => {
    const be = FakeBackend.withFixture();
    const p = await seedPost(be, { caption: 'Wide lake', photos: 1, sizes: [[4000, 1000]] });
    await renderApp(<ViewerScreen postId={p.id} index={0} />, { be, user: easy ? 'jo' : 'chase' });
    await screen.findByText('Wide lake');
    const item = screen.getByTestId(`gallery-item-${gallery.index}`);
    const media = [...within(item).UNSAFE_queryAllByType(MediaImage), ...within(item).UNSAFE_queryAllByType(VideoPoster)][0]!;
    expect(media.props.fit).toBe('contain');
    const backdrop = screen.getByTestId('viewer-backdrop');
    const chain = ancestors(media);
    expect(chain).toContain(backdrop);
    const between = chain.slice(0, chain.indexOf(backdrop) + 1);
    const keys = easy ? H_SPACE : [...H_SPACE, ...V_SPACE]; // Off: full height too
    const spaced = between.flatMap((n) => { const s = flat(n.props.style); return keys.filter((k) => Number(s[k] ?? 0) > 0).map((k) => `${String(n.type)}.${k}=${String(s[k])}`); });
    expect(spaced).toEqual([]);
  });
});

describe('VIEWER-3 swiping moves photos (the Gallery\'s callbacks)', () => {
  it('VIEWER-3 the Gallery gets every photo you can swipe through, starts on the one tapped, and a swipe updates the words', async () => {
    await openViewer(true, 0);
    expect(gallery.props?.data).toHaveLength(3);
    expect(gallery.props?.initialIndex ?? 0).toBe(0);
    act(() => gallery.swipeTo(1));
    expect(await screen.findByText(/Photo 2 of 3$/)).toBeTruthy();
    act(() => gallery.swipeTo(2));
    expect(await screen.findByText(/Photo 3 of 3$/)).toBeTruthy();
    expect(screen.getByText('Older one')).toBeTruthy();
  });

  it('VIEWER-3 Next / Back pills move the Gallery itself, so the picture and the words agree', async () => {
    await openViewer(true, 0);
    fireEvent.press(screen.getByRole('button', { name: 'Next photo' }));
    expect(await screen.findByText(/Photo 2 of 3$/)).toBeTruthy();
    expect(gallery.index).toBe(1);
    fireEvent.press(screen.getByRole('button', { name: 'Back to the previous photo' }));
    expect(await screen.findByText(/Photo 1 of 3$/)).toBeTruthy();
    expect(gallery.index).toBe(0);
  });
});

describe('VIEWER-4 double tap zooms to 3x and back', () => {
  it('VIEWER-4 maxScale is 3; a double tap zooms (Zoom out shows), a second returns to fit (Zoom in shows)', async () => {
    await openViewer(true, 0);
    expect(gallery.props?.maxScale).toBe(3);
    act(() => gallery.doubleTap());
    expect(gallery.scale).toBe(3);
    expect(await screen.findByRole('button', { name: 'Zoom out' })).toBeTruthy();
    act(() => gallery.doubleTap());
    expect(await screen.findByRole('button', { name: 'Zoom in' })).toBeTruthy();
  });
});

describe('VIEWER-5 zoomed photos pan, pinch to 3x, each photo starts unzoomed', () => {
  it('VIEWER-5 pinch is on (every platform) and stops at 3x', async () => {
    await openViewer(false, 0);
    expect(gallery.props?.zoomEnabled).not.toBe(false);
    expect(gallery.props?.maxScale).toBe(3);
  });

  it('VIEWER-5 zoomed, then moved to the next photo: the next one starts unzoomed (Zoom in shows again)', async () => {
    await openViewer(true, 0);
    act(() => gallery.pinchTo(2));
    expect(await screen.findByRole('button', { name: 'Zoom out' })).toBeTruthy();
    act(() => gallery.swipeTo(1));
    expect(await screen.findByText(/Photo 2 of 3$/)).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Zoom in' })).toBeTruthy();
  });

  it('VIEWER-5 VIEWER-6 zoomed, a long drag down pans and never closes', async () => {
    const { nav } = await openViewer(false, 0);
    act(() => gallery.pinchTo(2));
    act(() => gallery.pull(300, true, 2000));
    expect(nav.close).not.toHaveBeenCalled();
  });
});

describe('VIEWER-6 swipe down to close', () => {
  it('VIEWER-6 closeProgress fades the backdrop with the distance (0 at rest, rising, never past 1, nothing for an up drag)', () => {
    const { closeProgress } = motion();
    expect(typeof closeProgress).toBe('function');
    expect(closeProgress!(0)).toBe(0);
    expect(closeProgress!(-80)).toBe(0);
    const a = closeProgress!(40), b = closeProgress!(100);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(closeProgress!(5000)).toBeLessThanOrEqual(1);
  });

  it('VIEWER-6 shouldClose: past 120 pt or a fast flick closes; a short slow drag or an up flick does not', () => {
    const { shouldClose } = motion();
    expect(typeof shouldClose).toBe('function');
    expect(shouldClose!(121, 0)).toBe(true);
    expect(shouldClose!(119, 0)).toBe(false);
    expect(shouldClose!(40, 3000)).toBe(true);
    expect(shouldClose!(40, 50)).toBe(false);
    expect(shouldClose!(-200, -3000)).toBe(false);
  });

  it.each([
    ['a 130 pt drag', 130, 0, true],
    ['a fast 40 pt flick', 40, 3000, true],
    ['a slow 60 pt drag', 60, 50, false],
  ] as const)('VIEWER-6 releasing %s %s', async (_l, dy, vy, closes) => {
    const { nav } = await openViewer(false, 0);
    act(() => gallery.pull(dy, false, vy));
    expect(nav.close).not.toHaveBeenCalled(); // never mid-drag
    act(() => gallery.pull(dy, true, vy));
    if (closes) expect(nav.close).toHaveBeenCalledTimes(1);
    else expect(nav.close).not.toHaveBeenCalled();
  });
});

describe('VIEWER-7 Easy view Off: a single tap hides and shows the controls', () => {
  const shown = () => ({
    close: !!screen.queryByRole('button', { name: 'Close' }),
    save: !!screen.queryByRole('button', { name: 'Save to my phone' }),
    name: !!screen.queryByText(NAME),
    caption: !!screen.queryByText('Two at the lake'),
  });
  const all = (v: boolean) => ({ close: v, save: v, name: v, caption: v });

  it('VIEWER-7 tap hides everything after the double-tap window, tap again shows it, a double tap never toggles, and the choice carries to the next photo', async () => {
    await openViewer(false, 0);
    await loaded();
    expect(shown()).toEqual(all(true));
    jest.useFakeTimers();
    act(() => gallery.tap());
    act(() => { jest.advanceTimersByTime(400); });
    expect(shown()).toEqual(all(false));
    act(() => gallery.tap());
    act(() => { jest.advanceTimersByTime(400); });
    expect(shown()).toEqual(all(true));
    act(() => gallery.doubleTap());
    act(() => { jest.advanceTimersByTime(400); });
    expect(shown()).toEqual(all(true));
    act(() => gallery.doubleTap());
    act(() => gallery.tap());
    act(() => { jest.advanceTimersByTime(400); });
    expect(shown().close).toBe(false);
    act(() => gallery.swipeTo(1));
    act(() => { jest.advanceTimersByTime(400); });
    expect(shown().close).toBe(false); // carries to the next photo
    act(() => gallery.tap());
    act(() => { jest.advanceTimersByTime(400); });
    expect(shown().close).toBe(true);
  });
});

describe('VIEWER-8 Easy view Off: two round icon buttons, nothing else', () => {
  it.each(['Close', 'Save to my phone'])('VIEWER-8 %s is a round icon button: spoken name, no word, a 44 pt circle in a 48 pt target', async (name) => {
    await openViewer(false, 0);
    const btn = screen.getByRole('button', { name });
    expect(size(btn).h).toBeGreaterThanOrEqual(48);
    expect(size(btn).w).toBeGreaterThanOrEqual(48);
    expect(within(btn).queryByText(name)).toBeNull();
    expect(within(btn).queryAllByText(/[A-Za-z]/)).toHaveLength(0);
    const circle = btn.findAll((n) => typeof n.type === 'string' && (() => { const s = flat(n.props.style); return s.width === 44 && s.height === 44 && Number(s.borderRadius ?? 0) >= 22; })());
    expect(circle.length).toBeGreaterThan(0);
    expect(btn.props.hitSlop ?? null).toBeNull(); // the 48 pt target is the pressable itself, not hitSlop
  });

  it('VIEWER-8 no Back, Next, Zoom or "Photo n of m" in Easy view Off', async () => {
    await openViewer(false, 1);
    expect(screen.queryByRole('button', { name: /^(Next photo|Back to the previous photo|Zoom in|Zoom out)$/ })).toBeNull();
    expect(screen.queryByText(/Photo \d+ of \d+/)).toBeNull();
    expect(screen.queryByText(/[◀▶]/)).toBeNull();
  });
});

describe('VIEWER-9 Easy view Off: name and date on top, caption on a dark gradient', () => {
  it('VIEWER-9 VIEWER_TYPE holds the iPhone sizes in one map', () => {
    expect(VIEWER_TYPE()).toEqual(expect.objectContaining({ headline: 17, caption1: 12, body: 17, title3: 20, title2: 22 }));
  });

  it('VIEWER-9 the sender is headline (17 SemiBold), the date caption1 (12), both centered; the caption is body (17)', async () => {
    await openViewer(false, 0);
    const t = VIEWER_TYPE();
    const name = flat(screen.getByText(NAME).props.style);
    const date = screen.getAllByText(DATE)[0]!;
    expect(name.fontSize).toBe(t.headline ?? 17);
    expect(String(name.fontWeight ?? '') === '600' || /semi ?bold/i.test(String(name.fontFamily ?? ''))).toBe(true);
    expect(flat(date.props.style).fontSize).toBe(t.caption1 ?? 12);
    for (const n of [screen.getByText(NAME), date]) {
      const centered = flat(n.props.style).textAlign === 'center' || ancestors(n).slice(0, 3).some((a) => flat(a.props.style).alignItems === 'center');
      expect({ text: textOf(n), centered }).toEqual({ text: textOf(n), centered: true });
    }
    expect(flat(screen.getByText('Two at the lake').props.style).fontSize).toBe(t.body ?? 17);
  });

  it('VIEWER-9 the caption sits over a gradient at least 60% black, so white words stay 4.5:1 on a white photo', async () => {
    await openViewer(false, 0);
    const scrim = screen.getByTestId('viewer-scrim');
    const s = flat(scrim.props.style);
    const paint = [s.backgroundColor, s.backgroundImage, s.experimental_backgroundImage].map((x) => (typeof x === 'string' ? x : JSON.stringify(x ?? ''))).join(' ');
    const alphas = [...paint.matchAll(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)/g)].map((m) => Number(m[1]))
      .concat(/#000000(?![0-9a-f])|#000(?![0-9a-f])|\bblack\b/i.test(paint) ? [1] : []);
    const darkest = Math.max(0, ...alphas);
    expect(darkest).toBeGreaterThanOrEqual(0.6);
    const g = Math.round(255 * (1 - darkest)).toString(16).padStart(2, '0');
    const color = String(flat(screen.getByText('Two at the lake').props.style).color);
    expect(contrast(color, `#${g}${g}${g}`)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('VIEWER-10 Easy view On: pills, words and the counter', () => {
  it('VIEWER-10 Close is a pill with its word; Back / Save / Next are 48 pt pills in title3 on a middle photo', async () => {
    await openViewer(true, 1);
    const t = VIEWER_TYPE();
    const close = screen.getByRole('button', { name: 'Close' });
    expect(within(close).getByText('Close')).toBeTruthy();
    expect(size(close).h).toBeGreaterThanOrEqual(48);
    for (const name of ['Back to the previous photo', 'Save to my phone', 'Next photo']) {
      const b = screen.getByRole('button', { name });
      expect({ name, tall: size(b).h >= 48 }).toEqual({ name, tall: true });
      const label = within(b).UNSAFE_queryAllByType(Text).find((x) => /[A-Za-z]/.test(textOf(x as Inst)))!;
      expect({ name, size: flat(label.props.style).fontSize }).toEqual({ name, size: t.title3 ?? 20 });
    }
  });

  it('VIEWER-10 the sender is title2 (22); the date is body and "Photo n of m" follows it', async () => {
    await openViewer(true, 1);
    const t = VIEWER_TYPE();
    expect(flat(screen.getByText(NAME).props.style).fontSize).toBe(t.title2 ?? 22);
    expect(words()).toMatch(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat), [A-Z][a-z]{2} \d{1,2} ?· ?Photo 2 of 3/);
  });

  it.each([['first', 0, 'Back to the previous photo'], ['last', 2, 'Next photo']] as const)('VIEWER-10 on the %s photo that pill is an empty slot: the row keeps 3 places', async (_l, at, gone) => {
    const s = await setup();
    await renderApp(<ViewerScreen postId={at === 2 ? s.older.id : s.newer.id} index={0} />, { be: s.be, user: 'jo' });
    await screen.findByText(/Photo \d of 3$/);
    expect(screen.queryByRole('button', { name: gone })).toBeNull();
    expect(screen.getByTestId('viewer-pills').children).toHaveLength(3);
  });

  it('VIEWER-10 a single tap hides nothing in Easy view On', async () => {
    await openViewer(true, 0);
    jest.useFakeTimers();
    act(() => gallery.tap());
    act(() => { jest.advanceTimersByTime(400); });
    for (const name of ['Close', 'Save to my phone', 'Next photo', 'Zoom in']) expect({ name, shown: !!screen.queryByRole('button', { name }) }).toEqual({ name, shown: true });
    expect(screen.queryByText(/Photo 1 of 3$/)).toBeTruthy();
  });
});

describe('VIEWER-11 Easy view On: a Zoom in / Zoom out pill (DS-4)', () => {
  it('VIEWER-11 Zoom in zooms the Gallery at the center through its ref, then reads Zoom out; Zoom out returns to fit', async () => {
    await openViewer(true, 0);
    fireEvent.press(screen.getByRole('button', { name: 'Zoom in' }));
    await waitFor(() => expect(gallery.scale).toBeGreaterThan(1));
    expect(gallery.calls.zoom.length).toBeGreaterThan(0);
    expect(await screen.findByRole('button', { name: 'Zoom out' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Zoom out' }));
    await waitFor(() => expect(gallery.scale).toBe(1));
    expect(await screen.findByRole('button', { name: 'Zoom in' })).toBeTruthy();
  });

  it('VIEWER-11 a pinch also flips the pill to Zoom out', async () => {
    await openViewer(true, 0);
    act(() => gallery.pinchTo(1.8));
    expect(await screen.findByRole('button', { name: 'Zoom out' })).toBeTruthy();
    expect(zoomPill()).toBeTruthy();
  });
});

describe('VIEWER-13 HARD-8 kept, and neighbours prefetched', () => {
  it('VIEWER-13 HARD-8 a new post arriving keeps the same photo (by media id and caption, not the counter)', async () => {
    let app: ReturnType<typeof useApp> | null = null;
    const Grab = () => { app = useApp(); return null; };
    const s = await setup();
    await renderApp(<><Grab /><ViewerScreen postId={s.newer.id} index={0} /></>, { be: s.be, user: 'jo' });
    await screen.findByText('Two at the lake');
    fireEvent.press(screen.getByRole('button', { name: 'Next photo' }));
    await screen.findByText(/Photo 2 of 3$/);
    const mediaOnScreen = () => within(screen.getByTestId(`gallery-item-${gallery.index}`)).UNSAFE_getAllByType(MediaImage)[0]!.props.mediaId as string;
    const before = mediaOnScreen();
    await seedPost(s.be, { caption: 'Brand new', photos: 1 });
    await act(async () => { await app!.feed!.refresh(); });
    await screen.findByText(/Photo 3 of 4$/);
    expect(mediaOnScreen()).toBe(before);
    expect(screen.getByText('Two at the lake')).toBeTruthy();
    expect(screen.queryByText('Brand new')).toBeNull();
  });

  it('VIEWER-13 on arrival the next AND the previous photo are prefetched', async () => {
    const prefetch = jest.spyOn(MediaCache.prototype, 'prefetch');
    const s = await setup();
    await renderApp(<ViewerScreen postId={s.newer.id} index={1} />, { be: s.be, user: 'jo' });
    await screen.findByText(/Photo 2 of 3$/);
    const ids = (post: string) => Object.values(s.be.state.media).filter((m) => m.post === post).sort((a, b) => a.position - b.position).map((m) => m.id);
    const [prev] = ids(s.newer.id);
    const [next] = ids(s.older.id);
    await waitFor(() => {
      const asked = prefetch.mock.calls.flatMap((c) => c[1]);
      expect(asked).toEqual(expect.arrayContaining([prev, next]));
    });
  });
});

describe('VIEWER-14 removed and loading read on black', () => {
  it('VIEWER-14 a deleted photo shows "This was removed." in white on black, with Close', async () => {
    const s = await setup();
    await s.be.clientFor(FIXTURE.users.chase.id).deletePost(s.newer.id);
    await renderApp(<ViewerScreen postId={s.newer.id} index={0} />, { be: s.be, user: 'jo' });
    const gone = await screen.findByText('This was removed.');
    expect(String(flat(screen.getByTestId('viewer-backdrop').props.style).backgroundColor).toUpperCase()).toBe('#000000');
    expect(contrast(String(flat(gone.props.style).color), '#000000')).toBeGreaterThanOrEqual(4.5);
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('VIEWER-14 while the photo loads, "Loading the photo…" reads in white on black', async () => {
    jest.spyOn(MediaCache.prototype, 'uri').mockImplementation(() => new Promise<string>(() => {}));
    await openViewer(false, 0);
    const loading = await screen.findAllByText('Loading the photo…');
    for (const l of loading) expect(contrast(String(flat(l.props.style).color), '#000000')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('VIEWER-15 Save keeps its words and haptic; videos', () => {
  it.each([['Off', false], ['On', true]] as const)('VIEWER-15 Easy view %s: "Saved to your phone." on a solid backing, with the success haptic', async (_l, easy) => {
    const { deps, newer } = await openViewer(easy, 1);
    fireEvent.press(screen.getByRole('button', { name: 'Save to my phone' }));
    const msg = await screen.findByText('Saved to your phone.');
    expect(deps.saveToPhone).toHaveBeenCalledWith(newer.plains[1], expect.stringMatching(/^hearth-/));
    expect(haptic).toHaveBeenCalledWith('success');
    const backing = ancestors(msg).map((a) => String(flat(a.props.style).backgroundColor ?? '')).find((c) => /^#[0-9a-f]{6}$/i.test(c));
    expect(backing).toBeDefined();
    expect(contrast(String(flat(msg.props.style).color), backing!)).toBeGreaterThanOrEqual(4.5);
  });

  it('VIEWER-15 if the phone says no, it explains what to do', async () => {
    await openViewer(false, 0, { deps: { saveToPhone: jest.fn(async () => 'denied' as const) } });
    fireEvent.press(screen.getByRole('button', { name: 'Save to my phone' }));
    expect(await screen.findByText('Your phone said no. Tap "Allow" when your phone asks, then try again.')).toBeTruthy();
  });

  it('VIEWER-15 a video hides Save, shows its poster contain on black, and is one of the photos the Gallery swipes through', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'A photo first', photos: 1 });
    const v = await seedVideoPost(be, { caption: 'Leo on the slide' });
    await renderApp(<ViewerScreen postId={v.id} index={0} />, { be, user: 'jo' });
    await screen.findByText('Leo on the slide');
    expect(screen.queryByRole('button', { name: 'Save to my phone' })).toBeNull();
    expect(gallery.props?.data).toHaveLength(2);
    const poster = within(screen.getByTestId(`gallery-item-${gallery.index}`)).UNSAFE_getAllByType(VideoPoster)[0]!;
    expect(poster.props.fit).toBe('contain');
    expect(String(flat(poster.props.style).backgroundColor).toUpperCase()).toBe('#000000');
  });

  it('VIEWER-15 Close goes back to the same place', async () => {
    const { nav } = await openViewer(false, 1);
    fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(nav.close).toHaveBeenCalled();
  });
});

describe('VIEWER-16 screen reader', () => {
  const photo = () => screen.getAllByLabelText(/^Photo from Chase, (Sun|Mon|Tue|Wed|Thu|Fri|Sat), [A-Z][a-z]{2} \d{1,2}$/)
    .find((n) => n.props.accessibilityRole === 'adjustable' || n.props.role === 'adjustable')!;
  const act11y = (el: Inst, wanted: string, fallback: string) => {
    const acts = (el.props.accessibilityActions ?? []) as { name: string; label?: string }[];
    const a = acts.find((x) => x.name === wanted || x.label === wanted) ?? acts.find((x) => x.name === fallback);
    expect({ wanted, found: !!a }).toEqual({ wanted, found: true });
    act(() => { fireEvent(el, 'accessibilityAction', { nativeEvent: { actionName: a!.name } }); });
  };

  it('VIEWER-16 Easy view Off with a screen reader on: a tap never hides the controls', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    await openViewer(false, 0);
    await act(async () => { await Promise.resolve(); });
    jest.useFakeTimers();
    act(() => gallery.tap());
    act(() => { jest.advanceTimersByTime(400); });
    expect(screen.queryByRole('button', { name: 'Close' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save to my phone' })).toBeTruthy();
  });

  it('VIEWER-16 the photo is one adjustable element named "Photo from Chase, <date>"; Next photo / Previous photo move; escape closes', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    const { nav } = await openViewer(false, 0);
    const el = photo();
    expect(el).toBeDefined();
    act11y(el, 'Next photo', 'increment');
    await waitFor(() => expect(gallery.index).toBe(1));
    act11y(photo(), 'Previous photo', 'decrement');
    await waitFor(() => expect(gallery.index).toBe(0));
    const esc = screen.UNSAFE_root.findAll((n) => typeof n.props.onAccessibilityEscape === 'function');
    expect(esc.length).toBeGreaterThan(0);
    act(() => { esc[0]!.props.onAccessibilityEscape(); });
    expect(nav.close).toHaveBeenCalled();
  });
});

describe('VIEWER-17 Reduce Motion', () => {
  it('VIEWER-17 viewerMotion: Reduce Motion fades (no slide), close fades, zoom has no animation; otherwise it slides', () => {
    const { viewerMotion } = motion();
    expect(typeof viewerMotion).toBe('function');
    expect(viewerMotion!(true)).toEqual({ change: 'fade', close: 'fade', zoomAnimated: false });
    expect(viewerMotion!(false)).toEqual({ change: 'slide', close: 'slide', zoomAnimated: true });
  });
});

describe('VIEWER-18 Android back', () => {
  it('VIEWER-18 the phone\'s Back button closes the viewer', async () => {
    const handlers: (() => boolean)[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, h) => {
      handlers.push(h as () => boolean);
      return { remove: () => { handlers.splice(handlers.indexOf(h as () => boolean), 1); } };
    });
    const { nav } = await openViewer(false, 0);
    let used = false;
    act(() => { used = [...handlers].reverse().some((h) => h()); });
    expect(used).toBe(true);
    expect(nav.close).toHaveBeenCalled();
  });
});

describe('VIEWER-19 grandparent-safe', () => {
  it('VIEWER-19 Easy view On passes expectGrandparentSafe with no exceptions', async () => {
    await openViewer(true, 1);
    await loaded();
    expectGrandparentSafe();
  });

  it('VIEWER-19 VIEWER-23 Easy view Off passes with only the named exceptions: the 12 pt date, icon-only Close and Save, the strip\'s small photos', async () => {
    await openViewer(false, 1);
    await loaded();
    const pressables = screen.UNSAFE_root.findAll(
      (n: { type: unknown; props: Record<string, unknown> }) => typeof n.type === 'string' && typeof n.props.onResponderGrant === 'function' && n.props.accessible === true,
    );
    expect(pressables.length).toBeGreaterThan(0);
    const iconOnly: string[] = [];
    for (const p of pressables) {
      const label = p.props.accessibilityLabel as string | undefined;
      expect({ label }).toEqual({ label: expect.stringMatching(/\S/) });
      if (STRIP_THUMB.test(label ?? '')) continue; // VIEWER-23: the strip's Photos-sized thumbs are a named exception
      const s = size(p as Inst);
      const w = s.w || (flat(p.props.style).flex || flat(p.props.style).alignSelf === 'stretch' ? 999 : 0);
      expect({ label, h: s.h >= 48, w: w >= 48 }).toEqual({ label, h: true, w: true });
      if (!within(p as Inst).UNSAFE_queryAllByType(Text).some((t) => /[A-Za-z]/.test(textOf(t as Inst)))) iconOnly.push(label!);
    }
    expect(iconOnly.sort()).toEqual(['Close', 'Save to my phone']);
    const small = (screen.UNSAFE_queryAllByType(Text) as Inst[])
      .map((t) => ({ text: textOf(t), size: flat(t.props.style).fontSize as number | undefined }))
      .filter((t) => t.size !== undefined && t.size < 17);
    expect(small.length).toBeGreaterThan(0);
    for (const t of small) expect({ text: t.text, ok: DATE.test(t.text) && t.size === 12 }).toEqual({ text: t.text, ok: true });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Look B (Chase, Nov 24, DEC-84): a strip of small photos above the bottom buttons. Seams: testID `viewer-strip`;
// each small photo is a button named "Photo n of m, from <name>", the current one has accessibilityState.selected.
describe('VIEWER-21 the photo strip', () => {
  const thumbs = () => within(screen.getByTestId('viewer-strip')).getAllByRole('button', { name: STRIP_THUMB });
  const current = () => thumbs().filter((t) => t.props.accessibilityState?.selected === true || t.props['aria-selected'] === true);
  const widthOf = (n: Inst) => { const own = Number(flat(n.props.style).width ?? 0); if (own) return own; const inner = n.findAll((x) => typeof x.type === 'string' && Number(flat(x.props.style).width ?? 0) > 0)[0]; return inner ? Number(flat(inner.props.style).width) : 0; };
  const outlined = (n: Inst) => [n, ...n.findAll((x) => typeof x.type === 'string')].some((x) => Number(flat(x.props.style).borderWidth ?? 0) > 0);

  it.each([['Off', false], ['On', true]] as const)('VIEWER-21 Easy view %s: with more than one photo the strip shows one small photo per photo, above the bottom buttons', async (_l, easy) => {
    await openViewer(easy, 0);
    expect(thumbs()).toHaveLength(3);
    // Above the bottom buttons: the strip comes before Save in the drawing order (the buttons sit under it).
    const all = screen.UNSAFE_root.findAll((n) => typeof n.type === 'string');
    const strip = all.indexOf(screen.getByTestId('viewer-strip'));
    const save = all.indexOf(screen.getByRole('button', { name: 'Save to my phone' }));
    expect(strip).toBeGreaterThanOrEqual(0);
    expect(strip).toBeLessThan(save);
  });

  it('VIEWER-21 a single photo has no strip', async () => {
    const be = FakeBackend.withFixture();
    const p = await seedPost(be, { caption: 'Only one', photos: 1 });
    await renderApp(<ViewerScreen postId={p.id} index={0} />, { be, user: 'chase' });
    await screen.findByText('Only one');
    expect(screen.queryByTestId('viewer-strip')).toBeNull();
  });

  it('VIEWER-21 the current small photo is wider and outlined, and follows a swipe', async () => {
    await openViewer(false, 0);
    expect(current()).toHaveLength(1);
    expect(current()[0]!.props.accessibilityLabel).toMatch(/^Photo 1 of 3, from Chase$/);
    const others = thumbs().filter((t) => !current().includes(t));
    expect(widthOf(current()[0]!)).toBeGreaterThan(Math.max(...others.map(widthOf)));
    expect(outlined(current()[0]!)).toBe(true);
    act(() => gallery.swipeTo(2));
    await waitFor(() => expect(current()[0]!.props.accessibilityLabel).toMatch(/^Photo 3 of 3, from Chase$/));
  });
});

describe('VIEWER-22 tapping a small photo', () => {
  it('VIEWER-22 each small photo has a spoken name; a tap opens that photo unzoomed and the strip follows', async () => {
    await openViewer(true, 0);
    const strip = screen.getByTestId('viewer-strip');
    expect(within(strip).getAllByRole('button', { name: STRIP_THUMB }).map((t) => t.props.accessibilityLabel))
      .toEqual(['Photo 1 of 3, from Chase', 'Photo 2 of 3, from Chase', 'Photo 3 of 3, from Chase']);
    act(() => gallery.pinchTo(2));
    fireEvent.press(within(strip).getByRole('button', { name: 'Photo 3 of 3, from Chase' }));
    await waitFor(() => expect(gallery.index).toBe(2));
    expect(gallery.scale).toBe(1);
    expect(await screen.findByText(/Photo 3 of 3$/)).toBeTruthy();
    expect(screen.getByText('Older one')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Zoom in' })).toBeTruthy();
    expect(within(screen.getByTestId('viewer-strip')).getByRole('button', { name: 'Photo 3 of 3, from Chase' }).props.accessibilityState?.selected).toBe(true);
  });
});

describe('VIEWER-23 the strip in each mode', () => {
  it('VIEWER-23 Easy view Off: the strip hides with the other controls on a single tap and comes back', async () => {
    await openViewer(false, 0);
    expect(screen.queryByTestId('viewer-strip') && screen.queryAllByRole('button', { name: STRIP_THUMB }).length).toBe(3);
    jest.useFakeTimers();
    act(() => gallery.tap());
    act(() => { jest.advanceTimersByTime(400); });
    expect(screen.queryAllByRole('button', { name: STRIP_THUMB })).toHaveLength(0);
    act(() => gallery.tap());
    act(() => { jest.advanceTimersByTime(400); });
    expect(screen.queryAllByRole('button', { name: STRIP_THUMB })).toHaveLength(3);
  });

  it('VIEWER-23 Easy view Off: small photos are Photos-sized (under 48 pt), the named exception', async () => {
    await openViewer(false, 0);
    const small = within(screen.getByTestId('viewer-strip')).getAllByRole('button', { name: STRIP_THUMB })
      .filter((t) => t.props.accessibilityState?.selected !== true);
    expect(small.length).toBeGreaterThan(0);
    for (const t of small) expect(size(t).h).toBeLessThan(48);
  });

  it('VIEWER-23 Easy view On: every small photo is at least 48 by 48 and a tap never hides the strip', async () => {
    await openViewer(true, 0);
    const ts = within(screen.getByTestId('viewer-strip')).getAllByRole('button', { name: STRIP_THUMB });
    for (const t of ts) expect({ label: t.props.accessibilityLabel, ...{ h: size(t).h >= 48, w: size(t).w >= 48 } }).toEqual({ label: t.props.accessibilityLabel, h: true, w: true });
    jest.useFakeTimers();
    act(() => gallery.tap());
    act(() => { jest.advanceTimersByTime(400); });
    expect(screen.queryAllByRole('button', { name: STRIP_THUMB })).toHaveLength(3);
  });
});
