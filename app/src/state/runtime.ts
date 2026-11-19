// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Builds the app's dependencies. EXPO_PUBLIC_HEARTH_FAKE=1 → in-memory FakeApi (web smoke test,
// demos); otherwise SupabaseApi against EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.
import { createClient } from '@supabase/supabase-js';
import { Linking } from 'react-native';
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
import { secureSessionStorage } from '../platform/secureSession';
import { asyncStorageKV } from '../platform/storage';
import type { AppDeps } from './AppContext';
import { createFakeApi } from './fakeRuntime';

export const FAKE_MODE = process.env.EXPO_PUBLIC_HEARTH_FAKE === '1' || DEMO_MODE;

export function createRuntime(): AppDeps | { error: string } {
  const common = {
    kv: asyncStorageKV,
    prepare: prepareItem,
    pickPhotos: (opts: { videos: boolean }) => pickPhotos(10, opts),
    pickBulk: (opts?: { videos: boolean }) => pickBulk(opts),
    previewBytes: makePreviewBytes(expoManipulator, readBytes),
    saveToPhone,
    openUrl: (u: string) => Linking.openURL(u),
    // A3: kept photo files on phones only; the web build keeps none.
    mediaDisk: fileMediaStore && mediaKeyStore ? { store: fileMediaStore, keys: mediaKeyStore } : null,
    videoFiles,
  };
  if (FAKE_MODE) {
    return { ...common, api: createFakeApi(), helpPhone: '+1 304 555 0100' };
  }
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { error: 'Hearth is not set up yet (missing server address).' };
  const client = createClient(url, anonKey, {
    auth: { storage: secureSessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return { ...common, api: new SupabaseApi({ url, anonKey, client }), helpPhone: process.env.EXPO_PUBLIC_HELP_PHONE ?? null };
}
