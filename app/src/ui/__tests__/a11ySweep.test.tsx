// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// A11Y sweep (Nov 1, 2026): docs/design/a11y-sweep-2026-11-01.md. Each test names the finding it closes.
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Switch } from 'react-native';
import { Choice, Txt } from '../kit';
import { contrast, paletteFor } from '../theme';

describe('A11Y sweep', () => {
  it('A11Y-1: the screen title is the only level-1 heading; card and section titles are level 2', () => {
    render(<>
      <Txt variant="display" role="header">Photos of Mia and Leo</Txt>
      <Txt variant="title" role="header">Mia's 5th birthday</Txt>
      <Txt>Pumpkin patch day</Txt>
    </>);
    expect(screen.getByText('Photos of Mia and Leo').props['aria-level']).toBe(1);
    expect(screen.getByText("Mia's 5th birthday").props['aria-level']).toBe(2);
    expect(screen.getByText('Pumpkin patch day').props['aria-level']).toBeUndefined();
  });

  it('A11Y-2: a switch that is On has a thumb in Hearth colors, not the web default teal', () => {
    const c = paletteFor('web', false);
    render(<Choice kind="switch" label="Bigger text" title="Bigger text" checked onPress={() => {}} />);
    const sw = screen.UNSAFE_getByType(Switch);
    expect(sw.props.activeThumbColor).toBe(c.surface);
  });

  it('A11Y-3: a switch that is Off still shows its track at 3:1 or better (WCAG 1.4.11), in light and dark', () => {
    render(<Choice kind="switch" label="Bigger text" title="Bigger text" checked={false} onPress={() => {}} />);
    expect(screen.UNSAFE_getByType(Switch).props.trackColor).toEqual({ true: paletteFor('web', false).accent, false: paletteFor('web', false).muted });
    for (const dark of [false, true]) {
      const c = paletteFor('web', dark);
      expect(contrast(c.muted, c.surface)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('DS-13 tokens', () => {
  it('DS-13: one spacing scale on a 4 pt grid and four corner sizes (plus each phone\'s own dialog corner)', () => {
    const { SPACE, RADIUS, dialogRadius } = require('../theme');
    expect(Object.values(SPACE)).toEqual([4, 8, 12, 16, 24, 32]);
    expect(Object.values(RADIUS)).toEqual([4, 12, 20, 999]);
    expect(dialogRadius('ios')).toBe(14);
    expect(dialogRadius('android')).toBe(28);
  });

  it('DS-13: the shared kit uses only the corner tokens', () => {
    const src: string = require('fs').readFileSync(require('path').join(__dirname, '../kit.tsx'), 'utf8');
    expect(src.match(/borderRadius: ?\d+/g) ?? []).toEqual([]);
  });
});
