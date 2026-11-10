// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// HIG-12 (Apple: pair feedback with haptics): a light tap on a reaction, a success feel when a photo is saved.
// Nothing on the web. A phone with haptics off in its Settings feels nothing; failures are silent.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticKind = 'tap' | 'success';

export function haptic(kind: HapticKind): void {
  if (Platform.OS === 'web') return;
  const p = kind === 'tap'
    ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  void p.catch(() => {});
}
