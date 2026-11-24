// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SHARE-ST-30..33 (SPEC-REDESIGN 1j-2 round 4, DEC-84; look: option A of the Nov 20 kinds tester): under Share's empty
// postcard, a row of three kinds (Event, News, Saying) for parents, behind the post_kinds feature. A tap shows that
// kind's card face. SHARE-U-17..23 (SPEC-VISIBILITY-CORE "One Share composer"): ShareScreen holds the card's words,
// opens the photo flow's who-gets-it tiles once the required fields hold words, and sends one post of that kind.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CreatePostArgs } from '../api/HearthApi';
import { toApiError } from '../errors/messages';
import { Field, SystemIcon, Txt, type Icon } from '../ui/kit';
import { RADIUS, SPACE, photoShadow, useTheme } from '../ui/theme';

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
          <Text testID={`share-kind-word-${K.kind}`} style={{ ...type.subheadline, color: c.ink, textAlign: easy ? 'left' : 'center' }}>{K.word}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export type KindWords = Record<string, string>;

/** Each kind's fields, in order; the required ones must hold words (spaces alone don't count). SHARE-U-17. */
const FIELDS: Record<PostKind, { label: string; required: boolean; multiline?: boolean }[]> = {
  event: [{ label: "What's happening", required: true }, { label: 'When', required: true }, { label: 'Where, optional', required: false }],
  news: [{ label: 'Your news', required: true, multiline: true }],
  saying: [{ label: 'What they said', required: true, multiline: true }, { label: 'Who said it', required: true }, { label: 'Age then, optional', required: false }],
};

const has = (v: string | undefined) => !!v && v.trim().length > 0;

/** SHARE-U-17: every required field of this kind holds words. */
export function kindFilled(kind: PostKind, v: KindWords): boolean {
  return FIELDS[kind].every((f) => !f.required || has(v[f.label]));
}

/** SHARE-U-19: the createPost fields for this kind (news words are the caption), or 'age' when the age isn't a number. */
export function kindDetails(kind: PostKind, v: KindWords): Pick<CreatePostArgs, 'kind' | 'caption' | 'event' | 'saying'> | 'age' {
  const t = (l: string) => (v[l] ?? '').trim();
  if (kind === 'news') return { kind, caption: t('Your news') };
  if (kind === 'event') return { kind, caption: null, event: { what: t("What's happening"), when: t('When'), where: t('Where, optional') || null } };
  const age = t('Age then, optional');
  if (age && !/^\d{1,3}$/.test(age)) return 'age';
  return { kind, caption: null, saying: { words: t('What they said'), who: t('Who said it'), age: age ? Number(age) : null } };
}

/** SHARE-U-22: plain words for a refused send, by error.code; they always say the words were kept (A1). */
export function kindSendMessage(e: unknown): string {
  switch (toApiError(e).code) {
    case '42501': return 'Events, news and sayings are switched off for this family right now. Your words are kept.';
    case '23514': return 'Something in the card needs a look, like the date (2026-10-31). Your words are kept.';
    case 'NETWORK': return 'No internet right now. Your words are kept. Tap Send again when you are back online.';
    case 'AUTH': return 'Please sign in again. Your words are kept on this screen until you leave it.';
    default: return "That didn't send. Your words are kept. Tap Send again.";
  }
}

export const AGE_NOT_NUMBER = 'Type the age as a number, like 4, or leave it blank. Your words are kept.';
export const SAYING_SEEN = 'Everyone you send this to will see who said it.';

/** SHARE-ST-31 / SHARE-U-17..21: a kind's card face (tester option A): its fields, then "To:". Before the picker
 *  opens, "To:" is a blank ruled line; once open, `to` holds the photo flow's face tiles. */
export function KindCard({ kind, values, onChange, to }: { kind: PostKind; values: KindWords; onChange: (label: string, text: string) => void; to?: React.ReactNode }) {
  const { c, type, dark } = useTheme();
  const field = (f: { label: string; multiline?: boolean }) => (
    <Field key={f.label} underline label={f.label} value={values[f.label] ?? ''} multiline={f.multiline}
      onChangeText={(x) => onChange(f.label, x)} />
  );
  const rule = { height: 1, backgroundColor: c.tabLine };
  return (
    <View style={styles.face}>
      <View testID={`share-kind-card-${kind}`} style={[styles.card, { backgroundColor: c.surface }, photoShadow(dark)]}>
        {kind === 'saying' ? <Txt variant="title2" tone="muted" style={styles.quote}>{'\u201c'}</Txt> : null}
        {FIELDS[kind].map(field)}
        {/* SHARE-U-21 (PRIV-VC-D1): say it before sending, where a screen reader reaches it. */}
        {kind === 'saying' ? <Txt tone="muted">{SAYING_SEEN}</Txt> : null}
        {to ?? (
          <View style={styles.toRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
            <Text accessible={false} style={{ ...type.headline, color: c.muted }}>To:</Text>
            <View style={[rule, styles.toRule]} />
          </View>
        )}
      </View>
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
  card: { borderRadius: RADIUS.photo, padding: SPACE.lg, gap: SPACE.md },
  quote: { marginBottom: -SPACE.sm },
  toRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: SPACE.sm, paddingBottom: 6 },
  toRule: { flex: 1, marginBottom: 6 },
});
