// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// ENG-R3 (Nov 19 tech-debt review): typing in one post's comment box must not redraw every other post. Each card
// listens only to its own comments and draft, not the whole feed.
import { act, waitFor } from '@testing-library/react-native';
import React, { Profiler } from 'react';
import { Text } from 'react-native';
import { FakeBackend } from '../../api/fake/FakeBackend';
import { seedPost } from '../../test/seed';
import { renderApp } from '../../test/renderApp';
import { useApp, useFeed } from '../../state/AppContext';
import type { FeedStore } from '../../feed/store';
import { PostCard } from '../PostCard';

describe('ENG-R3 a post card redraws only for its own post', () => {
  it('ENG-R3 a draft typed under post B leaves post A\'s card alone', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Post A' });
    await seedPost(be, { caption: 'Post B' });
    const renders: Record<string, number> = {};
    let feed: FeedStore | null = null;
    function Cards() {
      const app = useApp();
      feed = app.feed;
      const { posts } = useFeed();
      if (posts.length < 2) return <Text>loading</Text>;
      return (
        <>
          {posts.map((p) => (
            <Profiler key={p.post_id} id={p.caption ?? ''} onRender={(id) => { renders[id] = (renders[id] ?? 0) + 1; }}>
              <PostCard post={p} />
            </Profiler>
          ))}
        </>
      );
    }
    await renderApp(<Cards />, { be, user: 'chase' });
    await waitFor(() => expect(Object.keys(renders).sort()).toEqual(['Post A', 'Post B']));
    const b = feed!.getState().posts.find((p) => p.caption === 'Post B')!;
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const before = renders['Post A']!;
    act(() => { feed!.setDraft(b.post_id, 'H'); });
    act(() => { feed!.setDraft(b.post_id, 'Hi'); });
    expect(renders['Post A']).toBe(before);
    expect(renders['Post B']!).toBeGreaterThan(0);
  });
});
