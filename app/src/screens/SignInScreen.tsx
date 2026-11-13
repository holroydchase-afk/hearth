// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import React from 'react';
import type { SignInWith } from '../api/HearthApi';
import { textsOn } from '../api/phone';
import { useApp } from '../state/AppContext';
import { useNav } from '../state/nav';
import { Card, Screen, Txt } from '../ui/kit';
import { SignInFlow } from './SignInFlow';

/** `start`: 'email' opens on the email field (BETA-SMS-12's "Use email instead"). */
export function SignInScreen({ start }: { start?: SignInWith } = {}) {
  const app = useApp();
  const nav = useNav();
  return (
    <Screen>
      <Txt variant="display" role="header">Welcome to Hearth</Txt>
      <Txt>{textsOn()
        ? "Private photos of the family. We'll send you a 6-number code. No password."
        : "Private photos of the family. Type your email. We'll send you a 6-number code. No password."}</Txt>
      <Card>
        <SignInFlow start={start} onSignedIn={async () => { await app.reload(); nav.goPhotos(); }} />
      </Card>
    </Screen>
  );
}
