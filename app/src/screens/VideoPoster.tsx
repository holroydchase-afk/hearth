// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// VID-18 (SPEC-MEDIA 4.1): a video shows as its poster (the thumb, a still JPEG) with a visible "Play" word
// button at its bottom left (accessible name "Play video", 48 pt, 17 pt words). Play opens the full-screen
// VideoPlayer in place; Close comes back here. With `onOpen` (Photos), the rest of the poster is a separate
// button that opens the post screen, like a photo's tile; the two are siblings, never one inside the other, so
// a screen reader reaches both. Only the thumb is fetched here: the video itself loads when Play is tapped.
import React, { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button } from '../ui/kit';
import { MIN_TARGET } from '../ui/theme';
import { MediaImage } from './MediaImage';
import { VideoPlayer } from './VideoPlayer';

export function VideoPoster({ postId, mediaId, fit = 'cover', style, onOpen, openLabel }: {
  postId: string; mediaId: string; fit?: 'cover' | 'contain'; style?: StyleProp<ViewStyle>;
  /** Tapping the poster away from Play (Photos: open the post screen). */
  onOpen?: () => void;
  openLabel?: string;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <View style={[styles.box, style]}>
      <MediaImage postId={postId} mediaId={mediaId} fit={fit} full={false} style={StyleSheet.absoluteFill} />
      {onOpen ? (
        <Pressable accessibilityRole="button" accessibilityLabel={openLabel ?? 'Open the video full screen'} onPress={onOpen} style={[StyleSheet.absoluteFill, styles.target]} />
      ) : null}
      <View style={styles.play}>
        <Button label="Play video" text="Play" icon={{ sf: 'play.fill', md: 'play_arrow' }} onPress={() => setPlaying(true)} />
      </View>
      {playing ? <VideoPlayer postId={postId} mediaId={mediaId} onClose={() => setPlaying(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, overflow: 'hidden' },
  target: { minHeight: MIN_TARGET, minWidth: MIN_TARGET },
  // Bottom left, not the middle: the middle of the poster stays free for opening the post screen.
  play: { position: 'absolute', left: 12, bottom: 12 },
});
