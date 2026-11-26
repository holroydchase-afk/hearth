// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SEARCH-UI-1..8 (go-live item 9, docs/product/SPEC-SEARCH.md): "Search" on Photos finds posts by the words
// people wrote, who sent them and the year. Plain words only; it never looks inside a photo.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import React from 'react';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { seedPost } from '../../test/seed';
import { expectGrandparentSafe, renderApp, screenWords } from '../../test/renderApp';
import { GalleryScreen } from '../../test/redesignScreens';
import { tapSearchField } from '../../test/galleryEntry';

async function family() {
  const be = FakeBackend.withFixture();
  await seedPost(be, { caption: 'Christmas morning', takenAt: '2023-12-25T17:00:00.000Z' });
  await seedPost(be, { caption: 'Sparklers at the lake', title: 'Fourth of July', takenAt: '2024-07-04T16:00:00.000Z' });
  await seedPost(be, { author: FIXTURE.users.alex.id, caption: 'Pumpkins today' });
  // Mom's side only: Grandma Jo is not in that group, so she must never find it
  await seedPost(be, { caption: 'Lake day with Nana', circles: [FIXTURE.circles.momSide.id] });
  return be;
}

async function openSearch() {
  await tapSearchField(); // RD-47 (Nov 17): the "Search photos" field under the greeting
  expect(await screen.findByRole('header', { name: 'Search photos' })).toBeTruthy();
}

async function search(words: string) {
  fireEvent.changeText(screen.getByLabelText('Words to look for'), words);
  await act(async () => { fireEvent.press(screen.getByRole('button', { name: 'Search for these words' })); });
}

describe('SEARCH-UI photo search', () => {
  it('SEARCH-UI-1 Photos has a labeled Search button; it opens a grandparent-safe search screen', async () => {
    await renderApp(<GalleryScreen />, { be: await family(), user: 'jo' });
    // RD-47 (Nov 17): a "Search photos" field under the greeting, showing its words (was the top bar's Search).
    expect((await screen.findAllByLabelText('Search photos')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Search photos').length).toBeGreaterThan(0);
    await openSearch();
    expect(screen.getByText('Search looks at the words people wrote and who sent them. It never looks inside your photos.')).toBeTruthy();
    expectGrandparentSafe();
  });

  it('SEARCH-UI-2 typed words find the matching post, title included, and nothing else', async () => {
    await renderApp(<GalleryScreen />, { be: await family(), user: 'jo' });
    await openSearch();
    await search('july');
    expect(await screen.findByText('Sparklers at the lake')).toBeTruthy();
    expect(screen.getByText('Found 1 photo')).toBeTruthy();
    expect(screen.queryByText('Christmas morning')).toBeNull();
    expect(screen.queryByText('Pumpkins today')).toBeNull();
  });

  it('SEARCH-UI-3 a post in a group you are not in is never found', async () => {
    await renderApp(<GalleryScreen />, { be: await family(), user: 'jo' });
    await openSearch();
    await search('lake');
    expect(await screen.findByText('Sparklers at the lake')).toBeTruthy();
    expect(screen.queryByText('Lake day with Nana')).toBeNull();
    expect(screen.queryByText(/Mom's side/)).toBeNull();
  });

  it('SEARCH-UI-4 nothing found says so in plain words with what to try', async () => {
    await renderApp(<GalleryScreen />, { be: await family(), user: 'jo' });
    await openSearch();
    await search('piano');
    expect(await screen.findByText('Nothing found for "piano". Try one word, or pick a person or a year.')).toBeTruthy();
  });

  it('SEARCH-UI-5 "From" a person lists what they sent, with no words needed', async () => {
    await renderApp(<GalleryScreen />, { be: await family(), user: 'jo' });
    await openSearch();
    await act(async () => { fireEvent.press(await screen.findByRole('button', { name: 'Only photos from Alex' })); });
    expect(await screen.findByText('Pumpkins today')).toBeTruthy();
    expect(screen.queryByText('Christmas morning')).toBeNull();
  });

  it('SEARCH-UI-6 a year narrows it to photos taken that year', async () => {
    await renderApp(<GalleryScreen />, { be: await family(), user: 'jo' });
    await openSearch();
    await act(async () => { fireEvent.press(await screen.findByRole('button', { name: 'Only photos taken in 2023' })); });
    expect(await screen.findByText('Christmas morning')).toBeTruthy();
    expect(screen.queryByText('Sparklers at the lake')).toBeNull();
    const words = screenWords();
    expect(words).toContain('Found 1 photo');
  });

  it('SEARCH-UI-7 a found post opens to love it or write back, with Back to the search', async () => {
    await renderApp(<GalleryScreen />, { be: await family(), user: 'jo' });
    await openSearch();
    await search('christmas');
    fireEvent.press(await screen.findByRole('button', { name: "Open Chase's post to love it or write back" }));
    expect(await screen.findByRole('button', { name: 'Back to the search' })).toBeTruthy();
    expect(screen.getByText('Back to search')).toBeTruthy(); // GUX-R4: the words on screen match what's said over the phone
    fireEvent.press(screen.getByRole('button', { name: 'Back to the search' }));
    expect(await screen.findByRole('header', { name: 'Search photos' })).toBeTruthy();
  });

  it('SEARCH-UI-8 "Back to Gallery" and the phone\'s Back button return to Photos', async () => {
    const handlers: Array<() => boolean> = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, h) => {
      handlers.push(h as () => boolean);
      return { remove: () => { handlers.splice(handlers.indexOf(h as () => boolean), 1); } };
    });
    const back = () => { let used = false; act(() => { used = [...handlers].reverse().some((h) => h()); }); return used; };
    await renderApp(<GalleryScreen />, { be: await family(), user: 'jo' });
    await openSearch();
    fireEvent.press(screen.getByRole('button', { name: 'Back to Gallery' }));
    expect(await screen.findByTestId('top-bar')).toBeTruthy();
    await openSearch();
    expect(back()).toBe(true);
    expect(await screen.findByTestId('top-bar')).toBeTruthy();
    spy.mockRestore();
  });
});
