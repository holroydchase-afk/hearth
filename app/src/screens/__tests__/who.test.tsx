// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// WHO-6..9 (Chase, Nov 4): "I don't really want anyone to know they are in a group." Every post says who can
// see it, by people's names, to everyone who can see it; the group's name stays with the parents, because
// "Grandparents – Dad's side" is off-putting to a grandparent. Names come from post_viewers (migration 0022).
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { seedPost } from '../../test/seed';
import { renderApp, screenWords } from '../../test/renderApp';
import { PhotosScreen } from '../PhotosScreen';

const { dadSide } = FIXTURE.circles;

async function dadSidePost(user: 'jo' | 'earl' | 'chase' | 'alex') {
  const be = FakeBackend.withFixture();
  const { id } = await seedPost(be, { caption: 'At the lake', circles: [dadSide.id] });
  await renderApp(<PhotosScreen />, { be, user });
  return { be, id, el: await screen.findByTestId(`post-${id}`) };
}

describe('WHO: who can see this post, by name', () => {
  it('WHO-6 a grandparent sees the people who can see it on the card, herself as "You", and no group name', async () => {
    const { id, el } = await dadSidePost('jo');
    const who = await within(el).findByTestId(`who-${id}`);
    expect(who.props.accessibilityLabel).toBe('You, Alex, Chase and Grandpa Earl can see this');
    expect(screen.queryByText(/Grandparents|Dad's side/)).toBeNull();
    expect(screen.queryByText(/Nana Ruth/)).toBeNull(); // not in the group, so not named
  });

  it('WHO-7 "More" lists every name too, not only "Shared with you"', async () => {
    const { id, el } = await dadSidePost('earl');
    await within(el).findByTestId(`who-${id}`);
    fireEvent.press(within(el).getByRole('button', { name: 'More for this photo' }));
    const menu = await screen.findByTestId(`more-${id}`);
    expect(within(menu).getByText('You, Alex, Chase and Grandma Jo can see this')).toBeTruthy();
    expect(within(menu).queryByText('Shared with you')).toBeNull();
    expect(screen.queryByText(/Grandparents|Dad's side/)).toBeNull();
  });

  it('WHO-8 the sender still sees the group by name; another parent sees the people', async () => {
    const sender = await dadSidePost('chase');
    expect(within(sender.el).getByTestId(`to-${sender.id}`).props.children).toBe("Sent to Grandparents – Dad's side");
    // WHO-10: the sender gets the same little circles too
    expect((await within(sender.el).findByTestId(`who-${sender.id}`)).props.accessibilityLabel).toBe('You, Alex, Grandma Jo and Grandpa Earl can see this');
  });

  it('WHO-8 ...and a parent who did not send it sees the names', async () => {
    const { id, el } = await dadSidePost('alex');
    expect((await within(el).findByTestId(`who-${id}`)).props.accessibilityLabel).toBe('You, Chase, Grandma Jo and Grandpa Earl can see this');
  });

  it('WHO-9 a long list names three and counts the rest', async () => {
    const be = FakeBackend.withFixture();
    const { id } = await seedPost(be, { caption: 'Everyone', circles: [FIXTURE.circles.everyone.id] });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const who = await screen.findByTestId(`who-${id}`);
    expect(who.props.accessibilityLabel).toBe('You, Alex, Chase and 2 others can see this');
  });

  it('WHO-9 an older server without post_viewers keeps the card as it was', async () => {
    const be = FakeBackend.withFixture();
    const { id } = await seedPost(be, { caption: 'At the lake', circles: [dadSide.id] });
    const api = be.clientFor(null, { trackAppSession: true }) as unknown as Record<string, unknown>;
    api.postViewers = async () => { throw Object.assign(new Error('missing'), { code: 'PGRST202' }); };
    await renderApp(<PhotosScreen />, { be, user: 'jo', deps: { api: api as never } });
    await screen.findByText('At the lake');
    await waitFor(() => expect(screen.queryByTestId(`who-${id}`)).toBeNull());
    expect(screenWords()).not.toMatch(/can see this/);
  });

  it('WHO-10 (Chase, Nov 5: "contact circles or chips... a discreet icon") the card shows small initial circles, not a sentence', async () => {
    const { id, el } = await dadSidePost('jo');
    const who = await within(el).findByTestId(`who-${id}`);
    expect(who.props.accessibilityRole).toBe('button');
    expect(within(who).queryByText(/can see this/)).toBeNull();
    expect(within(who).getAllByTestId(/^face-/)).toHaveLength(3);
    expect(within(who).getByText('+1')).toBeTruthy();
  });

  it('WHO-10 tapping the circles opens a sheet with one chip per person; Close shuts it', async () => {
    const { id, el } = await dadSidePost('jo');
    fireEvent.press(await within(el).findByTestId(`who-${id}`));
    const sheet = await screen.findByTestId(`who-sheet-${id}`);
    expect(within(sheet).getByText('Who can see this')).toBeTruthy();
    expect(within(sheet).getAllByTestId(/^person-(?!name)/).map((p) => within(p).getByTestId('person-name').props.children))
      .toEqual(['You', 'Alex', 'Chase', 'Grandpa Earl']);
    expect(within(sheet).queryByText(/Grandparents|Dad's side/)).toBeNull();
    fireEvent.press(within(sheet).getByRole('button', { name: 'Close who can see this' }));
    await waitFor(() => expect(screen.queryByTestId(`who-sheet-${id}`)).toBeNull());
  });

  it('LIVE-4 the little circles carry a word, "Can see", so a lone initial isn\'t a mystery (Chase, Nov 5)', async () => {
    const { id, el } = await dadSidePost('jo');
    const who = await within(el).findByTestId(`who-${id}`);
    expect(within(who).getByText('Can see')).toBeTruthy();
  });
});
