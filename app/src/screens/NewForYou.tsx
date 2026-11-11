// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// OPEN-1..8 (docs/product/SPEC-OPENING.md, DEC-58): the New for you card at the top of Photos, and the new posts
// one at a time (oldest first) with Next, Previous and "Back to Photos" (DS-4, no swipe needed). No counts or badges (A1, A2).
// GUX-R1/R2/R5..R8 (OPEN-12): Next never moves, Previous sits under it, "Sent today by …", no collage without a ready photo.
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

/** OPEN-1..4: "Sent today by Chase and Alex", a collage (only when a photo is ready, GUX-R6) of the new photos and one filled button. */
export function NewForYouCard({ posts, since, onSee }: { posts: FeedPost[]; since: string; onSee: () => void }) {
  const tiles: CollageMedia[] = posts.flatMap((p) =>
    p.media.filter((m) => m.status === 'ready').map((m, index) => ({ ...m, postId: p.post_id, index, from: `${p.author_name}, ${shortDate(p.published_at)}` })),
  );
  return (
    <Card testID="new-for-you">
      <Txt variant="title" role="header">New for you</Txt>
      {tiles.length ? <PhotoCollage postId="new-for-you" media={tiles} /> : null}
      <Txt>{sentLine(since, posts.map((p) => p.author_name))}</Txt>
      <Button label="See the new photos" onPress={onSee} />
    </Card>
  );
}

/** GUX-R5: "Sent today by Chase and Alex"; earlier days read "Sent since yesterday|Tuesday|Nov 3 by …". */
function sentLine(since: string, names: string[]): string {
  const day = newSinceDay(since);
  const who = andList(names);
  return day === 'today' ? `Sent today by ${who}` : `Sent since ${day} by ${who}`;
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
  // GUX-R7: the count always says what it counts.
  const heading = `New photos: ${step + 1} of ${posts.length}`;

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
        <Txt variant="title" role="header" label={heading}>{heading}</Txt>
        <PostCard key={post.post_id} post={post} />
        {/* GUX-R1/R2/R8: the filled Next (Done on the last) is always first and full width, so it never moves. */}
        <View style={{ gap: SPACE.md }}>
          <Button label={last ? 'Done, back to Photos' : 'Next'} text={last ? 'Done' : 'Next'} onPress={() => (last ? onClose() : setAt(step + 1))} />
          {step > 0 ? <Button label="Previous new photo" text="Previous" variant="secondary" onPress={() => setAt(step - 1)} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
