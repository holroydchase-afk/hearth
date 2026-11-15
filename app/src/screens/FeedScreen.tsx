// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Feed (SPEC-REDESIGN RD-17, DEC-59): today's posts list, newest first, with hearts, who can see each post by name,
// and replies. Family only, no suggestions; nothing on it is lost from the old Photos tab.
import React from 'react';
import { PhotosScreen } from './PhotosScreen';

export function FeedScreen() {
  return <PhotosScreen mode="feed" />;
}
