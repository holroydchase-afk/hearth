// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Intake #162 (eval findings, Nov 24): failing tests written before any fix.
// EF-HE-9 / B18 (QA-R2 from OPEN-1/7/8): New for you must count every post since the last visit, not only the
// first page of 20 that Gallery has loaded.
// EF-HE-1 (guard, green at ff4543e): the Messages "Open" buttons each speak a distinct name holding the chat's title.
import { fireEvent, screen, within } from '@testing-library/react-native';
import React from 'react';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { renderApp } from '../../test/renderApp';
import { GalleryScreen, MoreScreen } from '../../test/redesignScreens';

const { dadSide } = FIXTURE.circles;
const { jo } = FIXTURE.users;
const KEY = (u: string) => `hearth.lastSeen.v1.${u}`;
const SEE_ALL = { name: /^See all(?! the photos)/ };

describe('EF-HE-9 B18 New for you past the first page', () => {
  it('EF-HE-9 B18 25 new posts since the last visit: the walk counts all 25 and starts at the oldest', async () => {
    const be = FakeBackend.withFixture();
    const lastSeen = Date.now() - 3600e3; // an hour ago
    const N = 25; // more than one page (20)
    for (let i = 0; i < N; i++) {
      const { id } = await seedPost(be, { caption: `New ${i}`, circles: [dadSide.id] });
      // oldest is "New 0", spread evenly between the last visit and now
      const at = new Date(lastSeen + ((i + 1) * 3600e3) / (N + 2)).toISOString();
      be.state.posts[id]!.published_at = at;
      be.state.posts[id]!.created_at = at;
    }
    const kv = memoryKV({ [KEY(jo.id)]: new Date(lastSeen).toISOString() });
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    fireEvent.press(await screen.findByRole('button', SEE_ALL));
    await screen.findByTestId('new-one-at-a-time');
    const walk = screen.getByTestId('new-one-at-a-time');
    const heading = screen.getAllByRole('header').map((h) => String(h.props.accessibilityLabel ?? '')).find((n) => n.startsWith('New photos:'));
    expect(heading).toBe(`New photos: 1 of ${N}`);
    expect(within(walk).queryByText('New 0')).toBeTruthy(); // the oldest new post first
  });
});

describe('EF-HE-1 Messages Open buttons', () => {
  it.each(['chase', 'jo'] as const)('EF-HE-1 %s: every "Open" chat button speaks a distinct name that includes its chat title', async (user) => {
    await renderApp(<MoreScreen />, { user, fixture: { joIsMember: true } });
    fireEvent.press(await screen.findByRole('button', { name: 'Messages' }));
    const btns = await screen.findAllByRole('button', { name: /^Open the chat/ });
    expect(btns.length).toBeGreaterThan(1);
    const names = btns.map((b) => String(b.props.accessibilityLabel));
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(screen.getByText(n.replace(/^Open the chat (with )?/, ''))).toBeTruthy();
  });
});
