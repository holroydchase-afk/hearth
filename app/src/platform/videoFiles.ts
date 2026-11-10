// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// VID-18 (SPEC-MEDIA 4.1): a decrypted video for the player, as a file in the app's cache folder (expo-video plays
// files, not bytes in memory). Named `<media_id>.mp4`. Deleted when the player closes, at sign-out, and at start-up
// for any left behind by a crash; the phone may also clear the folder when space is low.
import { Directory, File, Paths } from 'expo-file-system';
import type { VideoFiles } from '../media/cache';

const dir = () => new Directory(Paths.cache, 'hearth-video');
const safe = (n: string) => /^[A-Za-z0-9-]+\.mp4$/.test(n);

export const videoFiles: VideoFiles = {
  async write(name, bytes) {
    if (!safe(name)) throw new Error('bad name');
    const d = dir();
    if (!d.exists) d.create({ intermediates: true, idempotent: true });
    const f = new File(d, name);
    if (f.exists) f.delete();
    f.create();
    f.write(bytes);
    return f.uri;
  },
  async remove(name) {
    if (!safe(name)) return;
    const f = new File(dir(), name);
    if (f.exists) f.delete();
  },
  async clear() {
    const d = dir();
    if (d.exists) d.delete();
  },
};
