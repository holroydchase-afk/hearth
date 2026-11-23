// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// grandparent-ux theme review (7/10, Nov 18 2026), two P1 findings. Written first (red), by qa-tdd.
//
// The engineer's contract:
//   - GUX-R18: Colors gets a new token `tabLine`, the tab bar's top line. In every theme (paper, avocado,
//     pomegranate) x light/dark x normal/high contrast it is >= 3:1 against the tab bar (c.surface) AND the page
//     (c.bg). c.line itself is unchanged (other dividers stay subtle). HearthTabBar's top border uses c.tabLine
//     (RD-104 in themes.test.tsx now expects c.tabLine too).
//   - GUX-R19: each Theme radio shows a split swatch, testID `swatch-<theme>`, at least 48 x 48 pt, holding two
//     side-by-side parts: `swatch-<theme>-page` (that theme's c.bg) and `swatch-<theme>-accent` (its c.accent),
//     for the current light/dark. The accent part is not nested inside the page part (no dot on a disc).
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { FIXTURE } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { MoreScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';
import { contrast, LookContext, paletteFor, PhoneA11yContext, ThemeContext, type Colors, type ThemeName } from '../../ui/theme';
import { HearthTabBar } from '../TabBar';

// qa-tdd, Nov 23: FRUIT-1 (DEC-80) replaces the three DEC-68 themes with Paper plus nine fruits.
const THEMES = ['paper', 'avocado', 'pomegranate', 'blood-orange', 'kiwi', 'fig', 'dragon-fruit', 'watermelon', 'beet', 'red-cabbage'] as ThemeName[];
const lookName = (dark: boolean) => (dark ? 'dark' : 'light');
const slow = { timeout: 5000 };
const { chase } = FIXTURE.users;
type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const isHost = (n: Inst) => typeof n.type === 'string';
const tabLine = (c: Colors) => (c as unknown as Record<string, string | undefined>).tabLine;

// ---------- GUX-R18 ----------
describe('GUX-R18 the tab bar boundary reads in every theme', () => {
  for (const theme of THEMES) {
    for (const dark of [false, true]) {
      for (const high of [false, true]) {
        const label = `${theme}, ${lookName(dark)}, ${high ? 'high' : 'normal'}`;

        it(`GUX-R18 (${label}) c.tabLine is >= 3:1 against the tab bar (surface) and the page (bg)`, () => {
          const c = paletteFor('ios', dark, theme, high);
          const line = tabLine(c);
          expect({ hasTabLine: typeof line === 'string' && /^#[0-9A-F]{6}$/i.test(line) }).toEqual({ hasTabLine: true });
          const r = (x: string) => Math.round(contrast(line!, x) * 100) / 100;
          expect({ onSurface: r(c.surface) >= 3, onPage: r(c.bg) >= 3, surface: r(c.surface), page: r(c.bg) })
            .toEqual({ onSurface: true, onPage: true, surface: r(c.surface), page: r(c.bg) });
        });

        it(`GUX-R18 (${label}) the tab bar's top border is c.tabLine, 1 px`, () => {
          const c = paletteFor('ios', dark, theme, high);
          render(
            <PhoneA11yContext.Provider value={{ highContrast: high, reduceMotion: false }}>
              <LookContext.Provider value={dark ? 'dark' : 'light'}>
                <ThemeContext.Provider value={theme}><HearthTabBar role="owner" current="gallery" onNavigate={() => {}} /></ThemeContext.Provider>
              </LookContext.Provider>
            </PhoneA11yContext.Provider>,
          );
          const bar = (screen.UNSAFE_root.findAll(isHost) as Inst[]).find((n) => n.props.accessibilityRole === 'tablist');
          const st = flat(bar!.props.style);
          expect({
            topWidth: Number(st.borderTopWidth ?? st.borderWidth ?? 0),
            topColor: String(st.borderTopColor ?? st.borderColor ?? '').toUpperCase(),
          }).toEqual({ topWidth: 1, topColor: String(tabLine(c) ?? 'c.tabLine missing').toUpperCase() });
        });
      }
    }
  }

  it('GUX-R18 c.line itself stays as it was (other dividers stay subtle)', () => {
    expect([paletteFor('ios', false, 'paper').line, paletteFor('ios', true, 'paper').line]).toEqual(['#E3DED4', '#2E2B27']);
  });
});

// ---------- GUX-R19 ----------
describe('GUX-R19 each Theme option shows a split swatch: page and accent', () => {
  for (const dark of [false, true]) {
    it(`GUX-R19 (${lookName(dark)}) swatch-<theme> is >= 48 pt with side-by-side page and accent parts in that theme's colors`, async () => {
      const kv = memoryKV({
        [`hearth.lastSeen.v1.${chase.id}`]: new Date(Date.now() - 3600e3).toISOString(),
        [`hearth.prefs.v1.${chase.id}`]: JSON.stringify({ look: lookName(dark), easyView: false, notify: 'push' }),
      });
      await renderApp(<MoreScreen />, { user: 'chase', kv });
      fireEvent.press(await screen.findByRole('button', { name: /^Theme(,|$)/ }, slow));
      await screen.findByRole('header', { name: 'Theme' }, slow);
      for (const theme of THEMES) {
        const p = paletteFor('ios', dark, theme);
        const sw = screen.queryByTestId(`swatch-${theme}`);
        const page = screen.queryByTestId(`swatch-${theme}-page`);
        const accent = screen.queryByTestId(`swatch-${theme}-accent`);
        const s = sw ? flat(sw.props.style) : {};
        const within = (outer: Inst | null, inner: Inst | null) => !!outer && !!inner && (outer.findAll(isHost) as Inst[]).includes(inner);
        expect({
          theme,
          swatch: !!sw,
          big: Number(s.width ?? 0) >= 48 && Number(s.height ?? 0) >= 48,
          pageColor: page ? String(flat(page.props.style).backgroundColor ?? '').toUpperCase() : 'missing',
          accentColor: accent ? String(flat(accent.props.style).backgroundColor ?? '').toUpperCase() : 'missing',
          bothInSwatch: within(sw, page) && within(sw, accent),
          split: !!page && !!accent && !within(page, accent) && !within(accent, page),
        }).toEqual({
          theme, swatch: true, big: true,
          pageColor: p.bg.toUpperCase(), accentColor: p.accent.toUpperCase(),
          bothInSwatch: true, split: true,
        });
      }
    }, 20000);
  }
});
