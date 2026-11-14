// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// TOOLBAR-1 (UX-R1, Nov 13 showcase review): with bigger text the Photos toolbar can't fit its buttons in one row.
// It then wraps two to a row, so no button sits alone on a second line ("All photos" alone looked broken).
import { act, fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { FakeBackend } from '../../api/fake/FakeBackend';
import { seedPost } from '../../test/seed';
import { renderApp } from '../../test/renderApp';
import { PhotosScreen } from '../PhotosScreen';

const layout = (width: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height: 60 } } });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const widthOf = (n: { props: Record<string, any> }) => (StyleSheet.flatten(n.props.style) as { width?: unknown } | undefined)?.width;

async function toolbar(barWidth: number, buttonWidth: number | number[]) {
  const be = FakeBackend.withFixture({ joIsMember: true });
  await seedPost(be, { caption: 'Lake day', photos: 1 });
  await renderApp(<PhotosScreen />, { be, user: 'jo' });
  const bar = await screen.findByTestId('photos-toolbar');
  const items = await screen.findAllByTestId('photos-toolbar-item');
  await act(async () => {
    fireEvent(bar, 'layout', layout(barWidth));
    items.forEach((it, i) => fireEvent(it, 'layout', layout(Array.isArray(buttonWidth) ? buttonWidth[i]! : buttonWidth)));
  });
  return screen.getAllByTestId('photos-toolbar-item');
}

describe('TOOLBAR-1 Photos toolbar wraps two to a row', () => {
  it('TOOLBAR-1 when the buttons fit in one row, they keep their own width', async () => {
    const items = await toolbar(600, 90);
    expect(items.length).toBeGreaterThanOrEqual(4);
    for (const it of items) expect(widthOf(it)).toBeUndefined();
  });

  it('TOOLBAR-1 when they don\'t fit, each takes half the row, so none is left alone', async () => {
    const items = await toolbar(358, 110);
    for (const it of items) expect(widthOf(it)).toBe('50%');
  });

  it('TOOLBAR-1 it adds up each button\'s own width: short words plus one long one still fit in one row', async () => {
    const items = await toolbar(358, [84, 70, 66, 96]);
    for (const it of items) expect(widthOf(it)).toBeUndefined();
  });
});
