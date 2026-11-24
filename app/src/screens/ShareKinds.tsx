// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SHARE-ST-30..33 (SPEC-REDESIGN 1j-2 round 4, DEC-84; look: option A of the Nov 20 kinds tester): under Share's empty
// postcard, a row of three kinds (Event, News, Saying) for parents, behind the post_kinds feature. A tap shows that
// kind's empty card face with a disabled "Pick who gets it". Nothing is saved here: the composer thread
// (SPEC-VISIBILITY-CORE.md) wires the data and what each kind sends.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Field, SystemIcon, Txt, type Icon } from '../ui/kit';
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

/** SHARE-ST-31: a kind's empty card face (tester option A): its fields, "To:" and a disabled "Pick who gets it". */
export function KindCard({ kind }: { kind: PostKind }) {
  const { c, type, dark } = useTheme();
  const [v, setV] = useState<Record<string, string>>({});
  const field = (label: string, multiline = false) => (
    <Field key={label} underline label={label} value={v[label] ?? ''} multiline={multiline}
      onChangeText={(x) => setV((o) => ({ ...o, [label]: x }))} />
  );
  const rule = { height: 1, backgroundColor: c.tabLine };
  return (
    <View style={styles.face}>
      <View testID={`share-kind-card-${kind}`} style={[styles.card, { backgroundColor: c.surface }, photoShadow(dark)]}>
        {kind === 'event' ? <>{field("What's happening")}{field('When')}{field('Where, optional')}</> : null}
        {kind === 'news' ? field('Your news', true) : null}
        {kind === 'saying' ? (
          <>
            <Txt variant="title2" tone="accent" style={styles.quote}>{'“'}</Txt>
            {field('What they said', true)}
            {field('Who said it')}
            {field('Age then, optional')}
          </>
        ) : null}
        <View style={styles.toRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
          <Text accessible={false} style={{ ...type.headline, color: c.muted }}>To:</Text>
          <View style={[rule, styles.toRule]} />
        </View>
      </View>
      <Button label="Pick who gets it" onPress={() => {}} disabled />
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
