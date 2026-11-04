// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// LOOK-1..3 (intake #95, Chase Nov 4: keep Atkinson, fix the dated look with spacing and tokens).
// The post card reads cleaner: the date and who it went to sit on their own lines instead of one
// wrapped run, the initial lines up with the name, and the card's insets come from the 4 pt grid.
import { screen, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { seedPost } from '../../test/seed';
import { renderApp } from '../../test/renderApp';
import { SPACE } from '../../ui/theme';
import { PhotosScreen } from '../PhotosScreen';

const { dadSide } = FIXTURE.circles;
const flat = (s: unknown) => StyleSheet.flatten(s as never) as Record<string, unknown>;

async function card() {
  const be = FakeBackend.withFixture();
  const { id } = await seedPost(be, { caption: 'At the lake', circles: [dadSide.id] });
  await renderApp(<PhotosScreen />, { be, user: 'chase' });
  return { id, el: await screen.findByTestId(`post-${id}`) };
}

describe('LOOK: a cleaner post card', () => {
  it('LOOK-1 the date and the audience are two lines, and the audience says "Sent to"', async () => {
    const { id, el } = await card();
    expect(String(within(el).getByTestId(`when-${id}`).props.children)).not.toMatch(/to Grandparents/);
    expect(within(el).getByTestId(`to-${id}`).props.children).toBe("Sent to Grandparents – Dad's side");
  });

  it('LOOK-2 the initial lines up with the name, not the middle of a tall block', async () => {
    const { id, el } = await card();
    expect(flat(within(el).getByTestId(`card-head-${id}`).props.style).alignItems).toBe('flex-start');
  });

  it('LOOK-3 the head and words use the spacing scale: 16 pt sides, 12 pt top', async () => {
    const { id, el } = await card();
    const head = flat(within(el).getByTestId(`card-head-${id}`).props.style);
    expect(head.paddingLeft).toBe(SPACE.lg);
    expect(head.paddingTop).toBe(SPACE.md);
    const grid = Object.values(SPACE) as number[];
    for (const k of ['paddingLeft', 'paddingTop', 'paddingBottom', 'gap']) expect(grid).toContain(head[k]);
  });
});
