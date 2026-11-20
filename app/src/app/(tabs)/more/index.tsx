// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// B19: /more?open=groups|me|help (an old tab link) opens that row, if the role has it (ENG-R6: as its own screen).
import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { MoreScreen, rowPath, startRow } from '../../../screens/MoreScreen';
import { useApp } from '../../../state/AppContext';
export default function More() {
  const { open } = useLocalSearchParams<{ open?: string }>();
  const row = startRow(useApp().space?.role, typeof open === 'string' ? open : undefined);
  return row ? <Redirect href={rowPath(row)} withAnchor /> : <MoreScreen />;
}
