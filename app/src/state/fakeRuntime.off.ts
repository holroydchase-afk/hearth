// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// ENG-R5: what Metro puts in place of fakeRuntime.ts in a real build (no EXPO_PUBLIC_HEARTH_FAKE or _DEMO).
// runtime.ts only calls it when FAKE_MODE is on, which can't happen in such a build.
import type { HearthApi } from '../api/HearthApi';

export function createFakeApi(): HearthApi {
  throw new Error('This build has no sample backend.');
}
