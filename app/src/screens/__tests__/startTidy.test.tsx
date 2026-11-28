// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// TIDY-1 (Chase's calls): on the Gallery start screen "New for you" comes first and the birthday line (CAL-16) is one
// quiet Body 17 line, no big Card, with a small "See birthdays" 48 pt text button. Written FIRST by qa-tdd; red until built.
import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { GalleryScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';
import { TYPE } from '../../ui/theme';

const { dadSide } = FIXTURE.circles;
const { jo, earl } = FIXTURE.users;
const SPACE = FIXTURE.space.id;
const slow = { timeout: 5000 };
type Node = { type: unknown; props: Record<string, unknown>; findAll: (f: (n: Node) => boolean) => Node[] };
const flat = (s: unknown) =>
  (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ??
    {}) as Record<string, unknown>;
const order = () =>
  (
    screen.UNSAFE_root.findAll((n: Node) => typeof n.type === 'string' && typeof n.props.testID === 'string') as Node[]
  ).map((n) => n.props.testID as string);

/** Jo (Easy view off, so Body is 17) with a new post from Chase since her last visit, and Earl's birthday today. */
async function joWithNewAndBirthday() {
  const be = FakeBackend.withFixture();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const lastVisit = new Date(Math.max(midnight.getTime(), Date.now() - 3600e3)).toISOString();
  await seedPost(be, { caption: 'Pumpkin patch', circles: [dadSide.id] });
  const now = new Date();
  await be
    .clientFor(FIXTURE.users.chase.id)
    .saveFamilyDate({
      space: SPACE,
      id: null,
      kind: 'birthday',
      label: null,
      month: now.getMonth() + 1,
      day: now.getDate(),
      memberId: earl.id,
    });
  const kv = memoryKV({
    [`hearth.lastSeen.v1.${jo.id}`]: lastVisit,
    [`hearth.prefs.v1.${jo.id}`]: JSON.stringify({ easyView: false }),
  });
  await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
  await screen.findByTestId('new-for-you', {}, slow);
  await screen.findByTestId('today-line', {}, slow);
}

describe('TIDY-1 Gallery start screen is tidy', () => {
  it('TIDY-1a "New for you" comes before the birthday line', async () => {
    await joWithNewAndBirthday();
    const o = order();
    expect(o.indexOf('new-for-you')).toBeGreaterThanOrEqual(0);
    expect(o.indexOf('new-for-you')).toBeLessThan(o.indexOf('today-line'));
  });

  it('TIDY-1b the birthday line is Body 17 text, not title2, and not a Card', async () => {
    await joWithNewAndBirthday();
    const line = screen.getByTestId('today-line') as unknown as Node;
    const text = line.findAll(
      (n) => n.type === Text && /^Today/.test(String(([] as unknown[]).concat(n.props.children).join(''))),
    )[0];
    expect(text).toBeTruthy();
    expect(flat(text!.props.style).fontSize).toBe(TYPE.standard.body.fontSize);
    expect(flat(text!.props.style).fontSize).not.toBe(TYPE.standard.title2.fontSize);
    const box = flat(line.props.style);
    expect(box.backgroundColor).toBeUndefined();
    expect(box.borderRadius).toBeUndefined();
  });

  it('TIDY-1c "See birthdays" stays a 48 pt button and opens the list', async () => {
    await joWithNewAndBirthday();
    const btn = screen.getByRole('button', { name: 'See birthdays' });
    expect(Number(flat(btn.props.style).minHeight)).toBeGreaterThanOrEqual(48);
    fireEvent.press(btn);
    expect(await screen.findByRole('header', { name: 'Birthdays and dates' }, slow)).toBeTruthy();
  });
});
