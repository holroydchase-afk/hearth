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
import { Platform, StyleSheet, Text } from 'react-native';
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
/** What decides where the emoji sits inside the capsule: borders, padding, size, gap, alignment. */
const EMOJI_PLACE = /^(border.*Width|borderWidth|padding|margin|width|height|min|max|gap|alignItems|justifyContent|flex)/;
const placeOf = (n: Inst) => Object.fromEntries(Object.entries(flat(n.props.style)).filter(([k]) => EMOJI_PLACE.test(k)).sort());

async function feed(dark: boolean, color: ColorName = 'paper') {
  const be = FakeBackend.withFixture();
  const post = await seedPost(be, { author: FIXTURE.users.alex.id, caption: 'First snow!', photos: 1, circles: [FIXTURE.circles.everyone.id] });
  await renderApp(<FeedScreen />, { be, user: 'chase', kv: memoryKV({ [`hearth.lastSeen.v1.${chase.id}`]: new Date(Date.now() + HOUR).toISOString(), ...prefs(chase.id, dark, color) }) });
  const card = await screen.findByTestId(`post-${post.id}`, {}, slow);
  return card;
}
const heart = (card: Inst) => within(card).getByRole('button', { name: 'Love it' });

describe('GUX-R15 (P1) a picked reaction shows a stronger tint on paper, with no outline', () => {
  const OPAQUE = /^#[0-9a-f]{6}$/i;
  const countColor = (btn: Inst) => {
    const t = (btn.findAll((n: Inst) => n.type === Text) as Inst[]).find((n) => String(n.props.children) === '1');
    return t ? String(flat(t.props.style).color) : 'no count';
  };
  for (const dark of [false, true]) {
    for (const color of COLOR_NAMES) {
      it(`GUX-R15 (${lookName(dark)}, ${color}) picked ❤️ tint is ≥ 3:1 against c.bg, its "1" ≥ 4.5:1 on the tint, no border`, async () => {
        const c = pfTheme(Platform.OS, dark, color);
        const card = await feed(dark, color);
        fireEvent.press(heart(card));
        await waitFor(() => expect(heart(card).props.accessibilityState?.selected).toBe(true), slow);
        await waitFor(() => expect(countColor(heart(card))).not.toBe('no count'), slow);
        const s = flat(heart(card).props.style);
        const bg = String(s.backgroundColor);
        const ink = countColor(heart(card));
        // contrast() reads opaque #RRGGBB only; a see-through tint's look depends on what is under it.
        expect({ bg, opaque: OPAQUE.test(bg), ink, inkOk: OPAQUE.test(ink) }).toEqual({ bg, opaque: true, ink, inkOk: true });
        expect({ tintVsPage: contrast(bg, c.bg) >= 3, countVsTint: contrast(ink, bg) >= 4.5, tintVsPageRatio: +contrast(bg, c.bg).toFixed(2), countVsTintRatio: +contrast(ink, bg).toFixed(2) })
          .toEqual(expect.objectContaining({ tintVsPage: true, countVsTint: true }));
        expect(borders(s).map((x) => x.width)).toEqual([0, 0, 0, 0]);
      }, 20000);
    }

    it(`GUX-R15 (${lookName(dark)}) unpicked reactions have no background and no border`, async () => {
      const card = await feed(dark);
      for (const label of ['Love it', 'Haha', 'Like it', 'Hooray']) {
        const btn = within(card).getByRole('button', { name: label });
        expect(btn.props.accessibilityState?.selected).toBeFalsy();
        const s = flat(btn.props.style);
        expect({ label, noBg: s.backgroundColor === undefined || TRANSPARENT.test(String(s.backgroundColor)), widths: borders(s).map((x) => x.width) })
          .toEqual({ label, noBg: true, widths: [0, 0, 0, 0] });
      }
    }, 20000);
  }

  it('GUX-R15 turning ❤️ on and off moves the emoji ≤ 0.5 px (same border widths, padding and size both ways)', async () => {
    const card = await feed(false);
    const off = placeOf(heart(card));
    fireEvent.press(heart(card));
    await waitFor(() => expect(heart(card).props.accessibilityState?.selected).toBe(true), slow);
    const on = placeOf(heart(card));
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    fireEvent.press(heart(card));
    await waitFor(() => expect(heart(card).props.accessibilityState?.selected).toBe(false), slow);
    const offAgain = placeOf(heart(card));
    const shift = (a: Record<string, unknown>, b: Record<string, unknown>) => {
      const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
      return keys.filter((k) => typeof a[k] === 'number' || typeof b[k] === 'number')
        .map((k) => ({ k, d: Math.abs(Number(a[k] ?? 0) - Number(b[k] ?? 0)) })).filter((x) => x.d > 0.5);
    };
    expect({ onVsOff: shift(off, on), offVsOn: shift(on, offAgain) }).toEqual({ onVsOff: [], offVsOn: [] });
    expect(on).toEqual(off);
    // No outline either way (LIVE-3): the tint alone shows "picked".
    expect(Number(on.borderWidth ?? on.borderTopWidth ?? 0)).toBe(0);
  }, 20000);
});

describe('GUX-R16 Share fields are filled, not outlined, on iPhone and the web (like Search)', () => {
  const FIELDS = ['Title (optional)', "What's happening?"];
  const fieldStyle = (label: string) => flat(screen.getByLabelText(label).props.style);

  for (const os of ['ios', 'web'] as const) {
    for (const dark of [false, true]) {
      it(`GUX-R16 ${os} (${lookName(dark)}): Title and caption fields have background c.fill and no border`, async () => {
        jest.replaceProperty(Platform, 'OS', os);
        const c = paletteFor(os, dark);
        await renderApp(<ShareScreen />, { user: 'chase', kv: memoryKV(prefs(chase.id, dark)) });
        await screen.findByLabelText(FIELDS[0]!, {}, slow);
        for (const label of FIELDS) {
          const s = fieldStyle(label);
          expect({ label, bg: s.backgroundColor, borders: borders(s).map((x) => x.width) })
            .toEqual({ label, bg: c.fill, borders: [0, 0, 0, 0] });
        }
      }, 20000);
    }
  }

  it('GUX-R16 android: Title and caption keep the outlined field (1 pt c.muted border, no fill)', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const c = paletteFor('android', false);
    await renderApp(<ShareScreen />, { user: 'chase', kv: memoryKV(prefs(chase.id, false)) });
    await screen.findByLabelText(FIELDS[0]!, {}, slow);
    for (const label of FIELDS) {
      const s = fieldStyle(label);
      expect({ label, borders: borders(s), fill: s.backgroundColor === undefined || TRANSPARENT.test(String(s.backgroundColor)) })
        .toEqual({ label, borders: Array(4).fill({ width: 1, color: c.muted }), fill: true });
    }
  }, 20000);
});

afterEach(() => jest.restoreAllMocks());
