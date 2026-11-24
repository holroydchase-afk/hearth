// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// ENG-R6 (docs/reviews/2026-11-19-tech-debt/eng.md): More's rows and Gallery's Search are real screens in nested
// expo-router stacks, not in-place swaps. So the phone's Back steps back inside the tab (never out of it), iPhone
// gets its swipe back, Gallery stays mounted under Search (its scroll is kept), re-tapping a tab shows its first
// screen, and the old links /groups, /me and /help still land on the right row.
import { act, fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { BackHandler } from 'react-native';
import { FakeBackend } from '../../api/fake/FakeBackend';
import { AppRoutes } from '../../test/appRoutes';
import { tapSearchField } from '../../test/galleryEntry';
import { renderApp, screenWords } from '../../test/renderApp';
import { seedPost } from '../../test/seed';

const GROUP_NAMES = /Grandparents –|Dad's side|Mom's side/;

/** The phone's Back button (Android): the newest handler goes first, as React Native does. */
function phoneBack() {
  const handlers: (() => boolean)[] = [];
  const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, h) => {
    handlers.push(h as () => boolean);
    return { remove: () => { handlers.splice(handlers.indexOf(h as () => boolean), 1); } };
  });
  const press = () => { let used = false; act(() => { used = [...handlers].reverse().some((h) => h()); }); return used; };
  return { press, restore: () => spy.mockRestore() };
}

async function family() {
  const be = FakeBackend.withFixture();
  await seedPost(be, { caption: 'Christmas 2023', takenAt: '2023-12-25T17:00:00.000Z', photos: 2 });
  await seedPost(be, { caption: 'Fourth of July', takenAt: '2024-07-04T16:00:00.000Z', photos: 3 });
  await seedPost(be, { caption: 'Pumpkins today', photos: 1 });
  return be;
}

describe('ENG-R6 More is a stack', () => {
  it('ENG-R6 a /more/groups route exists: a parent lands on Groups, and "Back to More" shows the menu', async () => {
    await renderApp(<AppRoutes at="/more/groups" />, { user: 'chase' });
    expect(await screen.findByRole('header', { name: 'Your groups' })).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'More' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Back to More' }));
    expect(await screen.findByRole('header', { name: 'More' })).toBeTruthy();
  });

  it('ENG-R6 each More row opens its own screen under More', async () => {
    await renderApp(<AppRoutes at="/more" />, { user: 'chase' });
    for (const [row, header] of [['Messages', 'Messages'], ['Groups', 'Your groups'], ['Me', 'Me'], ['Help', 'Help'], ['Easy view', 'Easy view'], ['Theme', 'Theme']] as const) {
      const button = (await screen.findAllByRole('button')).find((b) => String(b.props.accessibilityLabel).split(',')[0] === row)!;
      fireEvent.press(button);
      expect(await screen.findByRole('header', { name: header })).toBeTruthy();
      fireEvent.press(screen.getByRole('button', { name: 'Back to More' }));
      expect(await screen.findByRole('header', { name: 'More' })).toBeTruthy();
    }
  });

  it('ENG-R6 Android back on a More sub-screen returns to More, not out of the tab', async () => {
    const back = phoneBack();
    try {
      await renderApp(<AppRoutes at="/more" />, { user: 'jo' });
      fireEvent.press(await screen.findByRole('button', { name: 'Help' }));
      expect(await screen.findByRole('header', { name: 'Help' })).toBeTruthy();
      expect(back.press()).toBe(true);
      expect(await screen.findByRole('header', { name: 'More' })).toBeTruthy();
      expect(screen.queryByRole('header', { name: 'Help' })).toBeNull();
    } finally {
      back.restore();
    }
  });

  it('ENG-R6 re-tapping the More tab returns to the menu', async () => {
    await renderApp(<AppRoutes at="/more" tabs />, { user: 'jo' }); // a viewer: Easy view On, Hearth's own tab bar
    fireEvent.press(await screen.findByRole('button', { name: 'Me' }));
    expect(await screen.findByRole('header', { name: 'Me' })).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: 'More' }));
    expect(await screen.findByRole('header', { name: 'More' })).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'Me' })).toBeNull();
  });

  it('ENG-R6 DEC-49 a viewer sent to /more/groups or /more/theme gets the More menu, never a group name', async () => {
    for (const at of ['/more/groups', '/more/theme']) {
      const r = await renderApp(<AppRoutes at={at} />, { user: 'jo' });
      expect(await screen.findByRole('header', { name: 'More' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Back to More' })).toBeNull();
      expect(screenWords()).not.toMatch(GROUP_NAMES);
      r.unmount();
    }
  });
});

describe('ENG-R6 old links still land', () => {
  it('ENG-R6 B19 /help and /me land on the row under More, and Back goes to the menu', async () => {
    for (const [at, header] of [['/help', 'Help'], ['/me', 'Me']] as const) {
      const r = await renderApp(<AppRoutes at={at} />, { user: 'jo' });
      expect(await screen.findByRole('header', { name: header })).toBeTruthy();
      fireEvent.press(screen.getByRole('button', { name: 'Back to More' }));
      expect(await screen.findByRole('header', { name: 'More' })).toBeTruthy();
      r.unmount();
    }
  });

  it('ENG-R6 B19 /groups lands on Groups for a parent', async () => {
    await renderApp(<AppRoutes at="/groups" />, { user: 'chase' });
    expect(await screen.findByRole('header', { name: 'Your groups' })).toBeTruthy();
    expect(screenWords()).toMatch(GROUP_NAMES);
  });
});

describe('ENG-R6 Gallery is a stack', () => {
  it('ENG-R6 going into Search and back keeps Gallery mounted, so its scroll stays', async () => {
    await renderApp(<AppRoutes at="/gallery" />, { be: await family(), user: 'jo' });
    const scroll = await screen.findByTestId('gallery-scroll');
    await tapSearchField();
    expect(await screen.findByRole('header', { name: 'Search photos' })).toBeTruthy();
    // Gallery is still there under Search (hidden), the same list, not a new one
    expect(screen.getByTestId('gallery-scroll', { includeHiddenElements: true })).toBe(scroll);
    fireEvent.press(screen.getByRole('button', { name: 'Back to Gallery' }));
    expect(await screen.findByTestId('gallery-scroll')).toBe(scroll);
  });

  it('ENG-R6 Android back on Search returns to Gallery', async () => {
    const back = phoneBack();
    try {
      await renderApp(<AppRoutes at="/gallery" />, { be: await family(), user: 'jo' });
      const scroll = await screen.findByTestId('gallery-scroll');
      await tapSearchField();
      await screen.findByRole('header', { name: 'Search photos' });
      expect(back.press()).toBe(true);
      expect(await screen.findByTestId('gallery-scroll')).toBe(scroll);
      expect(screen.queryByRole('header', { name: 'Search photos' })).toBeNull();
    } finally {
      back.restore();
    }
  });

  it('ENG-R6 re-tapping the Gallery tab from Search returns to Gallery', async () => {
    await renderApp(<AppRoutes at="/gallery" tabs />, { be: await family(), user: 'jo' });
    await screen.findByTestId('gallery-scroll');
    await tapSearchField();
    await screen.findByRole('header', { name: 'Search photos' });
    fireEvent.press(screen.getByRole('tab', { name: 'Gallery' }));
    expect(await screen.findByTestId('gallery-scroll')).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'Search photos' })).toBeNull();
  });
});

describe('ENG-R6 Feed is a stack', () => {
  it('ENG-R6 "See them" opens the timeline over Feed; the phone\'s Back returns to the same Feed', async () => {
    const back = phoneBack();
    try {
      await renderApp(<AppRoutes at="/feed" />, { be: await family(), user: 'jo' });
      const feedTitle = await screen.findByRole('header', { name: 'Feed' });
      fireEvent.press(await screen.findByRole('button', { name: "See Chase's older photos by date" }));
      expect(await screen.findByRole('header', { name: 'July 2024' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Back to Feed' })).toBeTruthy();
      expect(back.press()).toBe(true);
      expect(await screen.findByRole('header', { name: 'Feed' })).toBe(feedTitle);
    } finally {
      back.restore();
    }
  });
});
