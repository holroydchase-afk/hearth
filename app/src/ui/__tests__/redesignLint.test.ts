// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-2, RD-3, RD-4, RD-6, RD-7, RD-8 (docs/product/SPEC-REDESIGN.md, phase 1a): source scans of app/src, so a
// screen can't quietly bring back a custom font, a hard-coded accent, a filled icon, a big filled button or
// an off-scale corner. Each failure lists file:line so the fix is easy to find.
import fs from 'fs';
import path from 'path';

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
/** Every match in app/src as "file:line text". */
function find(re: RegExp, files = sources(), skip: (file: string) => boolean = () => false): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (skip(rel(f))) continue;
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
      out.push(`${rel(f)}:${lineOf(text, m.index!)} ${m[0].replace(/\s+/g, ' ').slice(0, 80)}`);
    }
  }
  return out;
}

/** Each `<Button ...>` JSX element: its props text, file and line. Brace depth keeps `() => x` inside props. */
function buttons(): { at: string; props: string }[] {
  const out: { at: string; props: string }[] = [];
  for (const f of sources()) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/<Button\b/g)) {
      let depth = 0; let i = m.index! + 7;
      for (; i < text.length; i++) {
        const ch = text[i];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        else if (depth === 0 && ch === '>') break;
      }
      out.push({ at: `${rel(f)}:${lineOf(text, m.index!)}`, props: text.slice(m.index! + 7, i) });
    }
  }
  return out;
}

describe('RD 1a source scans', () => {
  it('RD-2 Atkinson is no longer loaded anywhere in the app', () => {
    expect(find(/atkinson-hyperlegible|AtkinsonHyperlegible/i)).toEqual([]);
    expect(find(/useFonts\s*\(/)).toEqual([]);
  });

  it('RD-2 no Medium, Bold or heavier weights outside the large title (kit display)', () => {
    expect(find(/FONT\.medium|fontWeight:\s*['"](500|700|800|900|bold)['"]/, sources(), (f) => f === 'ui/theme.ts')
      .filter((hit) => !/^ui\/kit\.tsx:\d+ fontWeight: ['"](700|bold)['"]/.test(hit))).toEqual([]);
  });

  it('RD-3 no component hard-codes an accent hex (old or new); theme.ts is the only home', () => {
    const accents = ['B23A1E', 'FF8A65', '2E7D4F', '6FCF97', '8E3A8F', 'D9A0E0', 'A4421F', 'F4A47F', '2D6A4E', '8FD1AE', '5A3EA6', 'C5B3F5'];
    expect(find(new RegExp(`#(${accents.join('|')})\\b`, 'i'), sources(), (f) => f === 'ui/theme.ts')).toEqual([]);
  });

  it('RD-4 the accent is used only by the tab bar, the kit (switch On, link words, main tap word or chip), New for you and the new-message dot', () => {
    // Allowed homes for c.accent. Anything else (avatar letters, event card borders, video pills, spinners) is ink.
    const allowed = new Set(['ui/theme.ts', 'ui/kit.tsx', 'screens/TabBar.tsx', 'app/(tabs)/_layout.tsx', 'screens/NewForYou.tsx', 'demo/DemoBar.tsx']);
    expect(find(/\bc\.accent\b(?!Ink|Soft)/, sources(), (f) => allowed.has(f))).toEqual([]);
  });

  it('RD-4 a spinner is never the accent color', () => {
    expect(find(/<ActivityIndicator[^>]*color=\{c\.accent\}/)).toEqual([]);
  });

  it('RD-6 outline symbols only: no SF ".fill" names and no filled Material names', () => {
    expect(find(/sf:\s*['"][\w.]+\.fill['"]|ios:\s*['"][\w.]+\.fill['"]/)).toEqual([]);
    expect(find(/md:\s*['"]\w+_filled['"]/)).toEqual([]);
    // Regular weight: no symbol asks for a heavier weight.
    expect(find(/<SymbolView[^>]*weight=\{?['"](medium|semibold|bold|heavy|black)['"]/)).toEqual([]);
  });

  it('RD-7 no large filled button except Delete and Leave confirms, sign-in, Start a family, and Post on Share', () => {
    const SIGN_IN = new Set(['screens/AppGate.tsx', 'screens/SignInScreen.tsx', 'screens/SignInFlow.tsx', 'screens/EmailCodeFlow.tsx', 'screens/TextCodeFlow.tsx',
      'screens/InviteCodeEntry.tsx', 'screens/JoinScreen.tsx', 'screens/StartFamily.tsx']);
    const offenders: string[] = [];
    for (const b of buttons()) {
      const file = b.at.replace(/:\d+$/, '');
      const v = /variant=(?:"(\w+)"|\{([^}]*)\})/.exec(b.props);
      const variant = v ? (v[1] ?? v[2]!) : 'primary'; // primary is the default: a filled accent pill
      const filled = /primary|danger/.test(variant);
      if (!filled) continue;
      const label = /(?:label|text)=(?:"([^"]*)"|\{([^}]*)\})/.exec(b.props);
      const words = label ? (label[1] ?? label[2]!) : '';
      if (SIGN_IN.has(file)) continue;
      if (file === 'screens/ShareScreen.tsx' && /\bPost\b/.test(words) && /primary/.test(variant)) continue;
      if (file === 'ui/kit.tsx' && /\{yes\}/.test(b.props)) continue; // Confirm's yes: checked for Delete/Leave below
      if (/danger/.test(variant) && /\b(Delete|Leave)\b/.test(words)) continue;
      if (file === 'demo/DemoBar.tsx' && /danger/.test(variant) && words === 'Reset') continue; // the demo's delete-everything confirm
      offenders.push(`${b.at} ${variant} "${words.slice(0, 50)}"`);
    }
    expect(offenders).toEqual([]);
  });

  it('RD-7 a Confirm dialog with a filled button is only for Delete or Leave', () => {
    // <Confirm yes="..."> draws yes as a filled danger button; any other confirm must not.
    const offenders: string[] = [];
    for (const f of sources()) {
      const text = fs.readFileSync(f, 'utf8');
      for (const m of text.matchAll(/<Confirm\b[\s\S]*?yes=(?:"([^"]*)"|\{([^}]*)\})/g)) {
        const yes = m[1] ?? m[2]!;
        if (!/\b(Delete|Leave)\b|take me off Hearth/i.test(yes)) offenders.push(`${rel(f)}:${lineOf(text, m.index!)} yes=${yes.slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('RD-8 corners stay on the scale: 0, 4, 12, 14/28 dialogs, pills, or a true circle; no 10, 16 or 20', () => {
    const offenders: string[] = [];
    for (const f of sources()) {
      const text = fs.readFileSync(f, 'utf8');
      for (const m of text.matchAll(/borderRadius:\s*(\d+)/g)) {
        const r = Number(m[1]);
        if ([0, 4, 12, 14, 28, 999].includes(r)) continue;
        const around = text.slice(Math.max(0, m.index! - 120), m.index! + 120);
        if (new RegExp(`width:\\s*${r * 2}\\b`).test(around)) continue; // a circle (avatar)
        offenders.push(`${rel(f)}:${lineOf(text, m.index!)} borderRadius: ${r}`);
      }
    }
    expect(offenders).toEqual([]);
    expect(find(/RADIUS\.large/)).toEqual([]);
  });
});
