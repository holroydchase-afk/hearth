// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// HRT-WEB.3: the shape of the web upload byte store (platform/uploadStore.web.ts), shared with the phone no-op.
import type { Prepared, QueueItem } from '../upload/queue';

/** Codes the store reports (code only: no sizes, names or bytes). */
export type UploadStoreReport = 'upload_store_full' | 'upload_store_blocked';

export interface UploadStore {
  stage(items: QueueItem[], prepare: (item: QueueItem) => Promise<Prepared>, onProgress?: (done: number, total: number) => void): Promise<{ items: QueueItem[]; durable: boolean }>;
  open(uri: string): Promise<Prepared | null>;
  has(uri: string): Promise<boolean>;
  /** True when the item is kept in memory only this visit (nothing saved; closing Chrome would lose it). */
  memoryOnly(uri: string): boolean;
  release(uris: string[]): Promise<void>;
  sweep(liveUris: string[]): Promise<void>;
  wipe(): Promise<void>;
}
