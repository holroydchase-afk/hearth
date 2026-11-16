// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Blocks shared by Help, Me and More (RD-15): Bigger text, light or dark, Family color, notice choice, privacy, sign out.
import React, { useState } from 'react';
import { isPhoneOnly } from '../api/phone';
import { useApp } from '../state/AppContext';
import { HELPER_FEATURES } from '../share/helpers';
import type { NotifyChoice } from '../state/prefs';
import { Pressable, StyleSheet, View } from 'react-native';
import { MIN_TARGET, paletteFor, useTheme, type ColorName, type ScreenLook } from '../ui/theme';
import { Button, GroupedSection, Choice, Confirm, Notice, SystemIcon, Txt } from '../ui/kit';

export function BiggerText() {
  const { prefs, setPrefs } = useApp();
  return (
    <GroupedSection>
      <Choice
        kind="switch"
        label="Bigger text"
        title="Bigger text"
        detail={prefs.bigText ? 'Words are extra large.' : 'Tap to make the words bigger.'}
        checked={prefs.bigText}
        onPress={() => setPrefs({ bigText: !prefs.bigText })}
      />
    </GroupedSection>
  );
}

const LOOKS: { id: ScreenLook; title: string; detail: string }[] = [
  { id: 'system', title: 'Same as my phone (Recommended)', detail: 'Light in the day, dark at night if your phone does that.' },
  { id: 'light', title: 'Light screen', detail: 'Dark words on a white screen.' },
  { id: 'dark', title: 'Dark screen', detail: 'Light words on a dark screen. Easier on the eyes at night.' },
];

/** DS-10: light or dark screen. Saved on this phone only. `heading={false}` when the screen's own title says it (More). */
export function LightOrDark({ heading = true }: { heading?: boolean }) {
  const { prefs, setPrefs } = useApp();
  return (
    <GroupedSection>
      {heading ? <Txt variant="title" role="header">Light or dark screen</Txt> : null}
      {LOOKS.map((l) => (
        <Choice key={l.id} kind="radio" label={l.title} title={l.title} detail={l.detail} checked={prefs.look === l.id} onPress={() => setPrefs({ look: l.id })} />
      ))}
    </GroupedSection>
  );
}

const COLORS: { id: ColorName; title: string }[] = [
  { id: 'ember', title: 'Ember' },
  { id: 'forest', title: 'Forest' },
  { id: 'plum', title: 'Plum' },
];

/** RD-24..RD-26: the family's owner picks the family color: Ember (default), Forest or Plum. Each row shows the
 *  color itself, its name and a check on the picked one. Phase 1: saved on this phone only (prefs.color). */
export function FamilyColor({ heading = true }: { heading?: boolean }) {
  const { prefs, setPrefs, space } = useApp();
  const { c, dark } = useTheme();
  if (!space || space.role !== 'owner') return null;
  return (
    <GroupedSection>
      {heading ? <Txt variant="title" role="header">Family color</Txt> : null}
      {COLORS.map((k) => {
        const on = prefs.color === k.id;
        const swatch = paletteFor('ios', dark, k.id).accent;
        return (
          <Pressable
            key={k.id}
            accessibilityRole="radio"
            accessibilityLabel={k.title}
            accessibilityState={{ checked: on }}
            aria-checked={on} // the web build reads aria-checked, not accessibilityState
            onPress={() => setPrefs({ color: k.id })}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[styles.swatch, { backgroundColor: swatch }]} />
            <Txt style={{ flex: 1 }}>{k.title}</Txt>
            {on ? <SystemIcon icon={CHECK} color={c.ink} /> : null}
          </Pressable>
        );
      })}
    </GroupedSection>
  );
}

const CHECK = { sf: 'checkmark', md: 'check' };

const styles = StyleSheet.create({
  row: { minHeight: MIN_TARGET + 4, minWidth: MIN_TARGET, flexDirection: 'row', alignItems: 'center', gap: 12 },
  swatch: { width: 28, height: 28, borderRadius: 14 },
});

const CHOICES: { id: NotifyChoice; title: string; saved: string }[] = [
  { id: 'push', title: 'A sound on your phone when there are new photos (Recommended)', saved: 'Saved. Your phone will make a sound when there are new photos.' },
  { id: 'evening', title: "An email every evening with the day's new photos", saved: "Saved. We'll email you every evening when there are new photos." },
  { id: 'sunday', title: 'An email every Sunday morning', saved: "Saved. We'll email you on Sunday mornings when there are new photos." },
];

export function HowToTell() {
  const { prefs, saveNotify, session } = useApp();
  const [saved, setSaved] = useState<{ text: string; good: boolean } | null>(null);
  // BETA-SMS-14: a phone-only account has no email address, so no email choices (the server never emails it).
  const phoneOnly = isPhoneOnly(session);
  return (
    <GroupedSection>
      <Txt variant="title" role="header">How should we tell you about new photos?</Txt>
      {phoneOnly ? <Txt>You sign in with a text, so Hearth tells you about new photos on this phone, not by email.</Txt> : null}
      {CHOICES.filter((c) => !phoneOnly || c.id === 'push').map((c) => (
        <Choice
          key={c.id}
          kind="radio"
          label={c.title}
          title={c.title}
          checked={prefs.notify === c.id}
          onPress={() => {
            setSaved(null);
            void saveNotify(c.id).then((ok) => setSaved(ok
              ? { text: c.saved, good: true }
              : { text: "Didn't save. Check your signal, then tap your choice again.", good: false }));
          }}
        />
      ))}
      {saved ? <Notice text={saved.text} tone={saved.good ? 'good' : 'info'} /> : null}
    </GroupedSection>
  );
}

const HELPERS = [
  { feature: HELPER_FEATURES.duplicates, title: 'Set aside repeats', detail: 'The same photo twice, look-alikes, and photos sent in the last 30 days.' },
  { feature: HELPER_FEATURES.screensBlur, title: 'Set aside screenshots and blurry photos', detail: "Pictures of a phone's screen, and photos that came out blurry." },
];

/** HELP-R6 (R17): the family's owner turns the photo helpers off and on for everyone who shares (DEC-18). */
export function PhotoHelpers() {
  const { space, features, setFamilyFeature } = useApp();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!space || space.role !== 'owner') return null;
  return (
    <GroupedSection>
      <Txt variant="title" role="header">Photo helpers</Txt>
      <Txt variant="muted">When anyone picks 4 or more photos to send, Hearth can set some aside first. Each one has a Put back button. Nothing is deleted from the phone. These switches are for the whole family.</Txt>
      {HELPERS.map((h) => {
        const on = features.includes(h.feature);
        return (
          <Choice
            key={h.feature}
            kind="switch"
            label={h.title}
            title={h.title}
            detail={h.detail}
            checked={on}
            onPress={() => {
              if (busy) return;
              setBusy(true);
              setNote(null);
              void setFamilyFeature(h.feature, !on).then((ok) => {
                setBusy(false);
                if (!ok) setNote("Didn't save. Check your signal, then tap the switch again.");
              });
            }}
          />
        );
      })}
      {note ? <Notice text={note} tone="info" /> : null}
    </GroupedSection>
  );
}

export function Privacy({ who }: { who: string | null }) {
  return (
    <GroupedSection>
      <Txt variant="title" role="header">Keeping your photos private</Txt>
      <Txt>Your photos stay in the United States.</Txt>
      <Txt>No one outside the family can see them. No ads, no strangers.</Txt>
      <Txt>No computer program learns from your photos.</Txt>
      <Txt>Photos don't show where they were taken.</Txt>
      <Txt>{`${who ?? 'You'} can delete everything at any time.`}</Txt>
    </GroupedSection>
  );
}

export function SignOut() {
  const { signOut } = useApp();
  const [ask, setAsk] = useState(false);
  return (
    <>
      <Button label="Sign out of Hearth" variant="secondary" onPress={() => setAsk(true)} />
      <Confirm
        visible={ask}
        title="Sign out of Hearth?"
        body="To come back, you'll need a new code from your email."
        yes="Yes, sign out"
        no="No, stay signed in"
        onNo={() => setAsk(false)}
        onYes={() => { setAsk(false); void signOut(); }}
      />
    </>
  );
}

/** BETA-JOIN-7. Not offered to the space's owner: what happens to the family's photos is Chase's call. */
export function DeleteAccount() {
  const app = useApp();
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!app.space || app.space.role === 'owner') return null;
  const yes = async () => {
    setAsk(false);
    try {
      await app.deps.api.requestAccountDeletion();
      await app.signOut();
    } catch {
      setMsg("Didn't work. Try again in a minute.");
    }
  };
  return (
    <>
      <Button label="Take me off Hearth" variant="secondary" onPress={() => setAsk(true)} />
      {msg ? <Txt>{msg}</Txt> : null}
      <Confirm
        visible={ask}
        title="Take you off Hearth?"
        body="This takes you off Hearth for good. Your comments and hearts are removed. This can't be undone."
        yes="Yes, take me off Hearth"
        no="No, stay on Hearth"
        onNo={() => setAsk(false)}
        onYes={() => void yes()}
      />
    </>
  );
}

/** BETA-AUD-10: the family owner picks who reads what relatives write. Safest is the default. */
export function ReplyAudience() {
  const app = useApp();
  const [choice, setChoice] = useState(app.space?.reply_audience ?? 'parents');
  const [failed, setFailed] = useState(false);
  if (!app.space || app.space.role !== 'owner') return null;
  const pick = (c: 'parents' | 'everyone') => {
    const before = choice;
    setChoice(c);
    setFailed(false);
    app.deps.api.setReplyAudience(app.space!.space_id, c).catch(() => { setChoice(before); setFailed(true); });
  };
  return (
    <GroupedSection>
      <Txt variant="title" role="header">Who reads what family members write</Txt>
      <Txt variant="muted">For comments and hearts. The kids' parents read them all, and your own replies reach everyone the photo went to. People in the same household, or in the same event, read each other's.</Txt>
      <Choice kind="radio" label="The parents, plus their own household and events (safest)" title="The parents, plus their own household and events (safest)" detail="A grandparent's comment reaches you, the other parent, and their own household. Never the other side." checked={choice === 'parents'} onPress={() => pick('parents')} />
      <Choice kind="radio" label="Everyone the photo was shared with" title="Everyone the photo was shared with" detail="Divorced grandparents on the same photo will read each other's comments." checked={choice === 'everyone'} onPress={() => pick('everyone')} />
      {failed ? <Notice text="Didn't save. Check your internet and try again." /> : null}
    </GroupedSection>
  );
}
