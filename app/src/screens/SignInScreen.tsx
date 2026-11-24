// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import React, { useRef, useState } from 'react';
import type { SignInWith } from '../api/HearthApi';
import { textsOn } from '../api/phone';
import { useApp } from '../state/AppContext';
import { useNav } from '../state/nav';
import { Card, Screen, Txt } from '../ui/kit';
import { DataQuestion } from './DataQuestion';
import { SignInFlow } from './SignInFlow';

/** `start`: 'email' opens on the email field (BETA-SMS-12's "Use email instead"). */
export function SignInScreen({ start }: { start?: SignInWith } = {}) {
  const app = useApp();
  const nav = useNav();
  // DATA-1 (DEC-86): a first sign-in on a phone never asked about its data plan asks once, before Gallery.
  const [ask, setAsk] = useState(false);
  const asked = useRef(app.dataPrefs.saveData !== null);
  asked.current = app.dataPrefs.saveData !== null;
  if (ask) return <DataQuestion onDone={nav.goPhotos} />;
  return (
    <Screen>
      <Txt variant="display" role="header">Welcome to Hearth</Txt>
      <Txt>{textsOn()
        ? "Private photos of the family. We'll send you a 6-number code. No password."
        : "Private photos of the family. Type your email. We'll send you a 6-number code. No password."}</Txt>
      <Card>
        <SignInFlow start={start} onSignedIn={async () => { await app.reload(); if (asked.current) nav.goPhotos(); else setAsk(true); }} />
      </Card>
    </Screen>
  );
}
