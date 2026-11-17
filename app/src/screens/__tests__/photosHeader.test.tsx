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

// Updated Nov 17 for RD-47 (DEC-65): Search and By date leave the top bar; a "Search photos" field sits under the greeting.
describe('RD-47 Gallery top (replaces RD-13, R11 RV-U3 and LIVE-2)', () => {
  it('UI-26 RD-47 nothing tappable up top: no Search, By date, Messages, Events or "Check for new photos"', async () => {
    await renderApp(<GalleryScreen />, { be: await withEvent(), user: 'jo' });
    await screen.findByRole('header', { name: /^Good (morning|afternoon|evening)/ });
    const bar = screen.queryByTestId('top-bar');
    if (bar) expect(within(bar).queryAllByRole('button')).toHaveLength(0);
    for (const name of ['Search the photos', 'Show photos by the date they were taken', 'See events', 'Messages', 'Check for new photos']) {
      expect({ name, found: screen.queryAllByRole('button', { name }).length }).toEqual({ name, found: 0 });
    }
    expect(screen.queryByTestId('photos-toolbar')).toBeNull();
  });

  it('LIVE-2 RD-47 the greeting is the large title, then the "Search photos" field, 48 pt tall', async () => {
    await renderApp(<GalleryScreen />, { be: await withEvent(), user: 'jo' });
    expect(await screen.findByRole('header', { name: /^Good (morning|afternoon|evening)/ })).toBeTruthy();
    const field = (await screen.findAllByLabelText('Search photos')).find((n) => typeof n.type === 'string')!;
    const s = StyleSheet.flatten(field.props.style) ?? {};
    expect(Number(s.minHeight ?? s.height ?? 0)).toBeGreaterThanOrEqual(48);
    expectGrandparentSafe();
  });
});
