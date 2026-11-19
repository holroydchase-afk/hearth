// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// CAP-1, CAP-3..5 (docs/product/SPEC-CAPTIONS.md, DEC-39): an optional title for the whole set, shown as the
// card's heading above the caption; a long caption folds to 4 lines behind a worded Read more.
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { seedPost } from '../../test/seed';
import { expectGrandparentSafe, renderApp } from '../../test/renderApp';
import { PhotosScreen } from '../PhotosScreen';
import { ByDate } from '../../test/galleryEntry';
import { ShareScreen } from '../ShareScreen';

const DAD = "Grandparents – Dad's side";

describe('CAP post titles', () => {
  // Retargeted Nov 19 by engineer for DEC-72 (amends DEC-39 / CAP-1; SHARE-PC-3), flagged for qa-tdd: a new post
  // has one note and no Title box; the note goes out as the caption and the title stays empty. Old titles still show
  // (CAP-3 below, SHARE-PC-4).
  it('CAP-1 DEC-72 Share has no Title box any more: the note goes out as the caption, with no title', async () => {
    const be = FakeBackend.withFixture();
    const { nav } = await renderApp(<ShareScreen />, { be, user: 'chase' });
    fireEvent.press(await screen.findByRole('button', { name: 'Pick photos from your phone' }));
    await screen.findByRole('header', { name: 'New post' });
    expect(screen.queryByLabelText('Title (optional)')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Add a note (optional)'), "Lily's 5th birthday");
    fireEvent.press(await screen.findByLabelText(`${DAD}, 3 people, not picked`));
    fireEvent.press(screen.getByRole('button', { name: /^Send to / }));
    await waitFor(() => expect(nav.goFeed).toHaveBeenCalled());
    await waitFor(async () => {
      const feed = await be.clientFor(FIXTURE.users.jo.id).getFeed({ space: FIXTURE.space.id });
      expect({ caption: feed[0]?.caption, title: feed[0]?.title ?? null }).toEqual({ caption: "Lily's 5th birthday", title: null });
    });
  });

  it('CAP-3 UX-R28 the description opens with the title, then the caption (no heading, RD-71)', async () => {
    const be = FakeBackend.withFixture({ joIsMember: true });
    await seedPost(be, { title: "Lily's 5th birthday", caption: 'Cake, candles, a nap' });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const desc = await screen.findByTestId(/^desc-/);
    expect(screen.queryByRole('header', { name: "Lily's 5th birthday" })).toBeNull();
    expect(within(desc).getByText("Lily's 5th birthday")).toBeTruthy();
    expect(within(desc).getByText('Cake, candles, a nap')).toBeTruthy();
    expectGrandparentSafe();
  });

  it('CAP-5 no title: no heading and no empty space', async () => {
    const be = FakeBackend.withFixture({ joIsMember: true });
    await seedPost(be, { caption: 'Mia at the park' });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    await screen.findByText('Mia at the park');
    expect(screen.queryByTestId(/^post-title-/)).toBeNull();
  });

  it('CAP-4 a long caption folds to 4 lines with a worded Read more, and Show less folds it again', async () => {
    const be = FakeBackend.withFixture({ joIsMember: true });
    const long = Array.from({ length: 8 }, (_, i) => `Line ${i + 1} of a long story about the beach.`).join('\n');
    await seedPost(be, { caption: long });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    expect(await screen.findByText(long)).toBeTruthy();
    // RD-48 (Nov 17): the words sit inside the description line ("<name> <words>"), which is the Text that folds.
    const desc = () => screen.getByTestId(/^desc-/);
    expect(desc().props.numberOfLines).toBe(4);
    fireEvent.press(screen.getByRole('button', { name: 'Read more of this caption' }));
    expect(desc().props.numberOfLines ?? 0).toBe(0);
    fireEvent.press(screen.getByRole('button', { name: 'Show less of this caption' }));
    expect(desc().props.numberOfLines).toBe(4);
  });

  it('CAP-4 a short caption has no Read more', async () => {
    const be = FakeBackend.withFixture({ joIsMember: true });
    await seedPost(be, { caption: 'Mia at the park' });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    await screen.findByText('Mia at the park');
    expect(screen.queryByRole('button', { name: /Read more/ })).toBeNull();
  });

  it('CAP-11 By date shows the title too', async () => {
    const be = FakeBackend.withFixture({ joIsMember: true });
    await seedPost(be, { title: 'Beach weekend', caption: 'Found these from August', takenAt: '2026-08-10T12:00:00.000Z' });
    await renderApp(<ByDate />, { be, user: 'jo' }); // RD-47: By date left Gallery's top bar
    expect(await screen.findByRole('header', { name: 'Beach weekend' })).toBeTruthy();
    expect(screen.getByRole('header', { name: /by date|By date/ })).toBeTruthy();
  });
});
