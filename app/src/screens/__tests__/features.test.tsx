// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// FLAG-5 (SPEC-GROUPS v2 section 5): the app reads my_features(space) at start; video posting is a server
// switch now, not a constant in the app. Written first: red until the app catches up.
import { readFileSync } from 'fs';
import { join } from 'path';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { expectGrandparentSafe, renderApp } from '../../test/renderApp';
import { ShareScreen } from '../ShareScreen';

function videoOn(): FakeBackend {
  const be = FakeBackend.withFixture();
  be.state.featureFlags = { video_posting: true };
  be.state.spaceFeatures = { [`${FIXTURE.space.id}:video_posting`]: true };
  return be;
}

describe('FLAG-5 features come from the server', () => {
  it('FLAG-5 the app reads my_features for its family when it starts', async () => {
    const be = FakeBackend.withFixture();
    const api = be.clientFor(null, { trackAppSession: true });
    const myFeatures = jest.spyOn(api, 'myFeatures');
    await renderApp(<ShareScreen />, { be, user: 'chase', deps: { api } });
    await waitFor(() => expect(myFeatures).toHaveBeenCalledWith(FIXTURE.space.id));
  });

  it('FLAG-5 VIDEO_POSTING_ENABLED is gone from media/prepare.ts', () => {
    const src = readFileSync(join(__dirname, '../../media/prepare.ts'), 'utf8');
    expect(src).not.toContain('VIDEO_POSTING_ENABLED');
  });

  it('FLAG-5 video_posting off: only photos are offered', async () => {
    const { deps } = await renderApp(<ShareScreen />, { user: 'chase' });
    const pick = await screen.findByRole('button', { name: /^Add photos, up to \d+ at a time$/ });
    expect(screen.queryByRole('button', { name: /^Add photos or videos, up to \d+ at a time$/ })).toBeNull();
    expect(screen.queryByText(/video/i)).toBeNull();
    fireEvent.press(pick);
    await waitFor(() => expect(deps.pickPhotos).toHaveBeenCalledWith({ videos: false }));
  });

  it('FLAG-5 video_posting on: the picker offers photos or videos', async () => {
    const { deps } = await renderApp(<ShareScreen />, { be: videoOn(), user: 'chase' });
    const pick = await screen.findByRole('button', { name: /^Add photos or videos, up to \d+ at a time$/ });
    expect(screen.getByText('Add photos or videos')).toBeTruthy(); // retargeted Nov 21 by qa-tdd for DEC-78 (SHARE-ST-2)
    expectGrandparentSafe();
    fireEvent.press(pick);
    await waitFor(() => expect(deps.pickPhotos).toHaveBeenCalledWith({ videos: true }));
  });

  it('FLAG-5 a failed my_features read leaves video off', async () => {
    const be = videoOn();
    const api = be.clientFor(null, { trackAppSession: true });
    jest.spyOn(api, 'myFeatures').mockRejectedValue(new Error('offline'));
    await renderApp(<ShareScreen />, { be, user: 'chase', deps: { api } });
    expect(await screen.findByRole('button', { name: /^Add photos, up to \d+ at a time$/ })).toBeTruthy();
  });
});
