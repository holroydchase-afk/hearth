// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEC-61 (Chase, Nov 16: "get rid of the tap a photo to start and the steps below. that is messy."): the demo's
// numbered Try-this steps (1. You're seeing a parent's Gallery / 2. Tap Details / 3. See it as Grandma Jo) leave
// Gallery and Feed at every width and for every viewer. Replaces FIRSTMIN-3 and the DEMO-BAR phone tip. Grandma Jo's
// view stays one tap away in the demo bar's Details menu (demo.spec.js DEMO-BAR / RD-27).
import { demoTip } from '../DemoTip';
import { WIDE } from '../DemoFrame';

describe('DEC-61 no Try-this steps on Gallery or Feed', () => {
  it('DEC-61 the parent on a phone gets no steps (was FIRSTMIN-3\'s three numbered steps)', () => {
    for (const w of [360, 390, WIDE - 1]) expect({ w, steps: demoTip(w, 'parent') }).toEqual({ w, steps: null });
  });

  it('DEC-61 still nothing at WIDE or wider, or in Grandma Jo\'s own view', () => {
    expect(demoTip(WIDE, 'parent')).toBeNull();
    expect(demoTip(1280, 'parent')).toBeNull();
    expect(demoTip(390, 'grandma')).toBeNull();
    expect(demoTip(WIDE, 'grandma')).toBeNull();
  });
});
