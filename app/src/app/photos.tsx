// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-10: Photos became Gallery (SPEC-REDESIGN 1b). Old links and bookmarks to /photos land on Gallery.
import { Redirect } from 'expo-router';
import React from 'react';
export default function OldPhotos() {
  return <Redirect href="/gallery" />;
}
