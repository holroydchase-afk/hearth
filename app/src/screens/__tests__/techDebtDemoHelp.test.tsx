// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// TD-UX-R5 (Nov 19 tech-debt review): like Me (DEMO-8), the demo's Help page has no Sign out or Take me off Hearth;
// in the no-login demo there is no way back in.
import { screen } from '@testing-library/react-native';
import React from 'react';
import { renderApp } from '../../test/renderApp';
import { HelpScreen } from '../HelpScreen';

jest.mock('../../demo/flags', () => ({ DEMO_MODE: true }));

describe('TD-UX-R5 Help in the demo build', () => {
  it('TD-UX-R5 no Sign out or Take me off Hearth on the demo\'s Help page', async () => {
    await renderApp(<HelpScreen />, { user: 'jo' });
    await screen.findByText('No computer program learns from your photos.');
    expect(screen.queryByRole('button', { name: 'Sign out of Hearth' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Take me off Hearth' })).toBeNull();
  });
});
