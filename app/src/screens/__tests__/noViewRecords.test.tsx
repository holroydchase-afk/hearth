// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SEC-R2 (Nov 19 tech-debt review): anchor A2, guilt-free. The app no longer tells the server who looked at a post.
// Nothing in the app shows "Seen by", so each record was only a hidden read receipt an author could fetch.
import { screen } from '@testing-library/react-native';
import React from 'react';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { seedPost } from '../../test/seed';
import { renderApp } from '../../test/renderApp';
import { PhotosScreen } from '../PhotosScreen';

describe('SEC-R2 no view records', () => {
  it('SEC-R2 showing the feed to Grandma Jo records no view of any post', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { author: FIXTURE.users.chase.id, caption: 'Pumpkin patch' });
    const { api } = await renderApp(<PhotosScreen mode="feed" />, { be, user: 'jo' });
    const spy = jest.spyOn(api, 'markSeen');
    await screen.findByText(/Pumpkin patch/);
    expect(spy).not.toHaveBeenCalled();
    expect(be.state.seen).toEqual([]);
  });
});
