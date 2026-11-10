// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// VID-14 (SPEC-MEDIA 4.1): one frame of a picked video, as a local JPEG, for its poster.
// expo-video grabs the frame (a native image, never written by us); expo-image-manipulator writes it as a JPEG,
// which prepare.ts then re-encodes, cleans and verifies through the photo thumb steps. The frame and the player
// are released either way. Returns null when no frame comes back; the web build throws here (expo-video can't
// make thumbnails on the web yet), and the caller uses the placeholder poster. Never logs the uri.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createVideoPlayer } from 'expo-video';

export async function makePoster(videoUri: string, atMs: number): Promise<string | null> {
  const player = createVideoPlayer(videoUri);
  try {
    const [frame] = await player.generateThumbnailsAsync(atMs / 1000);
    if (!frame) return null;
    try {
      const img = await ImageManipulator.manipulate(frame).renderAsync();
      try {
        const saved = await img.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
        return saved.uri;
      } finally {
        img.release();
      }
    } finally {
      frame.release();
    }
  } finally {
    player.release();
  }
}
