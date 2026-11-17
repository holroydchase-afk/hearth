// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-44..RD-46 (DEC-65; was RD-18's square grid): Gallery's months, like the newest Apple Photos. The month's name
// (24 pt Semibold), then each day's photos: one wide 3:2 photo with the day number on it, then squares three
// across. 16 pt corners, 8 pt gaps, inside the screen's 16 pt margins. No sender lines (RD-46). Each tile is a
// 48 pt+ button whose spoken label names the sender and the full date, and opens that photo full screen.
// The layout itself is feed/gallery.ts (pure, unit tested).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FeedPost } from '../api/HearthApi';
import { galleryMonths, mosaicRows, type GridTile } from '../feed/gallery';
import { useNav } from '../state/nav';
import { GALLERY_TYPE, MIN_TARGET, RADIUS, SPACE, WEIGHT, useTheme } from '../ui/theme';
import { MediaImage } from './MediaImage';

const GAP = SPACE.sm;
const ACROSS = 3;

export function GalleryGrid({ posts }: { posts: FeedPost[] }) {
  const { c } = useTheme();
  const nav = useNav();
  const months = galleryMonths(posts);
  const tile = (x: GridTile) => (
    <Pressable
      key={x.mediaId}
      testID={`gallery-tile-${x.mediaId}`}
      accessibilityRole="button"
      accessibilityLabel={x.label}
      onPress={() => nav.openViewer(x.postId, x.index)}
      style={[styles.tile, { backgroundColor: c.photo }, x.wide ? styles.wide : styles.square]}
    >
      <MediaImage postId={x.postId} mediaId={x.mediaId} fit="cover" full={x.wide} style={{ flex: 1 }} />
      {x.day ? <DayNumber day={x.day} /> : null}
    </Pressable>
  );
  return (
    <View testID="gallery-grid" style={{ gap: SPACE.xl }}>
      {months.map((m) => (
        <View key={m.key} style={{ gap: SPACE.md }}>
          {/* The month reads out as one heading. */}
          <View accessible accessibilityRole="header" accessibilityLabel={m.title}>
            <Text style={{ fontSize: GALLERY_TYPE.month, lineHeight: 30, fontWeight: WEIGHT.semibold, color: c.ink }}>{m.title}</Text>
          </View>
          <View style={{ gap: GAP }}>
            {m.groups.map((g) => mosaicRows(g.tiles, ACROSS).map((row) => (
              row[0]!.wide ? tile(row[0]!) : (
                <View key={row[0]!.mediaId} testID="gallery-grid-row" style={styles.row}>
                  {row.map(tile)}
                  {/* A short last row keeps its squares the same size. */}
                  {Array.from({ length: ACROSS - row.length }, (_, i) => <View key={`pad-${i}`} style={styles.pad} />)}
                </View>
              )
            )))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** RD-45: the day number at the top left of a group's wide photo, white over a soft dark fade (DS-6's one
 *  exception: decoration). Hidden from screen readers: the tile's label already says the full date. */
function DayNumber({ day }: { day: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.fade} />
      <Text style={styles.day}>{day}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, borderRadius: RADIUS.photo, overflow: 'hidden' },
  wide: { width: '100%', aspectRatio: 1.5 },
  square: { flex: 1, aspectRatio: 1 },
  row: { flexDirection: 'row', gap: GAP },
  pad: { flex: 1 },
  // A radial fade from the top-left corner (RN 0.88's backgroundImage; CSS on the web), as in Apple Photos.
  fade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundImage: 'radial-gradient(120% 90% at 0% 0%, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0) 45%)' },
  day: {
    position: 'absolute', top: SPACE.sm, left: SPACE.md, color: '#FFFFFF', fontSize: 20, lineHeight: 24, fontWeight: WEIGHT.semibold,
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
});
