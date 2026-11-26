// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// TD-UX-R7 (docs/reviews/2026-11-19-tech-debt/ux.md; SPEC-SMS-SIGN-IN, DEC-57): sign-out and Me words for text sign-in.
// Written first (red). The flag is set before the app modules load, as in smsSignIn.test.tsx.
/* eslint-disable @typescript-eslint/no-require-imports -- tests load modules after jest.mock or resetModules, which a top-level import cannot do */
import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import type { Session } from '../../api/types';

jest.mock('../../demo/flags', () => ({ DEMO_MODE: false }));

const prevFlag = process.env.EXPO_PUBLIC_HEARTH_SMS;
process.env.EXPO_PUBLIC_HEARTH_SMS = '1';
afterAll(() => { if (prevFlag === undefined) delete process.env.EXPO_PUBLIC_HEARTH_SMS; else process.env.EXPO_PUBLIC_HEARTH_SMS = prevFlag; });

const { FAKE_OTP, FIXTURE, FakeBackend } = require('../../api/fake/FakeBackend') as typeof import('../../api/fake/FakeBackend');
const { last4 } = require('../../api/phone') as typeof import('../../api/phone');
const { renderApp, screenWords } = require('../../test/renderApp') as typeof import('../../test/renderApp');
const { MeScreen } = require('../MeScreen') as typeof import('../MeScreen');

type FakeBe = InstanceType<typeof FakeBackend>;
type TextApi = { verifyTextCode(phone: string, code: string): Promise<Session & { phone?: string }> };
const PHONE = '+13045550100';
const BODY = "To come back, you'll need a new code. We'll send it to you.";

async function phoneMember(be: FakeBe): Promise<string> {
  const id = (await (be.clientFor(null) as unknown as TextApi).verifyTextCode(PHONE, FAKE_OTP)).userId;
  const { code } = await be.clientFor(FIXTURE.users.chase.id).createInvite({
    space: FIXTURE.space.id, role: 'viewer', circleIds: [FIXTURE.circles.dadSide.id], history: 'all',
  });
  await be.clientFor(id).redeemInvite(code);
  return id;
}

async function openSignOut() {
  fireEvent.press(await screen.findByRole('button', { name: 'Sign out of Hearth' }));
  await screen.findByText('Sign out of Hearth?');
}

describe('TD-UX-R7a sign-out confirm never says email', () => {
  it('TD-UX-R7a email account: the body is the code-agnostic sentence, no "email"', async () => {
    await renderApp(<MeScreen />, { user: 'chase' });
    await openSignOut();
    expect(screen.getByText(BODY)).toBeTruthy();
    expect(screen.queryByText(/code from your email/i)).toBeNull();
  });

  it('TD-UX-R7a phone-only account: the body is the same sentence, no "email"', async () => {
    const be = FakeBackend.withFixture();
    const id = await phoneMember(be);
    await renderApp(<MeScreen />, { be, userId: id });
    await openSignOut();
    expect(screen.getByText(BODY)).toBeTruthy();
    expect(screen.queryByText(/code from your email/i)).toBeNull(); // Me's BETA-SMS-14 line may say "not by email"; the dialog must not
  });
});

describe('TD-UX-R7b Me says how a phone-only person signed in', () => {
  it('TD-UX-R7b Fake text sign-in returns the E.164 phone on the session', async () => {
    const be = FakeBackend.withFixture();
    const s = await (be.clientFor(null) as unknown as TextApi).verifyTextCode(PHONE, FAKE_OTP);
    expect(s).toMatchObject({ email: '', phone: PHONE });
  });

  it('TD-UX-R7b phone-only: "Signed in with the mobile number ending 0100", never the full number', async () => {
    const be = FakeBackend.withFixture();
    const id = await phoneMember(be);
    await renderApp(<MeScreen />, { be, userId: id });
    expect(await screen.findByText(`Signed in with the mobile number ending ${last4(PHONE)}`)).toBeTruthy();
    const words = screenWords();
    expect(words).not.toMatch(/3045550100|304.?555.?0100/);
    expect(screen.queryByText(/^Signed in as\s*$/)).toBeNull();
  });

  it('TD-UX-R7b email account still says "Signed in as <email>"', async () => {
    await renderApp(<MeScreen />, { user: 'chase' });
    expect(await screen.findByText(`Signed in as ${FIXTURE.users.chase.email}`)).toBeTruthy();
    expect(screen.queryByText(/mobile number ending/)).toBeNull();
  });
});
