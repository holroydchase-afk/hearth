// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// The demo build's frame around the app (web only): on a phone the demo bar above every screen; on a
// laptop the phone-width column beside the story panel (DemoFrame).
import React, { useState, type ReactNode } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import type { FakeBackend } from '../api/fake/FakeBackend';
import { Txt } from '../ui/kit';
import { DemoActions, DemoBar } from './DemoBar';
import { DemoFrame, WIDE } from './DemoFrame';
import { DEMO_MODE } from './flags';
import { webStorage } from '../platform/webStorage';
import { demoKeysToClear } from './seed';
import { BigTextContext } from '../ui/theme';

const BASE = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
const goPhotos = () => window.location.assign(`${BASE}/gallery`);

// DEMO-BAR: after Reset demo the drawer opens once and says the sample data is back.
const RESTORED = 'hearthDemoRestored';
function takeRestored(): boolean {
  try {
    const was = window.sessionStorage.getItem(RESTORED) === '1';
    window.sessionStorage.removeItem(RESTORED);
    return was;
  } catch { return false; }
}

function startOver() {
  try { window.sessionStorage.setItem(RESTORED, '1'); } catch { /* no note, still a fresh family */ }
  try {
    const ls = webStorage();
    if (!ls) throw new Error('storage blocked');
    const keys = Array.from({ length: ls.length }, (_, i) => ls.key(i)).filter((k): k is string => k != null);
    for (const k of demoKeysToClear(keys)) ls.removeItem(k);
  } catch { /* storage blocked: the reload still starts a fresh family in memory */ }
  goPhotos();
}

export function DemoChrome({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const be = (globalThis as { __hearthFake?: FakeBackend }).__hearthFake;
  const [restored] = useState(() => DEMO_MODE && Platform.OS === 'web' && takeRestored());
  if (!DEMO_MODE || Platform.OS !== 'web' || !be) return <>{children}</>;
  const open = (url: string) => window.location.assign(url);
  // DEMO-BAR-LAPTOP-1 (Chase, Nov 19): on a laptop the story panel already says "demo" and links back, so the bar
  // goes and its controls sit in the panel. The phone keeps the slim bar.
  if (width >= WIDE) {
    return (
      <DemoFrame
        width={width}
        open={open}
        controls={(
          <View style={{ gap: 8 }}>
            {restored && <Txt variant="strong">Sample data restored.</Txt>}
            <DemoActions be={be} reload={goPhotos} startOver={startOver} />
          </View>
        )}
      >
        {children}
      </DemoFrame>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      {/* DEMO-EASY-1: the demo bar is the demo's, not the app's, so Easy view doesn't enlarge it. */}
      <BigTextContext.Provider value={false}>
        <DemoBar be={be} reload={goPhotos} startOver={startOver} open={open} restored={restored} />
      </BigTextContext.Provider>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
