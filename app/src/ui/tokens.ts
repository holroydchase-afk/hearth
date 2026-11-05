// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DS-TOKENS (intake #95): theme.ts as plain data, for docs/design/tokens.json. Other products reuse
// the type scale, spacing, corners and tap target, and swap in their own colors.
import { COLOR_NAMES, MIN_TARGET, RADIUS, SPACE, paletteFor, typeScale } from './theme';

export function portableTokens() {
  return {
    $description: 'Hearth design tokens, generated from app/src/ui/theme.ts (DS-2, DS-11..13, COLOR-1). Do not edit by hand.',
    font: {
      family: 'Atkinson Hyperlegible Next',
      weight: { regular: 400, medium: 500, semibold: 600 },
      rules: 'Regular for reading; Medium for Android buttons and tab labels; SemiBold for names, titles and buttons. No Light, Bold, italics or all caps.',
    },
    type: { default: typeScale(false), large: typeScale(true) },
    space: { ...SPACE },
    radius: { ...RADIUS, dialogIos: 14, dialogAndroid: 28 },
    target: { min: MIN_TARGET },
    color: { light: { ...paletteFor('web', false) }, dark: { ...paletteFor('web', true) } },
    // COLOR-1: every choice a person can pick on Help or Me; color above is the default (Ember).
    colorChoices: Object.fromEntries(COLOR_NAMES.map((n) => [n, { light: { ...paletteFor('web', false, n) }, dark: { ...paletteFor('web', true, n) } }])),
  };
}
