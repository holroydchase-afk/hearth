// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// TOOLBAR-1 (UX-R1, Nov 13) wrapped the five-button Photos toolbar two to a row with bigger text. RD-13
// (SPEC-REDESIGN 1b) retires that toolbar: Gallery's top bar has two items, Search and By date, so there is no
// lone button to strand. What's left to prove: at the largest text the two still fit side by side.
import { screen, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { FakeBackend } from '../../api/fake/FakeBackend';
import { seedPost } from '../../test/seed';
import { GalleryScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';

describe('TOOLBAR-1 retired by RD-13', () => {
  it('TOOLBAR-1 RD-13 no wrapping toolbar is left: the top bar is one row of exactly two', async () => {
    const be = FakeBackend.withFixture({ joIsMember: true });
    await seedPost(be, { caption: 'Lake day', photos: 1 });
    await renderApp(<GalleryScreen />, { be, user: 'jo' }); // a viewer: Bigger text is on by default
    const bar = await screen.findByTestId('top-bar');
    expect(screen.queryAllByTestId('photos-toolbar-item')).toHaveLength(0);
    expect(within(bar).getAllByRole('button')).toHaveLength(2);
    expect(StyleSheet.flatten(bar.props.style)).toMatchObject({ flexDirection: 'row' });
  });
});
