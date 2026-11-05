// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// COLOR-1..4 (Chase, Nov 5: "I'd like all three color options"): Ember, Sage and Plum, each with a light and
// a dark screen, picked on Help (viewers) or Me (posters) and saved on the phone. Ember is the default.
// Every pair keeps DS-COLOR's contrast (4.5:1, body text 7:1).
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { memoryKV } from '../../platform/kv';
import { HelpScreen } from '../../screens/HelpScreen';
import { MeScreen } from '../../screens/MeScreen';
import { loadPrefs } from '../../state/prefs';
import { expectGrandparentSafe, renderApp, screenWords } from '../../test/renderApp';
import { COLOR_NAMES, contrast, paletteFor, useTheme } from '../theme';

function Probe() {
  const { c } = useTheme();
  return <Text testID="probe" style={{ fontSize: 17 }}>{c.accent}</Text>;
}
const probe = () => screen.getByTestId('probe').props.children as string;

describe('COLOR: Ember, Sage and Plum', () => {
  it('COLOR-1 three palettes, the light accents Chase saw on Nov 4, Ember by default', () => {
    expect(COLOR_NAMES).toEqual(['ember', 'sage', 'plum']);
    expect(paletteFor('ios', false)).toEqual(paletteFor('ios', false, 'ember'));
    expect(paletteFor('ios', false, 'ember')).toMatchObject({ accent: '#A4421F', bg: '#FAF6F1' });
    expect(paletteFor('ios', false, 'sage')).toMatchObject({ accent: '#2D6A4E', bg: '#F5F7F3' });
    expect(paletteFor('ios', false, 'plum')).toMatchObject({ accent: '#5A3EA6', bg: '#F8F6FA' });
    for (const n of COLOR_NAMES) expect(paletteFor('android', true, n)).toEqual(paletteFor('ios', true, n));
  });

  it.each(COLOR_NAMES.flatMap((n) => [[n, false], [n, true]] as const))('COLOR-2 every text pair reads (%s, dark %s)', (n, dark) => {
    const c = paletteFor('ios', dark, n);
    const pairs: [string, string][] = [
      [c.ink, c.bg], [c.ink, c.surface], [c.muted, c.bg], [c.muted, c.surface], [c.accent, c.surface], [c.accent, c.bg],
      [c.accentInk, c.accent], [c.ink, c.accentSoft], [c.safe, c.safeSoft], [c.onDanger, c.danger], [c.danger, c.surface],
      [c.ink, c.fill], [c.accent, c.fill], [c.muted, c.fill], [c.muted, c.accentSoft], [c.accent, c.accentSoft],
    ];
    for (const [fg, bg] of pairs) expect({ fg, bg, ok: contrast(fg, bg) >= 4.5 }).toEqual({ fg, bg, ok: true });
    expect(contrast(c.ink, c.bg)).toBeGreaterThanOrEqual(7);
    expect(contrast(c.ink, c.surface)).toBeGreaterThanOrEqual(7);
  });

  it('COLOR-3 everyone starts on Ember; an unknown saved value falls back to it', async () => {
    const kv = memoryKV();
    expect((await loadPrefs(kv, 'u1', 'viewer')).color).toBe('ember');
    await kv.setItem('hearth.prefs.v1.u1', JSON.stringify({ bigText: true, notify: 'push', look: 'system', color: 'blue' }));
    expect((await loadPrefs(kv, 'u1', 'viewer')).color).toBe('ember');
    await kv.setItem('hearth.prefs.v1.u1', JSON.stringify({ bigText: true, notify: 'push', look: 'system', color: 'plum' }));
    expect((await loadPrefs(kv, 'u1', 'viewer')).color).toBe('plum');
  });

  it('COLOR-4 a grandparent picks Sage on Help, the app changes color, and it stays after reopening', async () => {
    const kv = memoryKV();
    const first = await renderApp(<><HelpScreen /><Probe /></>, { user: 'jo', kv });
    expect((await screen.findByRole('radio', { name: 'Ember' })).props.accessibilityState).toMatchObject({ checked: true });
    expect(probe()).toBe('#A4421F');
    fireEvent.press(screen.getByRole('radio', { name: 'Sage' }));
    await waitFor(() => expect(probe()).toBe('#2D6A4E'));
    first.unmount();
    await renderApp(<><HelpScreen /><Probe /></>, { user: 'jo', kv });
    await screen.findByRole('radio', { name: 'Sage' });
    expect(probe()).toBe('#2D6A4E');
  });

  it('COLOR-4 the choice sits after Light or dark, in plain words, on Help and on Me', async () => {
    const help = await renderApp(<HelpScreen />, { user: 'jo' });
    await screen.findByRole('radio', { name: 'Plum' });
    let words = screenWords();
    expect(words.indexOf('Light or dark screen')).toBeLessThan(words.indexOf('Colors'));
    expect(words).not.toMatch(/\b(theme|palette|accent)\b/i);
    expectGrandparentSafe();
    help.unmount();
    await renderApp(<MeScreen />, { user: 'chase' });
    expect(await screen.findByRole('radio', { name: 'Plum' })).toBeTruthy();
  });
});
