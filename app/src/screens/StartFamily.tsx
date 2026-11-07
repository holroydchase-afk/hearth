// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Start a family (DEC-55, SPEC-START-FAMILY section 3): "Did someone send you a code?", Name your family,
// Who's in it, Invite your first person. Nothing is made until "Start the family". Joining stays invite-only.
import React, { useEffect, useRef, useState } from 'react';
import type { Role, ShareHistory } from '../api/HearthApi';
import { uuid } from '../crypto/random';
import { messageFor } from '../errors/messages';
import { useApp } from '../state/AppContext';
import { useNav } from '../state/nav';
import { Button, Card, Choice, Field, Notice, Screen, Txt } from '../ui/kit';
import { InviteReady, inviteSmsUrl, PastPhotosChoice } from './InviteCard';

const MAX_NAME = 60;
type Step = 'ask' | 'name' | 'who' | 'invite';

/** The steps after "I'm a parent: start a family". onUseCode goes back to the code entry. */
export function StartFamily({ onUseCode }: { onUseCode: () => void }) {
  const app = useApp();
  const nav = useNav();
  const [step, setStep] = useState<Step>('ask');
  const [name, setName] = useState('');
  const [twoSides, setTwoSides] = useState(false);
  const [sides, setSides] = useState<[string, string]>(["Dad's side", "Mom's side"]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [space, setSpace] = useState<string | null>(null);
  // One id per family being started: a retry after a lost signal returns the same family, never a second (API.md).
  const clientId = useRef(uuid());

  const finish = async () => {
    await app.reload();
    nav.goPhotos();
  };

  if (step === 'ask') {
    return (
      <Screen>
        <Card>
          <Txt variant="title" role="header">Did someone send you a code?</Txt>
          <Txt>If a relative invited you, use their code instead.</Txt>
          <Button label="Use a code" onPress={onUseCode} />
          <Button label="Start a new family" variant="secondary" onPress={() => setStep('name')} />
        </Card>
      </Screen>
    );
  }

  if (step === 'name') {
    const n = name.trim();
    const ok = n.length >= 1 && n.length <= MAX_NAME;
    return (
      <Screen>
        <Card>
          <Txt variant="title" role="header">Name your family</Txt>
          <Field label="Family name" value={name} onChangeText={setName} placeholder='Like "Our kids"' autoCapitalize="words" />
          {n.length > MAX_NAME ? <Txt variant="strong">{`Use ${MAX_NAME} letters or fewer.`}</Txt> : null}
          <Txt variant="muted">Only people you invite will see it.</Txt>
          <Txt>Hearth is for parents and guardians 18 or older.</Txt>
          <Button label="Next" onPress={() => setStep('who')} disabled={!ok} />
          <Button label="Back" variant="secondary" onPress={() => setStep('ask')} />
        </Card>
      </Screen>
    );
  }

  if (step === 'who') {
    const s = sides.map((x) => x.trim());
    const sidesOk = !twoSides || (s.every((x) => x.length >= 1 && x.length <= MAX_NAME) && s[0] !== s[1]);
    const start = async () => {
      if (busy || !sidesOk) return;
      setBusy(true);
      setNotice(null);
      try {
        const id = await app.deps.api.startFamily({ clientId: clientId.current, name: name.trim(), sides: twoSides ? [s[0]!, s[1]!] : [] });
        setSpace(id);
        setStep('invite');
      } catch (e) {
        // 23505: already in a family (another phone, or an invite redeemed meanwhile): open it.
        if (e && typeof e === 'object' && (e as { code?: string }).code === '23505') { await finish(); return; }
        setNotice(messageFor(e, { action: 'start' }));
      } finally {
        setBusy(false);
      }
    };
    return (
      <Screen>
        <Card>
          <Txt variant="title" role="header">Who's in it?</Txt>
          <Choice
            kind="radio"
            label="Just Everyone"
            title="Just Everyone"
            detail="Everyone you invite sees the photos you send to Everyone. You can make more groups later."
            checked={!twoSides}
            onPress={() => setTwoSides(false)}
          />
          <Choice
            kind="radio"
            label="Two sides"
            title="Two sides"
            detail="Two groups, one for each side of the family. Each photo goes only to the groups you pick."
            checked={twoSides}
            onPress={() => setTwoSides(true)}
          />
          {twoSides ? (
            <>
              <Field label="First group's name" value={sides[0]} onChangeText={(v) => setSides([v, sides[1]])} />
              <Field label="Second group's name" value={sides[1]} onChangeText={(v) => setSides([sides[0], v])} />
              {sidesOk ? null : <Txt variant="strong">Give each group a different name.</Txt>}
            </>
          ) : null}
          {notice ? <Notice text={notice} onClose={() => setNotice(null)} /> : null}
          <Button label="Start the family" onPress={() => void start()} disabled={!sidesOk} busy={busy} />
          <Button label="Back" variant="secondary" onPress={() => setStep('name')} />
        </Card>
      </Screen>
    );
  }

  return <FirstInvite space={space!} onDone={() => void finish()} />;
}

/** Screen 4: the invite card from Groups, for the new family's Everyone. Skip for now goes to Photos. */
function FirstInvite({ space, onDone }: { space: string; onDone: () => void }) {
  const app = useApp();
  const [who, setWho] = useState('');
  const [role, setRole] = useState<Extract<Role, 'viewer' | 'adult'>>('viewer');
  const [history, setHistory] = useState<ShareHistory | null>(null);
  const [needHistory, setNeedHistory] = useState(false);
  const [invite, setInvite] = useState<{ link: string; code: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  useEffect(() => { app.deps.api.myProfile().then((p) => setMyName(p.display_name)).catch(() => {}); }, [app.deps.api]);

  const make = async () => {
    if (role === 'viewer' && !history) { setNeedHistory(true); return; }
    try {
      const everyone = (await app.deps.api.myCircles(space)).find((c) => c.kind === 'everyone');
      if (!everyone) throw new Error('no Everyone');
      const r = await app.deps.api.createInvite({
        space, role, ttlDays: 30, name: who.trim() || null, history: role === 'viewer' ? history : null, circleIds: [everyone.circle_id],
      });
      setInvite({ link: r.link, code: r.code });
    } catch (e) {
      setNotice(messageFor(e, { action: 'invite' }));
    }
  };

  return (
    <Screen>
      <Txt variant="display" role="header">Invite your first person</Txt>
      {notice ? <Notice text={notice} onClose={() => setNotice(null)} /> : null}
      {invite ? (
        <>
          <InviteReady link={invite.link} code={invite.code} onText={() => void app.deps.openUrl(inviteSmsUrl(myName, invite.link, invite.code))} />
          <Button label="Go to Photos" variant="secondary" onPress={onDone} />
        </>
      ) : (
        <Card>
          <Field label="Their name, the way your family says it" value={who} onChangeText={setWho} placeholder='Like "Grandma June"' maxLength={40} />
          <Txt variant="muted">They'll see this name on Hearth and won't have to type it.</Txt>
          <Choice kind="radio" label="A relative" title="A relative" detail="Sees the photos you send to Everyone." checked={role === 'viewer'} onPress={() => setRole('viewer')} />
          <Choice kind="radio" label="Another parent" title="Another parent" detail="Sends photos too, and can invite people." checked={role === 'adult'} onPress={() => setRole('adult')} />
          {role === 'viewer' ? (
            <PastPhotosChoice
              history={history}
              onPick={(h) => { setHistory(h); setNeedHistory(false); }}
              allDetail="They'll see every photo sent to Everyone."
              need={needHistory}
            />
          ) : null}
          <Button label="Make the invite" onPress={() => void make()} softDisabled={role === 'viewer' && !history} />
          <Button label="Skip for now" variant="secondary" onPress={onDone} />
        </Card>
      )}
    </Screen>
  );
}
