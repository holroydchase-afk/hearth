// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// grandparent-ux review of warm paper (DEC-67, Nov 18): GUX-R15 and GUX-R16. Written first (red), Nov 18, by qa-tdd.
// GUX-R17 (safeSoft) is a palette unit test: src/ui/__tests__/guxPaper.test.ts.
//
// The engineer's contract:
//   - GUX-R15 (P1): on paper the picked reaction's soft tint is too faint to see. Reworked Nov 18 (staff-pm call,
//     keeping Chase's Nov 5 "not a heavy outlined pill", LIVE-3): no outline. The picked capsule's background is an
//     opaque tint with ≥ 3:1 against c.bg (non-text contrast), light and dark, every family color; its count stays
//     ≥ 4.5:1 on it; unpicked capsules have no background and no border; picked and unpicked have the same size and
//     padding, so turning a reaction on or off never moves the emoji (≤ 0.5 px).
//   - GUX-R16: on iPhone and the web, Share's "Title (optional)" and "What's happening?" fields are a c.fill box with
//     no border, like the "Search photos" field. Android keeps Material's outlined field (1 pt c.muted border).
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { FeedScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';
import { contrast, paletteFor } from '../../ui/theme';

// qa-tdd, Nov 18: GUX-R15 loops every theme (RD-95/96, DEC-68) and saves prefs.theme (RD-98) instead of the family
// color. Only the owner can pick a theme (RD-98), so the reaction is Chase's, on a post by Alex.
type ColorName = 'paper' | 'avocado' | 'pomegranate';
const COLOR_NAMES: ColorName[] = ['paper', 'avocado', 'pomegranate'];
const pfTheme = paletteFor as unknown as (o: string, d: boolean, n?: string, h?: boolean) => ReturnType<typeof paletteFor>;
import { ShareScreen } from '../ShareScreen';

const { dadSide } = FIXTURE.circles;
const { jo, chase } = FIXTURE.users;
const slow = { timeout: 5000 };
const HOUR = 3600e3;
const lookName = (dark: boolean) => (dark ? 'dark' : 'light');
const prefs = (id: string, dark: boolean, theme: ColorName = 'paper') => ({ [`hearth.prefs.v1.${id}`]: JSON.stringify({ look: lookName(dark), bigText: false, notify: 'push', theme }) });

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const TRANSPARENT = /^(transparent|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(\.0+)?\s*\)|#[0-9a-f]{6}00)$/i;

/** Every side's border width and color, from borderWidth / borderXWidth (a side wins over the shorthand). */
function borders(s: Record<string, unknown>) {
  const side = (k: string) => Number(s[`border${k}Width`] ?? s.borderWidth ?? 0);
  const col = (k: string) => String(s[`border${k}Color`] ?? s.borderColor ?? '');
  return ['Top', 'Right', 'Bottom', 'Left'].map((k) => ({ width: side(k), color: col(k) }));
}

async function feed(dark: boolean, color: ColorName = 'paper') {
  const be = FakeBackend.withFixture();
  const post = await seedPost(be, { author: FIXTURE.users.alex.id, caption: 'First snow!', photos: 1, circles: [FIXTURE.circles.everyone.id] });
  await renderApp(<FeedScreen />, { be, user: 'chase', kv: memoryKV({ [`hearth.lastSeen.v1.${chase.id}`]: new Date(Date.now() + HOUR).toISOString(), ...prefs(chase.id, dark, color) }) });
  const card = await screen.findByTestId(`post-${post.id}`, {}, slow);
  return card;
}
const heart = (card: Inst) => within(card).getByRole('button', { name: 'Love it' });

// qa-tdd, Nov 20: GUX-R15's filled accentPicked capsule (and LIVE-3's "no outline") is superseded by RD-114..RD-116
// (Chase Nov 20: "I don't like the background on the emojis (the lighter oval)", DEC-76). Retargeted from "opaque
// tint, no border" to: picked = transparent + 2 pt c.accent border + c.accent count; unpicked = transparent + 1 pt
// c.line border + c.ink count; the outer box never changes size (the border change is absorbed in padding).
// Written first (red), Nov 20. Every theme x light/dark x normal/high, plus Easy view.
const highOn = (on: boolean) => {
  jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockResolvedValue(on);
  jest.spyOn(AccessibilityInfo, 'isHighTextContrastEnabled').mockResolvedValue(on);
};
const countColor = (btn: Inst, n: string) => {
  const t = (btn.findAll((x: Inst) => x.type === Text) as Inst[]).find((x) => String(x.props.children) === n);
  return t ? String(flat(t.props.style).color).toUpperCase() : 'no count';
};
const isClear = (v: unknown) => v === undefined || TRANSPARENT.test(String(v));

describe('RD-114 a picked reaction is a 2 pt accent outline with an accent count, no fill (every theme)', () => {
  // The phone's AccessibilityInfo is already a jest.fn in jest-expo, so restoreAllMocks keeps a mocked value; put it back.
  afterEach(() => highOn(false));
  for (const dark of [false, true]) {
    for (const high of [false, true]) {
      for (const color of COLOR_NAMES) {
        const label = `${lookName(dark)}, ${color}, ${high ? 'high' : 'normal'}`;
        it(`RD-114 (${label}) picked ❤️: transparent, 2 pt c.accent border on every side, "1" in c.accent`, async () => {
          highOn(high);
          const c = pfTheme(Platform.OS, dark, color, high);
          const card = await feed(dark, color);
          fireEvent.press(heart(card));
          await waitFor(() => expect(heart(card).props.accessibilityState?.selected).toBe(true), slow);
          await waitFor(() => expect(countColor(heart(card), '1')).not.toBe('no count'), slow);
          const s = flat(heart(card).props.style);
          expect({
            bg: isClear(s.backgroundColor) ? 'clear' : String(s.backgroundColor),
            sides: borders(s).map((b) => ({ width: b.width, color: b.color.toUpperCase() })),
            count: countColor(heart(card), '1'),
          }).toEqual({ bg: 'clear', sides: Array(4).fill({ width: 2, color: c.accent.toUpperCase() }), count: c.accent.toUpperCase() });
        }, 20000);
      }

      it(`RD-114 (${lookName(dark)}, ${high ? 'high' : 'normal'}) unpicked reactions: transparent, 1 pt c.line border, count (if any) in c.ink`, async () => {
        highOn(high);
        const c = pfTheme(Platform.OS, dark, 'paper', high);
        const card = await feed(dark);
        for (const name of ['Love it', 'Haha', 'Like it', 'Hooray']) {
          const btn = within(card).getByRole('button', { name });
          expect(btn.props.accessibilityState?.selected).toBeFalsy();
          const s = flat(btn.props.style);
          const counts = (btn.findAll((x: Inst) => x.type === Text) as Inst[]).filter((x) => /^\d+$/.test(String(x.props.children)) && String(x.props.children) !== '0')
            .map((x) => String(flat(x.props.style).color).toUpperCase());
          expect({ name, clear: isClear(s.backgroundColor), sides: borders(s).map((b) => ({ width: b.width, color: b.color.toUpperCase() })), counts: [...new Set(counts)].filter((x) => x !== c.ink.toUpperCase()) })
            .toEqual({ name, clear: true, sides: Array(4).fill({ width: 1, color: c.line.toUpperCase() }), counts: [] });
        }
      }, 20000);
    }
  }

  it('RD-114 Easy view (bigger text) keeps the same outline: picked 2 pt c.accent, no fill', async () => {
    const c = pfTheme(Platform.OS, false, 'avocado');
    const be = FakeBackend.withFixture();
    const post = await seedPost(be, { author: FIXTURE.users.alex.id, caption: 'First snow!', photos: 1, circles: [FIXTURE.circles.everyone.id] });
    await renderApp(<FeedScreen />, { be, user: 'chase', kv: memoryKV({ [`hearth.lastSeen.v1.${chase.id}`]: new Date(Date.now() + HOUR).toISOString(), [`hearth.prefs.v1.${chase.id}`]: JSON.stringify({ look: 'light', bigText: true, easyView: true, notify: 'push', theme: 'avocado' }) }) });
    const card = await screen.findByTestId(`post-${post.id}`, {}, slow);
    fireEvent.press(heart(card));
    await waitFor(() => expect(heart(card).props.accessibilityState?.selected).toBe(true), slow);
    const s = flat(heart(card).props.style);
    expect({ clear: isClear(s.backgroundColor), widths: borders(s).map((b) => b.width), color: borders(s)[0]!.color.toUpperCase() })
      .toEqual({ clear: true, widths: [2, 2, 2, 2], color: c.accent.toUpperCase() });
  }, 20000);

  it('RD-114 VoiceOver still reads "Love it, selected, 1" on a picked heart', async () => {
    const card = await feed(false);
    fireEvent.press(heart(card));
    await waitFor(() => expect(heart(card).props.accessibilityState?.selected).toBe(true), slow);
    const b = heart(card);
    const spoken = [b.props.accessibilityLabel, b.props.accessibilityState?.selected ? 'selected' : '', b.props.accessibilityValue?.text ?? ''].filter(Boolean).join(', ');
    expect(spoken).toBe('Love it, selected, 1');
  }, 20000);

  it('RD-114 RD-115 no reaction style uses accentPicked (src/screens and src/ui outside theme.ts)', () => {
    const fs = jest.requireActual('fs') as typeof import('fs');
    const pathMod = jest.requireActual('path') as typeof import('path');
    const root = pathMod.join(__dirname, '..', '..');
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      const q = pathMod.join(d, e.name);
      if (e.isDirectory()) return e.name === '__tests__' || e.name === 'test' ? [] : walk(q);
      return /\.(ts|tsx)$/.test(e.name) && !q.endsWith(pathMod.join('ui', 'theme.ts')) ? [q] : [];
    });
    const hits = walk(root).flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').flatMap((l, i) => (/accentPicked/.test(l) ? [`${pathMod.relative(root, f)}:${i + 1}`] : [])));
    expect(hits).toEqual([]);
  });
});

describe('RD-116 turning a reaction on or off never changes the capsule\'s outer size', () => {
  /** Outer width / height contribution per axis: border + padding (+ fixed size), which must match ±0.5 both ways. */
  const outer = (n: Inst) => {
    const s = flat(n.props.style);
    const b = borders(s);
    const pad = (k: string) => Number(s[`padding${k}`] ?? s[k === 'Left' || k === 'Right' ? 'paddingHorizontal' : 'paddingVertical'] ?? s.padding ?? 0);
    return {
      x: b[1]!.width + b[3]!.width + pad('Left') + pad('Right'),
      y: b[0]!.width + b[2]!.width + pad('Top') + pad('Bottom'),
      width: Number(s.width ?? s.minWidth ?? 0), height: Number(s.height ?? s.minHeight ?? 0),
      margin: Number(s.margin ?? 0) + Number(s.marginLeft ?? s.marginHorizontal ?? 0) + Number(s.marginRight ?? s.marginHorizontal ?? 0),
    };
  };
  it('RD-116 border 1 → 2 pt is absorbed in padding: the outer box and margins are the same picked and unpicked (±0.5)', async () => {
    const card = await feed(false, 'avocado');
    const off = outer(heart(card));
    const offWidths = borders(flat(heart(card).props.style)).map((b) => b.width);
    fireEvent.press(heart(card));
    await waitFor(() => expect(heart(card).props.accessibilityState?.selected).toBe(true), slow);
    const on = outer(heart(card));
    const onWidths = borders(flat(heart(card).props.style)).map((b) => b.width);
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    fireEvent.press(heart(card));
    await waitFor(() => expect(heart(card).props.accessibilityState?.selected).toBe(false), slow);
    const offAgain = outer(heart(card));
    const diff = (a: typeof off, b: typeof off) => (Object.keys(a) as (keyof typeof off)[]).filter((k) => Math.abs(a[k] - b[k]) > 0.5);
    // The border does change (1 → 2 pt), so a capsule that never draws one can't pass by accident.
    expect({ offWidths, onWidths, onVsOff: diff(off, on), offVsOn: diff(on, offAgain) })
      .toEqual({ offWidths: [1, 1, 1, 1], onWidths: [2, 2, 2, 2], onVsOff: [], offVsOn: [] });
  }, 20000);
});

// Retargeted Nov 19 by engineer for DEC-73 (SHARE-PC-3), flagged for qa-tdd: the postcard has one field, the note.
// Retargeted again Nov 19 by engineer for GUX-R3, flagged for qa-tdd: the note writes on the card, with no fill and a
// hairline c.line underline, on every phone (the other fields keep GUX-R16's filled box).
describe("GUX-R16 → GUX-R3 Share's note writes on the card: no fill, a hairline c.line underline", () => {
  const FIELDS = ['Add a note (optional)'];
  const fieldStyle = (label: string) => flat(screen.getByLabelText(label).props.style);
  const openNote = async () => {
    fireEvent.press(await screen.findByRole('button', { name: /^Add photos/ }, slow));
    await screen.findByLabelText(FIELDS[0]!, {}, slow);
  };

  for (const os of ['ios', 'web', 'android'] as const) {
    for (const dark of [false, true]) {
      it(`GUX-R3 ${os} (${lookName(dark)}): the note field has no fill and only a hairline c.line underline`, async () => {
        jest.replaceProperty(Platform, 'OS', os);
        const c = paletteFor(os, dark);
        await renderApp(<ShareScreen />, { user: 'chase', kv: memoryKV(prefs(chase.id, dark)) });
        await openNote();
        for (const label of FIELDS) {
          const s = fieldStyle(label);
          const [top, right, bottom, left] = borders(s);
          expect({ label, fill: s.backgroundColor === undefined || TRANSPARENT.test(String(s.backgroundColor)), sides: [top!.width, right!.width, left!.width], bottom: bottom })
            .toEqual({ label, fill: true, sides: [0, 0, 0], bottom: { width: StyleSheet.hairlineWidth, color: c.line } });
        }
      }, 20000);
    }
  }
});

afterEach(() => jest.restoreAllMocks());
