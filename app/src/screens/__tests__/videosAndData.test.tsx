// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEC-86 (SPEC-MEDIA 5, 5.1 final words): More → "Videos and data" (AUTO-1, DATA-2, AUTO-5's reduce-motion line), the
// prepaid question at sign-up (DATA-1), and neither setting ever leaving the phone (DATA-6).
//
// Seams for the engineer:
//   src/state/dataPrefs.ts                  DATA_PREFS_KEY 'hearth.dataPrefs.v1', { autoplay, saveData } (see src/feed/__tests__/autoplay.test.ts)
//   AppContext                              app.dataPrefs: DataPrefs (loaded from deps.kv at start, even signed out) and
//                                           app.setDataPrefs(p: Partial<DataPrefs>): updates at once and saves to deps.kv only
//   MoreScreen                              RowId 'videosData', text "Videos and data", right after "Light or dark",
//                                           path '/more/videos-data', value "Saving data" while Save data is on
//   src/app/(tabs)/more/videos-data.tsx     the page (MoreRowGate row="videosData"), title "Videos and data", two kit
//                                           Choice kind="switch" rows; the autoplay row gets accessibilityState.disabled
//                                           while Save data is on
//   Sign-up question                        after JoinScreen's redeem and SignInScreen's sign-in, when this phone's
//                                           saveData is null: the question instead of nav.goPhotos(); a tap saves and
//                                           then calls nav.goPhotos()
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import type { HearthApi } from '../../api/HearthApi';
import { useApp } from '../../state/AppContext';
import { MoreScreen } from '../../test/redesignScreens';
import { AppRoutes } from '../../test/appRoutes';
import { DATA_PREFS_KEY, expectGrandparentSafe, renderApp } from '../../test/renderApp';
import { seedPost } from '../../test/seed';
import { JoinScreen } from '../JoinScreen';
import { SignInScreen } from '../SignInScreen';

const slow = { timeout: 5000 };
const AUTOPLAY = 'Play videos as I scroll';
const AUTOPLAY_LINE = 'Videos in the Feed play quietly, without sound. Tap one to hear it.';
const SAVE = 'Save data';
const SAVE_LINE = 'For prepaid or small phone plans. Videos wait until you tap Play, and photos load smaller until you open them.';
const OFF_WHILE_SAVING = 'Off while Save data is on.';
const OFF_REDUCE_MOTION = 'Off because your phone is set to reduce motion.';
const Q_TITLE = 'Does your phone plan come with only a little data?';
const Q_LINE = 'Prepaid plans often do. Hearth can use less of it, so it lasts the month.';
const Q_YES = 'Yes, use less data';
const Q_NO = 'No, my plan is fine';
const Q_NOTE = 'Not sure? Tap Yes. You can change this later in More, under Videos and data.';

type A11y = { checked?: boolean; disabled?: boolean; selected?: boolean };
const state = (el: { props: Record<string, unknown> }) => (el.props.accessibilityState ?? {}) as A11y;
const sw = (name: string) => screen.getByRole('switch', { name: new RegExp(`^${name}`) });
const saved = async (kv: { getItem(k: string): Promise<string | null> }) => JSON.parse((await kv.getItem(DATA_PREFS_KEY)) ?? 'null') as { autoplay?: boolean; saveData?: boolean | null } | null;

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});
afterEach(() => jest.restoreAllMocks());

async function openPage(opts: Parameters<typeof renderApp>[1] = {}) {
  const r = await renderApp(<MoreScreen />, { user: 'jo', ...opts });
  expect(await screen.findByRole('header', { name: 'More' }, slow)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: /^Videos and data(,|$)/ }));
  expect(await screen.findByRole('header', { name: 'Videos and data' }, slow)).toBeTruthy();
  return r;
}

describe('AUTO-1 More → Videos and data', () => {
  it('AUTO-1 the "Videos and data" row sits right after "Light or dark", for every role', async () => {
    for (const user of ['chase', 'jo'] as const) {
      const r = await renderApp(<MoreScreen />, { user });
      await screen.findByRole('header', { name: 'More' }, slow);
      const rows = screen.getAllByRole('button').map((b) => String(b.props.accessibilityLabel).split(',')[0]);
      expect(rows.indexOf('Videos and data')).toBe(rows.indexOf('Light or dark') + 1);
      r.unmount();
    }
  });

  it('AUTO-1 a fresh install: the page has "Play videos as I scroll" on and "Save data" off, with 5.1\'s exact words', async () => {
    const { kv } = await openPage({ dataPrefs: null });
    expect(screen.getByText(AUTOPLAY)).toBeTruthy();
    expect(screen.getByText(AUTOPLAY_LINE)).toBeTruthy();
    expect(screen.getByText(SAVE)).toBeTruthy();
    expect(screen.getByText(SAVE_LINE)).toBeTruthy();
    expect(state(sw(AUTOPLAY)).checked).toBe(true);
    expect(state(sw(SAVE)).checked).toBe(false);
    expect(screen.getByRole('button', { name: 'Back to More' })).toBeTruthy();
    expectGrandparentSafe();
    fireEvent.press(sw(AUTOPLAY));
    await waitFor(() => expect(state(sw(AUTOPLAY)).checked).toBe(false));
    await waitFor(async () => expect((await saved(kv))?.autoplay).toBe(false)); // saved on the phone
  });

  it('AUTO-1 the choice is kept: a phone that turned autoplay off opens the page with it off', async () => {
    await openPage({ dataPrefs: { autoplay: false, saveData: false } });
    expect(state(sw(AUTOPLAY)).checked).toBe(false);
  });
});

describe('DATA-2 Save data switch', () => {
  it('DATA-2 Save data on: at once, autoplay shows Off, can\'t be tapped, says "Off while Save data is on."; off puts it back', async () => {
    const { kv } = await openPage();
    fireEvent.press(sw(SAVE));
    await waitFor(() => expect(state(sw(SAVE)).checked).toBe(true));
    expect(state(sw(AUTOPLAY)).checked).toBe(false);
    expect(state(sw(AUTOPLAY)).disabled).toBe(true);
    expect(screen.getByText(OFF_WHILE_SAVING)).toBeTruthy();
    expect(screen.queryByText(AUTOPLAY_LINE)).toBeNull();
    expect(screen.getByText(AUTOPLAY)).toBeTruthy(); // still readable
    fireEvent.press(sw(AUTOPLAY)); // not tappable: nothing changes
    expect(state(sw(AUTOPLAY)).checked).toBe(false);
    await waitFor(async () => expect(await saved(kv)).toEqual({ autoplay: true, saveData: true })); // autoplay remembered underneath
    fireEvent.press(sw(SAVE));
    await waitFor(() => expect(state(sw(SAVE)).checked).toBe(false));
    expect(state(sw(AUTOPLAY)).checked).toBe(true);
    expect(state(sw(AUTOPLAY)).disabled).toBeFalsy();
    expect(screen.getByText(AUTOPLAY_LINE)).toBeTruthy();
  });

  it('DATA-2 no restart: the app\'s dataPrefs change the moment the switch is pressed; More\'s row then says "Saving data"', async () => {
    function Probe() {
      const app = useApp() as unknown as { dataPrefs?: { saveData?: boolean | null } };
      return <Text testID="probe">{`saveData:${String(app.dataPrefs?.saveData)}`}</Text>;
    }
    await renderApp(<><AppRoutes at="/more/videos-data" /><Probe /></>, { user: 'jo' });
    expect(await screen.findByRole('header', { name: 'Videos and data' }, slow)).toBeTruthy();
    expect(screen.getByText('saveData:false')).toBeTruthy();
    fireEvent.press(sw(SAVE));
    await waitFor(() => expect(screen.getByText('saveData:true')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Back to More' }));
    const row = await screen.findByRole('button', { name: 'Videos and data, Saving data' }, slow);
    expect(within(row).getByText('Saving data')).toBeTruthy();
  });

  it('DATA-2 with Save data off the row shows nothing at its right end', async () => {
    await renderApp(<MoreScreen />, { user: 'jo' });
    expect(await screen.findByRole('button', { name: 'Videos and data' }, slow)).toBeTruthy();
    expect(screen.queryByText('Saving data')).toBeNull();
  });
});

describe('AUTO-5 reduce motion on the page', () => {
  it('AUTO-5 with the phone\'s reduce motion on, the autoplay switch shows Off and says why', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await openPage();
    await waitFor(() => expect(screen.getByText(OFF_REDUCE_MOTION)).toBeTruthy());
    expect(state(sw(AUTOPLAY)).checked).toBe(false);
  });
});

describe('DATA-1 the prepaid question at sign-up', () => {
  async function fresh() {
    const be = FakeBackend.withFixture({ joIsMember: false });
    await seedPost(be, { caption: 'For the grandparents', circles: [FIXTURE.circles.dadSide.id] });
    return be;
  }
  async function typeEmailAndCode(email: string) {
    fireEvent.changeText(await screen.findByLabelText('Your email'), email);
    fireEvent.press(screen.getByRole('button', { name: 'Send me a code' }));
    fireEvent.changeText(await screen.findByLabelText('6-number code'), '123456');
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  }
  function expectTheQuestion() {
    expect(screen.getByRole('header', { name: Q_TITLE })).toBeTruthy();
    expect(screen.getByText(Q_LINE)).toBeTruthy();
    expect(screen.getByText(Q_NOTE)).toBeTruthy();
    const yes = screen.getByRole('button', { name: Q_YES });
    const no = screen.getByRole('button', { name: Q_NO });
    expect(within(yes).getByText(Q_YES)).toBeTruthy();
    expect(within(no).getByText(Q_NO)).toBeTruthy();
    for (const b of [yes, no]) {
      expect(state(b).selected).toBeFalsy(); // neither preselected
      expect(state(b).checked).toBeFalsy();
      expect(Number(StyleSheet.flatten(b.props.style)?.minHeight ?? 0)).toBeGreaterThanOrEqual(56);
    }
    // No Back to skip, no Next: the two answers are the only buttons.
    expect(screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([Q_YES, Q_NO]);
    expectGrandparentSafe();
  }

  it('DATA-1 a new member, right after the invite code: the question shows before Gallery; "Yes" saves Save data on, then Gallery', async () => {
    const be = await fresh();
    const { nav, kv } = await renderApp(<JoinScreen code={FIXTURE.invites.jo} />, { be, user: null, dataPrefs: null });
    fireEvent.press(await screen.findByRole('button', { name: 'See the photos' }));
    await typeEmailAndCode('jo@example.com');
    expect(await screen.findByRole('header', { name: Q_TITLE }, slow)).toBeTruthy();
    expect(nav.goPhotos).not.toHaveBeenCalled();
    expectTheQuestion();
    fireEvent.press(screen.getByRole('button', { name: Q_YES }));
    await waitFor(() => expect(nav.goPhotos).toHaveBeenCalledTimes(1));
    expect(await saved(kv)).toEqual({ autoplay: true, saveData: true });
  });

  it('DATA-1 "No, my plan is fine" saves Save data off and moves on', async () => {
    const be = await fresh();
    const { nav, kv } = await renderApp(<JoinScreen code={FIXTURE.invites.jo} />, { be, user: null, dataPrefs: null });
    fireEvent.press(await screen.findByRole('button', { name: 'See the photos' }));
    await typeEmailAndCode('jo@example.com');
    fireEvent.press(await screen.findByRole('button', { name: Q_NO }, slow));
    await waitFor(() => expect(nav.goPhotos).toHaveBeenCalledTimes(1));
    expect(await saved(kv)).toEqual({ autoplay: true, saveData: false });
  });

  it('DATA-1 a first sign-in on a phone not yet asked gets the same question', async () => {
    const { nav, kv } = await renderApp(<SignInScreen />, { user: null, dataPrefs: null });
    await typeEmailAndCode('ruth@example.com');
    expect(await screen.findByRole('header', { name: Q_TITLE }, slow)).toBeTruthy();
    expect(nav.goPhotos).not.toHaveBeenCalled();
    expectTheQuestion();
    fireEvent.press(screen.getByRole('button', { name: Q_YES }));
    await waitFor(() => expect(nav.goPhotos).toHaveBeenCalledTimes(1));
    expect((await saved(kv))?.saveData).toBe(true);
  });

  it('DATA-1 control: a phone already asked goes straight to Gallery with no question', async () => {
    const { nav } = await renderApp(<SignInScreen />, { user: null, dataPrefs: { saveData: false } });
    await typeEmailAndCode('ruth@example.com');
    await waitFor(() => expect(nav.goPhotos).toHaveBeenCalled());
    expect(screen.queryByText(Q_TITLE)).toBeNull();
  });
});

describe('DATA-6 neither setting leaves the phone', () => {
  /** The app's api, recording every call (name and arguments). */
  function recordingApi(be: FakeBackend) {
    const api = be.clientFor(null, { trackAppSession: true });
    const calls: { name: string; args: unknown[] }[] = [];
    const wrapped = new Proxy(api, {
      get(t, k, r) {
        const v = Reflect.get(t, k, r) as unknown;
        if (typeof v !== 'function') return v;
        return (...args: unknown[]) => { calls.push({ name: String(k), args }); return (v as (...a: unknown[]) => unknown).apply(t, args); };
      },
    }) as HearthApi;
    return { api: wrapped, calls };
  }
  const mentions = (calls: { name: string; args: unknown[] }[]) =>
    calls.filter((c) => /save.?data|autoplay|play.?videos|data.?pref/i.test(c.name + JSON.stringify(c.args)));

  it('DATA-6 switching both on the Videos and data page makes no backend call and no other network call', async () => {
    const be = FakeBackend.withFixture();
    const { api, calls } = recordingApi(be);
    const fetchSpy = jest.spyOn(globalThis, 'fetch' as never).mockImplementation((() => Promise.reject(new Error('no network in tests'))) as never);
    await openPage({ be, deps: { api } });
    const before = calls.length;
    fireEvent.press(sw(SAVE));
    await waitFor(() => expect(state(sw(SAVE)).checked).toBe(true));
    fireEvent.press(sw(SAVE));
    fireEvent.press(sw(AUTOPLAY));
    await waitFor(() => expect(state(sw(AUTOPLAY)).checked).toBe(false));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(calls.slice(before)).toEqual([]);
    expect(mentions(calls)).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('DATA-6 the sign-up answer is saved on the phone only: no call carries it', async () => {
    const be = FakeBackend.withFixture({ joIsMember: false });
    const { api, calls } = recordingApi(be);
    const { nav } = await renderApp(<JoinScreen code={FIXTURE.invites.jo} />, { be, user: null, dataPrefs: null, deps: { api } });
    fireEvent.press(await screen.findByRole('button', { name: 'See the photos' }));
    fireEvent.changeText(await screen.findByLabelText('Your email'), 'jo@example.com');
    fireEvent.press(screen.getByRole('button', { name: 'Send me a code' }));
    fireEvent.changeText(await screen.findByLabelText('6-number code'), '123456');
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    const yes = await screen.findByRole('button', { name: Q_YES }, slow);
    const before = calls.length;
    fireEvent.press(yes);
    await waitFor(() => expect(nav.goPhotos).toHaveBeenCalled());
    expect(calls.slice(before)).toEqual([]);
    expect(mentions(calls)).toEqual([]);
  });
});
