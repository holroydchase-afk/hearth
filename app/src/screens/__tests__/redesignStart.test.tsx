// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-10 (SPEC-REDESIGN 1b): the app opens on Gallery. expo-router's Redirect is replaced by a stand-in that shows
// where it would go. The demo e2e (demo.spec.js RD-10) checks the picked tab on the real web build.
import { screen } from '@testing-library/react-native';
import React from 'react';
import Index from '../../app/index';
import { renderApp } from '../../test/renderApp';
import { tabsFor } from '../TabBar';

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Redirect: ({ href }: { href: string }) => <Text testID="redirect" style={{ fontSize: 17 }}>{href}</Text> };
});

describe('RD-10 Gallery first', () => {
  it.each(['chase', 'jo'] as const)('RD-10 a signed-in %s lands on Gallery', async (user) => {
    await renderApp(<Index />, { user });
    expect((await screen.findByTestId('redirect')).props.children).toBe('/gallery');
  });

  it('RD-10 Gallery is the first tab for everyone', () => {
    for (const role of ['owner', 'adult', 'viewer'] as const) expect(tabsFor(role)[0]!.label).toBe('Gallery');
  });
});
