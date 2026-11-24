// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// CAL-1..7, CAL-9, CAL-11 (docs/product/SPEC-LIFE-CALENDAR.md, DEC-81, migration 0029): the life calendar's
// HearthApi methods. Same cast as contract.test.ts: FakeApi always; SupabaseApi when the env is set
// (`bash scripts/contract-real.sh`). Written FIRST (Nov 24, qa-tdd): red until the methods exist.
//
// The shape these tests fix (engineer: add to HearthApi / types.ts like this, then drop the cast below):
//   familyDates(space): Promise<FamilyDate[]>                   list_family_dates; month then day
//   setMyBirthday(space, month | null, day | null): Promise<void> set_my_birthday; both null clears
//   saveFamilyDate(a: SaveFamilyDateArgs): Promise<string>       save_family_date; returns the id; parents only
//   deleteFamilyDate(id): Promise<void>                          delete_family_date
//   FamilyDate = { id, kind, label, month, day, member_id, member_name }
// Every test cleans up after itself, because the real stack keeps its rows for the whole run.
import * as fs from 'fs';
import * as path from 'path';
import { ApiError, type HearthApi } from '../HearthApi';
import { SupabaseApi } from '../SupabaseApi';
import { fakeHarness } from './fakeHarness';
import type { ContractHarness, HarnessFactory } from './harness';
import { supabaseCaps, supabaseEnvReady, supabaseHarness } from './supabaseHarness';

type DateKind = 'birthday' | 'anniversary' | 'other';
interface FamilyDate { id: string; kind: DateKind; label: string | null; month: number; day: number; member_id: string | null; member_name: string | null }
interface SaveFamilyDateArgs { space: string; id: string | null; kind: DateKind; label: string | null; month: number; day: number; memberId: string | null }
interface CalendarApi {
  familyDates(space: string): Promise<FamilyDate[]>;
  setMyBirthday(space: string, month: number | null, day: number | null): Promise<void>;
  saveFamilyDate(a: SaveFamilyDateArgs): Promise<string>;
  deleteFamilyDate(id: string): Promise<void>;
}
/** Until CAL-11 lands these methods are missing, so each test fails with "is not a function" (typecheck stays clean). */
const cal = (api: HearthApi) => api as unknown as HearthApi & CalendarApi;

interface Caps { joiner: boolean }
const factories: [string, HarnessFactory, Caps][] = [['FakeApi', fakeHarness, { joiner: true }]];
if (supabaseEnvReady()) factories.push(['SupabaseApi', supabaseHarness, supabaseCaps()]);

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof ApiError ? e.code : `non-ApiError: ${String(e)}`;
  }
}
const stamp = () => Math.random().toString(36).slice(2, 8);

describe.each(factories)('%s life calendar contract (CAL)', (_name, factory, caps) => {
  const itOutsider = caps.joiner ? it : it.skip;
  let h: ContractHarness;
  let parent: HearthApi & CalendarApi;
  let viewer: HearthApi & CalendarApi;
  let other: HearthApi & CalendarApi;
  let made: string[];

  beforeEach(async () => {
    h = await factory();
    parent = cal(h.as('poster'));
    viewer = cal(h.as('viewerIn'));
    other = cal(h.as('viewerOut'));
    made = [];
  });
  afterEach(async () => {
    // Cleanup never fails a test: before CAL-11 the methods are missing, and a row may already be gone.
    const quiet = async (f: () => Promise<unknown>) => { try { await f(); } catch { /* nothing to clean */ } };
    for (const id of made) await quiet(() => parent.deleteFamilyDate(id));
    await quiet(() => viewer.setMyBirthday(h.spaceId, null, null));
  });
  const add = async (a: Omit<SaveFamilyDateArgs, 'space' | 'id'>) => {
    const id = await parent.saveFamilyDate({ space: h.spaceId, id: null, ...a });
    made.push(id);
    return id;
  };

  it('CAL-1 a member gets every date in the family, sorted by month then day', async () => {
    const t = stamp();
    await add({ kind: 'anniversary', label: `Anniv ${t}`, month: 6, day: 20, memberId: null });
    await add({ kind: 'birthday', label: `Mia ${t}`, month: 3, day: 14, memberId: null });
    await add({ kind: 'other', label: `Reunion ${t}`, month: 3, day: 2, memberId: null });
    const rows = await viewer.familyDates(h.spaceId);
    const mine = rows.filter((r) => r.label?.endsWith(t));
    expect(mine.map((r) => r.label)).toEqual([`Reunion ${t}`, `Mia ${t}`, `Anniv ${t}`]);
    const keys = rows.map((r) => r.month * 100 + r.day);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
  });

  itOutsider('CAL-2 someone outside the family gets no dates, and a date id is "not found" (P0002) like an unknown id', async () => {
    const outsider = cal(h.as('joiner'));
    const id = await add({ kind: 'birthday', label: `Mia ${stamp()}`, month: 3, day: 14, memberId: null });
    expect(await outsider.familyDates(h.spaceId)).toEqual([]);
    expect(await code(outsider.deleteFamilyDate(id))).toBe('P0002');
    expect(await code(outsider.saveFamilyDate({ space: h.spaceId, id, kind: 'birthday', label: 'Changed', month: 1, day: 1, memberId: null }))).toBe('P0002');
    expect(await code(outsider.setMyBirthday(h.spaceId, 1, 1))).toBe('P0002');
    expect(await code(parent.deleteFamilyDate('00000000-0000-4000-8000-000000000000'))).toBe('P0002');
    expect((await parent.familyDates(h.spaceId)).find((r) => r.id === id)).toMatchObject({ month: 3, day: 14 });
  });

  it('CAL-2 signed out: no dates come back', async () => {
    const anon = cal(h.anon());
    const r = await anon.familyDates(h.spaceId).then((rows) => rows.length, (e) => (e instanceof ApiError ? e.code : String(e)));
    expect([0, '42501', 'AUTH']).toContain(r);
  });

  it('CAL-3 any member (a viewer too) saves their own birthday; a second call changes it; null and null clears it', async () => {
    const me = (await viewer.getSession())!.userId;
    const mineNow = async () => (await other.familyDates(h.spaceId)).filter((r) => r.member_id === me && r.kind === 'birthday');
    await viewer.setMyBirthday(h.spaceId, 12, 8);
    expect(await mineNow()).toEqual([expect.objectContaining({ month: 12, day: 8, member_id: me })]);
    await viewer.setMyBirthday(h.spaceId, 12, 9);
    expect(await mineNow()).toEqual([expect.objectContaining({ month: 12, day: 9 })]);
    await viewer.setMyBirthday(h.spaceId, null, null);
    expect(await mineNow()).toEqual([]);
  });

  it('CAL-4 Feb 30, Apr 31, month 13 and day 0 fail with 22023 and store nothing; Feb 29 is accepted', async () => {
    const me = (await viewer.getSession())!.userId;
    for (const [m, d] of [[2, 30], [4, 31], [13, 1], [1, 0]] as const) {
      expect({ m, d, code: await code(viewer.setMyBirthday(h.spaceId, m, d)) }).toEqual({ m, d, code: '22023' });
      expect({ m, d, code: await code(parent.saveFamilyDate({ space: h.spaceId, id: null, kind: 'other', label: 'Bad day', month: m, day: d, memberId: null })) })
        .toEqual({ m, d, code: '22023' });
    }
    const rows = await parent.familyDates(h.spaceId);
    expect(rows.filter((r) => r.label === 'Bad day' || r.member_id === me)).toEqual([]);
    await viewer.setMyBirthday(h.spaceId, 2, 29);
    expect((await parent.familyDates(h.spaceId)).find((r) => r.member_id === me)).toMatchObject({ month: 2, day: 29 });
  });

  it('CAL-5 a viewer can\'t add, change or delete someone else\'s date (P0002) and nothing changes', async () => {
    const id = await add({ kind: 'birthday', label: `Mia ${stamp()}`, month: 3, day: 14, memberId: null });
    expect(await code(viewer.saveFamilyDate({ space: h.spaceId, id: null, kind: 'birthday', label: 'Leo', month: 8, day: 8, memberId: null }))).toBe('P0002');
    expect(await code(viewer.saveFamilyDate({ space: h.spaceId, id, kind: 'birthday', label: 'Mia', month: 1, day: 1, memberId: null }))).toBe('P0002');
    expect(await code(viewer.deleteFamilyDate(id))).toBe('P0002');
    const rows = await parent.familyDates(h.spaceId);
    expect(rows.find((r) => r.id === id)).toMatchObject({ month: 3, day: 14 });
    expect(rows.find((r) => r.label === 'Leo')).toBeUndefined();
  });

  it('CAL-5 a viewer may delete her own birthday', async () => {
    const me = (await viewer.getSession())!.userId;
    await viewer.setMyBirthday(h.spaceId, 5, 5);
    const mine = (await viewer.familyDates(h.spaceId)).find((r) => r.member_id === me)!;
    await viewer.deleteFamilyDate(mine.id);
    expect((await viewer.familyDates(h.spaceId)).find((r) => r.member_id === me)).toBeUndefined();
  });

  it('CAL-6 a parent adds, changes and deletes any date; labels over 60 or blank (no member) fail 22023', async () => {
    const t = stamp();
    const kid = await add({ kind: 'birthday', label: `  Mia ${t}  `, month: 3, day: 14, memberId: null });
    const anniv = await add({ kind: 'anniversary', label: `Chase and Alex ${t}`, month: 6, day: 20, memberId: null });
    const them = (await other.getSession())!.userId;
    const theirs = await add({ kind: 'birthday', label: null, month: 9, day: 1, memberId: them });
    let rows = await viewer.familyDates(h.spaceId);
    expect(rows.find((r) => r.id === kid)).toMatchObject({ kind: 'birthday', label: `Mia ${t}`, month: 3, day: 14, member_id: null });
    expect(rows.find((r) => r.id === anniv)).toMatchObject({ kind: 'anniversary', month: 6, day: 20 });
    expect(rows.find((r) => r.id === theirs)).toMatchObject({ kind: 'birthday', member_id: them, month: 9, day: 1 });

    expect(await parent.saveFamilyDate({ space: h.spaceId, id: kid, kind: 'birthday', label: `Mia ${t}`, month: 3, day: 15, memberId: null })).toBe(kid);
    await parent.deleteFamilyDate(anniv);
    rows = await viewer.familyDates(h.spaceId);
    expect(rows.find((r) => r.id === kid)).toMatchObject({ day: 15 });
    expect(rows.find((r) => r.id === anniv)).toBeUndefined();

    const bad = (label: string | null) => parent.saveFamilyDate({ space: h.spaceId, id: null, kind: 'other', label, month: 1, day: 1, memberId: null });
    expect(await code(bad('x'.repeat(61)))).toBe('22023');
    expect(await code(bad('   '))).toBe('22023');
    expect(await code(bad(null))).toBe('22023');
  });

  it('CAL-7 a member\'s own birthday shows their current name after they rename', async () => {
    const me = (await viewer.getSession())!.userId;
    const before = (await viewer.myProfile()).display_name;
    const t = stamp();
    try {
      await viewer.setMyBirthday(h.spaceId, 7, 7);
      await viewer.setMyName(`Gammy ${t}`);
      expect((await parent.familyDates(h.spaceId)).find((r) => r.member_id === me)).toMatchObject({ member_name: `Gammy ${t}` });
    } finally {
      if (before) await viewer.setMyName(before).catch(() => undefined);
    }
  });

  it('CAL-9 no row carries a year or an age', async () => {
    await viewer.setMyBirthday(h.spaceId, 12, 8);
    await add({ kind: 'anniversary', label: `Anniv ${stamp()}`, month: 6, day: 20, memberId: null });
    const rows = await viewer.familyDates(h.spaceId);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(Object.keys(r).filter((k) => /year|(^|_)age($|_)|born|dob/i.test(k))).toEqual([]);
      expect(Object.keys(r).sort()).toEqual(['day', 'id', 'kind', 'label', 'member_id', 'member_name', 'month']);
    }
  });
});

describe('CAL-11 the app and its contract', () => {
  it('CAL-11 HearthApi\'s Fake has familyDates, setMyBirthday, saveFamilyDate and deleteFamilyDate', async () => {
    const h = await fakeHarness();
    const api = h.as('poster') as unknown as Record<string, unknown>;
    expect(['familyDates', 'setMyBirthday', 'saveFamilyDate', 'deleteFamilyDate'].filter((m) => typeof api[m] !== 'function')).toEqual([]);
  });

  it('CAL-11 SupabaseApi calls the four 0029 RPCs with the spec\'s parameter names', async () => {
    const calls: [string, Record<string, unknown>][] = [];
    const client = { rpc: async (name: string, args: Record<string, unknown>) => { calls.push([name, args]); return { data: name === 'list_family_dates' ? [] : name === 'save_family_date' ? 'new-id' : null, error: null }; } };
    const api = cal(new SupabaseApi({ url: 'http://127.0.0.1:9', anonKey: 'anon', client: client as never, accessToken: async () => null }));
    expect(await api.familyDates('S')).toEqual([]);
    await api.setMyBirthday('S', 12, 8);
    await api.setMyBirthday('S', null, null);
    expect(await api.saveFamilyDate({ space: 'S', id: null, kind: 'birthday', label: 'Mia', month: 3, day: 14, memberId: null })).toBe('new-id');
    await api.deleteFamilyDate('D');
    expect(calls).toEqual([
      ['list_family_dates', { p_space: 'S' }],
      ['set_my_birthday', { p_space: 'S', p_month: 12, p_day: 8 }],
      ['set_my_birthday', { p_space: 'S', p_month: null, p_day: null }],
      ['save_family_date', { p_space: 'S', p_id: null, p_kind: 'birthday', p_label: 'Mia', p_month: 3, p_day: 14, p_member: null }],
      ['delete_family_date', { p_id: 'D' }],
    ]);
  });

  it('CAL-11 docs/eng/API.md has a "Life calendar (0029)" section naming the four RPCs', () => {
    const doc = fs.readFileSync(path.join(__dirname, '../../../../docs/eng/API.md'), 'utf8');
    const at = doc.search(/^## Life calendar \(0029/m);
    expect(at).toBeGreaterThanOrEqual(0);
    const end = doc.indexOf('\n## ', at + 1);
    const section = doc.slice(at, end < 0 ? undefined : end);
    for (const rpc of ['list_family_dates', 'set_my_birthday', 'save_family_date', 'delete_family_date']) expect(section).toContain(rpc);
  });
});
