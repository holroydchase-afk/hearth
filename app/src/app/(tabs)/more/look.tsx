// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// ENG-R6: More → Light or dark, its own screen in More's stack.
import React from 'react';
import { MoreRowGate, MorePreference } from '../../../screens/MoreScreen';
export default function LookRoute() {
  return <MoreRowGate row="look"><MorePreference which="look" /></MoreRowGate>;
}
