// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DS-TOKENS (intake #95): theme.ts as plain data, for docs/design/tokens.json. Other products reuse
// the type scale, spacing, corners and tap target, and swap in their own colors.
import { MIN_TARGET, THEME_NAMES, RADIUS, SPACE, paletteFor, typeScale } from './theme';

export function portableTokens() {
  return {
    $description: 'Hearth design tokens, generated from app/src/ui/theme.ts (DS-2, DS-13, RD-1..RD-8, RD-44, RD-55, RD-94..RD-96). Do not edit by hand.',
    font: {
      family: 'system (SF Pro on iPhone, Roboto on Android, system-ui on the web)',
      weight: { regular: 400, medium: 500, semibold: 600 },
      rules: 'Regular for reading; Semibold for titles, buttons, the picked tab and the large title; Medium for a name on a post. No Bold, Light, italics or all caps (RD-55).',
    },
    type: { default: typeScale(false), large: typeScale(true) },
    space: { ...SPACE },
    radius: { ...RADIUS, dialogIos: 14, dialogAndroid: 28 },
    target: { min: MIN_TARGET },
    color: { light: { ...paletteFor('web', false) }, dark: { ...paletteFor('web', true) } },
    // RD-95 / RD-97: every theme the owner can pick; color above is the default (Paper).
    themes: Object.fromEntries(THEME_NAMES.map((n) => [n, { light: { ...paletteFor('web', false, n) }, dark: { ...paletteFor('web', true, n) } }])),
  };
}
