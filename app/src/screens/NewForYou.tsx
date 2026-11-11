// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// OPEN-1..8 (docs/product/SPEC-OPENING.md, DEC-58): the New for you card at the top of Photos, and the new posts
// one at a time (oldest first) with Back, Next and "Back to Photos" (DS-4, no swipe needed). No counts or badges (A1, A2).
import React, { useEffect, useState } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { FeedPost } from '../api/HearthApi';
import { newSinceDay } from '../feed/newForYou';
import { useFeed } from '../state/AppContext';
import { Button, Card, Txt } from '../ui/kit';
import { andList, shortDate } from '../ui/format';
import { SPACE, useTheme } from '../ui/theme';
import { PhotoCollage, type CollageMedia } from './PhotoCollage';
import { PostCard } from './PostCard';

/** OPEN-1..4: "New since Today, from Chase and Alex", a collage of the new photos and one filled button. */
export function NewForYouCard({ posts, since, onSee }: { posts: FeedPost[]; since: string; onSee: () => void }) {
  const tiles: CollageMedia[] = posts.flatMap((p) =>
    p.media.filter((m) => m.status === 'ready').map((m, index) => ({ ...m, postId: p.post_id, index, from: `${p.author_name}, ${shortDate(p.published_at)}` })),
  );
  return (
    <Card testID="new-for-you">
      <Txt variant="title" role="header">New for you</Txt>
      <PhotoCollage postId="new-for-you" media={tiles} />
      <Txt>{`New since ${newSinceDay(since)}, from ${andList(posts.map((p) => p.author_name))}`}</Txt>
      <Button label="See the new photos" onPress={onSee} />
    </Card>
  );
}

/** OPEN-7/8: one new post at a time, in place of Photos. Next reads Done on the last and returns to Photos. */
export function OneAtATime({ postIds, onClose }: { postIds: string[]; onClose: () => void }) {
  const state = useFeed();
  const { c } = useTheme();
  const [at, setAt] = useState(0);
  const posts = postIds.map((id) => state.posts.find((p) => p.post_id === id)).filter((p): p is FeedPost => !!p);
  const step = Math.min(at, posts.length - 1);
  const post = posts[step];
  const last = step >= posts.length - 1;

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [onClose]);
  useEffect(() => { if (!post) onClose(); }, [post, onClose]);
  if (!post) return null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView testID="new-one-at-a-time" contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.lg, paddingBottom: SPACE.xxl }} keyboardShouldPersistTaps="handled">
        <Button label="Back to Photos" icon={{ sf: 'chevron.backward', md: 'arrow_back' }} variant="secondary" onPress={onClose} />
        <Txt variant="title" role="header">{`${step + 1} of ${posts.length}`}</Txt>
        <PostCard key={post.post_id} post={post} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.md }}>
          {step > 0 ? <Button label="Back" variant="secondary" style={{ flexGrow: 1 }} onPress={() => setAt(step - 1)} /> : null}
          <Button label={last ? 'Done' : 'Next'} style={{ flexGrow: 1 }} onPress={() => (last ? onClose() : setAt(step + 1))} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
