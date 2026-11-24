// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// REACT-13a..d (Chase, Nov 24, live demo Feed): the reaction emoji 😂 👍 🎉 look small and blurry while ❤️ is crisp,
// and the ❤️ pill doesn't line up with the photo. Written first (red), Nov 24, by qa-tdd.
// Cause (measured on the live demo): the emoji Text has no fixed width (27.453 px), so every pill is 61.453 px wide and
// every pill after the first starts at a fractional x; Apple Color Emoji are bitmaps and resample (blur) there. RD-64's
// firstReact marginLeft -8 predates RD-114's outlines, so the first pill's outline sticks 8 px past the 16 pt edge.
// The web demo check: e2e-web/demo-screens.spec.js (REACT-13 whole-pixel pills).
//
// The engineer's contract:
//   - REACT-13a: each reaction emoji sits in a fixed 28 x 28 box (the emoji Text or a wrapper inside the pill),
//     centered, so pill widths and x positions are whole pixels.
//   - REACT-13b: on web the emoji Text's fontFamily lists "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"
//     first, in that order; iOS and Android set no fontFamily (the phone's default emoji font). Chosen at render time
//     (Platform.OS read when rendering), since the test switches Platform.OS per case.
//   - REACT-13c: no reaction pill has a negative margin; the first pill's outline starts on the 16 pt edge, the same
//     edge as the photo inset.
//   - REACT-13d: the count is a whole number of points wide: minWidth (or width) = slot x digits, where slot is the
//     empty count-slot width the pill already uses at 0, for 1 and 2 digit counts (normal and Bigger text).
import { screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { FeedScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';

const { dadSide } = FIXTURE.circles;
const { jo, chase } = FIXTURE.users;
const SEEN = (u: string) => `hearth.lastSeen.v1.${u}`;
const PREFS = (u: string) => `hearth.prefs.v1.${u}`;
const HOUR = 3600e3;
const slow = { timeout: 5000 };
const PILLS: Array<[string, string]> = [['❤️', 'Love it'], ['😂', 'Haha'], ['👍', 'Like it'], ['🎉', 'Hooray']];
const EMOJI_FONTS = ['Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji'];
const EDGE = 16;

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const isHost = (n: Inst) => typeof n.type === 'string';
const num = (...x: unknown[]) => x.find((y) => typeof y === 'number') as number | undefined;

const kv = (bigText = false) => memoryKV({
  [SEEN(jo.id)]: new Date(Date.now() + HOUR).toISOString(),
  [PREFS(jo.id)]: JSON.stringify({ look: 'light', bigText, notify: 'push', color: 'ember' }),
});

/** A Feed with one post; `counts` adds that many reactions per emoji straight into the fake's state. */
async function feed(opts: { counts?: Partial<Record<string, number>>; bigText?: boolean } = {}) {
  const be = FakeBackend.withFixture();
  const post = await seedPost(be, { caption: 'First snow!', photos: 1, circles: [dadSide.id] });
  for (const [emoji, n] of Object.entries(opts.counts ?? {})) {
    for (let i = 0; i < (n ?? 0); i++) be.state.hearts.push({ post: post.id, user: chase.id, emoji } as never);
  }
  await renderApp(<FeedScreen />, { be, user: 'jo', kv: kv(opts.bigText) });
  const card = await screen.findByTestId(`post-${post.id}`, {}, slow);
  await waitFor(() => expect(within(card).getByRole('button', { name: 'Love it' })).toBeTruthy(), slow);
  return { card, id: post.id };
}
const pill = (card: Inst, label: string) => within(card).getByRole('button', { name: label });
/** The host node that draws the pill (Pressable's host View), whose style holds the margin, border and padding. */
const pillHost = (p: Inst): Inst => (isHost(p) ? p : (p.findAll(isHost)[0] as Inst));
const emojiText = (p: Inst, emoji: string) => p.findAll((n: Inst) => n.type === Text && String(n.props.children) === emoji)[0] as Inst;
/** The emoji Text and each host ancestor up to (not including) the pill's own host. */
function emojiChain(p: Inst, emoji: string): Inst[] {
  const top = pillHost(p);
  const out: Inst[] = [];
  let n: Inst | null = emojiText(p, emoji);
  while (n && n !== top) {
    if (isHost(n) || n.type === Text) out.push(n);
    n = n.parent;
  }
  return out;
}

afterEach(() => jest.restoreAllMocks());

describe('REACT-13a each emoji sits in a fixed whole-number 28 x 28 box', () => {
  for (const [emoji, label] of PILLS) {
    it(`REACT-13a ${emoji} ${label}: the emoji (or its wrapper in the pill) is exactly 28 x 28 and centered`, async () => {
      const { card } = await feed();
      const boxes = emojiChain(pill(card, label), emoji).map((n) => {
        const s = flat(n.props.style);
        return { w: num(s.width), h: num(s.height), centered: s.textAlign === 'center' || (s.alignItems === 'center' && s.justifyContent === 'center') };
      });
      expect(boxes.find((b) => b.w === 28 && b.h === 28 && b.centered) ?? boxes).toEqual({ w: 28, h: 28, centered: true });
    });
  }
});

describe('REACT-13b on web the emoji names the color emoji fonts first', () => {
  it('REACT-13b web: the emoji Text fontFamily starts "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const { card } = await feed();
    for (const [emoji, label] of PILLS) {
      const fam = String(flat(emojiText(pill(card, label), emoji).props.style).fontFamily ?? '');
      const names = fam.split(',').map((f) => f.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      expect({ emoji, first: names.slice(0, 3) }).toEqual({ emoji, first: EMOJI_FONTS });
    }
  });
  for (const os of ['ios', 'android'] as const) {
    it(`REACT-13b ${os}: the emoji Text sets no fontFamily (the phone's own emoji font)`, async () => {
      jest.replaceProperty(Platform, 'OS', os);
      const { card } = await feed();
      for (const [emoji, label] of PILLS) {
        expect({ emoji, fontFamily: flat(emojiText(pill(card, label), emoji).props.style).fontFamily }).toEqual({ emoji, fontFamily: undefined });
      }
    });
  }
});

describe('REACT-13c the first pill lines up with the photo on the 16 pt edge', () => {
  it('REACT-13c no reaction pill has a negative margin (RD-64\'s -8 is gone)', async () => {
    const { card } = await feed();
    for (const [, label] of PILLS) {
      const s = flat(pillHost(pill(card, label)).props.style);
      const margins = ['margin', 'marginHorizontal', 'marginLeft', 'marginStart', 'marginRight', 'marginEnd']
        .map((k) => [k, s[k]] as const).filter(([, v]) => typeof v === 'number' && v < 0);
      expect({ label, negative: margins }).toEqual({ label, negative: [] });
    }
  });
  it('REACT-13c the first pill\'s outline starts on the same 16 pt edge as the photo', async () => {
    const { card, id } = await feed();
    const row = flat(within(card).getByTestId(`actions-${id}`).props.style);
    const rowLeft = num(row.paddingLeft, row.paddingStart, row.paddingHorizontal, row.padding) ?? 0;
    const first = flat(pillHost(pill(card, 'Love it')).props.style);
    const firstLeft = num(first.marginLeft, first.marginStart, first.marginHorizontal, first.margin) ?? 0;
    expect(rowLeft + firstLeft).toBe(EDGE);
  });
});

describe('REACT-13d the count box is a whole number of points wide', () => {
  const countWidth = (card: Inst, label: string, n: number) => {
    const t = pill(card, label).findAll((x: Inst) => x.type === Text && String(x.props.children) === String(n))[0] as Inst;
    const s = flat(t.props.style);
    return num(s.width, s.minWidth);
  };
  for (const bigText of [false, true]) {
    it(`REACT-13d ${bigText ? 'Bigger text' : '17 pt'}: a 1 digit count is one slot wide and a 2 digit count two slots (slot x digits)`, async () => {
      const { card } = await feed({ counts: { '😂': 3, '👍': 12 }, bigText });
      // The empty count-slot on a 0-count pill is the one-digit slot the app computed (fontScale included).
      const slot = num(flat(within(pill(card, 'Hooray')).getByTestId('count-slot').props.style).width);
      const one = countWidth(card, 'Haha', 3);
      const two = countWidth(card, 'Like it', 12);
      expect({ one, two, whole: Number.isInteger(slot) && Number.isInteger(one) && Number.isInteger(two) }).toEqual({ one: slot, two: (slot ?? 0) * 2, whole: true });
    });
  }
});
