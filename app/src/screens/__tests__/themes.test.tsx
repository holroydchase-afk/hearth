// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SPEC-REDESIGN 1i (DEC-68, Chase Nov 18): the Theme picker (Paper, Avocado, Pomegranate), its storage, page
// backings on the theme's c.bg, and the tab bar set apart (RD-104). Supersedes RD-24..RD-27 (Family color: Ember /
// Forest / Plum). Photo shadows (RD-88) and the reaction pop (RD-89/90) stay for now (Chase deciding, 14:55Z), so
// RD-100 / RD-101 have no tests here; warmPaper.test.tsx keeps them. Written first (red), Nov 18, by qa-tdd.
// The palettes: src/ui/__tests__/themes.test.ts. The web demo: e2e-web/demo.spec.js (RD-102).
//
// The engineer's contract:
//   - RD-97: owner's More has a "Theme" row (no "Family color") after "Light or dark"; it opens a "Theme" header and
//     three radios labelled "Paper theme", "Avocado theme", "Pomegranate theme" (words "Paper" etc. shown), each
//     ≥ 48 pt tall, a swatch with that theme's page (bg) and accent for the current light/dark, the picked one
//     checked (accessibilityState checked or selected). A tap recolors the app at once (useTheme reads ThemeContext).
//   - RD-98: Prefs.theme ('paper' | 'avocado' | 'pomegranate') saved in hearth.prefs.v1.<user> as `theme`; an old
//     `color` (ember, forest, plum, sage) or an unknown theme opens as Paper; `color` is no longer read or written.
//     Adults and viewers have no Theme row and always see Paper, whatever their phone saved.
//   - RD-99: every page backing is c.bg of the current theme; no tan #F1E9D2 / #14100D page; no hard-coded white or
//     black page under Avocado or Pomegranate (Paper's surface is white, so white is allowed there).
//   - RD-104: the tab bar (accessibilityRole tablist) is c.surface with a 1 px c.tabLine top border (GUX-R18), every theme.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { loadPrefs, savePrefs } from '../../state/prefs';
import { seedPost } from '../../test/seed';
import { FeedScreen, GalleryScreen, MoreScreen } from '../../test/redesignScreens';
import { expectGrandparentSafe, renderApp } from '../../test/renderApp';
import * as themeMod from '../../ui/theme';
import { LookContext, paletteFor, useTheme, type Colors } from '../../ui/theme';
import { HearthTabBar } from '../TabBar';

// qa-tdd, Nov 23 (SPEC-REDESIGN 1l, DEC-80): Paper plus nine fruits replace the three DEC-68 themes, so THEMES and
// WORD are the FRUIT-1 order and the picker shows 10 rows (FRUIT-6). RD-99 / RD-104 now loop every theme.
type Name = 'paper' | 'avocado' | 'pomegranate' | 'blood-orange' | 'kiwi' | 'fig' | 'dragon-fruit' | 'watermelon' | 'beet' | 'red-cabbage';
const THEMES: Name[] = ['paper', 'avocado', 'pomegranate', 'blood-orange', 'kiwi', 'fig', 'dragon-fruit', 'watermelon', 'beet', 'red-cabbage'];
/** RD-104: ThemeContext once it exists; a dummy context until then (so the test fails on the colors, not a crash). */
const ThemeCtx = ((themeMod as Record<string, unknown>).ThemeContext ?? React.createContext('paper')) as React.Context<string>;
const WORD: Record<Name, string> = {
  paper: 'Paper (standard)', avocado: 'Avocado', // GUX-R33 (Nov 23): the first row reads "Paper (standard)"
  pomegranate: 'Pomegranate', 'blood-orange': 'Blood orange', kiwi: 'Kiwi', fig: 'Fig',
  'dragon-fruit': 'Dragon fruit', watermelon: 'Watermelon', beet: 'Candy-stripe beet', 'red-cabbage': 'Red cabbage',
};
const { dadSide } = FIXTURE.circles;
const { jo, chase, alex } = FIXTURE.users;
const slow = { timeout: 5000 };
const HOUR = 3600e3;
const pal = (dark: boolean, name: Name = 'paper', high = false): Colors =>
  (paletteFor as unknown as (os: string, dark: boolean, n?: string, high?: boolean) => Colors)(Platform.OS, dark, name, high);
const lookName = (dark: boolean) => (dark ? 'dark' : 'light');
const PREFS = (id: string) => `hearth.prefs.v1.${id}`;
const kvFor = (id: string, dark: boolean, saved: Record<string, unknown> = {}) => memoryKV({
  [`hearth.lastSeen.v1.${id}`]: new Date(Date.now() - HOUR).toISOString(),
  [PREFS(id)]: JSON.stringify({ look: lookName(dark), easyView: false, notify: 'push', ...saved }),
});

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const isHost = (n: Inst) => typeof n.type === 'string';
const name = (n: Inst) => `${String(n.type)}${n.props.testID ? `#${n.props.testID}` : ''}${n.props.accessibilityLabel ? ` "${String(n.props.accessibilityLabel).slice(0, 30)}"` : ''}`;
const bgsIn = (n: Inst) => (n.findAll(isHost) as Inst[]).concat(isHost(n) ? [n] : []).map((x) => String(flat(x.props.style).backgroundColor ?? '').toUpperCase());

function Probe() {
  const { c } = useTheme();
  return <Text testID="probe" style={{ fontSize: 17 }}>{`${c.bg} ${c.accent}`}</Text>;
}
const probe = () => String(screen.getByTestId('probe').props.children);
const want = (n: Name, dark = false) => `${pal(dark, n).bg} ${pal(dark, n).accent}`;
const isChecked = (r: Inst) => !!(r.props.accessibilityState?.checked || r.props.accessibilityState?.selected);

async function openTheme() {
  fireEvent.press(await screen.findByRole('button', { name: /^Theme(,|$)/ }, slow));
  await screen.findByRole('header', { name: 'Theme' }, slow);
}

// ---------- RD-97 ----------
describe('RD-97 the owner picks a Theme in More', () => {
  it('RD-97 the owner\'s More has "Theme" right after "Light or dark", and no "Family color"', async () => {
    await renderApp(<MoreScreen />, { user: 'chase' });
    const rows = (await screen.findAllByRole('button', {}, slow)).map((b) => String(b.props.accessibilityLabel).split(',')[0]);
    expect({ theme: rows.indexOf('Theme') - rows.indexOf('Light or dark'), familyColor: rows.includes('Family color') }).toEqual({ theme: 1, familyColor: false });
  });

  for (const dark of [false, true]) {
    it(`RD-97 FRUIT-6 (${lookName(dark)}) Theme opens all 10 themes: 48 pt radio rows with the name in words, a page + accent swatch, Paper checked`, async () => {
      await renderApp(<MoreScreen />, { user: 'chase', kv: kvFor(chase.id, dark) });
      await openTheme();
      const rows = THEMES.map((n) => screen.getByRole('radio', { name: `${WORD[n]} theme` }));
      expect(rows.map(isChecked)).toEqual(THEMES.map((n) => n === 'paper'));
      rows.forEach((r, i) => {
        const n = THEMES[i]!;
        const s = flat(r.props.style);
        const tall = Number(s.minHeight ?? s.height ?? 0) >= 48;
        const bgs = bgsIn(r);
        expect({ n, tall, words: !!within(r).queryByText(WORD[n]), page: bgs.includes(pal(dark, n).bg.toUpperCase()), accent: bgs.includes(pal(dark, n).accent.toUpperCase()) })
          .toEqual({ n, tall: true, words: true, page: true, accent: true });
      });
      expect(screen.queryByRole('radio', { name: /Ember|Forest|Plum/ })).toBeNull();
      expectGrandparentSafe();
    }, 20000);
  }

  it('RD-97 tapping Avocado recolors the app at once (no restart) and VoiceOver reads "Avocado theme, selected"', async () => {
    await renderApp(<><MoreScreen /><Probe /></>, { user: 'chase', kv: kvFor(chase.id, false) });
    await openTheme();
    expect(probe()).toBe(want('paper'));
    fireEvent.press(screen.getByRole('radio', { name: 'Avocado theme' }));
    await waitFor(() => expect(probe()).toBe(want('avocado')), slow);
    expect(isChecked(screen.getByRole('radio', { name: 'Avocado theme' }))).toBe(true);
    expect(isChecked(screen.getByRole('radio', { name: 'Paper (standard) theme' }))).toBe(false);
    fireEvent.press(screen.getByRole('radio', { name: 'Pomegranate theme' }));
    await waitFor(() => expect(probe()).toBe(want('pomegranate')), slow);
  }, 20000);
});

// ---------- RD-98 ----------
describe('RD-98 storage: per-device prefs.theme, owner only', () => {
  it('RD-98 the pick is saved as prefs.theme (not color) and stays after reopening', async () => {
    const kv = memoryKV();
    const first = await renderApp(<><MoreScreen /><Probe /></>, { user: 'chase', kv });
    await openTheme();
    fireEvent.press(screen.getByRole('radio', { name: 'Pomegranate theme' }));
    await waitFor(async () => {
      const saved = JSON.parse((await kv.getItem(PREFS(chase.id)))!) as Record<string, unknown>;
      expect({ theme: saved.theme, hasColor: 'color' in saved }).toEqual({ theme: 'pomegranate', hasColor: false });
    }, slow);
    first.unmount();
    await renderApp(<Probe />, { user: 'chase', kv });
    await waitFor(() => expect(probe()).toBe(want('pomegranate')), slow);
  }, 20000);

  it.each(['ember', 'forest', 'plum', 'sage', 'blue'])('RD-98 an old color %s (and no theme) opens as Paper; color is not read', async (color) => {
    const kv = memoryKV({ [PREFS('u1')]: JSON.stringify({ easyView: false, notify: 'push', look: 'system', color }) });
    const p = (await loadPrefs(kv, 'u1', 'owner')) as unknown as Record<string, unknown>;
    expect({ theme: p.theme, hasColor: 'color' in p }).toEqual({ theme: 'paper', hasColor: false });
  });

  it('RD-98 an unknown theme opens as Paper; a known one is kept for the owner', async () => {
    const kv = memoryKV();
    const put = (theme: string) => kv.setItem(PREFS('u1'), JSON.stringify({ easyView: false, notify: 'push', look: 'system', theme }));
    expect(((await loadPrefs(kv, 'u1', 'owner')) as unknown as { theme: string }).theme).toBe('paper');
    await put('avocado');
    expect(((await loadPrefs(kv, 'u1', 'owner')) as unknown as { theme: string }).theme).toBe('avocado');
    await put('teal');
    expect(((await loadPrefs(kv, 'u1', 'owner')) as unknown as { theme: string }).theme).toBe('paper');
  });

  it('RD-98 savePrefs writes theme and never color', async () => {
    const kv = memoryKV();
    await savePrefs(kv, 'u1', { easyView: false, notify: 'push', look: 'system', theme: 'avocado', color: 'forest' } as never);
    const saved = JSON.parse((await kv.getItem(PREFS('u1')))!) as Record<string, unknown>;
    expect({ theme: saved.theme, hasColor: 'color' in saved }).toEqual({ theme: 'avocado', hasColor: false });
  });

  it.each(['adult', 'viewer'] as const)('RD-98 a saved Avocado is ignored for an %s: Paper', async (role) => {
    const kv = memoryKV({ [PREFS('u2')]: JSON.stringify({ easyView: true, notify: 'push', look: 'system', theme: 'avocado' }) });
    expect(((await loadPrefs(kv, 'u2', role)) as unknown as { theme: string }).theme).toBe('paper');
  });

  it.each([
    ['viewer Grandma Jo', 'jo', jo.id],
    ['adult Alex', 'alex', alex.id],
  ] as const)('RD-98 the %s has no Theme row and sees Paper even with Pomegranate saved', async (_n, user, id) => {
    await renderApp(<><MoreScreen /><Probe /></>, { user, kv: kvFor(id, false, { theme: 'pomegranate' }) });
    await screen.findByRole('header', { name: 'More' }, slow);
    expect(screen.queryByRole('button', { name: /^(Theme|Family color)(,|$)/ })).toBeNull();
    expect(probe()).toBe(want('paper'));
  }, 20000);
});

// ---------- RD-99 / RD-100 ----------
async function gallery(theme: Name, dark: boolean) {
  const be = FakeBackend.withFixture();
  await seedPost(be, { caption: 'Lake day', photos: 2, circles: [dadSide.id] });
  await renderApp(<GalleryScreen />, { be, user: 'chase', kv: kvFor(chase.id, dark, { theme }) });
  await waitFor(() => expect(screen.getAllByTestId(/^gallery-tile-/).length).toBeGreaterThan(0), slow);
}
async function feed(theme: Name, dark: boolean, photos = 2) {
  const be = FakeBackend.withFixture();
  const post = await seedPost(be, { author: FIXTURE.users.alex.id, caption: 'First snow!', photos, circles: [FIXTURE.circles.everyone.id] });
  await renderApp(<FeedScreen />, { be, user: 'chase', kv: kvFor(chase.id, dark, { theme }) });
  const card = await screen.findByTestId(`post-${post.id}`, {}, slow);
  await waitFor(() => expect(within(card).getAllByLabelText(/^Open photo \d+ of \d+/).length).toBeGreaterThan(0), slow);
  return { be, id: post.id, card };
}
async function more(theme: Name, dark: boolean) {
  await renderApp(<MoreScreen />, { user: 'chase', kv: kvFor(chase.id, dark, { theme }) });
  await screen.findByRole('header', { name: 'More' }, slow);
}
const OPEN: Array<[string, (t: Name, d: boolean) => Promise<unknown>]> = [['Gallery', gallery], ['Feed', feed], ['More', more]];

describe('RD-99 every page backing is the theme\'s c.bg', () => {
  for (const theme of THEMES) {
    for (const dark of [false, true]) {
      for (const [label, open] of OPEN) {
        it(`RD-99 ${label} (${theme}, ${lookName(dark)}) draws on the theme's c.bg${theme === 'paper' ? ', never tan' : ', with no white, black or tan page'}`, async () => {
          await open(theme, dark);
          const hosts = screen.UNSAFE_root.findAll(isHost) as Inst[];
          const bgs = hosts.map((n) => String(flat(n.props.style).backgroundColor ?? '').toUpperCase());
          expect({ pageColor: bgs.includes(pal(dark, theme).bg.toUpperCase()) }).toEqual({ pageColor: true });
          const TAN = ['#F1E9D2', '#14100D'];
          expect(hosts.filter((n) => TAN.includes(String(flat(n.props.style).backgroundColor ?? '').toUpperCase())).map(name)).toEqual([]);
          if (theme !== 'paper') {
            const BW = /^(#FFF|#FFFFFF|#000|#000000|WHITE|BLACK|RGB\(255, ?255, ?255\)|RGB\(0, ?0, ?0\))$/;
            expect(hosts.filter((n) => BW.test(String(flat(n.props.style).backgroundColor ?? '').toUpperCase())).map(name)).toEqual([]);
          }
        }, 20000);
      }
    }
  }
});

// ---------- RD-104 ----------
describe('RD-104 the tab bar is set apart from the page', () => {
  for (const theme of THEMES) {
    for (const dark of [false, true]) {
      it(`RD-104 (${theme}, ${lookName(dark)}) the tab bar is c.surface with a 1 px c.tabLine top border (GUX-R18)`, () => {
        const c = pal(dark, theme);
        render(
          <LookContext.Provider value={dark ? 'dark' : 'light'}>
            <ThemeCtx.Provider value={theme as never}><HearthTabBar role="owner" current="gallery" onNavigate={() => {}} /></ThemeCtx.Provider>
          </LookContext.Provider>,
        );
        const bar = (screen.UNSAFE_root.findAll(isHost) as Inst[]).find((n) => n.props.accessibilityRole === 'tablist');
        expect({ bar: !!bar }).toEqual({ bar: true });
        const st = flat(bar!.props.style);
        expect({
          bg: String(st.backgroundColor ?? '').toUpperCase(),
          topWidth: Number(st.borderTopWidth ?? st.borderWidth ?? 0),
          topColor: String(st.borderTopColor ?? st.borderColor ?? '').toUpperCase(),
        }).toEqual({ bg: c.surface.toUpperCase(), topWidth: 1, topColor: String((c as unknown as Record<string, string | undefined>).tabLine ?? "c.tabLine missing").toUpperCase() });
      });
    }
  }
});

// ---------- SPEC-REDESIGN 1l (Chase, Nov 23, DEC-80). Written first (red), Nov 23, by qa-tdd. ----------
const radioOrder = () => screen.getAllByRole('radio').map((r) => String(r.props.accessibilityLabel));

describe('FRUIT-6 the owner\'s Theme list is Paper plus nine fruits', () => {
  it('FRUIT-6 lists exactly 10 radios in FRUIT-1 order, named in plain words, none using the banned words', async () => {
    await renderApp(<MoreScreen />, { user: 'chase', kv: kvFor(chase.id, false) });
    await openTheme();
    const got = radioOrder().filter((l) => / theme$/.test(l));
    expect(got).toEqual(THEMES.map((n) => `${WORD[n]} theme`));
    expect(got.filter((l) => /\b(pit|rind)\b/i.test(l))).toEqual([]);
  }, 20000);

  it('FRUIT-6 tapping Candy-stripe beet recolors at once and reads "Candy-stripe beet theme, selected"', async () => {
    await renderApp(<><MoreScreen /><Probe /></>, { user: 'chase', kv: kvFor(chase.id, false) });
    await openTheme();
    fireEvent.press(screen.getByRole('radio', { name: 'Candy-stripe beet theme' }));
    await waitFor(() => expect(probe()).toBe(want('beet')), slow);
    expect(probe()).not.toBe(want('paper'));
    expect(isChecked(screen.getByRole('radio', { name: 'Candy-stripe beet theme' }))).toBe(true);
    expect(screen.getAllByRole('radio').filter(isChecked).map((r) => String(r.props.accessibilityLabel))).toEqual(['Candy-stripe beet theme']);
  }, 20000);

  for (const dark of [false, true]) {
    it(`FRUIT-6 (${lookName(dark)}) each fruit's split swatch shows its own page and accent (GUX-R19), not Paper's`, async () => {
      await renderApp(<MoreScreen />, { user: 'chase', kv: kvFor(chase.id, dark) });
      await openTheme();
      const got = THEMES.slice(1).map((n) => ({
        n,
        page: String(flat(screen.getByTestId(`swatch-${n}-page`).props.style).backgroundColor ?? '').toUpperCase(),
        accent: String(flat(screen.getByTestId(`swatch-${n}-accent`).props.style).backgroundColor ?? '').toUpperCase(),
      }));
      const paper = pal(dark, 'paper');
      expect(got.filter((g) => g.page === paper.bg.toUpperCase())).toEqual([]);
      expect(got).toEqual(THEMES.slice(1).map((n) => ({ n, page: pal(dark, n).bg.toUpperCase(), accent: pal(dark, n).accent.toUpperCase() })));
    }, 20000);
  }
});

describe('FRUIT-7 every theme name shows whole at Easy view', () => {
  it('FRUIT-7 with Easy view On: 10 rows ≥ 48 pt, names ≥ 17 pt, never cut to one line or "…", inside a scroll view', async () => {
    await renderApp(<MoreScreen />, { user: 'chase', kv: kvFor(chase.id, false, { easyView: true }) });
    await openTheme();
    const rows = THEMES.map((n) => screen.queryByRole('radio', { name: `${WORD[n]} theme` }));
    expect(rows.filter((r) => !r).length).toBe(0);
    const bad: string[] = [];
    rows.forEach((r, i) => {
      const n = THEMES[i]!;
      const s = flat(r!.props.style);
      if (!(Number(s.minHeight ?? s.height ?? 0) >= 48)) bad.push(`${n} row under 48`);
      const label = within(r!).getByText(WORD[n]);
      const ls = flat(label.props.style);
      if (!(Number(ls.fontSize ?? 0) >= 17)) bad.push(`${n} text ${String(ls.fontSize)} < 17`);
      if (Number(label.props.numberOfLines ?? 0) > 0 || label.props.ellipsizeMode) bad.push(`${n} can be cut`);
      let p: Inst | null = r!.parent as Inst | null; let scroll = false;
      while (p) { if (String(p.type) === 'RCTScrollView') { scroll = true; break; } p = p.parent as Inst | null; }
      if (!scroll) bad.push(`${n} not inside a scroll view`);
    });
    expect(bad).toEqual([]);
  }, 20000);
});

describe('FRUIT-8 saved themes carry over; unknown ones open as Paper', () => {
  it.each(['pomegranate', 'avocado', 'paper', 'blood-orange', 'kiwi', 'fig', 'dragon-fruit', 'watermelon', 'beet', 'red-cabbage'])('FRUIT-8 a saved %s opens as itself for the owner, no reset', async (t) => {
    const kv = memoryKV({ [PREFS('u1')]: JSON.stringify({ easyView: false, notify: 'push', look: 'system', theme: t }) });
    expect(((await loadPrefs(kv, 'u1', 'owner')) as unknown as { theme: string }).theme).toBe(t);
  });

  it.each([['plum'], ['blood_orange'], [''], [42]] as const)('FRUIT-8 an unknown saved theme %p opens as Paper and is not rewritten', async (t) => {
    const raw = JSON.stringify({ easyView: false, notify: 'push', look: 'system', theme: t });
    const kv = memoryKV({ [PREFS('u1')]: raw });
    expect(((await loadPrefs(kv, 'u1', 'owner')) as unknown as { theme: string }).theme).toBe('paper');
    expect(await kv.getItem(PREFS('u1'))).toBe(raw);
  });

  it('FRUIT-8 the owner opens the app with a saved Blood orange and sees Blood orange at once', async () => {
    await renderApp(<Probe />, { user: 'chase', kv: kvFor(chase.id, false, { theme: 'blood-orange' }) });
    await waitFor(() => expect(probe()).toBe(want('blood-orange')), slow);
    expect(probe()).not.toBe(want('paper'));
  }, 20000);

  it('FRUIT-8 the owner opening with an unknown "plum" sees Paper and the saved value stays "plum" until a pick', async () => {
    const kv = kvFor(chase.id, false, { theme: 'plum' });
    await renderApp(<Probe />, { user: 'chase', kv });
    await waitFor(() => expect(probe()).toBe(want('paper')), slow);
    expect((JSON.parse((await kv.getItem(PREFS(chase.id)))!) as { theme: unknown }).theme).toBe('plum');
  }, 20000);
});

describe('FRUIT-9 adults and viewers keep Paper', () => {
  it.each(['adult', 'viewer'] as const)('FRUIT-9 a saved fruit (Blood orange) is ignored for an %s: Paper', async (role) => {
    const kv = memoryKV({ [PREFS('u2')]: JSON.stringify({ easyView: true, notify: 'push', look: 'system', theme: 'blood-orange' }) });
    expect(((await loadPrefs(kv, 'u2', role)) as unknown as { theme: string }).theme).toBe('paper');
  });

  it.each([
    ['viewer Grandma Jo', 'jo', jo.id],
    ['adult Alex', 'alex', alex.id],
  ] as const)('FRUIT-9 the %s has no Theme row and sees Paper with Red cabbage saved', async (_n, user, id) => {
    await renderApp(<><MoreScreen /><Probe /></>, { user, kv: kvFor(id, false, { theme: 'red-cabbage' }) });
    await screen.findByRole('header', { name: 'More' }, slow);
    expect(screen.queryByRole('button', { name: /^Theme(,|$)/ })).toBeNull();
    expect(screen.queryAllByRole('radio', { name: / theme$/ })).toEqual([]);
    expect(probe()).toBe(want('paper'));
  }, 20000);
});
