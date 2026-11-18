// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SPEC-REDESIGN 1h (DEC-67, Chase Nov 18: "use the warm paper, the photo shadows, pop reactions"): the palette.
// Written first (red), Nov 18, by qa-tdd. Screens, shadows and the pop: src/screens/__tests__/warmPaper.test.tsx.
//
// The engineer's contract (theme.ts):
//   - RD-84 light: bg #F1E9D2 (paper), fill #E6DFC9 and line #DBD4BF (±1 per channel), warm ink and muted
//     (R ≥ G ≥ B), surface and photo paper-family; none of the old cool grays. tokens.json regenerated.
//   - RD-85 dark: bg #14100D, warm near-white ink, warm gray muted, warm dark fill / line / surface / photo.
//   - RD-86 every accent x light/dark x normal/high meets AA on the new pages; accentSoft mixes with the page.
import fs from 'fs';
import path from 'path';
import { COLOR_NAMES, contrast, paletteFor, type ColorName, type Colors } from '../theme';

const rgb = (hex: string): [number, number, number] => {
  expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
};
/** Warm: red ≥ green ≥ blue, and red above blue (a hint of yellow-brown, never blue-gray). */
const warm = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return r >= g && g >= b && r > b;
};
const near = (hex: string, want: string, tol = 1) => rgb(hex).every((v, i) => Math.abs(v - rgb(want)[i]!) <= tol);
const lum = (hex: string) => contrast(hex, '#000000'); // 1 (black) .. 21 (white)

const LIGHT_COOL = ['#FFFFFF', '#F7F7F9', '#F2F2F7', '#D1D1D6', '#EFEFF4', '#1C1C1E', '#5F5F64'];
const DARK_COOL = ['#000000', '#1C1C1E', '#2C2C2E', '#38383A', '#AEAEB2', '#F5F5F7'];
const PAGE_KEYS = ['bg', 'surface', 'ink', 'muted', 'line', 'fill', 'photo'] as const;

const light = (n: ColorName = 'ember', high = false) => paletteFor('ios', false, n, high);
const dark = (n: ColorName = 'ember', high = false) => paletteFor('ios', true, n, high);

describe('RD-84 light mode is warm paper', () => {
  it('RD-84 page bg is paper #F1E9D2', () => {
    expect(light().bg).toBe('#F1E9D2');
  });

  it('RD-84 fill is 4.5% darker paper (#E6DFC9 ±1) and line 9% darker (#DBD4BF ±1)', () => {
    const c = light();
    expect({ fill: c.fill, near: near(c.fill, '#E6DFC9') }).toEqual({ fill: c.fill, near: true });
    expect({ line: c.line, near: near(c.line, '#DBD4BF') }).toEqual({ line: c.line, near: true });
  });

  it('RD-84 ink is a warm near-black and muted a warm gray (R ≥ G ≥ B)', () => {
    const c = light();
    expect({ ink: c.ink, warm: warm(c.ink), dark: lum(c.ink) < 1.5 }).toEqual({ ink: c.ink, warm: true, dark: true });
    expect({ muted: c.muted, warm: warm(c.muted) }).toEqual({ muted: c.muted, warm: true });
  });

  it('RD-84 surface and photo are paper-family too (warm, light)', () => {
    const c = light();
    for (const k of ['surface', 'photo', 'fill', 'line'] as const) {
      expect({ k, v: c[k], warm: warm(c[k]), light: lum(c[k]) > 10 }).toEqual({ k, v: c[k], warm: true, light: true });
    }
  });

  it('RD-84 no cool gray from before remains in any light palette (every family color, normal and high)', () => {
    for (const n of COLOR_NAMES) {
      for (const high of [false, true]) {
        const c = light(n, high);
        const left = PAGE_KEYS.filter((k) => LIGHT_COOL.includes(c[k].toUpperCase())).map((k) => `${k} ${c[k]}`);
        expect({ n, high, left }).toEqual({ n, high, left: [] });
      }
    }
  });

  it('RD-84 docs/design/tokens.json mirrors the paper palette', () => {
    const file = path.join(__dirname, '..', '..', '..', '..', 'docs', 'design', 'tokens.json');
    const t = JSON.parse(fs.readFileSync(file, 'utf8')) as { color: { light: Colors; dark: Colors } };
    expect({ light: t.color.light.bg, dark: t.color.dark.bg }).toEqual({ light: '#F1E9D2', dark: '#14100D' });
    expect(t.color.light).toEqual({ ...paletteFor('web', false) });
  });
});

describe('RD-85 dark mode is a warm near-black', () => {
  it('RD-85 page bg is #14100D, not true black', () => {
    expect(dark().bg).toBe('#14100D');
  });

  it('RD-85 ink is a warm near-white and muted a warm gray', () => {
    const c = dark();
    expect({ ink: c.ink, warm: warm(c.ink), light: lum(c.ink) > 15 }).toEqual({ ink: c.ink, warm: true, light: true });
    expect({ muted: c.muted, warm: warm(c.muted) }).toEqual({ muted: c.muted, warm: true });
  });

  it('RD-85 fill, line, surface and photo are warm dark grays (R ≥ G ≥ B), lighter than the page', () => {
    const c = dark();
    for (const k of ['fill', 'line', 'surface', 'photo'] as const) {
      expect({ k, v: c[k], warm: warm(c[k]), dark: lum(c[k]) < 3, aboveBg: lum(c[k]) >= lum(c.bg) }).toEqual({ k, v: c[k], warm: true, dark: true, aboveBg: true });
    }
  });

  it('RD-85 no #000000 page and no cool gray remains in any dark palette', () => {
    for (const n of COLOR_NAMES) {
      for (const high of [false, true]) {
        const c = dark(n, high);
        const left = PAGE_KEYS.filter((k) => DARK_COOL.includes(c[k].toUpperCase())).map((k) => `${k} ${c[k]}`);
        expect({ n, high, left }).toEqual({ n, high, left: [] });
      }
    }
  });
});

describe('RD-86 contrast (WCAG AA) on paper and warm black', () => {
  for (const n of COLOR_NAMES) {
    for (const isDark of [false, true]) {
      for (const high of [false, true]) {
        const label = `${n} ${isDark ? 'dark' : 'light'}${high ? ' high contrast' : ''}`;
        const c = () => paletteFor('ios', isDark, n, high);

        it(`RD-86 ${label}: ink and muted ≥ 4.5:1 on bg, fill and surface; ink ≥ 7:1 on bg`, () => {
          const p = c();
          const fails: string[] = [];
          for (const fg of ['ink', 'muted'] as const) {
            for (const on of ['bg', 'fill', 'surface'] as const) {
              const r = contrast(p[fg], p[on]);
              if (r < 4.5) fails.push(`${fg} ${p[fg]} on ${on} ${p[on]}: ${r.toFixed(2)}`);
            }
          }
          if (contrast(p.ink, p.bg) < 7) fails.push(`ink on bg ${contrast(p.ink, p.bg).toFixed(2)} < 7`);
          expect(fails).toEqual([]);
        });

        it(`RD-86 ${label}: accent ≥ 4.5:1 on bg, fill and accentSoft; danger and safe ≥ 4.5:1 on bg`, () => {
          const p = c();
          const fails: string[] = [];
          for (const on of ['bg', 'fill', 'accentSoft'] as const) {
            const r = contrast(p.accent, p[on]);
            if (r < 4.5) fails.push(`accent ${p.accent} on ${on} ${p[on]}: ${r.toFixed(2)}`);
          }
          for (const k of ['danger', 'safe'] as const) {
            const r = contrast(p[k], p.bg);
            if (r < 4.5) fails.push(`${k} ${p[k]} on bg ${p.bg}: ${r.toFixed(2)}`);
          }
          expect(fails).toEqual([]);
        });

        it(`RD-86 ${label}: accentSoft is the accent mixed with the page color (not white or black)`, () => {
          const p = c();
          // Every channel of accentSoft sits between the accent's and the page's (±1 for rounding).
          const [a, bg, soft] = [rgb(p.accent), rgb(p.bg), rgb(p.accentSoft)];
          const between = soft.every((v, i) => v >= Math.min(a[i]!, bg[i]!) - 1 && v <= Math.max(a[i]!, bg[i]!) + 1);
          expect({ accentSoft: p.accentSoft, accent: p.accent, bg: p.bg, between }).toEqual({ accentSoft: p.accentSoft, accent: p.accent, bg: p.bg, between: true });
        });
      }
    }
  }

  it('RD-86 Increase Contrast keeps the paper page and its high-contrast set (DS-14: muted ≥ 7:1)', () => {
    for (const n of COLOR_NAMES) {
      const p = light(n, true);
      expect({ n, bg: p.bg, muted7: contrast(p.muted, p.bg) >= 7 }).toEqual({ n, bg: '#F1E9D2', muted7: true });
      const d = dark(n, true);
      expect({ n, bg: d.bg, muted7: contrast(d.muted, d.bg) >= 7 }).toEqual({ n, bg: '#14100D', muted7: true });
    }
  });
});
