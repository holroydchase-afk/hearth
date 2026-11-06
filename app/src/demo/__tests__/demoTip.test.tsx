// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-BAR review (ux-reviewer P1): on a phone nothing pointed to Grandma Jo's view once it moved into
// the Details drawer, so Photos shows one tip line there. The laptop's story panel already says it.
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { DemoTip, demoTip } from '../DemoTip';
import { WIDE } from '../DemoFrame';

describe('FIRSTMIN-3 the phone tip is three numbered steps', () => {
  it('FIRSTMIN-3 as the parent on a phone: 3 steps, one names Details, the last says See it as Grandma Jo', () => {
    for (const w of [360, 390, WIDE - 1]) {
      const steps = demoTip(w, 'parent');
      expect(Array.isArray(steps)).toBe(true);
      expect(steps).toHaveLength(3);
      const list = steps as unknown as string[];
      list.forEach((s) => expect(typeof s === 'string' && s.trim().length > 0).toBe(true));
      expect(list.some((s) => /Details/.test(s))).toBe(true);
      expect(list[2]).toMatch(/See it as Grandma Jo/);
      expect(list[0]).toMatch(/Photos/);
    }
  });

  it('FIRSTMIN-3 nothing at WIDE or wider, or in Grandma Jo\'s own view', () => {
    expect(demoTip(WIDE, 'parent')).toBeNull();
    expect(demoTip(1280, 'parent')).toBeNull();
    expect(demoTip(390, 'grandma')).toBeNull();
    expect(demoTip(WIDE, 'grandma')).toBeNull();
  });

  it('FIRSTMIN-3 renders the steps numbered 1, 2, 3, each at 17 pt or more', () => {
    const steps = demoTip(390, 'parent') as unknown as string[];
    // Engineer's call on the prop name; this test assumes DemoTip takes the steps as `steps`.
    render(<DemoTip {...({ steps } as unknown as { text: string })} />);
    const tip = screen.getByTestId('demo-tip');
    const texts = tip.findAll((n) => (n.type as unknown) === 'Text');
    const words = texts.map((n) => [n.props.children].flat().filter((c) => typeof c === 'string' || typeof c === 'number').join('')).join(' ');
    expect(words).toMatch(/1\D[\s\S]*2\D[\s\S]*3\D/);
    for (const s of steps) expect(words).toContain(s);
    for (const n of texts) expect(StyleSheet.flatten(n.props.style)?.fontSize ?? 0).toBeGreaterThanOrEqual(17);
  });
});

describe('DEMO-BAR phone tip', () => {
  it("DEMO-BAR the parent's Photos on a phone points to Details, then Grandma Jo", () => {
    // FIRSTMIN-3 replaced the one line with three numbered steps (see below).
    expect(demoTip(390, 'parent')).not.toBeNull();
    expect(demoTip(899, 'parent')).not.toBeNull();
  });

  it('DEMO-BAR no tip beside the laptop story panel or in Grandma Jo\'s own view', () => {
    expect(demoTip(1280, 'parent')).toBeNull();
    expect(demoTip(390, 'grandma')).toBeNull();
  });

  it('DEMO-BAR the tip is one muted line', () => {
    render(<DemoTip text="Tip: tap Details, then See it as Grandma Jo." />);
    expect(screen.getByText('Tip: tap Details, then See it as Grandma Jo.')).toBeTruthy();
  });
});
