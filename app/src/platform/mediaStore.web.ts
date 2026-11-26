// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// A3: the web build keeps no photo files for viewing (a shared computer is a different risk); photos load from the network.
// One narrow exception (HRT-WEB.3, ARCH-WEB-R2): a photo being SENT is kept, cleaned of Exif/GPS and sealed with the
// session key, in IndexedDB `hearth.uploads` (platform/uploadStore.web.ts) until it publishes, is removed or the person
// signs out. Nothing here changes: viewed photos are never kept.
import type { MediaStore } from '../media/diskCache';
import type { KV } from './kv';

export const fileMediaStore: MediaStore | null = null;
export const mediaKeyStore: KV | null = null;
