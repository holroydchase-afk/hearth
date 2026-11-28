// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// HRT-WEB.4 (docs/product/SPEC-WEB-APP.md, WEB-APP-39, -40, -42, -45; ARCH-WEB4-R3, R4): notices on the web build.
// Written first: red until Preferences has a web path, serverPrefs knows web, /p/[id] exists and the path is kept
// across sign-in. Platform.OS is switched to 'web' per test with jest.replaceProperty.
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { getMockContext } from 'expo-router/testing-library';
import React from 'react';
import { Platform, Text } from 'react-native';
import { FakeBackend, FIXTURE } from '../../api/fake/FakeBackend';
import { renderApp, screenWords } from '../../test/renderApp';
import { serverPrefs } from '../../state/prefs';
import { HowToTell } from '../Preferences';

const jo = FIXTURE.users.jo.id;
const space = FIXTURE.space.id;
const EVENING_WEB = "An email every evening with the day's new photos (Recommended)";
const SUNDAY = 'An email every Sunday morning';

let restore: { restore(): void } | null = null;
const onWeb = () => { restore = jest.replaceProperty(Platform, 'OS', 'web'); };
afterEach(() => { restore?.restore(); restore = null; });

describe('WEB-APP-39 the web build offers email choices only', () => {
  it('WEB-APP-39 no sound choice, evening email is picked and says Recommended, Sunday is offered', async () => {
    onWeb();
    await renderApp(<HowToTell />, { user: 'jo' });
    await screen.findByText('How should we tell you about new photos?');
    expect(screen.queryByRole('radio', { name: /sound/i })).toBeNull();
    const evening = await screen.findByRole('radio', { name: EVENING_WEB });
    expect(evening.props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByRole('radio', { name: SUNDAY })).toBeTruthy();
  });

  it('WEB-APP-39 no word on screen says "sound" or "on your phone"', async () => {
    onWeb();
    await renderApp(<HowToTell />, { user: 'jo' });
    await screen.findByRole('radio', { name: EVENING_WEB });
    expect(screenWords()).not.toMatch(/sound|on your phone/i);
  });

  it('WEB-APP-39 the phone build is unchanged: the sound choice is there and Recommended', async () => {
    await renderApp(<HowToTell />, { user: 'jo' });
    expect(await screen.findByRole('radio', { name: 'A sound on your phone when there are new photos (Recommended)' })).toBeTruthy();
  });
});

describe('WEB-APP-40 on web a saved choice is email on the server, never push', () => {
  it('WEB-APP-40 serverPrefs on web never says push: true (a saved "push" becomes the evening email)', () => {
    onWeb();
    expect(serverPrefs('push')).toEqual({ push: false, emailDigest: 'daily' });
    expect(serverPrefs('evening')).toEqual({ push: false, emailDigest: 'daily' });
    expect(serverPrefs('sunday')).toEqual({ push: false, emailDigest: 'weekly' });
  });

  it('WEB-APP-40 choosing Sunday saves push: false and weekly, and the saved line names email', async () => {
    onWeb();
    const { be } = await renderApp(<HowToTell />, { user: 'jo' });
    fireEvent.press(await screen.findByRole('radio', { name: SUNDAY }));
    await waitFor(() => expect(be.state.notifyPrefs?.[`${jo}:${space}`]).toEqual({ push: false, emailDigest: 'weekly' }));
    expect(await screen.findByText("Saved. We'll email you on Sunday mornings when there are new photos.")).toBeTruthy();
  });

  it('WEB-APP-40 a web person who never chose is saved as the evening email when she taps it (not skipped as "already picked")', async () => {
    onWeb();
    const { be } = await renderApp(<HowToTell />, { user: 'jo' });
    fireEvent.press(await screen.findByRole('radio', { name: EVENING_WEB }));
    await waitFor(() => expect(be.state.notifyPrefs?.[`${jo}:${space}`]).toEqual({ push: false, emailDigest: 'daily' }));
    expect(await screen.findByText("Saved. We'll email you every evening when there are new photos.")).toBeTruthy();
  });
});

describe('WEB-APP-45 a text-sign-in account on web is told plainly, with no broken choice', () => {
  async function phoneMember(be: FakeBackend): Promise<string> {
    const api = be.clientFor(null) as unknown as { verifyTextCode(p: string, c: string): Promise<{ userId: string }> };
    const { FAKE_OTP } = require('../../api/fake/FakeBackend') as typeof import('../../api/fake/FakeBackend');
    const id = (await api.verifyTextCode('+13045550100', FAKE_OTP)).userId;
    const { code } = await be.clientFor(FIXTURE.users.chase.id).createInvite({ space, role: 'viewer', circleIds: [FIXTURE.circles.dadSide.id], history: 'all' });
    await be.clientFor(id).redeemInvite(code);
    return id;
  }

  it('WEB-APP-45 one line says she signed in with a text so Hearth cannot email her; no radio, no phone-sound line', async () => {
    const prev = process.env.EXPO_PUBLIC_HEARTH_SMS;
    process.env.EXPO_PUBLIC_HEARTH_SMS = '1';
    try {
      onWeb();
      const be = FakeBackend.withFixture();
      const id = await phoneMember(be);
      await renderApp(<HowToTell />, { be, userId: id });
      expect(await screen.findByText(/You signed in with a text, so Hearth can't email you\./)).toBeTruthy();
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      expect(screenWords()).not.toMatch(/sound|tells you about new photos on this phone/i);
    } finally {
      if (prev === undefined) delete process.env.EXPO_PUBLIC_HEARTH_SMS; else process.env.EXPO_PUBLIC_HEARTH_SMS = prev;
    }
  });
});

// ---- WEB-APP-42 (jest part): /p/<id> is the email's link (ARCH-WEB4-R3) and the path survives sign-in (R4) ----
const POST = '55555555-0000-0000-0000-0000000000a1';

function ProbeViewer() {
  const { useLocalSearchParams } = require('expo-router') as typeof import('expo-router');
  const { postId } = useLocalSearchParams<{ postId: string }>();
  return <Text>viewer opened for {String(postId)}</Text>;
}

describe('WEB-APP-42 /p/<id> opens that post', () => {
  it('WEB-APP-42 ARCH-WEB4-R3 /p/<id> is a route that redirects to /viewer/<id>', async () => {
    const pRoute = require('../../app/p/[id]') as { default: React.ComponentType }; // red: the file does not exist yet
    const ctx = getMockContext({
      _layout: { default: () => { const { Stack } = require('expo-router') as typeof import('expo-router'); return <Stack screenOptions={{ headerShown: false }} />; } },
      'p/[id]': pRoute,
      'viewer/[postId]': { default: ProbeViewer },
    } as never);
    render(<ExpoRoot context={ctx} location={`/p/${POST}`} />);
    expect(await screen.findByText(`viewer opened for ${POST}`)).toBeTruthy();
  });

  it('WEB-APP-42 ARCH-WEB4-R4 signed out on /p/<id>, tapping Sign in keeps the path for after the 6-digit sign-in (web storage)', async () => {
    onWeb();
    const store = (): Storage => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } } as Storage; };
    const local = store(), session = store();
    Object.defineProperty(globalThis, 'localStorage', { value: local, configurable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: session, configurable: true });
    try {
      const pRoute = require('../../app/p/[id]') as { default: React.ComponentType }; // red until the route exists
      const viewer = require('../../app/viewer/[postId]') as { default: React.ComponentType };
      const ctx = getMockContext({
        _layout: { default: () => { const { Stack } = require('expo-router') as typeof import('expo-router'); return <Stack screenOptions={{ headerShown: false }} />; } },
        'p/[id]': pRoute,
        'viewer/[postId]': viewer,
      } as never);
      const { NavContext } = require('../../state/nav') as typeof import('../../state/nav');
      const goSignIn = jest.fn();
      const nav = { openViewer: jest.fn(), close: jest.fn(), goPhotos: jest.fn(), goFeed: jest.fn(), goSignIn, goJoin: jest.fn() };
      await renderApp(<NavContext.Provider value={nav}><ExpoRoot context={ctx} location={`/p/${POST}`} /></NavContext.Provider>, { user: null, waitReady: false });
      fireEvent.press(await screen.findByRole('button', { name: 'Sign in' }));
      expect(goSignIn).toHaveBeenCalled();
      const kept = [local, session].flatMap((s) => Array.from({ length: s.length }, (_, i) => s.getItem(s.key(i)!) ?? ''));
      expect(kept.some((v) => v.includes(POST))).toBe(true); // the path (or at least the post) is kept, not lost
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
      delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    }
  });
});
