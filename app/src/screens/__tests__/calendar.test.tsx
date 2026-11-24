// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// CAL-12..18 (docs/product/SPEC-LIFE-CALENDAR.md, DEC-81): the birthday card on Gallery, More → Birthdays, the
// "Today is ..." line, hiding quietly on a server without 0029, and labels never leaving the phone in a report.
// Written FIRST (Nov 24, qa-tdd): red until the calendar is built. Dates are seeded through the CAL-11 API
// (familyDates, setMyBirthday, saveFamilyDate; see src/api/contract/calendar.contract.test.ts for the shape).
// Hooks for the engineer: the Gallery card is testID "birthday-card"; everything else is found by role and words.
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { ApiError, type HearthApi } from '../../api/HearthApi';
import { FakeBackend, FIXTURE } from '../../api/fake/FakeBackend';
import { problemText, problems } from '../../errors/problemLog';
import { memoryKV, type KV } from '../../platform/kv';
import { GalleryScreen, MoreScreen } from '../../test/redesignScreens';
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
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const QUESTION = /^When[’']s your birthday\?$/;
const apos = (s: string) => new RegExp(`^${s.replace(/'/g, '[’\']').replace(/[?.]/g, '\\$&')}$`);

/** The phone's own date, at 10 am, still ticking. Only Date moves; timers stay real so the screens load as usual.
 *  Always a date in the past: an Animated timing started on a future clock runs until real time catches up after
 *  the clock is put back, and jest never exits (seen Nov 24 with jest.useFakeTimers and with this). 2024 is a leap year. */
const RealDate = Date;
function atDate(y: number, m: number, d: number) {
  const shift = new RealDate(y, m - 1, d, 10).getTime() - RealDate.now();
  if (shift > 0) throw new Error('atDate: use a date in the past (see the note above)');
  class PhoneDate extends RealDate {
    constructor(...a: unknown[]) { if (a.length) super(...(a as [number])); else super(RealDate.now() + shift); }
    static override now() { return RealDate.now() + shift; }
  }
  global.Date = PhoneDate as DateConstructor;
}
afterEach(() => { global.Date = RealDate; });

const as = (be: FakeBackend, u: FixtureUser) => cal(be.clientFor(FIXTURE.users[u].id));
const memberBirthday = (be: FakeBackend, who: string, month: number, day: number) =>
  as(be, 'chase').saveFamilyDate({ space: SPACE, id: null, kind: 'birthday', label: null, month, day, memberId: who });
const labelled = (be: FakeBackend, kind: DateKind, label: string, month: number, day: number) =>
  as(be, 'chase').saveFamilyDate({ space: SPACE, id: null, kind, label, month, day, memberId: null });

/** A month or day choice: a button or a radio, found by its spoken name. */
function choice(name: string | RegExp, root: ReturnType<typeof within> | typeof screen = screen) {
  return root.queryByRole('radio', { name }) ?? root.queryByRole('button', { name });
}
const flat = (s: unknown) => (StyleSheet.flatten(typeof s === 'function' ? s({ pressed: false }) : s) ?? {}) as Record<string, unknown>;

async function openBirthdays(be: FakeBackend, user: FixtureUser, kv?: KV) {
  const r = await renderApp(<MoreScreen />, { be, user, kv });
  fireEvent.press(await screen.findByRole('button', { name: 'Birthdays' }, slow));
  expect(await screen.findByRole('header', { name: 'Birthdays and dates' }, slow)).toBeTruthy();
  return r;
}

describe('CAL-12/13 the birthday card on Gallery', () => {
  it('CAL-12 a member with no birthday saved sees "When\'s your birthday?" with the privacy line, 12 months, days, Save and Not now', async () => {
    await renderApp(<GalleryScreen />, { user: 'jo' });
    const card = await screen.findByTestId('birthday-card', {}, slow);
    const c = within(card);
    expect(c.getByText(QUESTION)).toBeTruthy();
    expect(c.getByText('Your family will see the month and day. Never the year.')).toBeTruthy();
    expect(MONTHS.filter((m) => !choice(m, c))).toEqual([]);
    fireEvent.press(choice('December', c)!);
    const missingDays = Array.from({ length: 31 }, (_, i) => i + 1).filter((d) => !choice(new RegExp(`^(December )?${d}$`), c));
    expect(missingDays).toEqual([]);
    expect(c.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(c.getByRole('button', { name: 'Not now' })).toBeTruthy();
    expect(c.UNSAFE_queryAllByType(TextInput)).toHaveLength(0); // no typing
  });

  it('CAL-12 every target on the card is 48 pt or more and every word 17 pt or more', async () => {
    await renderApp(<GalleryScreen />, { user: 'jo' });
    const card = await screen.findByTestId('birthday-card', {}, slow);
    const targets = card.findAll((n) => typeof n.type === 'string' && typeof n.props.onResponderGrant === 'function' && n.props.accessible === true);
    expect(targets.length).toBeGreaterThanOrEqual(14);
    for (const t of targets) {
      const s = flat(t.props.style);
      const h = Number(s.minHeight ?? s.height ?? 0), w = Number(s.minWidth ?? s.width ?? (s.flex || s.alignSelf === 'stretch' ? 999 : 0));
      expect({ label: t.props.accessibilityLabel, h: h >= 48, w: w >= 48 }).toEqual({ label: expect.stringMatching(/\S/), h: true, w: true });
    }
    for (const t of within(card).UNSAFE_queryAllByType(Text)) {
      const size = flat(t.props.style).fontSize;
      if (size !== undefined) expect({ text: String(t.props.children).slice(0, 30), big: Number(size) >= 17 }).toEqual({ text: expect.any(String), big: true });
    }
  });

  it('CAL-12 a member whose birthday is saved never sees the card', async () => {
    const be = FakeBackend.withFixture();
    await as(be, 'jo').setMyBirthday(SPACE, 12, 8);
    await renderApp(<GalleryScreen />, { be, user: 'jo' });
    await screen.findByLabelText('Search photos', {}, slow);
    expect(screen.queryByTestId('birthday-card')).toBeNull();
  });

  it('CAL-13 Save says "Saved. Your family will see December 8.", saves it, and the card is gone for good', async () => {
    const be = FakeBackend.withFixture();
    const kv = memoryKV();
    const first = await renderApp(<GalleryScreen />, { be, user: 'jo', kv });
    const card = await screen.findByTestId('birthday-card', {}, slow);
    fireEvent.press(choice('December', within(card))!);
    fireEvent.press(choice(/^(December )?8$/, within(card))!);
    fireEvent.press(within(card).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved. Your family will see December 8.', {}, slow)).toBeTruthy();
    const rows = await as(be, 'chase').familyDates(SPACE);
    expect(rows.filter((r) => r.member_id === jo.id)).toEqual([expect.objectContaining({ month: 12, day: 8 })]);
    first.unmount();
    await renderApp(<GalleryScreen />, { be, user: 'jo', kv });
    await screen.findByLabelText('Search photos', {}, slow);
    expect(screen.queryByText(QUESTION)).toBeNull();
  });

  it('CAL-13 Not now hides it, it stays hidden in this family on this phone, and Birthdays still offers "Add my birthday"', async () => {
    const be = FakeBackend.withFixture();
    const kv = memoryKV();
    const first = await renderApp(<GalleryScreen />, { be, user: 'jo', kv });
    fireEvent.press(within(await screen.findByTestId('birthday-card', {}, slow)).getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByText(QUESTION)).toBeNull());
    first.unmount();
    const second = await renderApp(<GalleryScreen />, { be, user: 'jo', kv });
    await screen.findByLabelText('Search photos', {}, slow);
    expect(screen.queryByText(QUESTION)).toBeNull();
    second.unmount();
    await openBirthdays(be, 'jo', kv);
    expect(screen.getByRole('button', { name: 'Add my birthday' })).toBeTruthy();
  });
});

describe('CAL-14/15 More → Birthdays', () => {
  async function seeded() {
    const be = FakeBackend.withFixture();
    await memberBirthday(be, earl.id, 12, 1);            // today
    await as(be, 'jo').setMyBirthday(SPACE, 12, 2);      // tomorrow
    await labelled(be, 'birthday', 'Mia', 12, 6);        // in 5 days
    await labelled(be, 'other', 'Party', 12, 31);        // in 30 days
    await labelled(be, 'anniversary', 'Chase and Alex', 1, 15); // 45 days: the date only
    await labelled(be, 'other', 'Family reunion', 11, 20);      // already past: next year, last
    return be;
  }

  it('CAL-14 any member (a grandparent too) has a Birthdays row on More with an icon and the word', async () => {
    await renderApp(<MoreScreen />, { user: 'jo' });
    const row = await screen.findByRole('button', { name: 'Birthdays' }, slow);
    expect(within(row).getByText('Birthdays')).toBeTruthy();
    expect(within(row).UNSAFE_queryAllByType(Text).length).toBeGreaterThan(1); // the icon glyph beside the word
  });

  it('CAL-14 "Birthdays and dates" lists every date soonest first from today, in words, with Today / Tomorrow / In N days up to 30', async () => {
    atDate(2025, 12, 1);
    const be = await seeded();
    await openBirthdays(be, 'chase');
    expect(screen.getByText('Everyone in the family sees these.')).toBeTruthy();
    const words = screenWords();
    const at = ['Grandpa Earl', 'Grandma Jo', 'Mia', 'Party', 'Chase and Alex', 'Family reunion'].map((w) => ({ w, i: words.indexOf(w) }));
    expect(at.filter((x) => x.i < 0)).toEqual([]);
    expect(at.map((x) => x.w)).toEqual([...at].sort((a, b) => a.i - b.i).map((x) => x.w));
    for (const w of ['December 1', 'December 2', 'December 6', 'December 31', 'January 15', 'November 20', 'Today', 'Tomorrow', 'In 5 days', 'In 30 days']) {
      expect({ w, shown: words.includes(w) }).toEqual({ w, shown: true });
    }
    expect(words).not.toMatch(/In (3[1-9]|[4-9]\d|\d{3}) days/); // nothing past 30 days gets a countdown
    expect(words).not.toMatch(/\b(19|20)\d\d\b|\bage\b|years? old|\bturns \d/i); // never a year or an age
  });

  it('CAL-15 a grandparent\'s only action is "Add my birthday", then "Change my birthday"; dates have no Change or Delete', async () => {
    atDate(2025, 12, 1);
    const be = FakeBackend.withFixture();
    await labelled(be, 'birthday', 'Mia', 12, 6);
    const first = await openBirthdays(be, 'jo');
    expect(screen.getByRole('button', { name: 'Add my birthday' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a date' })).toBeNull();
    const mia = screen.queryByRole('button', { name: /Mia/ });
    if (mia) fireEvent.press(mia);
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    first.unmount();
    await as(be, 'jo').setMyBirthday(SPACE, 12, 8);
    await openBirthdays(be, 'jo');
    expect(screen.getByRole('button', { name: 'Change my birthday' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add my birthday' })).toBeNull();
  });

  it('CAL-15 a parent gets "Add a date" (Birthday, Anniversary, Something else; a name or label; month; day)', async () => {
    atDate(2025, 12, 1);
    await openBirthdays(FakeBackend.withFixture(), 'chase');
    fireEvent.press(screen.getByRole('button', { name: 'Add a date' }));
    await waitFor(() => expect(['Birthday', 'Anniversary', 'Something else'].filter((k) => !choice(k))).toEqual([]));
    expect(screen.getByLabelText(/name|label/i)).toBeTruthy();
    expect(MONTHS.filter((m) => !choice(m))).toEqual([]);
  });

  it('CAL-15 a parent taps a date for Change and Delete; Delete asks "Delete this date?" and then removes it', async () => {
    atDate(2025, 12, 1);
    const be = FakeBackend.withFixture();
    const id = await labelled(be, 'birthday', 'Mia', 12, 6);
    await openBirthdays(be, 'chase');
    fireEvent.press(screen.getByRole('button', { name: /Mia/ }));
    expect(await screen.findByRole('button', { name: 'Change' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Delete this date?')).toBeTruthy();
    const del = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.press(del[del.length - 1]!);
    await waitFor(async () => expect((await as(be, 'chase').familyDates(SPACE)).find((r) => r.id === id)).toBeUndefined());
    await waitFor(() => expect(screen.queryByText('Mia')).toBeNull());
  });
});

describe('CAL-16 the line on Gallery on the day', () => {
  it('CAL-16 on Grandma Jo\'s birthday everyone sees "Today is Grandma Jo\'s birthday" and "See birthdays" opens the list', async () => {
    atDate(2025, 12, 8);
    const be = FakeBackend.withFixture();
    await as(be, 'jo').setMyBirthday(SPACE, 12, 8);
    await renderApp(<GalleryScreen />, { be, user: 'chase' });
    expect(await screen.findByText(apos("Today is Grandma Jo's birthday"), {}, slow)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'See birthdays' }));
    expect(await screen.findByRole('header', { name: 'Birthdays and dates' }, slow)).toBeTruthy();
  });

  it('CAL-16 two on one day read "Today: Grandma Jo\'s birthday and 1 more"', async () => {
    atDate(2025, 12, 8);
    const be = FakeBackend.withFixture();
    await as(be, 'jo').setMyBirthday(SPACE, 12, 8);
    await memberBirthday(be, earl.id, 12, 8);
    await renderApp(<GalleryScreen />, { be, user: 'chase' });
    expect(await screen.findByText(/^Today: (Grandma Jo|Grandpa Earl)[’']s birthday and 1 more$/, {}, slow)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'See birthdays' })).toHaveLength(1);
  });

  it('CAL-16 a Feb 29 birthday shows on Feb 28 in a year with no Feb 29', async () => {
    atDate(2025, 2, 28);
    const be = FakeBackend.withFixture();
    await memberBirthday(be, earl.id, 2, 29);
    await renderApp(<GalleryScreen />, { be, user: 'chase' });
    expect(await screen.findByText(apos("Today is Grandpa Earl's birthday"), {}, slow)).toBeTruthy();
  });

  it('CAL-16 ...but not on Feb 28 of a leap year, and no line on a day with no dates', async () => {
    atDate(2024, 2, 28);
    const be = FakeBackend.withFixture();
    await memberBirthday(be, earl.id, 2, 29);
    await as(be, 'jo').setMyBirthday(SPACE, 12, 8);
    await renderApp(<GalleryScreen />, { be, user: 'chase' });
    await screen.findByLabelText('Search photos', {}, slow);
    await waitFor(async () => expect((await as(be, 'chase').familyDates(SPACE)).length).toBe(2));
    expect(screen.queryByText(/^Today( is|:)/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'See birthdays' })).toBeNull();
  });
});

describe('CAL-17 a server without 0029 hides the calendar quietly', () => {
  /** The app's API, with the calendar RPCs answering as PostgREST does for a missing function. */
  function oldServer(be: FakeBackend) {
    const api = be.clientFor(null, { trackAppSession: true }) as unknown as Record<string, unknown>;
    const missing = async () => { throw Object.assign(new Error('Could not find the function public.list_family_dates'), { code: 'PGRST202' }); };
    for (const m of ['familyDates', 'setMyBirthday', 'saveFamilyDate', 'deleteFamilyDate']) api[m] = missing;
    const report = jest.fn(async () => undefined);
    api.reportClientError = report;
    return { api: api as unknown as HearthApi, report };
  }

  it('CAL-17 Gallery: with 0029 the card shows; without it, no card, no line, no error words and no error report', async () => {
    const live = await renderApp(<GalleryScreen />, { user: 'jo' });
    expect(await screen.findByTestId('birthday-card', {}, slow)).toBeTruthy(); // control: the card is there on a 0029 server
    live.unmount();
    atDate(2025, 12, 8);
    const be = FakeBackend.withFixture();
    const { api, report } = oldServer(be);
    await renderApp(<GalleryScreen />, { be, user: 'jo', deps: { api } });
    await screen.findByLabelText('Search photos', {}, slow);
    await waitFor(() => expect(screen.queryByTestId('birthday-card')).toBeNull());
    expect(screen.queryByText(QUESTION)).toBeNull();
    expect(screen.queryByText(/^Today( is|:)/)).toBeNull();
    expect(screenWords()).not.toMatch(/didn[’']t work|went wrong|try again|problem/i);
    expect(report).not.toHaveBeenCalled();
  });

  it('CAL-17 More: with 0029 the Birthdays row shows; without it, the row is hidden', async () => {
    const live = await renderApp(<MoreScreen />, { user: 'jo' });
    expect(await screen.findByRole('button', { name: 'Birthdays' }, slow)).toBeTruthy(); // control
    live.unmount();
    const be = FakeBackend.withFixture();
    const { api, report } = oldServer(be);
    await renderApp(<MoreScreen />, { be, user: 'jo', deps: { api } });
    await screen.findByRole('button', { name: 'Help' }, slow);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Birthdays' })).toBeNull());
    expect(report).not.toHaveBeenCalled();
  });
});

describe('CAL-18 labels never leave the phone in a log or a report', () => {
  it('CAL-18 a failed change keeps the label out of the console, the problem log and the error report', async () => {
    atDate(2025, 12, 1);
    const be = FakeBackend.withFixture();
    const SECRET = 'Mia Secretlabel';
    await labelled(be, 'birthday', SECRET, 12, 6);
    const api = be.clientFor(null, { trackAppSession: true }) as unknown as Record<string, unknown>;
    api.deleteFamilyDate = async () => { throw new ApiError('UNKNOWN', `could not delete ${SECRET}`); };
    const report = jest.fn(async () => undefined);
    api.reportClientError = report;
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((k) => jest.spyOn(console, k).mockImplementation(() => undefined));
    try {
      const r = await renderApp(<MoreScreen />, { be, user: 'chase', deps: { api: api as unknown as HearthApi } });
      fireEvent.press(await screen.findByRole('button', { name: 'Birthdays' }, slow));
      fireEvent.press(await screen.findByRole('button', { name: /Secretlabel/ }, slow));
      fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));
      await screen.findByText('Delete this date?');
      const del = screen.getAllByRole('button', { name: 'Delete' });
      fireEvent.press(del[del.length - 1]!);
      await waitFor(() => expect(screen.queryByText('Delete this date?')).toBeNull());
      const logged = spies.flatMap((s) => s.mock.calls.map((c) => c.map(String).join(' '))).join('\n');
      expect(logged).not.toContain('Secretlabel');
      expect(JSON.stringify(report.mock.calls)).not.toContain('Secretlabel');
      expect(problemText(problems())).not.toContain('Secretlabel');
      r.unmount();
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });
});

