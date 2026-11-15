// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// B19 (QA-R1): the old Help tab moved into More (SPEC-REDESIGN 1b). Old links and bookmarks to /help land on
// More's Help row; MoreScreen keeps the role rules (a viewer asking for Groups gets the More menu).
import { Redirect } from 'expo-router';
import React from 'react';
export default function OldHelp() {
  return <Redirect href={{ pathname: '/more', params: { open: 'help' } }} />;
}
