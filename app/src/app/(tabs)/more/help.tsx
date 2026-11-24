// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// ENG-R6: More → Help, its own screen in More's stack.
import React from 'react';
import { MoreRowGate, backToMore } from '../../../screens/MoreScreen';
import { HelpScreen } from '../../../screens/HelpScreen';
export default function HelpRoute() {
  return <MoreRowGate row="help"><HelpScreen onBack={backToMore} /></MoreRowGate>;
}
