// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// MOMENT-2: a moment's photos as one collage, so the whole upload shows at once (like Facebook or FamilyAlbum).
// RD-54 (C1, DEC-65): a rounded mosaic of at most 4 tiles, like Gallery's months: 1 photo alone in its own shape
// (between 4:5 tall and 3:2 wide, Instagram's range), 2 side by side, 3 = one wide 3:2 and two squares, 4 or more =
// one wide and three squares, the last with a solid "+5" chip (not a dark wash over the photo). 16 pt corners and
// 8 pt gaps. Every photo fills its tile (no grey bars); tapping one opens the full-screen viewer there (DS-4).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FeedPost } from '../api/HearthApi';
import { useNav } from '../state/nav';
import { MIN_TARGET, RADIUS, SPACE, WEIGHT, useTheme } from '../ui/theme';
import { MediaImage } from './MediaImage';
import { VideoPoster } from './VideoPoster';

type Media = FeedPost['media'][number];
/** OPEN-3: a tile may come from another post (the New for you card): its post, its place there and its sender. */
export type CollageMedia = Media & { postId?: string; index?: number; from?: string };

/** How many photos go in the big tile, how many small ones, and how many more hide behind "+N". */
export function collageShape(n: number): { big: number; small: number; more: number } {
  if (n <= 1) return { big: n, small: 0, more: 0 };
  if (n === 2) return { big: 0, small: 2, more: 0 };
  if (n === 3) return { big: 1, small: 2, more: 0 };
  return { big: 1, small: 3, more: n - 4 };
}

/** One photo keeps its shape, clamped like Instagram: never taller than 4:5 or wider than 3:2 (RD-54). */
export const singleAspect = (m: Pick<Media, 'width' | 'height'> | undefined) =>
  m?.width && m?.height ? Math.max(0.8, Math.min(1.5, m.width / m.height)) : 4 / 3;

/** RD-54: each tile's shape, in order: the wide one first (3:2, or the single photo's own shape), then the small
 *  ones in a row (4:5 when there are only two, else squares). Pure, so the mosaic is tested without drawing it. */
export function collageTiles(n: number, single = 4 / 3): { aspect: number; wide: boolean }[] {
  const { big, small } = collageShape(n);
  const out: { aspect: number; wide: boolean }[] = [];
  if (big) out.push({ aspect: n === 1 ? single : 1.5, wide: true });
  for (let k = 0; k < small; k++) out.push({ aspect: n === 2 ? 0.8 : 1, wide: false });
  return out;
}

/** from: who sent it and the day ("Chase, Nov 3"), read out after each photo's place (HIG-9). */
export function PhotoCollage({ postId, media, from }: { postId: string; media: CollageMedia[]; from?: string }) {
  const nav = useNav();
  const { c } = useTheme();
  const n = media.length;
  const { big, small, more } = collageShape(n);

  const tile = (i: number, style: object) => {
    const extra = more && i === big + small - 1 ? more : 0;
    const m = media[i]!;
    const pid = m.postId ?? postId;
    const at = m.index ?? i;
    const by = m.from ?? from;
    if (m.kind === 'video' && !extra) {
      // VID-18: the poster with its own Play button; the rest of the tile still opens the post screen.
      return (
        <VideoPoster
          key={m.media_id}
          postId={pid}
          mediaId={m.media_id}
          onOpen={() => nav.openViewer(pid, at)}
          openLabel={`Open video ${i + 1} of ${n} full screen`}
          style={[styles.tile, { backgroundColor: c.photo }, style]}
        />
      );
    }
    return (
      <Pressable
        key={media[i]!.media_id}
        accessibilityRole="button"
        accessibilityLabel={`Open photo ${i + 1} of ${n} full screen${extra ? `, and ${extra} more` : ''}${by ? `, from ${by}` : ''}`}
        onPress={() => nav.openViewer(pid, at)}
        style={[styles.tile, { backgroundColor: c.photo }, style]}
      >
        <MediaImage postId={pid} mediaId={m.media_id} fit="cover" full={m.kind !== 'video'} compact={i >= big} style={{ flex: 1 }} />
        {extra ? (
          <View style={styles.more} pointerEvents="none">
            <Text style={styles.moreText}>{`+${extra}`}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  if (!n) return null;
  const shapes = collageTiles(n, singleAspect(media[0]));
  return (
    <View testID={`collage-${postId}`} style={styles.gap}>
      {big ? tile(0, { width: '100%', aspectRatio: shapes[0]!.aspect }) : null}
      {small ? (
        <View style={[styles.row, styles.gap]}>
          {Array.from({ length: small }, (_, k) => tile(big + k, { flex: 1, aspectRatio: shapes[big + k]!.aspect }))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: SPACE.sm },
  row: { flexDirection: 'row' },
  tile: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, overflow: 'hidden', borderRadius: RADIUS.photo },
  // RD-54: a solid dark chip in the corner, the same in light and dark (the photo stays clear around it).
  more: { position: 'absolute', right: SPACE.sm, bottom: SPACE.sm, backgroundColor: '#1C1C1E', borderRadius: RADIUS.medium, paddingHorizontal: 10, paddingVertical: 6 },
  moreText: { color: '#FFFFFF', fontSize: 17, lineHeight: 20, fontWeight: WEIGHT.medium },
});
