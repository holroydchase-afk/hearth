// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Review round 5 (ux-reviewer, Nov 17). Written first (red) by qa-tdd, Nov 17.
//
// The engineer's contract (everything else is found by role, label and words):
//   - UX-R36 / AC-R36: the comment field's text input has lineHeight 22 and paddingVertical 13 at default size, so
//     the placeholder and the "Post" text button share a center (within 1 pt). In Bigger text the line is at least
//     as tall as the font and the two still center within 1 pt. Checked on the style in jest (no layout engine).
//   - UX-R37 / AC-R37: the number and its word never wrap apart: people(3) is "3\u00a0people" and people(1)
//     "1\u00a0person" (a no-break space). The first line of Post options on your own post ends with it.
//   - UX-R38 / AC-R38: New for you's "See all" quiet button sits flush with the right edge: marginRight equals
//     minus its paddingHorizontal (the words line up with the screen margin), and its target stays ≥ 48 pt.
import { fireEvent, screen, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { FeedScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';
import { people } from '../../ui/format';
import { NewForYouRow } from '../NewForYou';

const { dadSide } = FIXTURE.circles;
const SEEN = (u: string) => `hearth.lastSeen.v1.${u}`;
const PREFS = (u: string) => `hearth.prefs.v1.${u}`;
const HOUR = 3600e3;
const MIN_TARGET = 48;
const slow = { timeout: 4000 };

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const num = (v: unknown) => (typeof v === 'number' ? v : 0);
function textOf(n: Inst): string {
  const parts: string[] = [];
  const walk = (c: unknown) => {
    if (typeof c === 'string' || typeof c === 'number') parts.push(String(c));
    else if (Array.isArray(c)) c.forEach(walk);
    else if (c && typeof c === 'object' && 'props' in (c as object)) walk((c as { props: { children?: unknown } }).props.children);
  };
  walk(n.props.children);
  return parts.join('');
}
/** The outermost host Texts with words, in render order. */
function texts(root: Inst): string[] {
  const all = root.findAll((n: Inst) => (n.type as unknown) === 'Text') as Inst[];
  const inner = new Set<Inst>();
  for (const n of all) for (const m of n.findAll((x: Inst) => x !== n && (x.type as unknown) === 'Text') as Inst[]) inner.add(m);
  return all.filter((n) => !inner.has(n)).map(textOf).filter((w) => w.trim());
}

const kvFor = (user: string, bigText = false) => memoryKV({
  [SEEN(user)]: new Date(Date.now() + HOUR).toISOString(),
  [PREFS(user)]: JSON.stringify({ bigText, notify: 'push', look: 'light', color: 'ember' }),
});
async function feedCard(user: 'jo' | 'chase', bigText = false) {
  const be = FakeBackend.withFixture();
  be.state.spaces[FIXTURE.space.id]!.reply_audience = 'everyone';
  const { id } = await seedPost(be, { caption: 'First snow!', circles: [dadSide.id], author: FIXTURE.users.chase.id });
  await renderApp(<FeedScreen />, { be, kv: kvFor(FIXTURE.users[user].id, bigText), user });
  const card = await screen.findByTestId(`post-${id}`, {}, slow);
  await within(card).findByTestId(`who-${id}`, {}, slow);
  return { be, id, card };
}

// =================================================================================================================
describe('UX-R36 AC-R36 (P2) the comment field: placeholder and "Post" share a center', () => {
  it('UX-R36 AC-R36 default size: the text input has lineHeight 22 and paddingVertical 13', async () => {
    const { card } = await feedCard('jo');
    const input = flat(within(card).getByLabelText('Add a comment for Chase').props.style);
    expect({ lineHeight: input.lineHeight, paddingVertical: input.paddingVertical ?? input.paddingTop })
      .toEqual({ lineHeight: 22, paddingVertical: 13 });
  });

  it.each([false, true])('UX-R36 AC-R36 bigText=%s: the placeholder line centers on "Post" within 1 pt', async (bigText) => {
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
    expect({ lineFitsFont: lh >= fontSize, centered: Math.abs(textFromBottom - postFromBottom) <= 1, textFromBottom, postFromBottom })
      .toEqual({ lineFitsFont: true, centered: true, textFromBottom: expect.any(Number), postFromBottom: expect.any(Number) });
  });
});

// =================================================================================================================
describe('UX-R37 AC-R37 (P2) "3 people", and Post options leads with it', () => {
  it('UX-R37 AC-R37 people(3) is "3 people" with a no-break space; people(1) is "1 person"', () => {
    expect([people(3), people(1)]).toEqual(['3\u00a0people', '1\u00a0person']);
  });

  it('UX-R37 AC-R37 the first line of Post options on my own post is "Shared with <group>, 3 people" (no-break space)', async () => {
    const { id, card } = await feedCard('chase'); // Grandparents – Dad's side has 3 people in the fixture
    fireEvent.press(within(card).getByRole('button', { name: 'Post options' }));
    const menu = await screen.findByTestId(`more-${id}`);
    expect(texts(menu)[0]).toBe(`Shared with ${dadSide.name}, 3\u00a0people`);
  });
});

// =================================================================================================================
describe('UX-R38 AC-R38 (P2) New for you: "See all" sits flush right with a 48 pt target', () => {
  it('UX-R38 AC-R38 the See all quiet button: marginRight = -paddingHorizontal, target ≥ 48', async () => {
    await renderApp(<NewForYouRow posts={[]} since={new Date().toISOString()} onSee={() => {}} />, { user: 'jo' });
    const row = await screen.findByTestId('new-for-you');
    const s = flat(within(row).getByRole('button', { name: 'See all the new photos, one at a time' }).props.style);
    const pad = num(s.paddingHorizontal ?? s.paddingRight);
    expect({ pad: pad > 0, marginRight: s.marginRight, minHeight: num(s.minHeight) >= MIN_TARGET, minWidth: num(s.minWidth) >= MIN_TARGET })
      .toEqual({ pad: true, marginRight: -pad, minHeight: true, minWidth: true });
  });
});
