// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// CAL-14/15 (SPEC-LIFE-CALENDAR): More → Birthdays, "Birthdays and dates", its own screen in More's stack.
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { BirthdaysScreen } from '../../../screens/Birthdays';
import { MoreRowGate } from '../../../screens/MoreScreen';
export default function BirthdaysRoute() {
  const { add } = useLocalSearchParams<{ add?: string }>(); // Me > My birthday opens the form (CAL-S2)
  return <MoreRowGate row="birthdays"><BirthdaysScreen startMine={add === 'mine'} /></MoreRowGate>;
}
