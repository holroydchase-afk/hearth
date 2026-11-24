// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-6 (RR-6): on a laptop, the demo shows the app at phone width beside a short panel for the
// hiring manager: what Hearth is, who it's for, what to try. On a phone it's just the app.
// UI-2: the phone sits centred with a soft shadow, and the panel ends in proof points and one link.
import React, { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Txt } from '../ui/kit';
import { BigTextContext, useTheme } from '../ui/theme';
import { PHOTO_CREDIT, PORTFOLIO_URL } from './DemoBar';

export const APP_COLUMN = 430;
export const WIDE = 900;

// DEMO-NEW-6: the newest features first (New for you, DEC-58; Search, DEC-56).
const TRY = [
  'Tap a photo under New for you. You get what the family sent since your last visit, one post at a time.',
  'Tap See it as Grandma Jo below. She sees only what was shared with her side of the family.',
  'Tap Search and type lake. It looks at the words people wrote, never inside the photos.',
];
const PROOF = ['Private by name', 'Stored in the US', 'No ads, no AI training'];

export function DemoFrame({ width, children, open = () => {}, controls }: {
  width: number; children: ReactNode; open?: (url: string) => void;
  /** DEMO-BAR-LAPTOP-1: Grandma Jo's view and Reset, shown under Try this (the laptop has no demo bar). */
  controls?: ReactNode;
}) {
  const { c, dark } = useTheme();
  if (width < WIDE) return <>{children}</>;
  return (
    <View testID="demo-frame" style={[styles.row, { backgroundColor: c.bg }]}>
      {/* DEMO-EASY-1: Easy view (Grandma Jo) enlarges only the app in the phone column, never this panel. */}
      <BigTextContext.Provider value={false}>
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelWords}>
        <Txt tone="muted">Hearth (working name) · demo</Txt>
        <Txt variant="title1" role="header">A private photo app for split families</Txt>
        <Txt>Every photo goes only to the people you pick, by name. Built for grandparents who stay off social media: big text, words under every icon, no passwords.</Txt>
        <View style={styles.proof}>
          {PROOF.map((p) => (
            <View key={p} style={[styles.pill, { backgroundColor: c.surface, borderColor: c.line }]}><Txt variant="headline">{p}</Txt></View>
          ))}
        </View>
        <Txt variant="title2" role="header">Try this</Txt>
        {TRY.map((t, i) => <Txt key={t}>{`${i + 1}. ${t}`}</Txt>)}
        {controls}
        <Button variant="quiet" role="link" label="Read the case study on chaseholroyd.com" text="Read the case study" onPress={() => open(PORTFOLIO_URL)} style={styles.cta} />
        <Txt tone="muted">Built test-first by Chase Holroyd, a product manager, with a team of AI agents. The family here is made up and stays in this browser.</Txt>
        {/* DEMO-PHOTO-14: a laptop has no Demo bar, so the photo credit sits here too. */}
        <Txt tone="muted">{PHOTO_CREDIT}</Txt>
      </ScrollView>
      </BigTextContext.Provider>
      {/* DARK-ELEV-4: in dark the column is a surface step lighter than the page, with no shadow. */}
      <View
        testID="demo-app-column"
        style={[styles.app, { width: APP_COLUMN, borderColor: c.line, backgroundColor: dark ? c.surface : c.bg }, dark ? null : { boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 56, padding: 24 },
  // TD-UX-R1: on a short laptop screen the panel scrolls inside its own column instead of being cut top and bottom.
  // The row centers it; maxHeight keeps it inside the row, so its top line is never above the screen.
  panel: { width: 420, maxHeight: '100%', flexGrow: 0 },
  panelWords: { gap: 16 },
  proof: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  cta: { alignSelf: 'flex-start' },
  app: { height: '100%', maxHeight: 880, borderWidth: StyleSheet.hairlineWidth, borderRadius: 28, overflow: 'hidden' },
});
