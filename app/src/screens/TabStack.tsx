// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// ENG-R6: the stack inside a tab (Gallery, Feed, More). No header (each screen draws its own title and labeled
// Back button); iPhone's swipe back stays on. The paper shows behind a screen as it slides.
import { Stack } from 'expo-router';
import React from 'react';
import { useTheme } from '../ui/theme';
export function TabStack() {
  const { c } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }} />;
}
