// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// ENG-R6: More → Groups, its own screen in More's stack.
import React from 'react';
import { MoreRowGate, backToMore } from '../../../screens/MoreScreen';
import { GroupsScreen } from '../../../screens/GroupsScreen';
export default function GroupsRoute() {
  return <MoreRowGate row="groups"><GroupsScreen onBack={backToMore} /></MoreRowGate>;
}
