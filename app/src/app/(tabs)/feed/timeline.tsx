// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// BETA-TIME-1/2 / ENG-R6: the photos by date, opened from Feed's "Older photos" card at a month; "Back to Feed"
// returns there.
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { AppGate } from '../../../screens/AppGate';
import { TimelineScreen } from '../../../screens/TimelineScreen';
import { useApp } from '../../../state/AppContext';
const close = () => router.dismissTo('/feed');
export default function Timeline() {
  const app = useApp();
  const { startAt } = useLocalSearchParams<{ startAt?: string }>();
  if (app.status !== 'ready' || !app.space) return <AppGate />;
  return <TimelineScreen startAt={typeof startAt === 'string' && startAt ? startAt : null} onClose={close} backTo="Feed" />;
}
