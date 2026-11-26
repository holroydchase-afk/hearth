// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Full-screen viewer (SPEC-VIEWER, look B, DEC-84): black, the photo edge to edge, and it behaves like iPhone Photos.
// react-native-zoom-toolkit's Gallery owns the photo (finger-following swipes, pinch and double tap to 3x, pan when
// zoomed, swipe down); Hearth's own controls sit on top. Easy view Off (parents): round Close and Save icons, the
// sender and date on top, the caption on a dark gradient, a strip of small photos; a single tap hides them all.
// Easy view On (grandparents): words on pills (Close, Zoom in, Back / Save / Next), "Photo n of m", bigger small
// photos, and nothing ever hides. Kept: HARD-8 (remember which photo, not its index), prefetch, Save's words and
// haptic, Save hidden on videos (R27).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, BackHandler, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View,
  type LayoutChangeEvent, type TextStyle, type ViewStyle,
} from 'react-native';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isRNRuntime, scheduleOnRN } from 'react-native-worklets';
import { Gallery, type GalleryRefType, type VerticalPullOptions } from 'react-native-zoom-toolkit';
import { messageFor } from '../errors/messages';
import { haptic } from '../platform/haptics';
import { useApp, useFeed } from '../state/AppContext';
import { useNav } from '../state/nav';
import { SystemIcon, type Icon } from '../ui/kit';
import { shortDate } from '../ui/format';
import { FONT, MIN_TARGET, RADIUS, useTheme, VIEWER_TYPE } from '../ui/theme';
import { AppGate } from './AppGate';
import { MediaImage } from './MediaImage';
import { VideoPlayer } from './VideoPlayer';
import { VideoPoster } from './VideoPoster';
import { closeProgress, shouldClose, viewerMotion } from './viewerMotion';

// The viewer is always black, whatever the theme (VIEWER-1); its words are white.
const BLACK = '#000000';
/** VIEWER-1: light status bar text. One constant element, so it is pushed once and never re-rendered. */
const LIGHT_BAR = <StatusBar barStyle="light-content" />;
const WHITE = '#FFFFFF';
/** VIEWER-4/5: pinch and double tap go up to 3x. The Easy view Zoom in pill goes to 2x at the center. */
const MAX_SCALE = 3;
const PILL_SCALE = 2;

/** Easy view Off's two round icon buttons (VIEWER-8); Easy view On's pills are words only. */
const PLAY_ICON: Icon = { sf: 'play', md: 'play_arrow' };
const ICONS: Record<'close' | 'save', Icon> = {
  close: { sf: 'xmark', md: 'close' },
  save: { sf: 'square.and.arrow.down', md: 'download' },
};

type Entry = { post: ReturnType<typeof useFeed>['posts'][number]; media: ReturnType<typeof useFeed>['posts'][number]['media'][number]; i: number };

/** VIEWER-21/23: the strip's small photos. Easy view Off is Photos-sized (a named exception to 48 pt); On is 48+. */
const STRIP = {
  off: { w: 30, current: 44, h: 44, gap: 2 },
  on: { w: 52, current: 72, h: 56, gap: 6 },
} as const;

export function ViewerScreen({ postId, index }: { postId: string; index: number }) {
  const app = useApp();
  const state = useFeed();
  const nav = useNav();
  const { bigText: easy, reduceMotion } = useTheme(); // the theme's big-text flag is Easy view (RD-77)
  const insets = useSafeAreaInsets();
  const motion = viewerMotion(reduceMotion);

  const entries = useMemo<Entry[]>(
    () => state.posts.flatMap((p) => p.media.filter((m) => m.status === 'ready').map((m, i) => ({ post: p, media: m, i }))),
    [state.posts],
  );
  const start = entries.findIndex((e) => e.post.post_id === postId && e.i === index);
  // HARD-8: remember WHICH photo is on screen, not its place in the list, so a new post arriving never swaps it.
  const [at, setAt] = useState<{ postId: string; i: number } | null>(null);
  const pos = at ? entries.findIndex((e) => e.post.post_id === at.postId && e.i === at.i) : null;
  const cur = pos === null ? (start >= 0 ? start : null) : pos >= 0 ? pos : null;
  const entry = cur !== null ? entries[cur] : undefined;
  const next = cur !== null && cur < entries.length - 1 ? cur + 1 : null;
  const back = cur !== null && cur > 0 ? cur - 1 : null;

  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [hidden, setHidden] = useState(false); // VIEWER-7: Easy view Off's single tap
  const [pull, setPull] = useState(0); // VIEWER-6: 0..1, how far the backdrop has faded
  const [screenReader, setScreenReader] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null); // a video's media id, playing full screen
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Opened from a notice before the post was in the cache: fetch once.
  const asked = useRef(false);
  useEffect(() => {
    if (app.feed && state.loaded && start < 0 && !asked.current) {
      asked.current = true;
      void app.feed.refresh();
    }
  }, [app.feed, state.loaded, start]);

  // VIEWER-16: with a screen reader on, the controls never hide.
  useEffect(() => {
    if (Platform.OS === 'web') return; // react-native-web always answers "on", so the web keeps the phone behavior
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled?.().then((on) => { if (alive) setScreenReader(!!on); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('screenReaderChanged', (on: boolean) => setScreenReader(!!on));
    return () => { alive = false; sub?.remove?.(); };
  }, []);

  // VIEWER-13: on arrival the next and the previous photo are fetched ahead.
  useEffect(() => {
    for (const n of [next, back]) {
      const e = n !== null ? entries[n] : undefined;
      if (e) app.media?.prefetch(e.post.post_id, [e.media.media_id]);
    }
  }, [entry?.media.media_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The Gallery's own index. Kept in step with `cur` so a new post arriving (HARD-8) never changes the photo shown.
  const gallery = useRef<GalleryRefType>(null);
  const photoBox = useRef<React.ComponentRef<typeof View>>(null);
  const shown = useRef<number | null>(null);
  if (shown.current === null && cur !== null) shown.current = cur;
  useEffect(() => {
    if (cur === null || shown.current === null || shown.current === cur) return;
    shown.current = cur;
    gallery.current?.setIndex(cur);
  }, [cur, entries]);

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const arrive = (to: number) => {
    const e = entriesRef.current[to];
    if (!e) return;
    shown.current = to;
    setAt((a) => (a && a.postId === e.post.post_id && a.i === e.i ? a : { postId: e.post.post_id, i: e.i }));
    setMsg(null);
    setZoomed(false); // each photo starts unzoomed
    setPlaying(null);
  };
  /** Back / Next / the strip / arrows / screen reader: move the Gallery itself, so the picture and the words agree. */
  const go = (to: number | null) => {
    if (to === null || !entriesRef.current[to]) return;
    shown.current = to;
    gallery.current?.setIndex(to);
    arrive(to);
  };

  // Gallery callbacks, kept stable so its gesture handler isn't rebuilt on every render.
  const live = useRef({ go, arrive, easy, screenReader, zoomed, close: nav.close, entries, cur, next, back, playing, size });
  live.current = { go, arrive, easy, screenReader, zoomed, close: nav.close, entries, cur, next, back, playing, size };

  const onIndexChange = useCallback((i: number) => live.current.arrive(i), []);
  const onTap = useCallback((_e: unknown, i: number) => {
    const l = live.current;
    const e = l.entries[i];
    if (e?.media.kind === 'video') { setPlaying(e.media.media_id); return; } // the poster's Play, under the Gallery
    if (l.easy || l.screenReader) return; // VIEWER-10 / VIEWER-16: nothing ever hides
    setHidden((h) => !h);
  }, []);
  const onZoomBegin = useCallback(() => setZoomed(true), []);
  const onZoomEnd = useCallback(() => setZoomed(false), []);
  // VIEWER-6: a drag down fades the backdrop; letting go past 120 pt or with a flick closes. Zoomed, it pans.
  const released = useRef(false);
  const pullJS = useRef((translateY: number, done: boolean, velocityY: number) => {
    if (live.current.zoomed) return;
    if (!done) { released.current = false; setPull(closeProgress(translateY)); return; }
    if (released.current) return; // the Gallery reports the spring back as released too; act on the first only
    released.current = true;
    setPull(0);
    if (shouldClose(translateY, velocityY)) live.current.close();
  }).current;
  const onVerticalPull = useCallback((o: VerticalPullOptions) => {
    'worklet';
    if (isRNRuntime()) pullJS(o.translateY, o.released, o.velocityY);
    else scheduleOnRN(pullJS, o.translateY, o.released, o.velocityY);
  }, [pullJS]);
  // VIEWER-3: past a third of the width goes next/back (the Gallery's own snap is at half).
  const onPanEnd = useCallback((e: { translationX: number; velocityX: number }) => {
    const l = live.current;
    if (l.zoomed || !l.size.w || Math.abs(e.translationX) < l.size.w / 3 || Math.abs(e.translationX) >= l.size.w / 2) return;
    l.go(e.translationX < 0 ? l.next : l.back);
  }, []);

  // VIEWER-18: the phone's Back button closes; on the web, arrow keys move and Escape closes.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { live.current.close(); return true; });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const l = live.current;
      if (l.playing || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight') l.go(l.next);
      else if (e.key === 'ArrowLeft') l.go(l.back);
      else if (e.key === 'Escape') l.close();
      else return;
      e.preventDefault();
    };
    // VIEWER-4 / VIEWER-18: a double-click zooms to 3x on that point, and back to fit. Gesture-handler's web double tap
    // doesn't always see a mouse double-click, so the page listens too, unless the Gallery's own double tap just ran.
    const onDouble = (e: MouseEvent) => {
      const box = photoBox.current as unknown as HTMLElement | null;
      if (!box || !(e.target instanceof Node) || !box.contains(e.target) || live.current.playing) return;
      const r = box.getBoundingClientRect();
      const at = { x: e.clientX - r.left, y: e.clientY - r.top };
      const before = gallery.current?.getState().scale ?? 1;
      setTimeout(() => {
        const g = gallery.current;
        if (!g || g.getState().scale !== before) return; // the Gallery's own double tap handled it
        // QA-R2: say so at once, so a drag right after the double-click pans instead of pulling down to close.
        if (before > 1) { g.reset(true); setZoomed(false); } else { g.zoom(MAX_SCALE, at, true); setZoomed(true); }
      }, 350);
    };
    // VIEWER-6 on the web: gesture-handler's web pan doesn't reliably tell a mouse drag down from a sideways one, so
    // the page follows the pointer itself for the fade and the close (phones use the Gallery's onVerticalPull).
    let drag: { x: number; y: number; t: number; lastY: number; lastT: number; pulling: boolean } | null = null;
    const inPhoto = (e: Event) => {
      const box = photoBox.current as unknown as HTMLElement | null;
      return !!box && e.target instanceof Node && box.contains(e.target);
    };
    const zoomedNow = () => live.current.zoomed || (gallery.current?.getState().scale ?? 1) > 1;
    const onDown = (e: PointerEvent) => {
      drag = inPhoto(e) && !zoomedNow() && !live.current.playing ? { x: e.clientX, y: e.clientY, t: e.timeStamp, lastY: e.clientY, lastT: e.timeStamp, pulling: false } : null;
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.pulling && Math.abs(dy) > 10) {
        if (dy > 0 && dy > Math.abs(dx) && !zoomedNow()) drag.pulling = true;
        else { drag = null; return; }
      }
      if (!drag.pulling) return;
      drag.lastY = e.clientY;
      drag.lastT = e.timeStamp;
      pullJS(dy, false, 0);
    };
    const onUp = (e: PointerEvent) => {
      const d = drag;
      drag = null;
      if (!d?.pulling) return;
      const dt = Math.max(1, e.timeStamp - d.lastT);
      const recent = e.timeStamp - d.lastT < 100 ? ((e.clientY - d.lastY) / dt) * 1000 : 0;
      pullJS(e.clientY - d.y, true, recent);
    };
    // QA-R3: the browser took the pointer (a scroll, a system gesture): spring back, never close.
    const onCancel = () => {
      const d = drag;
      drag = null;
      if (d?.pulling) pullJS(0, true, 0);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('dblclick', onDouble);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onCancel, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('dblclick', onDouble);
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onCancel, true);
    };
  }, []);

  const renderItem = useCallback((e: Entry) => {
    const box: ViewStyle = size.w ? { width: size.w, height: size.h } : { width: '100%', height: '100%' };
    return e.media.kind === 'video'
      ? <VideoPoster postId={e.post.post_id} mediaId={e.media.media_id} fit="contain" onBlack still style={[box, { backgroundColor: BLACK }]} />
      : <View style={box}><MediaImage postId={e.post.post_id} mediaId={e.media.media_id} fit="contain" onBlack style={styles.photo} /></View>;
  }, [size.w, size.h]);
  const keyOf = useCallback((e: Entry) => e.media.media_id, []);
  const onLayout = (ev: LayoutChangeEvent) => {
    const { width, height } = ev.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

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
  const zoom = () => {
    if (zoomed) gallery.current?.reset(motion.zoomAnimated);
    else gallery.current?.zoom(PILL_SCALE, undefined, motion.zoomAnimated);
    setZoomed(!zoomed);
  };

  const controls = easy || screenReader || !hidden;
  const isVideo = entry?.media.kind === 'video';
  const closeBtn = easy
    ? <Pill label="Close" text="Close" onPress={nav.close} />
    : <RoundButton label="Close" icon={ICONS.close} onPress={nav.close} />;
  const backdrop: ViewStyle = { backgroundColor: pull > 0 ? `rgba(0, 0, 0, ${Math.max(0, 1 - pull).toFixed(3)})` : BLACK };

  if (!entry) {
    const removed = state.loaded && state.status === 'idle' && (asked.current || pos === -1);
    return (
      <View testID="viewer-backdrop" style={[styles.fill, backdrop, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]} onAccessibilityEscape={nav.close}>
        {LIGHT_BAR}
        <View style={styles.topRow}>{closeBtn}</View>
        <View style={styles.center} accessibilityLiveRegion="polite">
          {removed ? null : <ActivityIndicator size="large" color={WHITE} />}
          <Text style={[styles.white, { fontSize: VIEWER_TYPE.body, fontFamily: FONT.regular, textAlign: 'center' }]}>
            {removed ? 'This was removed.' : 'Loading the photo…'}
          </Text>
        </View>
      </View>
    );
  }

  const n = cur! + 1;
  const m = entries.length;
  const date = shortDate(entry.post.published_at);
  const photoName = `${isVideo ? 'Video' : 'Photo'} from ${entry.post.author_name}, ${date}`;
  const a11yActions = [
    ...(next !== null ? [{ name: 'increment', label: 'Next photo' }] : []),
    ...(back !== null ? [{ name: 'decrement', label: 'Previous photo' }] : []),
    ...(isVideo ? [{ name: 'activate', label: 'Play video' }] : []),
  ];
  const onA11yAction = (ev: { nativeEvent: { actionName: string } }) => {
    const name = ev.nativeEvent.actionName;
    if (name === 'increment' || name === 'Next photo') go(next);
    else if (name === 'decrement' || name === 'Previous photo') go(back);
    else if (name === 'activate' && isVideo) setPlaying(entry.media.media_id);
  };

  const message = msg ? (
    <View style={[styles.msg, { marginHorizontal: easy ? 0 : 16 }]} accessibilityLiveRegion="polite">
      <Text style={[styles.white, { fontSize: VIEWER_TYPE.body, fontFamily: FONT.regular }]}>{msg.text}</Text>
    </View>
  ) : null;
  const strip = m > 1 ? <Strip entries={entries} cur={cur!} easy={easy} animated={!reduceMotion} onPick={go} /> : null;
  const captionStyle: TextStyle = { ...styles.white, fontSize: VIEWER_TYPE.body, fontFamily: FONT.regular, lineHeight: 22 };

  return (
    <GestureHandlerRootView style={styles.fill}>
      <View testID="viewer-backdrop" style={[styles.fill, backdrop]} onAccessibilityEscape={nav.close}>
        {LIGHT_BAR}
        {easy ? (
          <View style={[styles.easyTop, { paddingTop: insets.top + 8 }]}>
            <View style={styles.topRow}>
              {closeBtn}
              {!isVideo ? <Pill label={zoomed ? 'Zoom out' : 'Zoom in'} text={zoomed ? 'Zoom out' : 'Zoom in'} onPress={zoom} /> : null}
            </View>
            <Text style={[styles.white, { fontSize: VIEWER_TYPE.title2, fontFamily: FONT.semibold }]}>{entry.post.author_name}</Text>
            <Text style={[styles.white, { fontSize: VIEWER_TYPE.body, fontFamily: FONT.regular }]}>{`${date} · Photo ${n} of ${m}`}</Text>
          </View>
        ) : null}
        <View style={styles.fill}>
        <View
          ref={photoBox}
          style={styles.stage}
          onLayout={onLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={photoName}
          accessibilityActions={a11yActions}
          onAccessibilityAction={onA11yAction}
        >
          <Gallery
            ref={gallery}
            data={entries}
            keyExtractor={keyOf}
            renderItem={renderItem}
            initialIndex={cur!}
            maxScale={MAX_SCALE}
            tapOnEdgeToItem={false}
            snapTimingConfig={motion.change === 'fade' ? { duration: 0 } : undefined}
            onIndexChange={onIndexChange}
            onTap={onTap}
            onZoomBegin={onZoomBegin}
            onZoomEnd={onZoomEnd}
            onVerticalPull={Platform.OS === 'web' ? undefined : onVerticalPull}
            onPanEnd={onPanEnd}
          />
        </View>
        {isVideo ? (
          // VID-18 / GUX-R1: the video's one Play button, above the Gallery so a tap reaches it (a tap anywhere else on
          // the poster plays too, through onTap). The poster's small picture rides in the button.
          <View style={styles.playLayer} pointerEvents="box-none">
            <Pressable accessibilityRole="button" accessibilityLabel="Play video" onPress={() => setPlaying(entry.media.media_id)} style={styles.play}>
              <MediaImage postId={entry.post.post_id} mediaId={entry.media.media_id} full={false} compact onBlack style={styles.playThumb} />
              <SystemIcon icon={PLAY_ICON} color={WHITE} />
              <Text style={[styles.white, { fontSize: VIEWER_TYPE.title3, fontFamily: FONT.semibold }]}>Play</Text>
            </Pressable>
          </View>
        ) : null}
        </View>
        {easy ? (
          <View style={[styles.easyBottom, { paddingBottom: insets.bottom + 8 }]}>
            {entry.post.caption ? <Text style={captionStyle}>{entry.post.caption}</Text> : null}
            {message}
            {strip}
            <View testID="viewer-pills" style={styles.pills}>
              <View style={styles.slot}>{back !== null ? <Pill label="Back to the previous photo" text="Back" onPress={() => go(back)} wide /> : null}</View>
              <View style={styles.slot}>{!isVideo ? <Pill label="Save to my phone" text="Save" busy={saving} onPress={() => void save()} wide /> : null}</View>
              <View style={styles.slot}>{next !== null ? <Pill label="Next photo" text="Next" onPress={() => go(next)} wide /> : null}</View>
            </View>
          </View>
        ) : controls && pull === 0 ? (
          <>
            <View style={[styles.offTop, TOP_SHADE, { paddingTop: insets.top + 4 }]}>
              {closeBtn}
              <View style={styles.titles}>
                <Text numberOfLines={1} style={[styles.white, { fontSize: VIEWER_TYPE.headline, fontFamily: FONT.semibold, textAlign: 'center' }]}>{entry.post.author_name}</Text>
                <Text numberOfLines={1} style={[styles.white, { fontSize: VIEWER_TYPE.caption1, fontFamily: FONT.regular, textAlign: 'center' }]}>{date}</Text>
              </View>
              <View style={styles.spacer} />
            </View>
            <View testID="viewer-scrim" style={[styles.offBottom, BOTTOM_SCRIM, { paddingBottom: insets.bottom + 4 }]}>
              {entry.post.caption ? <Text style={[captionStyle, styles.offCaption]}>{entry.post.caption}</Text> : null}
              {message}
              {strip}
              <View style={styles.offRow}>
                {!isVideo ? <RoundButton label="Save to my phone" icon={ICONS.save} busy={saving} onPress={() => void save()} /> : <View style={styles.spacer} />}
              </View>
            </View>
          </>
        ) : null}
        {playing ? <VideoPlayer postId={entry.post.post_id} mediaId={playing} onClose={() => setPlaying(null)} /> : null}
      </View>
    </GestureHandlerRootView>
  );
}

/** VIEWER-8: Easy view Off's round icon button: a 44 pt circle centered in a 48 pt target (not hitSlop). */
function RoundButton({ label, icon, onPress, busy }: { label: string; icon: Icon; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy: !!busy }} disabled={busy || undefined} onPress={onPress} style={styles.round}>
      <View style={styles.circle}>
        {busy ? <ActivityIndicator color={WHITE} /> : <SystemIcon icon={icon} color={WHITE} />}
      </View>
    </Pressable>
  );
}

/** VIEWER-10: Easy view On's pill: a word in title3, 48 pt tall. */
function Pill({ label, text, onPress, busy, wide }: { label: string; text: string; onPress: () => void; busy?: boolean; wide?: boolean }) {
  // Words only (DS-3 is met by the word): a symbol font's glyph overflows its line box on the web at 360 pt (VIEWER-12).
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!busy }}
      disabled={busy || undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, wide ? styles.pillWide : null, { opacity: pressed ? 0.7 : 1 }]}
    >
      {busy ? <ActivityIndicator color={WHITE} /> : null}
      <Text numberOfLines={1} style={[styles.white, { fontSize: VIEWER_TYPE.title3, fontFamily: FONT.semibold }]}>{text}</Text>
    </Pressable>
  );
}

/** VIEWER-21..23: the strip of small photos. The current one is wider and outlined, and stays in view. A plain
 *  scroll view (one small photo per photo); only the ones near the current photo load their picture. */
const STRIP_LOAD = 20;
function Strip({ entries, cur, easy, animated, onPick }: { entries: Entry[]; cur: number; easy: boolean; animated: boolean; onPick: (i: number) => void }) {
  const s = easy ? STRIP.on : STRIP.off;
  const list = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [width, setWidth] = useState(0);
  const offset = (i: number) => 8 + i * (s.w + s.gap) + (i > cur ? s.current - s.w : 0);
  useEffect(() => {
    if (!width) return;
    list.current?.scrollTo?.({ x: Math.max(0, offset(cur) + s.current / 2 - width / 2), y: 0, animated });
  }, [cur, width]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = entries.length;
  return (
    <ScrollView
      ref={list}
      testID="viewer-strip"
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(ev) => setWidth(ev.nativeEvent.layout.width)}
      style={styles.strip}
      contentContainerStyle={{ paddingHorizontal: 8 }}
    >
      {entries.map((item, i) => {
        const on = i === cur;
        return (
          <Pressable
            key={item.media.media_id}
            accessibilityRole="button"
            accessibilityLabel={`Photo ${i + 1} of ${m}, from ${item.post.author_name}`}
            accessibilityState={{ selected: on }}
            aria-selected={on}
            onPress={() => onPick(i)}
            style={[
              { width: on ? s.current : s.w, height: s.h, marginRight: s.gap },
              easy ? { minHeight: MIN_TARGET, minWidth: MIN_TARGET } : null,
              on ? styles.thumbOn : styles.thumb,
            ]}
          >
            {Math.abs(i - cur) <= STRIP_LOAD
              ? <MediaImage postId={item.post.post_id} mediaId={item.media.media_id} full={false} compact onBlack style={styles.thumbImage} />
              : <View style={styles.thumbImage} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// VIEWER-9: the caption sits on a gradient that is at least 60% black under the words (4.5:1 on a white photo).
// Phones draw `experimental_backgroundImage`; the web draws the CSS `backgroundImage`.
const GRADIENT_UP = 'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.62) 28%, rgba(0, 0, 0, 0.7) 100%)';
const GRADIENT_DOWN = 'linear-gradient(0deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.45) 100%)';
const paint = (g: string) => (Platform.OS === 'web' ? { backgroundImage: g } : { experimental_backgroundImage: g }) as ViewStyle;
const BOTTOM_SCRIM = paint(GRADIENT_UP);
const TOP_SHADE = paint(GRADIENT_DOWN);

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // zIndex 0 keeps the Gallery's gesture layer inside the photo area, so the controls drawn after it stay tappable.
  stage: { flex: 1, zIndex: 0 },
  playLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  play: {
    minHeight: 56, minWidth: MIN_TARGET, borderRadius: 28, paddingLeft: 6, paddingRight: 18, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  playThumb: { width: 44, height: 44, borderRadius: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 16 },
  white: { color: WHITE },
  photo: { width: '100%', height: '100%', backgroundColor: 'transparent' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 8 },
  easyTop: { paddingHorizontal: 8, paddingBottom: 8, gap: 4, alignItems: 'stretch' },
  easyBottom: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  pills: { flexDirection: 'row', gap: 8 },
  slot: { flex: 1 },
  pill: {
    minHeight: MIN_TARGET, minWidth: MIN_TARGET, borderRadius: MIN_TARGET / 2, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#2C2C2E',
  },
  pillWide: { alignSelf: 'stretch' },
  offTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 16 },
  titles: { flex: 1, alignItems: 'center' },
  spacer: { width: MIN_TARGET, height: MIN_TARGET },
  offBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 40, gap: 8 },
  offCaption: { paddingHorizontal: 16 },
  offRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  round: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  msg: { backgroundColor: '#1C1C1E', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  strip: { flexGrow: 0 },
  thumb: { overflow: 'hidden', borderRadius: RADIUS.small, opacity: 0.85 },
  thumbOn: { overflow: 'hidden', borderRadius: RADIUS.small, borderWidth: 2, borderColor: WHITE },
  thumbImage: { flex: 1, backgroundColor: '#1C1C1E' },
});
