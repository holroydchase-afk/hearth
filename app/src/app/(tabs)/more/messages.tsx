// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// ENG-R6: More → Messages, its own screen in More's stack.
import React from 'react';
import { MoreRowGate, backToMore } from '../../../screens/MoreScreen';
import { MessagesScreen } from '../../../screens/MessagesScreen';
export default function MessagesRoute() {
  return <MoreRowGate row="messages"><MessagesScreen backTo="More" onClose={backToMore} /></MoreRowGate>;
}
