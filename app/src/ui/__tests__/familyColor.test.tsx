// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-24..RD-26 (docs/product/SPEC-REDESIGN.md, Family color, DEC-59). Replaces COLOR-1..4 (Nov 5: Ember, Sage
// and Plum for everyone on Help or Me). Now the family's owner picks Ember (default), Forest or Plum; phase 1
// saves it in this phone's prefs.color and recolors only that phone. Everyone else sees Ember and no picker.
// Phase 1a: the picker still sits on Me; 1b moves it into More (RD-15), and these tests move with it.
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { FIXTURE } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { HelpScreen } from '../../screens/HelpScreen';
import { MeScreen } from '../../screens/MeScreen';
import { loadPrefs } from '../../state/prefs';
import { expectGrandparentSafe, renderApp, screenWords } from '../../test/renderApp';
import { useTheme } from '../theme';

const EMBER = '#B23A1E';
const FOREST = { light: '#2E7D4F', dark: '#6FCF97' };
const PLUM = { light: '#8E3A8F', dark: '#D9A0E0' };
const NAMES = ['Ember', 'Forest', 'Plum'];

function Probe() {
  const { c } = useTheme();
  return <Text testID="probe" style={{ fontSize: 17 }}>{c.accent}</Text>;
}
const probe = () => screen.getByTestId('probe').props.children as string;
const saved = (kv: ReturnType<typeof memoryKV>, user: keyof typeof FIXTURE.users) => kv.getItem(`hearth.prefs.v1.${FIXTURE.users[user].id}`);
const backgrounds = (node: ReturnType<typeof screen.getByRole>) =>
  (node.findAll((n) => typeof n.type === 'string') as typeof node[]).map((n) => StyleSheet.flatten(n.props.style)?.backgroundColor);

describe('RD Family color', () => {
  it('RD-24 the owner sees Family color: Ember (picked by default), Forest and Plum, each with a swatch and its name', async () => {
    await renderApp(<MeScreen />, { user: 'chase' });
    expect(await screen.findByRole('header', { name: 'Family color' })).toBeTruthy();
    const rows = NAMES.map((n) => screen.getByRole('radio', { name: n }));
    expect(rows.map((r) => r.props.accessibilityState?.checked)).toEqual([true, false, false]);
    expect(screen.queryByRole('radio', { name: 'Sage' })).toBeNull();
    // A swatch of the color itself in each row.
    expect(backgrounds(rows[0]!)).toContain(EMBER);
    expect(backgrounds(rows[1]!)).toEqual(expect.arrayContaining([expect.stringMatching(new RegExp(`${FOREST.light}|${FOREST.dark}`))]));
    expect(backgrounds(rows[2]!)).toEqual(expect.arrayContaining([expect.stringMatching(new RegExp(`${PLUM.light}|${PLUM.dark}`))]));
    const words = screenWords();
    expect(words).not.toMatch(/\b(theme|palette|accent)\b/i);
    expectGrandparentSafe();
  });

  it('RD-24 / RD-25 the owner picks Forest: the app recolors, it is saved in prefs.color, and it stays after reopening', async () => {
    const kv = memoryKV();
    const first = await renderApp(<><MeScreen /><Probe /></>, { user: 'chase', kv });
    await screen.findByRole('radio', { name: 'Forest' });
    expect(probe()).toBe(EMBER);
    fireEvent.press(screen.getByRole('radio', { name: 'Forest' }));
    await waitFor(() => expect(probe()).toBe(FOREST.light));
    expect(screen.getByRole('radio', { name: 'Forest' }).props.accessibilityState).toMatchObject({ checked: true });
    await waitFor(async () => expect(JSON.parse((await saved(kv, 'chase'))!)).toMatchObject({ color: 'forest' }));
    first.unmount();
    await renderApp(<><MeScreen /><Probe /></>, { user: 'chase', kv });
    await screen.findByRole('radio', { name: 'Forest' });
    expect(probe()).toBe(FOREST.light);
  });

  it('RD-25 an old Sage on the owner\'s phone becomes Forest; an unknown value falls back to Ember', async () => {
    const kv = memoryKV();
    const put = (color: string) => kv.setItem('hearth.prefs.v1.u1', JSON.stringify({ bigText: false, notify: 'push', look: 'system', color }));
    expect((await loadPrefs(kv, 'u1', 'owner')).color).toBe('ember');
    await put('sage');
    expect((await loadPrefs(kv, 'u1', 'owner')).color).toBe('forest');
    await put('forest');
    expect((await loadPrefs(kv, 'u1', 'owner')).color).toBe('forest');
    await put('blue');
    expect((await loadPrefs(kv, 'u1', 'owner')).color).toBe('ember');
  });

  it.each(['adult', 'viewer'] as const)('RD-25 a saved Sage, Plum or Forest from COLOR-1 is ignored for an %s: Ember', async (role) => {
    const kv = memoryKV();
    for (const color of ['sage', 'plum', 'forest']) {
      await kv.setItem('hearth.prefs.v1.u2', JSON.stringify({ bigText: true, notify: 'push', look: 'system', color }));
      expect({ color, loaded: (await loadPrefs(kv, 'u2', role)).color }).toEqual({ color, loaded: 'ember' });
    }
  });

  it('RD-25 the owner\'s pick recolors only the owner\'s phone: Grandma Jo with an old Plum still sees Ember', async () => {
    const kv = memoryKV();
    await kv.setItem(`hearth.prefs.v1.${FIXTURE.users.jo.id}`, JSON.stringify({ bigText: true, notify: 'push', look: 'system', color: 'plum' }));
    await renderApp(<><HelpScreen /><Probe /></>, { user: 'jo', kv });
    await screen.findByRole('radio', { name: 'Light screen' });
    expect(probe()).toBe(EMBER);
  });

  it.each([
    ['viewer Grandma Jo on Help', 'jo', () => <HelpScreen />],
    ['adult Alex on Me', 'alex', () => <MeScreen />],
  ] as const)('RD-26 no color picker anywhere for the %s', async (_n, user, ui) => {
    await renderApp(<>{ui()}<Probe /></>, { user });
    await screen.findByRole('radio', { name: 'Light screen' });
    for (const n of [...NAMES, 'Sage']) expect(screen.queryByRole('radio', { name: n })).toBeNull();
    expect(screen.queryByRole('header', { name: /^(Family color|Colors)$/ })).toBeNull();
    expect(screenWords()).not.toMatch(/Family color|\bColors\b/);
    expect(probe()).toBe(EMBER);
  });

  it('RD-24 the picker sits after Light or dark on the owner\'s Me', async () => {
    await renderApp(<MeScreen />, { user: 'chase' });
    await screen.findByRole('header', { name: 'Family color' });
    const words = screenWords();
    expect(words.indexOf('Light or dark screen')).toBeGreaterThanOrEqual(0);
    expect(words.indexOf('Light or dark screen')).toBeLessThan(words.indexOf('Family color'));
    expect(within(screen.getByRole('radio', { name: 'Ember' })).getByText('Ember')).toBeTruthy();
  });
});
