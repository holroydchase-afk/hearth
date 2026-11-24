// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// CAL-19 (docs/product/SPEC-LIFE-CALENDAR.md): the public demo's dates, set relative to the visit so the Gallery
// line always shows. Written FIRST (Nov 24, qa-tdd): red until the demo seeds them. The page itself:
// e2e-web/demo-calendar.spec.js.
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import type { HearthApi } from '../../api/HearthApi';
import { demoSeedVersion, seedDemo, type DemoPicture } from '../seed';

interface Row { id: string; kind: string; label: string | null; month: number; day: number; member_id: string | null }
const picture = async (name: string): Promise<DemoPicture> => {
  const fill = name.charCodeAt(0);
  return { display: new Uint8Array(3000).fill(fill), thumb: new Uint8Array(300).fill(fill + 1), width: 1200, height: 900 };
};
const md = (d: Date) => ({ month: d.getMonth() + 1, day: d.getDate() });

async function demoDates(): Promise<Row[]> {
  const be = FakeBackend.withFixture({ joIsMember: true });
  await seedDemo(be, picture);
  const api = be.clientFor(FIXTURE.users.chase.id) as unknown as HearthApi & { familyDates(space: string): Promise<Row[]> };
  return api.familyDates(FIXTURE.space.id);
}

describe('CAL-19 the demo family has dates', () => {
  it('CAL-19 Grandma Jo\'s birthday is today and Grandpa Earl\'s is in 9 days, counted from the visit', async () => {
    const rows = await demoDates();
    const today = new Date();
    const in9 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 9);
    expect(rows.find((r) => r.member_id === FIXTURE.users.jo.id && r.kind === 'birthday')).toMatchObject(md(today));
    expect(rows.find((r) => r.member_id === FIXTURE.users.earl.id && r.kind === 'birthday')).toMatchObject(md(in9));
  });

  it('CAL-19 a made-up kid\'s birthday (Mia) and Chase and Alex\'s anniversary', async () => {
    const rows = await demoDates();
    expect(rows.filter((r) => r.kind === 'birthday' && r.member_id === null && /^Mia\b/.test(r.label ?? ''))).toHaveLength(1);
    expect(rows.filter((r) => r.kind === 'anniversary' && /^Chase and Alex\b/.test(r.label ?? ''))).toHaveLength(1);
  });

  it('CAL-19 the demo seed version moves on from the pre-calendar one, so returning visitors get the dates', () => {
    expect(demoSeedVersion()).not.toBe('659ibx'); // demoSeedVersion() on main before CAL-19 (Nov 24)
  });
});
