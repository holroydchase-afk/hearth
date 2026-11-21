// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DS-TOKENS (intake #95): theme.ts as plain data, for docs/design/tokens.json. Other products reuse
// the type scale, spacing, corners and tap target, and swap in their own colors.
import { MIN_TARGET, THEME_NAMES, RADIUS, SPACE, paletteFor, typeScale, type Colors, type ThemeName } from './theme';

/** DS-THEMES-3 (DSG-6): each studio color token's Material 3 role, so other products can map it straight in. */
export const MATERIAL_ROLES: Record<keyof Colors, string> = {
  bg: 'background', surface: 'surface-container-low', ink: 'on-surface', muted: 'on-surface-variant',
  line: 'outline-variant', tabLine: 'outline', fill: 'surface-container', photo: 'surface-container-high',
  accent: 'primary', accentInk: 'on-primary', accentSoft: 'primary-container',
  safe: 'success', safeSoft: 'success-container', danger: 'error', onDanger: 'on-error', dangerText: 'error-text',
  scrim: 'scrim',
};

export function portableTokens() {
  return {
    $description: 'Hearth design tokens, generated from app/src/ui/theme.ts (DS-2, DS-13, RD-1..RD-8, RD-44, RD-55, RD-94..RD-96). Do not edit by hand.',
    font: {
      family: 'Atkinson Hyperlegible Next (bundled on iPhone, Android and the web; DEC-78)',
      weight: { regular: 400, medium: 500, semibold: 600 },
      rules: 'Regular for reading; SemiBold for titles, buttons, the picked tab and the large title; Medium for a name on a post. No Bold, Light, italics or all caps (RD-55).',
    },
    type: { default: typeScale(false), large: typeScale(true) },
    space: { ...SPACE },
    radius: { ...RADIUS, dialogIos: 14, dialogAndroid: 28 },
    target: { min: MIN_TARGET },
    color: { light: { ...paletteFor('web', false) }, dark: { ...paletteFor('web', true) } },
    // RD-95 / RD-97: every theme the owner can pick; color above is the default (Paper).
    roles: { ...MATERIAL_ROLES },
    themes: Object.fromEntries(THEME_NAMES.map((n) => [n, { light: { ...paletteFor('web', false, n) }, dark: { ...paletteFor('web', true, n) } }])),
  };
}

const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
function vars(c: Colors, indent: string): string {
  return (Object.keys(MATERIAL_ROLES) as (keyof Colors)[])
    .map((k) => `${indent}--${kebab(k)}: ${c[k]};\n${indent}--md-sys-color-${MATERIAL_ROLES[k]}: ${c[k]};`)
    .join('\n');
}

/** DS-THEMES-1/2 (Chase, Nov 21): Paper, Avocado and Pomegranate as CSS variables for any studio web product,
 *  written to docs/design/themes.css. Set data-hearth-theme on <html>; data-mode="dark"|"light" forces a mode,
 *  otherwise the phone's setting decides; data-contrast="more" gives the high-contrast set. */
export function themesCss(): string {
  const out: string[] = [
    '/* Studio themes: Paper (default), Avocado, Pomegranate. Generated from app/src/ui/theme.ts in',
    '   holroydchase-afk/hearth (cd app && UPDATE_TOKENS=1 npx jest designTokens). Do not edit by hand.',
    '   Use: <html data-hearth-theme="avocado">; add data-mode="dark" or "light" to force a mode (otherwise the',
    '   device decides) and data-contrast="more" for the high-contrast set. Each color is given twice: the studio',
    '   name (--accent) and its Material 3 role (--md-sys-color-primary). See docs/design/STUDIO-CORE.md. */',
    '',
    ':root {',
    '  --font-body: "Atkinson Hyperlegible Next", system-ui, sans-serif;',
    '}',
  ];
  THEME_NAMES.forEach((n: ThemeName) => {
    const sel = `[data-hearth-theme="${n}"]`;
    const root = n === 'paper' ? `:root, ${sel}` : sel;
    out.push('', `/* ${n[0]!.toUpperCase()}${n.slice(1)} */`);
    out.push(`${root} {\n  color-scheme: light;\n${vars(paletteFor('web', false, n), '  ')}\n}`);
    const darkSel = n === 'paper' ? `:root:not([data-mode="light"]), ${sel}:not([data-mode="light"])` : `${sel}:not([data-mode="light"])`;
    out.push(`@media (prefers-color-scheme: dark) {\n  ${darkSel} {\n    color-scheme: dark;\n${vars(paletteFor('web', true, n), '    ')}\n  }\n}`);
    out.push(`${sel}[data-mode="dark"] {\n  color-scheme: dark;\n${vars(paletteFor('web', true, n), '  ')}\n}`);
    out.push(`${sel}[data-contrast="more"] {\n${vars(paletteFor('web', false, n, true), '  ')}\n}`);
    out.push(`${sel}[data-contrast="more"][data-mode="dark"] {\n${vars(paletteFor('web', true, n, true), '  ')}\n}`);
  });
  return out.join('\n') + '\n';
}
