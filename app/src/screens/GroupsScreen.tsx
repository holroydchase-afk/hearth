// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Groups (parents only): see groups and who is in them; make a group (GRP-15/16); each group's comment setting
// (GRP-17); basic rename; invite someone to one or more groups (GRP-18). Relatives never see any of this.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { Circle, CommentMode, Person, ShareHistory } from '../api/HearthApi';
import { loadFailedWords, loadFailure, type LoadFailure } from '../errors/loadFailed';
import { messageFor } from '../errors/messages';
import { textsOn, usE164 } from '../api/phone';
import { useApp } from '../state/AppContext';
import { Button, Card, Choice, ErrorState, Field, Loading, Notice, Screen, Txt, BackButton } from '../ui/kit';
import { BAD_NUMBER } from './TextCodeFlow';
import { andList, people } from '../ui/format';
import { useTheme } from '../ui/theme';
import { AppGate } from './AppGate';
import { InviteReady, inviteSmsUrl, PastPhotosChoice } from './InviteCard';

/** SPEC-GROUPS v2 section 2, in the app's words (grandparent-ux owns the final wording). */
const MODES: { mode: CommentMode; title: string; detail: string }[] = [
  { mode: 'private', title: 'Private', detail: 'Only the parents and whoever posted the photo read them.' },
  { mode: 'on_group_posts', title: "Shared on this group's photos", detail: "People in this group read each other's comments on photos sent to this group." },
  { mode: 'always', title: 'Always shared', detail: "People in this group read each other's comments on every photo they can both see." },
];

/** GRP-17: who will read each other's comments once a group is Always shared (relatives; parents read everything). */
function alwaysWords(names: string[], group: string): string {
  return names.length >= 2
    ? `${andList(names)} will read each other's comments on every photo they can see.`
    : `People in ${group} will read each other's comments on every photo they can see.`;
}

interface NewGroup {
  name: string;
  event: boolean;
  ticked: string[]; // user ids
  copied: string[]; // names of the groups people were copied from (GRP-16)
  mode: CommentMode;
  history: ShareHistory | null;
  need: 'name' | 'history' | null;
  busy: boolean;
  made?: string; // HARD-1: the group id once made, so a retry after a lost signal only finishes adding people
}
const NEW_GROUP: NewGroup = { name: '', event: false, ticked: [], copied: [], mode: 'private', history: null, need: null, busy: false };

/** `onBack`: opened from More (RD-15), so a "‹ More" back button (spoken "Back to More") sits above the title (GUX-R1). */
export function GroupsScreen({ onBack }: { onBack?: () => void } = {}) {
  const app = useApp();
  const { c } = useTheme();
  const [circles, setCircles] = useState<Circle[] | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [invite, setInvite] = useState<{ circle: string; link: string; code: string; byPhone?: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failed, setFailed] = useState<LoadFailure | null>(null); // STATES-15: the first load failed; circles stays null
  const [asking, setAsking] = useState<string | null>(null); // circle id whose invite form is open
  const [inviteName, setInviteName] = useState('');
  // BETA-SMS-10: texts on, the invite asks for their mobile number first; only that number can open it.
  const [invitePhone, setInvitePhone] = useState('');
  const [byText, setByText] = useState(true);
  // BETA-AUD-19: "Share all past photos" or "Only new photos"; neither is picked until the parent picks one.
  const [history, setHistory] = useState<ShareHistory | null>(null);
  const [needHistory, setNeedHistory] = useState(false);
  // PRIV-G2 / GRP-18: a new invite adds Everyone only if it names Everyone; ticked first, can be unticked.
  const [alsoEveryone, setAlsoEveryone] = useState(true);
  // GRP-18: more groups the invite names, besides the one whose button was tapped.
  const [alsoIn, setAlsoIn] = useState<string[]>([]);
  const [myName, setMyName] = useState<string | null>(null);
  const [family, setFamily] = useState<Person[]>([]);
  const [draft, setDraft] = useState<NewGroup | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null); // GRP-17: group waiting for "Turn on Always shared"
  useEffect(() => { app.deps.api.myProfile().then((p) => setMyName(p.display_name)).catch(() => {}); }, [app.deps.api]);
  const spaceId = app.space?.space_id;
  // Groups, comment settings and invites are for parents only (a relative allowed to post still never sees them).
  const isParent = app.space?.role === 'owner' || app.space?.role === 'adult';

  const circlesRef = useRef<Circle[] | null>(null);
  useEffect(() => { circlesRef.current = circles; }, [circles]);
  const load = useCallback(async () => {
    if (!spaceId) return;
    try {
      setCircles(await app.deps.api.myCircles(spaceId));
      setFailed(null);
    } catch (e) {
      // STATES-15: never "no groups". With nothing on the page yet it is an error state; later reloads keep the list.
      if (circlesRef.current === null) { setFailed(loadFailure(e)); setCircles(null); } else setNotice(messageFor(e));
    }
  }, [app.deps.api, spaceId]);

  useEffect(() => {
    if (!isParent || !spaceId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads data and resets its state when the id changes; a keyed remount would change when the old picture clears, so the refactor waits for a phone check (TRACKER R113) (Nov 26)
    void load();
    app.deps.api.familyPeople(spaceId).then(setFamily).catch(() => setFamily([]));
  }, [load, isParent, spaceId, app.deps.api]);

  if (app.status !== 'ready' || !app.space) return <AppGate />;
  if (!isParent) return <Screen><Txt variant="title2">You can't do that here.</Txt></Screen>;

  const parentNames = new Set(family.filter((p) => p.role !== 'viewer').map((p) => p.name));
  const relatives = family.filter((p) => p.role === 'viewer').sort((a, b) => a.name.localeCompare(b.name));
  const relativesIn = (g: Circle) => g.member_names.filter((n) => !parentNames.has(n));
  const groups = (circles ?? []).filter((g) => g.kind !== 'everyone');

  // ---- GRP-15/16: New group ----
  const edit = (p: Partial<NewGroup>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const tick = (id: string) => setDraft((d) => (d ? { ...d, ticked: d.ticked.includes(id) ? d.ticked.filter((x) => x !== id) : [...d.ticked, id] } : d));
  const copyFrom = (g: Circle) => setDraft((d) => {
    if (!d) return d;
    const ids = relatives.filter((p) => g.member_names.includes(p.name)).map((p) => p.user_id);
    return { ...d, ticked: [...new Set([...d.ticked, ...ids])], copied: d.copied.includes(g.name) ? d.copied : [...d.copied, g.name] };
  });
  const makeGroup = async () => {
    if (!draft || draft.busy) return;
    const name = draft.name.trim();
    if (!name) { edit({ need: 'name' }); return; }
    if (!draft.history) { edit({ need: 'history' }); return; }
    edit({ busy: true, need: null });
    try {
      const id = draft.made ?? await app.deps.api.createLevel(app.space!.space_id, draft.event ? 'event' : 'group', name);
      edit({ made: id });
      if (draft.mode !== (draft.event ? 'on_group_posts' : 'private')) await app.deps.api.setCommentMode(id, draft.mode);
      for (const u of draft.ticked) await app.deps.api.placePerson(id, u, draft.history);
      setDraft(null);
    } catch (e) {
      edit({ busy: false });
      setNotice(messageFor(e, { action: 'group' }));
    }
    await load();
  };

  // ---- GRP-17: comment setting of an existing group ----
  const setMode = async (g: Circle, mode: CommentMode) => {
    setConfirming(null);
    setCircles((cur) => (cur ?? []).map((x) => (x.circle_id === g.circle_id ? { ...x, comment_mode: mode } : x)));
    try {
      await app.deps.api.setCommentMode(g.circle_id, mode);
    } catch (e) {
      setNotice(messageFor(e, { action: 'group' }));
      await load();
    }
  };
  const pickMode = (g: Circle, mode: CommentMode) => {
    if (mode === g.comment_mode) return;
    if (mode === 'always') setConfirming(g.circle_id); // nothing changes until they confirm
    else void setMode(g, mode);
  };

  const saveName = async (id: string) => {
    try {
      await app.deps.api.renameCircle(id, name);
      setRenaming(null);
      await load();
    } catch (e) {
      setNotice(messageFor(e, { action: 'group' }));
    }
  };

  const closeForm = () => { setAsking(null); setInviteName(''); setInvitePhone(''); setByText(true); setHistory(null); setNeedHistory(false); setAlsoEveryone(true); setAlsoIn([]); };
  const everyone = (circles ?? []).find((g) => g.kind === 'everyone');

  const makeInvite = async (id: string) => {
    if (!history) { setNeedHistory(true); return; }
    const askPhone = textsOn() && byText && invitePhone.trim() !== '';
    const phone = askPhone ? usE164(invitePhone) : null;
    if (askPhone && !phone) { setNotice(BAD_NUMBER); return; }
    try {
      // JOIN-1: the name the family uses becomes theirs when they join, so they type nothing.
      const r = await app.deps.api.createInvite({
        space: app.space!.space_id, role: 'viewer', ttlDays: 30, name: inviteName.trim() || null, history,
        ...(phone ? { channel: 'sms' as const, targetPhone: phone } : {}),
        circleIds: [
          id,
          ...groups.filter((o) => o.circle_id !== id && alsoIn.includes(o.circle_id)).map((o) => o.circle_id),
          ...(everyone && alsoEveryone && everyone.circle_id !== id ? [everyone.circle_id] : []),
        ],
      });
      setInvite({ circle: id, link: r.link, code: r.code, byPhone: !!phone });
      closeForm();
    } catch (e) {
      setNotice(messageFor(e, { action: 'invite' }));
    }
  };

  const text = (link: string, code: string, byPhone: boolean) => { void app.deps.openUrl(inviteSmsUrl(myName, link, code, byPhone)); };

  // UX-G4: the server takes an invite only to a household, or (until 0012) a group with nothing under it.
  const invitable = (g: Circle) =>
    g.kind === 'household' || ((g.kind ?? 'group') === 'group' && !(circles ?? []).some((o) => o.parent_ids?.includes(g.circle_id)));

  const startGroup = () => { closeForm(); setDraft(NEW_GROUP); };
  // STATES-18: "Invite someone" opens the form for the household, or the first group that can take one.
  const inviteTarget = (circles ?? []).find((g) => g.kind === 'household') ?? (circles ?? []).find(invitable);
  const failedWords = failed ? loadFailedWords(failed, { helper: app.helper }) : null;

  return (
    <Screen>
      {onBack ? <BackButton to="More" onPress={onBack} /> : null}
      <Txt variant="title1" role="header">Your groups</Txt>
      {/* EF-HE-5: honest about who sees group names (DEC-49). */}
      <Txt tone="muted">Each photo goes only to the groups you pick. Only parents see these names; everyone else sees people's names.</Txt>
      {notice ? <Notice text={notice} onClose={() => setNotice(null)} /> : null}
      {/* STATES-19: how to invite, once, whenever a group exists. */}
      {(circles ?? []).length && inviteTarget ? <Txt tone="muted">To invite someone, tap Invite someone under a group.</Txt> : null}
      {(circles ?? []).length && !inviteTarget ? <Txt tone="muted">To invite someone, first make a group, then tap Invite someone under it.</Txt> : null}
      {circles === null && failedWords ? (
        <ErrorState line={`${failedWords.title}. ${failedWords.line}`} onRetry={() => { setFailed(null); void load(); }} />
      ) : null}
      {circles === null && !failed ? <Loading words="Loading your groups…" /> : null}
      {draft ? (
        <Card>
          <Txt variant="title2" role="header">New group</Txt>
          <Field label="Name of the group" value={draft.name} onChangeText={(name) => edit({ name, need: draft.need === 'name' ? null : draft.need })} placeholder={'Like "Chase\'s birthday"'} maxLength={60} />
          {draft.need === 'name' ? <Txt variant="headline">Type a name for the group first.</Txt> : null}
          <Choice
            kind="checkbox"
            label="This group is for an event"
            title="This group is for an event"
            detail="Like a birthday or a trip. People in it read each other's comments on its photos."
            checked={draft.event}
            onPress={() => edit({ event: !draft.event, mode: draft.event ? 'private' : 'on_group_posts' })}
          />
          <Txt variant="title2" role="header">Who is in it?</Txt>
          {groups.filter((g) => relativesIn(g).length > 0).map((g) => (
            <Button key={g.circle_id} label={`Add everyone from ${g.name}`} variant="secondary" onPress={() => copyFrom(g)} />
          ))}
          {draft.copied.map((n) => <Txt key={n} tone="muted">{`People you add to ${n} later won't be added here.`}</Txt>)}
          {relatives.map((p) => (
            <Choice key={p.user_id} kind="checkbox" label={p.name} title={p.name} checked={draft.ticked.includes(p.user_id)} onPress={() => tick(p.user_id)} />
          ))}
          <Txt variant="title2" role="header">Who reads their comments?</Txt>
          {MODES.map((m) => (
            <Choice key={m.mode} kind="radio" label={m.title} title={m.title} detail={m.detail} checked={draft.mode === m.mode} onPress={() => edit({ mode: m.mode })} />
          ))}
          {draft.mode === 'always' ? (
            <Txt variant="headline">{alwaysWords(relatives.filter((p) => draft.ticked.includes(p.user_id)).map((p) => p.name), draft.name.trim() || 'this group')}</Txt>
          ) : null}
          <Txt variant="title2" role="header">Should they see photos already shared?</Txt>
          <Choice
            kind="radio"
            label="Share all past photos"
            title="Share all past photos"
            detail="They'll see every photo sent to this group, even from before they were added."
            checked={draft.history === 'all'}
            onPress={() => edit({ history: 'all', need: null })}
          />
          <Choice
            kind="radio"
            label="Only new photos"
            title="Only new photos"
            detail="They'll see photos sent to this group from today on."
            checked={draft.history === 'new'}
            onPress={() => edit({ history: 'new', need: null })}
          />
          {draft.need === 'history' ? <Txt variant="headline">Pick one above first.</Txt> : null}
          <Button variant="secondary" label="Make the group" onPress={() => void makeGroup()} softDisabled={!draft.name.trim() || !draft.history} busy={draft.busy} />
          <Button label="Cancel" variant="secondary" onPress={() => setDraft(null)} />
        </Card>
      ) : circles === null ? null : (
        // STATES-16/17: a tinted capsule (not on DS-9's filled list). With no group yet, or none that can take an
        // invite, it reads "Make a group" (STATES-16/18): one button, not two.
        <Button variant="tinted" label={circles.length && inviteTarget ? 'New group' : 'Make a group'} onPress={startGroup} />
      )}
      {circles !== null && circles.length === 0 && !draft ? (
        <>
          <Txt variant="title2" role="header">No groups yet</Txt>
          <Txt tone="muted">A group is the people who get a photo, like Grandparents or Cousins. Make one to choose who sees your photos.</Txt>
        </>
      ) : null}
      {/* one main action per screen: while making a group, the list waits */}
      {(draft ? [] : circles ?? []).map((g) => (
        <Card key={g.circle_id}>
          <Txt variant="title2">{g.name}</Txt>
          <Txt tone="muted">{people(g.member_count)}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {g.member_names.map((m, i) => (
              <View key={`${m}-${i}`} style={{ borderWidth: 1, borderColor: c.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: c.safeSoft }}>
                <Txt>{`✓ ${m}`}</Txt>
              </View>
            ))}
          </View>
          {g.kind !== 'everyone' && g.comment_mode ? (
            <>
              <Txt variant="headline">Who reads their comments?</Txt>
              {MODES.map((m) => (
                <Choice
                  key={m.mode}
                  kind="radio"
                  label={`${m.title} for ${g.name}`}
                  title={m.title}
                  detail={m.detail}
                  checked={g.comment_mode === m.mode}
                  onPress={() => pickMode(g, m.mode)}
                />
              ))}
              {confirming === g.circle_id ? (
                <Card>
                  <Txt variant="headline">{alwaysWords(relativesIn(g), g.name)}</Txt>
                  <Txt>As now, the parents and whoever posted a photo read every comment on it.</Txt>
                  <Button variant="secondary" label="Turn on Always shared" onPress={() => void setMode(g, 'always')} />
                  <Button label="Cancel" variant="secondary" onPress={() => setConfirming(null)} />
                </Card>
              ) : null}
            </>
          ) : null}
          {renaming === g.circle_id ? (
            <>
              <Field label="New name for this group" value={name} onChangeText={setName} autoFocus maxLength={60} />
              <Button variant="secondary" label="Save name" onPress={() => void saveName(g.circle_id)} disabled={!name.trim()} />
              <Button label="Cancel" variant="secondary" onPress={() => setRenaming(null)} />
            </>
          ) : (
            <Button label={`Rename ${g.name}`} text="Rename" variant="secondary" onPress={() => { setRenaming(g.circle_id); setName(g.name); }} />
          )}
          {invite?.circle === g.circle_id ? (
            <InviteReady link={invite.link} code={invite.code} onText={() => text(invite.link, invite.code, !!invite.byPhone)} />
          ) : asking === g.circle_id ? (
            <>
              <Txt variant="title2" role="header">{`Invite someone to ${g.name}`}</Txt>
              <Field label="Their name, the way your family says it" value={inviteName} onChangeText={setInviteName} placeholder='Like "Grandma June"' maxLength={40} />
              <Txt tone="muted">They'll see this name on Hearth and won't have to type it.</Txt>
              {textsOn() && byText ? (
                <>
                  <Field label="Their mobile number" value={invitePhone} onChangeText={setInvitePhone} keyboardType="phone-pad" autoComplete="off" placeholder="304-555-0100" maxLength={20} />
                  <Txt tone="muted">Only this number can open the invite.</Txt>
                  <Button label="They'll use email" variant="secondary" onPress={() => { setByText(false); setInvitePhone(''); }} />
                </>
              ) : null}
              {/* GUX-R2: skipping the number makes a link invite; say who can open it, and offer the number back. */}
              {textsOn() && !byText ? (
                <>
                  <Txt tone="muted">They'll sign in with their email. Anyone you send the invite to can open it.</Txt>
                  <Button label="Add their mobile number" variant="secondary" onPress={() => setByText(true)} />
                </>
              ) : null}
              {/* GRP-18: Everyone first and ticked; any other groups can be ticked too */}
              {everyone && everyone.circle_id !== g.circle_id ? (
                <Choice
                  kind="checkbox"
                  label="Also add them to Everyone"
                  title="Also add them to Everyone"
                  detail={`They'll see photos sent to Everyone. Untick this if they should see only ${g.name}.`}
                  checked={alsoEveryone}
                  onPress={() => setAlsoEveryone((v) => !v)}
                />
              ) : null}
              {groups.filter((o) => o.circle_id !== g.circle_id).map((o) => (
                <Choice
                  key={o.circle_id}
                  kind="checkbox"
                  label={`Also add them to ${o.name}`}
                  title={`Also add them to ${o.name}`}
                  checked={alsoIn.includes(o.circle_id)}
                  onPress={() => setAlsoIn((cur) => (cur.includes(o.circle_id) ? cur.filter((x) => x !== o.circle_id) : [...cur, o.circle_id]))}
                />
              ))}
              <PastPhotosChoice
                history={history}
                onPick={(h) => { setHistory(h); setNeedHistory(false); }}
                allDetail={`They'll see every photo ${g.name} can already see.`}
                need={needHistory}
              />
              <Button variant="secondary" label="Make the invite" onPress={() => void makeInvite(g.circle_id)} softDisabled={!history} />
              <Button label="Cancel" variant="secondary" onPress={closeForm} />
            </>
          ) : invitable(g) ? (
            <Button label={`Invite someone to ${g.name}`} text="Invite someone" variant="secondary" onPress={() => { closeForm(); setAsking(g.circle_id); }} />
          ) : inviteTarget ? (
            // STATES-18: a button, not a sentence; it opens the form for the household (or first group that can take one).
            <Button label="Invite someone" variant="secondary" onPress={() => { closeForm(); setAsking(inviteTarget.circle_id); }} />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
