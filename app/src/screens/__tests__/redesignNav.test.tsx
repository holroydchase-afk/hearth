// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Redesign 1b, getting around (docs/product/SPEC-REDESIGN.md RD-9..RD-17, DEC-59). Tabs Gallery, Share, Feed,
// More (viewers: Gallery, Feed, More); Gallery opens first under a time-of-day greeting that folds into a solid
// top bar; the top bar's right side is only Search and By date; Messages, Groups, Events, Easy view (was Bigger text), Light or
// dark, Theme (RD-97, was Family color), Me and Help live in More. Members never see a group's name (DEC-49). Written first (Nov 15).
// RD-10 (Gallery picked on open) is in redesignStart.test.tsx (it mocks expo-router). RD-12 on phones: RD-28 (manual).
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { FakeBackend, FIXTURE } from '../../api/fake/FakeBackend';
import type { Role } from '../../api/HearthApi';
import { ChatClient, memoryStore } from '../../messenger/client';
import { seedPost } from '../../test/seed';
import { FeedScreen, GalleryScreen, MoreScreen, greeting, titleMotion } from '../../test/redesignScreens';
import { expectGrandparentSafe, renderApp, screenWords } from '../../test/renderApp';
import { tapSearchField } from '../../test/galleryEntry';
import { BigTextContext, paletteFor } from '../../ui/theme';
import { MeScreen } from '../MeScreen';
import { HearthTabBar, TAB_ICONS, tabsFor } from '../TabBar';

// 1b adds `newMessages` and the new tab names; typed loosely so this file typechecks before they exist.
const TabBar = HearthTabBar as unknown as React.ComponentType<{ role: Role; current: string; onNavigate: (t: string) => void; newMessages?: number }>;
const icons = TAB_ICONS as unknown as Record<string, { sf: string; md: string } | undefined>;
const light = () => paletteFor(Platform.OS as 'ios', false);
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const GREETING = /^Good (morning|afternoon|evening)/;
const GROUP_NAMES = /Grandparents –|Dad's side|Mom's side/;
const G = FIXTURE.circles.dadSide.id;
const slow = { timeout: 5000 };

/** The More screen's rows, top to bottom, by their word (a row's spoken name may add ", 2 new"). */
const moreRows = () => screen.getAllByRole('button').map((b) => String(b.props.accessibilityLabel).split(',')[0]);
const scrollTo = (y: number) => fireEvent.scroll(screen.getByTestId('gallery-scroll'), {
  nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 390, height: 3000 }, layoutMeasurement: { width: 390, height: 844 } },
});

async function withPosts() {
  const be = FakeBackend.withFixture();
  await seedPost(be, { caption: 'Pumpkin patch' });
  await seedPost(be, { caption: 'Lake day' });
  return be;
}

describe('RD-9 tabs', () => {
  // engineer, flagged for qa-tdd: the word under each icon shows with Easy view On (RD-77, DEC-66 supersedes RD-9's
  // "each with its word"); Off (icons only) is covered in easyView.test.tsx.
  it('RD-9 a parent\'s tabs read Gallery, Share, Feed, More, in that order, each with an icon and (Easy view On) its word', () => {
    for (const role of ['owner', 'adult'] as const) {
      expect({ role, tabs: tabsFor(role).map((t) => t.label) }).toEqual({ role, tabs: ['Gallery', 'Share', 'Feed', 'More'] });
    }
    render(<BigTextContext.Provider value><TabBar role="owner" current="gallery" onNavigate={() => {}} /></BigTextContext.Provider>);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.props.accessibilityLabel)).toEqual(['Gallery', 'Share', 'Feed', 'More']);
    for (const [i, word] of ['Gallery', 'Share', 'Feed', 'More'].entries()) {
      expect(within(tabs[i]!).getByText(word)).toBeTruthy();
      expect(within(tabs[i]!).UNSAFE_getAllByType(SymbolView)).toHaveLength(1);
    }
    for (const old of ['Photos', 'Groups', 'Me', 'Help']) expect(screen.queryByRole('tab', { name: old })).toBeNull();
    expectGrandparentSafe();
  });

  it('RD-9 a viewer\'s tabs read Gallery, Feed, More (no Share)', () => {
    expect(tabsFor('viewer').map((t) => t.label)).toEqual(['Gallery', 'Feed', 'More']);
    render(<TabBar role="viewer" current="gallery" onNavigate={() => {}} />);
    expect(screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel)).toEqual(['Gallery', 'Feed', 'More']);
    expect(screen.queryByRole('tab', { name: 'Share' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Help' })).toBeNull();
  });

  it('RD-9 every tab has an SF Symbol and a Material icon; the old tabs are gone', () => {
    const names = [...tabsFor('owner'), ...tabsFor('viewer')].map((t) => t.name as string);
    expect([...new Set(names)].sort()).toEqual(['feed', 'gallery', 'more', 'share']);
    for (const n of names) expect({ n, icon: icons[n] }).toEqual({ n, icon: { sf: expect.any(String), md: expect.any(String) } });
    for (const old of ['photos', 'groups', 'me', 'help']) expect(icons[old]).toBeUndefined();
  });

  it('RD-9 tapping a tab goes there; the picked one is marked picked', () => {
    const go = jest.fn();
    render(<TabBar role="owner" current="gallery" onNavigate={go} />);
    expect(screen.getByRole('tab', { name: 'Gallery' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('tab', { name: 'Feed' }).props.accessibilityState).toMatchObject({ selected: false });
    fireEvent.press(screen.getByRole('tab', { name: 'More' }));
    expect(go).toHaveBeenCalledWith('more');
    fireEvent.press(screen.getByRole('tab', { name: 'Feed' }));
    expect(go).toHaveBeenCalledWith('feed');
  });
});

describe('RD-11 greeting', () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 15, h, m);

  it.each([
    [0, 0, 'Good morning, Grandma Jo'], [11, 59, 'Good morning, Grandma Jo'],
    [12, 0, 'Good afternoon, Grandma Jo'], [16, 59, 'Good afternoon, Grandma Jo'],
    [17, 0, 'Good evening, Grandma Jo'], [23, 59, 'Good evening, Grandma Jo'],
  ])('RD-11 at %i:%i it reads "%s"', (h, m, words) => {
    expect(greeting(at(h, m), 'Grandma Jo')).toBe(words);
  });

  it('RD-11 no name: the greeting alone', () => {
    expect(greeting(at(9), null)).toBe('Good morning');
    expect(greeting(at(9), '  ')).toBe('Good morning');
    expect(greeting(at(13), null)).toBe('Good afternoon');
    expect(greeting(at(20), null)).toBe('Good evening');
  });

  it('RD-11 Gallery at rest: a large title greets her by the name the family gave her', async () => {
    await renderApp(<GalleryScreen />, { be: await withPosts(), user: 'jo' });
    const title = await screen.findByRole('header', { name: GREETING });
    expect(title.props.accessibilityLabel ?? title.props.children).toMatch(/^Good (morning|afternoon|evening), Grandma Jo$/);
    expect(Number(flat(title.props.style).fontSize)).toBeGreaterThanOrEqual(28); // the large title
    expect(screen.queryByRole('header', { name: /^Photos of/ })).toBeNull(); // the greeting replaces the old title
  });

  it('RD-11 a person whose name isn\'t set yet gets the greeting alone, never an email', async () => {
    const be = await withPosts();
    (be.state.users[FIXTURE.users.jo.id] as { nameSet?: boolean }).nameSet = false;
    await renderApp(<GalleryScreen />, { be, user: 'jo' });
    const title = await screen.findByRole('header', { name: GREETING });
    expect(title.props.accessibilityLabel ?? title.props.children).toMatch(/^Good (morning|afternoon|evening)$/);
    expect(screenWords()).not.toMatch(/@/);
  });
});

describe('RD-12 the greeting folds into the top bar', () => {
  it('RD-12 scrolling down puts the greeting in the top bar, on a solid background; scrolling back up takes it out', async () => {
    await renderApp(<GalleryScreen />, { be: await withPosts(), user: 'jo' });
    await screen.findByRole('header', { name: GREETING });
    const bar = screen.getByTestId('top-bar');
    expect(flat(bar.props.style).backgroundColor).toBe(light().bg); // DS-6: solid, the screen's own color
    expect(screen.queryByTestId('top-bar-title')).toBeNull(); // at rest the big greeting shows, not the small one
    act(() => { scrollTo(240); });
    const small = await screen.findByTestId('top-bar-title');
    expect(within(screen.getByTestId('top-bar')).getByText(GREETING)).toBeTruthy();
    expect(Number(flat(small.props.style).fontSize)).toBeGreaterThanOrEqual(17); // DS-2 even folded
    expect(flat(screen.getByTestId('top-bar').props.style).backgroundColor).toBe(light().bg);
    act(() => { scrollTo(0); });
    await waitFor(() => expect(screen.queryByTestId('top-bar-title')).toBeNull());
    expect(screen.getByRole('header', { name: GREETING })).toBeTruthy();
  });

  it('RD-12 with Reduce Motion the greeting fades instead of shrinking', () => {
    expect(titleMotion(true)).toBe('fade');
    expect(titleMotion(false)).toBe('shrink');
  });
});

// Updated Nov 17 for RD-47 (DEC-65, Chase: "Search- B"): RD-13's Search and By date leave the top right. Search is a
// "Search photos" field under the greeting; By date goes (the months are the by-date view).
describe('RD-13 top bar (superseded by RD-47)', () => {
  it('RD-13 RD-47 the top bar holds no buttons; the old Search / By date pair and the toolbar are gone', async () => {
    await renderApp(<GalleryScreen />, { be: await withPosts(), user: 'jo' });
    await screen.findByRole('header', { name: GREETING });
    const bar = screen.queryByTestId('top-bar');
    if (bar) expect(within(bar).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Search the photos' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show photos by the date they were taken' })).toBeNull();
    expect(screen.queryByTestId('photos-toolbar')).toBeNull();
    for (const name of ['Messages', 'See events']) expect(screen.queryByRole('button', { name })).toBeNull();
    expectGrandparentSafe();
  });

  it('RD-13 RD-47 the "Search photos" field opens today\'s Search; Back returns to Gallery', async () => {
    await renderApp(<GalleryScreen />, { be: await withPosts(), user: 'jo' });
    await screen.findByRole('header', { name: GREETING });
    await tapSearchField();
    expect(await screen.findByRole('header', { name: 'Search photos' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /^Back/ }));
    expect(await screen.findByRole('header', { name: GREETING })).toBeTruthy();
  });
});

describe('RD-14 new messages on More', () => {
  // engineer, flagged for qa-tdd: the viewer's default Easy view On shows the word (RD-77); RD-76 covers Off.
  it('RD-14 a new message puts an accent dot on More\'s tab, spoken "More, new message"; the word stays More', () => {
    const r = render(<BigTextContext.Provider value><TabBar role="viewer" current="gallery" onNavigate={() => {}} newMessages={2} /></BigTextContext.Provider>);
    const more = screen.getByRole('tab', { name: 'More, new message' });
    expect(within(more).getByText('More')).toBeTruthy();
    const dot = within(more).getByTestId('more-dot');
    expect(flat(dot.props.style).backgroundColor).toBe(light().accent);
    r.unmount();
    render(<TabBar role="viewer" current="gallery" onNavigate={() => {}} newMessages={0} />);
    expect(screen.getByRole('tab', { name: 'More' })).toBeTruthy();
    expect(screen.queryByTestId('more-dot')).toBeNull();
  });

  it('RD-14 two new messages from Chase: More\'s Messages row says "2 new"', async () => {
    const be = FakeBackend.withFixture({ joIsMember: true });
    const chase = new ChatClient(be.clientFor(FIXTURE.users.chase.id), FIXTURE.users.chase.id, memoryStore());
    await chase.open(G);
    await chase.send(G, 'Hi Mom');
    await chase.send(G, 'Pictures soon');
    await renderApp(<MoreScreen />, { be, user: 'jo' });
    const row = await screen.findByRole('button', { name: 'Messages, 2 new' }, slow);
    expect(within(row).getByText('2 new')).toBeTruthy();
    expect(screenWords()).not.toMatch(/Hi Mom|Pictures soon/); // a count, never the words
  });

  it('RD-14 no new messages: no count on the Messages row', async () => {
    await renderApp(<MoreScreen />, { user: 'jo' });
    const row = await screen.findByRole('button', { name: 'Messages' });
    expect(within(row).queryByText(/new/)).toBeNull();
  });
});

describe('RD-15 More', () => {
  // engineer, flagged for qa-tdd: RD-78 (DEC-66) renames Bigger text to Easy view in the same place.
  const ALL = ['Messages', 'Groups', 'Events', 'Easy view', 'Light or dark', 'Theme', 'Me', 'Help'];

  it.each([
    ['owner', 'chase', ALL],
    ['adult', 'alex', ALL.filter((r) => r !== 'Theme')],
    ['viewer', 'jo', ALL.filter((r) => r !== 'Groups' && r !== 'Theme')],
  ] as const)('RD-15 / RD-16 the %s\'s More: big rows in the spec\'s order', async (_role, user, rows) => {
    await renderApp(<MoreScreen />, { user });
    expect(await screen.findByRole('header', { name: 'More' })).toBeTruthy();
    expect(moreRows()).toEqual(rows);
    for (const b of screen.getAllByRole('button')) {
      const word = String(b.props.accessibilityLabel).split(',')[0]!;
      expect(within(b).getByText(word)).toBeTruthy();
      expect(Number(flat(b.props.style).minHeight)).toBeGreaterThanOrEqual(48);
      const symbols = within(b).UNSAFE_getAllByType(SymbolView).map((s) => (s.props as { name: { ios: string } }).name.ios);
      expect({ word, symbols }).toEqual({ word, symbols: [expect.any(String), expect.stringMatching(/chevron/)] }); // icon, word, chevron
    }
    expectGrandparentSafe();
  });

  it.each([
    ['Messages', { header: 'Messages' }],
    ['Groups', { header: 'Your groups' }],
    ['Events', { header: 'Events' }],
    ['Easy view', { header: 'Easy view' }], // engineer, flagged for qa-tdd: RD-78's page replaces the switch
    ['Light or dark', { header: 'Light or dark screen' }],
    ['Theme', { header: 'Theme' }],
    ['Me', { header: 'Me' }],
    ['Help', { header: 'Help' }],
  ] as const)('RD-15 More → %s opens today\'s screen with a Back word button that returns to More', async (row, shows) => {
    await renderApp(<MoreScreen />, { user: 'chase' });
    fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^${row}(,|$)`) }));
    expect(await screen.findByRole('header', { name: shows.header }, slow)).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'More' })).toBeNull(); // fills the screen in place of the menu
    const back = screen.getByRole('button', { name: 'Back to More' });
    expect(within(back).getByText(/(^|‹ ?)More$/)).toBeTruthy(); // GUX-R1: shows "‹ More", spoken "Back to More"
    fireEvent.press(back);
    expect(await screen.findByRole('header', { name: 'More' })).toBeTruthy();
  });

  it('RD-15 / RD-24 → RD-97 Theme (was Family color) lives in More: the owner\'s Me has no picker', async () => {
    await renderApp(<MeScreen />, { user: 'chase' });
    expect(await screen.findByRole('header', { name: 'Me' })).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'Theme' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Forest' })).toBeNull();
  });
});

describe('RD-16 no group names past More for anyone but parents', () => {
  async function family() {
    const be = FakeBackend.withFixture({ joIsMember: true });
    await seedPost(be, { caption: 'Pumpkin patch', circles: [G] });
    const chase = new ChatClient(be.clientFor(FIXTURE.users.chase.id), FIXTURE.users.chase.id, memoryStore());
    await chase.open(G); // a chat in Dad's side, so Messages has a row
    return be;
  }

  it('RD-16 Grandma Jo (viewer): More has no Groups or Theme (RD-98), and no screen she reaches from it names a group', async () => {
    const be = await family();
    await renderApp(<MoreScreen />, { be, user: 'jo' });
    await screen.findByRole('header', { name: 'More' });
    expect(screen.queryByRole('button', { name: /^Groups/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Theme(,|$)/ })).toBeNull();
    const rows = moreRows();
    for (const row of rows) {
      fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${row}(,|$)`) }));
      await screen.findByRole('button', { name: 'Back to More' });
      if (row === 'Messages') await screen.findAllByRole('button', { name: /^Open / }, slow); // EF-HE-1; Jo has two chats (Everyone, Dad's side)
      expect({ row, words: screenWords() }).toEqual({ row, words: expect.not.stringMatching(GROUP_NAMES) });
      fireEvent.press(screen.getByRole('button', { name: 'Back to More' }));
      await screen.findByRole('header', { name: 'More' });
    }
  });

  it('RD-16 Alex (adult) does see the groups and their names under More → Groups', async () => {
    await renderApp(<MoreScreen />, { be: await family(), user: 'alex' });
    fireEvent.press(await screen.findByRole('button', { name: 'Groups' }));
    expect(await screen.findByRole('header', { name: 'Your groups' })).toBeTruthy();
    await waitFor(() => expect(screenWords()).toMatch(GROUP_NAMES));
  });
});

describe('RD-17 Feed', () => {
  it('RD-17 Feed keeps today\'s posts list: newest first, reactions, who can see it by name, replies', async () => {
    await renderApp(<FeedScreen />, { be: await withPosts(), user: 'jo' });
    expect(await screen.findByText('Lake day')).toBeTruthy();
    const words = screenWords();
    expect(words.indexOf('Lake day')).toBeLessThan(words.indexOf('Pumpkin patch')); // newest first
    expect(screen.getAllByRole('button', { name: 'Love it' })).toHaveLength(2);
    expect(screen.getAllByLabelText(/^You, .+ can see this$/)).toHaveLength(2); // names, never the group (WHO-6)
    expect(screen.getAllByLabelText('Add a comment for Chase').length).toBeGreaterThan(0);
    expect(words).not.toMatch(GROUP_NAMES);
    expect(screen.queryByTestId('photos-toolbar')).toBeNull();
  });

  it('RD-17 nothing on it is lost: Show older photos past a page', async () => {
    const be = FakeBackend.withFixture();
    for (let i = 0; i < 21; i++) await seedPost(be, { caption: `Day ${i}` });
    await renderApp(<FeedScreen />, { be, user: 'jo' });
    expect(await screen.findByText('Day 20')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show older photos' })).toBeTruthy();
  });
});
