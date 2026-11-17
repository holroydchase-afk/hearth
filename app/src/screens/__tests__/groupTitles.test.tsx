// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEC-49 / WHO-8 after the RD-44..55 redesign (qa-tdd, Nov 17): the Instagram-style Feed and the months Gallery
// name a group only to its sender. A grandparent never sees "Grandparents – Dad's side", in words or in what
// VoiceOver reads, on the card or in its Post options sheet. Both directions.
import { fireEvent, screen, within } from '@testing-library/react-native';
import React from 'react';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { seedPost } from '../../test/seed';
import { renderApp, screenWords } from '../../test/renderApp';
import { FeedScreen, GalleryScreen } from '../../test/redesignScreens';

const { dadSide } = FIXTURE.circles;
const slow = { timeout: 4000 };
const GROUP = /Grandparents|Dad's side/;

function spokenLabels(): string {
  return screen.UNSAFE_root.findAll((n) => typeof n.props?.accessibilityLabel === 'string')
    .map((n) => n.props.accessibilityLabel as string).join(' | ');
}

async function feedAs(user: 'jo' | 'earl' | 'chase') {
  const be = FakeBackend.withFixture();
  const { id } = await seedPost(be, { caption: 'At the lake', circles: [dadSide.id] });
  await renderApp(<FeedScreen />, { be, user });
  return { id, card: await screen.findByTestId(`post-${id}`, {}, slow) };
}

describe('DEC-49 group titles only for the sender, after the redesign', () => {
  it.each(['jo', 'earl'] as const)('DEC-49 RD-48 %s never sees a group title on a Feed post or its Post options', async (user) => {
    const { id, card } = await feedAs(user);
    await within(card).findByTestId(`who-${id}`, {}, slow);
    expect(within(card).queryByTestId(`to-${id}`)).toBeNull();
    expect(screenWords()).not.toMatch(GROUP);
    expect(spokenLabels()).not.toMatch(GROUP);
    fireEvent.press(within(card).getByRole('button', { name: 'Post options' }));
    await screen.findByTestId(`more-${id}`);
    expect(screenWords()).not.toMatch(GROUP);
    expect(spokenLabels()).not.toMatch(GROUP);
  });

  // UX-R15 (review round 2): the card says who can see it once (names); the group's name moves to Post options.
  it('DEC-49 RD-48 UX-R15 the sender (Chase) does see "Grandparents – Dad\'s side", in Post options', async () => {
    const { id, card } = await feedAs('chase');
    await within(card).findByTestId(`who-${id}`, {}, slow);
    expect(within(card).queryByTestId(`to-${id}`)).toBeNull();
    fireEvent.press(within(card).getByRole('button', { name: 'Post options' }));
    expect(screenWords()).toMatch(/Grandparents – Dad's side/);
  });

  it('DEC-49 RD-44 Grandma Jo\'s months Gallery shows no group title', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'At the lake', circles: [dadSide.id] });
    await renderApp(<GalleryScreen />, { be, user: 'jo' });
    await screen.findAllByTestId(/^gallery-tile-/, {}, slow);
    expect(screenWords()).not.toMatch(GROUP);
    expect(spokenLabels()).not.toMatch(GROUP);
  });
});
