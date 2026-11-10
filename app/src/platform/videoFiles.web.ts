// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// VID-18 on the web: the decrypted video lives only in the tab's memory as a blob: URL (no file is written),
// revoked when the player closes or at sign-out.
import type { VideoFiles } from '../media/cache';

const urls = new Map<string, string>();

export const videoFiles: VideoFiles = {
  async write(name, bytes) {
    const old = urls.get(name);
    if (old) URL.revokeObjectURL(old);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'video/mp4' }));
    urls.set(name, url);
    return url;
  },
  async remove(name) {
    const url = urls.get(name);
    if (url) URL.revokeObjectURL(url);
    urls.delete(name);
  },
  async clear() {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
  },
};
