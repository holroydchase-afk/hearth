// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// ENG-R6: More → Me, its own screen in More's stack.
import React from 'react';
import { MoreRowGate, backToMore } from '../../../screens/MoreScreen';
import { MeScreen } from '../../../screens/MeScreen';
export default function MeRoute() {
  return <MoreRowGate row="me"><MeScreen onBack={backToMore} /></MoreRowGate>;
}
