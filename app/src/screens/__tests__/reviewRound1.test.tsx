// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Review round 1 of the live demo (ux-reviewer, Chase's iPhone screenshots IMG_5378..5381, Nov 17).
// SPEC-REDESIGN RD-35..RD-43. Written first (red), Nov 17. UX-R3, R4 and R11 wait on Chase and are not here.
// UX-R7 (square, edge-to-edge grid) and the real keyboard part of UX-R1 are in e2e-web/demo.spec.js.
//
// The engineer's contract (everything else is found by role and words):
//   - UX-R1: while any text field is focused (the comment field, a kit Field) Hearth's tab bar is not drawn; on blur it
//     comes back. Focus is the trigger so the web build behaves the same (no Keyboard events there).
//   - UX-R2: testID `new-one-at-a-time` moves to the walk's whole screen; the post scrolls inside it and the step
//     buttons sit in testID `walk-bar`, a row pinned under the scroll (not inside any ScrollView), hairline on top.
//     Previous is always there (disabled on the first); the forward button is spoken "Next new photo" and shows
//     "Next photo" ("Done, back to Gallery" / "Done" on the last).
//   - UX-R5/R6: no 💬 button. (UX-R16, round 2: no "Comments" heading any more.) A field shown as "Add a comment…" and
//     spoken "Add a comment for <sender>" ("Add a comment" on your own post), with a "Post" text button.
//   - UX-R10: when the people who will read my comment are exactly the people who can see the post, the line under
//     the field is "Your comment goes to the same people."; when fewer people read it, it names them as today.
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Platform, StyleSheet, Text, TextInput } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { GalleryScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';
import { Field } from '../../ui/kit';
import { paletteFor } from '../../ui/theme';
import { PhotosScreen } from '../PhotosScreen';
import { HearthTabBar, type TabName } from '../TabBar';

const { dadSide } = FIXTURE.circles;
const { jo } = FIXTURE.users;
const KEY = (u: string) => `hearth.lastSeen.v1.${u}`;
const HOUR = 3600e3;
const light = () => paletteFor(Platform.OS as 'ios', false);

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const isHost = (n: Inst) => typeof n.type === 'string';
const num = (...v: unknown[]) => Number(v.find((x) => typeof x === 'number') ?? 0);
const TRANSPARENT = /^(transparent|rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\))$/;
const noFill = (v: unknown) => v === undefined || v === null || TRANSPARENT.test(String(v));

function wordsIn(root: Inst): string {
  const parts: string[] = [];
  const walk = (c: unknown) => {
    if (typeof c === 'string' || typeof c === 'number') parts.push(String(c));
    else if (Array.isArray(c)) c.forEach(walk);
  };
  for (const t of root.findAll((n: Inst) => n.type === Text)) walk(t.props.children);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** Jo with new posts from Chase since her last visit, one with a title. */
async function joWithNew(captions: string[]) {
  const be = FakeBackend.withFixture();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const earlier = new Date(Math.max(midnight.getTime(), Date.now() - HOUR)).toISOString();
  const ids: string[] = [];
  for (const [i, caption] of captions.entries()) ids.push((await seedPost(be, { caption, title: i === 0 ? 'Fall colors' : null, circles: [dadSide.id] })).id);
  return { be, kv: memoryKV({ [KEY(jo.id)]: earlier }), ids };
}
async function openWalk(captions = ['First at the park', 'Then the cake']) {
  const { be, kv, ids } = await joWithNew(captions);
  await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
  fireEvent.press(within(await screen.findByTestId('new-for-you')).getByRole('button', { name: /^See all(?! the photos)/ }));
  return { be, ids, walk: await screen.findByTestId('new-one-at-a-time') };
}
async function oneCard(user: 'jo' | 'chase' = 'jo', replies: 'parents' | 'everyone' = 'parents') {
  const be = FakeBackend.withFixture();
  be.state.spaces[FIXTURE.space.id]!.reply_audience = replies;
  const { id } = await seedPost(be, { caption: 'At the lake', circles: [dadSide.id] });
  await renderApp(<PhotosScreen />, { be, user });
  return { be, id, card: await screen.findByTestId(`post-${id}`) };
}

// ---------------------------------------------------------------------------------------------------------------
describe('UX-R1 (P0) typing: the keyboard never covers the comment box', () => {
  const Both = () => (
    <>
      <PhotosScreen />
      <HearthTabBar role="viewer" current={'feed' as TabName} onNavigate={() => {}} />
    </>
  );

  it('UX-R1 while the comment field is focused the tab bar hides; on blur it comes back', async () => {
    const be = FakeBackend.withFixture();
    const { id } = await seedPost(be, { caption: 'At the lake', circles: [dadSide.id] });
    await renderApp(<Both />, { be, user: 'jo' });
    const card = await screen.findByTestId(`post-${id}`);
    expect(screen.getAllByRole('tab').length).toBe(3);
    const field = within(card).UNSAFE_getByType(TextInput);
    fireEvent(field, 'focus');
    await waitFor(() => expect(screen.queryAllByRole('tab')).toHaveLength(0));
    fireEvent(field, 'blur');
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBeGreaterThan(0));
  });

  it('UX-R1 any text field (kit Field, e.g. Share\'s caption) hides the tab bar while focused', async () => {
    await renderApp(
      <>
        <Field label="What's happening?" value="" onChangeText={() => {}} />
        <HearthTabBar role="owner" current={'share' as TabName} onNavigate={() => {}} />
      </>,
      { user: 'chase' },
    );
    const field = await screen.findByLabelText("What's happening?");
    expect(screen.getAllByRole('tab').length).toBe(4);
    fireEvent(field, 'focus');
    await waitFor(() => expect(screen.queryAllByRole('tab')).toHaveLength(0));
    fireEvent(field, 'blur');
    await waitFor(() => expect(screen.queryAllByRole('tab').length).toBeGreaterThan(0));
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('UX-R2 the walk\'s Previous and Next photo share one bar pinned at the bottom', () => {
  it('UX-R2 one bottom bar outside the scroll, hairline on top: Previous (left, disabled on the first) and "Next photo"', async () => {
    const { walk } = await openWalk();
    const bar = within(walk).getByTestId('walk-bar');
    let inScroll = false;
    for (let n: Inst | null = bar.parent; n; n = n.parent) if ((n.type as unknown) === 'RCTScrollView') inScroll = true;
    const s = flat(bar.props.style);
    const btns = bar.findAll((n: Inst) => isHost(n) && n.props.accessibilityRole === 'button');
    expect({
      inScroll,
      row: s.flexDirection,
      hairline: num(s.borderTopWidth) > 0,
      buttons: btns.map((b) => b.props.accessibilityLabel),
      prevDisabled: btns[0]?.props.accessibilityState?.disabled,
      nextWords: btns[1] ? wordsIn(btns[1]) : null,
    }).toEqual({
      inScroll: false,
      row: 'row',
      hairline: true,
      buttons: ['Previous new photo', 'Next new photo'],
      prevDisabled: true,
      nextWords: 'Next photo',
    });
    for (const b of btns) expect(Number(flat(b.props.style).minHeight)).toBeGreaterThanOrEqual(48);
  });

  it('UX-R2 on the last post the same bar holds Previous (enabled) and Done', async () => {
    await openWalk();
    fireEvent.press(within(screen.getByTestId('walk-bar')).getByRole('button', { name: 'Next new photo' }));
    await screen.findByText('Then the cake');
    const bar = screen.getByTestId('walk-bar');
    const btns = bar.findAll((n: Inst) => isHost(n) && n.props.accessibilityRole === 'button');
    expect(btns.map((b) => [b.props.accessibilityLabel, !!b.props.accessibilityState?.disabled])).toEqual([
      ['Previous new photo', false], ['Done, back to Gallery', false],
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('UX-R5 (Chase, Nov 17) no comment emoji; a standard comment field on every post', () => {
  it('UX-R5 the reaction row is the four emoji only (REACT-7 stands): no 💬, no words under them', async () => {
    const { id, card } = await oneCard();
    const row = within(card).getByTestId(`actions-${id}`);
    expect(within(row).getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['Love it', 'Haha', 'Like it', 'Hooray']);
    expect(within(row).UNSAFE_queryAllByType(Text).map((t) => String(t.props.children)).join(' ')).toBe('❤️ 😂 👍 🎉');
    expect(wordsIn(card)).not.toContain('💬');
    expect(within(card).queryByRole('button', { name: 'Write a comment' })).toBeNull();
  });

  it('UX-R5 UX-R16 a post with no comments still shows an "Add a comment…" field, and Post once you type', async () => {
    const { card } = await oneCard();
    const field = within(card).getByLabelText('Add a comment for Chase');
    expect(field.props.placeholder).toBe('Add a comment…');
    fireEvent.changeText(field, 'Hi'); // UX-R16: Post may stay hidden until there are words
    expect(await within(card).findByRole('button', { name: 'Post' })).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'Send' })).toBeNull();
  });

  it('UX-R5 typing and Post adds the comment (the field still sends)', async () => {
    const { be, id, card } = await oneCard();
    fireEvent.changeText(within(card).getByLabelText('Add a comment for Chase'), 'So cute!');
    fireEvent.press(within(card).getByRole('button', { name: 'Post' }));
    await waitFor(() => expect(Object.values(be.state.comments).map((x) => [x.post, x.body])).toEqual([[id, 'So cute!']]));
    expect(await within(screen.getByTestId(`post-${id}`)).findByText(/So cute!/)).toBeTruthy();
  });

  it('UX-R5 on your own post the field is spoken "Add a comment"', async () => {
    const { card } = await oneCard('chase');
    expect(within(card).getByLabelText('Add a comment')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('UX-R6 the comment field has a real label and Post looks on once you type', () => {
  // UX-R16 (review round 2) replaces UX-R6's "Comments" heading: the field's own words and spoken label carry it.
  it('UX-R6 UX-R16 the field is labeled for a screen reader, and no "Comments" heading sits above it', async () => {
    const { id, card } = await oneCard();
    expect(within(within(card).getByTestId(`reply-${id}`)).getByLabelText('Add a comment for Chase')).toBeTruthy();
    expect(within(card).queryByRole('header', { name: 'Comments' })).toBeNull();
  });

  it('UX-R6 UX-R16 Post is a text button: hidden, or grey and disabled, when empty; accent and enabled once there is text', async () => {
    const { card } = await oneCard();
    const c = light();
    const post = () => within(card).getByRole('button', { name: 'Post' });
    const color = () => flat(within(post()).getByText('Post').props.style).color;
    const empty = within(card).queryByRole('button', { name: 'Post' });
    if (empty) {
      expect(noFill(flat(empty.props.style).backgroundColor)).toBe(true); // a text button, not a grey capsule
      expect({ disabled: empty.props.accessibilityState?.disabled, color: color() }).toEqual({ disabled: true, color: c.muted });
    }
    fireEvent.changeText(within(card).getByLabelText('Add a comment for Chase'), 'Hi');
    await waitFor(() => expect({ disabled: post().props.accessibilityState?.disabled, color: color() }).toEqual({ disabled: false, color: c.accent }));
    expect(noFill(flat(post().props.style).backgroundColor)).toBe(true);
    expect(Number(flat(post().props.style).minHeight)).toBeGreaterThanOrEqual(48);
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('UX-R8 (P2) the walk has one 16 pt left edge', () => {
  /** Left inset from the walk's screen edge: ancestors' left padding plus every left margin on the way, plus the
   *  node's own left padding when `own` (a container whose children are the content). */
  function inset(node: Inst, root: Inst, own: boolean): number {
    const s0 = flat(node.props.style);
    let x = num(s0.marginLeft, s0.marginHorizontal, s0.margin) + (own ? num(s0.paddingLeft, s0.paddingHorizontal, s0.padding) : 0);
    for (let n = node.parent; n; n = n.parent) {
      if (isHost(n)) {
        // Under jest the ScrollView's content padding stays on RCTScrollView's contentContainerStyle.
        const s = { ...flat(n.props.style), ...((n.type as unknown) === 'RCTScrollView' ? flat(n.props.contentContainerStyle) : {}) };
        x += num(s.paddingLeft, s.paddingHorizontal, s.padding) + num(s.marginLeft, s.marginHorizontal, s.margin);
      }
      if (n === root) break;
    }
    return x;
  }

  it('UX-R8 heading, avatar row, title, caption and reactions all start 16 pt from the edge', async () => {
    const { walk, ids } = await openWalk();
    const id = ids[0]!;
    const heading = within(walk).getByRole('header', { name: 'New photos: 1 of 2' });
    const got = {
      heading: inset(heading, walk, false),
      head: inset(within(walk).getByTestId(`card-head-${id}`), walk, true),
      title: inset(within(walk).getByTestId(`post-title-${id}`), walk, true),
      caption: inset(within(walk).getByText('First at the park'), walk, false),
      reactions: inset(within(walk).getByTestId(`actions-${id}`), walk, true),
    };
    expect(got).toEqual({ heading: 16, head: 16, title: 16, caption: 16, reactions: 16 });
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('UX-R9 (P2) in the walk the accent is only on Next photo (RD-4)', () => {
  it('UX-R9 RD-50 "‹ Gallery" and "Post options" are ink; the only accent control is the forward button', async () => {
    const { walk } = await openWalk();
    const accent = light().accent;
    const owners = new Set<string>();
    const nodes = walk.findAll((n: Inst) => n.type === SymbolView || (isHost(n) && (n.type as unknown) === 'Text')) as Inst[];
    for (const n of nodes) {
      const colored = n.props.tintColor === accent || flat(n.props.style).color === accent;
      if (!colored) continue;
      let owner = 'not a button';
      for (let p: Inst | null = n; p; p = p.parent) if (isHost(p) && p.props.accessibilityRole === 'button') { owner = p.props.accessibilityLabel; break; }
      owners.add(owner);
    }
    expect([...owners]).toEqual(['Next new photo']);
  });
});

// ---------------------------------------------------------------------------------------------------------------
describe('UX-R10 (P2) one sentence about who sees it, unless the comment goes to fewer people', () => {
  it('UX-R10 replies open to everyone who can see it: "Your comment goes to the same people." and no second names line', async () => {
    const { card } = await oneCard('jo', 'everyone');
    fireEvent(within(card).getByLabelText('Add a comment for Chase'), 'focus'); // UX-R26 (RD-69): shown while commenting
    expect(await within(card).findByText('Your comment goes to the same people.')).toBeTruthy();
    expect(within(card).queryByText(/will read this\.$|can read this\.$/)).toBeNull();
    expect(within(card).getByText(/can see this\.$/)).toBeTruthy();
  });

  it('UX-R10 replies go to fewer people (the safe default): the line still names who will read it', async () => {
    const { card } = await oneCard('jo', 'parents');
    expect(await within(card).findByText('Alex and Chase will read this.')).toBeTruthy();
    expect(within(card).queryByText('Your comment goes to the same people.')).toBeNull();
  });
});
