// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// ENG-R6: More → Easy view, its own screen in More's stack.
import React from 'react';
import { MoreRowGate, MorePreference } from '../../../screens/MoreScreen';
export default function EasyViewRoute() {
  return <MoreRowGate row="easyView"><MorePreference which="easyView" /></MoreRowGate>;
}
