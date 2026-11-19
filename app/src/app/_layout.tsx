// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DemoChrome } from '../demo/DemoChrome';
import { DEMO_MODE } from '../demo/flags';
import { useNotificationTaps } from '../notify/push';
import { AppProvider } from '../state/AppContext';
import { NavContext, type Nav } from '../state/nav';
import { createRuntime } from '../state/runtime';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Screen, Txt } from '../ui/kit';
import { statusBarStyle, useTheme } from '../ui/theme';

const runtime = createRuntime();

const nav: Nav = {
  // RR-15: the static-hosted demo uses /viewer?postId=… so a reload finds a file.
  openViewer: (postId, i) => router.push(DEMO_MODE
    ? { pathname: '/viewer', params: { postId, i: String(i) } }
    : { pathname: '/viewer/[postId]', params: { postId, i: String(i) } }),
  close: () => (router.canGoBack() ? router.back() : router.replace('/gallery')),
  goPhotos: () => router.replace('/gallery'),
  goFeed: () => router.replace('/feed'),
  goSignIn: (opts) => router.replace(opts?.with === 'email' ? { pathname: '/sign-in', params: { with: 'email' } } : '/sign-in'),
  goJoin: (code) => router.push({ pathname: '/join/[code]', params: { code } }),
};

/** DS-10: clock and battery readable on the picked light or dark screen. RD-87 (DEC-67): on the web, the page
 *  around the app is the paper too (html and body), so no browser white shows past the app's edges. */
function ThemedStatusBar() {
  const { dark, c } = useTheme();
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.backgroundColor = c.bg;
    document.body.style.backgroundColor = c.bg;
  }, [c.bg]);
  return <StatusBar style={statusBarStyle(dark)} />;
}

export default function RootLayout() {
  useNotificationTaps(useMemo(() => (postId: string) => nav.openViewer(postId, 0), []));
  if ('error' in runtime) {
    return <SafeAreaProvider><Screen><Txt variant="title">{runtime.error}</Txt></Screen></SafeAreaProvider>;
  }
  return (
    <SafeAreaProvider>
      <ErrorBoundary onReport={(r) => runtime.api.reportClientError(r)}>
        <AppProvider deps={runtime}>
          <NavContext.Provider value={nav}>
            <ThemedStatusBar />
            <DemoChrome>
              <Stack screenOptions={{ headerShown: false }} />
            </DemoChrome>
          </NavContext.Provider>
        </AppProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
