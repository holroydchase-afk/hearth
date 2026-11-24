// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Invite link → "Chase invited you" → email → code → Photos (BETA-JOIN-1/-3, UX-REVIEW #16/#17).
import React, { useEffect, useRef, useState } from 'react';
import { isApiError, type InvitePreview } from '../api/HearthApi';
import { textsOn } from '../api/phone';
import { messageFor } from '../errors/messages';
import { useApp } from '../state/AppContext';
import { useNav } from '../state/nav';
import { Button, Card, Loading, Screen, Txt } from '../ui/kit';
import { DataQuestion } from './DataQuestion';
import { SignInFlow } from './SignInFlow';

type Step = 'checking' | 'preview' | 'signin' | 'joining' | 'bad' | 'askData';

export function JoinScreen({ code }: { code: string }) {
  const app = useApp();
  const nav = useNav();
  const [step, setStep] = useState<Step>('checking');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [triedEmail, setTriedEmail] = useState<string | null>(null);
  // TS-GUX-R6: the last 4 digits of the number a phone invite didn't open for (never the full number).
  const [triedNumber, setTriedNumber] = useState<string | null>(null);
  const started = useRef(false);
  // DATA-1 (DEC-87): a phone never asked about its data plan asks once, before Gallery.
  const asked = useRef(app.dataPrefs.saveData !== null);
  asked.current = app.dataPrefs.saveData !== null;
  const opened = () => (asked.current ? nav.goPhotos() : setStep('askData'));
  // HARD-10: with no signal nothing retries on its own, so say so and offer Try again.
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const offline = (e: unknown, again: () => void) => {
    if (!isApiError(e) || e.code !== 'NETWORK') return false;
    setMsg('No internet right now. When you have signal, tap Try again.');
    setRetry(() => again);
    setStep('bad');
    return true;
  };

  const inviterOf = (c: string): Promise<string | null> =>
    app.deps.api.invitePreview(c).then((p) => p.inviter_name || null, (e: unknown) => (isApiError(e) ? e.inviter ?? null : null));

  const redeem = async (inviter: string | null, email: string | null = null, numberEnding: string | null = null) => {
    setStep('joining');
    setRetry(null);
    try {
      await app.deps.api.redeemInvite(code);
      await app.reload();
      opened();
    } catch (e) {
      if (offline(e, () => void redeem(inviter, email, numberEnding))) return;
      // Already in the family (tapped the link twice): just show the photos.
      const spaces = await app.deps.api.mySpaces().catch(() => []);
      if (isApiError(e) && e.code === '22023' && spaces.length > 0) {
        await app.reload();
        opened();
        return;
      }
      // UX-G8: signed in, she never saw the preview; ask it for the inviter's name (redeem's answer can't say:
      // BETA-JOIN-3 keeps it identical for every bad invite).
      const who = inviter ?? (isApiError(e) && e.code === '22023' ? await inviterOf(code) : null);
      setMsg(messageFor(e, { inviter: who, action: 'join' }));
      // BETA-JOIN-3 keeps "wrong email" and "old invite" identical on the server, so say both here.
      setTriedEmail(isApiError(e) && e.code === '22023' ? email : null);
      setTriedNumber(isApiError(e) && e.code === '22023' && !email ? numberEnding : null);
      setStep('bad');
    }
  };

  useEffect(() => {
    if (app.status === 'loading' || started.current) return;
    started.current = true;
    if (app.session) {
      void redeem(null);
      return;
    }
    check();
  }, [app.status]); // eslint-disable-line react-hooks/exhaustive-deps

  function check() {
    setStep('checking');
    setRetry(null);
    app.deps.api.invitePreview(code)
      .then((p) => { setPreview(p); setStep('preview'); })
      .catch((e) => {
        if (offline(e, check)) return;
        setMsg(messageFor(e, { action: 'join', inviter: isApiError(e) ? e.inviter : null }));
        setStep('bad');
      });
  }

  const who = preview?.inviter_name ?? null;
  if (step === 'askData') return <DataQuestion onDone={nav.goPhotos} />;

  return (
    <Screen>
      <Txt variant="title1" role="header">Hearth</Txt>
      {step === 'checking' || step === 'joining' ? <Loading words={step === 'checking' ? 'Checking your invite…' : 'Opening the photos…'} /> : null}
      {step === 'preview' && preview ? (
        <Card>
          <Txt variant="title2">{`${preview.inviter_name} invited you to see the family photos.`}</Txt>
          <Txt>No password. Free.</Txt>
          <Button label="See the photos" onPress={() => setStep('signin')} />
        </Card>
      ) : null}
      {step === 'signin' ? (
        <Card>
          <Txt variant="title2">{`Photos from ${who ?? 'your family'}`}</Txt>
          <Txt>{textsOn() ? "We'll send you a 6-number code." : "Type your email. We'll send you a 6-number code."}</Txt>
          {/* BETA-SMS-9: ask the way the invite was made (texts on); texts off, today's email flow */}
          <SignInFlow inviter={who} start={preview?.sign_in_with ?? 'either'} only onSignedIn={(email, end) => redeem(who, email, end ?? null)} />
        </Card>
      ) : null}
      {step === 'bad' && triedEmail ? (
        <Card>
          <Txt variant="title2">{`This invite didn't open for ${triedEmail}.`}</Txt>
          <Txt>{`It may be old or already used, or ${who ?? 'your family'} sent it to a different email. Try that email, or ask ${who ?? 'the person who invited you'} for a new invite.`}</Txt>
          <Button label="Try a different email" onPress={() => { void app.signOut().then(() => { setTriedEmail(null); setStep('signin'); }); }} />
        </Card>
      ) : null}
      {step === 'bad' && triedNumber ? (
        <Card>
          <Txt variant="title2">{`This invite didn't open for the number ending in ${triedNumber}.`}</Txt>
          <Txt>{`It may be old or already used, or ${who ?? 'your family'} sent it to a different number. Try your other number, or ask ${who ?? 'the person who invited you'} for a new invite.`}</Txt>
          <Button label="Try a different number" onPress={() => { void app.signOut().then(() => { setTriedNumber(null); setStep('signin'); }); }} />
        </Card>
      ) : null}
      {step === 'bad' && msg && !triedEmail && !triedNumber ? (
        <Card>
          <Txt variant="title2">{msg}</Txt>
          {retry ? <Button label="Try again" onPress={retry} /> : <Txt>That's okay, it happens.</Txt>}
          {/* UX-G9: signed in, she still needs a way on (Photos; with no family yet it offers the code entry). */}
          {retry ? null : app.session ? <Button label="Go to Gallery" onPress={nav.goPhotos} /> : <Button label="I already have Hearth. Sign in." text="Sign in" variant="secondary" onPress={() => nav.goSignIn()} />}
        </Card>
      ) : null}
    </Screen>
  );
}
