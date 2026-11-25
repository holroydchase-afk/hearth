// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// T44 DEMO-NAMES-1..6 (Chase, Nov 24): the public demo's people get new made-up names. Parent Kevin -> Graham, mom
// Alex -> Eliza, Nana Ruth -> Nana Eloise, Grandpa Earl -> Grandpa Hollis, Aunt Bea -> Aunt Libby, kid Mia -> Clara;
// Grandma Jo stays ("Graham's mom"). Only the demo changes: the FakeBackend fixture keeps its names for other tests.
// Written FIRST (qa-tdd, Nov 24): red until the demo seed and DemoBar change. Page level: e2e-web/demo*.spec.js.
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { DemoBar } from '../DemoBar';
import { DEMO_DATES, DEMO_NAMES, DEMO_POSTS, demoSeedVersion, seedDemo } from '../seed';

const OLD = /\b(Kevin|Alex|Ruth|Earl|Bea|Mia)\b/;
const pic = async () => ({ display: new Uint8Array(10), thumb: new Uint8Array(5), width: 4, height: 3 });

async function seeded() {
  const be = FakeBackend.withFixture({ joIsMember: true });
  await seedDemo(be, pic);
  return be;
}

/** Every string and accessibility label a rendered tree shows. */
function words(): string[] {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (n == null) return;
    if (typeof n === 'string') { out.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    const node = n as { props?: Record<string, unknown>; children?: unknown };
    for (const k of ['accessibilityLabel', 'aria-label', 'accessibilityHint', 'title']) {
      const v = node.props?.[k];
      if (typeof v === 'string') out.push(v);
    }
    walk(node.children);
  };
  walk(screen.toJSON());
  return out;
}

/** A source file's string literals, comments left out (what a visitor can read, not notes to engineers). */
function literals(file: string): string[] {
  const src = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  return [...src.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? '');
}

describe('T44 DEMO-NAMES the demo family has new names', () => {
  it('DEMO-NAMES-1 DEMO_NAMES: Graham, Eliza, Nana Eloise, Grandpa Hollis by fixture user id', () => {
    expect(DEMO_NAMES).toEqual({
      [FIXTURE.users.chase.id]: 'Graham',
      [FIXTURE.users.alex.id]: 'Eliza',
      [FIXTURE.users.ruth.id]: 'Nana Eloise',
      [FIXTURE.users.earl.id]: 'Grandpa Hollis',
    });
  });

  it('DEMO-NAMES-1 the seeded people read Graham, Eliza, Nana Eloise, Grandpa Hollis and Grandma Jo', async () => {
    const be = await seeded();
    const u = FIXTURE.users;
    expect([u.chase, u.alex, u.ruth, u.earl, u.jo].map((x) => be.state.users[x.id]!.name))
      .toEqual(['Graham', 'Eliza', 'Nana Eloise', 'Grandpa Hollis', 'Grandma Jo']);
  });

  it('DEMO-NAMES-1 no old name (Kevin, Alex, Ruth, Earl, Bea, Mia) in DEMO_POSTS, DEMO_DATES, DEMO_NAMES or the seeded family', async () => {
    const seen = [
      ...Object.values(DEMO_NAMES),
      ...DEMO_POSTS.flatMap((p) => [p.caption, p.title ?? '', ...p.replies.map((r) => r.body)]),
      ...DEMO_DATES.labelled.map((d) => d.label),
    ];
    expect(seen.filter((w) => OLD.test(w))).toEqual([]);
    const be = await seeded();
    const visible = [
      ...Object.values(be.state.users).flatMap((x) => [x.name, x.email]),
      ...Object.values(be.state.posts).flatMap((p) => [p.caption ?? '', p.title ?? '']),
      ...Object.values(be.state.comments).map((c) => c.body),
      ...be.familyDates(FIXTURE.users.chase.id, FIXTURE.space.id).map((d) => d.label ?? ''),
    ];
    expect(visible.filter((w) => OLD.test(w))).toEqual([]);
  });

  it('DEMO-NAMES-1 post 4 credits Aunt Libby; the dates are Clara\'s birthday and Graham and Eliza\'s anniversary', () => {
    expect(DEMO_POSTS[3]!.caption).toBe('Aunt Libby taught the kids to make pancakes');
    expect(DEMO_DATES.labelled).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'birthday', label: 'Clara' }),
      expect.objectContaining({ kind: 'anniversary', label: 'Graham and Eliza' }),
    ]));
  });

  it('DEMO-NAMES-1 DEMO-NAMES-2 the demo bar, as Graham and as Grandma Jo, says no old name', async () => {
    const be = await seeded();
    render(<DemoBar be={be} reload={jest.fn()} startOver={jest.fn()} open={jest.fn()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Demo details', expanded: false }));
    expect(screen.getByText("You're Graham, a parent.")).toBeTruthy();
    expect(words().filter((w) => OLD.test(w))).toEqual([]);
    screen.unmount();
    be.state.appSession = FIXTURE.users.jo.id;
    render(<DemoBar be={be} reload={jest.fn()} startOver={jest.fn()} open={jest.fn()} />);
    fireEvent.press(screen.getByRole('button', { name: 'Demo details', expanded: false }));
    expect(screen.getByText("You're Grandma Jo, Graham's mom.")).toBeTruthy();
    expect(screen.getByText("Back to Graham's view")).toBeTruthy();
    expect(words().filter((w) => OLD.test(w))).toEqual([]);
  });

  it('DEMO-NAMES-1 no string in DemoBar, DemoFrame, DemoTip or seed.ts names an old demo person', () => {
    for (const f of ['DemoBar.tsx', 'DemoFrame.tsx', 'DemoTip.tsx', 'seed.ts']) {
      expect({ f, old: literals(f).filter((w) => OLD.test(w)) }).toEqual({ f, old: [] });
    }
  });

  it('DEMO-NAMES-3 the seed version moves on from the Kevin family, so a returning visitor re-seeds', () => {
    expect(demoSeedVersion()).not.toBe('napqej'); // demoSeedVersion() before T44 (Nov 24)
  });

  it('DEMO-NAMES-4 every demo email is valid: lower case, no spaces, @example.com', async () => {
    const be = await seeded();
    for (const x of Object.values(be.state.users)) expect(x.email).toMatch(/^[a-z0-9._+-]+@example\.com$/);
    const emails = Object.values(be.state.users).map((x) => x.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it('DEMO-NAMES-6 no demo name, title, caption, reply or date says Granddaddy', async () => {
    const be = await seeded();
    const all = [
      ...Object.values(be.state.users).map((x) => x.name),
      ...Object.values(be.state.posts).flatMap((p) => [p.caption ?? '', p.title ?? '']),
      ...Object.values(be.state.comments).map((c) => c.body),
      ...DEMO_DATES.labelled.map((d) => d.label),
      ...['DemoBar.tsx', 'DemoFrame.tsx', 'DemoTip.tsx', 'seed.ts'].flatMap(literals),
    ];
    expect(all.filter((w) => /grand\s*dadd?y/i.test(w))).toEqual([]);
  });
});
