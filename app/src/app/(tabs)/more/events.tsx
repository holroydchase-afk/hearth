// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// ENG-R6: More → Events, its own screen in More's stack.
import React from 'react';
import { MoreRowGate, MoreEvents } from '../../../screens/MoreScreen';
export default function EventsRoute() {
  return <MoreRowGate row="events"><MoreEvents /></MoreRowGate>;
}
