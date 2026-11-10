// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// QueueItem -> bytes + sign-media spec, using the real pipeline.
//
// Video (SPEC-MEDIA 4.1, VID-14..17): the cleaned MP4 is `display` and a JPEG poster is `thumb`; no migration.
// The length is checked before anything is read (VIDEO_TOO_LONG); the file is cleaned and verified (FLAG-7,
// cleanVideo.ts) and fails closed with EXIF if it can't be read. The poster is expo-video's frame at 1 s (the
// first frame for clips under 1 s), re-encoded through the photo thumb steps so it carries no Exif. If no frame
// can be made (web, a codec the phone can't decode), the bundled plain dark placeholder is cleaned and used and
// the video still sends (staff-pm call, A1); nothing about the file is logged. Whether video is offered at all is
// the server's video_posting feature (FLAG-5, my_features); sign-media refuses video while it is off (FLAG-4), and
// it stays off in production until FLAG-7's manual check and Chase's word (VID-22).
import { encryptedSize } from '../crypto/media';
import { readBytes } from '../platform/bytes';
import type { Prepared, QueueItem } from '../upload/queue';
import { cleanImage, verifyClean } from './clean';
import { makePoster } from './expoPoster';
import { expoManipulator } from './expoManipulator';
import { buildUploadSpec, checkVideo, processPhoto, processPoster, processVideo, type Manipulator } from './pipeline';
import { placeholderPoster } from './videoPosterPlaceholder';

export interface PrepareDeps {
  readBytes: (uri: string) => Promise<Uint8Array>;
  manipulator: Manipulator;
  /** A local JPEG of the frame at `atMs`, or null (expoPoster.ts). */
  makePoster: (videoUri: string, atMs: number) => Promise<string | null>;
  /** Bytes of app/assets/video-poster.jpg. */
  placeholderPoster: () => Promise<Uint8Array>;
}

// Read when called, not at load, so tests that swap a module still get theirs.
const defaultDeps = (): PrepareDeps => ({ readBytes, manipulator: expoManipulator, makePoster, placeholderPoster });

/** About 1 s in, past a fade from black; the first frame for shorter clips. */
const POSTER_AT_MS = 1000;

/** The poster, and its shape (only used when the picker gave no video size; the database wants 1 or more). */
async function poster(item: QueueItem, deps: PrepareDeps): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const atMs = (item.durationMs ?? 0) < POSTER_AT_MS ? 0 : POSTER_AT_MS;
  try {
    const frame = await deps.makePoster(item.uri, atMs);
    if (frame) return await processPoster(frame, deps);
  } catch {
    // VID-17: no frame (or it wouldn't re-encode). Fall through to the placeholder; nothing is logged.
  }
  const bytes = cleanImage(await deps.placeholderPoster());
  verifyClean(bytes);
  return { bytes, width: 16, height: 9 };
}

export async function prepareItem(item: QueueItem, deps: PrepareDeps = defaultDeps()): Promise<Prepared> {
  if (item.kind === 'video') {
    checkVideo({ durationMs: item.durationMs ?? null });
    const v = await processVideo({ uri: item.uri, durationMs: item.durationMs }, deps);
    const p = await poster(item, deps);
    const thumb = p.bytes;
    return {
      display: v.bytes,
      thumb,
      spec: {
        kind: 'video', mime_type: v.mime_type, width: item.width || p.width, height: item.height || p.height, duration_ms: v.duration_ms,
        byte_size: encryptedSize(v.bytes.length), thumb_byte_size: encryptedSize(thumb.length), exif_stripped: true,
      },
    };
  }
  const p = await processPhoto({ uri: item.uri }, deps);
  return { spec: buildUploadSpec(p), display: p.display.bytes, thumb: p.thumb.bytes };
}
