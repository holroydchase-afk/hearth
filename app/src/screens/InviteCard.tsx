// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// The invite card's shared parts: Groups (GRP-18) and Start a family's "Invite your first person" (SPEC-START-FAMILY 3.4).
import React from 'react';
import { Platform } from 'react-native';
import type { ShareHistory } from '../api/HearthApi';
import { Button, Card, Choice, Txt } from '../ui/kit';

/** grandparent-ux: name the sender (an unsaved number or an email reads like a scam), and offer a call, not an app store trip. */
export function inviteSmsUrl(myName: string | null, link: string, code: string): string {
  const hi = myName ? `Hi, it's ${myName}.` : 'Hi, this is your family.';
  const body = `${hi} I set up a private place for the kids' photos. Tap this to see them, no password: ${link}\n\nIf that doesn't open, call me and I'll help. Your code is ${code.slice(0, 5)} ${code.slice(5)}.`;
  const sep = Platform.OS === 'ios' ? '&' : '?';
  return `sms:${sep}body=${encodeURIComponent(body)}`;
}

/** The made invite: the link, the code to read out loud (BETA-JOIN-8), and a button to text it. */
export function InviteReady({ link, code, onText }: { link: string; code: string; onText: () => void }) {
  return (
    <Card>
      <Txt variant="strong">Invite ready</Txt>
      <Txt selectable>{link}</Txt>
      <Txt selectable>{`Or they can type this code in Hearth: ${code.slice(0, 5)} ${code.slice(5)}`}</Txt>
      <Txt>Works for 30 days.</Txt>
      <Button label="Text the invite" onPress={onText} />
    </Card>
  );
}

/** BETA-AUD-19: "Share all past photos" or "Only new photos"; neither is picked until the parent picks one. */
export function PastPhotosChoice({ history, onPick, allDetail, need }: {
  history: ShareHistory | null; onPick: (h: ShareHistory) => void; allDetail: string; need: boolean;
}) {
  return (
    <>
      <Txt variant="title" role="header">Should they see photos already shared?</Txt>
      <Choice kind="radio" label="Share all past photos" title="Share all past photos" detail={allDetail} checked={history === 'all'} onPress={() => onPick('all')} />
      <Choice
        kind="radio"
        label="Only new photos"
        title="Only new photos"
        detail="They'll see photos shared from today on, including older photos you add later."
        checked={history === 'new'}
        onPress={() => onPick('new')}
      />
      {need ? <Txt variant="strong">Pick one above first.</Txt> : null}
    </>
  );
}
