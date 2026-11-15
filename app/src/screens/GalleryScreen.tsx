// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Gallery (SPEC-REDESIGN RD-10..RD-13): the start screen. For now (1b) it is today's opening content under the
// greeting and the Search / By date top bar: New for you, All photos, then the posts. 1c makes it the photo grid.
import React from 'react';
import { PhotosScreen } from './PhotosScreen';

export { titleMotion } from './GalleryTop';

export function GalleryScreen() {
  return <PhotosScreen mode="gallery" />;
}
