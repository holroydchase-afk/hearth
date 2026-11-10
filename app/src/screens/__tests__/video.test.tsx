// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SPEC-MEDIA 4.1: a video post shows its poster with a visible "Play" word button (VID-18), plays full screen
// in place, says plain words with Try again when it can't play (VID-20), and a bulk pick sends videos when
// video_posting is on (VID-21). Words are drafts (grandparent-ux E12 owns them).
//
// Seams the engineer builds: a VideoPoster (poster + Play button, used by PhotoCollage and ViewerScreen) and a
// full-screen VideoPlayer (expo-video VideoView, opened in place with a "Close the video" button), fed by
// MediaCache.videoUri(postId, mediaId) -> a local .mp4 uri. expo-video is the stand-in in jest.setup.js.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { ActivityIndicator } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { MediaCache } from '../../media/cache';
import { saveLastAudience } from '../../share/audienceMemory';
import type { PickedAsset } from '../../share/bulk';
import { memoryKV } from '../../platform/kv';
import { expectGrandparentSafe, renderApp } from '../../test/renderApp';
import { seedPost, seedVideoPost } from '../../test/seed';
import { PhotosScreen } from '../PhotosScreen';
import { ShareScreen } from '../ShareScreen';
import { ViewerScreen } from '../ViewerScreen';

type Player = { source: unknown; muted: boolean; play: jest.Mock; __emit(e: string, p: unknown): void };
const players = (): Player[] => (jest.requireMock('expo-video') as { __players: Player[] }).__players;
const lastPlayer = (): Player => players()[players().length - 1]!;

// GUX-R4 (grandparent-ux, Nov 10) replaced the draft words; Jo's helper is Chase (her inviter).
const CANT_PLAY = `This video won't play right now. It may be the signal. Tap Try again, or call ${FIXTURE.users.chase.name}.`;
const LOCAL = 'file:///cache/video/clip.mp4';

// MediaCache.videoUri is new: give the prototype a stand-in that says so, then spy on it either way.
type WithVideo = { videoUri(postId: string, mediaId: string): Promise<string> };
const proto = MediaCache.prototype as unknown as Partial<WithVideo>;
if (typeof proto.videoUri !== 'function') proto.videoUri = () => Promise.reject(new Error('MediaCache.videoUri not built'));
let videoUri: jest.SpyInstance<Promise<string>, [string, string]>;
beforeEach(() => {
  players().length = 0;
  videoUri = jest.spyOn(MediaCache.prototype as unknown as WithVideo, 'videoUri').mockResolvedValue(LOCAL);
});
afterEach(() => jest.restoreAllMocks());

async function videoFamily() {
  const be = FakeBackend.withFixture();
  await seedPost(be, { caption: 'A photo too', circles: [FIXTURE.circles.dadSide.id] });
  const v = await seedVideoPost(be, { caption: 'Leo on the slide', circles: [FIXTURE.circles.dadSide.id] });
  return { be, v };
}

function expectNoSoundOnOpen() {
  const p = lastPlayer();
  expect({ autoplayedWithSound: p.play.mock.calls.length > 0 && !p.muted }).toEqual({ autoplayedWithSound: false });
}

describe('VID-18 poster and Play button', () => {
  it('VID-18 on Photos: the poster shows with a visible "Play" word button (Play video); tapping it opens the full-screen player', async () => {
    const { be } = await videoFamily();
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    expect(await screen.findByText('Leo on the slide')).toBeTruthy();
    const play = await screen.findByRole('button', { name: 'Play video' });
    expect(within(play).getByText('Play')).toBeTruthy(); // a word, not only an icon
    expectGrandparentSafe(); // 48 pt target, 17 pt text, labeled
    fireEvent.press(play);
    expect(await screen.findByTestId('expo-video-view')).toBeTruthy();
    expect(JSON.stringify(lastPlayer().source)).toContain('.mp4');
    expectNoSoundOnOpen();
    expect(screen.getByRole('button', { name: 'Close the video' })).toBeTruthy();
    expectGrandparentSafe();
  });

  it('VID-18 Close leaves the player and returns to the same Photos screen', async () => {
    const { be } = await videoFamily();
    const { nav } = await renderApp(<PhotosScreen />, { be, user: 'jo' });
    fireEvent.press(await screen.findByRole('button', { name: 'Play video' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Close the video' }));
    await waitFor(() => expect(screen.queryByTestId('expo-video-view')).toBeNull());
    expect(screen.getByRole('button', { name: 'Play video' })).toBeTruthy();
    expect(nav.close).not.toHaveBeenCalled();
  });

  it('VID-18 on the post screen (full-screen viewer): the same Play video button opens the player', async () => {
    const { be, v } = await videoFamily();
    await renderApp(<ViewerScreen postId={v.id} index={0} />, { be, user: 'jo' });
    const play = await screen.findByRole('button', { name: 'Play video' });
    expect(within(play).getByText('Play')).toBeTruthy();
    fireEvent.press(play);
    expect(await screen.findByTestId('expo-video-view')).toBeTruthy();
    expect(videoUri).toHaveBeenCalledWith(v.id, v.mediaId);
  });

  it('VID-18 privacy both ways: Nana Ruth (not in the group) sees no video post and no Play button', async () => {
    const { be } = await videoFamily();
    await renderApp(<PhotosScreen />, { be, user: 'ruth' });
    await waitFor(() => expect(screen.queryByTestId('app-loading')).toBeNull());
    expect(screen.queryByText('Leo on the slide')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Play video' })).toBeNull();
    expect(videoUri).not.toHaveBeenCalled();
  });
});

describe('VID-20 a video that will not play', () => {
  it('VID-20 the file can\'t be fetched or decrypted: plain words and Try again, never a blank or spinning screen; Try again works', async () => {
    const { be } = await videoFamily();
    videoUri.mockRejectedValueOnce(new Error('decrypt failed'));
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    fireEvent.press(await screen.findByRole('button', { name: 'Play video' }));
    expect(await screen.findByText(CANT_PLAY)).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
    const again = screen.getByRole('button', { name: 'Try again' });
    expectGrandparentSafe();
    fireEvent.press(again);
    expect(await screen.findByTestId('expo-video-view')).toBeTruthy();
    expect(videoUri).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(CANT_PLAY)).toBeNull();
  });

  it('VID-20 the player errors: the same plain words and Try again', async () => {
    const { be } = await videoFamily();
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    fireEvent.press(await screen.findByRole('button', { name: 'Play video' }));
    await screen.findByTestId('expo-video-view');
    act(() => lastPlayer().__emit('statusChange', { status: 'error', error: { message: 'codec' } }));
    expect(await screen.findByText(CANT_PLAY)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
  });
});

describe('VID-21 bulk pick with videos', () => {
  let n = 0;
  const photo = (date: string): PickedAsset => ({
    uri: `file:///picked/IMG_${++n}.jpg`, type: 'image', mimeType: 'image/jpeg', width: 4032, height: 3024,
    exif: { DateTimeOriginal: date, OffsetTimeOriginal: '-04:00' },
  });
  const video = (): PickedAsset => ({ uri: `file:///picked/MOV_${++n}.mov`, type: 'video', mimeType: 'video/quicktime', width: 1280, height: 720, duration: 12_000 });
  const assets = () => [photo('2024:07:04 09:00:00'), video(), photo('2024:07:04 10:00:00'), video(), video()];

  function videoOn(): FakeBackend {
    const be = FakeBackend.withFixture();
    be.state.featureFlags = { video_posting: true };
    be.state.spaceFeatures = { [`${FIXTURE.space.id}:video_posting`]: true };
    return be;
  }

  async function review(be: FakeBackend) {
    const kv = memoryKV();
    await saveLastAudience(kv, FIXTURE.users.chase.id, [FIXTURE.circles.dadSide.id]);
    const pickBulk = jest.fn(async () => ({ assets: assets() }));
    const r = await renderApp(<ShareScreen />, { user: 'chase', be, kv, deps: { pickBulk } });
    fireEvent.press(await screen.findByRole('button', { name: /^Pick up to 100/ }));
    await screen.findByText(`Send to: ${"Grandparents – Dad's side"}`);
    return r;
  }

  it('VID-21 video_posting on: the 3 videos are prepared and sent, and there is no left-out message', async () => {
    const be = videoOn();
    const { deps, nav } = await review(be);
    expect(screen.queryByText(/left out/)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: /^Send \d+/ }));
    await waitFor(() => expect(nav.goPhotos).toHaveBeenCalled());
    await waitFor(() => expect((deps.prepare as jest.Mock).mock.calls.length).toBe(5), { timeout: 5000 });
    const kinds = (deps.prepare as jest.Mock).mock.calls.map(([i]) => i.kind);
    expect(kinds.filter((k) => k === 'video')).toHaveLength(3);
    expect((deps.prepare as jest.Mock).mock.calls.map(([i]) => i).filter((i) => i.kind === 'video'))
      .toEqual(Array(3).fill(expect.objectContaining({ durationMs: 12_000, width: 1280, height: 720 })));
  });

  it('VID-21 video_posting off: BETA-BULK-5\'s line is unchanged and the videos are not prepared', async () => {
    const { deps, nav } = await review(FakeBackend.withFixture());
    expect(screen.getByText("Hearth can't send videos yet, so 3 videos were left out.")).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /^Send \d+/ }));
    await waitFor(() => expect(nav.goPhotos).toHaveBeenCalled());
    await waitFor(() => expect((deps.prepare as jest.Mock).mock.calls.length).toBe(2), { timeout: 5000 });
    expect((deps.prepare as jest.Mock).mock.calls.every(([i]) => i.kind === 'photo')).toBe(true);
  });
});
