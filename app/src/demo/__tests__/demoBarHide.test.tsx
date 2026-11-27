// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-BAR-HIDE-1 (Chase, Nov 27): the phone's demo bar is hidden when EXPO_PUBLIC_HEARTH_DEMO_BAR=0 (the public build)
// and still shown otherwise; the laptop panel keeps its controls either way.
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Platform, Text } from 'react-native';
import { FakeBackend } from '../../api/fake/FakeBackend';

let mockWidth = 390;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 1, fontScale: 1 }),
}));

let mockBar = true;
jest.mock('../flags', () => ({
  __esModule: true,
  get DEMO_MODE() { return true; },
  get DEMO_BAR() { return mockBar; },
}));

// The env var itself: flags.ts read fresh with each value (no React involved, so isolateModules is safe).
function flagFor(bar: string | undefined): boolean {
  const prev = process.env.EXPO_PUBLIC_HEARTH_DEMO_BAR;
  if (bar === undefined) delete process.env.EXPO_PUBLIC_HEARTH_DEMO_BAR; else process.env.EXPO_PUBLIC_HEARTH_DEMO_BAR = bar;
  let v = true;
  jest.isolateModules(() => { v = jest.requireActual('../flags').DEMO_BAR; });
  if (prev === undefined) delete process.env.EXPO_PUBLIC_HEARTH_DEMO_BAR; else process.env.EXPO_PUBLIC_HEARTH_DEMO_BAR = prev;
  return v;
}

function show(bar: string | undefined, w: number) {
  mockWidth = w;
  mockBar = flagFor(bar);
  const { DemoChrome: Chrome } = require('../DemoChrome');
  (globalThis as { __hearthFake?: unknown }).__hearthFake = FakeBackend.withFixture({ joIsMember: true });
  return render(<Chrome><Text>the app</Text></Chrome>);
}

describe('DEMO-BAR-HIDE-1 phone demo bar flag', () => {
  it('DEMO-BAR-HIDE-1 EXPO_PUBLIC_HEARTH_DEMO_BAR=0 turns DEMO_BAR off; unset or 1 leaves it on', () => {
    expect([flagFor('0'), flagFor(undefined), flagFor('1')]).toEqual([false, true, true]);
  });

  const os = Platform.OS;
  beforeEach(() => { Object.defineProperty(Platform, 'OS', { get: () => 'web', configurable: true }); });
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true });
    delete (globalThis as { __hearthFake?: unknown }).__hearthFake;
  });

  it('DEMO-BAR-HIDE-1 flag off (=0) at 390 px: no demo bar, the app still shows', () => {
    show('0', 390);
    expect(screen.queryByTestId('demo-bar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Demo details' })).toBeNull();
    expect(screen.getByText('the app')).toBeTruthy();
  });

  it('DEMO-BAR-HIDE-1 flag on (unset) at 390 px: the demo bar with Demo details shows', () => {
    show(undefined, 390);
    expect(screen.getByTestId('demo-bar')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Demo details' })).toBeTruthy();
    expect(screen.getByText('the app')).toBeTruthy();
  });

  it('DEMO-BAR-HIDE-1 flag on (=1) at 390 px: the demo bar shows', () => {
    show('1', 390);
    expect(screen.getByRole('button', { name: 'Demo details' })).toBeTruthy();
  });

  it('DEMO-BAR-HIDE-1 flag off at 1280 px: the story panel keeps Grandma Jo and Reset', () => {
    show('0', 1280);
    expect(screen.getByRole('button', { name: 'See the photos as Grandma Jo sees them' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset demo' })).toBeTruthy();
    expect(screen.queryByTestId('demo-bar')).toBeNull();
  });
});
