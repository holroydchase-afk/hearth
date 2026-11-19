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

const FAKE_KEY = 'hearth.fakeBackend.v1';

function fakeBackend(): FakeBackend {
  const ls = Platform.OS === 'web' ? webStorage() : undefined;
  // DEMO-2: nothing is saved until the sample family is complete, so a reload mid-seed starts over.
  let seeding = DEMO_MODE;
  const persist = ls ? (s: FakeState) => { if (seeding) return; try { ls.setItem(FAKE_KEY, JSON.stringify(s)); } catch { /* full */ } } : undefined;
  let saved: string | null | undefined;
  // DEMO-FRESH-1: a family saved by an older demo is dropped, so returning visitors see the new one.
  if (DEMO_MODE && ls) { try { freshenDemoStorage(ls); } catch { /* blocked: start fresh below */ } }
  try { saved = ls?.getItem(FAKE_KEY); } catch { /* blocked: start fresh */ }
  if (saved) {
    try {
      const state = JSON.parse(saved) as FakeState;
      seeding = false;
      return new FakeBackend(state, persist);
    } catch { /* reseed */ }
  }
  // DEMO-1/2: the demo opens on a sample family already signed in; the web smoke test starts empty.
  const be = FakeBackend.withFixture({ joIsMember: DEMO_MODE }, persist);
  if (DEMO_MODE) {
    be.ready = seedDemo(be, loadDemoPicture, asyncStorageKV).catch(() => undefined).then(() => { seeding = false; be.changed(); });
  } else {
    be.changed();
  }
  return be;
}

/** The fake backend's API, signed in as the app's session (the demo also reaches the backend itself, ENG-R14). */
export function createFakeApi(): HearthApi {
  const be = fakeBackend();
  if (Platform.OS === 'web') (globalThis as { __hearthFake?: FakeBackend }).__hearthFake = be;
  return be.clientFor(null, { trackAppSession: true });
}
