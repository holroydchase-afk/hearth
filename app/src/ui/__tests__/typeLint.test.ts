// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// TYPE-5 / TYPE-8 (docs/product/SPEC-TYPE.md, DEC-84): every text size comes from the named scale in ui/theme.ts.
// Written first (red), Nov 24, by qa-tdd. Contract: see typeScale.test.tsx's header.
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', '..');
const THEME = path.join(SRC, 'ui', 'theme.ts');

function files(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules' || p === path.join(SRC, 'test')) continue;
      out.push(...files(p));
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && p !== THEME) out.push(p);
  }
  return out;
}

/** Each match as "file:line  text". */
function find(re: RegExp): string[] {
  const hits: string[] = [];
  for (const f of files(SRC)) {
    const text = fs.readFileSync(f, 'utf8');
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    for (const m of text.matchAll(g)) {
      const line = text.slice(0, m.index).split('\n').length;
      hits.push(`${path.relative(SRC, f)}:${line}  ${m[0].replace(/\s+/g, ' ').slice(0, 80)}`);
    }
  }
  return hits;
}

describe('TYPE-5 lint: no text size outside the named scale', () => {
  it('TYPE-5 the scan sees the app (sanity)', () => {
    expect(files(SRC).length).toBeGreaterThan(50);
    expect(files(SRC).some((f) => f.endsWith(path.join('ui', 'kit.tsx')))).toBe(true);
    expect(files(SRC).includes(THEME)).toBe(false);
  });

  it('TYPE-5 no fontSize or lineHeight set to a number literal outside ui/theme.ts', () => {
    expect(find(/\b(fontSize|lineHeight)\s*:\s*-?\d+/)).toEqual([]);
  });

  it('TYPE-5 no t.base, t.title, t.display, t.line, typeScale( or GALLERY_TYPE', () => {
    expect(find(/\bt\.(base|title|display|line)\b|\btypeScale\s*\(|\bGALLERY_TYPE\b/)).toEqual([]);
  });

  it('TYPE-5 no Txt variant "strong", "title", "display" or "muted"', () => {
    expect(find(/<Txt\b[^>]*?\bvariant=\{?["'](strong|title|display|muted)["']/)).toEqual([]);
  });
});

describe('TYPE-8 text keeps growing with the phone\'s text size', () => {
  it('TYPE-8 allowFontScaling={false} only on the two STAMP_MARK texts', () => {
    const all = find(/allowFontScaling=\{false\}/);
    const stamp = find(/<Text\b[^>]*?allowFontScaling=\{false\}[^>]*?STAMP_MARK[^>]*>|<Text\b[^>]*?STAMP_MARK[^>]*?allowFontScaling=\{false\}[^>]*>/);
    expect({ total: all.length, onStamp: stamp.length }).toEqual({ total: 2, onStamp: 2 });
  });

});
