// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// CAL-14/15 (SPEC-LIFE-CALENDAR): More → Birthdays, "Birthdays and dates", its own screen in More's stack.
import React from 'react';
import { BirthdaysScreen } from '../../../screens/Birthdays';
import { MoreRowGate } from '../../../screens/MoreScreen';
export default function BirthdaysRoute() {
  return <MoreRowGate row="birthdays"><BirthdaysScreen /></MoreRowGate>;
}
