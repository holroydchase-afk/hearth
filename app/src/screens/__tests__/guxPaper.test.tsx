// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// grandparent-ux review of warm paper (DEC-67, Nov 18): GUX-R15 and GUX-R16. Written first (red), Nov 18, by qa-tdd.
// GUX-R17 (safeSoft) is a palette unit test: src/ui/__tests__/guxPaper.test.ts.
//
// The engineer's contract:
//   - GUX-R15 (P1): on paper the picked reaction's soft tint is too faint to see. A picked capsule draws a 1.5 pt
//     border in c.accent (≥ 3:1 against c.bg, light and dark); an unpicked one keeps a 1.5 pt transparent border, so
//     turning a reaction on or off never moves the emoji (≤ 0.5 px: same border, padding and size both ways).
//   - GUX-R16: on iPhone and the web, Share's "Title (optional)" and "What's happening?" fields are a c.fill box with
//     no border, like the "Search photos" field. Android keeps Material's outlined field (1 pt c.muted border).
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { FeedScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';
import { contrast, paletteFor, type Colors } from '../../ui/theme';
import { ShareScreen } from '../ShareScreen';

const { dadSide } = FIXTURE.circles;
const { jo, chase } = FIXTURE.users;
const slow = { timeout: 5000 };
const HOUR = 3600e3;
const lookName = (dark: boolean) => (dark ? 'dark' : 'light');
const pal = (dark: boolean): Colors => paletteFor(Platform.OS as 'ios', dark);
const prefs = (id: string, dark: boolean) => ({ [`hearth.prefs.v1.${id}`]: JSON.stringify({ look: lookName(dark), bigText: false, notify: 'push', color: 'ember' }) });

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

async function feed(dark: boolean) {
  const be = FakeBackend.withFixture();
  const post = await seedPost(be, { caption: 'First snow!', photos: 1, circles: [dadSide.id] });
  await renderApp(<FeedScreen />, { be, user: 'jo', kv: memoryKV({ [`hearth.lastSeen.v1.${jo.id}`]: new Date(Date.now() + HOUR).toISOString(), ...prefs(jo.id, dark) }) });
  const card = await screen.findByTestId(`post-${post.id}`, {}, slow);
  return card;
}
const heart = (card: Inst) => within(card).getByRole('button', { name: 'Love it' });

describe('GUX-R15 (P1) a picked reaction shows an accent edge on paper', () => {
  for (const dark of [false, true]) {
    it(`GUX-R15 (${lookName(dark)}) picked ❤️ has a 1.5 pt c.accent border on every side, ≥ 3:1 against c.bg`, async () => {
      const c = pal(dark);
      const card = await feed(dark);
      fireEvent.press(heart(card));
      await waitFor(() => expect(heart(card).props.accessibilityState?.selected).toBe(true), slow);
      const b = borders(flat(heart(card).props.style));
      expect(b).toEqual(Array(4).fill({ width: 1.5, color: c.accent }));
      expect(contrast(c.accent, c.bg)).toBeGreaterThanOrEqual(3);
    }, 20000);

    it(`GUX-R15 (${lookName(dark)}) unpicked reactions keep a 1.5 pt transparent border`, async () => {
      const card = await feed(dark);
      for (const label of ['Love it', 'Haha', 'Like it', 'Hooray']) {
        const btn = within(card).getByRole('button', { name: label });
        expect(btn.props.accessibilityState?.selected).toBeFalsy();
        const b = borders(flat(btn.props.style));
        expect({ label, widths: b.map((x) => x.width), clear: b.every((x) => TRANSPARENT.test(x.color)) })
          .toEqual({ label, widths: [1.5, 1.5, 1.5, 1.5], clear: true });
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
    // The edge must exist (1.5 pt) for this to mean anything; then nothing that places the emoji may change.
    expect(Number(on.borderWidth ?? on.borderTopWidth ?? 0)).toBe(1.5);
    const shift = (a: Record<string, unknown>, b: Record<string, unknown>) => {
      const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
      return keys.filter((k) => typeof a[k] === 'number' || typeof b[k] === 'number')
        .map((k) => ({ k, d: Math.abs(Number(a[k] ?? 0) - Number(b[k] ?? 0)) })).filter((x) => x.d > 0.5);
    };
    expect({ onVsOff: shift(off, on), offVsOn: shift(on, offAgain) }).toEqual({ onVsOff: [], offVsOn: [] });
    expect(on).toEqual(off);
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
