// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DARK-ELEV (intake #155; studio reference DARK-5, Material 3 tonal surfaces): in dark mode a raised card or sheet
// shows as a lighter surface step, never a shadow. Light mode is unchanged. Written first by qa-tdd (Nov 23), red
// until fixed.
//   DARK-ELEV-1  every theme's dark c.surface is lighter than its c.bg, so the surface step exists.
//   DARK-ELEV-2  the web's floating glass tab bar (RD-108) has no shadow in dark; it keeps its see-through c.surface
//                fill and its light border. Light keeps its shadow.
//   DARK-ELEV-3  RD-82's shade line under the pinned Search bar / month title is a plain hairline in dark (no shadow).
//                API assumed: GalleryGrid exports `shadeLine(dark: boolean): ViewStyle` (today a const).
//   DARK-ELEV-4  the laptop demo frame's phone column has no shadow in dark; it keeps its border and sits a surface
//                step lighter than the page behind it. Light keeps the shadow.
//   DARK-ELEV-5  guard: photoShadow() stays null in dark, set in light (RD-88).
// The real-browser check (no box-shadow on the demo's first screen at 390 px dark) is demo.spec.js DARK-ELEV-6.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { FakeBackend, FIXTURE } from '../../api/fake/FakeBackend';
import { DemoFrame } from '../../demo/DemoFrame';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { GalleryScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';
import { LookContext, ThemeContext, paletteFor, photoShadow, type Colors, type ThemeName } from '../../ui/theme';
import * as grid from '../GalleryGrid';
import { HearthTabBar, type TabName } from '../TabBar';

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten(s as never) ?? {}) as Record<string, unknown>;
const THEMES: ThemeName[] = ['paper', 'avocado', 'pomegranate'];
const pal = (dark: boolean, theme: ThemeName = 'paper'): Colors => paletteFor(Platform.OS as 'ios', dark, theme);
const look = (dark: boolean) => (dark ? 'dark' : 'light');
const slow = { timeout: 5000 };

/** WCAG relative luminance of #RRGGBB or rgb()/rgba() (alpha ignored: the step is about the color itself). */
function lum(color: string): number {
  const m = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  const rgb = m ? m.slice(1, 4).map((h) => parseInt(h, 16)) : (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const [r, g, b] = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
const ratio = (a: string, b: string) => (lum(a) + 0.05) / (lum(b) + 0.05);

/** Every way a style can draw a drop shadow on iPhone, Android or the web. Empty when there is none. */
function shadowOf(s: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const bs = s.boxShadow;
  if (bs != null && bs !== 'none' && !(Array.isArray(bs) && bs.length === 0)) out.boxShadow = bs;
  if (typeof s.shadowOpacity === 'number' && s.shadowOpacity > 0) out.shadowOpacity = s.shadowOpacity;
  if (typeof s.shadowRadius === 'number' && s.shadowRadius > 0 && s.shadowOpacity !== 0) out.shadowRadius = s.shadowRadius;
  if (typeof s.elevation === 'number' && s.elevation > 0) out.elevation = s.elevation;
  return out;
}

// ---------- DARK-ELEV-1 ----------
describe('DARK-ELEV-1 in dark, every theme has a surface step: c.surface is lighter than the page (c.bg)', () => {
  for (const theme of THEMES) {
    it(`DARK-ELEV-1 (${theme}, dark) c.surface has a higher relative luminance than c.bg`, () => {
      const c = pal(true, theme);
      expect({ theme, surfaceLighter: lum(c.surface) > lum(c.bg), ratio: Number(ratio(c.surface, c.bg).toFixed(3)) })
        .toEqual({ theme, surfaceLighter: true, ratio: expect.any(Number) });
      expect(ratio(c.surface, c.bg)).toBeGreaterThan(1);
    });
  }
});

// ---------- DARK-ELEV-2 ----------
const floatingBar = (dark: boolean, theme: ThemeName = 'paper') => {
  render(
    <LookContext.Provider value={look(dark)}>
      <ThemeContext.Provider value={theme}>
        <HearthTabBar role="owner" current={'gallery' as TabName} onNavigate={() => {}} floating />
      </ThemeContext.Provider>
    </LookContext.Provider>,
  );
  const bar = screen.UNSAFE_root.findAll((n) => typeof n.type === 'string' && n.props.accessibilityRole === 'tablist')[0]!;
  return flat(bar.props.style);
};

describe('DARK-ELEV-2 the floating glass tab bar (RD-108) has no shadow in dark', () => {
  for (const theme of THEMES) {
    it(`DARK-ELEV-2 (${theme}, dark) no shadow; the see-through c.surface fill and a light border set it apart from the page`, () => {
      const c = pal(true, theme);
      const s = floatingBar(true, theme);
      expect({ theme, shadow: shadowOf(s) }).toEqual({ theme, shadow: {} });
      // The fill is c.surface, see-through (rgba), and the surface step is what lifts it off c.bg.
      expect(String(s.backgroundColor)).toMatch(/^rgba\(/);
      expect(lum(String(s.backgroundColor))).toBeCloseTo(lum(c.surface), 5);
      expect(lum(c.surface)).toBeGreaterThan(lum(c.bg));
      // A visible, light (white-ish) border, not the page color.
      expect(Number(s.borderWidth ?? 0)).toBeGreaterThan(0);
      expect(String(s.borderColor)).toMatch(/^rgba\(255,\s*255,\s*255,\s*0?\.\d+\)$/);
    });
  }

  it('DARK-ELEV-2 (light) unchanged: the floating bar keeps its soft drop shadow', () => {
    const s = floatingBar(false);
    expect(String(s.boxShadow)).toBe('0 6px 24px rgba(0, 0, 0, 0.14)');
  });
});

// ---------- DARK-ELEV-3 ----------
/** API assumed for the engineer: `shadeLine(dark: boolean): ViewStyle`. Read the const today so the test fails on
 *  the shadow, not on a TypeError. */
const shade = (dark: boolean): Record<string, unknown> => {
  const s = (grid as unknown as { shadeLine: unknown }).shadeLine;
  return flat(typeof s === 'function' ? (s as (d: boolean) => unknown)(dark) : s);
};

describe('DARK-ELEV-3 RD-82\'s shade line is a plain hairline in dark', () => {
  it('DARK-ELEV-3 shadeLine is a function of dark: shadeLine(dark: boolean)', () => {
    expect(typeof (grid as unknown as { shadeLine: unknown }).shadeLine).toBe('function');
  });

  it('DARK-ELEV-3 (dark) shadeLine(true) is a hairline at the bottom edge with no shadow', () => {
    const s = shade(true);
    expect(shadowOf(s)).toEqual({});
    expect(s.height).toBe(StyleSheet.hairlineWidth);
    expect({ position: s.position, left: s.left, right: s.right }).toEqual({ position: 'absolute', left: 0, right: 0 });
  });

  it('DARK-ELEV-3 (light) unchanged: shadeLine(false) keeps RD-82\'s soft shadow', () => {
    const s = shade(false);
    expect({ shadowColor: s.shadowColor, shadowOpacity: s.shadowOpacity, shadowRadius: s.shadowRadius, shadowOffset: s.shadowOffset })
      .toEqual({ shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } });
  });

  // What a person sees: Gallery in dark, scrolled so content runs under the pinned Search bar.
  const jo = FIXTURE.users.jo.id;
  async function scrolledGallery(dark: boolean) {
    const be = FakeBackend.withFixture();
    for (const caption of ['Pumpkin patch', 'Hay ride', 'Lake day']) await seedPost(be, { caption, photos: 2 });
    await renderApp(<GalleryScreen />, {
      be, user: 'jo', waitReady: false,
      kv: memoryKV({
        [`hearth.lastSeen.v1.${jo}`]: new Date(Date.now() - 3 * 864e5).toISOString(),
        [`hearth.prefs.v1.${jo}`]: JSON.stringify({ look: look(dark), easyView: false, notify: 'push' }),
      }),
    });
    await screen.findByLabelText('Search photos', {}, slow);
    const scroll = screen.getByTestId('gallery-scroll');
    await act(async () => {
      fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y: 120 }, contentSize: { width: 390, height: 3000 }, layoutMeasurement: { width: 390, height: 844 } } });
    });
    await waitFor(() => expect(screen.getAllByTestId('search-bar-shade').length).toBeGreaterThan(0));
    return screen.getAllByTestId('search-bar-shade').map((n: Inst) => flat(n.props.style));
  }

  it('DARK-ELEV-3 (dark Gallery, scrolled) the line under the pinned Search bar has no shadow and is c.line or c.tabLine', async () => {
    const c = pal(true);
    for (const s of await scrolledGallery(true)) {
      expect(shadowOf(s)).toEqual({});
      expect([c.line.toUpperCase(), c.tabLine.toUpperCase()]).toContain(String(s.backgroundColor).toUpperCase());
    }
  }, 20000);

  it('DARK-ELEV-3 (light Gallery, scrolled) unchanged: the line under the pinned Search bar keeps its soft shadow', async () => {
    for (const s of await scrolledGallery(false)) expect(Number(s.shadowOpacity ?? 0)).toBeGreaterThan(0);
  }, 20000);
});

// ---------- DARK-ELEV-4 ----------
const frame = (dark: boolean, theme: ThemeName = 'paper') => {
  render(
    <LookContext.Provider value={look(dark)}>
      <ThemeContext.Provider value={theme}>
        <DemoFrame width={1280}><Text>the app</Text></DemoFrame>
      </ThemeContext.Provider>
    </LookContext.Provider>,
  );
  return { page: flat(screen.getByTestId('demo-frame').props.style), column: flat(screen.getByTestId('demo-app-column').props.style) };
};

describe('DARK-ELEV-4 the laptop demo frame (1280 px) lifts the phone column with a surface step, not a shadow, in dark', () => {
  for (const theme of THEMES) {
    it(`DARK-ELEV-4 (${theme}, dark) the phone column has no shadow, keeps its border, and is lighter than the page behind it`, () => {
      const c = pal(true, theme);
      const { page, column } = frame(true, theme);
      expect({ theme, shadow: shadowOf(column) }).toEqual({ theme, shadow: {} });
      expect(Number(column.borderWidth ?? 0)).toBeGreaterThan(0);
      expect(String(column.borderColor).toUpperCase()).toBe(c.line.toUpperCase());
      expect({ theme, columnLighterThanPage: lum(String(column.backgroundColor)) > lum(String(page.backgroundColor)) })
        .toEqual({ theme, columnLighterThanPage: true });
    });
  }

  it('DARK-ELEV-4 (light) unchanged: the phone column keeps its soft shadow on the page color', () => {
    const c = pal(false);
    const { page, column } = frame(false);
    expect(String(column.boxShadow)).toBe('0 12px 40px rgba(0,0,0,0.18)');
    expect(page.backgroundColor).toBe(c.bg);
  });
});

// ---------- DARK-ELEV-5 ----------
describe('DARK-ELEV-5 guard: photo tiles have no shadow in dark (RD-88)', () => {
  it('DARK-ELEV-5 photoShadow(true) is null; photoShadow(false) is the soft light-mode shadow', () => {
    expect(photoShadow(true)).toBeNull();
    expect(photoShadow(false)).toEqual({ boxShadow: '0px 2px 12px rgba(30, 27, 23, 0.1)' });
  });
});
