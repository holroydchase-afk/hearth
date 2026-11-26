// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// CAL-12..18 (docs/product/SPEC-LIFE-CALENDAR.md, DEC-81): the birthday card on Gallery, More → Birthdays, the
// "Today is ..." line, hiding quietly on a server without 0029, and labels never leaving the phone in a report.
// Written FIRST (Nov 24, qa-tdd): red until the calendar is built. Dates are seeded through the CAL-11 API
// (familyDates, setMyBirthday, saveFamilyDate; see src/api/contract/calendar.contract.test.ts for the shape).
// Hooks for the engineer: the Gallery card is testID "birthday-card"; everything else is found by role and words.
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { ApiError, type HearthApi } from '../../api/HearthApi';
import { FakeBackend, FIXTURE } from '../../api/fake/FakeBackend';
import { problemText, problems } from '../../errors/problemLog';
import { type KV } from '../../platform/kv';
import { GalleryScreen, MoreScreen } from '../../test/redesignScreens';
import { renderApp, screenWords, type FixtureUser } from '../../test/renderApp';

type DateKind = 'birthday' | 'anniversary' | 'other';
interface CalendarApi {
  familyDates(space: string): Promise<{ id: string; label: string | null; month: number; day: number; member_id: string | null }[]>;
  setMyBirthday(space: string, month: number | null, day: number | null): Promise<void>;
  saveFamilyDate(a: { space: string; id: string | null; kind: DateKind; label: string | null; month: number; day: number; memberId: string | null }): Promise<string>;
}
const cal = (api: HearthApi) => api as unknown as HearthApi & CalendarApi;
const { earl } = FIXTURE.users;
const SPACE = FIXTURE.space.id;
const slow = { timeout: 5000 };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
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

async function openBirthdays(be: FakeBackend, user: FixtureUser, kv?: KV) {
  const r = await renderApp(<MoreScreen />, { be, user, kv });
  fireEvent.press(await screen.findByRole('button', { name: 'Birthdays' }, slow));
  expect(await screen.findByRole('header', { name: 'Birthdays and dates' }, slow)).toBeTruthy();
  return r;
}

// CAL-S4 (Nov 26, Chase: "hide this from the feed"): the Gallery card ("When's your birthday?", CAL-12/13) and its tests
// (CAL-12 card words, picker and 48 pt, CAL-13 Not now, GUX-R1/R2 on the card) were removed. The own-birthday form and its
// confirmation are now tested from Me in birthdaySettings.test.tsx (CAL-S2); Gallery never shows the card (CAL-S1).

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
    // T35 (qa-tdd test bug): SymbolView renders no Text under jest, so look for the icon itself, not a glyph.
    const icons = within(row).UNSAFE_queryAllByType(SymbolView).map((s) => (s.props as { name: { ios: string } }).name.ios);
    expect(icons.filter((n) => !/chevron/.test(n)).length).toBeGreaterThanOrEqual(1); // an icon beside the word, not just the chevron
  });

  it('CAL-14 "Birthdays and dates" lists every date soonest first from today, in words, with Today / Tomorrow / In N days up to 30', async () => {
    atDate(2025, 12, 1);
    const be = await seeded();
    await openBirthdays(be, 'chase');
    expect(screen.getByText('Only your family can see these.')).toBeTruthy();
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
    expect(screen.getByLabelText(/name|label|whose/i)).toBeTruthy(); // GUX-R11: "Whose birthday?"
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

describe('Grandparent-ux review fixes (Nov 24, GUX-R3, R4, R6, R7, R9, R11)', () => {
  it('GUX-R3 Gallery → See birthdays → the back button reads "Gallery" and returns to Gallery', async () => {
    atDate(2025, 12, 8);
    const be = FakeBackend.withFixture();
    await as(be, 'jo').setMyBirthday(SPACE, 12, 8);
    await renderApp(<GalleryScreen />, { be, user: 'chase' });
    fireEvent.press(await screen.findByRole('button', { name: 'See birthdays' }, slow));
    expect(await screen.findByRole('header', { name: 'Birthdays and dates' }, slow)).toBeTruthy();
    const back = screen.getByRole('button', { name: /^Back to Gallery$|^Gallery$/ });
    expect(within(back).getByText('Gallery')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Back to More$/ })).toBeNull();
    fireEvent.press(back);
    expect(await screen.findByLabelText('Search photos', {}, slow)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('header', { name: 'Birthdays and dates' })).toBeNull());
  });

  it('GUX-R4 on her own birthday Grandma Jo\'s Gallery says "Happy birthday, Grandma Jo!", not "Today is Grandma Jo\'s birthday"', async () => {
    atDate(2025, 12, 8);
    const be = FakeBackend.withFixture();
    await as(be, 'jo').setMyBirthday(SPACE, 12, 8);
    await renderApp(<GalleryScreen />, { be, user: 'jo' });
    expect(await screen.findByText('Happy birthday, Grandma Jo!', {}, slow)).toBeTruthy();
    expect(screen.queryByText(apos("Today is Grandma Jo's birthday"))).toBeNull();
  });

  it('GUX-R4 ...while another member (Grandpa Earl) sees "Today is Grandma Jo\'s birthday" and no "Happy birthday"', async () => {
    atDate(2025, 12, 8);
    const be = FakeBackend.withFixture();
    await as(be, 'jo').setMyBirthday(SPACE, 12, 8);
    await renderApp(<GalleryScreen />, { be, user: 'earl' });
    expect(await screen.findByText(apos("Today is Grandma Jo's birthday"), {}, slow)).toBeTruthy();
    expect(screen.queryByText(/Happy birthday/)).toBeNull();
  });

  it('GUX-R6 a "something else" date today reads "Today: Family reunion"', async () => {
    atDate(2025, 7, 4);
    const be = FakeBackend.withFixture();
    await labelled(be, 'other', 'Family reunion', 7, 4);
    await renderApp(<GalleryScreen />, { be, user: 'chase' });
    expect(await screen.findByText('Today: Family reunion', {}, slow)).toBeTruthy();
    expect(screen.queryByText('Today is Family reunion')).toBeNull();
  });

  it('GUX-R7 in the Add a date form the back button reads "Birthdays", there is one heading, and back returns to the list', async () => {
    atDate(2025, 12, 1);
    await openBirthdays(FakeBackend.withFixture(), 'chase');
    fireEvent.press(screen.getByRole('button', { name: 'Add a date' }));
    expect(await screen.findByRole('header', { name: 'Add a date' })).toBeTruthy();
    expect(screen.queryByRole('header', { name: 'Birthdays and dates' })).toBeNull(); // one heading, not two
    const back = screen.getByRole('button', { name: /^(Back to )?Birthdays$/ });
    expect(within(back).getByText('Birthdays')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back to More' })).toBeNull();
    fireEvent.press(back);
    expect(await screen.findByRole('header', { name: 'Birthdays and dates' }, slow)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a date' })).toBeTruthy();
  });

  it('GUX-R9 when the dates can\'t load, Birthdays says "The dates can\'t load right now. Try again in a minute, or ask Chase."', async () => {
    const be = FakeBackend.withFixture();
    const api = be.clientFor(null, { trackAppSession: true }) as unknown as Record<string, unknown>;
    api.familyDates = async () => { throw new ApiError('NETWORK', 'offline'); };
    await renderApp(<MoreScreen />, { be, user: 'jo', deps: { api: api as unknown as HearthApi } });
    fireEvent.press(await screen.findByRole('button', { name: 'Birthdays' }, slow));
    expect(await screen.findByText(apos("The dates can't load right now. Try again in a minute, or ask Chase."), {}, slow)).toBeTruthy();
  });

  it('GUX-R11 Add a date → Birthday is labelled "Whose birthday?"', async () => {
    atDate(2025, 12, 1);
    await openBirthdays(FakeBackend.withFixture(), 'chase');
    fireEvent.press(screen.getByRole('button', { name: 'Add a date' }));
    expect(await screen.findByLabelText('Whose birthday?')).toBeTruthy();
  });

  it('GUX-R11 Delete this date? says "It\'s removed for everyone in the family."', async () => {
    atDate(2025, 12, 1);
    const be = FakeBackend.withFixture();
    await labelled(be, 'birthday', 'Mia', 12, 6);
    await openBirthdays(be, 'chase');
    fireEvent.press(screen.getByRole('button', { name: /Mia/ }));
    fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Delete this date?')).toBeTruthy();
    expect(screenWords()).toMatch(/It[’']s removed for everyone in the family\./);
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

  it('CAL-17 Gallery: with 0029 the "Today is" line shows; without it, no line, no error words and no error report', async () => {
    atDate(2025, 12, 8);
    const seed = FakeBackend.withFixture();
    await as(seed, 'jo').setMyBirthday(SPACE, 12, 8);
    const live = await renderApp(<GalleryScreen />, { be: seed, user: 'chase' });
    expect(await screen.findByText(apos("Today is Grandma Jo's birthday"), {}, slow)).toBeTruthy(); // control: the line is there on a 0029 server
    live.unmount();
    const be = FakeBackend.withFixture();
    const { api, report } = oldServer(be);
    await renderApp(<GalleryScreen />, { be, user: 'jo', deps: { api } });
    await screen.findByLabelText('Search photos', {}, slow);
    await waitFor(() => expect(screen.queryByTestId('birthday-card')).toBeNull());
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

