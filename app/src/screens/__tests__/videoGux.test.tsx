// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// grandparent-ux review of the video poster and player (Nov 10), four P1s, written first:
//   GUX-R1 where a poster has nothing else to open (post screen, By date), the whole poster is the "Play video" button.
//   GUX-R2 the player is always on the dark palette's own background (never pure black), and its words read at 4.5:1
//          even when the phone is in light mode, for Ember, Sage and Plum.
//   GUX-R3 sound buttons say "Turn sound on" / "Turn sound off"; nothing plays until the person taps Play in the
//          player, and then it plays with sound.
//   GUX-R4 the can't-play words name the person to call, like messageFor's default (errors/messages.ts).
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { Image, Modal, StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { MediaCache } from '../../media/cache';
import { useApp } from '../../state/AppContext';
import { renderApp } from '../../test/renderApp';
import { seedVideoPost } from '../../test/seed';
import { COLOR_NAMES, ColorContext, LookContext, contrast, paletteFor, type ColorName } from '../../ui/theme';
import { PhotosScreen } from '../PhotosScreen';
import { TimelineScreen } from '../TimelineScreen';
import { ViewerScreen } from '../ViewerScreen';

type Player = { source: unknown; muted: boolean; play: jest.Mock; __emit(e: string, p: unknown): void };
const players = (): Player[] => (jest.requireMock('expo-video') as { __players: Player[] }).__players;
const lastPlayer = (): Player => players()[players().length - 1]!;

type WithVideo = { videoUri(postId: string, mediaId: string): Promise<string> };
let videoUri: jest.SpyInstance<Promise<string>, [string, string]>;
beforeEach(() => {
  players().length = 0;
  videoUri = jest.spyOn(MediaCache.prototype as unknown as WithVideo, 'videoUri').mockResolvedValue('file:///cache/video/clip.mp4');
});
afterEach(() => jest.restoreAllMocks());

async function family() {
  const be = FakeBackend.withFixture();
  const v = await seedVideoPost(be, { caption: 'Leo on the slide', circles: [FIXTURE.circles.dadSide.id] });
  return { be, v };
}

/** The one "Play video" button wraps the poster picture itself. */
async function expectWholePosterIsPlay() {
  const plays = await screen.findAllByRole('button', { name: 'Play video' });
  expect(plays).toHaveLength(1);
  await waitFor(() => expect(within(plays[0]!).UNSAFE_queryAllByType(Image).length).toBeGreaterThan(0));
  expect(screen.queryByRole('button', { name: /^Open (the )?video/ })).toBeNull();
  fireEvent.press(plays[0]!);
  expect(await screen.findByTestId('expo-video-view')).toBeTruthy();
}

describe('GUX-R1 the whole poster plays where there is nothing else to open', () => {
  it('GUX-R1 post screen (ViewerScreen): the whole poster is one "Play video" button that opens the player', async () => {
    const { be, v } = await family();
    await renderApp(<ViewerScreen postId={v.id} index={0} />, { be, user: 'jo' });
    await expectWholePosterIsPlay();
  });

  it('GUX-R1 By date (TimelineScreen): the whole poster is one "Play video" button that opens the player', async () => {
    const { be } = await family();
    // TimelineScreen needs the family loaded first, as PhotosScreen does when it opens By date.
    const WhenReady = () => (useApp().status === 'ready' ? <TimelineScreen startAt={null} onClose={jest.fn()} /> : null);
    await renderApp(<WhenReady />, { be, user: 'jo' });
    await expectWholePosterIsPlay();
  });

  it('GUX-R1 Photos keeps both: a small Play at the bottom left, and tapping the rest of the tile opens the post', async () => {
    const { be, v } = await family();
    const { nav } = await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const play = await screen.findByRole('button', { name: 'Play video' });
    expect(within(play).UNSAFE_queryAllByType(Image)).toHaveLength(0);
    fireEvent.press(screen.getByRole('button', { name: 'Open video 1 of 1 full screen' }));
    expect(nav.openViewer).toHaveBeenCalledWith(v.id, 0);
  });
});

// ---- GUX-R2 ----
type Node = ReturnType<typeof screen.UNSAFE_getAllByType>[number];
const flat = (style: unknown) =>
  (StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false, hovered: false }) : style) ?? {}) as Record<string, unknown>;
const HEX = /^#[0-9A-Fa-f]{6}$/;

/** The nearest ancestor with a solid background. */
function backgroundOf(n: Node): string | null {
  for (let p: Node | null = n.parent; p; p = p.parent) {
    const bg = typeof p.type === 'string' ? flat(p.props.style).backgroundColor : undefined;
    if (typeof bg === 'string' && bg !== 'transparent') return bg;
  }
  return null;
}

/** The player's full-screen surface: the first thing with a background inside its Modal. */
function playerRoot(): Node {
  const modal = screen.UNSAFE_getByType(Modal);
  return (modal.findAll((n: Node) => typeof n.type === 'string' && typeof flat(n.props.style).backgroundColor === 'string') as Node[])[0]!;
}

/** Every word inside the player (the modal) against the background it sits on. */
function playerTextPairs(): { text: string; fg: unknown; bg: string | null }[] {
  const root = screen.UNSAFE_getByType(Modal);
  return (root.findAll((n: Node) => n.type === Text) as Node[])
    .filter((t) => typeof t.props.children === 'string')
    .map((t) => ({ text: String(t.props.children), fg: flat(t.props.style).color, bg: backgroundOf(t) }));
}

function Light({ color, children }: { color: ColorName; children: React.ReactNode }) {
  return <LookContext.Provider value="light"><ColorContext.Provider value={color}>{children}</ColorContext.Provider></LookContext.Provider>;
}

describe('GUX-R2 the player is always dark, on the palette\'s own background, and its words read', () => {
  it.each(COLOR_NAMES)('GUX-R2 %s, phone in light mode: player background is the dark palette bg (never #000000); every word >= 4.5:1', async (color) => {
    const dark = paletteFor('ios', true, color);
    const { be, v } = await family();
    await renderApp(<Light color={color}><ViewerScreen postId={v.id} index={0} /></Light>, { be, user: 'jo' });
    fireEvent.press(await screen.findByRole('button', { name: 'Play video' }));
    await screen.findByTestId('expo-video-view');
    const root = playerRoot();
    expect(flat(root.props.style).backgroundColor).toBe(dark.bg);
    const blacks = (root.findAll((n: Node) => typeof n.type === 'string') as Node[]).filter((n) => /^#0{6}$/.test(String(flat(n.props.style).backgroundColor)));
    expect(blacks).toHaveLength(0);
    const pairs = playerTextPairs();
    expect(pairs.length).toBeGreaterThan(0);
    for (const p of pairs) {
      const ok = typeof p.fg === 'string' && HEX.test(p.fg) && typeof p.bg === 'string' && HEX.test(p.bg) && contrast(p.fg, p.bg) >= 4.5;
      expect({ ...p, ok }).toEqual({ ...p, ok: true });
    }
  });

  it.each(COLOR_NAMES)('GUX-R2 %s, light mode, the can\'t-play words and Try again read too', async (color) => {
    const { be, v } = await family();
    videoUri.mockRejectedValue(new Error('offline'));
    await renderApp(<Light color={color}><ViewerScreen postId={v.id} index={0} /></Light>, { be, user: 'jo' });
    fireEvent.press(await screen.findByRole('button', { name: 'Play video' }));
    await screen.findByRole('button', { name: 'Try again' });
    expect(flat(playerRoot().props.style).backgroundColor).toBe(paletteFor('ios', true, color).bg);
    for (const p of playerTextPairs()) {
      const ok = typeof p.fg === 'string' && HEX.test(p.fg) && typeof p.bg === 'string' && HEX.test(p.bg) && contrast(p.fg, p.bg) >= 4.5;
      expect({ ...p, ok }).toEqual({ ...p, ok: true });
    }
  });
});

describe('GUX-R3 one tap plays with sound; nothing plays before it', () => {
  it('GUX-R3 nothing plays before the poster\'s Play; that one tap starts it WITH sound; the sound button says "Turn sound off" / "Turn sound on"', async () => {
    const { be, v } = await family();
    await renderApp(<ViewerScreen postId={v.id} index={0} />, { be, user: 'jo' });
    const play = await screen.findByRole('button', { name: 'Play video' });
    expect(players().filter((x) => x.play.mock.calls.length > 0)).toHaveLength(0); // nothing before the tap
    fireEvent.press(play);
    await screen.findByTestId('expo-video-view');
    const p = lastPlayer();
    await waitFor(() => expect(p.play).toHaveBeenCalledTimes(1)); // one tap, not two
    expect(p.muted).toBe(false);
    fireEvent.press(await screen.findByRole('button', { name: 'Turn sound off' }));
    expect(p.muted).toBe(true);
    fireEvent.press(await screen.findByRole('button', { name: 'Turn sound on' }));
    expect(p.muted).toBe(false);
    expect(screen.queryByRole('button', { name: /Turn the sound/ })).toBeNull();
  });

  it('GUX-R3 nothing on Photos autoplays', async () => {
    const { be } = await family();
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    await screen.findByRole('button', { name: 'Play video' });
    expect(players().filter((x) => x.play.mock.calls.length > 0)).toHaveLength(0);
    expect(screen.queryByTestId('expo-video-view')).toBeNull();
  });
});

describe('GUX-R4 the can\'t-play words say who to call', () => {
  const words = (who: string | null) => `This video won't play right now. It may be the signal. Tap Try again${who ? `, or call ${who}` : ''}.`;

  it('GUX-R4 a grandparent is told to call the person who invited her (her helper)', async () => {
    const { be, v } = await family();
    videoUri.mockRejectedValue(new Error('offline'));
    await renderApp(<ViewerScreen postId={v.id} index={0} />, { be, user: 'jo' });
    fireEvent.press(await screen.findByRole('button', { name: 'Play video' }));
    expect(await screen.findByText(words(FIXTURE.users.chase.name))).toBeTruthy();
  });

  it('GUX-R4 with no one to call (the family\'s owner), the "or call" part is left out', async () => {
    const { be, v } = await family();
    videoUri.mockRejectedValue(new Error('offline'));
    await renderApp(<ViewerScreen postId={v.id} index={0} />, { be, user: 'chase' });
    fireEvent.press(await screen.findByRole('button', { name: 'Play video' }));
    expect(await screen.findByText(words(null))).toBeTruthy();
    expect(screen.queryByText(/or call/)).toBeNull();
  });

  it('GUX-R4 a player error says the same words', async () => {
    const { be, v } = await family();
    await renderApp(<ViewerScreen postId={v.id} index={0} />, { be, user: 'jo' });
    fireEvent.press(await screen.findByRole('button', { name: 'Play video' }));
    await screen.findByTestId('expo-video-view');
    const { act } = require('@testing-library/react-native') as typeof import('@testing-library/react-native');
    act(() => lastPlayer().__emit('statusChange', { status: 'error', error: { message: 'codec' } }));
    expect(await screen.findByText(words(FIXTURE.users.chase.name))).toBeTruthy();
  });
});
