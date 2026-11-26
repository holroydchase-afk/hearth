// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// STATES-1..8, STATES-24 (SPEC-STATES, intake #208): Gallery and Feed say what happened when the list fails, and what
// to do when it is empty. Red until the engineer builds ErrorState / EmptyState (qa-tdd Nov 26).
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { FakeBackend } from '../../api/fake/FakeBackend';
import { ApiError } from '../../api/HearthApi';
import { memoryKV } from '../../platform/kv';
import { renderApp } from '../../test/renderApp';
import { FeedScreen, GalleryScreen } from '../../test/redesignScreens';
import { AppRoutes } from '../../test/appRoutes';
import { seedPost } from '../../test/seed';
import { NO_SIGNAL_LINE, NO_SIGNAL_TITLE, apiFor, expectNoSignalState, offline } from '../../test/states';

const NOT_SHOWN = () => {
  expect(screen.queryByText('Loading the photos…')).toBeNull();
  expect(screen.queryByText(/^No photos yet/)).toBeNull();
  expect(screen.queryByText(/Nothing shared yet/)).toBeNull();
};

describe('STATES-1/2 the error state on a failed first load', () => {
  it('STATES-1 Gallery: first load fails, so title, one plain line and "Try again" replace the list; no spinner, no empty text', async () => {
    const be = FakeBackend.withFixture();
    const api = apiFor(be, 'jo');
    jest.spyOn(api, 'getFeed').mockRejectedValue(offline());
    await renderApp(<GalleryScreen />, { be, user: 'jo', deps: { api } });
    expect(await screen.findByText(NO_SIGNAL_TITLE)).toBeTruthy();
    expectNoSignalState();
    NOT_SHOWN();
    const tryAgain = screen.getByRole('button', { name: 'Try again' });
    expect(tryAgain.props.accessibilityLabel).toBe('Try again');
  });

  it('STATES-2 no "OK, hide this message"; Try again shows the loading words, then success replaces the error with the empty state', async () => {
    const be = FakeBackend.withFixture();
    const api = apiFor(be, 'jo');
    const real = api.getFeed.bind(api);
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    jest.spyOn(api, 'getFeed')
      .mockRejectedValueOnce(offline())
      .mockImplementationOnce(async (a) => { await gate; return real(a); });
    await renderApp(<GalleryScreen />, { be, user: 'jo', deps: { api } });
    await screen.findByText(NO_SIGNAL_TITLE);
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Loading the photos…')).toBeTruthy();
    await act(async () => { release(); });
    expect(await screen.findByText('No photos yet')).toBeTruthy();
    expect(screen.queryByText(NO_SIGNAL_TITLE)).toBeNull();
  });

  it('STATES-2 a second failure shows the error again', async () => {
    const be = FakeBackend.withFixture();
    const api = apiFor(be, 'jo');
    const spy = jest.spyOn(api, 'getFeed').mockRejectedValue(offline());
    await renderApp(<GalleryScreen />, { be, user: 'jo', deps: { api } });
    await screen.findByText(NO_SIGNAL_TITLE);
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(NO_SIGNAL_TITLE)).toBeTruthy();
    expectNoSignalState();
  });
});

describe('STATES-3 a failed refresh with photos already on the phone', () => {
  it('STATES-3 the posts stay; a line above them says no signal with Try again, with no way to hide it, until a refresh works', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Pumpkins today' });
    const kv = memoryKV();
    const first = await renderApp(<FeedScreen />, { be, user: 'jo', kv });
    await screen.findByText('Pumpkins today');
    first.unmount();
    const api = apiFor(be, 'jo');
    const spy = jest.spyOn(api, 'getFeed').mockRejectedValue(offline());
    await renderApp(<FeedScreen />, { be, user: 'jo', kv, deps: { api } });
    expect(await screen.findByText('Pumpkins today')).toBeTruthy();
    expect(await screen.findByText('No signal right now. Showing the photos saved on this phone.')).toBeTruthy();
    expect(screen.queryByText('OK, hide this message')).toBeNull();
    spy.mockRestore();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByText('No signal right now. Showing the photos saved on this phone.')).toBeNull());
    expect(screen.getByText('Pumpkins today')).toBeTruthy();
  });
});

describe('STATES-4/5 Gallery and Feed first load fails', () => {
  it('STATES-4 Gallery, no signal: the NETWORK words and Try again; the greeting and Search field stay', async () => {
    const be = FakeBackend.withFixture();
    const api = apiFor(be, 'jo');
    jest.spyOn(api, 'getFeed').mockRejectedValue(offline());
    await renderApp(<GalleryScreen />, { be, user: 'jo', deps: { api } });
    await screen.findByText(NO_SIGNAL_TITLE);
    expect(screen.getByText(NO_SIGNAL_LINE)).toBeTruthy();
    expect(screen.getAllByLabelText('Search photos').length).toBeGreaterThan(0);
    expect(screen.getByText(/^Good (morning|afternoon|evening)/)).toBeTruthy();
  });

  it('STATES-4 Feed, no signal: the same words under the "Feed" title', async () => {
    const be = FakeBackend.withFixture();
    const api = apiFor(be, 'jo');
    jest.spyOn(api, 'getFeed').mockRejectedValue(offline());
    await renderApp(<FeedScreen />, { be, user: 'jo', deps: { api } });
    expect(await screen.findByRole('header', { name: 'Feed' })).toBeTruthy();
    expect(await screen.findByText(NO_SIGNAL_TITLE)).toBeTruthy();
    expectNoSignalState();
  });

  it.each([['Gallery', GalleryScreen], ['Feed', FeedScreen]] as const)('STATES-5 %s, another error: "Something went wrong", ending "or call Chase" when a helper is set', async (_n, Screen) => {
    const be = FakeBackend.withFixture();
    const api = apiFor(be, 'jo'); // Jo's helper is Chase
    jest.spyOn(api, 'getFeed').mockRejectedValue(new ApiError('UNKNOWN', 'boom'));
    await renderApp(<Screen />, { be, user: 'jo', deps: { api } });
    expect(await screen.findByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Your photos are safe. Tap Try again, or call Chase.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('STATES-5 the owner has no helper: no made-up name', async () => {
    const be = FakeBackend.withFixture();
    const api = apiFor(be, 'chase');
    jest.spyOn(api, 'getFeed').mockRejectedValue(new ApiError('UNKNOWN', 'boom'));
    await renderApp(<GalleryScreen />, { be, user: 'chase', deps: { api } });
    expect(await screen.findByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Your photos are safe. Tap Try again.')).toBeTruthy();
  });
});

describe('STATES-6/7/8 empty Gallery and Feed', () => {
  it('STATES-6 Gallery, no posts, a parent: "No photos yet", the line, and a "Share photos" button that opens Share', async () => {
    await renderApp(<AppRoutes at="/gallery" tabs />, { user: 'chase' });
    expect(await screen.findByText('No photos yet')).toBeTruthy();
    expect(screen.getByText('Share your first photos and your family will see them here.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Share photos' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Share' }).props.accessibilityState).toMatchObject({ selected: true }));
  });

  it('STATES-7 Gallery, no posts, a viewer: names the helper; "Check again" runs a refresh', async () => {
    const be = FakeBackend.withFixture();
    const api = apiFor(be, 'jo');
    const spy = jest.spyOn(api, 'getFeed');
    await renderApp(<GalleryScreen />, { be, user: 'jo', deps: { api } });
    expect(await screen.findByText('No photos yet')).toBeTruthy();
    expect(screen.getByText("When Chase shares photos, they'll show up here.")).toBeTruthy();
    const before = spy.mock.calls.length;
    fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
    await waitFor(() => expect(spy.mock.calls.length).toBeGreaterThan(before));
  });

  it('STATES-7 UI-26 still holds: with photos there is no "Check again" and no "Check for new photos"', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Pumpkins today' });
    await renderApp(<GalleryScreen />, { be, user: 'jo' });
    await screen.findByLabelText(/Pumpkins today|photo/i).catch(() => null);
    expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check for new photos' })).toBeNull();
  });

  it.each([['Gallery', GalleryScreen], ['Feed', FeedScreen]] as const)('STATES-8 %s empty: the parent and viewer states match STATES-6 and 7', async (_n, Screen) => {
    const a = await renderApp(<Screen />, { user: 'chase' });
    expect(await screen.findByText('No photos yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share photos' })).toBeTruthy();
    a.unmount();
    await renderApp(<Screen />, { user: 'jo' });
    expect(await screen.findByText('No photos yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy();
  });

  it('STATES-8 Feed shows its "Feed" title above the empty state', async () => {
    await renderApp(<FeedScreen />, { user: 'jo' });
    expect(await screen.findByRole('header', { name: 'Feed' })).toBeTruthy();
    expect(await screen.findByText('No photos yet')).toBeTruthy();
  });

  it('STATES-7 no helper: "When your family shares photos, they\'ll show up here."', async () => {
    // A viewer whose inviter is unknown: the family row carries no inviter name.
    const be = FakeBackend.withFixture();
    const api = apiFor(be, 'jo');
    const real = api.mySpaces.bind(api);
    jest.spyOn(api, 'mySpaces').mockImplementation(async () => (await real()).map((s) => ({ ...s, inviter_name: null })));
    await renderApp(<GalleryScreen />, { be, user: 'jo', deps: { api } });
    expect(await screen.findByText("When your family shares photos, they'll show up here.")).toBeTruthy();
  });
});

describe('STATES-24 "Check again" on the empty viewer Gallery', () => {
  it('STATES-24 shows "Checking…" at once; still empty: the line becomes "Still nothing yet…" and the button stays', async () => {
    const be = FakeBackend.withFixture();
    const api = apiFor(be, 'jo');
    const real = api.getFeed.bind(api);
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    await renderApp(<GalleryScreen />, { be, user: 'jo', deps: { api } });
    await screen.findByText('No photos yet');
    jest.spyOn(api, 'getFeed').mockImplementation(async (a) => { await gate; return real(a); });
    fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
    expect(await screen.findByText('Checking…')).toBeTruthy();
    await act(async () => { release(); });
    expect(await screen.findByText("Still nothing yet. We'll show photos here as soon as they're shared.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy();
  });

  it('STATES-24 a failed check shows the NETWORK error state', async () => {
    const be = FakeBackend.withFixture();
    const api = apiFor(be, 'jo');
    await renderApp(<GalleryScreen />, { be, user: 'jo', deps: { api } });
    await screen.findByText('No photos yet');
    jest.spyOn(api, 'getFeed').mockRejectedValue(offline());
    fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
    expect(await screen.findByText(NO_SIGNAL_TITLE)).toBeTruthy();
    expectNoSignalState();
  });
});
