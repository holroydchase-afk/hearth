// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// OPEN-9/10 (docs/product/SPEC-OPENING.md, DEC-58): every photo as a wall, three to a row under month headers,
// newest first. Each tile opens the photo full screen and names its sender and day; "Show older photos" and
// "Back to Photos" are buttons, so nothing needs a swipe.
import React, { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { FeedPost } from '../api/HearthApi';
import { useApp, useFeed } from '../state/AppContext';
import { useNav } from '../state/nav';
import { Button, Txt } from '../ui/kit';
import { shortDate } from '../ui/format';
import { MIN_TARGET, SPACE, useTheme } from '../ui/theme';
import { MediaImage } from './MediaImage';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
interface Tile { postId: string; mediaId: string; index: number; label: string }
interface Month { key: string; title: string; tiles: Tile[] }

/** The feed (newest first) as month blocks of photo tiles; a post's photos keep their order. */
export function wallMonths(posts: FeedPost[]): Month[] {
  const out: Month[] = [];
  for (const p of posts) {
    const d = new Date(p.published_at);
    const title = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    let m = out[out.length - 1];
    if (!m || m.title !== title) out.push((m = { key: title, title, tiles: [] }));
    const label = `Open photo from ${p.author_name}, ${shortDate(p.published_at)}, full screen`;
    p.media.filter((x) => x.status === 'ready').forEach((x, index) => m!.tiles.push({ postId: p.post_id, mediaId: x.media_id, index, label }));
  }
  return out.filter((m) => m.tiles.length);
}

export function PhotoWall({ onClose }: { onClose: () => void }) {
  const { feed } = useApp();
  const state = useFeed();
  const nav = useNav();
  const { c } = useTheme();

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [onClose]);

  // OPEN-9: the month header reads out as one heading ("November 2026").
  const month = (item: Month) => (
    <View key={item.key} style={{ gap: SPACE.sm }}>
      <View accessible accessibilityRole="header" accessibilityLabel={item.title}>
        <Txt variant="title">{item.title}</Txt>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {item.tiles.map((t) => (
          <Pressable
            key={t.mediaId}
            testID={`wall-tile-${t.mediaId}`}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            onPress={() => nav.openViewer(t.postId, t.index)}
            style={{ width: '33.333%', aspectRatio: 1, minHeight: MIN_TARGET, minWidth: MIN_TARGET, borderWidth: 1, borderColor: c.bg, backgroundColor: c.photo, overflow: 'hidden' }}
          >
            <MediaImage postId={t.postId} mediaId={t.mediaId} fit="cover" full={false} style={{ flex: 1 }} />
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      {/* A ScrollView, not a FlatList: a page is 20 posts of thumbnails, and every month block shows at once. */}
      <ScrollView testID="photo-wall" contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.lg, paddingBottom: SPACE.xxl }}>
        <Button label="Back to Photos" icon={{ sf: 'chevron.backward', md: 'arrow_back' }} variant="secondary" onPress={onClose} />
        <Txt variant="display" role="header">All photos</Txt>
        {wallMonths(state.posts).map(month)}
        {state.hasMore ? (
          <Button label="Show older photos" variant="secondary" busy={state.status === 'loadingMore'} onPress={() => void feed?.loadMore()} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
