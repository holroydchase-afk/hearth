// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Redesign 1b (SPEC-REDESIGN RD-9..RD-17): the screens the failing tests were written against, loaded at render
// time so typecheck stays clean before they exist. Red until the engineer adds them; then each test fails or
// passes on behavior. Once they exist, swap these for direct imports (or keep: same contract).
//   src/screens/GalleryScreen.tsx  export function GalleryScreen()  + export function titleMotion(reduceMotion: boolean): 'fade' | 'shrink'
//   src/screens/FeedScreen.tsx     export function FeedScreen()
//   src/screens/MoreScreen.tsx     export function MoreScreen()
//   src/ui/greeting.ts             export function greeting(now: Date, name: string | null): string
import React from 'react';
import { AppRoutes } from './appRoutes';

// ENG-R6: Gallery, Feed and More are the first screens of their tab's stack, and what they open (Search, the
// timeline, More's rows) is pushed on it, so tests render them at their address under expo-router.
export function GalleryScreen() {
  return <AppRoutes at="/gallery" />;
}
export function FeedScreen() {
  return <AppRoutes at="/feed" />;
}
export function MoreScreen() {
  return <AppRoutes at="/more" />;
}
export function titleMotion(reduceMotion: boolean): string {
  return (require('../screens/GalleryScreen') as { titleMotion: (r: boolean) => string }).titleMotion(reduceMotion);
}
export function greeting(now: Date, name: string | null): string {
  return (require('../ui/greeting') as { greeting: (n: Date, s: string | null) => string }).greeting(now, name);
}
