// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// R11 (RV-U3) and LIVE-2 (Nov 5) put Messages, By date, Search, All photos and Events in a toolbar above the
// Photos title. RD-13 (SPEC-REDESIGN 1b, Chase Nov 14: "I don't want all of the buttons at the top") replaces
// that rule: Gallery's top bar holds only Search and By date, compact icons with a word under each, and the
// greeting is the large title under it. UI-26 still holds: no "Check for new photos" button.
import { screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import React from 'react';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { seedPost } from '../../test/seed';
import { GalleryScreen } from '../../test/redesignScreens';
import { expectGrandparentSafe, renderApp } from '../../test/renderApp';

async function withEvent() {
  const be = FakeBackend.withFixture();
  const chase = be.clientFor(FIXTURE.users.chase.id);
  const ev = await chase.createLevel(FIXTURE.space.id, 'event', 'Beach week');
  await chase.placePerson(ev, FIXTURE.users.jo.id, 'all');
  await seedPost(be, { caption: 'Sandcastle', circles: [ev] });
  return be;
}

describe('RD-13 Gallery top bar (replaces R11 RV-U3 and LIVE-2)', () => {
  it('UI-26 RD-13 one top bar: Search and By date only, at the right; no Messages, Events or "Check for new photos" up top', async () => {
    await renderApp(<GalleryScreen />, { be: await withEvent(), user: 'jo' });
    const bar = await screen.findByTestId('top-bar');
    expect(within(bar).getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['Search the photos', 'Show photos by the date they were taken']);
    expect(within(bar).getByText('By date')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'See events' })).toBeNull(); // in More now (RD-15)
    expect(screen.queryByRole('button', { name: 'Messages' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check for new photos' })).toBeNull();
    expect(screen.queryByTestId('photos-toolbar')).toBeNull();
  });

  it('LIVE-2 RD-13 Search and By date are compact icon buttons above the large greeting, a word under each icon', async () => {
    await renderApp(<GalleryScreen />, { be: await withEvent(), user: 'jo' });
    const bar = await screen.findByTestId('top-bar');
    expect(within(bar).queryByRole('header')).toBeNull(); // at rest the large title sits under the bar
    expect(screen.getByRole('header', { name: /^Good (morning|afternoon|evening)/ })).toBeTruthy();
    for (const name of ['Search the photos', 'Show photos by the date they were taken']) {
      const b = within(bar).getByRole('button', { name });
      const s = StyleSheet.flatten(b.props.style);
      expect(s).toMatchObject({ flexDirection: 'column', alignItems: 'center' }); // icon over word
      expect(s.minHeight).toBeGreaterThanOrEqual(48);
      expect(s.minWidth).toBeGreaterThanOrEqual(48);
    }
    expect(within(bar).getByText('Search')).toBeTruthy();
    expect(within(bar).getByText('By date')).toBeTruthy();
    expectGrandparentSafe();
  });
});
