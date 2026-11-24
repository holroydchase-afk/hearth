// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// VID-18 (SPEC-MEDIA 4.1): a video shows as its poster (the thumb, a still JPEG) with a visible "Play" word.
// GUX-R1: where the poster has nothing else to open (the post screen, By date), the whole poster is one
// "Play video" button with the word "Play" on it. On Photos (`onOpen`), the tile opens the post screen like a
// photo's does, and a separate "Play" button sits at its bottom left; the two are siblings, never one inside the
// other, so a screen reader reaches both. Play opens the full-screen VideoPlayer in place; Close comes back here.
// Only the thumb is fetched here: the video itself loads when Play is tapped, and nothing plays before that.
// DEC-87 (SPEC-MEDIA 5, 5.1): the exception is a Feed card the list picked for autoplay (AutoplayContext): it fetches
// the video and plays it in the card, muted and looping, while the list is still. Its word button reads "Play with
// sound"; that button, or tapping the playing video, opens the full-screen player with sound. When it stops being
// the picked one, it pauses, any unfinished download is stopped and the decrypted file is let go.
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { AutoplayContext } from '../feed/autoplay';
import { useApp } from '../state/AppContext';
import { Button, SystemIcon } from '../ui/kit';
import { MIN_TARGET, RADIUS, useTheme } from '../ui/theme';
import { MediaImage } from './MediaImage';
import { VideoPlayer } from './VideoPlayer';

const PLAY_ICON = { sf: 'play', md: 'play_arrow' };
const SOUND_ICON = { sf: 'speaker.wave.2', md: 'volume_up' };

export function VideoPoster({ postId, mediaId, fit = 'cover', style, onOpen, openLabel }: {
  postId: string; mediaId: string; fit?: 'cover' | 'contain'; style?: StyleProp<ViewStyle>;
  /** Tapping the poster away from Play (Photos: open the post screen). */
  onOpen?: () => void;
  openLabel?: string;
}) {
  const { type } = useTheme();
  const auto = useContext(AutoplayContext);
  const [playing, setPlaying] = useState(false);
  // The full player was opened from the quiet one: the card keeps its file (and stays mounted, paused) till it closes.
  const [fromQuiet, setFromQuiet] = useState(false);
  const picked = !!onOpen && auto.mediaId === mediaId;
  const quiet = picked || (playing && fromQuiet);
  const openFull = (fromQ: boolean) => { setFromQuiet(fromQ); setPlaying(true); };
  const player = playing
    ? <VideoPlayer postId={postId} mediaId={mediaId} keepFile={fromQuiet} onClose={() => { setPlaying(false); setFromQuiet(false); }} />
    : null;

  if (!onOpen) {
    return (
      <>
        <Pressable accessibilityRole="button" accessibilityLabel="Play video" onPress={() => setPlaying(true)} style={[styles.box, style]}>
          <MediaImage postId={postId} mediaId={mediaId} fit={fit} full={false} style={StyleSheet.absoluteFill} />
          <View style={styles.middle} pointerEvents="none">
            <View style={[styles.pill, { backgroundColor: 'rgba(0,0,0,0.72)' }]}>
              <SystemIcon icon={PLAY_ICON} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', ...type.headline }}>Play</Text>
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
      {quiet ? <QuietVideo postId={postId} mediaId={mediaId} play={auto.still && picked && !playing} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={openLabel ?? 'Open the video full screen'} onPress={picked ? () => openFull(true) : onOpen} style={[StyleSheet.absoluteFill, styles.target]} />
      <View style={styles.corner}>
        {picked
          ? <Button variant="secondary" label="Play video with sound" text="Play with sound" icon={SOUND_ICON} onPress={() => openFull(true)} />
          : <Button variant="secondary" label="Play video" text="Play" icon={PLAY_ICON} onPress={() => openFull(false)} />}
      </View>
      {player}
    </View>
  );
}

/** AUTO-2/3: the picked Feed video, fetched (stoppable) and drawn in the card. Unmounting stops the download and
 *  lets the decrypted file go. */
function QuietVideo({ postId, mediaId, play }: { postId: string; mediaId: string; play: boolean }) {
  const { media } = useApp();
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    if (!media) return;
    const ac = new AbortController();
    media.videoUri(postId, mediaId, { signal: ac.signal }).then((u) => { if (!ac.signal.aborted) setUri(u); }).catch(() => {});
    return () => {
      ac.abort();
      media.releaseVideo(mediaId);
    };
  }, [media, postId, mediaId]);
  return uri ? <QuietPlayer uri={uri} play={play} /> : null;
}

function QuietPlayer({ uri, play }: { uri: string; play: boolean }) {
  const source = useMemo(() => ({ uri }), [uri]);
  const player = useVideoPlayer(source, (p) => {
    p.muted = true; // no sound until she asks for it
    p.loop = true; // loops in place; never moves on to the next video
  });
  useEffect(() => {
    try {
      if (play) player.play();
      else player.pause();
    } catch { /* already released */ }
  }, [player, play]);
  useEffect(() => () => { try { player.pause(); } catch { /* already released */ } }, [player]);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
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
