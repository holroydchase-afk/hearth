// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// R11 (RV-U3, design note docs/product/decisions/2026-10-21-photos-header.md): fewer stacked buttons before the
// first photo. The four header buttons sit two to a row; with Bigger text a row wraps instead of squeezing.
import { screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import React from 'react';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { seedPost } from '../../test/seed';
import { expectGrandparentSafe, renderApp } from '../../test/renderApp';
import { PhotosScreen } from '../PhotosScreen';

async function withEvent() {
  const be = FakeBackend.withFixture();
  const chase = be.clientFor(FIXTURE.users.chase.id);
  const ev = await chase.createLevel(FIXTURE.space.id, 'event', 'Beach week');
  await chase.placePerson(ev, FIXTURE.users.jo.id, 'all');
  await seedPost(be, { caption: 'Sandcastle', circles: [ev] });
  return be;
}

describe('R11 RV-U3 Photos header', () => {
  it('UI-26 one header row: Messages and By date (sort icon) side by side, no "Check for new photos" button', async () => {
    await renderApp(<PhotosScreen />, { be: await withEvent(), user: 'jo' });
    const title = await screen.findByTestId('photos-toolbar');
    expect(within(title).getByRole('button', { name: 'See events' })).toBeTruthy();
    expect(within(title).getByRole('button', { name: 'Messages' })).toBeTruthy();
    expect(within(title).getByRole('button', { name: 'Show photos by the date they were taken' })).toBeTruthy();
    expect(within(title).getByText('By date')).toBeTruthy();
    expect(StyleSheet.flatten(title.props.style)).toMatchObject({ flexDirection: 'row', justifyContent: 'flex-end' });
    // Photos refresh on their own (open, back in front) and with pull-to-refresh; no button for it.
    expect(screen.queryByRole('button', { name: 'Check for new photos' })).toBeNull();
    expect(screen.queryByTestId('photos-actions-feed')).toBeNull();
  });

  it('LIVE-2 Messages and By date are compact icon buttons in a toolbar above the big title, a word under each icon (Chase, Nov 5)', async () => {
    await renderApp(<PhotosScreen />, { be: await withEvent(), user: 'jo' });
    const row = await screen.findByTestId('photos-toolbar');
    expect(within(row).queryByRole('header')).toBeNull(); // the big title sits under the toolbar, like the phone's own large titles
    expect(screen.getByRole('header', { name: /Photos of/ })).toBeTruthy();
    for (const name of ['Messages', 'Show photos by the date they were taken']) {
      const b = within(row).getByRole('button', { name });
      const s = StyleSheet.flatten(b.props.style);
      expect(s).toMatchObject({ flexDirection: 'column', alignItems: 'center' }); // icon over word
      expect(s.flexBasis).toBeUndefined(); // no longer a half-width pill
      expect(s.minHeight).toBeGreaterThanOrEqual(48);
      expect(s.minWidth).toBeGreaterThanOrEqual(48);
    }
    expect(within(row).getByText('Messages')).toBeTruthy();
    expect(within(row).getByText('By date')).toBeTruthy();
    expectGrandparentSafe();
  });
});
