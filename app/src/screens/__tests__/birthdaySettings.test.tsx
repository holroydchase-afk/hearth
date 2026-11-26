// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// CAL-S1..S3 (Chase, Nov 26: "hide this from the feed. for now i'd want it in the settings and maybe a notification in
// the future" / "its weird in the main gallery and feed"). The "When's your birthday?" card leaves Gallery and Feed; the
// birthday lives in Settings = the Me screen (More -> Me) as a "My birthday" section. A reminder notification is a later
// idea and is NOT tested here. Kept: More > Birthdays, the "Today is ..." line, all backend.
// Written FIRST (Nov 26, qa-tdd): red until the card is removed and the section is built.
// Hooks for the engineer: the Me section is testID "my-birthday" (header "My birthday" inside it); everything else is
// found by role and words. "Add my birthday" opens the Birthdays screen in More's stack (/more/birthdays?add=mine).
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { type HearthApi } from '../../api/HearthApi';
import { FakeBackend, FIXTURE } from '../../api/fake/FakeBackend';
import { FeedScreen, GalleryScreen, MoreScreen } from '../../test/redesignScreens';
import { renderApp, screenWords, type FixtureUser } from '../../test/renderApp';

type DateKind = 'birthday' | 'anniversary' | 'other';
interface CalendarApi {
  familyDates(space: string): Promise<{ id: string; label: string | null; month: number; day: number; member_id: string | null }[]>;
  setMyBirthday(space: string, month: number | null, day: number | null): Promise<void>;
  saveFamilyDate(a: { space: string; id: string | null; kind: DateKind; label: string | null; month: number; day: number; memberId: string | null }): Promise<string>;
}
const cal = (api: HearthApi) => api as unknown as HearthApi & CalendarApi;
const { jo, earl } = FIXTURE.users;
const SPACE = FIXTURE.space.id;
const slow = { timeout: 5000 };
const as = (be: FakeBackend, u: FixtureUser) => cal(be.clientFor(FIXTURE.users[u].id));
const flat = (s: unknown) => (StyleSheet.flatten(typeof s === 'function' ? s({ pressed: false }) : s) ?? {}) as Record<string, unknown>;
const choice = (name: string | RegExp) => screen.queryByRole('radio', { name }) ?? screen.queryByRole('button', { name });
const settle = () => new Promise((r) => setTimeout(r, 400)); // let the card's async checks (dates, "asked before") finish

/** The phone's own date, in the past, still ticking (same helper as calendar.test.tsx). */
const RealDate = Date;
function atDate(y: number, m: number, d: number) {
  const shift = new RealDate(y, m - 1, d, 10).getTime() - RealDate.now();
  if (shift > 0) throw new Error('atDate: use a date in the past');
  class PhoneDate extends RealDate {
    constructor(...a: unknown[]) { if (a.length) super(...(a as [number])); else super(RealDate.now() + shift); }
    static override now() { return RealDate.now() + shift; }
  }
  global.Date = PhoneDate as DateConstructor;
}
afterEach(() => { global.Date = RealDate; });

async function openMe(be: FakeBackend, user: FixtureUser, deps?: { api: HearthApi }) {
  const r = await renderApp(<MoreScreen />, { be, user, ...(deps ? { deps } : {}) });
  fireEvent.press(await screen.findByRole('button', { name: 'Me' }, slow));
  expect(await screen.findByRole('header', { name: 'Me' }, slow)).toBeTruthy();
  return r;
}
const section = async () => within(await screen.findByTestId('my-birthday', {}, slow));

describe('CAL-S1 no birthday card on Gallery or Feed', () => {
  it('CAL-S1 Gallery never shows the birthday card: a member with no birthday who never tapped Not now', async () => {
    await renderApp(<GalleryScreen />, { user: 'jo' });
    await screen.findByLabelText('Search photos', {}, slow);
    await settle();
    expect(screen.queryByTestId('birthday-card')).toBeNull();
    expect(screen.queryByText(/^When[’']s your birthday\?$/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Not now' })).toBeNull();
  });

  it('CAL-S1 ...even once the calendar has loaded (control: another date today proves it did), and the "Today is" line stays', async () => {
    atDate(2025, 12, 1);
    const be = FakeBackend.withFixture();
    await as(be, 'chase').saveFamilyDate({ space: SPACE, id: null, kind: 'birthday', label: null, month: 12, day: 1, memberId: earl.id });
    await renderApp(<GalleryScreen />, { be, user: 'jo' }); // Grandma Jo has no birthday saved
    expect(await screen.findByText(/^Today is Grandpa Earl[’']s birthday$/, {}, slow)).toBeTruthy(); // kept
    await settle();
    expect(screen.queryByTestId('birthday-card')).toBeNull();
    expect(screen.queryByText(/^When[’']s your birthday\?$/)).toBeNull();
  });

  it('CAL-S1 Feed never shows the birthday card either (guard: it never did)', async () => {
    await renderApp(<FeedScreen />, { user: 'jo' });
    await screen.findByRole('header', { name: 'Feed' }, slow);
    await settle();
    expect(screen.queryByTestId('birthday-card')).toBeNull();
    expect(screen.queryByText(/^When[’']s your birthday\?$/)).toBeNull();
  });
});

describe('CAL-S2 Me has a "My birthday" section', () => {
  it('CAL-S2 with no birthday it says so and offers "Add my birthday"', async () => {
    await openMe(FakeBackend.withFixture(), 'jo');
    const s = await section();
    expect(s.getByRole('header', { name: 'My birthday' })).toBeTruthy();
    expect(s.getByText(/isn[’']t added|not added/i)).toBeTruthy();
    expect(s.getByRole('button', { name: 'Add my birthday' })).toBeTruthy();
    expect(s.queryByRole('button', { name: 'Change my birthday' })).toBeNull();
  });

  it('CAL-S2 with one saved it shows "December 8" (month and day, never a year) and offers "Change my birthday"', async () => {
    const be = FakeBackend.withFixture();
    await as(be, 'jo').setMyBirthday(SPACE, 12, 8);
    await openMe(be, 'jo');
    const s = await section();
    expect(await s.findByText('December 8', {}, slow)).toBeTruthy();
    expect(s.getByRole('button', { name: 'Change my birthday' })).toBeTruthy();
    expect(s.queryByRole('button', { name: 'Add my birthday' })).toBeNull();
    expect(s.queryByText(/isn[’']t added|not added/i)).toBeNull();
    const words = screenWords();
    expect(words).not.toMatch(/\b(19|20)\d\d\b|\bage\b|years? old|\bturns \d/i);
  });

  it('CAL-S2 a parent (Chase) gets the section too, for their own birthday', async () => {
    await openMe(FakeBackend.withFixture(), 'chase');
    expect((await section()).getByRole('button', { name: 'Add my birthday' })).toBeTruthy();
  });

  it('CAL-S2 "Add my birthday" opens the form under More (Back goes to Birthdays, then More, never Gallery); Save returns with the confirmation', async () => {
    const be = FakeBackend.withFixture();
    await openMe(be, 'jo');
    fireEvent.press((await section()).getByRole('button', { name: 'Add my birthday' }));
    expect(await screen.findByRole('header', { name: 'Add my birthday' }, slow)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^(Back to )?Birthdays$/ })).toBeTruthy(); // the form's back (GUX-R7)
    expect(screen.queryByRole('button', { name: /^(Back to )?Gallery$/ })).toBeNull();
    fireEvent.press(choice('December')!);
    fireEvent.press(choice(/^(December )?8$/)!);
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved. Your family will see December 8.', {}, slow)).toBeTruthy();
    expect(await screen.findByRole('header', { name: 'Birthdays and dates' }, slow)).toBeTruthy();
    const rows = await as(be, 'chase').familyDates(SPACE);
    expect(rows.filter((r) => r.member_id === jo.id)).toEqual([expect.objectContaining({ month: 12, day: 8 })]);
    // Back from the list lands in More's stack, not Gallery
    expect(screen.queryByRole('button', { name: /^(Back to )?Gallery$/ })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: /^(Back to )?More$/ }));
    expect(await screen.findByRole('header', { name: 'More' }, slow)).toBeTruthy();
    expect(screen.queryByLabelText('Search photos')).toBeNull();
  });

  it('CAL-S2 "Change my birthday" opens the same form, starting on the saved date', async () => {
    const be = FakeBackend.withFixture();
    await as(be, 'jo').setMyBirthday(SPACE, 12, 8);
    await openMe(be, 'jo');
    fireEvent.press((await section()).getByRole('button', { name: 'Change my birthday' }));
    expect(await screen.findByRole('header', { name: 'Change my birthday' }, slow)).toBeTruthy();
  });
});

describe('CAL-S3 quiet on an old server; viewers get it; targets and words are grandparent-sized', () => {
  it('CAL-S3 without 0029 the section is hidden: no error words, no error report (control: it shows with 0029)', async () => {
    const live = await openMe(FakeBackend.withFixture(), 'jo');
    expect(await screen.findByTestId('my-birthday', {}, slow)).toBeTruthy(); // control
    live.unmount();
    const be = FakeBackend.withFixture();
    const api = be.clientFor(null, { trackAppSession: true }) as unknown as Record<string, unknown>;
    const missing = async () => { throw Object.assign(new Error('Could not find the function public.list_family_dates'), { code: 'PGRST202' }); };
    for (const m of ['familyDates', 'setMyBirthday', 'saveFamilyDate', 'deleteFamilyDate']) api[m] = missing;
    const report = jest.fn(async () => undefined);
    api.reportClientError = report;
    await openMe(be, 'jo', { api: api as unknown as HearthApi });
    await screen.findByText('How should we tell you about new photos?', {}, slow); // the rest of Me loaded
    await waitFor(() => expect(screen.queryByTestId('my-birthday')).toBeNull());
    expect(screen.queryByRole('header', { name: 'My birthday' })).toBeNull();
    expect(screenWords()).not.toMatch(/didn[’']t work|went wrong|try again|problem|birthday/i);
    expect(report).not.toHaveBeenCalled();
  });

  it('CAL-S3 a viewer (Grandma Jo) sees the section, with every target 48 pt+ and every word 17 pt+', async () => {
    await openMe(FakeBackend.withFixture(), 'jo');
    const node = await screen.findByTestId('my-birthday', {}, slow);
    const targets = node.findAll((n) => typeof n.type === 'string' && typeof n.props.onResponderGrant === 'function' && n.props.accessible === true);
    expect(targets.length).toBeGreaterThanOrEqual(1);
    for (const t of targets) {
      const s = flat(t.props.style);
      const h = Number(s.minHeight ?? s.height ?? 0), w = Number(s.minWidth ?? s.width ?? (s.flex || s.alignSelf === 'stretch' ? 999 : 0));
      expect({ label: t.props.accessibilityLabel, h: h >= 48, w: w >= 48 }).toEqual({ label: expect.stringMatching(/\S/), h: true, w: true });
    }
    for (const t of within(node).UNSAFE_queryAllByType(Text)) {
      const size = flat(t.props.style).fontSize;
      if (size !== undefined) expect({ text: String(t.props.children).slice(0, 30), big: Number(size) >= 17 }).toEqual({ text: expect.any(String), big: true });
    }
  });
});
