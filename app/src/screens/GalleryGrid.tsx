// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-44, RD-56 (DEC-65, UX-R13; was RD-18's square grid): Gallery's months, like the newest Apple Photos. The month's
// name (24 pt Semibold, a level-2 heading, RD-66), then one wide 3:2 photo for the month, then each group's date
// ("Oct 17", "Nov 11–15") over its squares, up to three across and never one alone. 16 pt corners, 8 pt gaps, inside
// the screen's 16 pt margins. No sender lines (RD-46). Each tile is a 48 pt+ button whose spoken label names the
// sender and the full date, and opens that photo full screen. RD-61 (R18): while Gallery scrolls, the month's title
// sticks right under the pinned "Search photos" field until the next month pushes it away.
// The layout itself is feed/gallery.ts (pure, unit tested).
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import type { FeedPost } from '../api/HearthApi';
import { galleryMonths, mosaicRows, type GridMonth, type GridTile } from '../feed/gallery';
import { useNav } from '../state/nav';
import { GALLERY_TYPE, MIN_TARGET, RADIUS, SPACE, WEIGHT, useTheme } from '../ui/theme';
import { MediaImage } from './MediaImage';

const GAP = SPACE.sm;
const ACROSS = 3;

/** Where a view sits in its parent. onLayout says so on a phone; on the web it only fires when the size changes, so
 *  the place is read again (offsetTop) whenever the scroll's content changes size (`relayout`). */
function usePlace(relayout: number) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const [place, setPlace] = useState<{ y: number; h: number } | null>(null);
  const read = () => {
    const el = ref.current as unknown as { offsetTop?: number; offsetHeight?: number } | null;
    if (Platform.OS === 'web' && el && typeof el.offsetTop === 'number') setPlace({ y: el.offsetTop, h: el.offsetHeight ?? 0 });
  };
  useEffect(read, [relayout]);
  const onLayout = (e: LayoutChangeEvent) => {
    setPlace({ y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height });
    read();
  };
  return { ref, place, onLayout };
}

/** scrollY: the Gallery scroll's offset; pinAt: how far down the pinned search field ends (the month sticks there);
 *  relayout: changes whenever the scroll's content changes size. */
export function GalleryGrid({ posts, scrollY, pinAt = 0, relayout = 0 }: { posts: FeedPost[]; scrollY?: Animated.Value; pinAt?: number; relayout?: number }) {
  const months = galleryMonths(posts);
  const grid = usePlace(relayout);
  return (
    <View ref={grid.ref} testID="gallery-grid" style={{ gap: SPACE.xl }} onLayout={grid.onLayout}>
      {months.map((m) => (
        <Month key={m.key} m={m} relayout={relayout} stick={scrollY && grid.place ? { scrollY, gridY: grid.place.y, pinAt } : null} />
      ))}
    </View>
  );
}

function Month({ m, stick, relayout }: { m: GridMonth; stick: { scrollY: Animated.Value; gridY: number; pinAt: number } | null; relayout: number }) {
  const { c, t } = useTheme();
  const nav = useNav();
  const { ref, place: box, onLayout } = usePlace(relayout);
  const [headH, setHeadH] = useState(0);
  // R18: the title moves down with the scroll from when it reaches the pinned field until the month's end.
  let shift: Animated.AnimatedInterpolation<number> | 0 = 0;
  if (stick && box) {
    const from = stick.gridY + box.y - stick.pinAt;
    const span = Math.max(1, box.h - headH);
    shift = stick.scrollY.interpolate({ inputRange: [from, from + span], outputRange: [0, span], extrapolate: 'clamp' });
  }
  const tile = (x: GridTile) => (
    <Pressable
      key={x.mediaId}
      testID={`gallery-tile-${x.mediaId}`}
      accessibilityRole="button"
      accessibilityLabel={x.label}
      onPress={() => nav.openViewer(x.postId, x.index)}
      style={[styles.tile, { backgroundColor: c.photo }, x.wide ? styles.wide : styles.square]}
    >
      <MediaImage postId={x.postId} mediaId={x.mediaId} fit="cover" full={x.wide} compact={!x.wide} style={{ flex: 1 }} />
    </Pressable>
  );
  return (
    <View ref={ref} style={{ gap: SPACE.sm }} onLayout={onLayout}>
      {/* The month reads out as one heading, level 2 under the greeting (RD-66). */}
      <Animated.View
        accessible
        accessibilityRole="header"
        accessibilityLabel={m.title}
        {...{ 'aria-level': 2 }}
        onLayout={(e) => setHeadH(e.nativeEvent.layout.height)}
        style={[styles.head, { backgroundColor: c.bg, transform: [{ translateY: shift }] }]}
      >
        <Text style={{ fontSize: GALLERY_TYPE.month, lineHeight: 30, fontWeight: WEIGHT.semibold, color: c.ink }}>{m.title}</Text>
      </Animated.View>
      {m.groups.map((g) => (
        <View key={g.key} style={{ gap: GAP }}>
          {/* RD-56: the group's date, once ("Oct 17", "Nov 11–15"); each tile's spoken label has the full date. */}
          <Text style={{ fontSize: t.base, lineHeight: t.line, fontWeight: WEIGHT.medium, color: c.ink }}>{g.label}</Text>
          {mosaicRows(g.tiles, ACROSS).map((row) => (
            row[0]!.wide ? tile(row[0]!) : (
              <View key={row[0]!.mediaId} testID="gallery-grid-row" style={styles.row}>
                {row.map(tile)}
              </View>
            )
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Above the photos it slides over, on the screen's own color (DS-6); RD-68 (UX-R25): 12 pt under the words so
  // photos sliding under it never touch them.
  head: { zIndex: 1, paddingBottom: 12 },
  tile: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, borderRadius: RADIUS.photo, overflow: 'hidden' },
  wide: { width: '100%', aspectRatio: 1.5 },
  square: { flex: 1, aspectRatio: 1 },
  row: { flexDirection: 'row', gap: GAP },
});
