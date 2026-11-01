// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DS-1..DS-9 (docs/product/DESIGN-SYSTEM.md): each phone's own design system, plus Hearth's overrides.
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import pkg from '../../../package.json';
import { NATIVE_TAB_OPTIONS, TAB_ICONS, tabsFor } from '../../screens/TabBar';
import { expectGrandparentSafe } from '../../test/renderApp';
import { Button, Txt } from '../kit';
import { FONT, FONT_FILES, contrast, fontFamily, paletteFor, typeScale } from '../theme';

describe('DS native design system', () => {
  it('DS-12: Atkinson Hyperlegible Next everywhere, only Regular, Medium and SemiBold, no italics', () => {
    expect(FONT).toEqual({
      regular: 'AtkinsonHyperlegibleNext_400Regular',
      medium: 'AtkinsonHyperlegibleNext_500Medium',
      semibold: 'AtkinsonHyperlegibleNext_600SemiBold',
    });
    expect(Object.keys(FONT_FILES).sort()).toEqual(Object.values(FONT).sort());
    expect(Object.keys(pkg.dependencies).filter((d) => d.startsWith('@expo-google-fonts/'))).toEqual(['@expo-google-fonts/atkinson-hyperlegible-next']);
    expect(fontFamily).toBe(FONT.regular);
  });

  it('DS-12: body is Regular; names, titles and buttons are SemiBold; nothing fakes bold with fontWeight', () => {
    render(<>
      <Txt>Body words</Txt><Txt variant="muted">Quiet words</Txt><Txt variant="strong">Grandma Jo</Txt>
      <Txt variant="title">A title</Txt><Txt variant="display">Photos</Txt>
      <Button label="Send" onPress={() => {}} />
    </>);
    const f = (w: string) => StyleSheet.flatten(screen.getByText(w).props.style);
    expect(f('Body words')).toMatchObject({ fontFamily: FONT.regular });
    expect(f('Quiet words')).toMatchObject({ fontFamily: FONT.regular });
    for (const w of ['Grandma Jo', 'A title', 'Photos', 'Send']) expect(f(w)).toMatchObject({ fontFamily: FONT.semibold });
    for (const w of ['Body words', 'Quiet words', 'Grandma Jo', 'A title', 'Photos', 'Send']) expect(f(w).fontWeight).toBeUndefined();
  });

  it('DS-2: text follows the platform ramp (body 17, title 22, large 28) and never goes under 17', () => {
    expect(typeScale(false)).toMatchObject({ base: 17, title: 22, display: 28 });
    const big = typeScale(true);
    expect(big.base).toBeGreaterThanOrEqual(21);
    expect(big.title).toBeGreaterThan(big.base);
  });

  it('DS-11: one warm Hearth palette on every phone, light and dark (no cold system gray, no pure black)', () => {
    expect(paletteFor('ios', false)).toMatchObject({ bg: '#F7F5F2', surface: '#FFFFFF', ink: '#1C1B19', accent: '#0B57D0', accentInk: '#FFFFFF' });
    expect(paletteFor('ios', true)).toMatchObject({ bg: '#151413', surface: '#232120', ink: '#F4F1EC', accent: '#8AB4F8', accentInk: '#0A2558' });
    expect(paletteFor('android', false)).toEqual(paletteFor('ios', false));
    expect(paletteFor('android', true)).toEqual(paletteFor('ios', true));
    expect(paletteFor('web', false)).toEqual(paletteFor('ios', false));
    expect(paletteFor('web', true)).toEqual(paletteFor('ios', true));
  });

  it.each([
    ['ios', false], ['ios', true], ['android', false], ['android', true],
  ] as const)('DS-COLOR: every text pair is 4.5:1 or better (%s, dark %s)', (os, dark) => {
    const c = paletteFor(os, dark);
    const pairs: [string, string, string][] = [
      ['ink on bg', c.ink, c.bg], ['ink on surface', c.ink, c.surface], ['muted on bg', c.muted, c.bg], ['muted on surface', c.muted, c.surface],
      ['accent text on surface', c.accent, c.surface], ['accent text on bg', c.accent, c.bg], ['button text on accent', c.accentInk, c.accent],
      ['ink on accentSoft', c.ink, c.accentSoft], ['safe on safeSoft', c.safe, c.safeSoft], ['danger text', c.onDanger, c.danger],
      ['danger on surface', c.danger, c.surface], ['ink on fill', c.ink, c.fill], ['button text on fill', c.accent, c.fill],
      ['DS-11 waiting button (muted on fill)', c.muted, c.fill], ['DS-11 muted on a picked choice', c.muted, c.accentSoft], ['DS-11 accent on a picked choice', c.accent, c.accentSoft],
    ];
    // DS-11: 7:1 (WCAG AAA) for body text on its own background; 4.5:1 for everything else.
    for (const [name, fg, bg] of pairs) expect({ name, ok: contrast(fg, bg) >= 4.5 }).toEqual({ name, ok: true });
    expect(contrast(c.ink, c.bg)).toBeGreaterThanOrEqual(7);
    expect(contrast(c.ink, c.surface)).toBeGreaterThanOrEqual(7);
  });

  it('DS-3 / DS-5: every tab has an SF Symbol, a Material icon and a word, and labels never hide or shrink', () => {
    for (const t of [...tabsFor('owner'), ...tabsFor('viewer')]) {
      expect(TAB_ICONS[t.name]).toEqual({ sf: expect.any(String), md: expect.any(String) });
      expect(t.label).toMatch(/\w/);
    }
    expect(NATIVE_TAB_OPTIONS).toMatchObject({ minimizeBehavior: 'never', labelVisibilityMode: 'labeled' });
    expect(NATIVE_TAB_OPTIONS.labelStyle.fontSize).toBeGreaterThanOrEqual(17);
  });

  it('DS-1 / DS-3: a button with an icon still shows its word and is 48 pt', () => {
    render(<Button label="Close" icon={{ sf: 'xmark', md: 'close' }} onPress={() => {}} />);
    expect(screen.getByText('Close')).toBeTruthy();
    expectGrandparentSafe();
  });

  it('DS-11: a button that is waiting (like Send before you type) is a clear gray, not a see-through blue', () => {
    const c = paletteFor('ios', false);
    render(<Button label="Send" softDisabled onPress={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Send' });
    const st = StyleSheet.flatten(typeof btn.props.style === 'function' ? btn.props.style({ pressed: false }) : btn.props.style);
    expect(st).toMatchObject({ backgroundColor: c.fill, opacity: 1 });
    expect(StyleSheet.flatten(screen.getByText('Send').props.style)).toMatchObject({ color: c.muted });
  });
});
