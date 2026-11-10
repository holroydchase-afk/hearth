// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Sign-in by text or email (SPEC-SMS-SIGN-IN 3.1-3.2). Texts off (the build flag, ships off): today's email flow,
// unchanged (BETA-SMS-1). Texts on: the mobile number first, "Use email instead" one tap away.
import React, { useState } from 'react';
import type { SignInWith } from '../api/HearthApi';
import { textsOn } from '../api/phone';
import { Notice } from '../ui/kit';
import { EmailCodeFlow } from './EmailCodeFlow';
import { TextCodeFlow } from './TextCodeFlow';

export function SignInFlow({ onSignedIn, inviter, start = 'either' }: {
  /** The email it signed in with, or null for a text sign-in. */
  onSignedIn: (email: string | null) => Promise<void>;
  inviter?: string | null;
  /** 'email' opens on the email field; 'phone' and 'either' on the number. */
  start?: SignInWith;
}) {
  const [mode, setMode] = useState<'phone' | 'email'>(start === 'email' ? 'email' : 'phone');
  const [note, setNote] = useState<string | null>(null);
  if (!textsOn()) return <EmailCodeFlow inviter={inviter} onSignedIn={onSignedIn} />;
  if (mode === 'phone') {
    return <TextCodeFlow inviter={inviter} onSignedIn={() => onSignedIn(null)} onUseEmail={(why) => { setNote(why ?? null); setMode('email'); }} />;
  }
  return (
    <>
      {note ? <Notice text={note} /> : null}
      <EmailCodeFlow inviter={inviter} onSignedIn={onSignedIn} onUseText={() => { setNote(null); setMode('phone'); }} />
    </>
  );
}
