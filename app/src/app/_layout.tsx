// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import { Stack, router } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DemoChrome } from '../demo/DemoChrome';
import { DEMO_MODE } from '../demo/flags';
import { useNotificationTaps } from '../notify/push';
import { AppProvider } from '../state/AppContext';
import { NavContext, type Nav } from '../state/nav';
import { createRuntime } from '../state/runtime';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { Screen, Txt } from '../ui/kit';
import { FONT_FILES, statusBarStyle, useTheme } from '../ui/theme';

const runtime = createRuntime();

const nav: Nav = {
  // RR-15: the static-hosted demo uses /viewer?postId=… so a reload finds a file.
  openViewer: (postId, i) => router.push(DEMO_MODE
    ? { pathname: '/viewer', params: { postId, i: String(i) } }
    : { pathname: '/viewer/[postId]', params: { postId, i: String(i) } }),
  close: () => (router.canGoBack() ? router.back() : router.replace('/photos')),
  goPhotos: () => router.replace('/photos'),
  goSignIn: (opts) => router.replace(opts?.with === 'email' ? { pathname: '/sign-in', params: { with: 'email' } } : '/sign-in'),
  goJoin: (code) => router.push({ pathname: '/join/[code]', params: { code } }),
};

/** DS-10: clock and battery readable on the picked light or dark screen. */
function ThemedStatusBar() {
  return <StatusBar style={statusBarStyle(useTheme().dark)} />;
}

export default function RootLayout() {
  useNotificationTaps(useMemo(() => (postId: string) => nav.openViewer(postId, 0), []));
  // DS-12: wait for Atkinson Hyperlegible (bundled, no network). If it ever fails, go on with the phone's font.
  const [fontsReady, fontError] = useFonts(FONT_FILES);
  if (!fontsReady && !fontError) return null;
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
