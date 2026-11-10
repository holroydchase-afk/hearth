// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// BETA-SMS (SPEC-SMS-SIGN-IN section 4): the Fake grows sendTextCode / verifyTextCode with the same fixed test code
// as email, phone invites, and invite_preview's sign_in_with. Written first: red until the Fake has them.
import { ApiError, type HearthApi } from '../HearthApi';
import { FAKE_OTP, FIXTURE, FakeBackend } from '../fake/FakeBackend';
import type { InvitePreview, Session } from '../types';

/** The methods the spec adds to HearthApi (cast so this file stays type-clean until they exist). */
type TextApi = { sendTextCode(phone: string): Promise<void>; verifyTextCode(phone: string, code: string): Promise<Session> };
const asText = (api: HearthApi) => api as unknown as TextApi;
type Preview = InvitePreview & { sign_in_with?: string };

async function codeOf(p: Promise<unknown>): Promise<string> {
  try { await p; return 'ok'; } catch (e) { return e instanceof ApiError ? e.code : `non-ApiError: ${String(e)}`; }
}

describe('Fake text sign-in (BETA-SMS)', () => {
  it('BETA-SMS-2 sendTextCode takes an E.164 US number; verifyTextCode with the fixed test code signs in', async () => {
    const be = FakeBackend.withFixture();
    const api = asText(be.clientFor(null));
    await expect(api.sendTextCode('+13045550100')).resolves.toBeUndefined();
    const s = await api.verifyTextCode('+13045550100', FAKE_OTP);
    expect(s.userId).toEqual(expect.any(String));
    // The same number again is the same account.
    const again = await asText(be.clientFor(null)).verifyTextCode('+13045550100', FAKE_OTP);
    expect(again.userId).toBe(s.userId);
  });

  it('BETA-SMS-5 a wrong text code is BAD_OTP, like email', async () => {
    const be = FakeBackend.withFixture();
    expect(await codeOf(asText(be.clientFor(null)).verifyTextCode('+13045550100', '000000'))).toBe('BAD_OTP');
    expect(await codeOf(be.clientFor(null).verifyCode('jo@example.com', '000000'))).toBe('BAD_OTP');
  });

  it('BETA-SMS-11 a phone sign-in and an email sign-in are two accounts; the email account keeps its family', async () => {
    const be = FakeBackend.withFixture();
    const phone = await asText(be.clientFor(null)).verifyTextCode('+13045550100', FAKE_OTP);
    const email = await be.clientFor(null).verifyCode(FIXTURE.users.jo.email, FAKE_OTP);
    expect(email.userId).toBe(FIXTURE.users.jo.id);
    expect(phone.userId).not.toBe(FIXTURE.users.jo.id);
    expect((await be.clientFor(email.userId).mySpaces()).map((s) => s.space_id)).toContain(FIXTURE.space.id);
    expect(await be.clientFor(phone.userId).mySpaces()).toEqual([]);
  });

  it('BETA-SMS-9 invite_preview says sign_in_with phone, email or either, and never the target', async () => {
    const be = FakeBackend.withFixture();
    const chase = be.clientFor(FIXTURE.users.chase.id);
    const base = { space: FIXTURE.space.id, role: 'viewer' as const, circleIds: [FIXTURE.circles.dadSide.id], history: 'all' as const };
    const phone = await chase.createInvite({ ...base, channel: 'sms', targetPhone: '+13045550100' });
    const email = await chase.createInvite({ ...base, channel: 'email', targetEmail: 'kim@example.com' });
    const link = await chase.createInvite(base);
    const anon = be.clientFor(null);
    const p = (await anon.invitePreview(phone.code)) as Preview;
    expect(p.sign_in_with).toBe('phone');
    expect(((await anon.invitePreview(email.code)) as Preview).sign_in_with).toBe('email');
    expect(((await anon.invitePreview(link.code)) as Preview).sign_in_with).toBe('either');
    expect(JSON.stringify(p)).not.toMatch(/3045550100|0100|kim@/);
  });

  it('BETA-SMS-8 a phone invite opens only for that number; another number or an email account gets 22023', async () => {
    const be = FakeBackend.withFixture({ joIsMember: false });
    const chase = be.clientFor(FIXTURE.users.chase.id);
    const { code } = await chase.createInvite({ space: FIXTURE.space.id, role: 'viewer', circleIds: [FIXTURE.circles.dadSide.id], history: 'all', channel: 'sms', targetPhone: '+13045550100' });
    const other = await asText(be.clientFor(null)).verifyTextCode('+13045550199', FAKE_OTP);
    expect(await codeOf(be.clientFor(other.userId).redeemInvite(code))).toBe('22023');
    expect(await codeOf(be.clientFor(FIXTURE.users.jo.id).redeemInvite(code))).toBe('22023');
    const gammy = await asText(be.clientFor(null)).verifyTextCode('+13045550100', FAKE_OTP);
    expect(await be.clientFor(gammy.userId).redeemInvite(code)).toBe(FIXTURE.space.id);
  });
});
