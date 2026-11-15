// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// OPEN-1..8 (docs/product/SPEC-OPENING.md, DEC-58) and RD-19..RD-21 (SPEC-REDESIGN 1c): New for you at the top of
// Gallery, and the new posts one at a time (oldest first) with Next, Previous and "Back to Gallery" (DS-4, no swipe
// needed). The only number is the "N new" chip (RD-19, Chase Nov 15); no "unread" (A1, A2).
// GUX-R1/R2/R7/R8 (OPEN-12): Next never moves, Previous sits under it; no tiles without a ready photo.
import React, { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { FeedPost } from '../api/HearthApi';
import { newSinceDay } from '../feed/newForYou';
import { useFeed } from '../state/AppContext';
import { Button, Txt } from '../ui/kit';
import { andList, shortDate } from '../ui/format';
import { SPACE, useTheme } from '../ui/theme';
import { MediaImage } from './MediaImage';
import { PostCard } from './PostCard';

/** Tile size for the sideways row: large (about 60% of the screen), never under 140 or over 260. */
const tileSide = (screenWidth: number) => Math.max(140, Math.min(260, Math.round(screenWidth * 0.6)));

/** RD-19..RD-21 (1c): "New for you" with See all, a sideways row of large photo tiles (12 pt corners, RD-8; the
 *  first carries a solid accent "N new" chip, N = photos), then "Tap a photo to start" and "From Alex since
 *  Wednesday" (OPEN-2's day rules). Any tile or See all opens the walk at the oldest new post. No group names. */
export function NewForYouRow({ posts, since, onSee }: { posts: FeedPost[]; since: string; onSee: () => void }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const side = tileSide(width);
  // GUX-R6 / OPEN-12: only photos that are ready make tiles; the words and See all stay either way.
  const tiles = posts.flatMap((p) => p.media.filter((m) => m.status === 'ready').map((m) => ({ postId: p.post_id, mediaId: m.media_id, from: `${p.author_name}, ${shortDate(p.published_at)}` })));
  const count = `${tiles.length} new`;
  return (
    <View testID="new-for-you" style={{ gap: SPACE.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm }}>
        <Txt variant="title" role="header">New for you</Txt>
        <Button variant="quiet" label="See all the new photos, one at a time" text="See all" onPress={onSee} />
      </View>
      {tiles.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACE.md }} style={{ marginHorizontal: -SPACE.lg }}>
          <View style={{ width: SPACE.lg - SPACE.md }} />
          {tiles.map((t, i) => (
            <Pressable
              key={t.mediaId}
              testID={`new-tile-${t.mediaId}`}
              accessibilityRole="button"
              accessibilityLabel={`${i === 0 ? `${count}. ` : ''}New photo from ${t.from}. Start the new photos`}
              onPress={onSee}
              style={{ width: side, height: side, borderRadius: 12, overflow: 'hidden', backgroundColor: c.photo }}
            >
              <MediaImage postId={t.postId} mediaId={t.mediaId} fit="cover" full={false} style={{ flex: 1 }} />
              {i === 0 ? (
                <View style={{ position: 'absolute', top: SPACE.sm, left: SPACE.sm, backgroundColor: c.accent, borderRadius: 12, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs }}>
                  <Txt variant="strong" style={{ color: c.accentInk }}>{count}</Txt>
                </View>
              ) : null}
            </Pressable>
          ))}
          <View style={{ width: SPACE.lg - SPACE.md }} />
        </ScrollView>
      ) : null}
      <View>
        <Txt>Tap a photo to start</Txt>
        <Txt variant="muted">{fromLine(since, posts.map((p) => p.author_name))}</Txt>
      </View>
    </View>
  );
}

/** RD-20 (QA-R3): "From Chase and Alex today"; earlier days "From Alex since yesterday|Wednesday|Nov 3" (OPEN-2). */
export function fromLine(since: string, names: string[]): string {
  const day = newSinceDay(since);
  const who = andList(names);
  return day === 'today' ? `From ${who} today` : `From ${who} since ${day}`;
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
        <Button label="Back to Gallery" icon={{ sf: 'chevron.backward', md: 'arrow_back' }} variant="secondary" onPress={onClose} />
        <Txt variant="title" role="header" label={heading}>{heading}</Txt>
        <PostCard key={post.post_id} post={post} />
        {/* GUX-R1/R2/R8: Next (Done on the last) is always first in its own row, so it never moves; RD-7 makes it a capsule. */}
        <View style={{ gap: SPACE.md }}>
          <Button variant="tinted" label={last ? 'Done, back to Gallery' : 'Next'} text={last ? 'Done' : 'Next'} onPress={() => (last ? onClose() : setAt(step + 1))} />
          {step > 0 ? <Button label="Previous new photo" text="Previous" variant="secondary" onPress={() => setAt(step - 1)} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
