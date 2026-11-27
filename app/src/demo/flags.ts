// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// The no-login sample-data demo build (EXPO_PUBLIC_HEARTH_DEMO=1, always on the fake backend).
export const DEMO_MODE = process.env.EXPO_PUBLIC_HEARTH_DEMO === '1';
// DEMO-BAR-HIDE-1 (Chase, Nov 27): the phone's slim demo bar is hidden on the public demo while its new home in the
// top nav is chosen. The public build (scripts/build-demo.sh) sets EXPO_PUBLIC_HEARTH_DEMO_BAR=0; every other demo
// build (e2e:demo, local) still shows it, so Grandma Jo's view and Reset stay testable.
export const DEMO_BAR = process.env.EXPO_PUBLIC_HEARTH_DEMO_BAR !== '0';
