// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// WORDS-1..4 (grandparent-ux words pass, Oct 29; docs/product/decisions/2026-10-29-words-pass.md): words that must be
// true for every sender, a refusal that says nothing was lost, a privacy line that reads as a whole sentence, and a
// group name that never wraps around its count.
import { fireEvent, screen, within } from '@testing-library/react-native';
import React from 'react';
import { FakeBackend } from '../../api/fake/FakeBackend';
import { ApiError } from '../../api/HearthApi';
import { seedPost } from '../../test/seed';
import { renderApp } from '../../test/renderApp';
import { PhotosScreen } from '../PhotosScreen';
import { MoreScreen } from '../../test/redesignScreens'; // RD-15: Messages and Events are rows in More
import { ShareScreen } from '../ShareScreen';

const DAD = "Grandparents – Dad's side";

describe('WORDS grandparent-ux words pass', () => {
  // Retargeted Nov 19 by engineer for DEC-72 (SHARE-PC-3/9), flagged for qa-tdd: the one note field promises no one;
  // the To: line names who gets it, by name, once picked.
  it('WORDS-1 DEC-72 the note never promises "Grandma will see this": the To: line names the people picked', async () => {
    await renderApp(<ShareScreen />, { user: 'chase' });
    fireEvent.press(await screen.findByRole('button', { name: 'Pick photos from your phone' }));
    await screen.findByRole('header', { name: 'New post' });
    const note = screen.getByLabelText('Add a note (optional)');
    expect(String(note.props.placeholder ?? '')).not.toMatch(/will see|Grandma|Gammy/);
    fireEvent.press(await screen.findByLabelText(`${DAD}, 3 people, not picked`));
    expect(screen.getByText('Grandma Jo and Grandpa Earl')).toBeTruthy();
  });

  it('WORDS-2 if changing the words is refused, the sheet says the old words are kept', async () => {
    const be = FakeBackend.withFixture({ joIsMember: true });
    await seedPost(be, { title: 'Party' });
    await renderApp(<PhotosScreen />, { be, user: 'chase' });
    jest.spyOn(be, 'editPostWords').mockImplementation(() => { throw new ApiError('42501', 'no'); });
    fireEvent.press(await screen.findByRole('button', { name: 'Post options' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Edit description' }));
    const sheet = await screen.findByTestId(/^words-/);
    fireEvent.press(within(sheet).getByRole('button', { name: 'Save the new words' }));
    expect(await within(sheet).findByText("These words can't be changed now. Your old words are kept.")).toBeTruthy();
  });

  it('WORDS-3 the Messages privacy line reads as whole sentences: "Not even Hearth can read it"', async () => {
    await renderApp(<MoreScreen />, { be: FakeBackend.withFixture({ joIsMember: true }), user: 'jo' });
    fireEvent.press(await screen.findByRole('button', { name: 'Messages' }));
    expect(await screen.findByText(
      'Only the people in this chat can read it. Parents are in every chat. Not even Hearth can read it: messages are locked on your phone before they are sent.',
    )).toBeTruthy();
  });

  // Retargeted Nov 19 by engineer for DEC-72 (SHARE-PC-5), flagged for qa-tdd: a face tile shows the group's name
  // alone and "3 people" on its own line, never "name · 3 people".
  it('WORDS-4 DEC-72 a group tile on Share shows its name alone, with "3 people" under it', async () => {
    await renderApp(<ShareScreen />, { user: 'chase' });
    fireEvent.press(await screen.findByRole('button', { name: 'Pick photos from your phone' }));
    const tile = await screen.findByLabelText(`${DAD}, 3 people, not picked`);
    expect(within(tile).getByText(DAD)).toBeTruthy();
    expect(within(tile).getByText('3 people')).toBeTruthy();
    expect(within(tile).queryByText(`${DAD} · 3 people`)).toBeNull();
  });
});
