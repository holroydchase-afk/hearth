// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DS-TOKENS (intake #95): the design system in one portable file. docs/design/tokens.json is generated
// from theme.ts so other studio products can reuse the scale with their own colors. Regenerate with
//   cd app && UPDATE_TOKENS=1 npx jest designTokens
import fs from 'fs';
import path from 'path';
import { portableTokens, themesCss } from '../tokens';

const file = path.join(__dirname, '..', '..', '..', '..', 'docs', 'design', 'tokens.json');
const cssFile = path.join(__dirname, '..', '..', '..', '..', 'docs', 'design', 'themes.css');

describe('DS-TOKENS portable design tokens', () => {
  it('DS-TOKENS docs/design/tokens.json matches theme.ts', () => {
    const want = JSON.stringify(portableTokens(), null, 2) + '\n';
    if (process.env.UPDATE_TOKENS) fs.writeFileSync(file, want);
    expect(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '').toBe(want);
  });

  it('DS-TOKENS FONT-4 carries one font family, three weights, the type scale, spacing, corners and both palettes', () => {
    const t = portableTokens();
    // FONT-4 (DEC-78, Nov 21; was RD-2's phone font) and RD-55 (DEC-65): Atkinson Hyperlegible Next, Regular,
    // Medium (names) and SemiBold; no Bold.
    expect(t.font.family).toMatch(/^Atkinson Hyperlegible Next\b/);
    expect(Object.values(t.font.weight).every((w) => [400, 500, 600].includes(w as number))).toBe(true);
    expect(Object.values(t.font.weight)).toEqual(expect.arrayContaining([400, 600]));
    expect(t.type.default.base).toBe(17);
    expect(t.type.large.base).toBe(21);
    expect(t.space.lg).toBe(16);
    expect(t.radius.pill).toBe(999);
    expect(t.target.min).toBe(48);
    expect(Object.keys(t.color.light)).toEqual(Object.keys(t.color.dark));
  });

  // DS-THEMES-1 (Chase, Nov 21: "we also probably want the themes sharable"): Paper, Avocado and Pomegranate as one
  // CSS file any studio web product can drop in, generated from theme.ts like tokens.json.
  it('DS-THEMES-1 docs/design/themes.css matches theme.ts', () => {
    const want = themesCss();
    if (process.env.UPDATE_TOKENS) fs.writeFileSync(cssFile, want);
    expect(fs.existsSync(cssFile) ? fs.readFileSync(cssFile, 'utf8') : '').toBe(want);
  });

  it('DS-THEMES-2 every theme has light, dark and high-contrast blocks with studio and Material 3 role names', () => {
    const css = themesCss();
    for (const n of ['paper', 'avocado', 'pomegranate']) {
      expect(css).toContain(`[data-hearth-theme="${n}"]`);
      expect(css).toContain(`[data-hearth-theme="${n}"][data-mode="dark"]`);
      expect(css).toContain(`[data-hearth-theme="${n}"][data-contrast="more"]`);
    }
    expect(css).toMatch(/:root,\s*\[data-hearth-theme="paper"\]/); // Paper is the default
    for (const v of ['--bg', '--ink', '--accent', '--accent-ink', '--md-sys-color-primary', '--md-sys-color-on-surface', '--md-sys-color-outline-variant']) expect(css).toContain(`${v}:`);
    expect(css).toContain('prefers-color-scheme: dark');
    expect(css).toContain('"Atkinson Hyperlegible Next", system-ui, sans-serif');
  });

  it('DS-THEMES-3 tokens.json carries the Material 3 role name for each color token', () => {
    const t = portableTokens() as { roles?: Record<string, string> };
    expect(t.roles?.accent).toBe('primary');
    expect(t.roles?.ink).toBe('on-surface');
    expect(t.roles?.fill).toBe('surface-container');
  });
});
