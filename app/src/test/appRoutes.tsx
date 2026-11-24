// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// ENG-R6: the app's real route files under expo-router, for tests that move between screens (More's rows, Gallery's
// Search, Feed's timeline, the phone's Back button, re-tapping a tab). Render it with renderApp, which gives it the
// app state; the root layout is a plain Stack (the real one makes its own runtime). `tabs` uses the real tab layout
// with its tab bar; without it the tabs are a plain Stack, so only the screen under test is drawn.
import { Stack } from 'expo-router';
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { getMockContext } from 'expo-router/testing-library';
import React, { useMemo } from 'react';

/** Route file (as expo-router names it) → a loader. A route file that doesn't exist yet is left out. */
const FILES: Record<string, () => unknown> = {
  '(tabs)/gallery/_layout': () => require('../app/(tabs)/gallery/_layout'),
  '(tabs)/gallery/index': () => require('../app/(tabs)/gallery/index'),
  '(tabs)/gallery/search': () => require('../app/(tabs)/gallery/search'),
  '(tabs)/gallery/birthdays': () => require('../app/(tabs)/gallery/birthdays'),
  '(tabs)/feed/_layout': () => require('../app/(tabs)/feed/_layout'),
  '(tabs)/feed/index': () => require('../app/(tabs)/feed/index'),
  '(tabs)/feed/timeline': () => require('../app/(tabs)/feed/timeline'),
  '(tabs)/share': () => require('../app/(tabs)/share'),
  '(tabs)/more/_layout': () => require('../app/(tabs)/more/_layout'),
  '(tabs)/more/index': () => require('../app/(tabs)/more/index'),
  '(tabs)/more/messages': () => require('../app/(tabs)/more/messages'),
  '(tabs)/more/groups': () => require('../app/(tabs)/more/groups'),
  '(tabs)/more/events': () => require('../app/(tabs)/more/events'),
  '(tabs)/more/birthdays': () => require('../app/(tabs)/more/birthdays'),
  '(tabs)/more/easy-view': () => require('../app/(tabs)/more/easy-view'),
  '(tabs)/more/look': () => require('../app/(tabs)/more/look'),
  '(tabs)/more/theme': () => require('../app/(tabs)/more/theme'),
  '(tabs)/more/me': () => require('../app/(tabs)/more/me'),
  '(tabs)/more/help': () => require('../app/(tabs)/more/help'),
  groups: () => require('../app/groups'),
  me: () => require('../app/me'),
  help: () => require('../app/help'),
  photos: () => require('../app/photos'),
};

const PlainStack = () => <Stack screenOptions={{ headerShown: false }} />;

function routes(tabs: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {
    _layout: { default: PlainStack },
    '(tabs)/_layout': tabs ? require('../app/(tabs)/_layout') : { default: PlainStack },
  };
  for (const [name, load] of Object.entries(FILES)) {
    try { out[name] = load(); } catch { /* not built yet */ }
  }
  return out;
}

export function AppRoutes({ at, tabs = false }: { at: string; tabs?: boolean }) {
  const context = useMemo(() => getMockContext(routes(tabs) as never), [tabs]);
  return <ExpoRoot context={context} location={at} />;
}
