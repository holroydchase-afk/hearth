// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// PRIV-R1 (Nov 19 tech-debt review): a decrypted video a crash left on the phone (VID-18, platform/videoFiles.ts)
// must be wiped when Hearth starts, whoever is or isn't signed in. Today clearVideos only runs once a session and a
// family are loaded, so a phone that was signed out (or never got its family) keeps plaintext video files.
import { screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { FakeBackend, FIXTURE } from '../../api/fake/FakeBackend';
import type { VideoFiles } from '../../media/cache';
import { renderApp } from '../../test/renderApp';
import { useApp } from '../AppContext';

function Probe() {
  return <Text testID="probe">{useApp().status}</Text>;
}

function fakeVideoFiles(): VideoFiles & { clear: jest.Mock } {
  return {
    write: jest.fn(async (name: string) => `file:///videos/${name}`),
    remove: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  };
}

const offline = () => Object.assign(new Error('Network request failed'), { name: 'TypeError' });

describe('Decrypted videos are cleared at start-up (PRIV-R1)', () => {
  it('PRIV-R1 nobody signed in: leftover decrypted videos are still cleared', async () => {
    const videoFiles = fakeVideoFiles();
    await renderApp(<Probe />, { user: null, deps: { videoFiles }, waitReady: false });
    await waitFor(() => expect(screen.getByTestId('probe').props.children).toBe('signedOut'));
    expect(videoFiles.clear).toHaveBeenCalled();
  });

  it('PRIV-R1 signed in but no family yet: cleared', async () => {
    const videoFiles = fakeVideoFiles();
    const be = FakeBackend.withFixture();
    be.state.appSession = FIXTURE.users.jo.id;
    const api = be.clientFor(null, { trackAppSession: true });
    jest.spyOn(api, 'mySpaces').mockResolvedValue([]);
    await renderApp(<Probe />, { be, deps: { api, videoFiles }, waitReady: false });
    await waitFor(() => expect(screen.getByTestId('probe').props.children).toBe('noSpace'));
    expect(videoFiles.clear).toHaveBeenCalled();
  });

  it('PRIV-R1 signed in but offline with no saved family: cleared', async () => {
    const videoFiles = fakeVideoFiles();
    const be = FakeBackend.withFixture();
    be.state.appSession = FIXTURE.users.jo.id;
    const api = be.clientFor(null, { trackAppSession: true });
    jest.spyOn(api, 'mySpaces').mockRejectedValue(offline());
    await renderApp(<Probe />, { be, deps: { api, videoFiles }, waitReady: false });
    await waitFor(() => expect(screen.getByTestId('probe').props.children).toBe('offline'));
    expect(videoFiles.clear).toHaveBeenCalled();
  });

  it('PRIV-R1 signed in with a family: cleared (as today, VID-18)', async () => {
    const videoFiles = fakeVideoFiles();
    await renderApp(<Probe />, { deps: { videoFiles } });
    await waitFor(() => expect(screen.getByTestId('probe').props.children).toBe('ready'));
    expect(videoFiles.clear).toHaveBeenCalled();
  });
});
