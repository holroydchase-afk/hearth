// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SHARE-ST-30..33 (SPEC-REDESIGN 1j-2 round 4, DEC-84; look: option A of the Nov 20 kinds tester): under Share's empty
// postcard, a row of three kinds (Event, News, Saying) for parents, behind the post_kinds feature. A tap shows that
// kind's card face. SHARE-U-17..23 (SPEC-VISIBILITY-CORE "One Share composer"): ShareScreen holds the card's words,
// opens the photo flow's who-gets-it tiles once the required fields hold words, and sends one post of that kind.
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CreatePostArgs } from '../api/HearthApi';
import { toApiError } from '../errors/messages';
import { dayLabel, parseIso } from '../share/dayPicker';
import { Button, SystemIcon, noWebOutline, type Icon } from '../ui/kit';
import { FONT, RADIUS, SPACE, photoShadow, useTheme } from '../ui/theme';
import { useTypingField } from '../ui/typing';

export type PostKind = 'event' | 'news' | 'saying';

export const POST_KINDS: readonly { kind: PostKind; word: string; label: string; icon: Icon }[] = [
  { kind: 'event', word: 'Event', label: 'Add an event', icon: { sf: 'calendar', md: 'event' } },
  { kind: 'news', word: 'News', label: 'Share news', icon: { sf: 'newspaper', md: 'newspaper' } },
  { kind: 'saying', word: 'Saying', label: 'Add a saying', icon: { sf: 'quote.bubble', md: 'format_quote' } },
];

/** SHARE-ST-30 / SHARE-ST-33: the kinds show only with the post_kinds switch on, and only to a parent. */
export function showsKinds(features: readonly string[], role: string | undefined): boolean {
  return features.includes('post_kinds') && (role === 'owner' || role === 'adult');
}

/** SHARE-ST-31 / SHARE-ST-32: three equal tiles in a row; with Easy view on, one full-width tile per row, icon left. */
export function KindsRow({ onPick }: { onPick: (k: PostKind) => void }) {
  const { c, type, bigText: easy, dark } = useTheme();
  return (
    <View testID="share-kinds" style={[styles.row, { flexDirection: easy ? 'column' : 'row' }]}>
      {POST_KINDS.map((K) => (
        <Pressable key={K.kind} testID={`share-kind-${K.kind}`} accessibilityRole="button" accessibilityLabel={K.label}
          onPress={() => onPick(K.kind)}
          style={({ pressed }) => [easy ? styles.tileEasy : styles.tile, { backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 }, photoShadow(dark)]}>
          <SystemIcon icon={K.icon} color={c.accent} size={easy ? 30 : 26} />
          <Text testID={`share-kind-word-${K.kind}`} style={{ ...type.headline, color: c.ink, textAlign: easy ? 'left' : 'center' }}>{K.word}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** DEC-90 (SPEC-SHARE-FLOW): a kind's words are one big open box; the rest are chips. Keys of `KindWords`. */
export type KindWords = { words?: string; day?: string; where?: string; who?: string; age?: string };
export type ChipKey = 'day' | 'where' | 'who' | 'age';

/** FLOW-2: the question each kind asks, as the box's placeholder and spoken name. */
export const KIND_QUESTION: Record<PostKind, string> = { event: "What's happening?", news: "What's your news?", saying: 'What did they say?' };

/** FLOW-3: each kind's chips, in order: the verb before it is set, and the editor's spoken name. */
const CHIPS: Record<PostKind, { key: ChipKey; ask: string; icon: Icon; editor?: string }[]> = {
  event: [
    { key: 'day', ask: 'Pick a day', icon: { sf: 'calendar', md: 'event' } },
    { key: 'where', ask: 'Add a place', icon: { sf: 'mappin.and.ellipse', md: 'location_on' }, editor: 'Where' },
  ],
  news: [],
  saying: [
    { key: 'who', ask: 'Who said it?', icon: { sf: 'person', md: 'person' }, editor: 'Who said it' },
    { key: 'age', ask: 'Add their age', icon: { sf: 'birthday.cake', md: 'cake' }, editor: 'Age' },
  ],
};

const has = (v: string | undefined) => !!v && v.trim().length > 0;

/** FLOW-5: what step 1 still needs, in the words of the hint line; '' when nothing is missing. */
export function kindMissing(kind: PostKind, v: KindWords): string {
  const need: string[] = [];
  if (kind === 'event') {
    if (!has(v.words)) need.push("what's happening");
    if (!has(v.day)) need.push('the day');
  } else if (kind === 'saying') {
    if (!has(v.words)) need.push('what they said');
    if (!has(v.who)) need.push('who said it');
  } else if (!has(v.words)) need.push('your news');
  return need.length ? `Add ${need.join(' and ')} to go on.` : '';
}

/** SHARE-U-17: every required field of this kind holds words (spaces alone don't count). */
export const kindFilled = (kind: PostKind, v: KindWords): boolean => kindMissing(kind, v) === '';

/** GUX-SK-R1: a real calendar day as YYYY-MM-DD (2026-02-30 and 2026-13-40 are not). */
export function realDay(s: string): boolean {
  return parseIso(s) !== null;
}

/** SHARE-U-19: the createPost fields for this kind (news words are the caption), or 'age' when the age isn't a number,
 *  or 'day' when the event's day isn't a real YYYY-MM-DD date. The day sheet and the number keypad make both
 *  unreachable (FLOW-16, FLOW-18); the guard stays before a send. */
export function kindDetails(kind: PostKind, v: KindWords): Pick<CreatePostArgs, 'kind' | 'caption' | 'event' | 'saying'> | 'age' | 'day' {
  const t = (x: string | undefined) => (x ?? '').trim();
  if (kind === 'news') return { kind, caption: t(v.words) };
  if (kind === 'event') {
    if (!realDay(t(v.day))) return 'day';
    return { kind, caption: null, event: { what: t(v.words), when: t(v.day), where: t(v.where) || null } };
  }
  const age = t(v.age);
  if (age && !/^\d{1,3}$/.test(age)) return 'age';
  return { kind, caption: null, saying: { words: t(v.words), who: t(v.who), age: age ? Number(age) : null } };
}

/** SHARE-U-22: plain words for a refused send, by error.code; they say what happens to the words (A1).
 *  GUX-SK-R1/R5/R6: exact words for a bad day, signed out and switched off. */
export function kindSendMessage(e: unknown): string {
  switch (toApiError(e).code) {
    case '42501': return "This can't be sent right now. Your words are kept. Tap Cancel, or ask whoever set up your family.";
    case '23514': return DAY_SERVER;
    case 'NETWORK': return 'No internet right now. Your words are kept. Tap Send again when you are back online.';
    case 'AUTH': return "You're signed out, so this didn't send. Signing in again clears this card, so copy your words first if you need them.";
    default: return "That didn't send. Your words are kept. Tap Send again.";
  }
}

export const AGE_NOT_NUMBER = 'Type the age as a number, like 4, or leave it blank. Your words are kept.';
export const DAY_NOT_REAL = 'Type the day as year-month-day, like 2026-12-24. Your words are kept.';
const DAY_SERVER = 'The day needs to look like 2026-12-24. Your words are kept.';
/** SHARE-U-21 / GUX-SK-R8: the Saying line names the age only once one is typed (now on step 2's summary). */
export const sayingSeen = (age: string | undefined) => (has(age)
  ? 'Everyone you send this to will see these words, who said them, and the age.'
  : 'Everyone you send this to will see these words and who said them.');

/** GUX-SK-R11: the card holds words worth asking about before Cancel throws them away. */
export const kindHasWords = (v: KindWords) => Object.values(v).some(has);

/** FLOW-2: a text box with no label row, no rule and no edge. The question is its placeholder and spoken name. */
export function OpenInput({ label, placeholder, value, onChangeText, big, note, keyboardType, autoFocus, onSubmitEditing, maxLength }: {
  label: string; placeholder?: string; value: string; onChangeText: (t: string) => void; big?: boolean; note?: boolean;
  keyboardType?: 'default' | 'number-pad'; autoFocus?: boolean; onSubmitEditing?: () => void; maxLength?: number;
}) {
  const { c, type } = useTheme();
  const typing = useTypingField(); // UX-R1: the tab bar steps aside while this box is focused
  const many = !!big || !!note; // the kind's big box, or Photos' note box: several lines
  const s = big ? type.title3 : type.body;
  const input = (
    <TextInput
      testID={big ? 'share-words' : undefined}
      accessibilityLabel={label} placeholder={placeholder ?? label} placeholderTextColor={c.muted}
      value={value} onChangeText={onChangeText} multiline={many} maxLength={maxLength} keyboardType={keyboardType} autoFocus={autoFocus}
      returnKeyType={many ? undefined : 'done'} onSubmitEditing={onSubmitEditing} blurOnSubmit={!many}
      onFocus={typing.onFocus} onBlur={typing.onBlur}
      style={[styles.input, { color: c.ink, fontFamily: FONT.regular, fontSize: s.fontSize, lineHeight: s.lineHeight },
        big ? styles.inputBig : note ? styles.inputNote : styles.inputOne, noWebOutline()]}
    />
  );
  // GUX-FL-R1: a closed 3:1 outline (never a bottom line) around the box, so it reads as a place to type; Photos' note sits open on its card.
  return note ? input : <View style={[styles.outlined, { borderColor: c.tabLine }]}>{input}</View>;
}

/** FLOW-3 / FLOW-4: a quiet pill with an icon and a verb; once set, it shows the value. 48 pt (60 in Easy view). */
export function Chip({ icon, label, set, onPress }: { icon: Icon; label: string; set: boolean; onPress: () => void }) {
  const { c, type, os, bigText } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} android_ripple={{ color: c.line }}
      style={({ pressed }) => [styles.chip, { minHeight: bigText ? 60 : 48, backgroundColor: c.accentSoft, borderColor: c.tabLine, opacity: pressed && os !== 'android' ? 0.7 : 1 }]}>
      <View testID="chip-icon"><SystemIcon icon={icon} color={c.accent} /></View>
      <Text numberOfLines={2} style={[{ flexShrink: 1, color: c.ink }, set ? type.headline : type.body]}>{label}</Text>
    </Pressable>
  );
}

/** FLOW-1..4: step 1 of a kind: one big open box, then the kind's chips; a tapped chip's editor opens under them
 *  (the day's editor is the day sheet, which ShareScreen shows). */
export function KindFace({ kind, values, onChange, editing, onEdit, onDay }: {
  kind: PostKind; values: KindWords; onChange: (key: keyof KindWords, text: string) => void;
  editing: ChipKey | null; onEdit: (k: ChipKey | null) => void; onDay: () => void;
}) {
  const { c } = useTheme();
  const open = CHIPS[kind].find((x) => x.key === editing && x.editor);
  const press = (k: ChipKey) => {
    if (k === 'day') { onEdit(null); onDay(); } else onEdit(editing === k ? null : k);
  };
  return (
    <View testID={`share-kind-card-${kind}`} style={styles.face}>
      <OpenInput big label={KIND_QUESTION[kind]} value={values.words ?? ''} onChangeText={(t) => onChange('words', t)} maxLength={2000} />
      {CHIPS[kind].length ? (
        <View style={styles.chips}>
          {CHIPS[kind].map((x) => {
            const v = x.key === 'day' ? dayLabel(values.day ?? '') : x.key === 'who' ? (has(values.who) ? `Said by ${values.who!.trim()}` : '') : x.key === 'age' ? (has(values.age) ? `Age ${values.age!.trim()}` : '') : (values[x.key] ?? '').trim();
            return <Chip key={x.key} icon={x.icon} label={v || x.ask} set={!!v} onPress={() => press(x.key)} />;
          })}
        </View>
      ) : null}
      {open ? (
        <View style={[styles.editor, { borderColor: c.line }]}>
          <OpenInput key={open.key} label={open.editor!} value={values[open.key] ?? ''} autoFocus
            keyboardType={open.key === 'age' ? 'number-pad' : 'default'} maxLength={open.key === 'age' ? 3 : 120}
            onChangeText={(t) => onChange(open.key, open.key === 'age' ? t.replace(/\D/g, '').slice(0, 3) : t)}
            onSubmitEditing={() => onEdit(null)} />
          <Button variant="quiet" label={`Save ${open.editor!.toLowerCase()}`} text="Done" onPress={() => onEdit(null)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: SPACE.md - 2, marginTop: SPACE.md },
  // Option A: equal tiles, 16 px corners, the icon over its word.
  tile: { flex: 1, minHeight: 92, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.xs, paddingVertical: SPACE.md },
  // Easy view: full width, the icon left of the word, 60 pt+ tall.
  tileEasy: { alignSelf: 'stretch', flexDirection: 'row', minHeight: 60, borderRadius: 16, alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm },
  face: { gap: SPACE.lg },
  outlined: { borderWidth: 2, borderRadius: RADIUS.medium },
  input: { borderWidth: 0, borderRadius: RADIUS.medium, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md },
  inputBig: { minHeight: 160, textAlignVertical: 'top' },
  inputNote: { minHeight: 96, textAlignVertical: 'top' },
  inputOne: { minHeight: 56 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  chip: { minWidth: 48, borderWidth: 2, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill, maxWidth: '100%' },
  editor: { gap: SPACE.xs },
});
