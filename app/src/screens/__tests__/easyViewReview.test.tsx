// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// grandparent-ux review of Easy view (RD-78, DEC-66; Nov 17). GUX-R11: the Easy view page's On / Off rows are the
// same radio rows as Light or dark (kit `Choice kind="radio"`): an accent check on the picked row, 48 pt+, and
// aria-checked for the web build. GUX-R12: Me shows the same Easy view block (title, line, On and Off), and picking
// Off there works like it does from More. Written first (Nov 17).
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { FIXTURE } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { MoreScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';
import { Choice } from '../../ui/kit';
import { paletteFor } from '../../ui/theme';
import { MeScreen } from '../MeScreen';
import { HearthTabBar } from '../TabBar';

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const light = () => paletteFor(Platform.OS as 'ios', false);
const slow = { timeout: 5000 };
const LINE = 'Bigger words, and a word under each button at the bottom of the screen.';

/** The check symbols drawn inside a row, with their tint. */
const checks = (row: Inst) =>
  (row.findAll((n: Inst) => n.type === SymbolView && /check/.test(JSON.stringify(n.props.name))) as Inst[]).map((n) => n.props.tintColor);

describe('GUX-R11 (RD-78) Easy view On / Off rows are Light or dark\'s radio rows', () => {
  async function openEasyView() {
    await renderApp(<MoreScreen />, { waitReady: false, user: 'chase' });
    fireEvent.press(await screen.findByRole('button', { name: 'Easy view, Off' }, slow));
    await screen.findByRole('header', { name: 'Easy view' }, slow);
  }

  it('GUX-R11 the On and Off rows render through Choice kind="radio", like Light or dark', async () => {
    await openEasyView();
    const rows = screen.UNSAFE_getAllByType(Choice).map((c) => ({ label: c.props.label, kind: c.props.kind }));
    expect(rows).toEqual([{ label: 'On', kind: 'radio' }, { label: 'Off', kind: 'radio' }]);
  });

  it('GUX-R11 the checked row shows one accent check (c.accent); the other shows none', async () => {
    await openEasyView();
    expect(checks(screen.getByRole('radio', { name: 'Off' }))).toEqual([light().accent]);
    expect(checks(screen.getByRole('radio', { name: 'On' }))).toEqual([]);
  });

  it('GUX-R11 each row is 48 pt+ and carries aria-checked for the web build, both directions', async () => {
    await openEasyView();
    for (const [name, checked] of [['On', false], ['Off', true]] as const) {
      const r = screen.getByRole('radio', { name });
      expect({ name, tall: Number(flat(r.props.style).minHeight) >= 48 }).toEqual({ name, tall: true });
      expect({ name, aria: r.props['aria-checked'], state: r.props.accessibilityState?.checked }).toEqual({ name, aria: checked, state: checked });
    }
  });
});

describe('GUX-R12 (RD-78) Me shows the same Easy view block', () => {
  const key = `hearth.prefs.v1.${FIXTURE.users.jo.id}`;
  function MeWithTabs() {
    return (
      <View>
        <MeScreen />
        <HearthTabBar role="viewer" current="gallery" onNavigate={() => {}} />
      </View>
    );
  }

  it('GUX-R12 Me shows the "Easy view" header, the line, and On and Off radios (On checked for Grandma Jo)', async () => {
    await renderApp(<MeWithTabs />, { waitReady: false, user: 'jo' });
    expect(await screen.findByRole('header', { name: 'Easy view' }, slow)).toBeTruthy();
    expect(screen.getByText(LINE)).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'On' }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByRole('radio', { name: 'Off' }).props.accessibilityState).toMatchObject({ checked: false });
  });

  it('GUX-R12 picking Off on Me saves easyView=false and the tab words disappear at once', async () => {
    const kv = memoryKV();
    await renderApp(<MeWithTabs />, { waitReady: false, user: 'jo', kv });
    await screen.findByRole('header', { name: 'Easy view' }, slow);
    const gallery = screen.getByRole('tab', { name: 'Gallery' });
    expect(within(gallery).getByText('Gallery')).toBeTruthy(); // the other direction: On shows the word
    fireEvent.press(screen.getByRole('radio', { name: 'Off' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Off' }).props.accessibilityState).toMatchObject({ checked: true }));
    for (const word of ['Gallery', 'Feed', 'More']) {
      expect({ word, shown: within(screen.getByRole('tab', { name: word })).queryByText(word) !== null }).toEqual({ word, shown: false });
    }
    await waitFor(() => expect(JSON.parse(kv.dump()[key] ?? '{}')).toMatchObject({ easyView: false }));
  });
});
