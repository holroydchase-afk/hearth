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

// Updated Nov 17 for RD-47 (DEC-65): the top bar holds no buttons at all now; Search is a field under the greeting.
describe('TOOLBAR-1 retired by RD-13 and RD-47', () => {
  it('TOOLBAR-1 RD-47 no wrapping toolbar is left: no buttons up top, and at Bigger text the search field is one 48 pt+ row', async () => {
    const be = FakeBackend.withFixture({ joIsMember: true });
    await seedPost(be, { caption: 'Lake day', photos: 1 });
    await renderApp(<GalleryScreen />, { be, user: 'jo' }); // a viewer: Bigger text is on by default
    await screen.findByRole('header', { name: /^Good (morning|afternoon|evening)/ });
    expect(screen.queryAllByTestId('photos-toolbar-item')).toHaveLength(0);
    const bar = screen.queryByTestId('top-bar');
    if (bar) expect(within(bar).queryAllByRole('button')).toHaveLength(0);
    const field = (await screen.findAllByLabelText('Search photos')).find((n) => typeof n.type === 'string')!;
    expect(Number((StyleSheet.flatten(field.props.style) ?? {}).minHeight ?? 0)).toBeGreaterThanOrEqual(48);
  });
});
