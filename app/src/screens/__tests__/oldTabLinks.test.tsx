// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// B19 (QA-R1, redesign 1b): /groups, /me and /help were tabs; their links now open the same row under More.
// Role rules hold: a viewer asking for Groups gets the More menu, never a group's name (DEC-49).
// The cold loads on the static host are DEMO-5 in e2e-web/site.spec.js.
import { screen } from '@testing-library/react-native';
import React from 'react';
import { MoreScreen } from '../MoreScreen';
import { renderApp, screenWords } from '../../test/renderApp';

const GROUP_NAMES = /Grandparents –|Dad's side|Mom's side/;

describe('B19 old tab links land under More', () => {
  it('B19 a parent opening /groups gets More → Groups, with Back to More', async () => {
    await renderApp(<MoreScreen initialOpen="groups" />, { user: 'chase' });
    expect(await screen.findByRole('button', { name: 'Back to More' })).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'More' })).toBeNull();
  });

  it('B19 /me opens More → Me for a parent and a viewer', async () => {
    for (const user of ['chase', 'jo'] as const) {
      const r = await renderApp(<MoreScreen initialOpen="me" />, { user });
      expect(await screen.findByRole('button', { name: 'Back to More' })).toBeTruthy();
      r.unmount();
    }
  });

  it('B19 /help opens More → Help for a viewer', async () => {
    await renderApp(<MoreScreen initialOpen="help" />, { user: 'jo' });
    expect(await screen.findByRole('button', { name: 'Back to More' })).toBeTruthy();
  });

  it('B19 DEC-49 a viewer opening /groups gets the More menu, never a group name', async () => {
    await renderApp(<MoreScreen initialOpen="groups" />, { user: 'jo' });
    expect(await screen.findByText('More')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back to More' })).toBeNull();
    expect(screenWords()).not.toMatch(GROUP_NAMES);
  });

  it('B19 an unknown row is just the menu', async () => {
    await renderApp(<MoreScreen initialOpen="photos" />, { user: 'chase' });
    expect(await screen.findByText('More')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back to More' })).toBeNull();
  });
});
