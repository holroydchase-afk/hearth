// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Nov 19 tech-debt review, UX seat (docs/reviews/2026-11-19-tech-debt/ux.md):
// TD-UX-R2 the "For testing" notice timing card is for debug builds only, not every relative.
// TD-UX-R3 Help doesn't tell parents they can only look and write back (Me words it by role).
// TD-UX-R6 one confirm dialog: Sign out and Take me off Hearth use the iOS-style alert, safe choice first.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { renderApp } from '../../test/renderApp';
import { HelpScreen } from '../HelpScreen';
import { MeScreen } from '../MeScreen';

describe('Nov 19 tech-debt review, UX P1s', () => {
  it('TD-UX-R2 a normal build shows no "Notice timing" test card on Me', async () => {
    await renderApp(<MeScreen />, { user: 'jo' });
    await screen.findByRole('button', { name: 'Sign out of Hearth' });
    expect(screen.queryByText('Notice timing')).toBeNull();
    expect(screen.queryByText(/For testing/)).toBeNull();
  });

  it('TD-UX-R3 Help says nothing about what the reader can do; Me says it by role', async () => {
    const r = await renderApp(<HelpScreen />, { user: 'chase' });
    await screen.findByText('No computer program learns from your photos.');
    expect(screen.queryByText('You can look at photos and write back.')).toBeNull();
    r.unmount();
    await renderApp(<MeScreen />, { user: 'chase' });
    expect(await screen.findByText('You can share photos and choose who sees them.')).toBeTruthy();
  });

  it('TD-UX-R6 Sign out asks with the alert: Stay signed in first and plain, Sign out in red words, no filled button', async () => {
    const { be } = await renderApp(<HelpScreen />, { user: 'jo' });
    fireEvent.press(await screen.findByRole('button', { name: 'Sign out of Hearth' }));
    const stay = screen.getByRole('button', { name: 'Stay signed in' });
    const go = screen.getByRole('button', { name: 'Sign out' });
    expect(screen.queryByRole('button', { name: 'Yes, sign out' })).toBeNull();
    const fill = (n: typeof go) => StyleSheet.flatten(typeof n.props.style === 'function' ? n.props.style({ pressed: false }) : n.props.style)?.backgroundColor;
    expect([fill(stay), fill(go)]).toEqual(['transparent', 'transparent']);
    fireEvent.press(go);
    await waitFor(() => expect(be.state.appSession).toBeNull());
  });

  it('TD-UX-R6 Take me off Hearth asks with the same alert: Stay on Hearth and Take me off', async () => {
    await renderApp(<HelpScreen />, { user: 'jo' });
    fireEvent.press(await screen.findByRole('button', { name: 'Take me off Hearth' }));
    expect(screen.getByRole('button', { name: 'Stay on Hearth' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Take me off' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Yes, take me off Hearth' })).toBeNull();
  });
});
