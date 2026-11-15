// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-1..RD-3, RD-5, RD-6, RD-8 (docs/product/SPEC-REDESIGN.md, phase 1a "The look", DEC-59): white and true
// black with one accent (Ember by default), the phone's own font, outline icons, Apple's corners.
// Lint-style checks for RD-3, RD-4, RD-6, RD-7 and RD-8 live in redesignLint.test.ts.
import { render, screen, within } from '@testing-library/react-native';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import pkg from '../../../package.json';
import { FakeBackend } from '../../api/fake/FakeBackend';
import { HelpScreen } from '../../screens/HelpScreen';
import { MeScreen } from '../../screens/MeScreen';
import { PhotosScreen } from '../../screens/PhotosScreen';
import { HearthTabBar, tabsFor } from '../../screens/TabBar';
import { renderApp } from '../../test/renderApp';
import { seedPost } from '../../test/seed';
import { Button, Card, Txt } from '../kit';
import { COLOR_NAMES, ColorContext, RADIUS, contrast, dialogRadius, paletteFor, useTheme, type ColorName } from '../theme';

const ACCENTS: Record<string, { light: string; dark: string }> = {
  ember: { light: '#B23A1E', dark: '#FF8A65' },
  forest: { light: '#2E7D4F', dark: '#6FCF97' },
  plum: { light: '#8E3A8F', dark: '#D9A0E0' },
};
const NEUTRAL_KEYS = ['bg', 'surface', 'ink', 'muted', 'line', 'fill', 'photo'] as const;
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** Black-and-white means no warm (or any) tint: channels within 8 of each other (Apple's own grays pass). */
const neutral = (h: string) => { const v = rgb(h); return Math.max(...v) - Math.min(...v) <= 8; };
const MODES = [false, true] as const;
/** RD-3 / RD-24: the three choices, fixed here so a missing one fails instead of being skipped. */
const CHOICES = ['ember', 'forest', 'plum'] as ColorName[];

describe('RD 1a the look: black and white with one accent', () => {
  it('RD-1 light mode is a white #FFFFFF screen with near-black words; dark mode is true black #000000 with near-white words', () => {
    for (const os of ['ios', 'android', 'web'] as const) {
      const light = paletteFor(os, false);
      const dark = paletteFor(os, true);
      expect({ os, bg: light.bg }).toEqual({ os, bg: '#FFFFFF' });
      expect({ os, bg: dark.bg }).toEqual({ os, bg: '#000000' });
      expect(contrast(light.ink, light.bg)).toBeGreaterThanOrEqual(15);
      expect(contrast(dark.ink, dark.bg)).toBeGreaterThanOrEqual(15);
    }
  });

  it.each(MODES)('RD-1 no warm off-white or charcoal remains in paletteFor (dark %s): every non-accent color is a neutral gray', (dark) => {
    const OLD_WARM = ['#FAF6F1', '#171311', '#241E1B', '#1F1A17', '#F6EFE9', '#EFE8E1', '#352C27', '#DDD3C9', '#40362F', '#5E5650', '#BDB2A9'];
    for (const n of CHOICES) {
      const c = paletteFor('ios', dark, n);
      for (const k of NEUTRAL_KEYS) {
        expect({ n, k, v: c[k], neutral: neutral(c[k]) }).toEqual({ n, k, v: c[k], neutral: true });
        expect(OLD_WARM).not.toContain(c[k].toUpperCase());
      }
    }
  });

  it('RD-2 the phone\'s own font: Atkinson is not a dependency and no Text asks for a custom font family', () => {
    expect(Object.keys(pkg.dependencies).filter((d) => d.startsWith('@expo-google-fonts/'))).toEqual([]);
    render(<>
      <Txt>Body words</Txt><Txt variant="muted">Quiet words</Txt><Txt variant="strong">Grandma Jo</Txt>
      <Txt variant="title">A title</Txt><Txt variant="display">Large title</Txt>
      <Button label="Send" onPress={() => {}} />
    </>);
    for (const w of ['Body words', 'Quiet words', 'Grandma Jo', 'A title', 'Large title', 'Send']) {
      const fam = StyleSheet.flatten(screen.getByText(w).props.style).fontFamily as string | undefined;
      // System font: no family (iPhone SF Pro, Android Roboto) or the web's system stack. Never Atkinson.
      expect({ w, atkinson: /atkinson/i.test(fam ?? '') }).toEqual({ w, atkinson: false });
      if (fam !== undefined) expect({ w, fam }).toEqual({ w, fam: expect.stringMatching(/system-ui|-apple-system|^System$/) });
    }
  });

  it('RD-2 Regular or Semibold only; Bold appears only in the large title', () => {
    render(<>
      <Txt>Body words</Txt><Txt variant="muted">Quiet words</Txt><Txt variant="strong">Grandma Jo</Txt>
      <Txt variant="title">A title</Txt><Txt variant="display">Large title</Txt>
      <Button label="Send" onPress={() => {}} />
    </>);
    const w = (t: string) => String(StyleSheet.flatten(screen.getByText(t).props.style).fontWeight ?? '400');
    expect({ body: w('Body words'), muted: w('Quiet words') }).toEqual({ body: expect.stringMatching(/^(400|normal)$/), muted: expect.stringMatching(/^(400|normal)$/) });
    for (const t of ['Grandma Jo', 'A title', 'Send']) expect({ t, weight: w(t) }).toEqual({ t, weight: '600' });
    expect(['600', '700', 'bold']).toContain(w('Large title'));
  });

  it('RD-3 one accent token per palette, from one setting: Ember (default), Forest and Plum, light and dark', () => {
    expect([...COLOR_NAMES]).toEqual(['ember', 'forest', 'plum']);
    expect(paletteFor('ios', false)).toEqual(paletteFor('ios', false, 'ember'));
    for (const n of CHOICES) {
      expect({ n, light: paletteFor('ios', false, n).accent, dark: paletteFor('ios', true, n).accent }).toEqual({ n, ...ACCENTS[n] });
      for (const dark of MODES) {
        expect(paletteFor('android', dark, n)).toEqual(paletteFor('ios', dark, n));
        expect(paletteFor('web', dark, n)).toEqual(paletteFor('ios', dark, n));
      }
    }
  });

  it('RD-3 the family color changes only the accent: black, white and grays are the same for every choice', () => {
    for (const dark of MODES) {
      const base = paletteFor('ios', dark, 'ember');
      for (const n of CHOICES) {
        const c = paletteFor('ios', dark, n);
        for (const k of [...NEUTRAL_KEYS, 'safe', 'safeSoft', 'danger', 'onDanger', 'scrim'] as const) expect({ n, dark, k, v: c[k] }).toEqual({ n, dark, k, v: base[k] });
      }
    }
  });

  it('RD-3 useTheme resolves the accent from the one ColorContext setting', () => {
    function Probe() { const { c } = useTheme(); return <Text testID="probe">{c.accent}</Text>; }
    for (const n of CHOICES) {
      const r = render(<ColorContext.Provider value={n}><Probe /></ColorContext.Provider>);
      expect({ n, accent: screen.getByTestId('probe').props.children }).toEqual({ n, accent: paletteFor(Platform.OS as 'ios', false, n).accent });
      r.unmount();
    }
  });

  it.each(CHOICES.flatMap((n) => MODES.flatMap((dark) => [[n, dark, false], [n, dark, true]] as const)))(
    'RD-5 %s (dark %s, Increase Contrast %s): the accent reads 4.5:1 on the screen and on rows, and words on it read',
    (n, dark, high) => {
      const c = paletteFor('ios', dark, n, high);
      expect({ onBg: contrast(c.accent, c.bg) >= 4.5 }).toEqual({ onBg: true });
      expect({ onSurface: contrast(c.accent, c.surface) >= 4.5 }).toEqual({ onSurface: true });
      expect({ onFill: contrast(c.accent, c.fill) >= 4.5 }).toEqual({ onFill: true });
      expect({ wordsOnAccent: contrast(c.accentInk, c.accent) >= 4.5 }).toEqual({ wordsOnAccent: true });
      expect({ body: contrast(c.ink, c.bg) >= 7, muted: contrast(c.muted, c.bg) >= 4.5 }).toEqual({ body: true, muted: true });
    },
  );

  it.each(CHOICES.flatMap((n) => MODES.map((dark) => [n, dark] as const)))('RD-5 %s (dark %s): Increase Contrast still gives its own, stronger set', (n, dark) => {
    const normal = paletteFor('ios', dark, n);
    const high = paletteFor('ios', dark, n, true);
    expect(contrast(high.accent, high.bg)).toBeGreaterThan(contrast(normal.accent, normal.bg));
    expect(contrast(high.muted, high.bg)).toBeGreaterThanOrEqual(7);
  });

  it('RD-4 Search and By date are ink, not accent (words and icons)', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Sandcastle' });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const c = paletteFor(Platform.OS as 'ios', false);
    for (const [name, word] of [['Search the photos', 'Search'], ['Show photos by the date they were taken', 'By date']] as const) {
      const btn = await screen.findByRole('button', { name });
      const color = StyleSheet.flatten(within(btn).getByText(word).props.style).color;
      expect({ word, color }).toEqual({ word, color: c.ink });
      const tint = (btn.findAll((n) => n.type === SymbolView)[0]?.props as { tintColor?: string } | undefined)?.tintColor;
      expect({ word, tint }).toEqual({ word, tint: c.ink });
    }
  });

  it('RD-6 the picked tab changes color, not fill: the same outline symbol, picked or not', () => {
    const tabs = tabsFor('owner');
    const iconOf = (current: (typeof tabs)[number]['name'], tab: number) => {
      const r = render(<HearthTabBar role="owner" current={current} onNavigate={() => {}} />);
      const p = screen.UNSAFE_getAllByType(SymbolView)[tab]!.props as { name: { ios: string; android: string }; tintColor: string; type?: string };
      r.unmount();
      return p;
    };
    tabs.forEach((t, i) => {
      const other = tabs[(i + 1) % tabs.length]!.name;
      const picked = iconOf(t.name, i);
      const rest = iconOf(other, i);
      expect({ tab: t.name, ios: picked.name.ios, android: picked.name.android }).toEqual({ tab: t.name, ios: rest.name.ios, android: rest.name.android });
      expect({ tab: t.name, ios: picked.name.ios }).toEqual({ tab: t.name, ios: expect.not.stringMatching(/\.fill\b/) });
      expect(picked.tintColor).not.toBe(rest.tintColor);
    });
  });

  it('RD-8 corners: 12 for rows and cards, 14 for iPhone dialogs and 28 for Android, nothing rounder than 12 but pills', () => {
    expect(RADIUS.medium).toBe(12);
    expect(dialogRadius('ios')).toBe(14);
    expect(dialogRadius('android')).toBe(28);
    // RD-8: the old 20 pt "large" corner (event card, reply box) is gone; rows use 12.
    const allowed = new Set([0, 4, 12, 999]);
    for (const [k, v] of Object.entries(RADIUS)) expect({ k, v, ok: allowed.has(v) }).toEqual({ k, v, ok: true });
  });

  it('RD-8 rows and cards are 12 corners on iPhone', () => {
    render(<Card testID="row"><Txt>Row</Txt></Card>);
    expect(StyleSheet.flatten(screen.getByTestId('row').props.style).borderRadius).toBe(12);
  });

  it.each([
    ['owner on Me', 'chase', () => <MeScreen />],
    ['grandparent on Help', 'jo', () => <HelpScreen />],
  ] as const)('RD-8 no card inside a card (%s)', async (_n, user, ui) => {
    await renderApp(ui(), { user });
    await screen.findByRole('radio', { name: 'Light screen' });
    const cards = screen.UNSAFE_getAllByType(Card);
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      const inner = card.findAll((n) => n.type === Card && n !== card);
      expect(inner).toHaveLength(0);
    }
  });
});
