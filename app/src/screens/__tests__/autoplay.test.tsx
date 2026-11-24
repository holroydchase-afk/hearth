// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEC-86 (SPEC-MEDIA 5, 5.1): Feed videos play quietly, one at a time, once she stops on one; Gallery never autoplays.
//
// How these drive the list: Feed's FlatList (PhotosScreen mode "feed") must take viewabilityConfig={AUTOPLAY_VIEWABILITY}
// (src/feed/autoplay.ts) and an onViewableItemsChanged (or the same pair in viewabilityConfigCallbackPairs). React
// Native does the 80% / 1 s dwell itself (proved in src/feed/__tests__/autoplay.test.ts), so here a test calls the
// list's own callback the way the phone does after the dwell, and fires the list's scroll events.
//
// Seams for the engineer:
//   src/feed/autoplay.ts  AUTOPLAY_VIEWABILITY, plus a `useAutoplay` hook Feed uses: picks the first viewable video
//                         only, pauses on onScrollBeginDrag / onMomentumScrollBegin, starts again once the list has
//                         been still AUTOPLAY_VIEWABILITY.minimumViewTime ms after onScrollEndDrag / onMomentumScrollEnd.
//   VideoPoster           while it is the one autoplaying: an inline expo-video player (muted, loop, VideoView) fed by
//                         media.videoUri(postId, mediaId, { signal }); its word button is "Play with sound" (spoken
//                         "Play video with sound"); that button, or tapping the playing video, opens the full-screen
//                         VideoPlayer with sound. When it stops being the one: pause, abort the signal, releaseVideo.
//   app.dataPrefs         { autoplay, saveData } (src/state/dataPrefs.ts); autoplay only when autoplayOn(...) is true.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo, FlatList } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import type { PhotosRow } from '../../feed/events';
import { MediaCache } from '../../media/cache';
import { renderApp, type SeedDataPrefs } from '../../test/renderApp';
import { seedPost, seedVideoPost } from '../../test/seed';
import { PhotosScreen } from '../PhotosScreen';

/* eslint-disable @typescript-eslint/no-require-imports */
type Player = { source: unknown; muted: boolean; loop: boolean; playing: boolean; play: jest.Mock; pause: jest.Mock; __emit(e: string, p?: unknown): void };
const players = (): Player[] => (jest.requireMock('expo-video') as { __players: Player[] }).__players;
const playingNow = () => players().filter((p) => p.playing);
const AUTOPLAY_VIEWABILITY = () => (require('../../feed/autoplay') as { AUTOPLAY_VIEWABILITY: object }).AUTOPLAY_VIEWABILITY;

type VideoUri = (postId: string, mediaId: string, opts?: { signal?: AbortSignal }) => Promise<string>;
type WithVideo = { videoUri: VideoUri; releaseVideo(mediaId: string): void; uri(p: string, m: string, w: 'thumb' | 'display'): Promise<string> };
let videoUri: jest.SpyInstance<Promise<string>, Parameters<VideoUri>>;
let release: jest.SpyInstance;
let mediaUri: jest.SpyInstance;
const fileFor = (mediaId: string) => `file:///cache/video/${mediaId}.mp4`;

beforeEach(() => {
  players().length = 0;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  videoUri = jest.spyOn(MediaCache.prototype as unknown as WithVideo, 'videoUri').mockImplementation(async (_p, m) => fileFor(m));
  release = jest.spyOn(MediaCache.prototype as unknown as WithVideo, 'releaseVideo');
  mediaUri = jest.spyOn(MediaCache.prototype as unknown as WithVideo, 'uri');
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** A photo post and two video posts (the newer video on top). */
async function family() {
  const be = FakeBackend.withFixture();
  await seedPost(be, { caption: 'A photo too', circles: [FIXTURE.circles.dadSide.id] });
  const older = await seedVideoPost(be, { caption: 'Leo on the slide', circles: [FIXTURE.circles.dadSide.id] });
  const newer = await seedVideoPost(be, { caption: 'Mia on the swing', circles: [FIXTURE.circles.dadSide.id] });
  return { be, older, newer };
}

async function feed(opts: { dataPrefs?: SeedDataPrefs; be?: FakeBackend } = {}) {
  const f = opts.be ? { be: opts.be, older: null, newer: null } : await family();
  const r = await renderApp(<PhotosScreen mode="feed" />, { be: f.be, user: 'jo', dataPrefs: opts.dataPrefs });
  await screen.findByText('Leo on the slide');
  jest.useFakeTimers();
  return { ...r, ...f };
}

/** Feed's post list (not any other list inside a card). */
function list() {
  const all = screen.UNSAFE_getAllByType(FlatList);
  const l = all.find((x) => Array.isArray(x.props.data) && (x.props.data as PhotosRow[]).some((r) => r && r.type === 'post'));
  if (!l) throw new Error('Feed list not found');
  return l;
}
type Pair = { viewabilityConfig: object; onViewableItemsChanged: (i: unknown) => void };
function viewability(): Pair {
  const p = list().props as { viewabilityConfig?: object; onViewableItemsChanged?: Pair['onViewableItemsChanged']; viewabilityConfigCallbackPairs?: Pair[] };
  if (p.viewabilityConfig && p.onViewableItemsChanged) return { viewabilityConfig: p.viewabilityConfig, onViewableItemsChanged: p.onViewableItemsChanged };
  const pair = p.viewabilityConfigCallbackPairs?.[0];
  if (!pair) throw new Error('Feed list has no viewabilityConfig / onViewableItemsChanged (AUTO-9)');
  return pair;
}
const videoIn = (r: PhotosRow): string | null => {
  const posts = r.type === 'post' || r.type === 'event' ? [r.post] : r.type === 'session' ? r.posts : [];
  for (const p of posts) for (const m of p.media) if (m.kind === 'video') return m.media_id;
  return null;
};
/** The rows with a video, top to bottom. */
const videoRows = () => (list().props.data as PhotosRow[]).filter((r) => videoIn(r));
/** What the phone says after the dwell: these rows (by video media id) are now 80%+ on screen. */
let shown: PhotosRow[] = [];
async function seeOnly(mediaIds: string[]) {
  const data = list().props.data as PhotosRow[];
  const next = data.filter((r) => mediaIds.includes(videoIn(r) ?? ''));
  const token = (r: PhotosRow, isViewable: boolean) => ({ item: r, key: r.key, index: data.indexOf(r), isViewable });
  const changed = [...shown.filter((r) => !next.includes(r)).map((r) => token(r, false)), ...next.filter((r) => !shown.includes(r)).map((r) => token(r, true))];
  shown = next;
  const { onViewableItemsChanged } = viewability();
  await act(async () => { onViewableItemsChanged({ viewableItems: next.map((r) => token(r, true)), changed }); });
}
beforeEach(() => { shown = []; });
const tick = async (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });
const playerFor = (mediaId: string) => players().find((p) => JSON.stringify(p.source).includes(mediaId));

describe('AUTO-9 Feed uses the one constant', () => {
  it('AUTO-9 Feed\'s list passes AUTOPLAY_VIEWABILITY itself (80 / 1000 / waitForInteraction), not a copy', async () => {
    await feed();
    expect(viewability().viewabilityConfig).toBe(AUTOPLAY_VIEWABILITY());
  });
});

describe('AUTO-2 one video plays quietly once she stops on it', () => {
  it('AUTO-2 two videos 80%+ on screen after the still pause: only the top one plays, muted, and only it downloads', async () => {
    await feed();
    const [top, below] = videoRows().map((r) => videoIn(r)!);
    await seeOnly([top!, below!]);
    await waitFor(() => expect(playingNow()).toHaveLength(1));
    const p = playingNow()[0]!;
    expect(JSON.stringify(p.source)).toContain(top!);
    expect(p.muted).toBe(true);
    expect(videoUri.mock.calls.map((c) => c[1])).toEqual([top]);
    expect(screen.getAllByTestId('expo-video-view')).toHaveLength(1); // drawn in the card, not full screen
    expect(screen.queryByRole('button', { name: 'Close the video' })).toBeNull();
  });

  it('AUTO-2 / AUTO-4 the playing card\'s word button reads "Play with sound" (spoken "Play video with sound"); the other keeps "Play"', async () => {
    await feed();
    const [top] = videoRows().map((r) => videoIn(r)!);
    await seeOnly([top!]);
    const btn = await screen.findByRole('button', { name: 'Play video with sound' });
    expect(within(btn).getByText('Play with sound')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Play video with sound' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Play video' })).toHaveLength(1); // the one not playing
  });
});

describe('AUTO-8 nothing downloads before the pause', () => {
  it('AUTO-8 scrolling the Feed with no 1 s still pause: no video file fetched, only posters (thumbs)', async () => {
    const { older, newer } = await feed();
    const l = list();
    for (let y = 0; y < 5; y++) {
      fireEvent(l, 'scrollBeginDrag', { nativeEvent: { contentOffset: { x: 0, y: y * 300 } } });
      fireEvent.scroll(l, { nativeEvent: { contentOffset: { x: 0, y: y * 300 }, contentSize: { height: 3000, width: 360 }, layoutMeasurement: { height: 800, width: 360 } } });
      await tick(400);
    }
    await tick(5000);
    expect(videoUri).not.toHaveBeenCalled();
    expect(playingNow()).toHaveLength(0);
    const forVideos = mediaUri.mock.calls.filter((c) => c[1] === older!.mediaId || c[1] === newer!.mediaId);
    expect(forVideos.every((c) => c[2] === 'thumb')).toBe(true);
  });
});

describe('AUTO-3 pauses when she moves on; loops, never advances', () => {
  it('AUTO-3 the video drops under 80%: it pauses, its file is let go, and nothing else starts', async () => {
    await feed();
    const [top] = videoRows().map((r) => videoIn(r)!);
    await seeOnly([top!]);
    await waitFor(() => expect(playingNow()).toHaveLength(1));
    const p = playingNow()[0]!;
    await seeOnly([]);
    await waitFor(() => expect(p.pause).toHaveBeenCalled());
    expect(playingNow()).toHaveLength(0);
    expect(release).toHaveBeenCalledWith(top);
  });

  it('AUTO-3 scrolled away before the file arrived: the unfinished download is stopped (its signal aborted)', async () => {
    await feed();
    const [top] = videoRows().map((r) => videoIn(r)!);
    let signal: AbortSignal | undefined;
    videoUri.mockImplementation((_p, _m, o) => { signal = o?.signal; return new Promise<string>(() => {}); });
    await seeOnly([top!]);
    await waitFor(() => expect(videoUri).toHaveBeenCalledTimes(1));
    expect(signal).toBeDefined();
    expect(signal!.aborted).toBe(false);
    await seeOnly([]);
    await waitFor(() => expect(signal!.aborted).toBe(true));
    expect(players()).toHaveLength(0);
  });

  it('AUTO-3 the list moves again: it pauses at once, and plays again only after 1 s still', async () => {
    await feed();
    const [top] = videoRows().map((r) => videoIn(r)!);
    await seeOnly([top!]);
    await waitFor(() => expect(playingNow()).toHaveLength(1));
    const p = playingNow()[0]!;
    const plays = p.play.mock.calls.length;
    fireEvent(list(), 'scrollBeginDrag', { nativeEvent: { contentOffset: { x: 0, y: 10 } } });
    expect(p.pause).toHaveBeenCalled();
    expect(p.playing).toBe(false);
    fireEvent(list(), 'scrollEndDrag', { nativeEvent: { contentOffset: { x: 0, y: 12 } } });
    await tick(999);
    expect(p.play.mock.calls.length).toBe(plays);
    await tick(1);
    expect(p.play.mock.calls.length).toBe(plays + 1);
    expect(p.muted).toBe(true);
  });

  it('AUTO-3 at its end it loops quietly and never moves on to the next video', async () => {
    await feed();
    const [top, below] = videoRows().map((r) => videoIn(r)!);
    await seeOnly([top!, below!]);
    await waitFor(() => expect(playingNow()).toHaveLength(1));
    const p = playingNow()[0]!;
    expect(p.loop).toBe(true);
    await act(async () => { p.__emit('playToEnd'); });
    await tick(3000);
    expect(videoUri.mock.calls.map((c) => c[1])).toEqual([top]); // the next one is never fetched
    expect(playerFor(below!)).toBeUndefined();
    expect(p.muted).toBe(true);
  });
});

describe('AUTO-4 tap for the full-screen player with sound', () => {
  it('AUTO-4 "Play with sound" opens the full-screen player (VID-18) with sound from the start; the quiet one pauses', async () => {
    const { nav } = await feed();
    const [top] = videoRows().map((r) => videoIn(r)!);
    await seeOnly([top!]);
    await waitFor(() => expect(playingNow()).toHaveLength(1));
    const quiet = playingNow()[0]!;
    fireEvent.press(await screen.findByRole('button', { name: 'Play video with sound' }));
    expect(await screen.findByRole('button', { name: 'Close the video' })).toBeTruthy();
    const full = players()[players().length - 1]!;
    expect(full).not.toBe(quiet);
    await waitFor(() => expect(full.play).toHaveBeenCalled());
    expect(full.muted).toBe(false);
    expect(quiet.playing).toBe(false);
    expect(nav.openViewer).not.toHaveBeenCalled();
  });

  it('AUTO-4 tapping the playing video itself opens the same full-screen player with sound (not the post screen)', async () => {
    const { nav } = await feed();
    const [top] = videoRows().map((r) => videoIn(r)!);
    await seeOnly([top!]);
    await waitFor(() => expect(playingNow()).toHaveLength(1));
    fireEvent.press(screen.getAllByRole('button', { name: /^Open video \d+ of \d+ full screen/ })[0]!);
    expect(await screen.findByRole('button', { name: 'Close the video' })).toBeTruthy();
    expect(players()[players().length - 1]!.muted).toBe(false);
    expect(nav.openViewer).not.toHaveBeenCalled();
  });
});

describe('AUTO-5 off, reduce motion or Save data: poster and Play only, nothing fetched until Play', () => {
  async function expectPosterOnly() {
    const [top] = videoRows().map((r) => videoIn(r)!);
    await seeOnly([top!]);
    await tick(3000);
    expect(videoUri).not.toHaveBeenCalled();
    expect(players()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Play video with sound' })).toBeNull();
    const play = screen.getAllByRole('button', { name: 'Play video' });
    expect(within(play[0]!).getByText('Play')).toBeTruthy();
    jest.useRealTimers();
    fireEvent.press(play[0]!); // Play still works: now it fetches, full screen, with sound
    expect(await screen.findByRole('button', { name: 'Close the video' })).toBeTruthy();
    expect(videoUri).toHaveBeenCalledTimes(1);
  }

  it('AUTO-5 "Play videos as I scroll" off', async () => {
    await feed({ dataPrefs: { autoplay: false, saveData: false } });
    await expectPosterOnly();
  });

  it('AUTO-5 the phone\'s reduce motion on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await feed();
    await expectPosterOnly();
  });

  it('AUTO-5 Save data on (autoplay itself still saved as on)', async () => {
    await feed({ dataPrefs: { autoplay: true, saveData: true } });
    await expectPosterOnly();
  });

  it('AUTO-5 control: with autoplay on and nothing else, the same steps do play (so the three above are real)', async () => {
    await feed({ dataPrefs: { autoplay: true, saveData: false } });
    const [top] = videoRows().map((r) => videoIn(r)!);
    await seeOnly([top!]);
    await waitFor(() => expect(playingNow()).toHaveLength(1));
  });
});

describe('AUTO-6 the Gallery grid never autoplays', () => {
  it('AUTO-6 Gallery with videos, scrolled and left still: posters only, no video fetched, nothing plays', async () => {
    const { be, older, newer } = await family();
    await renderApp(<PhotosScreen mode="gallery" />, { be, user: 'jo' });
    await waitFor(() => expect(mediaUri.mock.calls.some((c) => c[1] === older.mediaId || c[1] === newer.mediaId)).toBe(true));
    jest.useFakeTimers();
    const scroll = screen.getByTestId('gallery-scroll');
    fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y: 400 }, contentSize: { height: 3000, width: 360 }, layoutMeasurement: { height: 800, width: 360 } } });
    await tick(5000);
    expect(videoUri).not.toHaveBeenCalled();
    expect(players()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Play video with sound' })).toBeNull();
    expect(screen.queryByTestId('expo-video-view')).toBeNull();
  });
});
