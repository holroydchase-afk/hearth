// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// BETA-SMS-2..6, -9..12, -14 (SPEC-SMS-SIGN-IN, DEC-56): text message sign-in with the build flag on, on the Fake.
// Written first: red until the screens and the Fake's sendTextCode / verifyTextCode exist.
// The flag is set before the app modules load (a build flag may be read once, at import), so they are required below.
/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { CreateInviteArgs, Session } from '../../api/types';

const prevFlag = process.env.EXPO_PUBLIC_HEARTH_SMS;
process.env.EXPO_PUBLIC_HEARTH_SMS = '1';
afterAll(() => { if (prevFlag === undefined) delete process.env.EXPO_PUBLIC_HEARTH_SMS; else process.env.EXPO_PUBLIC_HEARTH_SMS = prevFlag; });

const { ApiError } = require('../../api/HearthApi') as typeof import('../../api/HearthApi');
const { FAKE_OTP, FIXTURE, FakeBackend } = require('../../api/fake/FakeBackend') as typeof import('../../api/fake/FakeBackend');
const { messageFor } = require('../../errors/messages') as typeof import('../../errors/messages');
const { expectGrandparentSafe, renderApp, screenWords } = require('../../test/renderApp') as typeof import('../../test/renderApp');
const { AppGate } = require('../AppGate') as typeof import('../AppGate');
const { GroupsScreen } = require('../GroupsScreen') as typeof import('../GroupsScreen');
const { HelpScreen } = require('../HelpScreen') as typeof import('../HelpScreen');
const { JoinScreen } = require('../JoinScreen') as typeof import('../JoinScreen');
const { HowToTell } = require('../Preferences') as typeof import('../Preferences');
const { SignInScreen } = require('../SignInScreen') as typeof import('../SignInScreen');

type FakeBe = InstanceType<typeof FakeBackend>;
/** The methods the spec adds to HearthApi (cast so this file stays type-clean until they exist). */
type TextApi = { sendTextCode(phone: string): Promise<void>; verifyTextCode(phone: string, code: string): Promise<Session> };
const asText = (api: unknown) => api as TextApi;

const BAD_NUMBER = 'Please type a US mobile number, like 304-555-0100.';
const TEXTS_OFF = "Texts aren't working right now. Use your email instead.";
const PHONE_HELP = 'You sign in with a text, so Hearth tells you about new photos on this phone, not by email.';
const EMAIL_CHOICES = ["An email every evening with the day's new photos", 'An email every Sunday morning'];

async function sendTo(number: string) {
  fireEvent.changeText(await screen.findByLabelText('Your mobile number'), number);
  fireEvent.press(screen.getByRole('button', { name: 'Send me a code' }));
}

/** A phone-only account made through the API, as a text sign-in would make it. */
async function phoneAccount(be: FakeBe, phone = '+13045550100'): Promise<string> {
  return (await asText(be.clientFor(null)).verifyTextCode(phone, FAKE_OTP)).userId;
}

/** A phone-only account that has joined Chase's family by a link invite. */
async function phoneMember(be: FakeBe): Promise<string> {
  const id = await phoneAccount(be);
  const { code } = await be.clientFor(FIXTURE.users.chase.id).createInvite({
    space: FIXTURE.space.id, role: 'viewer', circleIds: [FIXTURE.circles.dadSide.id], history: 'all',
  });
  await be.clientFor(id).redeemInvite(code);
  return id;
}

describe('BETA-SMS-2 phone first, email one tap away', () => {
  it('BETA-SMS-2 "Your mobile number" is the only field; "Send me a code" is the main button; "Use email instead" switches and back', async () => {
    await renderApp(<SignInScreen />, { user: null });
    expect(await screen.findByLabelText('Your mobile number')).toBeTruthy();
    expect(screen.queryByLabelText('Your email')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send me a code' })).toBeTruthy();
    const useEmail = screen.getByRole('button', { name: 'Use email instead' });
    const words = screenWords();
    expect(words.indexOf('Send me a code')).toBeLessThan(words.indexOf('Use email instead')); // secondary, below
    expectGrandparentSafe(); // 48 pt, labeled, 17 pt text
    fireEvent.press(useEmail);
    expect(await screen.findByLabelText('Your email')).toBeTruthy();
    expect(screen.queryByLabelText('Your mobile number')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Use a text instead' }));
    expect(await screen.findByLabelText('Your mobile number')).toBeTruthy();
    expect(screen.queryByLabelText('Your email')).toBeNull();
  });
});

describe('BETA-SMS-3 US numbers only, sent as E.164', () => {
  it.each(['(304) 555-0100', '304-555-0100', '304.555.0100', '3045550100', '1 304 555 0100', '+1 304 555 0100'])(
    'BETA-SMS-3 "%s" is sent as +13045550100',
    async (typed) => {
      const { api } = await renderApp(<SignInScreen />, { user: null });
      await screen.findByLabelText('Your mobile number');
      const spy = jest.spyOn(asText(api), 'sendTextCode');
      await sendTo(typed);
      await waitFor(() => expect(spy).toHaveBeenCalledWith('+13045550100'));
      expect(screen.queryByText(BAD_NUMBER)).toBeNull();
    },
  );

  it.each(['555-0100', '+44 20 7946 0000', '(104) 555-0100', '304-155-0100', '130455501001'])(
    'BETA-SMS-3 "%s" sends nothing and asks for a US mobile number',
    async (typed) => {
      const { api } = await renderApp(<SignInScreen />, { user: null });
      await screen.findByLabelText('Your mobile number');
      const spy = jest.spyOn(asText(api), 'sendTextCode');
      await sendTo(typed);
      expect(await screen.findByText(BAD_NUMBER)).toBeTruthy();
      expect(spy).not.toHaveBeenCalled();
    },
  );
});

describe('BETA-SMS-4 the code screen', () => {
  it('BETA-SMS-4 names only the last 4 digits, takes a pasted "123 456" or "123-456", has the autofill hints, waits 60 s', async () => {
    await renderApp(<SignInScreen />, { user: null });
    await sendTo('304-555-0100');
    expect(await screen.findByText('We texted a 6-number code to the number ending in 0100. Type it here.')).toBeTruthy();
    expect(screenWords()).not.toMatch(/304|555/); // never the full number after step 1
    const box = screen.getByLabelText('6-number code');
    expect(box.props.textContentType).toBe('oneTimeCode');
    expect(['one-time-code', 'sms-otp']).toContain(box.props.autoComplete);
    fireEvent.changeText(box, '123 456');
    expect(screen.getByLabelText('6-number code').props.value).toBe('123456');
    fireEvent.changeText(box, '123-456');
    expect(screen.getByLabelText('6-number code').props.value).toBe('123456');
    expect(screen.getByText(/You can ask for a new code in (60|59) seconds\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send a new code' }).props.accessibilityState).toMatchObject({ disabled: true });
    expectGrandparentSafe();
  });

  it('BETA-SMS-4 after 60 s "Send a new code" works again', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    try {
      await renderApp(<SignInScreen />, { user: null });
      await sendTo('304-555-0100');
      await screen.findByLabelText('6-number code');
      await act(async () => { jest.advanceTimersByTime(61_000); });
      expect(screen.queryByText(/You can ask for a new code in/)).toBeNull();
      expect(screen.getByRole('button', { name: 'Send a new code' }).props.accessibilityState?.disabled ?? false).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('BETA-SMS-4 the right code signs in and opens Photos', async () => {
    const { nav } = await renderApp(<SignInScreen />, { user: null });
    await sendTo('304-555-0100');
    fireEvent.changeText(await screen.findByLabelText('6-number code'), FAKE_OTP);
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(nav.goPhotos).toHaveBeenCalled());
  });
});

describe('BETA-SMS-5 the same words as email for the same problem', () => {
  /** What the code screen says when verifying fails with `err`, through the text or the email flow. */
  async function wordsFor(flow: 'text' | 'email', err: unknown): Promise<string> {
    const { api } = await renderApp(<SignInScreen />, { user: null });
    if (flow === 'text') {
      await sendTo('304-555-0100');
      await screen.findByLabelText('6-number code');
      jest.spyOn(asText(api), 'verifyTextCode').mockRejectedValue(err);
    } else {
      fireEvent.press(await screen.findByRole('button', { name: 'Use email instead' }));
      fireEvent.changeText(await screen.findByLabelText('Your email'), 'jo@example.com');
      fireEvent.press(screen.getByRole('button', { name: 'Send me a code' }));
      await screen.findByLabelText('6-number code');
      jest.spyOn(api, 'verifyCode').mockRejectedValue(err);
    }
    const before = screenWords();
    fireEvent.changeText(screen.getByLabelText('6-number code'), '000000');
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screenWords()).not.toBe(before));
    return screenWords();
  }

  it.each([['too many tries', '54000'], ['no signal', 'NETWORK']] as const)('BETA-SMS-5 %s (%s): text and email say the same thing', async (_what, code) => {
    const shared = messageFor(new ApiError(code)); // the one shared message table
    expect(await wordsFor('email', new ApiError(code))).toContain(shared);
    expect(await wordsFor('text', new ApiError(code))).toContain(shared);
  });

  it('BETA-SMS-5 a wrong code: the email words, with "text" for "email"', async () => {
    const email = messageFor(new ApiError('BAD_OTP'));
    expect(await wordsFor('email', new ApiError('BAD_OTP'))).toContain(email);
    const text = await wordsFor('text', new ApiError('BAD_OTP'));
    expect(text).toContain(email.replace('newest email', 'newest text'));
    expect(text).not.toContain('newest email');
  });
});

describe('BETA-SMS-6 the server refuses texts', () => {
  it('BETA-SMS-6 says so calmly and shows the email field; nothing crashes', async () => {
    const { api } = await renderApp(<SignInScreen />, { user: null });
    await screen.findByLabelText('Your mobile number');
    jest.spyOn(asText(api), 'sendTextCode').mockRejectedValue(new ApiError('SMS_OFF' as never));
    await sendTo('304-555-0100');
    expect(await screen.findByText(TEXTS_OFF)).toBeTruthy();
    expect(screen.getByLabelText('Your email')).toBeTruthy();
    expect(screen.queryByLabelText('6-number code')).toBeNull();
  });
});

describe('BETA-SMS-9 the join screen opens on the way the invite was made', () => {
  async function joinStep(make: Partial<CreateInviteArgs>) {
    const be = FakeBackend.withFixture({ joIsMember: false });
    const { code } = await be.clientFor(FIXTURE.users.chase.id).createInvite({
      space: FIXTURE.space.id, role: 'viewer', circleIds: [FIXTURE.circles.dadSide.id], history: 'all', ...make,
    });
    const r = await renderApp(<JoinScreen code={code} />, { be, user: null });
    fireEvent.press(await screen.findByRole('button', { name: 'See the photos' }));
    return r;
  }

  it('BETA-SMS-9 a phone invite asks for a number, and that number joins', async () => {
    const { nav } = await joinStep({ channel: 'sms', targetPhone: '+13045550100' });
    expect(await screen.findByLabelText('Your mobile number')).toBeTruthy();
    expect(screen.queryByLabelText('Your email')).toBeNull();
    await sendTo('304-555-0100');
    fireEvent.changeText(await screen.findByLabelText('6-number code'), FAKE_OTP);
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(nav.goPhotos).toHaveBeenCalled());
  });

  it('BETA-SMS-9 an email invite asks for an email', async () => {
    await joinStep({ channel: 'email', targetEmail: 'kim@example.com' });
    expect(await screen.findByLabelText('Your email')).toBeTruthy();
    expect(screen.queryByLabelText('Your mobile number')).toBeNull();
  });

  it('BETA-SMS-9 a link invite asks for a number first, with "Use email instead"', async () => {
    await joinStep({});
    expect(await screen.findByLabelText('Your mobile number')).toBeTruthy();
    expect(screen.queryByLabelText('Your email')).toBeNull();
    expect(screen.getByRole('button', { name: 'Use email instead' })).toBeTruthy();
  });
});

describe('BETA-SMS-10 the invite card asks for their mobile number first', () => {
  async function openCard() {
    const r = await renderApp(<GroupsScreen />, { user: 'chase' });
    fireEvent.press(await screen.findByRole('button', { name: "Invite someone to Grandparents – Dad's side" }));
    fireEvent.press(await screen.findByRole('radio', { name: 'Share all past photos' }));
    return { ...r, spy: jest.spyOn(r.api, 'createInvite') };
  }

  it('BETA-SMS-10 "304-555-0100" makes a text invite to +13045550100', async () => {
    const { spy } = await openCard();
    fireEvent.changeText(await screen.findByLabelText('Their mobile number'), '304-555-0100');
    fireEvent.press(screen.getByRole('button', { name: 'Make the invite' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ channel: 'sms', targetPhone: '+13045550100' })));
  });

  it('BETA-SMS-10 "Use email instead" makes today\'s invite, with no phone', async () => {
    const { spy } = await openCard();
    await screen.findByLabelText('Their mobile number');
    fireEvent.press(screen.getByRole('button', { name: 'Use email instead' }));
    expect(screen.queryByLabelText('Their mobile number')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Make the invite' }));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    const args = spy.mock.calls[0]![0];
    expect(args.channel).not.toBe('sms');
    expect(args.targetPhone ?? null).toBeNull();
  });
});

describe('BETA-SMS-11 an existing email account still gets in', () => {
  it('BETA-SMS-11 "Use email instead" signs Grandma Jo in to her own account and family', async () => {
    const { be, nav } = await renderApp(<SignInScreen />, { user: null });
    fireEvent.press(await screen.findByRole('button', { name: 'Use email instead' }));
    fireEvent.changeText(await screen.findByLabelText('Your email'), 'jo@example.com');
    fireEvent.press(screen.getByRole('button', { name: 'Send me a code' }));
    fireEvent.changeText(await screen.findByLabelText('6-number code'), FAKE_OTP);
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(nav.goPhotos).toHaveBeenCalled());
    expect(be.state.appSession).toBe(FIXTURE.users.jo.id);
  });
});

describe('BETA-SMS-12 a phone account with no family is not stranded', () => {
  it('BETA-SMS-12 "Signed in with email before? Use email instead" sits below the code entry, signs out and opens email', async () => {
    const be = FakeBackend.withFixture();
    const id = await phoneAccount(be);
    const { nav } = await renderApp(<AppGate />, { be, userId: id, waitReady: false });
    expect(await screen.findByText(/Signed in with email before\?/)).toBeTruthy();
    const words = screenWords();
    expect(words.indexOf('Signed in with email before?')).toBeGreaterThan(words.indexOf('Type the invite code'));
    expectGrandparentSafe();
    fireEvent.press(screen.getByRole('button', { name: 'Use email instead' }));
    await waitFor(() => expect(be.state.appSession).toBeNull());
    expect(nav.goSignIn).toHaveBeenCalled();
    expect(JSON.stringify(nav.goSignIn.mock.calls)).toMatch(/email/i); // opens the email field, not the number
  });

  it('BETA-SMS-12 an email account with no family does not see it', async () => {
    const be = FakeBackend.withFixture({ joIsMember: false });
    await renderApp(<AppGate />, { be, user: 'jo', waitReady: false });
    expect(await screen.findByLabelText('Invite code')).toBeTruthy();
    expect(screen.queryByText(/Signed in with email before\?/)).toBeNull();
  });
});

describe('BETA-SMS-14 phone-only accounts hear about photos on the phone, not by email', () => {
  it('BETA-SMS-14 Help has no email choices and says why', async () => {
    const be = FakeBackend.withFixture();
    const id = await phoneMember(be);
    await renderApp(<HelpScreen />, { be, userId: id });
    expect(await screen.findByText(PHONE_HELP)).toBeTruthy();
    for (const c of EMAIL_CHOICES) expect(screen.queryByRole('radio', { name: c })).toBeNull();
  });

  it('BETA-SMS-14 the notice choices (Preferences) hide the email switch', async () => {
    const be = FakeBackend.withFixture();
    const id = await phoneMember(be);
    await renderApp(<HowToTell />, { be, userId: id });
    await screen.findByText('How should we tell you about new photos?');
    for (const c of EMAIL_CHOICES) expect(screen.queryByRole('radio', { name: c })).toBeNull();
  });

  it('BETA-SMS-14 an email account still has the email choices and no phone line', async () => {
    await renderApp(<HelpScreen />, { user: 'jo' });
    for (const c of EMAIL_CHOICES) expect(await screen.findByRole('radio', { name: c })).toBeTruthy();
    expect(screen.queryByText(PHONE_HELP)).toBeNull();
  });
});
