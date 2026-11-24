// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Blocks shared by Help, Me and More (RD-15): Easy view, light or dark, Theme, notice choice, privacy, sign out.
import React, { useState } from 'react';
import { isPhoneOnly } from '../api/phone';
import { useApp } from '../state/AppContext';
import { HELPER_FEATURES } from '../share/helpers';
import type { NotifyChoice } from '../state/prefs';
import { Pressable, StyleSheet, View } from 'react-native';
import { MIN_TARGET, paletteFor, useTheme, type ScreenLook, type ThemeName } from '../ui/theme';
import { AlertDialog, Button, GroupedSection, Choice, Notice, SystemIcon, Txt } from '../ui/kit';

const EASY: { id: 'on' | 'off'; title: string }[] = [{ id: 'on', title: 'On' }, { id: 'off', title: 'Off' }];

/** RD-78 (DEC-66): Easy view's page under More: one line, then On and Off rows with a check on the current one (like
 *  Light or dark). Picking one changes the tabs and text at once and saves it for this person on this phone. */
export function EasyView({ heading = false }: { heading?: boolean }) {
  const { prefs, setPrefs } = useApp();
  return (
    <GroupedSection>
      {heading ? <Txt variant="title2" role="header">Easy view</Txt> : null}
      <Txt>Bigger words, and a word under each button at the bottom of the screen.</Txt>
      {/* GUX-R11: the same radio rows as Light or dark (kit Choice): an accent check on the picked one, 48 pt+. */}
      {EASY.map((k) => (
        <Choice key={k.id} kind="radio" label={k.title} title={k.title} checked={prefs.easyView === (k.id === 'on')} onPress={() => setPrefs({ easyView: k.id === 'on' })} />
      ))}
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
      {heading ? <Txt variant="title2" role="header">Light or dark screen</Txt> : null}
      {LOOKS.map((l) => (
        <Choice key={l.id} kind="radio" label={l.title} title={l.title} detail={l.detail} checked={prefs.look === l.id} onPress={() => setPrefs({ look: l.id })} />
      ))}
    </GroupedSection>
  );
}

const THEMES: { id: ThemeName; title: string }[] = [
  { id: 'paper', title: 'Paper (standard)' }, // GUX-R33: says it is the standard one
  { id: 'avocado', title: 'Avocado' },
  { id: 'pomegranate', title: 'Pomegranate' },
  { id: 'blood-orange', title: 'Blood orange' },
  { id: 'kiwi', title: 'Kiwi' },
  { id: 'fig', title: 'Fig' },
  { id: 'dragon-fruit', title: 'Dragon fruit' },
  { id: 'watermelon', title: 'Watermelon' },
  { id: 'beet', title: 'Candy-stripe beet' },
  { id: 'red-cabbage', title: 'Red cabbage' },
];

/** RD-97 / RD-98 / FRUIT-6: the family's owner picks a theme: Paper (default) or one of nine fruits. Each row shows a swatch
 *  (the theme's page, fill and accent, light or dark as now), its name and a check on the picked one. A tap
 *  recolors at once. Phase 1: saved on this phone only (prefs.theme). */
export function ThemePicker({ heading = true }: { heading?: boolean }) {
  const { prefs, setPrefs, space } = useApp();
  const { c, dark } = useTheme();
  if (!space || space.role !== 'owner') return null;
  return (
    <GroupedSection>
      {heading ? <Txt variant="title2" role="header">Theme</Txt> : null}
      {THEMES.map((k) => {
        const on = prefs.theme === k.id;
        const swatch = paletteFor('ios', dark, k.id);
        return (
          <Pressable
            key={k.id}
            accessibilityRole="radio"
            accessibilityLabel={`${k.title} theme`}
            accessibilityState={{ checked: on }}
            aria-checked={on} // the web build reads aria-checked, not accessibilityState
            onPress={() => setPrefs({ theme: k.id })}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
          >
            {/* GUX-R19 / GUX-R30: a three-part swatch, the theme's page, fill and accent side by side, with a
                hairline edge so a light page reads on a light row and the five crimson accents are told apart. */}
            <View testID={`swatch-${k.id}`} style={[styles.swatch, { borderColor: c.tabLine }]}>
              <View testID={`swatch-${k.id}-page`} style={[styles.half, { backgroundColor: swatch.bg }]} />
              <View testID={`swatch-${k.id}-fill`} style={[styles.half, { backgroundColor: swatch.fill }]} />
              <View testID={`swatch-${k.id}-accent`} style={[styles.half, { backgroundColor: swatch.accent }]} />
            </View>
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
  swatch: { width: MIN_TARGET, height: MIN_TARGET, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', overflow: 'hidden' },
  half: { flex: 1 },
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
      <Txt variant="title2" role="header">How should we tell you about new photos?</Txt>
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
      <Txt variant="title2" role="header">Photo helpers</Txt>
      <Txt tone="muted">When anyone picks 4 or more photos to send, Hearth can set some aside first. Each one has a Put back button. Nothing is deleted from the phone. These switches are for the whole family.</Txt>
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
      <Txt variant="title2" role="header">Keeping your photos private</Txt>
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
      {/* TD-UX-R6: the one confirm dialog (RD-67): the safe choice first and Semibold, the other in red words. */}
      {ask ? (
        <AlertDialog
          title="Sign out of Hearth?"
          body="To come back, you'll need a new code. We'll send it to you."
          keep="Stay signed in"
          destroy="Sign out"
          onKeep={() => setAsk(false)}
          onDestroy={() => { setAsk(false); void signOut(); }}
        />
      ) : null}
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
      {ask ? (
        <AlertDialog
          title="Take you off Hearth?"
          body="This takes you off Hearth for good. Your comments and hearts are removed. This can't be undone."
          keep="Stay on Hearth"
          destroy="Take me off"
          onKeep={() => setAsk(false)}
          onDestroy={() => void yes()}
        />
      ) : null}
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
      <Txt variant="title2" role="header">Who reads what family members write</Txt>
      <Txt tone="muted">For comments and hearts. The kids' parents read them all, and your own replies reach everyone the photo went to. People in the same household, or in the same event, read each other's.</Txt>
      <Choice kind="radio" label="The parents, plus their own household and events (safest)" title="The parents, plus their own household and events (safest)" detail="A grandparent's comment reaches you, the other parent, and their own household. Never the other side." checked={choice === 'parents'} onPress={() => pick('parents')} />
      <Choice kind="radio" label="Everyone the photo was shared with" title="Everyone the photo was shared with" detail="Divorced grandparents on the same photo will read each other's comments." checked={choice === 'everyone'} onPress={() => pick('everyone')} />
      {failed ? <Notice text="Didn't save. Check your internet and try again." /> : null}
    </GroupedSection>
  );
}
