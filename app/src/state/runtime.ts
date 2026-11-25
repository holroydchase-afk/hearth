// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Builds the app's dependencies. EXPO_PUBLIC_HEARTH_FAKE=1 → in-memory FakeApi (web smoke test,
// demos); otherwise SupabaseApi against EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.
import { createClient } from '@supabase/supabase-js';
import { Linking, Platform } from 'react-native';
import { DEMO_MODE } from '../demo/flags';
import { SupabaseApi } from '../api/SupabaseApi';
import { pickBulk, pickPhotos } from '../media/pick';
import { expoManipulator } from '../media/expoManipulator';
import { prepareItem } from '../media/prepare';
import { makePreviewBytes } from '../media/preview';
import { readBytes } from '../platform/bytes';
import { fileMediaStore, mediaKeyStore } from '../platform/mediaStore';
import { videoFiles } from '../platform/videoFiles';
import { saveToPhone } from '../platform/saveToPhone';
import { createWebUploadStore } from '../platform/uploadStore';
import { secureSessionStorage } from '../platform/secureSession';
import { asyncStorageKV } from '../platform/storage';
import type { AppDeps } from './AppContext';
import { ApiError } from '../api/HearthApi';
import { errorReport } from '../errors/report';
import type { HearthApi } from '../api/HearthApi';
import { createFakeApi } from './fakeRuntime';

export const FAKE_MODE = process.env.EXPO_PUBLIC_HEARTH_FAKE === '1' || DEMO_MODE;

// HRT-WEB.1 (WEB-APP-6): the web store seals the session and the messenger store and can wipe them all at
// sign-out; the phone store has no clear (its values go with their own keys).
const sessionStore = secureSessionStorage as { clear?: () => Promise<void> };

/**
 * HRT-WEB.3: the web build's upload byte store, wired to the queue and the picker's "prepare". On phones the platform
 * module gives null and everything stays as it was. `prepare` (the queue's) opens a saved photo and refuses to
 * re-read anything else that is not a `hearth-q:` uri; staging runs the real pipeline once, before the job is saved.
 */
function webUploads(api: HearthApi): { uploadStore: NonNullable<AppDeps['uploadStore']>; prepare: AppDeps['prepare']; clear: () => Promise<void> } | null {
  const store = createWebUploadStore((code) => {
    // code only (no sizes, names or bytes): errorReport sends the error's type and code
    const e = Object.assign(new Error(code), { name: 'UploadStore', code });
    try { api.reportClientError(errorReport(e, 'upload')).catch(() => {}); } catch { /* reporting never blocks sharing */ }
  });
  if (!store) return null;
  return {
    uploadStore: {
      stage: (items, onProgress) => store.stage(items, prepareItem, onProgress),
      has: (uri) => store.has(uri),
      release: (job) => store.release(job.items.map((i) => i.uri)),
      sweep: (uris) => store.sweep(uris),
      memoryOnly: (uri) => store.memoryOnly(uri),
    },
    prepare: async (item) => {
      if (!item.uri.startsWith('hearth-q:')) return prepareItem(item); // Fake-build video: blob:, memory-only
      const p = await store.open(item.uri);
      if (!p) throw new ApiError('UNKNOWN', 'saved photo missing');
      return p;
    },
    clear: () => store.wipe(),
  };
}

export function createRuntime(): AppDeps | { error: string } {
  // WEB-APP-34: gate on the build kind (a real backend), not on the platform alone, so the demo still shows video (VID-18).
  const realWeb = Platform.OS === 'web' && !FAKE_MODE;
  const common = {
    kv: asyncStorageKV,
    prepare: prepareItem,
    pickPhotos: (opts: { videos: boolean }) => pickPhotos(10, realWeb ? { videos: false } : opts),
    pickBulk: (opts?: { videos: boolean }) => pickBulk(realWeb || (Platform.OS === 'web' && !opts?.videos) ? { videos: false, imagesOnly: true } : opts), // web: no video in the chooser unless offered
    ...(realWeb ? { noVideo: true } : {}),
    previewBytes: makePreviewBytes(expoManipulator, readBytes),
    saveToPhone,
    openUrl: (u: string) => Linking.openURL(u),
    // A3: kept photo files on phones only; the web build keeps none.
    mediaDisk: fileMediaStore && mediaKeyStore ? { store: fileMediaStore, keys: mediaKeyStore } : null,
    videoFiles,
    clearSessionStore: sessionStore.clear ? () => sessionStore.clear!() : undefined,
  };
  // Both builds (real and Fake) run the same web pipeline, so both save cleaned photos; sign-out wipes them.
  const withUploads = (api: HearthApi) => {
    const w = webUploads(api);
    if (!w) return common;
    const clearSession = common.clearSessionStore;
    return { ...common, prepare: w.prepare, uploadStore: w.uploadStore, clearSessionStore: async () => { await w.clear().catch(() => {}); await clearSession?.(); } };
  };
  if (FAKE_MODE) {
    // START-ON-1/2: a fake help address (never a real one) so Help and the start button behave as deployed.
    const api = createFakeApi();
    return { ...withUploads(api), api, helpPhone: '+1 304 555 0100', helpEmail: 'help@example.test' };
  }
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { error: 'Hearth is not set up yet (missing server address).' };
  const client = createClient(url, anonKey, {
    auth: { storage: secureSessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  const api = new SupabaseApi({ url, anonKey, client });
  return {
    ...withUploads(api), api, helpPhone: process.env.EXPO_PUBLIC_HELP_PHONE ?? null,
    // START-ON-1/2: set in the EAS environment, never in the repo. Unset or blank: no "Something wrong?" and no start button.
    helpEmail: process.env.EXPO_PUBLIC_HEARTH_HELP_EMAIL || null,
  };
}
