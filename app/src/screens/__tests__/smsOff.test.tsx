// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// BETA-SMS-1 (SPEC-SMS-SIGN-IN 3.1): with the text flag off, every sign-in screen is today's email-only screen.
// A guard: green before and after texts are built. The existing JOIN tests must also pass unchanged.
import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { renderApp, screenWords } from '../../test/renderApp';
import { GroupsScreen } from '../GroupsScreen';
import { JoinScreen } from '../JoinScreen';
import { SignInScreen } from '../SignInScreen';

const prev = process.env.EXPO_PUBLIC_HEARTH_SMS;
beforeEach(() => { delete process.env.EXPO_PUBLIC_HEARTH_SMS; });
afterAll(() => { if (prev === undefined) delete process.env.EXPO_PUBLIC_HEARTH_SMS; else process.env.EXPO_PUBLIC_HEARTH_SMS = prev; });

const noTextWords = () => {
  expect(screen.queryByLabelText('Your mobile number')).toBeNull();
  expect(screen.queryByLabelText('Their mobile number')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Use a text instead' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Use email instead' })).toBeNull();
  expect(screenWords()).not.toMatch(/mobile number|texted/i);
};

describe('BETA-SMS-1 texts off: the email-only screens, unchanged', () => {
  it('BETA-SMS-1 the sign-in screen asks for an email only', async () => {
    await renderApp(<SignInScreen />, { user: null });
    expect(await screen.findByLabelText('Your email')).toBeTruthy();
    noTextWords();
  });

  it('BETA-SMS-1 the join screen asks for an email only', async () => {
    const be = FakeBackend.withFixture({ joIsMember: false });
    await renderApp(<JoinScreen code={FIXTURE.invites.jo} />, { be, user: null });
    fireEvent.press(await screen.findByRole('button', { name: 'See the photos' }));
    expect(await screen.findByLabelText('Your email')).toBeTruthy();
    noTextWords();
  });

  it('BETA-SMS-1 the invite card has no phone field', async () => {
    await renderApp(<GroupsScreen />, { user: 'chase' });
    fireEvent.press(await screen.findByRole('button', { name: "Invite someone to Grandparents – Dad's side" }));
    expect(await screen.findByRole('button', { name: 'Make the invite' })).toBeTruthy();
    noTextWords();
  });
});
