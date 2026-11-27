// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// STATES-13/14 (SPEC-STATES, intake #208): Events is built from the Feed, so a failed Feed is an error, never "No events yet."
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { FakeBackend } from '../../api/fake/FakeBackend';
import { renderApp } from '../../test/renderApp';
import { MoreScreen } from '../../test/redesignScreens';
import { NO_SIGNAL_TITLE, apiFor, expectNoSignalState, offline } from '../../test/states';

describe('STATES-13 Events while the Feed failed', () => {
  it('STATES-13 the error state shows, never "No events yet."; Try again refreshes the Feed', async () => {
    const be = FakeBackend.withFixture();
    const api = apiFor(be, 'jo');
    const spy = jest.spyOn(api, 'getFeed').mockRejectedValueOnce(offline());
    await renderApp(<MoreScreen />, { be, user: 'jo', deps: { api } });
    fireEvent.press(await screen.findByRole('button', { name: 'Events' }));
    expect(await screen.findByRole('header', { name: 'Events' })).toBeTruthy();
    expect(await screen.findByText(NO_SIGNAL_TITLE)).toBeTruthy();
    expectNoSignalState();
    expect(screen.queryByText('No events yet.')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('No events yet.')).toBeTruthy();
    expect(screen.queryByText(NO_SIGNAL_TITLE)).toBeNull();
  });
});

describe('STATES-14 Events empty text is pinned', () => {
  it('STATES-14 loaded, none: the existing words stay (do not redo)', async () => {
    await renderApp(<MoreScreen />, { user: 'jo' });
    fireEvent.press(await screen.findByRole('button', { name: 'Events' }));
    expect(await screen.findByText('No events yet.')).toBeTruthy();
    expect(screen.getByText('An event is photos from one day, like a birthday or a trip. When someone adds you to one, it shows up here.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });
});
