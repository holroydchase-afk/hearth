// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Help (UX-REVIEW #11-#15): Call Chase first. RD-15: a row in More for everyone. GUX-R10: Bigger text and Light or
// dark are More's own rows, so Help doesn't repeat them.
import React from 'react';
import { DEMO_MODE } from '../demo/flags';
import { useApp } from '../state/AppContext';
import { BackButton, Button, GroupedSection, Screen, Txt } from '../ui/kit';
import { AppGate } from './AppGate';
import { ProblemDetailsCard } from './ProblemDetails';
import { DeleteAccount, HowToTell, Privacy, SignOut } from './Preferences';

export function HelpScreen({ onBack }: { onBack?: () => void } = {}) {
  const app = useApp();
  if (app.status !== 'ready') return <AppGate />;
  const who = app.helper;
  const phone = app.deps.helpPhone?.replace(/[^+\d]/g, '') || null;
  return (
    <Screen>
      {onBack ? <BackButton to="More" onPress={onBack} /> : null}
      <Txt variant="title1" role="header">Help</Txt>
      {/* GUX-R10: name the person who invited her, and show the number too. The owner set the family up, so no
          "ask someone" line for him. Bigger text and Light or dark live in More now, not here. */}
      {app.space?.role === 'owner' ? null : (
        <GroupedSection>
          <Txt variant="title2">Need help?</Txt>
          {who && phone ? (
            <>
              <Txt>{`${who} can help. Their number is ${app.deps.helpPhone}.`}</Txt>
              <Button variant="quiet" label={`Call ${who}`} icon={{ sf: 'phone', md: 'call' }} onPress={() => void app.deps.openUrl(`tel:${phone}`)} style={{ alignSelf: 'flex-start' }} />
            </>
          ) : (
            <Txt>{`Ask ${who ?? 'the person who invited you'} for help.`}</Txt>
          )}
        </GroupedSection>
      )}
      <HowToTell />
      <Privacy who={who} />
      <ProblemDetailsCard />
      {/* TD-UX-R5: like Me (DEMO-8), the no-login demo has no way back in after signing out. */}
      {DEMO_MODE ? null : (
        <>
          <SignOut />
          <DeleteAccount />
        </>
      )}
    </Screen>
  );
}
