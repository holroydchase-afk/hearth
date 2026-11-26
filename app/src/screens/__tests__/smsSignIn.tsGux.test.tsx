// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// grandparent-ux review before texts go on (docs/reviews/2026-11-19-text-sign-in/gux.md): TS-GUX-R2, R4, R5, R6.
// Written first (red). Flag on, on the Fake. R1 lives in backend/tests/templates, R3 in scripts/tests/grandparent_guide_test.sh.
/* eslint-disable @typescript-eslint/no-require-imports -- tests load modules after jest.mock or resetModules, which a top-level import cannot do */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { CreateInviteArgs } from '../../api/types';

const prevFlag = process.env.EXPO_PUBLIC_HEARTH_SMS;
process.env.EXPO_PUBLIC_HEARTH_SMS = '1';
afterAll(() => { if (prevFlag === undefined) delete process.env.EXPO_PUBLIC_HEARTH_SMS; else process.env.EXPO_PUBLIC_HEARTH_SMS = prevFlag; });

const { ApiError } = require('../../api/HearthApi') as typeof import('../../api/HearthApi');
const { FAKE_OTP, FIXTURE, FakeBackend } = require('../../api/fake/FakeBackend') as typeof import('../../api/fake/FakeBackend');
const { messageFor } = require('../../errors/messages') as typeof import('../../errors/messages');
const { expectGrandparentSafe, renderApp, screenWords } = require('../../test/renderApp') as typeof import('../../test/renderApp');
const { GroupsScreen } = require('../GroupsScreen') as typeof import('../GroupsScreen');
const { JoinScreen } = require('../JoinScreen') as typeof import('../JoinScreen');
const { SignInScreen } = require('../SignInScreen') as typeof import('../SignInScreen');

type TextApi = { sendTextCode(phone: string): Promise<void> };
const asText = (api: unknown) => api as TextApi;

async function sendTo(number: string) {
  fireEvent.changeText(await screen.findByLabelText('Your mobile number'), number);
  fireEvent.press(screen.getByRole('button', { name: 'Send me a code' }));
}

describe('TS-GUX-R2 the invite text warns about the 6-number code and names the invite code', () => {
  const WARN = "Hearth will text you a 6-number code from a number you don't know. That's the real one. Type it in yourself; don't read it to anyone, even me.";

  async function makeInvite(phone: string | null) {
    const r = await renderApp(<GroupsScreen />, { user: 'chase' });
    fireEvent.press(await screen.findByRole('button', { name: "Invite someone to Grandparents – Dad's side" }));
    fireEvent.press(await screen.findByRole('radio', { name: 'Share all past photos' }));
    await screen.findByLabelText('Their mobile number');
    if (phone) fireEvent.changeText(screen.getByLabelText('Their mobile number'), phone);
    else fireEvent.press(screen.getByRole('button', { name: "They'll use email" }));
    fireEvent.press(screen.getByRole('button', { name: 'Make the invite' }));
    await screen.findByText('Works for 30 days.');
    return r;
  }
  async function smsBody(deps: { openUrl: unknown }) {
    fireEvent.press(screen.getByRole('button', { name: 'Text the invite' }));
    await waitFor(() => expect(deps.openUrl).toHaveBeenCalled());
    return decodeURIComponent((deps.openUrl as jest.Mock).mock.calls[0][0]);
  }

  it('TS-GUX-R2 a phone invite text says Hearth will text a 6-number code, not to read it to anyone, and "Your invite code is"', async () => {
    const { deps } = await makeInvite('304-555-0100');
    const body = await smsBody(deps);
    expect(body).toContain('Hearth will text you a 6-number code');
    expect(body).toContain("don't read it to anyone, even me");
    expect(body).toContain(WARN);
    expect(body).toMatch(/Your invite code is [A-Z0-9]{5} [A-Z0-9]{5}\.$/);
    expect(body).not.toMatch(/Your code is/);
    // The warning comes before the last line (the invite code).
    expect(body.indexOf(WARN)).toBeLessThan(body.indexOf('Your invite code is'));
  });

  it('TS-GUX-R2 a link invite text has no 6-number warning, only "Your invite code is"', async () => {
    const { deps } = await makeInvite(null);
    const body = await smsBody(deps);
    expect(body).not.toContain('Hearth will text you');
    expect(body).toContain("If that doesn't open, call me and I'll help.");
    expect(body).toMatch(/Your invite code is [A-Z0-9]{5} [A-Z0-9]{5}\.$/);
  });

  it('TS-GUX-R2 the invite card says "this invite code"', async () => {
    await makeInvite('304-555-0100');
    expect(screen.getByText(/^Or they can type this invite code in Hearth: [A-Z0-9]{5} [A-Z0-9]{5}$/)).toBeTruthy();
  });
});

describe('TS-GUX-R4 texts down on the open sign-in screen: an email only if she has used one', () => {
  const R4 = "Texts aren't working right now. If you've used your email with Hearth before, type it below. If you always use a text, try again in an hour, or call the person who invited you.";

  it('TS-GUX-R4 SMS_OFF shows the R4 words, the email field and "Use a text instead"', async () => {
    const { api } = await renderApp(<SignInScreen />, { user: null });
    await screen.findByLabelText('Your mobile number');
    jest.spyOn(asText(api), 'sendTextCode').mockRejectedValue(new ApiError('SMS_OFF' as never));
    await sendTo('304-555-0100');
    expect(await screen.findByText(R4)).toBeTruthy();
    expect(screen.getByLabelText('Your email')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use a text instead' })).toBeTruthy();
    expect(screen.queryByText("Texts aren't working right now. Use your email instead.")).toBeNull();
  });

  it('TS-GUX-R4 a phone invite with texts down keeps its own words (no email field, no R4 words)', async () => {
    const be = FakeBackend.withFixture({ joIsMember: false });
    const { code } = await be.clientFor(FIXTURE.users.chase.id).createInvite({
      space: FIXTURE.space.id, role: 'viewer', circleIds: [FIXTURE.circles.dadSide.id], history: 'all', channel: 'sms', targetPhone: '+13045550100',
    });
    const { api } = await renderApp(<JoinScreen code={code} />, { be, user: null });
    fireEvent.press(await screen.findByRole('button', { name: 'See the photos' }));
    jest.spyOn(asText(api), 'sendTextCode').mockRejectedValue(new ApiError('SMS_OFF' as never));
    await sendTo('304-555-0100');
    expect(await screen.findByText(/Texts aren't working right now\./)).toBeTruthy();
    expect(screen.queryByText(R4)).toBeNull();
    expect(screen.queryByLabelText('Your email')).toBeNull();
  });
});

describe('TS-GUX-R5 a session that ran out promises the right channel', () => {
  it('TS-GUX-R5 messageFor(AUTH, { via: "text" }) says "We\'ll text you a new code"', () => {
    expect(messageFor(new ApiError('AUTH'), { via: 'text' })).toBe("Please sign in again. We'll text you a new code.");
  });
  it('TS-GUX-R5 with via email, the email words are unchanged', () => {
    expect(messageFor(new ApiError('AUTH'), { via: 'email' })).toBe('Please sign in again. We will email you a new code.');
  });
  it('TS-GUX-R5 with no via (most screens don\'t know the channel), the words name no channel', () => {
    expect(messageFor(new ApiError('AUTH'))).toBe("Please sign in again. We'll send you a new code.");
  });
});

describe('TS-GUX-R6 a phone invite opened with a different number says so, by the last 4 digits only', () => {
  async function joinWithWrongNumber(make: Partial<CreateInviteArgs>) {
    const be = FakeBackend.withFixture({ joIsMember: false });
    const { code } = await be.clientFor(FIXTURE.users.chase.id).createInvite({
      space: FIXTURE.space.id, role: 'viewer', circleIds: [FIXTURE.circles.dadSide.id], history: 'all', ...make,
    });
    const r = await renderApp(<JoinScreen code={code} />, { be, user: null });
    fireEvent.press(await screen.findByRole('button', { name: 'See the photos' }));
    await sendTo('304-555-0100'); // Grandaddy's house phone; the invite is bound to his own cell (0123)
    fireEvent.changeText(await screen.findByLabelText('6-number code'), FAKE_OTP);
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    return r;
  }

  it('TS-GUX-R6 shows "didn\'t open for the number ending in 0100", the reasons, and "Try a different number"', async () => {
    await joinWithWrongNumber({ channel: 'sms', targetPhone: '+13045550123' });
    expect(await screen.findByText("This invite didn't open for the number ending in 0100.")).toBeTruthy();
    expect(screen.getByText('It may be old or already used, or Chase sent it to a different number. Try your other number, or ask Chase for a new invite.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try a different number' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go to Gallery' })).toBeNull();
    expect(screen.queryByText(/too old or already used\. Ask/)).toBeNull();
    // Last 4 only (SPEC-SMS-SIGN-IN 3.4): the full number never shows, in any spelling.
    const words = screenWords();
    expect(words).not.toMatch(/304.?555.?0100|3045550100|\+1/);
    expectGrandparentSafe();
  });

  it('TS-GUX-R6 "Try a different number" signs out and goes back to "Your mobile number"', async () => {
    const { api } = await joinWithWrongNumber({ channel: 'sms', targetPhone: '+13045550123' });
    const out = jest.spyOn(api, 'signOut');
    fireEvent.press(await screen.findByRole('button', { name: 'Try a different number' }));
    await waitFor(() => expect(out).toHaveBeenCalled());
    expect(await screen.findByLabelText('Your mobile number')).toBeTruthy();
    expect(screen.queryByText("This invite didn't open for the number ending in 0100.")).toBeNull();
  });
});
