// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// B19: /more?open=groups|me|help (old tab links) opens that row, if the role has it.
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { MoreScreen } from '../../screens/MoreScreen';
export default function More() {
  const { open } = useLocalSearchParams<{ open?: string }>();
  return <MoreScreen initialOpen={typeof open === 'string' ? open : undefined} />;
}
