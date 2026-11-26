// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-2, RD-3, RD-4, RD-6, RD-7, RD-8 (docs/product/SPEC-REDESIGN.md, phase 1a): source scans of app/src, so a
// screen can't quietly bring back a custom font, a hard-coded accent, a filled icon, a big filled button or
// an off-scale corner. Each failure lists file:line so the fix is easy to find.
import fs from 'fs';
import path from 'path';
import FRUIT from './fixtures/fruit-palettes.json';

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
  // qa-tdd, Nov 21: reversed by DEC-78 (FONT-1). Atkinson comes back, imported only in theme.ts and loaded only by
  // the root layout's useFonts; screens use FONT.* and never name the files themselves.
  it('RD-2 → FONT-1 Atkinson is imported only by theme.ts and useFonts runs only in the root layout', () => {
    expect(find(/@expo-google-fonts\/atkinson-hyperlegible-next/i).map((l) => l.split(':')[0])).toEqual(expect.arrayContaining(['ui/theme.ts']));
    expect(find(/@expo-google-fonts\/atkinson-hyperlegible-next/i, sources(), (f) => f === 'ui/theme.ts')).toEqual([]);
    expect(find(/useFonts\s*\(/).map((l) => l.split(':')[0])).toEqual(['app/_layout.tsx']);
  });

  // Updated Nov 17 for RD-55 (DEC-65): no Bold anywhere, the large title included; Medium is allowed for names (RD-48).
  it('RD-2 RD-55 no Bold or heavier weight anywhere (WEIGHT.bold, 700, 800, 900, "bold")', () => {
    expect(find(/WEIGHT\.bold|fontWeight:\s*['"](700|800|900|bold)['"]/, sources(), (f) => f === 'ui/theme.ts')).toEqual([]);
    // FONT-1 (DEC-78): no Bold Atkinson family either, theme.ts included.
    expect(find(/FONT\.bold|AtkinsonHyperlegibleNext_(700|800|900)\w*/)).toEqual([]);
  });

  it('RD-3 no component hard-codes an accent hex (old or new); theme.ts is the only home', () => {
    const accents = ['B23A1E', 'FF8A65', '2E7D4F', '6FCF97', '8E3A8F', 'D9A0E0', 'A4421F', 'F4A47F', '2D6A4E', '8FD1AE', '5A3EA6', 'C5B3F5', 'AD371D', '276B43', '3B6120', 'B4D16A', 'A3172F', 'FF8597', '2F5419', '7ED69B', 'B3D25B']; // qa-tdd Nov 20: RD-111/RD-112's Hass Avocado (and the rejected #B3D25B); engineer, flagged for qa-tdd: RD-86's darker Ember and Forest; qa-tdd: RD-95's Avocado and Pomegranate
    // qa-tdd, Nov 23: FRUIT-1/2 (DEC-80) add the nine fruits' accents (from the fixture); theme.ts stays the only home.
    for (const f of Object.values(FRUIT as unknown as Record<string, { light: { accent: string }; dark: { accent: string } }>)) accents.push(f.light.accent.slice(1), f.dark.accent.slice(1));
    expect(find(new RegExp(`#(${accents.join('|')})\\b`, 'i'), sources(), (f) => f === 'ui/theme.ts')).toEqual([]);
  });

  it('RD-4 RD-114 the accent is used only by the tab bar, the kit (switch On, link words, main tap word or chip), New for you, the new-message dot and the picked reaction (PostCard)', () => {
    // Allowed homes for c.accent. Anything else (avatar letters, event card borders, video pills, spinners) is ink.
    // qa-tdd, Nov 20: RD-114 (DEC-76) adds the picked reaction's outline and count in PostCard.tsx.
    const allowed = new Set(['ui/theme.ts', 'ui/kit.tsx', 'screens/TabBar.tsx', 'app/(tabs)/_layout.tsx', 'screens/NewForYou.tsx', 'demo/DemoBar.tsx', 'screens/PostCard.tsx']);
    // QA-R4 (PR #174 fix round, qa-tdd Nov 24): ShareKinds.tsx is no longer allowed whole; SHARE-ST-31's kind icon
    // color is its one exception (checked in the QA-R4 test below).
    expect(find(/\bc\.accent\b(?!Ink|Soft)/, sources(), (f) => allowed.has(f) || f === 'screens/ShareKinds.tsx')).toEqual([]);
  });

  it('QA-R4 RD-4 ShareKinds.tsx uses the accent only for the kind icon (SystemIcon color), nowhere else: no other c.accent, no tone="accent"', () => {
    const file = sources().filter((f) => rel(f) === 'screens/ShareKinds.tsx');
    expect(file).toHaveLength(1);
    const uses = find(/\bc\.accent\b(?!Ink|Soft)/, file);
    const text = fs.readFileSync(file[0]!, 'utf8').split('\n');
    const notIcon = uses.filter((u) => !/<SystemIcon\b[^>]*\bcolor=\{c\.accent\}/.test(text[parseInt(u.split(':')[1]!, 10) - 1] ?? ''));
    expect(notIcon).toEqual([]);
    expect(find(/tone=["']accent["']|tone=\{["']accent["']\}/, file)).toEqual([]);
  });

  it('RD-4 a spinner is never the accent color', () => {
    expect(find(/<ActivityIndicator[^>]*color=\{c\.accent\}/)).toEqual([]);
  });

  it('RD-6 outline symbols only: no SF ".fill" names and no filled Material names', () => {
    // EF-HE-2 (SPEC-EVAL-FIXES): the one exception is the shared radio's picked ring, a filled accent circle in the kit.
    expect(find(/sf:\s*['"][\w.]+\.fill['"]|ios:\s*['"][\w.]+\.fill['"]/).filter((h) => !/^ui\/kit\.tsx:\d+ sf: 'checkmark\.circle\.fill'$/.test(h))).toEqual([]);
    expect(find(/md:\s*['"]\w+_filled['"]/)).toEqual([]);
    // Regular weight: no symbol asks for a heavier weight.
    expect(find(/<SymbolView[^>]*weight=\{?['"](medium|semibold|bold|heavy|black)['"]/)).toEqual([]);
  });

  it('RD-7 no large filled button except Delete and Leave confirms, sign-in, Start a family, and Send (was Post) on Share', () => {
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
      // DEC-73 (SHARE-PC-10; engineer, flagged for qa-tdd): the postcard's pinned "Send to <names>" replaces Post.
      if (file === 'screens/ShareScreen.tsx' && /\bPost\b|Send to|Next: who gets it/.test(words) && /primary/.test(variant)) continue;
      // DEC-90: a kind's step 1 shows the same pinned "Next: who gets it" (ShareKinds.tsx or ShareScreen.tsx).
      if ((file === 'screens/ShareKinds.tsx' || file === 'screens/ShareScreen.tsx') && words === 'Next: who gets it' && /primary/.test(variant)) continue;
      if (file === 'ui/kit.tsx' && /\{yes\}/.test(b.props)) continue; // Confirm's yes: checked for Delete/Leave below
      if (/danger/.test(variant) && /\b(Delete|Leave)\b/.test(words)) continue;
      if (file === 'demo/DemoBar.tsx' && /danger/.test(variant) && words === 'Reset') continue; // the demo's delete-everything confirm
      if (file === 'screens/GroupsScreen.tsx' && variant === 'primary' && words === 'New group') continue; // EF-HE-5-AC2: a deliberate DS-9 primary
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
        // "Yes, sign out" is a deliberate confirm too (SPEC-REDESIGN RD-7): signing out means a new code to get back in.
        if (!/\b(Delete|Leave)\b|take me off Hearth|^Yes, sign out$/i.test(yes)) offenders.push(`${rel(f)}:${lineOf(text, m.index!)} yes=${yes.slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  // Updated Nov 17 for RD-44/RD-54 (DEC-65): 16 joins the scale for photo tiles (Gallery mosaic, post photos).
  it('RD-8 corners stay on the scale: 0, 4, 12, 16 photos, 14/28 dialogs, pills, or a true circle; no 10 or 20', () => {
    const offenders: string[] = [];
    for (const f of sources()) {
      const text = fs.readFileSync(f, 'utf8');
      for (const m of text.matchAll(/borderRadius:\s*(\d+)/g)) {
        const r = Number(m[1]);
        if ([0, 4, 12, 14, 16, 28, 999].includes(r)) continue;
        const around = text.slice(Math.max(0, m.index! - 120), m.index! + 120);
        if (new RegExp(`width:\\s*${r * 2}\\b`).test(around)) continue; // a circle (avatar)
        offenders.push(`${rel(f)}:${lineOf(text, m.index!)} borderRadius: ${r}`);
      }
    }
    expect(offenders).toEqual([]);
    expect(find(/RADIUS\.large/)).toEqual([]);
  });
});
