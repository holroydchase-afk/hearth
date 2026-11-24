// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// FONT-1..FONT-4 (DEC-78, Chase Nov 21): Atkinson Hyperlegible Next everywhere (iPhone, Android, web demo),
// reversing RD-2 / DEC-59's "phone's own font". Regular 400, Medium 500, SemiBold 600 only; no Bold. Android can't
// synthesize a weight from one family, so the weight comes from the family (FONT.regular / medium / semibold), never
// from fontWeight. The web demo check is FONT-5 in app/e2e-web/demo.spec.js.
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import pkg from '../../../package.json';
import tokensJson from '../../../../docs/design/tokens.json';
import { Button, Txt } from '../kit';
import * as themeMod from '../theme';

const PKG = '@expo-google-fonts/atkinson-hyperlegible-next';
const FAMILIES = {
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  medium: 'AtkinsonHyperlegibleNext_500Medium',
  semibold: 'AtkinsonHyperlegibleNext_600SemiBold',
};
const theme = themeMod as Record<string, unknown>;
const SRC = path.join(__dirname, '..', '..');

function sources(dir = SRC): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'test' ? [] : sources(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}
const rel = (p: string) => path.relative(SRC, p).split(path.sep).join('/');
const lineOf = (text: string, i: number) => text.slice(0, i).split('\n').length;

describe('FONT Atkinson Hyperlegible Next everywhere (DEC-78)', () => {
  it('FONT-1 theme exports FONT families for Regular, Medium and SemiBold, FONT_FILES for useFonts, and the package is pinned at 0.4.1', () => {
    expect((pkg.dependencies as Record<string, string>)[PKG]).toBe('0.4.1');
    expect(theme.FONT).toEqual(FAMILIES);
    const files = theme.FONT_FILES as Record<string, unknown> | undefined;
    expect(Object.keys(files ?? {}).sort()).toEqual(Object.values(FAMILIES).sort());
    // One bundled file per weight (a require'd asset in Jest/Metro), never a URL: no network for the font.
    for (const [fam, f] of Object.entries(files ?? {})) expect({ fam, bundled: f !== undefined && typeof f !== 'string' }).toEqual({ fam, bundled: true });
    // No Bold or heavier family exported.
    expect(Object.values((theme.FONT ?? {}) as object).filter((f) => /_(700|800|900)/.test(String(f)))).toEqual([]);
  });

  it('FONT-1 the root layout loads FONT_FILES with expo-font useFonts and goes on with the phone font if loading fails', () => {
    const layout = fs.readFileSync(path.join(SRC, 'app', '_layout.tsx'), 'utf8');
    expect(layout).toMatch(/import\s*\{[^}]*\buseFonts\b[^}]*\}\s*from\s*['"]expo-font['"]/);
    expect(layout).toMatch(/useFonts\(\s*FONT_FILES\s*\)/);
    // Falls back on error: the "not ready" gate also checks the error, so a failed load never blanks the app.
    expect(layout).toMatch(/\[\s*\w+\s*,\s*(\w+)\s*\]\s*=\s*useFonts[\s\S]*![\w]+\s*&&\s*!\1/);
  });

  it('FONT-2 every Txt variant and the kit Button render in Atkinson, weight from the family (body/muted Regular; strong, title, large title, Button SemiBold)', () => {
    render(<>
      <Txt>Body words</Txt><Txt tone="muted">Quiet words</Txt><Txt variant="headline">Grandma Jo</Txt>
      <Txt variant="title2">A title</Txt><Txt variant="largeTitle">Large title</Txt>
      <Button label="Send" onPress={() => {}} />
    </>);
    const want: Record<string, string> = {
      'Body words': FAMILIES.regular, 'Quiet words': FAMILIES.regular, 'Grandma Jo': FAMILIES.semibold,
      'A title': FAMILIES.semibold, 'Large title': FAMILIES.semibold, Send: FAMILIES.semibold,
    };
    for (const [w, fam] of Object.entries(want)) {
      const s = StyleSheet.flatten(screen.getByText(w).props.style);
      expect({ w, fam: s.fontFamily, fontWeight: s.fontWeight }).toEqual({ w, fam, fontWeight: undefined });
    }
  });

  it('FONT-2 no <Text> in the kit is left without an Atkinson family (FONT.*)', () => {
    const f = path.join(SRC, 'ui', 'kit.tsx');
    const text = fs.readFileSync(f, 'utf8');
    const offenders: string[] = [];
    for (const m of text.matchAll(/<Text\b/g)) {
      // The opening tag's props, brace depth aware, so style={{ ... }} stays inside.
      let depth = 0; let i = m.index! + 5;
      for (; i < text.length; i++) {
        const ch = text[i];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        else if (depth === 0 && ch === '>') break;
      }
      const props = text.slice(m.index!, i);
      // Txt's own <Text> takes its family from the variant table (v[variant]); FONT-2 above renders it.
      if (/style=\{\[v\[variant\]/.test(props)) continue;
      // TYPE-6 (DEC-84; engineer, flagged for qa-tdd): Txt's own <Text> takes its family from the named style (v), and a
      // spread named style (...type.body, ...textStyle(...)) carries its family (TYPE-4 checks those are Atkinson).
      if (/style=\{\[v, style\]/.test(props) || /\.\.\.(type\.\w+|textStyle\()/.test(props)) continue;
      if (!/fontFamily:\s*(FONT\.\w+|\w+)/.test(props)) offenders.push(`ui/kit.tsx:${lineOf(text, m.index!)} ${props.replace(/\s+/g, ' ').slice(0, 80)}`);
    }
    expect(offenders).toEqual([]);
  });

  it('FONT-3 no fontWeight left in app/src (outside theme.ts): Android needs the weight from the family', () => {
    const out: string[] = [];
    for (const f of sources()) {
      if (rel(f) === 'ui/theme.ts') continue;
      const text = fs.readFileSync(f, 'utf8');
      for (const m of text.matchAll(/fontWeight\s*:/g)) out.push(`${rel(f)}:${lineOf(text, m.index!)}`);
    }
    expect(out).toEqual([]);
  });

  it('FONT-4 docs/design/tokens.json names Atkinson Hyperlegible Next, three weights, no Bold', () => {
    const t = tokensJson as { font: { family: string; weight: Record<string, number> } };
    expect(t.font.family).toMatch(/^Atkinson Hyperlegible Next\b/);
    expect(t.font.family).not.toMatch(/system/i);
    expect(t.font.weight).toEqual({ regular: 400, medium: 500, semibold: 600 });
  });
});
