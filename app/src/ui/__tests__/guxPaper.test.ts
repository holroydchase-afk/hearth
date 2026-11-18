// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// GUX-R17 (grandparent-ux, Nov 18, DEC-67): the green "sent" tint (safeSoft) still comes from the old white/black
// page. It is mixed like accentSoft: safe into the page color, by the same SOFT amount (theme.ts: light 0.93,
// dark 0.82). Written first (red), Nov 18, by qa-tdd. Screens: src/screens/__tests__/guxPaper.test.tsx.
import * as themeMod from '../theme';
import { mix, paletteFor } from '../theme';

// qa-tdd, Nov 18: loops every theme (RD-95, DEC-68) instead of every family color.
const THEME_NAMES = (((themeMod as Record<string, unknown>).THEME_NAMES ?? []) as string[]);


const SOFT = { light: 0.93, dark: 0.82 } as const;
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

describe('GUX-R17 safeSoft is safe mixed into the paper page', () => {
  for (const dark of [false, true]) {
    for (const high of [false, true]) {
      it(`GUX-R17 (${dark ? 'dark' : 'light'}${high ? ', high contrast' : ''}) safeSoft = mix(safe, bg, ${dark ? SOFT.dark : SOFT.light}) ±1 per channel, every theme`, () => {
        expect(THEME_NAMES).toEqual(['paper', 'avocado', 'pomegranate']);
        for (const color of THEME_NAMES) {
          const c = (paletteFor as unknown as (o: string, d: boolean, n: string, h: boolean) => ReturnType<typeof paletteFor>)('ios', dark, color, high);
          const want = mix(c.safe, c.bg, dark ? SOFT.dark : SOFT.light);
          const off = rgb(c.safeSoft).map((v, i) => Math.abs(v - rgb(want)[i]!));
          expect({ color, safeSoft: c.safeSoft, within1: off.every((d) => d <= 1) }).toEqual({ color, safeSoft: c.safeSoft, within1: true });
        }
      });
    }
  }
});
