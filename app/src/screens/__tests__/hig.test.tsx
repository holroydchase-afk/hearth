// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// HIG-1..12 (Chase, Nov 6 2026: "handle all the p1s"): the gaps from the Apple design guidelines sweep,
// doc "Hearth vs Apple's design guidelines". Each test names its HIG ID.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo, Modal, Platform, Text } from 'react-native';
import appJson from '../../../app.json';
import { FakeBackend } from '../../api/fake/FakeBackend';
import { pushStatus, registerForPush } from '../../notify/push';
import { haptic } from '../../platform/haptics';
import { seedPost } from '../../test/seed';
import { renderApp } from '../../test/renderApp';
import { sheetPan } from '../../ui/kit';
import { contrast, iconSize, LABEL_SCALE_CAP, paletteFor, COLOR_NAMES, pinchZoom, sheetShouldClose } from '../../ui/theme';
import { HearthTabBar } from '../TabBar';
import { PhotosScreen } from '../PhotosScreen';
import { ViewerScreen } from '../ViewerScreen';

jest.mock('../../platform/haptics', () => ({ haptic: jest.fn() }));

const push = { status: jest.mocked(pushStatus), register: jest.mocked(registerForPush) };

beforeEach(() => {
  jest.mocked(haptic).mockClear();
  push.register.mockClear();
  push.status.mockReset();
  push.status.mockResolvedValue('undetermined');
  // The phone's settings start off in every test (the RN mock keeps a value set by an earlier test).
  for (const k of ['isReduceMotionEnabled', 'isDarkerSystemColorsEnabled', 'isHighTextContrastEnabled'] as const) {
    jest.spyOn(AccessibilityInfo, k).mockResolvedValue(false);
  }
});

afterEach(() => jest.restoreAllMocks());

describe('HIG-1 notifications are asked for after the first photo, with a Hearth card first', () => {
  it('HIG-1 opening the app never pops up the phone\'s "Allow notifications?" on its own', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'At the lake' });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    await screen.findByText('At the lake');
    await waitFor(() => expect(push.register).toHaveBeenCalled());
    for (const call of push.register.mock.calls) expect(call[0]).toEqual({ ask: false });
  });

  it('HIG-1 the card explains, its one button asks the phone, and it goes away after', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'At the lake' });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const card = await screen.findByTestId('push-ask');
    expect(within(card).getByText('Get a notice when the family shares photos?')).toBeTruthy();
    expect(within(card).getByText(/Your phone will ask next/)).toBeTruthy();
    push.register.mockResolvedValueOnce(null);
    fireEvent.press(within(card).getByRole('button', { name: 'Turn on notices' }));
    await waitFor(() => expect(push.register).toHaveBeenLastCalledWith({ ask: true }));
    await waitFor(() => expect(screen.queryByTestId('push-ask')).toBeNull());
  });

  it('HIG-1 Not now hides it for good, and it never shows with no photos yet or once decided', async () => {
    const be = FakeBackend.withFixture();
    const { kv } = await renderApp(<PhotosScreen />, { be, user: 'jo' });
    await screen.findByText(/No photos yet/);
    expect(screen.queryByTestId('push-ask')).toBeNull(); // nothing to be told about yet
    screen.unmount();

    await seedPost(be, { caption: 'At the lake' });
    await renderApp(<PhotosScreen />, { be, user: 'jo', kv });
    fireEvent.press(within(await screen.findByTestId('push-ask')).getByRole('button', { name: 'Not now, maybe later' }));
    await waitFor(() => expect(screen.queryByTestId('push-ask')).toBeNull());
    screen.unmount();

    await renderApp(<PhotosScreen />, { be, user: 'jo', kv });
    await screen.findByText('At the lake');
    expect(screen.queryByTestId('push-ask')).toBeNull();
    screen.unmount();

    push.status.mockResolvedValue('denied');
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    await screen.findByText('At the lake');
    expect(screen.queryByTestId('push-ask')).toBeNull();
  });
});

describe('HIG-2 / BETA-SEE-4 photos zoom', () => {
  async function viewer() {
    const be = FakeBackend.withFixture();
    const p = await seedPost(be, { caption: 'Two at the lake', photos: 2 });
    await renderApp(<ViewerScreen postId={p.id} index={0} />, { be, user: 'jo' });
    await screen.findByText('Photo 1 of 2');
  }

  it('HIG-2 a Zoom button zooms in and back out (never gesture-only, DS-4)', async () => {
    await viewer();
    expect(screen.queryByTestId('viewer-zoomed')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Zoom in' }));
    expect(await screen.findByTestId('viewer-zoomed')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Zoom out' }));
    await waitFor(() => expect(screen.queryByTestId('viewer-zoomed')).toBeNull());
  });

  it('HIG-2 a double tap on the photo zooms, and the next photo starts unzoomed', async () => {
    await viewer();
    const photo = screen.getByTestId('viewer-photo');
    fireEvent.press(photo);
    fireEvent.press(photo);
    expect(await screen.findByTestId('viewer-zoomed')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Next photo' }));
    expect(await screen.findByText('Photo 2 of 2')).toBeTruthy();
    expect(screen.queryByTestId('viewer-zoomed')).toBeNull();
  });

  it('HIG-2 the photo can be pinched on iPhone (the scroll view zooms up to 4x)', async () => {
    await viewer();
    expect(screen.getByTestId('viewer-pinch').props.maximumZoomScale).toBe(4);
  });
});

describe('HIG-3 / HIG-11 the biggest text sizes', () => {
  it('HIG-3 tab words stop growing at 1.5x and the tab shows the large pop-up label', async () => {
    await renderApp(<HearthTabBar role="owner" current="photos" onNavigate={() => {}} />, { user: 'chase' });
    const word = screen.getByText('Photos');
    expect(word.props.maxFontSizeMultiplier).toBe(LABEL_SCALE_CAP);
    expect(LABEL_SCALE_CAP).toBe(1.5);
    const tab = screen.getByRole('tab', { name: 'Photos' });
    expect(tab.props.accessibilityShowsLargeContentViewer).toBe(true);
    expect(tab.props.accessibilityLargeContentTitle).toBe('Photos');
  });

  it('HIG-3 toolbar words (IconButton) stop growing at 1.5x too', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'At the lake' });
    await renderApp(<PhotosScreen />, { be, user: 'chase' });
    await screen.findByText('At the lake');
    const word = screen.getByText('Messages');
    expect(LABEL_SCALE_CAP).toBe(1.5);
    expect(word.props.maxFontSizeMultiplier).toBe(LABEL_SCALE_CAP);
  });

  it('HIG-11 icons grow with the phone\'s text size, up to the same cap', () => {
    expect(iconSize(28, 1)).toBe(28);
    expect(iconSize(28, 1.2)).toBe(34);
    expect(iconSize(28, 3.1)).toBe(42);
    expect(iconSize(22, 0.8)).toBe(22); // smaller text never shrinks an icon
  });
});

describe('HIG-4 / HIG-5 app.json', () => {
  const expo = appJson.expo as typeof appJson.expo & { ios: { infoPlist: Record<string, unknown> } };
  const splash = expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-splash-screen') as [string, { backgroundColor: string; dark?: { backgroundColor: string } }];

  it('HIG-4 the launch screen is Ember\'s own background, light and dark', () => {
    expect(splash[1].backgroundColor).toBe(paletteFor('ios', false, 'ember').bg);
    expect(splash[1].dark?.backgroundColor).toBe(paletteFor('ios', true, 'ember').bg);
    expect(expo.android.adaptiveIcon.backgroundColor).toBe(paletteFor('android', false, 'ember').bg);
  });

  it('HIG-5 iPad turns every way; iPhone stays upright', () => {
    expect(expo.orientation).toBe('portrait');
    expect(expo.ios.infoPlist['UISupportedInterfaceOrientations~ipad']).toEqual([
      'UIInterfaceOrientationPortrait',
      'UIInterfaceOrientationPortraitUpsideDown',
      'UIInterfaceOrientationLandscapeLeft',
      'UIInterfaceOrientationLandscapeRight',
    ]);
  });
});

describe('HIG-7 Increase Contrast', () => {
  it('HIG-7 every color has a high-contrast set: secondary words 7:1 and edges 4.5:1', () => {
    for (const color of COLOR_NAMES) {
      for (const dark of [false, true]) {
        const c = paletteFor('ios', dark, color, true);
        const normal = paletteFor('ios', dark, color);
        expect({ color, dark, muted: contrast(c.muted, c.bg) >= 7 }).toEqual({ color, dark, muted: true });
        expect({ color, dark, line: contrast(c.line, c.surface) >= 4.5 }).toEqual({ color, dark, line: true });
        expect({ color, dark, accent: contrast(c.accent, c.bg) > contrast(normal.accent, normal.bg) }).toEqual({ color, dark, accent: true });
        expect({ color, dark, onAccent: contrast(c.accentInk, c.accent) >= 7 }).toEqual({ color, dark, onAccent: true });
      }
    }
  });

  it('HIG-7 the screen switches when the phone\'s Increase Contrast is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'isHighTextContrastEnabled').mockResolvedValue(true);
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'At the lake' });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const high = paletteFor('ios', false, 'ember', true);
    const normal = paletteFor('ios', false, 'ember');
    expect(high.muted).not.toBe(normal.muted);
    const colors = () => screen.UNSAFE_getAllByType(Text).map((t) =>
      ([t.props.style].flat(5).filter(Boolean).reduce((a: object, b: object) => ({ ...a, ...b }), {}) as { color?: string }).color);
    await waitFor(() => expect(colors()).toContain(high.muted));
    expect(colors()).not.toContain(normal.muted);
  });
});

describe('HIG-8 Reduce Motion', () => {
  it('HIG-8 sheets fade instead of sliding when Reduce Motion is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'At the lake' });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    await screen.findByText('At the lake');
    await act(async () => { await Promise.resolve(); });
    fireEvent.press(screen.getByRole('button', { name: 'More for this photo' }));
    await screen.findByText('Who can see this');
    const modals = screen.UNSAFE_getAllByType(Modal);
    expect(modals.map((m) => m.props.animationType)).toEqual(['fade']);
  });

  it('HIG-8 and slide when it is off', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'At the lake' });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    await screen.findByText('At the lake');
    fireEvent.press(screen.getByRole('button', { name: 'More for this photo' }));
    await screen.findByText('Who can see this');
    expect(screen.UNSAFE_getAllByType(Modal).map((m) => m.props.animationType)).toEqual(['slide']);
  });
});

describe('HIG-9 VoiceOver says who sent a photo and when', () => {
  it('HIG-9 a photo reads its place, the sender and the day', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'At the lake', photos: 2 });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    await screen.findByText('At the lake');
    expect(await screen.findByRole('button', { name: /^Open photo 1 of 2 full screen, from Chase, \w{3}, \w{3} \d{1,2}$/ })).toBeTruthy();
  });
});

describe('HIG-10 bottom sheets have a grabber and close with a swipe down', () => {
  it('HIG-10 More and Who can see this show a grabber, and keep their Close button', async () => {
    const be = FakeBackend.withFixture();
    const p = await seedPost(be, { caption: 'At the lake' });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    await screen.findByText('At the lake');
    fireEvent.press(screen.getByRole('button', { name: 'More for this photo' }));
    expect(within(await screen.findByTestId(`more-${p.id}`)).getByTestId('sheet-grabber', { includeHiddenElements: true })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Close this menu' }));
    fireEvent.press(await screen.findByTestId(`who-${p.id}`));
    expect(within(await screen.findByTestId(`who-sheet-${p.id}`)).getByTestId('sheet-grabber', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close who can see this' })).toBeTruthy();
  });

  it('HIG-10 a drag down of 80 pt, or a quick flick, closes; a small nudge does not', () => {
    expect(sheetShouldClose(100, 0.1)).toBe(true);
    expect(sheetShouldClose(30, 1.2)).toBe(true);
    expect(sheetShouldClose(30, 0.2)).toBe(false);
    expect(sheetShouldClose(-120, 0)).toBe(false);
  });
});

describe('HIG-12 haptics', () => {
  it('HIG-12 a reaction gives a light tap', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'At the lake' });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    await screen.findByText('At the lake');
    fireEvent.press(screen.getByRole('button', { name: 'Love it' }));
    expect(haptic).toHaveBeenCalledWith('tap');
  });

  it('HIG-12 Save to my phone gives a success feel once saved', async () => {
    const be = FakeBackend.withFixture();
    const p = await seedPost(be, { caption: 'At the lake' });
    await renderApp(<ViewerScreen postId={p.id} index={0} />, { be, user: 'jo' });
    fireEvent.press(await screen.findByRole('button', { name: 'Save to my phone' }));
    await screen.findByText('Saved to your phone.');
    expect(haptic).toHaveBeenCalledWith('success');
  });
});

// QA-R1..R4 (qa-tdd, Nov 6): gaps the first round's tests left open.
describe('QA-R1 HIG-2 pinch works on Android and the web too', () => {
  it('QA-R1 spreading two fingers zooms in, pinching them together zooms out, a small move changes nothing', () => {
    expect(pinchZoom(1.4, false)).toBe(true);
    expect(pinchZoom(0.7, true)).toBe(false);
    expect(pinchZoom(1.1, false)).toBe(false);
    expect(pinchZoom(0.9, true)).toBe(true);
  });

  it('QA-R1 the viewer listens for two fingers off iPhone', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const be = FakeBackend.withFixture();
    const p = await seedPost(be, { caption: 'At the lake' });
    await renderApp(<ViewerScreen postId={p.id} index={0} />, { be, user: 'jo' });
    const area = await screen.findByTestId('viewer-gestures');
    const twoFingers = { nativeEvent: { touches: [{ pageX: 0, pageY: 0 }, { pageX: 100, pageY: 0 }] }, touchHistory: { touchBank: [] } };
    expect(area.props.onMoveShouldSetResponderCapture(twoFingers)).toBe(true);
  });
});

describe('QA-R2 HIG-10 dragging a sheet down closes it', () => {
  it('QA-R2 a release 100 pt down calls close; a nudge does not', () => {
    const close = jest.fn();
    const cfg = sheetPan(() => close());
    cfg.onPanResponderRelease!({} as never, { dy: 20, vy: 0.1 } as never);
    expect(close).not.toHaveBeenCalled();
    cfg.onPanResponderRelease!({} as never, { dy: 100, vy: 0.1 } as never);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('QA-R3 HIG-1 a yes on the phone sends the token to the server', () => {
  it('QA-R3 Turn on notices then Allow registers the push token', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'At the lake' });
    const { api } = await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const sent = jest.spyOn(api, 'registerPushToken');
    push.register.mockResolvedValueOnce('ExponentPushToken[qa-r3]');
    fireEvent.press(within(await screen.findByTestId('push-ask')).getByRole('button', { name: 'Turn on notices' }));
    await waitFor(() => expect(sent).toHaveBeenCalledWith('ExponentPushToken[qa-r3]', expect.any(String)));
  });
});

describe('QA-R4 HIG-8 turning Reduce Motion on while the app is open', () => {
  it('QA-R4 the next sheet fades', async () => {
    const handlers: Record<string, (on: boolean) => void> = {};
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((name: string, fn: (on: boolean) => void) => {
      handlers[name] = fn;
      return { remove: () => {} };
    }) as never);
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'At the lake' });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    await screen.findByText('At the lake');
    expect(handlers.reduceMotionChanged).toBeDefined();
    await act(async () => { handlers.reduceMotionChanged!(true); });
    fireEvent.press(screen.getByRole('button', { name: 'More for this photo' }));
    await screen.findByText('Who can see this');
    expect(screen.UNSAFE_getAllByType(Modal).map((m) => m.props.animationType)).toEqual(['fade']);
  });
});
