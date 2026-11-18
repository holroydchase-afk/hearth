// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-44, RD-56 (DEC-65, UX-R13; was RD-18's square grid): Gallery's months, like the newest Apple Photos. The month's
// name (24 pt Semibold, a level-2 heading, RD-66), then one wide 3:2 photo for the month, then each group's date
// ("Oct 17", "Nov 11–15") over its squares, up to three across and never one alone. 16 pt corners, 8 pt gaps, inside
// the screen's 16 pt margins. No sender lines (RD-46). Each tile is a 48 pt+ button whose spoken label names the
// sender and the full date, and opens that photo full screen. RD-61 (R18): while Gallery scrolls, the month's title
// sticks right under the pinned "Search photos" field until the next month pushes it away. RD-83 (Chase on iPhone,
// Nov 17): greeting, search bar and month title are one pinned block. On the web the title is CSS position: sticky
// with top = the search backing's height, so the browser glues it to the bar on its own scroll thread (the old
// per-scroll-event translateY lagged on iPhone Safari and showed a strip of photo); on a phone it is still moved by
// the scroll offset. Its backing spans the full width in the page color, and RD-82's shade sits under it while pinned.
// The layout itself is feed/gallery.ts (pure, unit tested).
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import type { FeedPost } from '../api/HearthApi';
import { galleryMonths, mosaicRows, type GridMonth, type GridTile } from '../feed/gallery';
import { useNav } from '../state/nav';
import { GALLERY_TYPE, MIN_TARGET, RADIUS, SPACE, WEIGHT, photoShadow, useTheme } from '../ui/theme';
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
 *  relayout: changes whenever the scroll's content changes size; onPinned: whether a month title is pinned now (the
 *  bar's own shade hides then, RD-83). */
export function GalleryGrid({ posts, scrollY, pinAt = 0, relayout = 0, onPinned }: {
  posts: FeedPost[]; scrollY?: Animated.Value; pinAt?: number; relayout?: number; onPinned?: (pinned: boolean) => void;
}) {
  const months = galleryMonths(posts);
  const grid = usePlace(relayout);
  const pinned = useRef(new Set<string>());
  const report = useRef(onPinned);
  report.current = onPinned;
  const onPin = useRef((key: string, on: boolean) => {
    const before = pinned.current.size > 0;
    if (on) pinned.current.add(key); else pinned.current.delete(key);
    if (before !== pinned.current.size > 0) report.current?.(!before);
  }).current;
  return (
    <View ref={grid.ref} testID="gallery-grid" style={{ gap: SPACE.xl }} onLayout={grid.onLayout}>
      {months.map((m) => (
        <Month key={m.key} m={m} relayout={relayout} pinAt={pinAt} onPin={onPin} stick={scrollY && grid.place ? { scrollY, gridY: grid.place.y, pinAt } : null} />
      ))}
    </View>
  );
}

const WEB = Platform.OS === 'web';

function Month({ m, stick, relayout, pinAt, onPin }: {
  m: GridMonth; stick: { scrollY: Animated.Value; gridY: number; pinAt: number } | null; relayout: number; pinAt: number;
  onPin: (key: string, on: boolean) => void;
}) {
  const { c, t, dark } = useTheme();
  const nav = useNav();
  const { ref, place: box, onLayout } = usePlace(relayout);
  const [headH, setHeadH] = useState(0);
  const [pinned, setPinned] = useState(false);
  // R18: the title is pinned from when it reaches the pinned field until the month's end.
  const range = stick && box ? { from: stick.gridY + box.y - stick.pinAt, span: Math.max(1, box.h - headH) } : null;
  const from = range?.from ?? null;
  const span = range?.span ?? null;
  const scrollY = stick?.scrollY;
  useEffect(() => {
    if (!scrollY || from === null || span === null) return;
    const id = scrollY.addListener(({ value }) => setPinned(value >= from && value <= from + span));
    return () => scrollY.removeListener(id);
  }, [scrollY, from, span]);
  useEffect(() => { onPin(m.key, pinned); }, [onPin, m.key, pinned]);
  useEffect(() => () => onPin(m.key, false), [onPin, m.key]);
  // On a phone the title moves down with the scroll; on the web the browser's sticky does it (RD-83).
  let shift: Animated.AnimatedInterpolation<number> | 0 = 0;
  if (!WEB && scrollY && from !== null && span !== null) {
    shift = scrollY.interpolate({ inputRange: [from, from + span], outputRange: [0, span], extrapolate: 'clamp' });
  }
  const sticky = WEB ? ({ position: 'sticky', top: pinAt } as unknown as ViewStyle) : null;
  // RD-88: the wrapper takes the tile's place and size (the same sizing as the tile) and carries the light-mode
  // shadow; the tile inside keeps its own corners and clips the photo.
  const tile = (x: GridTile) => (
    <View key={x.mediaId} style={[styles.shadowBox, x.wide ? styles.wide : styles.square, photoShadow(dark)]}>
      <Pressable
        testID={`gallery-tile-${x.mediaId}`}
        accessibilityRole="button"
        accessibilityLabel={x.label}
        onPress={() => nav.openViewer(x.postId, x.index)}
        style={[styles.tile, { backgroundColor: c.photo }, x.wide ? styles.wide : styles.square]}
      >
        <MediaImage postId={x.postId} mediaId={x.mediaId} fit="cover" full={x.wide} compact={!x.wide} style={{ flex: 1 }} />
      </Pressable>
    </View>
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
        style={[styles.head, { backgroundColor: c.bg }, WEB ? sticky : { transform: [{ translateY: shift }] }]}
      >
        <Text style={{ fontSize: GALLERY_TYPE.month, lineHeight: 30, fontWeight: WEIGHT.semibold, color: c.ink }}>{m.title}</Text>
        {/* RD-82 / RD-83: while this title is pinned, the bar's shade sits under it (the bottom of the pinned block). */}
        {pinned ? <View testID="search-bar-shade" pointerEvents="none" accessible={false} style={[shadeLine, { backgroundColor: c.line }]} /> : null}
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
  // RD-83: the title's backing steps out of the scroll's 16 pt padding so it spans the full width; the words keep
  // their 16 pt inside.
  head: { zIndex: 1, paddingBottom: 12, marginHorizontal: -SPACE.lg, paddingHorizontal: SPACE.lg },
  shadowBox: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, borderRadius: RADIUS.photo },
  tile: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, borderRadius: RADIUS.photo, overflow: 'hidden' },
  wide: { width: '100%', aspectRatio: 1.5 },
  square: { flex: 1, aspectRatio: 1 },
  row: { flexDirection: 'row', gap: GAP },
});

/** RD-82: a hairline with a soft shadow under the pinned block (shared with PhotosScreen's search bar). */
export const shadeLine: ViewStyle = {
  position: 'absolute', left: 0, right: 0, bottom: -StyleSheet.hairlineWidth, height: StyleSheet.hairlineWidth,
  shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 2 },
};
