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

/* eslint-disable @typescript-eslint/no-require-imports */
export function GalleryScreen() {
  const M = (require('../screens/GalleryScreen') as { GalleryScreen: React.ComponentType }).GalleryScreen;
  return <M />;
}
export function FeedScreen() {
  const M = (require('../screens/FeedScreen') as { FeedScreen: React.ComponentType }).FeedScreen;
  return <M />;
}
export function MoreScreen() {
  const M = (require('../screens/MoreScreen') as { MoreScreen: React.ComponentType }).MoreScreen;
  return <M />;
}
export function titleMotion(reduceMotion: boolean): string {
  return (require('../screens/GalleryScreen') as { titleMotion: (r: boolean) => string }).titleMotion(reduceMotion);
}
export function greeting(now: Date, name: string | null): string {
  return (require('../ui/greeting') as { greeting: (n: Date, s: string | null) => string }).greeting(now, name);
}
