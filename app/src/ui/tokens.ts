// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DS-TOKENS (intake #95): theme.ts as plain data, for docs/design/tokens.json. Other products reuse
// the type scale, spacing, corners and tap target, and swap in their own colors.
import { COLOR_NAMES, MIN_TARGET, RADIUS, SPACE, paletteFor, typeScale } from './theme';

export function portableTokens() {
  return {
    $description: 'Hearth design tokens, generated from app/src/ui/theme.ts (DS-2, DS-13, RD-1..RD-8). Do not edit by hand.',
    font: {
      family: 'system (SF Pro on iPhone, Roboto on Android, system-ui on the web)',
      weight: { regular: 400, semibold: 600, bold: 700 },
      rules: 'Regular for reading; Semibold for names, titles, buttons and the picked tab; Bold only in the large title. No Light, Medium, italics or all caps.',
    },
    type: { default: typeScale(false), large: typeScale(true) },
    space: { ...SPACE },
    radius: { ...RADIUS, grid: 0, dialogIos: 14, dialogAndroid: 28 },
    target: { min: MIN_TARGET },
    color: { light: { ...paletteFor('web', false) }, dark: { ...paletteFor('web', true) } },
    // RD-24: every family color the owner can pick; color above is the default (Ember). Only the accent differs.
    colorChoices: Object.fromEntries(COLOR_NAMES.map((n) => [n, { light: { ...paletteFor('web', false, n) }, dark: { ...paletteFor('web', true, n) } }])),
  };
}
