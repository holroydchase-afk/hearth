// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DS-1..DS-9 (docs/product/DESIGN-SYSTEM.md): each phone's own design system, plus Hearth's overrides.
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import * as TabBar from '../../screens/TabBar';
import { NATIVE_TAB_OPTIONS, TAB_ICONS, tabsFor } from '../../screens/TabBar';
import { expectGrandparentSafe } from '../../test/renderApp';
import { Button } from '../kit';
import * as theme from '../theme';
import { contrast, paletteFor } from '../theme';

describe('DS native design system', () => {
  // DS-12 (Atkinson, Nov 1) is superseded by RD-2 (phone's own font, DEC-59): see redesignLook.test.tsx.

  // qa-tdd, Nov 24 (TYPE-11, DEC-84): DS-2's "never goes under 17" is rewritten to SPEC-TYPE's TYPE-3 and TYPE-7: Easy view
  // keeps every style at 17 or more; with Easy view off only the secondary styles (callout..caption2) go under 17, on
  // the listed elements (typeScale.test.tsx sweeps the screens).
  it('DS-2 → TYPE-3 / TYPE-7: the named iPhone scale; body is 17 / 22, Easy view never under 17, only secondary styles under 17 when off', () => {
    const T = theme as unknown as { TYPE?: { standard: Record<string, { fontSize: number }>; easy: Record<string, { fontSize: number }> } };
    expect(T.TYPE?.standard.body).toMatchObject({ fontSize: 17, lineHeight: 22 });
    expect(T.TYPE?.easy.body).toMatchObject({ fontSize: 21, lineHeight: 26 });
    expect(Object.values(T.TYPE?.easy ?? {}).every((s) => s.fontSize >= 17)).toBe(true);
    const under = Object.entries(T.TYPE?.standard ?? {}).filter(([, s]) => s.fontSize < 17).map(([n]) => n);
    expect(under).toEqual(['callout', 'subheadline', 'footnote', 'caption1', 'caption2']);
  });

  // qa-tdd, Nov 18: RD-94 (DEC-68, Chase 14:55Z) replaces the tan paper with Paper, an off-white page, the default theme.
  it('DS-11 → RD-94: Paper on every phone, light and dark, by default (DEC-68)', () => {
    expect(paletteFor('ios', false)).toMatchObject({ bg: '#F7F7F4', accent: '#AD371D' });
    expect(paletteFor('ios', true)).toMatchObject({ bg: '#131210', accent: '#FF8A65' });
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
    // TYPE-6 (DEC-84): Android's own bar uses caption1, Material's 12 sp with Easy view off and 17 with it on.
    const label = (TabBar as unknown as { nativeTabLabelStyle?: (e: boolean) => { fontSize: number } }).nativeTabLabelStyle;
    expect([label?.(false)?.fontSize, label?.(true)?.fontSize]).toEqual([12, 17]);
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
