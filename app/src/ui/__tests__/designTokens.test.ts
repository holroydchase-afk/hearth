// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DS-TOKENS (intake #95): the design system in one portable file. docs/design/tokens.json is generated
// from theme.ts so other studio products can reuse the scale with their own colors. Regenerate with
//   cd app && UPDATE_TOKENS=1 npx jest designTokens
import fs from 'fs';
import path from 'path';
import { portableTokens } from '../tokens';

const file = path.join(__dirname, '..', '..', '..', '..', 'docs', 'design', 'tokens.json');

describe('DS-TOKENS portable design tokens', () => {
  it('DS-TOKENS docs/design/tokens.json matches theme.ts', () => {
    const want = JSON.stringify(portableTokens(), null, 2) + '\n';
    if (process.env.UPDATE_TOKENS) fs.writeFileSync(file, want);
    expect(fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '').toBe(want);
  });

  it('DS-TOKENS carries one font family, three weights, the type scale, spacing, corners and both palettes', () => {
    const t = portableTokens();
    expect(t.font.family).toBe('Atkinson Hyperlegible Next');
    expect(Object.values(t.font.weight)).toEqual([400, 500, 600]);
    expect(t.type.default.base).toBe(17);
    expect(t.type.large.base).toBe(21);
    expect(t.space.lg).toBe(16);
    expect(t.radius.pill).toBe(999);
    expect(t.target.min).toBe(48);
    expect(Object.keys(t.color.light)).toEqual(Object.keys(t.color.dark));
  });
});
