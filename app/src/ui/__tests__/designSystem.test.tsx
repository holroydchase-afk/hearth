// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DS-1..DS-9 (docs/product/DESIGN-SYSTEM.md): each phone's own design system, plus Hearth's overrides.
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { NATIVE_TAB_OPTIONS, TAB_ICONS, tabsFor } from '../../screens/TabBar';
import { expectGrandparentSafe } from '../../test/renderApp';
import { Button } from '../kit';
import { contrast, paletteFor, typeScale } from '../theme';

describe('DS native design system', () => {
  // DS-12 (Atkinson, Nov 1) is superseded by RD-2 (phone's own font, DEC-59): see redesignLook.test.tsx.

  it('DS-2: text follows the platform ramp (body 17, title 22, large 28) and never goes under 17', () => {
    expect(typeScale(false)).toMatchObject({ base: 17, title: 22, display: 28 });
    const big = typeScale(true);
    expect(big.base).toBeGreaterThanOrEqual(21);
    expect(big.title).toBeGreaterThan(big.base);
  });

  // engineer, flagged for qa-tdd: RD-84/85 (DEC-67) replaces white and true black with warm paper and warm near-black.
  it('DS-11 → RD-84: warm paper and warm near-black on every phone, light and dark, Ember by default (DEC-67)', () => {
    expect(paletteFor('ios', false)).toMatchObject({ bg: '#F1E9D2', accent: '#AD371D' });
    expect(paletteFor('ios', true)).toMatchObject({ bg: '#14100D', accent: '#FF8A65' });
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
