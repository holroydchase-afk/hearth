// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DATA-1 (DEC-87, SPEC-MEDIA 5.1 final words): asked once per phone, right after the invite code or a first sign-in,
// before Gallery. Two equal gray capsules (DS-9: neither filled, neither preselected), full width, 56 pt tall, 16 pt
// apart. No Back and no Next: tapping an answer saves it on this phone only and moves on.
import React from 'react';
import { View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Button, Screen, Txt } from '../ui/kit';
import { RADIUS } from '../ui/theme';

const ANSWER = { minHeight: 56, borderRadius: RADIUS.pill, alignSelf: 'stretch' as const };

export function DataQuestion({ onDone }: { onDone: () => void }) {
  const { setDataPrefs } = useApp();
  const answer = (saveData: boolean) => {
    setDataPrefs({ saveData });
    onDone();
  };
  return (
    <Screen>
      <Txt variant="title2" role="header">Does your phone plan come with only a little data?</Txt>
      <Txt>Prepaid plans often do. Hearth can use less of it, so it lasts the month.</Txt>
      <View style={{ gap: 16 }}>
        <Button variant="secondary" label="Yes, use less data" style={ANSWER} onPress={() => answer(true)} />
        <Button variant="secondary" label="No, my plan is fine" style={ANSWER} onPress={() => answer(false)} />
      </View>
      <Txt tone="muted">Not sure? Tap Yes. You can change this later in More, under Videos and data.</Txt>
    </Screen>
  );
}
