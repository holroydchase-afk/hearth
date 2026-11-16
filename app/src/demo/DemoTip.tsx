// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEC-61 (Chase, Nov 16: "get rid of the tap a photo to start and the steps below. that is messy."): the demo's
// numbered Try-this steps (FIRSTMIN-3) are gone from Gallery and Feed at every width and for every viewer.
// Grandma Jo's view stays one tap away in the demo bar's Details menu.

/** No phone tip any more (DEC-61); kept as the one place that answers "does the demo show steps here?". */
export function demoTip(_width: number, _viewer: 'parent' | 'grandma'): string[] | null {
  return null;
}
