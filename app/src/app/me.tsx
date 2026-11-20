// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// B19 (QA-R1): the old Me tab moved into More (SPEC-REDESIGN 1b). Old links and bookmarks to /me land on
// More's Me row: since ENG-R6 its own screen in More's stack, with the menu under it. The row's route keeps
// the role rules (a viewer asking for Groups gets the More menu).
import { Redirect } from 'expo-router';
import React from 'react';
export default function OldMe() {
  return <Redirect href="/more/me" withAnchor />;
}
