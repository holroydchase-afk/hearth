// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DS-10: light and dark screens. Hearth follows the phone by default; anyone can pin Light or Dark
// on Help (viewers) or Me (posters). Both stay at 4.5:1 or better (DS-COLOR in designSystem.test.tsx).
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { memoryKV } from '../../platform/kv';
import { MoreScreen } from '../../screens/MoreScreen';
import { MeScreen } from '../../screens/MeScreen';
import { loadPrefs } from '../../state/prefs';
import { expectGrandparentSafe, renderApp, screenWords } from '../../test/renderApp';
import { isDark, statusBarStyle, useTheme } from '../theme';

function Probe() {
  const { dark, c } = useTheme();
  return <Text testID="probe" style={{ fontSize: 17 }}>{`${dark ? 'dark' : 'light'} ${c.bg}`}</Text>;
}

const probe = () => screen.getByTestId('probe').props.children as string;

describe('DS-10 light and dark screens', () => {
  it('DS-10: "Same as my phone" follows the phone; Light and Dark ignore it', () => {
    expect(isDark('system', 'dark')).toBe(true);
    expect(isDark('system', 'light')).toBe(false);
    expect(isDark('system', null)).toBe(false);
    expect(isDark('system', undefined)).toBe(false);
    expect(isDark('light', 'dark')).toBe(false);
    expect(isDark('dark', 'light')).toBe(true);
  });

  it('DS-10: the clock and battery at the top stay readable (light icons on dark, dark on light)', () => {
    expect(statusBarStyle(true)).toBe('light');
    expect(statusBarStyle(false)).toBe('dark');
  });

  it('DS-10: everyone starts on "Same as my phone"; an unknown saved value falls back to it', async () => {
    const kv = memoryKV();
    expect((await loadPrefs(kv, 'u1', 'viewer')).look).toBe('system');
    expect((await loadPrefs(kv, 'u1', 'owner')).look).toBe('system');
    await kv.setItem('hearth.prefs.v1.u1', JSON.stringify({ bigText: true, notify: 'push', look: 'purple' }));
    expect((await loadPrefs(kv, 'u1', 'viewer')).look).toBe('system');
    await kv.setItem('hearth.prefs.v1.u1', JSON.stringify({ bigText: true, notify: 'push', look: 'dark' }));
    expect((await loadPrefs(kv, 'u1', 'viewer')).look).toBe('dark');
  });

  // GUX-R10 (Nov 16): Light or dark left Help; she picks it in More → Light or dark.
  it('DS-10: a grandparent picks a dark screen in More, the whole app turns dark, and it stays after reopening', async () => {
    const kv = memoryKV();
    const first = await renderApp(<><MoreScreen /><Probe /></>, { user: 'jo', kv });
    fireEvent.press(await screen.findByRole('button', { name: 'Light or dark' }));
    const same = await screen.findByRole('radio', { name: 'Same as my phone (Recommended)' });
    expect(same.props.accessibilityState).toMatchObject({ checked: true });
    expect(probe()).toMatch(/^light /);

    fireEvent.press(screen.getByRole('radio', { name: 'Dark screen' }));
    await waitFor(() => expect(probe()).toMatch(/^dark /));
    expect(screen.getByRole('radio', { name: 'Dark screen' }).props.accessibilityState).toMatchObject({ checked: true });
    first.unmount();

    await renderApp(<><MoreScreen /><Probe /></>, { user: 'jo', kv });
    fireEvent.press(await screen.findByRole('button', { name: 'Light or dark' }));
    await screen.findByRole('radio', { name: 'Dark screen' });
    expect(probe()).toMatch(/^dark /);

    fireEvent.press(screen.getByRole('radio', { name: 'Light screen' }));
    await waitFor(() => expect(probe()).toMatch(/^light /));
  });

  // GUX-R10 (Nov 16): Help no longer repeats Light or dark (it's a row in More); Me keeps it after Bigger text.
  // engineer, flagged for qa-tdd: Easy view (RD-78) takes Bigger text's place on Me.
  it('DS-10: the choice sits right after Easy view, in plain words, on Me', async () => {
    await renderApp(<MeScreen />, { user: 'chase' });
    await screen.findByRole('radio', { name: 'Light screen' });
    const words = screenWords();
    expect(words).not.toMatch(/\b(theme|mode|appearance|system|settings)\b/i);
    expect(words.indexOf('Easy view')).toBeGreaterThanOrEqual(0);
    expect(words.indexOf('Easy view')).toBeLessThan(words.indexOf('Light or dark screen'));
    expectGrandparentSafe();
  });
});
