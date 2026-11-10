// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// VID-18 (SPEC-MEDIA 4.1): a video shows as its poster (the thumb, a still JPEG) with a visible "Play" word.
// GUX-R1: where the poster has nothing else to open (the post screen, By date), the whole poster is one
// "Play video" button with the word "Play" on it. On Photos (`onOpen`), the tile opens the post screen like a
// photo's does, and a separate "Play" button sits at its bottom left; the two are siblings, never one inside the
// other, so a screen reader reaches both. Play opens the full-screen VideoPlayer in place; Close comes back here.
// Only the thumb is fetched here: the video itself loads when Play is tapped, and nothing plays before that.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button, SystemIcon } from '../ui/kit';
import { FONT, MIN_TARGET, RADIUS, useTheme } from '../ui/theme';
import { MediaImage } from './MediaImage';
import { VideoPlayer } from './VideoPlayer';

const PLAY_ICON = { sf: 'play.fill', md: 'play_arrow' };

export function VideoPoster({ postId, mediaId, fit = 'cover', style, onOpen, openLabel }: {
  postId: string; mediaId: string; fit?: 'cover' | 'contain'; style?: StyleProp<ViewStyle>;
  /** Tapping the poster away from Play (Photos: open the post screen). */
  onOpen?: () => void;
  openLabel?: string;
}) {
  const { c, t, os } = useTheme();
  const [playing, setPlaying] = useState(false);
  const player = playing ? <VideoPlayer postId={postId} mediaId={mediaId} onClose={() => setPlaying(false)} /> : null;

  if (!onOpen) {
    return (
      <>
        <Pressable accessibilityRole="button" accessibilityLabel="Play video" onPress={() => setPlaying(true)} style={[styles.box, style]}>
          <MediaImage postId={postId} mediaId={mediaId} fit={fit} full={false} style={StyleSheet.absoluteFill} />
          <View style={styles.middle} pointerEvents="none">
            <View style={[styles.pill, { backgroundColor: c.accent }]}>
              <SystemIcon icon={PLAY_ICON} color={c.accentInk} />
              <Text style={{ color: c.accentInk, fontFamily: os === 'android' ? FONT.medium : FONT.semibold, fontSize: t.base }}>Play</Text>
            </View>
          </View>
        </Pressable>
        {player}
      </>
    );
  }

  return (
    <View style={[styles.box, style]}>
      <MediaImage postId={postId} mediaId={mediaId} fit={fit} full={false} style={StyleSheet.absoluteFill} />
      <Pressable accessibilityRole="button" accessibilityLabel={openLabel ?? 'Open the video full screen'} onPress={onOpen} style={[StyleSheet.absoluteFill, styles.target]} />
      <View style={styles.corner}>
        <Button label="Play video" text="Play" icon={PLAY_ICON} onPress={() => setPlaying(true)} />
      </View>
      {player}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, overflow: 'hidden' },
  target: { minHeight: MIN_TARGET, minWidth: MIN_TARGET },
  middle: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  pill: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, borderRadius: RADIUS.pill, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Bottom left, not the middle: the middle of a Photos tile stays free for opening the post screen.
  corner: { position: 'absolute', left: 12, bottom: 12 },
});
