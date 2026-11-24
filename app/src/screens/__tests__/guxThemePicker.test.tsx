// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// grandparent-ux review of the 10-theme picker (R76, DEC-80, Nov 23), four P2 findings. Written first (red),
// Nov 23, by qa-tdd.
//
// The engineer's contract:
//   - GUX-R30: each Theme radio's swatch shows three colors side by side: `swatch-<theme>-page` (c.bg),
//     `swatch-<theme>-fill` (c.fill) and `swatch-<theme>-accent` (c.accent), for the current light/dark, so the five
//     light crimson accents (Pomegranate, Blood orange, Fig, Watermelon, Beet) are told apart. The swatch stays
//     >= 48 x 48 pt (GUX-R19).
//   - GUX-R31 (guard, holds today): Delete is never colour-only, in every theme, light and dark. Post options'
//     "Delete post" row has the words and the trash icon; its alert's red button says "Delete" in words.
//     (The alert has no icon on purpose: the phone's own alerts have none, RD-67.)
//   - GUX-R32: the "this phone only" note sits ABOVE the theme list and starts "Only this phone changes."
//     The second sentence ("Everyone else still sees Paper.") is NOT encoded: a family can have two owners
//     (0001 only stops the last owner leaving), and a second owner keeps the theme they picked on their own phone,
//     so "everyone else" is not always Paper. See the guard at the bottom; staff-pm / grandparent-ux pick the words.
//     QA-R1 resolved (Nov 23): staff-pm picked "Other people keep their own colors." as the second sentence; encoded below.
//   - GUX-R33: the first row's words are "Paper (standard)" and VoiceOver reads "Paper (standard) theme".
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { FeedScreen, MoreScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';
import { paletteFor, useTheme, type Colors, type ThemeName } from '../../ui/theme';

const THEMES = ['paper', 'avocado', 'pomegranate', 'blood-orange', 'kiwi', 'fig', 'dragon-fruit', 'watermelon', 'beet', 'red-cabbage'] as ThemeName[];
const CRIMSON = ['pomegranate', 'blood-orange', 'fig', 'watermelon', 'beet'] as ThemeName[];
const lookName = (dark: boolean) => (dark ? 'dark' : 'light');
const slow = { timeout: 5000 };
const HOUR = 3600e3;
const { chase, alex } = FIXTURE.users;
const { dadSide } = FIXTURE.circles;
const PREFS = (id: string) => `hearth.prefs.v1.${id}`;
const kvFor = (id: string, dark: boolean, saved: Record<string, unknown> = {}) => memoryKV({
  [`hearth.lastSeen.v1.${id}`]: new Date(Date.now() - HOUR).toISOString(),
  [PREFS(id)]: JSON.stringify({ look: lookName(dark), easyView: false, notify: 'push', ...saved }),
});
const pal = (dark: boolean, n: ThemeName): Colors => paletteFor(Platform.OS as 'ios', dark, n);
type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const isHost = (n: Inst) => typeof n.type === 'string';
const bgOf = (id: string) => {
  const n = screen.queryByTestId(id);
  return n ? String(flat(n.props.style).backgroundColor ?? '').toUpperCase() : `${id} missing`;
};
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

async function openTheme() {
  fireEvent.press(await screen.findByRole('button', { name: /^Theme(,|$)/ }, slow));
  await screen.findByRole('header', { name: 'Theme' }, slow);
}

function Probe() {
  const { c } = useTheme();
  return <Text testID="probe">{c.bg}</Text>;
}

// ---------- GUX-R30 ----------
describe('GUX-R30 each theme swatch shows page, fill and accent', () => {
  for (const dark of [false, true]) {
    it(`GUX-R30 (${lookName(dark)}) every row's swatch has three parts: the theme's page, fill and accent`, async () => {
      await renderApp(<MoreScreen />, { user: 'chase', kv: kvFor(chase.id, dark) });
      await openTheme();
      const got = THEMES.map((n) => ({ n, page: bgOf(`swatch-${n}-page`), fill: bgOf(`swatch-${n}-fill`), accent: bgOf(`swatch-${n}-accent`) }));
      expect(got).toEqual(THEMES.map((n) => ({ n, page: pal(dark, n).bg.toUpperCase(), fill: pal(dark, n).fill.toUpperCase(), accent: pal(dark, n).accent.toUpperCase() })));
      for (const n of THEMES) {
        const s = flat(screen.getByTestId(`swatch-${n}`).props.style);
        expect({ n, w: Number(s.width ?? 0) >= 48, h: Number(s.height ?? 0) >= 48 }).toEqual({ n, w: true, h: true });
      }
    }, 20000);
  }

  it('GUX-R30 (light) the five crimson themes show five different three-color swatches', async () => {
    await renderApp(<MoreScreen />, { user: 'chase', kv: kvFor(chase.id, false) });
    await openTheme();
    const sets = CRIMSON.map((n) => [`swatch-${n}-page`, `swatch-${n}-fill`, `swatch-${n}-accent`].map(bgOf).join(' '));
    expect(sets.filter((s) => /missing/.test(s))).toEqual([]);
    expect(new Set(sets).size).toBe(CRIMSON.length);
  }, 20000);
});

// ---------- GUX-R31 (guard) ----------
describe('GUX-R31 Delete is never colour-only, in every theme', () => {
  const trashIn = (n: Inst) => (n.findAll((x: Inst) => x.type === SymbolView) as Inst[])
    .filter((s) => /trash|delete/.test(JSON.stringify(s.props.name)));
  for (const theme of THEMES) {
    for (const dark of [false, true]) {
      it(`GUX-R31 (${theme}, ${lookName(dark)}) Post options "Delete post" has words and the trash icon; its alert's button says "Delete"`, async () => {
        const be = FakeBackend.withFixture();
        const { id } = await seedPost(be, { caption: 'First snow!', photos: 1, circles: [dadSide.id] });
        await renderApp(<><FeedScreen /><Probe /></>, { be, user: 'chase', kv: kvFor(chase.id, dark, { theme }) });
        expect(String(screen.getByTestId('probe').props.children)).toBe(pal(dark, theme).bg);
        const card = await screen.findByTestId(`post-${id}`, {}, slow);
        fireEvent.press(within(card).getByRole('button', { name: 'Post options' }));
        const menu = await screen.findByTestId(`more-${id}`);
        const row = within(menu).getByRole('button', { name: 'Delete post' });
        const words = (row.findAll((x: Inst) => x.type === Text) as Inst[]).map(textOf);
        expect({ words: words.includes('Delete post'), trash: trashIn(row).length }).toEqual({ words: true, trash: 1 });
        fireEvent.press(row);
        await screen.findByText('Delete this post?');
        const del = screen.getByRole('button', { name: 'Delete' });
        expect((del.findAll((x: Inst) => x.type === Text) as Inst[]).map(textOf)).toContain('Delete');
      }, 20000);
    }
  }
});

// ---------- GUX-R32 ----------
describe('GUX-R32 the "this phone only" note sits above the list', () => {
  it('GUX-R32 the note reads "Only this phone changes. Other people keep their own colors." and comes before the first theme row', async () => {
    await renderApp(<MoreScreen />, { user: 'chase', kv: kvFor(chase.id, false) });
    await openTheme();
    const hosts = screen.UNSAFE_root.findAll(isHost) as Inst[];
    // QA-R1 resolved (Nov 23): staff-pm picked the second sentence, true even with a second owner.
    const noteAt = hosts.findIndex((n) => String(n.type) === 'Text' && /^Only this phone changes\. Other people keep their own colors\.$/.test(textOf(n)));
    const firstRow = hosts.findIndex((n) => n.props.accessibilityRole === 'radio');
    expect({ note: noteAt >= 0, aboveList: noteAt >= 0 && firstRow >= 0 && noteAt < firstRow }).toEqual({ note: true, aboveList: true });
  }, 20000);

  // Fact check behind the flag above (holds today): a second owner's own pick is theirs, so "Everyone else still
  // sees Paper" would not be true for them.
  it('GUX-R32 guard: a second owner who picked Avocado on their phone sees Avocado, not Paper', async () => {
    const be = FakeBackend.withFixture();
    be.state.members.find((m) => m.user === alex.id)!.role = 'owner';
    await renderApp(<Probe />, { be, user: 'alex', kv: kvFor(alex.id, false, { theme: 'avocado' }) });
    await waitFor(() => expect(String(screen.getByTestId('probe').props.children)).toBe(pal(false, 'avocado').bg), slow);
  }, 20000);
});

// ---------- GUX-R33 ----------
describe('GUX-R33 the first theme reads "Paper (standard)"', () => {
  it('GUX-R33 the first radio shows "Paper (standard)" and VoiceOver reads "Paper (standard) theme"', async () => {
    await renderApp(<MoreScreen />, { user: 'chase', kv: kvFor(chase.id, false) });
    await openTheme();
    const first = screen.getAllByRole('radio')[0]!;
    expect({ label: first.props.accessibilityLabel, words: !!within(first).queryByText('Paper (standard)') })
      .toEqual({ label: 'Paper (standard) theme', words: true });
  }, 20000);
});
