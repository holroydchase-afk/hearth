// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Easy view on screen (docs/product/SPEC-REDESIGN.md 1g, RD-76..RD-79, DEC-66). Off: icon-only tabs that keep their
// spoken names, tab role, selected state and 48 pt targets; default text sizes. On: a 17 pt+ word under every tab
// and Bigger text's sizes. More's "Bigger text" row becomes "Easy view" with On / Off in words and a page with two
// checked rows. Nothing else changes. Written first (Nov 17), red until Easy view exists.
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FakeBackend, FIXTURE } from '../../api/fake/FakeBackend';
import type { Role } from '../../api/HearthApi';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { FeedScreen, MoreScreen } from '../../test/redesignScreens';
import { expectGrandparentSafe, renderApp, type FixtureUser } from '../../test/renderApp';
import { Txt } from '../../ui/kit';
import { HearthTabBar } from '../TabBar';

const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const WORDS: Record<Role, string[]> = { owner: ['Gallery', 'Share', 'Feed', 'More'], adult: ['Gallery', 'Share', 'Feed', 'More'], viewer: ['Gallery', 'Feed', 'More'] };
const ROLE: Record<FixtureUser, Role> = { chase: 'owner', alex: 'adult', jo: 'viewer' } as Record<FixtureUser, Role>;
const key = (u: FixtureUser) => `hearth.prefs.v1.${FIXTURE.users[u].id}`;
const kvWith = (u: FixtureUser, easyView: boolean) => memoryKV({ [key(u)]: JSON.stringify({ easyView }) });
const slow = { timeout: 5000 };

/** The tab bar, More and one line of body words side by side, as the app shows them. */
function Shell({ role, newMessages = 0 }: { role: Role; newMessages?: number }) {
  return (
    <View>
      <MoreScreen />
      <Txt testID="probe">Probe words</Txt>
      <HearthTabBar role={role} current="gallery" onNavigate={() => {}} newMessages={newMessages} />
    </View>
  );
}
const bodySize = () => Number(flat(screen.getByTestId('probe').props.style).fontSize);

function expectIconOnly(role: Role) {
  const tabs = screen.getAllByRole('tab');
  expect(tabs.map((t) => String(t.props.accessibilityLabel))).toEqual(WORDS[role]);
  for (const [i, word] of WORDS[role].entries()) {
    const tab = tabs[i]!;
    expect({ word, shown: within(tab).queryByText(word) !== null }).toEqual({ word, shown: false });
    expect(within(tab).UNSAFE_getAllByType(SymbolView)).toHaveLength(1);
    const s = flat(tab.props.style);
    expect({ word, h: Number(s.minHeight ?? s.height ?? 0) >= 48, w: Number(s.minWidth ?? s.width ?? 0) >= 48 }).toEqual({ word, h: true, w: true });
  }
}

function expectWordsUnder(role: Role) {
  const tabs = screen.getAllByRole('tab');
  expect(tabs.map((t) => String(t.props.accessibilityLabel))).toEqual(WORDS[role]);
  for (const [i, word] of WORDS[role].entries()) {
    const label = within(tabs[i]!).getByText(word); // every tab, picked or not (DS-5)
    expect({ word, size: Number(flat(label.props.style).fontSize) >= 17 }).toEqual({ word, size: true });
  }
}

describe('RD-76 Easy view Off: icon-only tabs', () => {
  it.each([['chase'], ['alex']] as const)('RD-76 %s (a parent) with nothing saved gets icon-only tabs, spoken names, tab role, selected state, 48 pt', async (user) => {
    await renderApp(<Shell role={ROLE[user]} />, { waitReady: false, user });
    await screen.findByRole('header', { name: 'More' }, slow);
    expectIconOnly(ROLE[user]);
    expect(screen.getByRole('tab', { name: 'Gallery' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('tab', { name: 'Feed' }).props.accessibilityState).toMatchObject({ selected: false });
    expect(bodySize()).toBe(17); // default sizes (RD-65 names 17 pt)
  });

  it('RD-76 a viewer who turned Easy view Off also gets icon-only tabs', async () => {
    await renderApp(<Shell role="viewer" />, { waitReady: false, user: 'jo', kv: kvWith('jo', false) });
    await screen.findByRole('header', { name: 'More' }, slow);
    expectIconOnly('viewer');
    expect(bodySize()).toBe(17);
  });

  it('RD-76 RD-14 with a new message More is still spoken "More, new message" and shows no word', async () => {
    await renderApp(<Shell role="owner" newMessages={1} />, { waitReady: false, user: 'chase' });
    await screen.findByRole('header', { name: 'More' }, slow);
    const more = screen.getByRole('tab', { name: 'More, new message' });
    expect(within(more).queryByText('More')).toBeNull();
    expect(within(more).getByTestId('more-dot')).toBeTruthy();
  });
});

describe('RD-77 Easy view On: a word under every tab, bigger text', () => {
  it('RD-77 Grandma Jo (viewer) with nothing saved gets a 17 pt+ word under every tab and 21 pt body words', async () => {
    await renderApp(<Shell role="viewer" />, { waitReady: false, user: 'jo' });
    await screen.findByRole('header', { name: 'More' }, slow);
    expectWordsUnder('viewer');
    expect(bodySize()).toBe(21);
    expectGrandparentSafe();
  });

  it('RD-77 a parent who turned Easy view On gets the words and bigger text too', async () => {
    await renderApp(<Shell role="owner" />, { waitReady: false, user: 'chase', kv: kvWith('chase', true) });
    await screen.findByRole('header', { name: 'More' }, slow);
    expectWordsUnder('owner');
    expect(bodySize()).toBe(21);
  });
});

describe('RD-78 More → Easy view', () => {
  it.each([
    // engineer, flagged for qa-tdd: CAL-14 adds Birthdays after Events for every role.
    // engineer, flagged for qa-tdd: DEC-87 (SPEC-MEDIA 5.1) puts "Videos and data" right after Light or dark for every role.
    ['chase', 'Off', ['Messages', 'Groups', 'Events', 'Birthdays', 'Easy view', 'Light or dark', 'Videos and data', 'Theme', 'Me', 'Help']],
    ['alex', 'Off', ['Messages', 'Groups', 'Events', 'Birthdays', 'Easy view', 'Light or dark', 'Videos and data', 'Me', 'Help']],
    ['jo', 'On', ['Messages', 'Events', 'Birthdays', 'Easy view', 'Light or dark', 'Videos and data', 'Me', 'Help']],
  ] as const)('RD-78 %s\'s More has "Easy view" where Bigger text was, with %s in words', async (user, state, rows) => {
    await renderApp(<MoreScreen />, { waitReady: false, user });
    await screen.findByRole('header', { name: 'More' }, slow);
    expect(screen.getAllByRole('button').map((b) => String(b.props.accessibilityLabel).split(',')[0])).toEqual(rows);
    expect(screen.queryByText('Bigger text')).toBeNull();
    const row = screen.getByRole('button', { name: `Easy view, ${state}` });
    expect(within(row).getByText('Easy view')).toBeTruthy();
    expect(within(row).getByText(state)).toBeTruthy();
    expect(Number(flat(row.props.style).minHeight)).toBeGreaterThanOrEqual(48);
  });

  it('RD-78 the Easy view page: title, one line, On and Off rows with a check on the current one, 48 pt; Back returns to More', async () => {
    await renderApp(<MoreScreen />, { waitReady: false, user: 'chase' });
    fireEvent.press(await screen.findByRole('button', { name: 'Easy view, Off' }, slow));
    expect(await screen.findByRole('header', { name: 'Easy view' }, slow)).toBeTruthy();
    expect(screen.getByText('Bigger words, and a word under each button at the bottom of the screen.')).toBeTruthy();
    const on = screen.getByRole('radio', { name: 'On' });
    const off = screen.getByRole('radio', { name: 'Off' });
    expect(on.props.accessibilityState).toMatchObject({ checked: false });
    expect(off.props.accessibilityState).toMatchObject({ checked: true });
    for (const r of [on, off]) expect(Number(flat(r.props.style).minHeight)).toBeGreaterThanOrEqual(48);
    expect(screen.queryByRole('switch')).toBeNull(); // not the old Bigger text switch
    expectGrandparentSafe();
    fireEvent.press(screen.getByRole('button', { name: 'Back to More' }));
    expect(await screen.findByRole('header', { name: 'More' }, slow)).toBeTruthy();
  });

  it('RD-78 picking On changes the tabs and text at once, saves it for this person, and More reads "Easy view, On"', async () => {
    const kv = memoryKV();
    await renderApp(<Shell role="owner" />, { waitReady: false, user: 'chase', kv });
    fireEvent.press(await screen.findByRole('button', { name: 'Easy view, Off' }, slow));
    await screen.findByRole('header', { name: 'Easy view' }, slow);
    expectIconOnly('owner');
    fireEvent.press(screen.getByRole('radio', { name: 'On' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'On' }).props.accessibilityState).toMatchObject({ checked: true }));
    expect(screen.getByRole('radio', { name: 'Off' }).props.accessibilityState).toMatchObject({ checked: false });
    expectWordsUnder('owner'); // no restart
    expect(bodySize()).toBe(21);
    await waitFor(() => expect(JSON.parse(kv.dump()[key('chase')] ?? '{}')).toMatchObject({ easyView: true }));
    expect(JSON.parse(kv.dump()[key('chase')]!)).not.toHaveProperty('bigText');
    expect(kv.dump()[key('jo')]).toBeUndefined(); // only this person's choice
    fireEvent.press(screen.getByRole('button', { name: 'Back to More' }));
    expect(await screen.findByRole('button', { name: 'Easy view, On' }, slow)).toBeTruthy();
  });

  it('RD-78 picking Off as Grandma Jo takes the words away at once and is still Off next time she opens the app', async () => {
    const kv = memoryKV();
    const first = await renderApp(<Shell role="viewer" />, { waitReady: false, user: 'jo', kv });
    fireEvent.press(await screen.findByRole('button', { name: 'Easy view, On' }, slow));
    await screen.findByRole('header', { name: 'Easy view' }, slow);
    fireEvent.press(screen.getByRole('radio', { name: 'Off' }));
    await waitFor(() => expectIconOnly('viewer'));
    expect(bodySize()).toBe(17);
    await waitFor(() => expect(JSON.parse(kv.dump()[key('jo')] ?? '{}')).toMatchObject({ easyView: false }));
    first.unmount();
    await renderApp(<Shell role="viewer" />, { waitReady: false, user: 'jo', kv });
    expect(await screen.findByRole('button', { name: 'Easy view, Off' }, slow)).toBeTruthy();
    expectIconOnly('viewer');
  });
});

describe('RD-79 Easy view changes only the tab words and the text size', () => {
  async function feedButtons(easyView: boolean) {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Pumpkin patch' });
    await seedPost(be, { caption: 'Lake day', photos: 2 });
    const r = await renderApp(<FeedScreen />, { waitReady: false, user: 'chase', be, kv: kvWith('chase', easyView) });
    await screen.findByText('Lake day', {}, slow);
    const got = screen.getAllByRole('button').map((b) => String(b.props.accessibilityLabel)).sort();
    expectGrandparentSafe();
    r.unmount();
    return got;
  }

  it('RD-79 Feed has the same buttons, each with its spoken name, with Easy view On and Off', async () => {
    const off = await feedButtons(false);
    const on = await feedButtons(true);
    expect(off.length).toBeGreaterThan(0);
    expect(on).toEqual(off);
    for (const l of off) expect(l).toMatch(/\S/);
  });

  it.each([['Off', false], ['On', true]] as const)('RD-79 More\'s rows keep their icon and word with Easy view %s', async (state, easyView) => {
    await renderApp(<MoreScreen />, { waitReady: false, user: 'chase', kv: kvWith('chase', easyView) });
    await screen.findByRole('button', { name: `Easy view, ${state}` }, slow);
    for (const b of screen.getAllByRole('button')) {
      const word = String(b.props.accessibilityLabel).split(',')[0]!;
      expect(within(b).getByText(word)).toBeTruthy();
      expect(within(b).UNSAFE_getAllByType(SymbolView).length).toBeGreaterThanOrEqual(1);
    }
  });
});
