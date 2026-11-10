// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import { ApiError, isRetryable } from '../../api/HearthApi';
import { messageFor, toApiError } from '../messages';

describe('plain-language error mapping (API.md error table)', () => {
  it.each([
    ['42501', "You can't do that here."],
    ['P0002', 'This was removed.'],
    ['54000', 'Too many tries. Wait 10 minutes.'],
  ] as const)('%s → %s', (code, text) => {
    expect(messageFor(new ApiError(code))).toBe(text);
  });

  it('22023 names the inviter (BETA-JOIN-3)', () => {
    expect(messageFor(new ApiError('22023'), { inviter: 'Chase' })).toBe(
      'This invite is too old or already used. Ask Chase for a new one.',
    );
  });

  it('22023 without a known inviter still tells her what to do', () => {
    expect(messageFor(new ApiError('22023'))).toBe(
      'This invite is too old or already used. Ask the person who invited you for a new one.',
    );
  });

  it('23514 gives the plain message for the action, never the SQL text', () => {
    const e = new ApiError('23514', 'invite must place the person in at least one circle');
    expect(messageFor(e, { action: 'post' })).toBe('Pick who should see it.');
    expect(messageFor(e, { action: 'comment' })).toBe('Write something first, then tap Send.');
    expect(messageFor(e)).not.toMatch(/circle|invite must/);
  });

  it('wrong sign-in code is plain and says what to do', () => {
    expect(messageFor(new ApiError('BAD_OTP'))).toBe(
      "That code didn't work. Check the newest email from Hearth and type the 6 numbers again.",
    );
  });

  it('no connection is calm', () => {
    expect(messageFor(new ApiError('NETWORK'))).toBe("No internet right now. We'll keep trying.");
  });

  it('long video', () => {
    expect(messageFor(new ApiError('VIDEO_TOO_LONG'))).toBe(
      'This video is longer than 1 minute. Please pick a shorter one.',
    );
  });

  it('unknown errors never leak internals and name who to call', () => {
    const msg = messageFor(new Error('relation "posts" does not exist at character 14'), { inviter: 'Chase' });
    expect(msg).toBe('Something went wrong. Try again, or call Chase.');
  });

  it('never uses words June does not use', () => {
    const codes = ['23514', '42501', 'P0002', '22023', '54000', 'BAD_OTP', 'NETWORK', 'EXIF', 'VIDEO_CAP', 'VIDEO_TOO_LONG', 'AUTH', 'UNKNOWN'] as const;
    for (const c of codes) {
      expect(messageFor(new ApiError(c), { inviter: 'Chase' })).not.toMatch(
        /\b(feed|circles?|audience|sync|upload|account|settings|expired|error|server|exception)\b/i,
      );
    }
  });
});

describe('toApiError normalizes transport errors', () => {
  it('keeps PostgREST codes', () => {
    expect(toApiError({ code: 'P0002', message: 'not found' }).code).toBe('P0002');
    expect(toApiError({ code: '22023', message: 'bad' }).code).toBe('22023');
  });
  it('treats fetch failures as NETWORK', () => {
    expect(toApiError(new TypeError('Network request failed')).code).toBe('NETWORK');
    expect(toApiError({ message: 'TypeError: Failed to fetch', code: '' }).code).toBe('NETWORK');
  });
  it('maps JWT problems to AUTH', () => {
    expect(toApiError({ code: 'PGRST301', message: 'JWT expired' }).code).toBe('AUTH');
  });
  it('passes ApiError through', () => {
    const e = new ApiError('42501');
    expect(toApiError(e)).toBe(e);
  });
  it('anything else is UNKNOWN', () => {
    expect(toApiError({ code: 'XX000', message: 'boom' }).code).toBe('UNKNOWN');
    expect(toApiError('weird').code).toBe('UNKNOWN');
  });
});

describe('Start a family words (0024, BETA-START)', () => {
  it('BETA-START-12 HF001 becomes FAMILY_FULL and is not retried (the upload queue stops on it)', () => {
    const e = toApiError({ code: 'HF001', message: 'family_full' });
    expect(e.code).toBe('FAMILY_FULL');
    expect(isRetryable(e)).toBe(false);
  });

  it('BETA-START-12 FAMILY_FULL is calm and plain, with no names', () => {
    const m = messageFor(new ApiError('FAMILY_FULL' as never), { inviter: 'Chase' });
    expect(m).toMatch(/^Your family is full for now/);
    expect(m).not.toMatch(/Chase|HF001|family_full|GB|500/);
  });

  it('BETA-START-11 too many starts: plain words, no names, not the 10-minute sign-in message', () => {
    const m = messageFor(new ApiError('54000', 'rate limited'), { action: 'start' as never, inviter: 'Chase' });
    expect(m).toBe("You've started 3 families today. Try again tomorrow.");
  });

  it('GUX-R3 FAMILY_FULL says what stopped, that shared photos are safe, and where to ask', () => {
    expect(messageFor(new ApiError('FAMILY_FULL' as never), { inviter: 'Chase' })).toBe(
      "Your family is full for now, so new photos can't be sent. Photos already shared are safe. Tap Help to ask for more room.",
    );
  });

  it('GUX-R4 23514 while starting a family names only the family name (Just Everyone has no side names)', () => {
    expect(messageFor(new ApiError('23514', 'name check'), { action: 'start' })).toBe('Check the family name, then try again.');
  });

  // GUX-R1/R2 (search words pass, Nov 10): search errors never talk about invites or promise a retry that won't happen.
  it('GUX-R1 too many search words (22023) says so, not "this invite is too old"', () => {
    expect(messageFor(new ApiError('22023'), { action: 'search' })).toBe("That's a lot of words. Try one or two, like birthday.");
  });
  it('GUX-R2 no internet during a search says to tap Search again', () => {
    expect(messageFor(new ApiError('NETWORK'), { action: 'search' })).toBe('No internet right now. Check your Wi-Fi, then tap Search again.');
  });
});
