// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// The in-memory backend for the web smoke test (EXPO_PUBLIC_HEARTH_FAKE=1) and the public demo
// (EXPO_PUBLIC_HEARTH_DEMO=1). ENG-R5: only those builds include this file; Metro resolves it to
// fakeRuntime.off.ts everywhere else (metro.config.js), so the phone app carries no fixture family.
import { Platform } from 'react-native';
import { FakeBackend, type FakeState } from '../api/fake/FakeBackend';
import type { HearthApi } from '../api/HearthApi';
import { DEMO_MODE } from '../demo/flags';
import { loadDemoPicture } from '../demo/pictures';
import { freshenDemoStorage, seedDemo } from '../demo/seed';
import { asyncStorageKV } from '../platform/storage';
import { webStorage } from '../platform/webStorage';
import { idbObjects, objectsComplete, splitSaver } from './fakeSave';

const FAKE_KEY = 'hearth.fakeBackend.v1';

function fakeBackend(): FakeBackend {
  const ls = Platform.OS === 'web' ? webStorage() : undefined;
  // DEMO-SAFARI-1..4: the family goes to localStorage, photo bytes to IndexedDB (Safari's 5 MB cap).
  const store = ls ? idbObjects() : undefined;
  const saver = ls ? splitSaver(ls, FAKE_KEY, store) : undefined;
  // DEMO-2: nothing is saved until the sample family is complete, so a reload mid-seed starts over.
  let seeding = DEMO_MODE;
  const persist = saver ? (s: FakeState) => { if (!seeding) saver.save(s); } : undefined;
  const fresh = (be: FakeBackend): Promise<void> => {
    // DEMO-1/2: the demo opens on a sample family already signed in; the web smoke test starts empty.
    saver?.reset();
    be.state = FakeBackend.withFixture({ joIsMember: DEMO_MODE }).state;
    if (!DEMO_MODE) { be.changed(); return Promise.resolve(); }
    seeding = true;
    return seedDemo(be, loadDemoPicture, asyncStorageKV).catch(() => undefined).then(() => { seeding = false; be.changed(); });
  };
  let saved: string | null | undefined;
  // DEMO-FRESH-1: a family saved by an older demo is dropped, so returning visitors see the new one.
  if (DEMO_MODE && ls) { try { freshenDemoStorage(ls); } catch { /* blocked: start fresh below */ } }
  try { saved = ls?.getItem(FAKE_KEY); } catch { /* blocked: start fresh */ }
  let state: FakeState | undefined;
  if (saved) { try { state = JSON.parse(saved) as FakeState; } catch { /* reseed */ } }
  const be = new FakeBackend(state ?? FakeBackend.empty(), persist);
  if (saver) be.flush = saver.flush;
  if (!state) {
    be.ready = fresh(be);
  } else {
    // DEMO-SAFARI: photo bytes come back from IndexedDB (plus any still inline, incl. a family saved before the
    // split) before any app call; this save moves inline ones to IndexedDB. Missing bytes mean a fresh family.
    seeding = false;
    const kept = state;
    const inline = kept.objects ?? {};
    kept.objects = {};
    be.ready = (store ? store.getAll() : Promise.resolve({} as Record<string, string>))
      .catch(() => ({} as Record<string, string>))
      .then((objects) => {
        kept.objects = { ...objects, ...inline };
        saver?.know(Object.keys(objects));
        if (!objectsComplete(kept)) return fresh(be);
        if (store && Object.keys(inline).length) be.changed();
      });
  }
  return be;
}

/** The fake backend's API, signed in as the app's session (the demo also reaches the backend itself, ENG-R14). */
export function createFakeApi(): HearthApi {
  const be = fakeBackend();
  if (Platform.OS === 'web') (globalThis as { __hearthFake?: FakeBackend }).__hearthFake = be;
  return be.clientFor(null, { trackAppSession: true });
}
