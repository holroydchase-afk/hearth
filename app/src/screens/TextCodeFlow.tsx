// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Mobile number → 6-number code by text (SPEC-SMS-SIGN-IN 3.2-3.4, BETA-SMS-2..6). Same rules as EmailCodeFlow.
// After step 1 only the last 4 digits are shown. The number is never logged.
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { isApiError } from '../api/HearthApi';
import { last4, usE164 } from '../api/phone';
import { messageFor } from '../errors/messages';
import { useApp } from '../state/AppContext';
import { Button, Field, Notice, Txt } from '../ui/kit';

export const BAD_NUMBER = 'Please type a US mobile number, like 304-555-0100.';

export function TextCodeFlow({ onSignedIn, onUseEmail, inviter }: {
  onSignedIn: () => Promise<void>;
  /** Switch to email; `note` says why (texts not working, BETA-SMS-6). Absent: a phone invite that only a number
   *  can open (GUX-R1), so no "Use email instead" and texts-off says who to ask. */
  onUseEmail?: (note?: string) => void;
  inviter?: string | null;
}) {
  const { deps } = useApp();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [typed, setTyped] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null); // E.164
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // A minute between codes (config.toml max_frequency = 60s), said in words.
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (waitUntil <= Date.now()) return;
    const t = setInterval(() => { const n = Date.now(); setNow(n); if (n >= waitUntil) clearInterval(t); }, 1000);
    return () => clearInterval(t);
  }, [waitUntil]);
  const waitLeft = Math.max(0, Math.ceil((waitUntil - now) / 1000));

  const send = async (phone: string | null) => {
    setMsg(null);
    if (!phone) { setMsg(BAD_NUMBER); return; }
    setBusy(true);
    try {
      await deps.api.sendTextCode(phone);
      setSentTo(phone);
      setStep('code');
      setCode('');
      setNow(Date.now());
      setWaitUntil(Date.now() + 60_000);
    } catch (e) {
      if (isApiError(e) && e.code === 'SMS_OFF') {
        if (onUseEmail) { onUseEmail(messageFor(e)); return; }
        setMsg(`Texts aren't working right now. Ask ${inviter ?? 'the person who invited you'} to send you a new invite by email.`);
        return;
      }
      setMsg(isApiError(e) && e.code === '23514' ? BAD_NUMBER : messageFor(e, { inviter, via: 'text' }));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!sentTo) return;
    setBusy(true);
    setMsg(null);
    try {
      await deps.api.verifyTextCode(sentTo, code.replace(/\D/g, ''));
      await onSignedIn();
    } catch (e) {
      setMsg(messageFor(e, { inviter, via: 'text' }));
    } finally {
      setBusy(false);
    }
  };

  const typedE164 = usE164(typed);
  const mustWait = waitLeft > 0 && sentTo !== null && sentTo === typedE164;

  if (step === 'phone') {
    return (
      <>
        <Field label="Your mobile number" value={typed} onChangeText={setTyped} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="304-555-0100" maxLength={20} />
        {msg ? <Notice text={msg} /> : null}
        <Button label="Send me a code" busy={busy} disabled={!/\d/.test(typed) || mustWait} onPress={() => void send(typedE164)} />
        {mustWait ? <Txt variant="muted">{`You can ask for a new code in ${waitLeft} seconds.`}</Txt> : null}
        {onUseEmail ? <Button label="Use email instead" variant="secondary" onPress={() => onUseEmail()} /> : null}
      </>
    );
  }
  return (
    <>
      <Txt>{`We texted a 6-number code to the number ending in ${last4(sentTo ?? '')}. Type it here.`}</Txt>
      {/* Digits only: a pasted "123 456" or "123-456" must not get cut to "123 45". */}
      <Field label="6-number code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={12} autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'} textContentType="oneTimeCode" style={{ letterSpacing: 6 }} />
      {msg ? <Notice text={msg} /> : null}
      <Button label="Continue" busy={busy} disabled={code.replace(/\D/g, '').length !== 6} onPress={() => void verify()} />
      <Txt variant="muted">It can take a minute.</Txt>
      {waitLeft > 0 ? <Txt variant="muted">{`You can ask for a new code in ${waitLeft} seconds.`}</Txt> : null}
      <Button label="Send a new code" variant="secondary" disabled={waitLeft > 0} onPress={() => void send(sentTo)} />
      <Button label="Use a different number" variant="quiet" onPress={() => { setStep('phone'); setMsg(null); }} />
    </>
  );
}
