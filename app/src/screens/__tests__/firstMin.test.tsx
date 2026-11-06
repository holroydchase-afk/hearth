// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// FIRSTMIN-1/2 (Chase, Nov 6): on a post Grandma Jo and Grandpa Earl can both see, both faces read "G", so
// nobody could tell them apart. The faces, the Who sheet and the post header share one initials rule.
import { fireEvent, screen, within } from '@testing-library/react-native';
import React from 'react';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { seedPost } from '../../test/seed';
import { renderApp } from '../../test/renderApp';
import { PhotosScreen } from '../PhotosScreen';

const { jo, earl } = FIXTURE.users;

/** A post whose viewers are exactly Grandma Jo and Grandpa Earl, seen by the parent who sent it. */
async function joAndEarlPost() {
  const be = FakeBackend.withFixture();
  const { id } = await seedPost(be, { caption: 'At the lake', circles: [FIXTURE.circles.dadSide.id] });
  const api = be.clientFor(null, { trackAppSession: true }) as unknown as Record<string, unknown> & { postViewers: (p: string[]) => Promise<Array<{ post_id: string; viewers: Array<{ user_id: string; name: string }> }>> };
  const real = api.postViewers.bind(api);
  api.postViewers = async (posts: string[]) => (await real(posts)).map((r) => ({ ...r, viewers: r.viewers.filter((v) => v.user_id === jo.id || v.user_id === earl.id) }));
  await renderApp(<PhotosScreen />, { be, user: 'chase', deps: { api: api as never } });
  return { id, el: await screen.findByTestId(`post-${id}`) };
}

const textOf = (node: ReturnType<typeof screen.getByTestId>) => within(node).getByText(/^[A-Z?]{1,2}$/, { includeHiddenElements: true }).props.children;

describe('FIRSTMIN-2 two grandparents get different faces', () => {
  it('FIRSTMIN-2 the Can see faces read GJ and GE, so the two faces differ', async () => {
    const { id, el } = await joAndEarlPost();
    const who = await within(el).findByTestId(`who-${id}`);
    const joFace = within(who).getByTestId(`face-${jo.id}`);
    const earlFace = within(who).getByTestId(`face-${earl.id}`);
    expect(textOf(joFace)).toBe('GJ');
    expect(textOf(earlFace)).toBe('GE');
    expect(textOf(joFace)).not.toBe(textOf(earlFace));
  });

  it('FIRSTMIN-2 the Who sheet chips read GJ and GE too', async () => {
    const { id, el } = await joAndEarlPost();
    fireEvent.press(await within(el).findByTestId(`who-${id}`));
    const sheet = await screen.findByTestId(`who-sheet-${id}`);
    expect(textOf(within(sheet).getByTestId(`person-${jo.id}`))).toBe('GJ');
    expect(textOf(within(sheet).getByTestId(`person-${earl.id}`))).toBe('GE');
  });

  it('FIRSTMIN-1 the post header avatar uses the same two-letter rule', async () => {
    const be = FakeBackend.withFixture();
    be.state.users[FIXTURE.users.chase.id]!.name = 'Dad Chase';
    const { id } = await seedPost(be, { caption: 'From Dad', circles: [FIXTURE.circles.dadSide.id] });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const head = await screen.findByTestId(`card-head-${id}`);
    // The avatar is hidden from screen readers (the name beside it is read), so look past that.
    expect(within(head).getByText(/^[A-Z?]{1,2}$/, { includeHiddenElements: true }).props.children).toBe('DC');
  });
});
