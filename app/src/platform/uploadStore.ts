// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// HRT-WEB.3: phones keep `file://` URIs that already survive a restart, so there is no byte store (uploadStore.web.ts
// is the web one). The runtime gets null here and nothing about the queue changes.
import type { UploadStore, UploadStoreReport } from './uploadStoreTypes';

export type { UploadStore, UploadStoreReport };
export function createWebUploadStore(_report: (code: UploadStoreReport) => void): UploadStore | null {
  return null;
}
