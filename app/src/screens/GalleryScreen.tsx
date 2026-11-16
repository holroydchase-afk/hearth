// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Gallery (SPEC-REDESIGN RD-10..RD-13, RD-18..RD-23): the start screen. It is the
// greeting and the Search / By date top bar, New for you (RD-19..21), then the photo grid (RD-18, redesign 1c).
import React from 'react';
import { PhotosScreen } from './PhotosScreen';

export { titleMotion } from './GalleryTop';

export function GalleryScreen() {
  return <PhotosScreen mode="gallery" />;
}
