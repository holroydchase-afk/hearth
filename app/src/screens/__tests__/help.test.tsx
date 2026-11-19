// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { expectGrandparentSafe, renderApp, screenWords } from '../../test/renderApp';
import { HelpScreen } from '../HelpScreen';
import { MeScreen } from '../MeScreen';
import { MoreScreen } from '../MoreScreen';

describe('Help tab (viewers) — UXG-14', () => {
  it('puts "Call Chase" first and it dials', async () => {
    const { deps } = await renderApp(<HelpScreen />, { user: 'jo' });
    const buttons = await screen.findAllByRole('button');
    expect(buttons[0]!.props.accessibilityLabel).toBe('Call Chase');
    fireEvent.press(buttons[0]!);
    expect(deps.openUrl).toHaveBeenCalledWith('tel:+13045550100');
  });

  // GUX-R10 (Nov 16): Help no longer repeats Bigger text; the default is checked where it lives in More.
  // engineer, flagged for qa-tdd: Bigger text is Easy view now (RD-74 / RD-78): On / Off rows instead of a switch.
  it('Easy view is ON by default for viewers (More → Easy view)', async () => {
    await renderApp(<MoreScreen />, { user: 'jo' });
    fireEvent.press(await screen.findByRole('button', { name: 'Easy view, On' }));
    const on = await screen.findByRole('radio', { name: 'On' });
    expect(on.props.accessibilityState).toMatchObject({ checked: true });
    fireEvent.press(screen.getByRole('radio', { name: 'Off' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'On' }).props.accessibilityState).toMatchObject({ checked: false }));
  });

  it('notice choices are in plain words and confirm when picked', async () => {
    await renderApp(<HelpScreen />, { user: 'jo' });
    expect(await screen.findByRole('radio', { name: 'A sound on your phone when there are new photos (Recommended)' })).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: "An email every evening with the day's new photos" }));
    expect(await screen.findByText("Saved. We'll email you every evening when there are new photos.")).toBeTruthy();
  });

  // TD-UX-R3 (Nov 19): what she can do is said on Me, by role; Help keeps help and privacy.
  it('says what privacy means, without scary words', async () => {
    await renderApp(<HelpScreen />, { user: 'jo' });
    expect(await screen.findByText('No computer program learns from your photos.')).toBeTruthy();
    expect(screenWords()).not.toMatch(/\b(feed|circles?|audience|sync|upload|notifications?|expired|account|settings|digest|servers?|encrypted|AI)\b/i);
  });

  it('is grandparent-safe', async () => {
    await renderApp(<HelpScreen />, { user: 'jo' });
    await screen.findByText('How should we tell you about new photos?'); // GUX-R10: Bigger text moved out of Help
    expectGrandparentSafe();
  });
});

describe('Me tab (posters)', () => {
  // engineer, flagged for qa-tdd: Easy view (RD-74) replaces Bigger text on Me too; Off is the checked row.
  it('Easy view is off by default for posters; sign out asks first', async () => {
    await renderApp(<MeScreen />, { user: 'chase' });
    expect((await screen.findByRole('radio', { name: 'Off' })).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByRole('radio', { name: 'On' }).props.accessibilityState).toMatchObject({ checked: false }); // qa-tdd: both rows
    expect(screen.getByText('Signed in as chase@example.com')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Sign out of Hearth' }));
    expect(screen.getByText('Sign out of Hearth?')).toBeTruthy();
    expectGrandparentSafe();
  });
});
