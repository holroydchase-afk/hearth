// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-DRAWER-1.. (Chase, Nov 27): the demo bar's contents in a drawer that opens from the bottom. The portfolio
// site's own top bar holds the "Demo" chip; it TOGGLES this drawer with window.dispatchEvent(new Event('hearth-demo-drawer')).
// The app answers with document.documentElement.dataset.hearthDemoDrawer ('open' | 'closed') and a CustomEvent
// 'hearth-demo-drawer-state' {open} on window, so the chip can keep aria-expanded in step. Public demo build, web only.
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '../ui/kit';
import type { FakeBackend } from '../api/fake/FakeBackend';
import { MIN_TARGET, useTheme } from '../ui/theme';
import { COPY, DemoActions, PHOTO_CREDIT, PORTFOLIO_URL } from './DemoBar';

export const DRAWER_EVENT = 'hearth-demo-drawer';
export const DRAWER_STATE_EVENT = 'hearth-demo-drawer-state';
const MAX_WIDTH = 560;

type FocusLike = { focus?: () => void };

export function DemoDrawer({ be, reload, startOver, open }: {
  be: FakeBackend;
  reload: () => void;
  startOver: () => void;
  open: (url: string) => void;
}) {
  const { c } = useTheme();
  const [shown, setShown] = useState(false);
  const doneRef = useRef<React.ComponentRef<typeof Pressable>>(null);
  const before = useRef<FocusLike | null>(null);
  // Web only; the jest-expo native environment has no window events (demoBarHide.test), so check for them.
  const web = Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.addEventListener === 'function';

  // The portfolio's chip toggles the drawer.
  useEffect(() => {
    if (!web) return;
    const toggle = () => setShown((s) => !s);
    window.addEventListener(DRAWER_EVENT, toggle);
    return () => window.removeEventListener(DRAWER_EVENT, toggle);
  }, [web]);

  // Tell the page (and the chip) which state the drawer is in; keep focus where a keyboard or screen-reader user expects it.
  useEffect(() => {
    if (!web) return;
    document.documentElement.dataset.hearthDemoDrawer = shown ? 'open' : 'closed';
    window.dispatchEvent(new CustomEvent(DRAWER_STATE_EVENT, { detail: { open: shown } }));
    if (shown) {
      before.current = (document.activeElement as FocusLike | null) ?? null;
      (doneRef.current as unknown as FocusLike | null)?.focus?.();
    } else if (before.current) {
      before.current.focus?.();
      before.current = null;
    }
  }, [web, shown]);

  // Esc closes it (WAI-ARIA dialog).
  useEffect(() => {
    if (!web || !shown) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShown(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [web, shown]);

  if (!web || !shown) return null;
  return (
    <View style={styles.layer} pointerEvents="box-none">
      <Pressable testID="demo-drawer-scrim" role="button" aria-label="Close demo info" tabIndex={-1} onPress={() => setShown(false)} style={styles.scrim} />
      <View
        testID="demo-drawer-sheet"
        role="dialog"
        aria-modal
        aria-label="Demo info"
        style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.line }]}
      >
        <View aria-hidden style={[styles.grab, { backgroundColor: c.line }]} />
        <View style={styles.title}>
          <View style={[styles.badge, { borderColor: c.ink }]}>
            <Txt variant="headline" style={styles.badgeText}>DEMO</Txt>
          </View>
          <Txt variant="headline">Sample data</Txt>
        </View>
        <Txt style={styles.copy}>{COPY}</Txt>
        <Txt tone="muted" style={styles.copy}>{PHOTO_CREDIT}</Txt>
        <DemoActions be={be} reload={reload} startOver={startOver} />
        <Pressable role="link" aria-label="Back to the Hearth case study" onPress={() => open(PORTFOLIO_URL)} style={styles.link}>
          <Txt style={{ color: c.accent }}>← Back to the Hearth case study</Txt>
        </Pressable>
        <Pressable
          ref={doneRef}
          role="button"
          aria-label="Done"
          onPress={() => setShown(false)}
          style={[styles.done, { borderColor: c.line }]}
        >
          <Txt style={{ color: c.ink }}>Done</Txt>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end', alignItems: 'center', zIndex: 1000 },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { width: '100%', maxWidth: MAX_WIDTH, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 22, gap: 10, maxHeight: '88%' },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 4 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8 },
  badgeText: { letterSpacing: 0.8 },
  copy: { maxWidth: MAX_WIDTH },
  link: { minHeight: MIN_TARGET, justifyContent: 'center' },
  done: { minHeight: MIN_TARGET, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderRadius: 12 },
});
