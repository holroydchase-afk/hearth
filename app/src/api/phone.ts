// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Text message sign-in (SPEC-SMS-SIGN-IN 3.3, BETA-SMS-3/-15): US numbers only, kept as E.164 (+1XXXXXXXXXX).
// Same rule as private.us_e164 (migration 0026). A phone number is personal data: never log one.
import type { Session } from './types';

/** "(304) 555-0100", "304.555.0100", "1 304 555 0100", "+1 304 555 0100"… → "+13045550100"; anything else → null. */
export function usE164(typed: string): string | null {
  const t = typed.trim();
  if (!/^\+?[0-9 ().-]+$/.test(t)) return null;
  let d = t.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  else if (t.includes('+')) return null; // a '+' must be +1
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? `+1${d}` : null;
}

/** The last 4 digits, the only part of a number shown after it is typed (BETA-SMS-4). */
export const last4 = (e164: string): string => e164.replace(/\D/g, '').slice(-4);

/** A US-looking number anywhere in a piece of text. */
const PHONE_IN_TEXT = /(\+?1[\s().-]{0,2})?\(?\d{3}\)?[\s.-]{0,2}\d{3}[\s.-]?\d{4}/g;

/** BETA-SMS-15: every number in the text becomes "[phone]". */
export const scrubPhone = (s: string): string => s.replace(PHONE_IN_TEXT, '[phone]');
export const hasPhone = (s: string): boolean => new RegExp(PHONE_IN_TEXT.source).test(s);

/** A phone-only account (signed in with a text; no email): push notices only (BETA-SMS-14). */
export const isPhoneOnly = (s: Session | null | undefined): boolean => !!s && !s.email;

/** The text sign-in build flag (SPEC-SMS-SIGN-IN 3.1). Read when asked, so a test can switch it. Ships off. */
export const textsOn = (): boolean => process.env.EXPO_PUBLIC_HEARTH_SMS === '1';
