// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SPEC-REDESIGN 1i (DEC-68, Chase Nov 18: "I do not like the warm theme"; then three themes with plain names):
// Paper (an off-white page, the default; Chase 14:55Z), Avocado and Pomegranate. Supersedes RD-84..RD-86 (tan
// paper #F1E9D2) and RD-24..RD-27's Ember / Forest / Plum. Photo shadows and the reaction pop stay for now (Chase
// deciding), so RD-100 / RD-101 have no tests yet. Written first (red), Nov 18, by qa-tdd. Screens: src/screens/__tests__/themes.test.tsx.
//
// The engineer's contract (theme.ts):
//   - export type ThemeName = 'paper' | 'avocado' | 'pomegranate'; export const THEME_NAMES in that order.
//   - export const ThemeContext = createContext<ThemeName>('paper') (replaces ColorContext; COLOR_NAMES goes).
//   - paletteFor(os, dark, theme: ThemeName = 'paper', high = false); an unknown theme gives Paper.
//   - no tan paper value, no Forest or Plum anywhere in app/src (RD-94, RD-99).
//   - docs/design/tokens.json regenerated (UPDATE_TOKENS=1 npx jest designTokens).
import fs from 'fs';
import path from 'path';
import * as theme from '../theme';
import { contrast, mix, paletteFor, type Colors } from '../theme';

type Name = 'paper' | 'avocado' | 'pomegranate';
const THEMES: Name[] = ['paper', 'avocado', 'pomegranate'];
const pal = (dark: boolean, name?: Name, high = false): Colors =>
  (paletteFor as unknown as (os: string, dark: boolean, n?: string, high?: boolean) => Colors)('ios', dark, name, high);
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h: string) => contrast(h, '#000000');
const SRC = path.join(__dirname, '..', '..');
const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  if (d.isDirectory()) return d.name === '__tests__' || d.name === 'test' ? [] : walk(p);
  return /\.(ts|tsx)$/.test(d.name) ? [p] : [];
});

describe('RD-94 RD-105 Paper (the default) is Linen #F7F7F4, not white and not tan', () => {
  const LIGHT = { bg: '#F7F7F4', surface: '#FFFFFF', ink: '#1E1B17', muted: '#5C564E', line: '#E3DED4', fill: '#EFECE5', photo: '#EFECE5', accent: '#AD371D', accentInk: '#FFFFFF' };
  const DARK = { bg: '#131210', surface: '#1C1A17', ink: '#F1EEE8', muted: '#B2ACA2', line: '#2E2B27', fill: '#24221E', photo: '#24221E', accent: '#FF8A65', accentInk: '#000000' };

  it('RD-94 THEME_NAMES is Paper, Avocado, Pomegranate, and Paper is the default', () => {
    expect((theme as Record<string, unknown>).THEME_NAMES).toEqual(THEMES);
    expect(pal(false)).toEqual(pal(false, 'paper'));
    expect(pal(true)).toEqual(pal(true, 'paper'));
  });

  it('RD-94 Paper light gives exactly the spec values', () => {
    expect(pal(false, 'paper')).toMatchObject(LIGHT);
  });

  it('RD-94 Paper dark gives exactly the spec values', () => {
    expect(pal(true, 'paper')).toMatchObject(DARK);
  });

  it('RD-94 the same Paper on iPhone, Android and the web', () => {
    for (const dark of [false, true]) {
      for (const os of ['android', 'web'] as const) expect({ os, dark, c: paletteFor(os, dark) }).toEqual({ os, dark, c: paletteFor('ios', dark) });
    }
  });

  it('RD-94 no tan paper value (#F1E9D2, #14100D, #E6DFC9, #DBD4BF) remains in app/src', () => {
    const PAPER = /#(F1E9D2|14100D|E6DFC9|DBD4BF)\b/i;
    const hits = walk(SRC).flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').flatMap((l, i) => (PAPER.test(l) ? [`${path.relative(SRC, f)}:${i + 1}`] : [])));
    expect(hits).toEqual([]);
  });

  it('RD-94 no theme uses white #FFFFFF or tan as its page, light or dark, normal or high', () => {
    for (const n of THEMES) for (const dark of [false, true]) for (const high of [false, true]) {
      const bg = pal(dark, n, high).bg.toUpperCase();
      expect({ n, dark, high, bad: ['#FFFFFF', '#F1E9D2', '#14100D'].includes(bg) }).toEqual({ n, dark, high, bad: false });
    }
  });

  it('RD-94 docs/design/tokens.json carries Paper', () => {
    const file = path.join(SRC, '..', '..', 'docs', 'design', 'tokens.json');
    const t = JSON.parse(fs.readFileSync(file, 'utf8')) as { color: { light: Colors; dark: Colors } };
    expect({ light: t.color.light, dark: t.color.dark }).toEqual({ light: { ...pal(false, 'paper') }, dark: { ...pal(true, 'paper') } });
    expect({ light: t.color.light.bg, dark: t.color.dark.bg }).toEqual({ light: '#F7F7F4', dark: '#131210' });
  });

  it('RD-94 an unknown theme name gives Paper', () => {
    expect(pal(false, 'ember' as Name)).toEqual(pal(false, 'paper'));
    expect(pal(true, 'forest' as Name)).toEqual(pal(true, 'paper'));
  });
});

describe('RD-95 RD-111 RD-112 Avocado and Pomegranate', () => {
  const WANT: Record<'avocado' | 'pomegranate', { light: Partial<Colors>; dark: Partial<Colors> }> = {
    // qa-tdd, Nov 20: Avocado's values moved to RD-111 / RD-112 (Hass avocado, DEC-76); these are the new ones, the
    // exact full set is checked below. Pomegranate's are unchanged (RD-95).
    avocado: {
      light: { bg: '#F6F5E4', fill: '#E7ECC6', line: '#DCDBCC', ink: '#1F1A1B', muted: '#4F4A42', accent: '#2F5419' },
      dark: { bg: '#2A2426', fill: '#3A3335', line: '#4A4543', ink: '#F3F1DA', muted: '#C2BDA8', accent: '#7ED69B' },
    },
    pomegranate: {
      light: { bg: '#F5EADF', fill: '#EBDDD0', line: '#DDCDBE', ink: '#22161A', muted: '#62504F', accent: '#A3172F' },
      dark: { bg: '#170D10', fill: '#24171A', line: '#3A272B', ink: '#F5E9E6', muted: '#BBA7A6', accent: '#FF8597' },
    },
  };
  for (const name of ['avocado', 'pomegranate'] as const) {
    for (const dark of [false, true]) {
      const mode = dark ? 'dark' : 'light';
      it(`${name === 'avocado' ? (dark ? 'RD-112' : 'RD-111') : 'RD-95'} ${name} ${mode} gives the spec's page, fill, line, ink, muted and accent`, () => {
        expect(pal(dark, name)).toMatchObject(WANT[name][mode]);
      });

      it(`RD-95 ${name} ${mode}: surface sits between bg and fill, photo equals fill`, () => {
        const c = pal(dark, name);
        const [s, b, f] = [rgb(c.surface), rgb(c.bg), rgb(c.fill)];
        const between = s.every((v, i) => v >= Math.min(b[i]!, f[i]!) && v <= Math.max(b[i]!, f[i]!));
        expect({ surface: c.surface, bg: c.bg, fill: c.fill, between, photo: c.photo }).toEqual({ surface: c.surface, bg: c.bg, fill: c.fill, between: true, photo: c.fill });
      });

      it(`RD-95 ${name} ${mode}: status colors (safe, danger) are Paper's`, () => {
        const c = pal(dark, name);
        const p = pal(dark, 'paper');
        expect({ safe: c.safe, danger: c.danger, dangerText: c.dangerText, onDanger: c.onDanger, scrim: c.scrim })
          .toEqual({ safe: p.safe, danger: p.danger, dangerText: p.dangerText, onDanger: p.onDanger, scrim: p.scrim });
      });
    }
  }
});

describe('RD-96 contrast in every theme x light/dark x normal/high (18 sets)', () => {
  for (const name of THEMES) {
    for (const dark of [false, true]) {
      for (const high of [false, true]) {
        const label = `${name} ${dark ? 'dark' : 'light'}${high ? ' high' : ''}`;
        it(`RD-96 ${label}: ink ≥ 7:1 on bg; muted ≥ 4.5:1 on bg and fill; accent ≥ 4.5:1 on bg, fill, accentSoft; accentInk ≥ 4.5:1 on accent; danger, safe ≥ 4.5:1 on bg`, () => {
          const c = pal(dark, name, high);
          const fails: string[] = [];
          const need = (fg: keyof Colors, on: keyof Colors, r: number) => {
            const v = contrast(c[fg], c[on]);
            if (!(v >= r)) fails.push(`${fg} ${c[fg]} on ${on} ${c[on]}: ${v.toFixed(2)} < ${r}`);
          };
          need('ink', 'bg', 7);
          need('muted', 'bg', 4.5); need('muted', 'fill', 4.5);
          need('accent', 'bg', 4.5); need('accent', 'fill', 4.5); need('accent', 'accentSoft', 4.5);
          need('accentInk', 'accent', 4.5);
          need('danger', 'bg', 4.5); need('safe', 'bg', 4.5);
          expect(fails).toEqual([]);
        });

        it(`RD-96 ${label}: accentInk is white on a light page, black on a dark one`, () => {
          expect(pal(dark, name, high).accentInk).toBe(dark ? '#000000' : '#FFFFFF');
        });

        // qa-tdd, Nov 20: GUX-R15's filled-capsule clause (accentPicked ≥ 3:1 on bg, ink ≥ 4.5:1 on it) is replaced by
        // RD-115 (DEC-76): the picked reaction is a 2 pt c.accent outline with a c.accent count, no fill.
        it(`RD-115 ${label}: picked outline (accent) ≥ 3:1 and its count (accent) ≥ 4.5:1 on bg and on surface`, () => {
          const c = pal(dark, name, high);
          const r = { bg: +contrast(c.accent, c.bg).toFixed(2), surface: +contrast(c.accent, c.surface).toFixed(2) };
          expect({ r, outline: r.bg >= 3 && r.surface >= 3, count: r.bg >= 4.5 && r.surface >= 4.5 }).toEqual({ r, outline: true, count: true });
        });

        it(`RD-113 ${label}: accent ≥ 4.5:1 on surface too (the card a post sits on)`, () => {
          const c = pal(dark, name, high);
          expect({ ratio: +contrast(c.accent, c.surface).toFixed(2), ok: contrast(c.accent, c.surface) >= 4.5 }).toEqual(expect.objectContaining({ ok: true }));
        });

        it(`RD-96 ${label}: accentSoft is the accent mixed with this theme's bg`, () => {
          const c = pal(dark, name, high);
          const [a, b, s] = [rgb(c.accent), rgb(c.bg), rgb(c.accentSoft)];
          const between = s.every((v, i) => v >= Math.min(a[i]!, b[i]!) - 1 && v <= Math.max(a[i]!, b[i]!) + 1);
          expect({ accentSoft: c.accentSoft, bg: c.bg, between }).toEqual({ accentSoft: c.accentSoft, bg: c.bg, between: true });
        });
      }

      it(`RD-96 ${name} ${dark ? 'dark' : 'light'}: Increase Contrast gives its own stronger set on the same page (DS-14: muted ≥ 7:1)`, () => {
        const n = pal(dark, name);
        const h = pal(dark, name, true);
        expect({ bg: h.bg, muted7: contrast(h.muted, h.bg) >= 7, accentUp: contrast(h.accent, h.bg) > contrast(n.accent, n.bg) })
          .toEqual({ bg: n.bg, muted7: true, accentUp: true });
      });
    }
  }

  it('RD-96 GUX-R17 safeSoft is safe mixed into each theme\'s page (light 0.93, dark 0.82)', () => {
    for (const name of THEMES) {
      for (const dark of [false, true]) {
        const c = pal(dark, name);
        const want = rgb(mix(c.safe, c.bg, dark ? 0.82 : 0.93));
        const off = rgb(c.safeSoft).map((v, i) => Math.abs(v - want[i]!));
        expect({ name, dark, within1: off.every((d) => d <= 1) }).toEqual({ name, dark, within1: true });
      }
    }
  });
});

describe('RD-99 source checks', () => {
  it('RD-99 Forest and Plum appear nowhere in app/src (names or hexes)', () => {
    const BAD = /\b(forest|plum)\b|#(2E7D4F|276B43|6FCF97|8E3A8F|D9A0E0)\b/i;
    const hits = walk(SRC).flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').flatMap((l, i) => (BAD.test(l) ? [`${path.relative(SRC, f)}:${i + 1} ${l.trim().slice(0, 60)}`] : [])));
    expect(hits).toEqual([]);
  });

});

// SPEC-REDESIGN 1k (Chase, Nov 20, DEC-76): Avocado from a Hass avocado. Written first (red), Nov 20, by qa-tdd.
// Layers: ripe skin #2B2426 → light ink #1F1A1B and the dark page #2A2426; just under the skin → accent #2F5419;
// middle flesh → fill; inner flesh → light page. Dark accent is "Fresh leaf" #7ED69B (not #B3D25B, "mush peas").
describe('RD-111 RD-112 Avocado is a Hass avocado (exact values)', () => {
  const LIGHT = { bg: '#F6F5E4', surface: '#EFF1D5', fill: '#E7ECC6', photo: '#E7ECC6', line: '#DCDBCC', ink: '#1F1A1B', muted: '#4F4A42', accent: '#2F5419', accentInk: '#FFFFFF' };
  const DARK = { bg: '#2A2426', surface: '#322C2E', fill: '#3A3335', photo: '#3A3335', line: '#4A4543', ink: '#F3F1DA', muted: '#C2BDA8', accent: '#7ED69B', accentInk: '#000000' };

  it('RD-111 Avocado light gives exactly bg #F6F5E4, surface #EFF1D5, fill/photo #E7ECC6, line #DCDBCC, ink #1F1A1B, muted #4F4A42, accent #2F5419, accentInk white', () => {
    expect(pal(false, 'avocado')).toMatchObject(LIGHT);
  });

  it('RD-111 Avocado light: surface is bg and fill mixed 50/50; accentSoft follows the mix rule on the new page', () => {
    const c = pal(false, 'avocado');
    expect({ surface: c.surface }).toEqual({ surface: mix(c.bg, c.fill, 0.5) });
    const p = pal(false, 'paper');
    // Same soft-mix weight as Paper (whatever SOFT[light] is): derive it from Paper and apply it to Avocado.
    const [pa, pb, ps] = [rgb(p.accent), rgb(p.bg), rgb(p.accentSoft)];
    const t = (ps[0]! - pa[0]!) / (pb[0]! - pa[0]!);
    const want = rgb(mix(c.accent, c.bg, t));
    expect({ within2: rgb(c.accentSoft).every((v, i) => Math.abs(v - want[i]!) <= 2) }).toEqual({ within2: true });
  });

  it('RD-112 Avocado dark gives exactly bg #2A2426 (plum-charcoal skin), surface #322C2E, fill/photo #3A3335, line #4A4543, ink #F3F1DA, muted #C2BDA8, accent #7ED69B (Fresh leaf), accentInk black', () => {
    expect(pal(true, 'avocado')).toMatchObject(DARK);
  });

  it('RD-112 none of the old Avocado values nor #B3D25B remains in app/src or docs/design/tokens.json', () => {
    const OLD = /#(EEEFD3|E2E4C4|D2D5B1|1B2113|525A40|3B6120|10140C|1B2015|2E3524|EEF0DE|ADB599|B4D16A|B3D25B)\b/i;
    const tokens = path.join(SRC, '..', '..', 'docs', 'design', 'tokens.json');
    const hits = [...walk(SRC), tokens].flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').flatMap((l, i) => (OLD.test(l) ? [`${path.relative(SRC, f)}:${i + 1}`] : [])));
    expect(hits).toEqual([]);
  });

  it('RD-112 docs/design/tokens.json carries the new Avocado, light and dark', () => {
    const file = path.join(SRC, '..', '..', 'docs', 'design', 'tokens.json');
    const t = JSON.parse(fs.readFileSync(file, 'utf8')) as { themes: Record<string, { light: Colors; dark: Colors }> };
    expect({ light: t.themes.avocado?.light, dark: t.themes.avocado?.dark }).toMatchObject({ light: LIGHT, dark: DARK });
  });

  it('RD-112 Paper and Pomegranate are byte-for-byte unchanged', () => {
    expect({ light: pal(false, 'pomegranate'), dark: pal(true, 'pomegranate') }).toMatchObject({
      light: { bg: '#F5EADF', fill: '#EBDDD0', line: '#DDCDBE', ink: '#22161A', muted: '#62504F', accent: '#A3172F', surface: mix('#F5EADF', '#EBDDD0', 0.5) },
      dark: { bg: '#170D10', fill: '#24171A', line: '#3A272B', ink: '#F5E9E6', muted: '#BBA7A6', accent: '#FF8597', surface: mix('#170D10', '#24171A', 0.5) },
    });
    expect({ light: pal(false, 'paper'), dark: pal(true, 'paper') }).toMatchObject({
      light: { bg: '#F7F7F4', surface: '#FFFFFF', ink: '#1E1B17', muted: '#5C564E', line: '#E3DED4', fill: '#EFECE5', accent: '#AD371D' },
      dark: { bg: '#131210', surface: '#1C1A17', ink: '#F1EEE8', muted: '#B2ACA2', line: '#2E2B27', fill: '#24221E', accent: '#FF8A65' },
    });
  });
});

describe('RD-113 Avocado contrast, light/dark x normal/high (on top of RD-96 / RD-115 for all 18 sets)', () => {
  for (const dark of [false, true]) {
    for (const high of [false, true]) {
      const label = `avocado ${dark ? 'dark' : 'light'}${high ? ' high' : ''}`;
      it(`RD-113 ${label}: ink ≥ 7; muted ≥ 4.5 on bg and fill (high ≥ 7 on bg); accent ≥ 4.5 on bg, surface, fill, accentSoft; accentInk ≥ 4.5 on accent; safe, danger ≥ 4.5 on bg`, () => {
        const c = pal(dark, 'avocado', high);
        const fails: string[] = [];
        const need = (fg: keyof Colors, on: keyof Colors, r: number) => {
          const v = contrast(c[fg], c[on]);
          if (!(v >= r)) fails.push(`${fg} ${c[fg]} on ${on} ${c[on]}: ${v.toFixed(2)} < ${r}`);
        };
        need('ink', 'bg', 7);
        need('muted', 'bg', high ? 7 : 4.5); need('muted', 'fill', 4.5);
        for (const on of ['bg', 'surface', 'fill', 'accentSoft'] as const) need('accent', on, 4.5);
        need('accentInk', 'accent', 4.5);
        need('safe', 'bg', 4.5); need('danger', 'bg', 4.5);
        expect(fails).toEqual([]);
      });
    }
  }

  it('RD-113 staff-pm\'s checked ratios hold on the given values (light ink 15.6, accent on bg 7.9; dark ink 13.4, accent on bg 8.7), ±0.15', () => {
    const l = pal(false, 'avocado'); const d = pal(true, 'avocado');
    const got = { lInk: contrast(l.ink, l.bg), lAcc: contrast(l.accent, l.bg), dInk: contrast(d.ink, d.bg), dAcc: contrast(d.accent, d.bg) };
    const want = { lInk: 15.6, lAcc: 7.9, dInk: 13.4, dAcc: 8.7 };
    const off = Object.fromEntries(Object.entries(want).filter(([k, v]) => Math.abs(got[k as keyof typeof got] - v) > 0.15).map(([k]) => [k, +got[k as keyof typeof got].toFixed(2)]));
    expect(off).toEqual({});
  });
});
