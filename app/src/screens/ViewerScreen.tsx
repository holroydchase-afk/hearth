// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Full-screen viewer (BETA-SEE-3/-5): Back / Next buttons AND swipe, labeled Close,
// "From Chase · Sun, Oct 11", caption under the photo, "Save to my phone".
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { haptic } from '../platform/haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { messageFor } from '../errors/messages';
import { useApp, useFeed } from '../state/AppContext';
import { useNav } from '../state/nav';
import { Button, Loading, Notice, Txt } from '../ui/kit';
import { shortDate } from '../ui/format';
import { pinchZoom, useTheme } from '../ui/theme';
import { AppGate } from './AppGate';
import { MediaImage } from './MediaImage';

export function ViewerScreen({ postId, index }: { postId: string; index: number }) {
  const app = useApp();
  const state = useFeed();
  const nav = useNav();
  const { c } = useTheme();

  const entries = useMemo(
    () => state.posts.flatMap((p) => p.media.filter((m) => m.status === 'ready').map((m, i) => ({ post: p, media: m, i }))),
    [state.posts],
  );
  const start = entries.findIndex((e) => e.post.post_id === postId && e.i === index);
  // HARD-8: remember WHICH photo is on screen, not its place in the list, so a new post arriving never swaps it.
  const [at, setAt] = useState<{ postId: string; i: number } | null>(null);
  const pos = at ? entries.findIndex((e) => e.post.post_id === at.postId && e.i === at.i) : null;
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const cur = pos === null ? (start >= 0 ? start : null) : pos >= 0 ? pos : null;

  // Opened from a notice before the post was in the cache: fetch once.
  const asked = useRef(false);
  useEffect(() => {
    if (app.feed && state.loaded && start < 0 && !asked.current) {
      asked.current = true;
      void app.feed.refresh();
    }
  }, [app.feed, state.loaded, start]);

  // HIG-2 / BETA-SEE-4: zoom by pinch (iPhone), double tap, or the Zoom button (DS-4). Each photo starts unzoomed.
  const [zoom, setZoom] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const lastTap = useRef(0);
  const tapPhoto = () => {
    const now = Date.now();
    if (now - lastTap.current < 350) {
      lastTap.current = 0;
      setZoom((z) => !z);
    } else lastTap.current = now;
  };

  const entry = cur !== null ? entries[cur] : undefined;
  const next = cur !== null && cur < entries.length - 1 ? cur + 1 : null;
  const back = cur !== null && cur > 0 ? cur - 1 : null;

  useEffect(() => {
    if (entry) app.feed?.markSeen(entry.post);
    const n = next !== null ? entries[next] : undefined;
    if (n) app.media?.prefetch(n.post.post_id, [n.media.media_id]);
  }, [entry?.media.media_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (to: number | null) => {
    const e = to === null ? undefined : entries[to];
    if (!e) return;
    setAt({ postId: e.post.post_id, i: e.i });
    setMsg(null);
    setZoom(false);
  };
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderRelease: (_e, g) => {
      if (g.dx < -60) swipeTo.current('next');
      else if (g.dx > 60) swipeTo.current('back');
    },
  })).current;
  // QA-R1: iPhone pinches with its scroll view; Android and the web watch two fingers here and step the zoom.
  const pinch = useRef<{ start: number; last: number } | null>(null);
  const zoomed = useRef(zoom);
  zoomed.current = zoom;
  const spread = (touches: readonly { pageX: number; pageY: number }[]) =>
    Math.hypot(touches[0]!.pageX - touches[1]!.pageX, touches[0]!.pageY - touches[1]!.pageY);
  const pinchHandlers = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length === 2,
    onPanResponderGrant: (e) => {
      const t = e.nativeEvent.touches;
      if (t.length === 2) pinch.current = { start: spread(t), last: spread(t) };
    },
    onPanResponderMove: (e) => {
      const t = e.nativeEvent.touches;
      if (t.length !== 2) return;
      if (!pinch.current) pinch.current = { start: spread(t), last: spread(t) };
      else pinch.current.last = spread(t);
    },
    onPanResponderRelease: () => {
      const p = pinch.current;
      pinch.current = null;
      if (p && p.start > 0) setZoom(pinchZoom(p.last / p.start, zoomed.current));
    },
    onPanResponderTerminate: () => { pinch.current = null; },
  })).current;
  const swipeTo = useRef<(d: 'next' | 'back') => void>(() => {});
  swipeTo.current = (d) => go(d === 'next' ? next : back);

  if (app.status !== 'ready') return <AppGate />;

  const save = async () => {
    if (!entry || !app.media) return;
    setSaving(true);
    setMsg(null);
    try {
      const { bytes } = await app.media.bytes(entry.post.post_id, entry.media.media_id);
      const r = await app.deps.saveToPhone(bytes, `hearth-${entry.media.media_id.slice(0, 8)}`);
      if (r === 'saved') haptic('success');
      setMsg(r === 'saved'
        ? { text: 'Saved to your phone.', good: true }
        : { text: 'Your phone said no. Tap "Allow" when your phone asks, then try again.', good: false });
    } catch (e) {
      setMsg({ text: messageFor(e, { inviter: app.helper }), good: false });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.top}>
        <Button label="Close" icon={{ sf: 'xmark', md: 'close' }} variant="secondary" onPress={nav.close} />
        {entry ? <Txt variant="muted">{`Photo ${cur! + 1} of ${entries.length}`}</Txt> : null}
        {entry ? (
          <Button
            label={zoom ? 'Zoom out' : 'Zoom in'}
            icon={zoom ? { sf: 'minus.magnifyingglass', md: 'zoom_out' } : { sf: 'plus.magnifyingglass', md: 'zoom_in' }}
            variant="secondary"
            onPress={() => setZoom((z) => !z)}
          />
        ) : null}
      </View>
      {!entry ? (
        state.loaded && state.status === 'idle' && (asked.current || pos === -1) ? (
          <View style={styles.pad}><Txt variant="title">This was removed.</Txt></View>
        ) : (
          <Loading words="Loading the photo…" />
        )
      ) : (
        <>
          <View style={styles.pad}>
            <Txt variant="strong">{`From ${entry.post.author_name} · ${shortDate(entry.post.published_at)}`}</Txt>
          </View>
          {/* Zoomed: twice the size, moved around in both directions; swiping to the next photo waits until unzoomed.
              iPhone: the outer scroll view also pinches, up to 4x. */}
          <View style={{ flex: 1 }} onLayout={(ev) => setBox({ w: ev.nativeEvent.layout.width, h: ev.nativeEvent.layout.height })}
            {...(zoom ? {} : swipe.panHandlers)}>
            <View testID="viewer-gestures" style={{ flex: 1 }} {...(Platform.OS === 'ios' ? {} : pinchHandlers.panHandlers)}>
            <ScrollView key={entry.media.media_id} testID="viewer-pinch" style={{ flex: 1 }} maximumZoomScale={4} minimumZoomScale={1}
              bouncesZoom centerContent scrollEnabled={zoom} showsVerticalScrollIndicator={false}
              contentContainerStyle={zoom && box.h ? { height: box.h * 2 } : { flexGrow: 1 }}
              contentOffset={zoom ? { x: 0, y: box.h / 2 } : undefined}>
              <ScrollView horizontal scrollEnabled={zoom} showsHorizontalScrollIndicator={false}
                contentContainerStyle={zoom && box.w ? { width: box.w * 2 } : { flexGrow: 1 }}
                contentOffset={zoom ? { x: box.w / 2, y: 0 } : undefined}>
                <Pressable testID="viewer-photo" accessible={false} onPress={tapPhoto}
                  style={zoom && box.w ? { width: box.w * 2, height: box.h * 2 } : { width: box.w || '100%', height: box.h || '100%' }}>
                  <View testID={zoom ? 'viewer-zoomed' : undefined} style={{ flex: 1 }}>
                    <MediaImage postId={entry.post.post_id} mediaId={entry.media.media_id} fit="contain" style={{ flex: 1, backgroundColor: c.bg }} />
                  </View>
                </Pressable>
              </ScrollView>
            </ScrollView>
            </View>
          </View>
          <View style={styles.pad}>
            {entry.post.caption ? <Txt>{entry.post.caption}</Txt> : null}
            {msg ? <Notice text={msg.text} tone={msg.good ? 'good' : 'info'} /> : null}
            <View style={styles.row}>
              {back !== null ? <Button label="Back to the previous photo" text="◀ Back" variant="secondary" style={{ flex: 1 }} onPress={() => go(back)} /> : <View style={{ flex: 1 }} />}
              {next !== null ? <Button label="Next photo" text="Next ▶" variant="secondary" style={{ flex: 1 }} onPress={() => go(next)} /> : <View style={{ flex: 1 }} />}
            </View>
            <Button label="Save to my phone" busy={saving} onPress={() => void save()} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  pad: { paddingHorizontal: 16, paddingVertical: 8, gap: 10 },
  row: { flexDirection: 'row', gap: 12 },
});
