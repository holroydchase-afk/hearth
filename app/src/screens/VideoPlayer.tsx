// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// VID-18..20 (SPEC-MEDIA 4.1): a video, full screen, opened in place over whatever screen the grandparent was on.
// The video is decrypted into a short-lived local file (MediaCache.videoUri) and deleted when this closes.
// GUX-R3: nothing plays until the person taps Play on the poster; that one tap opens this and plays, with sound.
// Every control is a word button: Play / Pause, "Turn sound off" / "Turn sound on", Close. GUX-R2: always on the
// person's color in its dark version (never pure black, which glares), even when the phone is in light mode.
// If the file can't be fetched or decrypted, or the player fails, it says so in plain words naming who to call
// (GUX-R4) with Try again; never a blank or spinning screen.
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cantPlayVideo } from '../errors/messages';
import { useApp } from '../state/AppContext';
import { Button, Txt } from '../ui/kit';
import { LookContext, useTheme } from '../ui/theme';

export function VideoPlayer(props: { postId: string; mediaId: string; onClose: () => void }) {
  return (
    <LookContext.Provider value="dark">
      <DarkPlayer {...props} />
    </LookContext.Provider>
  );
}

function DarkPlayer({ postId, mediaId, onClose }: { postId: string; mediaId: string; onClose: () => void }) {
  const { media, helper } = useApp();
  const { c } = useTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setUri(null);
    setFailed(false);
    if (!media) { setFailed(true); return; }
    media.videoUri(postId, mediaId).then((u) => alive && setUri(u)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [media, postId, mediaId, attempt]);

  // The decrypted file goes when the player closes.
  useEffect(() => () => media?.releaseVideo(mediaId), [media, mediaId]);

  const tryAgain = () => {
    media?.releaseVideo(mediaId);
    setAttempt((n) => n + 1);
  };

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.screen, { backgroundColor: c.bg }]}>
        <View style={styles.top}>
          <Button label="Close the video" text="Close" icon={{ sf: 'xmark', md: 'close' }} variant="secondary" onPress={onClose} />
        </View>
        {failed ? (
          <View style={styles.center}>
            <Txt style={{ textAlign: 'center' }} role="alert">{cantPlayVideo(helper)}</Txt>
            <Button label="Try again" onPress={tryAgain} />
          </View>
        ) : uri ? (
          <Playing key={`${attempt}:${uri}`} uri={uri} onError={() => setFailed(true)} />
        ) : (
          <View style={styles.center}>
            <Txt>Getting the video ready…</Txt>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function Playing({ uri, onError }: { uri: string; onError: () => void }) {
  const player = useVideoPlayer({ uri }, (p) => {
    // GUX-R3: the person tapped Play on the poster to get here, so it plays, with sound. Nothing autoplays before.
    p.muted = false;
    p.play();
  });
  const [muted, setMuted] = useState(false);
  const [isPlaying, setPlaying] = useState(player.playing);

  useEffect(() => {
    const subs = [
      player.addListener('statusChange', ({ status }) => { if (status === 'error') onError(); }),
      player.addListener('playingChange', ({ isPlaying: p }) => setPlaying(p)),
    ];
    return () => subs.forEach((x) => x.remove());
  }, [player]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSound = () => {
    player.muted = !muted;
    setMuted(!muted);
  };

  return (
    <>
      <View style={{ flex: 1 }}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
      </View>
      <View style={styles.controls}>
        {isPlaying
          ? <Button label="Pause the video" text="Pause" icon={{ sf: 'pause.fill', md: 'pause' }} style={{ flex: 1 }} onPress={() => player.pause()} />
          : <Button label="Play the video" text="Play" icon={{ sf: 'play.fill', md: 'play_arrow' }} style={{ flex: 1 }} onPress={() => player.play()} />}
        {muted
          ? <Button label="Turn sound on" text="Sound on" icon={{ sf: 'speaker.wave.2.fill', md: 'volume_up' }} variant="secondary" style={{ flex: 1 }} onPress={toggleSound} />
          : <Button label="Turn sound off" text="Sound off" icon={{ sf: 'speaker.slash.fill', md: 'volume_off' }} variant="secondary" style={{ flex: 1 }} onPress={toggleSound} />}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 16, paddingVertical: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  controls: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});
