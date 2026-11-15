// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-18 (SPEC-REDESIGN 1c; was OPEN-9/10's All photos wall): Gallery's photo grid. Month headings ("November 2026"),
// then square tiles three to a row with square corners (RD-8). Each tile is a 48 pt+ button that names the sender
// and day and opens that photo full screen. Show older photos is a button, so nothing needs a swipe.
import React from 'react';
import { Pressable, View } from 'react-native';
import type { FeedPost } from '../api/HearthApi';
import { galleryMonths } from '../feed/gallery';
import { useNav } from '../state/nav';
import { Txt } from '../ui/kit';
import { MIN_TARGET, SPACE, useTheme } from '../ui/theme';
import { MediaImage } from './MediaImage';

export function GalleryGrid({ posts }: { posts: FeedPost[] }) {
  const nav = useNav();
  const { c } = useTheme();
  const months = galleryMonths(posts);
  return (
    <View testID="gallery-grid" style={{ gap: SPACE.lg }}>
      {months.map((m) => (
        <View key={m.key} style={{ gap: SPACE.sm }}>
          {/* The month reads out as one heading. */}
          <View accessible accessibilityRole="header" accessibilityLabel={m.title}>
            <Txt variant="title">{m.title}</Txt>
          </View>
          {/* Tight: a 1 pt gap in the screen's own color between tiles. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -1 }}>
            {m.tiles.map((t) => (
              <Pressable
                key={t.mediaId}
                testID={`gallery-tile-${t.mediaId}`}
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
      ))}
    </View>
  );
}
