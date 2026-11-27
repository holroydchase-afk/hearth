// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// STATES-9..12 (SPEC-STATES, intake #208): the timeline says "failed" apart from "empty", and offers a way on.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { FakeBackend } from '../../api/fake/FakeBackend';
import { renderApp } from '../../test/renderApp';
import { ByDate } from '../../test/galleryEntry';
import { seedPost } from '../../test/seed';
import { NO_SIGNAL_TITLE, apiFor, expectNoSignalState, offline } from '../../test/states';
import { TimelineScreen } from '../TimelineScreen';
import { useApp } from '../../state/AppContext';

function AtMonth({ onClose = () => {} }: { onClose?: () => void }) {
  return useApp().status === 'ready' ? <TimelineScreen startAt="2024-08-01T00:00:00.000Z" onClose={onClose} /> : null;
}

describe('STATES-9 timeline first open fails', () => {
  it('STATES-9 the error state shows, not "No photos from before then."; Back and "Photos by date" stay; Try again re-runs the open', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Fourth of July', takenAt: '2024-07-04T16:00:00.000Z' });
    const api = apiFor(be, 'jo');
    const spy = jest.spyOn(api, 'getTimeline').mockRejectedValueOnce(offline());
    await renderApp(<AtMonth />, { be, user: 'jo', deps: { api } });
    expect(await screen.findByText(NO_SIGNAL_TITLE)).toBeTruthy();
    expectNoSignalState();
    expect(screen.queryByText('No photos from before then.')).toBeNull();
    expect(screen.queryByText('No photos before that month.')).toBeNull();
    expect(screen.getByRole('header', { name: 'Photos by date' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to Gallery' })).toBeTruthy();
    const first = spy.mock.calls[0]![0];
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Fourth of July')).toBeTruthy();
    expect(spy.mock.calls[1]![0]).toMatchObject({ beforeAt: (first as { beforeAt?: unknown }).beforeAt });
    expect(screen.queryByText(NO_SIGNAL_TITLE)).toBeNull();
  });
});

describe('STATES-10 "Pick a year" years load fails', () => {
  it('STATES-10 the error state shows under "Which year?", not "No photos yet."; Try again reloads the years', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Christmas 2023', takenAt: '2023-12-25T17:00:00.000Z' });
    const api = apiFor(be, 'jo');
    const spy = jest.spyOn(api, 'getTimelineYears').mockRejectedValueOnce(offline());
    await renderApp(<ByDate />, { be, user: 'jo', deps: { api } });
    fireEvent.press(await screen.findByRole('button', { name: 'Pick a year' }));
    expect(await screen.findByRole('header', { name: 'Which year?' })).toBeTruthy();
    expect(await screen.findByText(NO_SIGNAL_TITLE)).toBeTruthy();
    expectNoSignalState();
    expect(screen.queryByText('No photos yet.')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: /^See 2023/ })).toBeTruthy();
  });
});

describe('STATES-11/12 timeline empty', () => {
  it('STATES-11 opened at a month with nothing before it: "No photos before that month." and "Show the newest first"', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Pumpkins today' });
    await renderApp(<AtMonth />, { be, user: 'jo' });
    expect(await screen.findByText('No photos before that month.')).toBeTruthy();
    expect(screen.queryByText('No photos from before then.')).toBeNull();
    expect(screen.getAllByRole('button', { name: /Show the newest/ }).length).toBeGreaterThan(0);
    fireEvent.press(screen.getAllByRole('button', { name: /Show the newest/ })[0]!);
    expect(await screen.findByText('Pumpkins today')).toBeTruthy();
  });

  it('STATES-12 no photos at all: "No photos yet", the by-the-day line, and "Go back" that does what Back does', async () => {
    const onClose = jest.fn();
    await renderApp(<ByDate onClose={onClose} />, { user: 'jo' });
    expect(await screen.findByText('No photos yet')).toBeTruthy();
    expect(screen.getByText('Photos show up here by the day they were taken.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Go back' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
