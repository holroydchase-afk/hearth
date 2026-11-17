// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Review round 6 (ux-reviewer, Nov 17). Written first (red) by qa-tdd, Nov 17.
//
// The engineer's contract (everything else is found by role, label and words):
//   - UX-R39 / AC-R39: New for you's "See all" quiet button has paddingHorizontal 16 and marginRight -16, so its box
//     ends at the screen edge and its words sit on the 16 pt gutter; its target stays ≥ 48 pt tall.
//   - UX-R40 / AC-R40: the comment input's lineHeight is at least 1.3 × its fontSize: 22 at 17 pt, 28 at 21 pt
//     (Bigger text). paddingVertical is (48 − lineHeight) / 2, so the text stays centered on "Post" within 1 pt with
//     Bigger text on and off. Checked on the style in jest (no layout engine).
import { screen, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { FeedScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';
import { NewForYouRow } from '../NewForYou';

const { dadSide } = FIXTURE.circles;
const SEEN = (u: string) => `hearth.lastSeen.v1.${u}`;
const PREFS = (u: string) => `hearth.prefs.v1.${u}`;
const HOUR = 3600e3;
const MIN_TARGET = 48;
const GUTTER = 16;
const slow = { timeout: 4000 };

const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const num = (v: unknown) => (typeof v === 'number' ? v : 0);

const kvFor = (user: string, bigText = false) => memoryKV({
  [SEEN(user)]: new Date(Date.now() + HOUR).toISOString(),
  [PREFS(user)]: JSON.stringify({ bigText, notify: 'push', look: 'light', color: 'ember' }),
});
async function feedCard(user: 'jo', bigText = false) {
  const be = FakeBackend.withFixture();
  be.state.spaces[FIXTURE.space.id]!.reply_audience = 'everyone';
  const { id } = await seedPost(be, { caption: 'First snow!', circles: [dadSide.id], author: FIXTURE.users.chase.id });
  await renderApp(<FeedScreen />, { be, kv: kvFor(FIXTURE.users[user].id, bigText), user });
  const card = await screen.findByTestId(`post-${id}`, {}, slow);
  await within(card).findByTestId(`who-${id}`, {}, slow);
  return { be, id, card };
}

// =================================================================================================================
describe('UX-R39 AC-R39 (P2) New for you: "See all" box ends at the screen edge, words on the 16 pt gutter', () => {
  it('UX-R39 AC-R39 See all: paddingHorizontal 16, marginRight -16, min height ≥ 48', async () => {
    await renderApp(<NewForYouRow posts={[]} since={new Date().toISOString()} onSee={() => {}} />, { user: 'jo' });
    const row = await screen.findByTestId('new-for-you');
    const s = flat(within(row).getByRole('button', { name: 'See all the new photos, one at a time' }).props.style);
    expect({
      paddingRight: s.paddingRight ?? s.paddingHorizontal,
      paddingLeft: s.paddingLeft ?? s.paddingHorizontal,
      marginRight: s.marginRight,
      tallEnough: num(s.minHeight) >= MIN_TARGET,
    }).toEqual({ paddingRight: GUTTER, paddingLeft: GUTTER, marginRight: -GUTTER, tallEnough: true });
  });
});

// =================================================================================================================
describe('UX-R40 AC-R40 (P2) the comment input: a 1.3× line, centered on "Post" at both text sizes', () => {
  it.each([
    [false, 17, 22],
    [true, 21, 28],
  ] as const)('UX-R40 AC-R40 bigText=%s: fontSize %i has lineHeight %i and paddingVertical (48 − lineHeight)/2', async (bigText, fontSize, lineHeight) => {
    const { card } = await feedCard('jo', bigText);
    const input = flat(within(card).getByLabelText('Add a comment for Chase').props.style);
    const lh = num(input.lineHeight);
    expect({
      fontSize: input.fontSize,
      lineHeight: input.lineHeight,
      atLeast13x: lh >= Math.round(1.3 * num(input.fontSize)),
      paddingVertical: input.paddingVertical ?? input.paddingTop,
    }).toEqual({ fontSize, lineHeight, atLeast13x: true, paddingVertical: (MIN_TARGET - lineHeight) / 2 });
  });

  it.each([false, true])('UX-R40 AC-R40 bigText=%s: the text line centers on "Post" within 1 pt', async (bigText) => {
    const { id, card } = await feedCard('jo', bigText);
    const input = flat(within(card).getByLabelText('Add a comment for Chase').props.style);
    const row = within(card).getByTestId(`reply-${id}`);
    const post = flat(within(row).getByRole('button', { name: 'Post' }).props.style);
    const fontSize = num(input.fontSize);
    const lh = num(input.lineHeight);
    const pv = num(input.paddingVertical ?? input.paddingTop);
    // The row lines its children up at the bottom (alignItems flex-end), so measure both centers from the bottom.
    const inputH = Math.max(num(input.minHeight), 2 * pv + lh);
    const textFromBottom = inputH - pv - lh / 2;
    const postH = Math.max(num(post.minHeight), 2 * num(post.paddingVertical) + Math.round(fontSize * 1.2));
    const postFromBottom = postH / 2;
    expect({ line13x: lh >= Math.round(1.3 * fontSize), centered: Math.abs(textFromBottom - postFromBottom) <= 1, inputH })
      .toEqual({ line13x: true, centered: true, inputH: MIN_TARGET });
  });
});
