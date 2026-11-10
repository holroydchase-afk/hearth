// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// grandparent-ux review of text sign-in (GUX-R1, GUX-R2). Flag on, on the Fake.
/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { CreateInviteArgs } from '../../api/types';

const prevFlag = process.env.EXPO_PUBLIC_HEARTH_SMS;
process.env.EXPO_PUBLIC_HEARTH_SMS = '1';
afterAll(() => { if (prevFlag === undefined) delete process.env.EXPO_PUBLIC_HEARTH_SMS; else process.env.EXPO_PUBLIC_HEARTH_SMS = prevFlag; });

const { ApiError } = require('../../api/HearthApi') as typeof import('../../api/HearthApi');
const { FIXTURE, FakeBackend } = require('../../api/fake/FakeBackend') as typeof import('../../api/fake/FakeBackend');
const { renderApp } = require('../../test/renderApp') as typeof import('../../test/renderApp');
const { GroupsScreen } = require('../GroupsScreen') as typeof import('../GroupsScreen');
const { JoinScreen } = require('../JoinScreen') as typeof import('../JoinScreen');

async function joinStep(make: Partial<CreateInviteArgs>) {
  const be = FakeBackend.withFixture({ joIsMember: false });
  const { code } = await be.clientFor(FIXTURE.users.chase.id).createInvite({
    space: FIXTURE.space.id, role: 'viewer', circleIds: [FIXTURE.circles.dadSide.id], history: 'all', ...make,
  });
  const r = await renderApp(<JoinScreen code={code} />, { be, user: null });
  fireEvent.press(await screen.findByRole('button', { name: 'See the photos' }));
  return r;
}

describe('GUX-R1 the join screen never offers a way the invite cannot open', () => {
  it('GUX-R1 a phone invite has no "Use email instead"', async () => {
    await joinStep({ channel: 'sms', targetPhone: '+13045550100' });
    expect(await screen.findByLabelText('Your mobile number')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Use email instead' })).toBeNull();
  });

  it('GUX-R1 an email invite has no "Use a text instead"', async () => {
    await joinStep({ channel: 'email', targetEmail: 'kim@example.com' });
    expect(await screen.findByLabelText('Your email')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Use a text instead' })).toBeNull();
  });

  it('GUX-R1 texts not working on a phone invite says who to ask, and stays on the number', async () => {
    const { api } = await joinStep({ channel: 'sms', targetPhone: '+13045550100' });
    jest.spyOn(api as unknown as { sendTextCode(p: string): Promise<void> }, 'sendTextCode').mockRejectedValue(new ApiError('SMS_OFF', 'off'));
    fireEvent.changeText(await screen.findByLabelText('Your mobile number'), '304-555-0100');
    fireEvent.press(screen.getByRole('button', { name: 'Send me a code' }));
    expect(await screen.findByText(/Texts aren't working right now\. Ask .+ to send you a new invite by email\./)).toBeTruthy();
    expect(screen.queryByLabelText('Your email')).toBeNull();
  });
});

describe('GUX-R2 the invite card says what skipping the number does', () => {
  it('GUX-R2 the skip button says email, and after it the card says who can open it and offers the number back', async () => {
    await renderApp(<GroupsScreen />, { user: 'chase' });
    fireEvent.press(await screen.findByRole('button', { name: "Invite someone to Grandparents – Dad's side" }));
    await screen.findByLabelText('Their mobile number');
    expect(screen.queryByRole('button', { name: 'Use email instead' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: "They'll use email" }));
    expect(screen.queryByLabelText('Their mobile number')).toBeNull();
    expect(screen.getByText("They'll sign in with their email. Anyone you send the invite to can open it.")).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Add their mobile number' }));
    await waitFor(() => expect(screen.getByLabelText('Their mobile number')).toBeTruthy());
  });
});
