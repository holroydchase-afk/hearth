// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// SPEC-TYPE (docs/product/SPEC-TYPE.md, DEC-84, Chase Nov 24): one named type scale at iPhone's standard sizes.
// TYPE-1..TYPE-4, TYPE-6, TYPE-7, TYPE-12 here; TYPE-5 and TYPE-8 in typeLint.test.ts; TYPE-11's rewritten DS-2 in
// designSystem.test.tsx; Share start sizes and the kinds row (SHARE-ST-28..33) in screens/__tests__/shareStart.test.tsx.
// Written first (red), Nov 24, by qa-tdd.
//
// ===== CONTRACT for the engineer (these tests find things by these names) =====
// app/src/ui/theme.ts
//   - export type TextStyleName = 'largeTitle' | 'title1' | 'title2' | 'title3' | 'headline' | 'body' | 'callout'
//       | 'subheadline' | 'footnote' | 'caption1' | 'caption2';
//   - export const TEXT_STYLES: readonly TextStyleName[] in that order.
//   - export const TYPE: { standard: Record<TextStyleName, S>; easy: Record<TextStyleName, S> }, where
//       S = { fontFamily: string; fontSize: number; lineHeight: number } (sizes and leading from SPEC-TYPE's table).
//   - export function textStyle(name, easyView: boolean, emphasized?: boolean): S  (emphasized → FONT.semibold).
//   - useTheme() returns `type` (TYPE.easy when Easy view is on, TYPE.standard when off) and no longer returns `t`.
//   - export const STAMP_MARK = { fontSize: 17, lineHeight: 18 } and EMOJI_GLYPH = { fontSize: 22, lineHeight: 28 }.
//   - Removed: typeScale, GALLERY_TYPE (and t.base / t.title / t.display / t.line everywhere).
// app/src/ui/kit.tsx
//   - Txt: variant?: TextStyleName (default 'body'); tone?: 'ink' | 'muted' | 'accent' | 'danger' (default 'ink');
//     emphasized?: boolean. The old 'strong' | 'title' | 'display' | 'muted' variants are gone. A header is
//     aria-level 1 for largeTitle and title1, 2 for every other style.
// app/src/screens/TabBar.tsx
//   - export function nativeTabLabelStyle(easyView: boolean) → textStyle('caption1', easyView) (12/16 off, 17/22 on);
//     (tabs)/_layout.tsx passes it as labelStyle. NATIVE_TAB_OPTIONS keeps no fontSize of its own.
// testIDs on the only Texts allowed under 17 pt with Easy view off (TYPE-7; renderApp's expectGrandparentSafe
// accepts exactly these, at 12 pt or more):
//   - `when-<post_id>`            post date and time            subheadline (existing testID)
//   - `gallery-day-label`         Gallery's date group          subheadline emphasized (SemiBold)
//   - `face-count`                FaceTile "N people"           subheadline, muted
//   - `reaction-count`            a reaction's count            subheadline
//   - `share-kind-word-<kind>`    Share's Event/News/Saying     subheadline (kind = event | news | saying)
// Share kinds (SHARE-ST-30..33): the feature name is `post_kinds` (in app.features, from my_features). Seams are
// listed at the top of the Round 4 block in shareStart.test.tsx.
import { render, screen, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { REACTIONS } from '../../api/types';
import { memoryKV } from '../../platform/kv';
import { BirthdaysScreen } from '../../screens/Birthdays';
import { GalleryScreen } from '../../screens/GalleryScreen';
import { MoreScreen } from '../../screens/MoreScreen';
import { PhotosScreen } from '../../screens/PhotosScreen';
import { ShareScreen } from '../../screens/ShareScreen';
import * as TabBar from '../../screens/TabBar';
import { HearthTabBar, type TabName } from '../../screens/TabBar';
import { renderApp, type FixtureUser } from '../../test/renderApp';
import { seedPost } from '../../test/seed';
import * as kit from '../kit';
import * as theme from '../theme';
import { BigTextContext, FONT } from '../theme';

type Inst = ReturnType<typeof screen.getByTestId>;
type S = { fontFamily: string; fontSize: number; lineHeight: number };
const T = theme as unknown as {
  TYPE?: { standard: Record<string, S>; easy: Record<string, S> };
  TEXT_STYLES?: readonly string[];
  textStyle?: (name: string, easy: boolean, emphasized?: boolean) => S;
  STAMP_MARK?: { fontSize: number; lineHeight: number };
  EMOJI_GLYPH?: { fontSize: number; lineHeight: number };
};
const slow = { timeout: 5000 };
const REACT = REACTIONS[0];
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const prefs = (u: FixtureUser, p: Record<string, unknown>) => memoryKV({ [`hearth.prefs.v1.${FIXTURE.users[u].id}`]: JSON.stringify(p) });
/** The first Text at or under a node (a header may be a host View around its Text). */
const textIn = (n: Inst): Inst => ((n.type as unknown) === Text ? n : (n.findAll((x: Inst) => x.type === Text)[0] ?? n));
const sizeOf = (n: Inst) => { const s = flat(textIn(n).props.style); return { size: s.fontSize, line: s.lineHeight }; };

const NAMES = ['largeTitle', 'title1', 'title2', 'title3', 'headline', 'body', 'callout', 'subheadline', 'footnote', 'caption1', 'caption2'];
/** SPEC-TYPE's table: [standard size, leading, easy size, leading, SemiBold?]. */
const TABLE: Record<string, [number, number, number, number, boolean]> = {
  largeTitle: [34, 41, 38, 46, true],
  title1: [28, 34, 32, 39, true],
  title2: [22, 28, 26, 32, true],
  title3: [20, 25, 24, 30, true],
  headline: [17, 22, 21, 26, true],
  body: [17, 22, 21, 26, false],
  callout: [16, 21, 20, 25, false],
  subheadline: [15, 20, 19, 24, false],
  footnote: [13, 18, 17, 22, false],
  caption1: [12, 16, 17, 22, false],
  caption2: [11, 13, 17, 22, false],
};
const want = (name: string, easy: boolean) => {
  const [s, l, es, el] = TABLE[name]!;
  return easy ? { size: es, line: el } : { size: s, line: l };
};

// =================================================================================================================
describe('TYPE-1 / TYPE-2 the named scale, Standard and Easy view', () => {
  it('TYPE-1 TYPE exports the 11 style names in Apple\'s order', () => {
    expect(T.TEXT_STYLES).toEqual(NAMES);
    expect(Object.keys(T.TYPE?.standard ?? {})).toEqual(NAMES);
    expect(Object.keys(T.TYPE?.easy ?? {})).toEqual(NAMES);
  });

  it.each(NAMES)('TYPE-1 Standard %s matches the table (size / leading)', (name) => {
    const s = T.TYPE?.standard[name];
    expect({ name, size: s?.fontSize, line: s?.lineHeight }).toEqual({ name, ...want(name, false) });
    expect(T.textStyle?.(name, false)).toMatchObject({ fontSize: want(name, false).size, lineHeight: want(name, false).line });
  });

  it.each(NAMES)('TYPE-2 Easy view %s matches the table (size / leading)', (name) => {
    const s = T.TYPE?.easy[name];
    expect({ name, size: s?.fontSize, line: s?.lineHeight }).toEqual({ name, ...want(name, true) });
    expect(T.textStyle?.(name, true)).toMatchObject({ fontSize: want(name, true).size, lineHeight: want(name, true).line });
  });

  it.each([false, true])('TYPE-2 useTheme().type is the Easy view set when Easy view is %s', (easy) => {
    let seen: unknown = null;
    function Probe() { seen = (theme.useTheme() as unknown as { type?: unknown }).type; return null; }
    render(<BigTextContext.Provider value={easy}><Probe /></BigTextContext.Provider>);
    expect(seen).toEqual(easy ? T.TYPE?.easy : T.TYPE?.standard);
    expect(seen).toBeTruthy();
  });

  it('TYPE-2 the old multiplied scale is gone: no typeScale, no GALLERY_TYPE, no `t` on the theme', () => {
    expect((theme as Record<string, unknown>).typeScale).toBeUndefined();
    expect((theme as Record<string, unknown>).GALLERY_TYPE).toBeUndefined();
    let th: Record<string, unknown> = {};
    function Probe() { th = theme.useTheme() as unknown as Record<string, unknown>; return null; }
    render(<Probe />);
    expect('t' in th).toBe(false);
  });

  it('TYPE-2 the two decorative glyphs keep fixed numbers: STAMP_MARK 17/18, EMOJI_GLYPH = title2 (22/28)', () => {
    expect(T.STAMP_MARK).toMatchObject({ fontSize: 17, lineHeight: 18 });
    expect(T.EMOJI_GLYPH).toMatchObject({ fontSize: 22, lineHeight: 28 });
  });
});

describe('TYPE-3 Easy view never goes under 17', () => {
  it('TYPE-3 every Easy view style is 17 or more, and its leading is at least its size', () => {
    const easy = T.TYPE?.easy ?? {};
    expect(Object.keys(easy)).toHaveLength(11);
    for (const [name, s] of Object.entries(easy)) {
      expect({ name, ok: s.fontSize >= 17 && s.lineHeight >= s.fontSize }).toEqual({ name, ok: true });
    }
  });
});

describe('TYPE-4 weights: Regular or SemiBold only', () => {
  it.each(NAMES)('TYPE-4 %s: Regular or SemiBold (never Medium); titles and headline SemiBold; emphasized SemiBold', (name) => {
    const semi = TABLE[name]![4];
    for (const easy of [false, true]) {
      const fam = T.TYPE?.[easy ? 'easy' : 'standard'][name]?.fontFamily;
      expect({ name, easy, fam }).toEqual({ name, easy, fam: semi ? FONT.semibold : FONT.regular });
      expect({ name, easy, emph: T.textStyle?.(name, easy, true)?.fontFamily }).toEqual({ name, easy, emph: FONT.semibold });
    }
  });
});

// =================================================================================================================
// TYPE-6: representative elements from the map, each in Standard and Easy view.
async function postIn(user: FixtureUser, easy: boolean) {
  const be = FakeBackend.withFixture();
  const { id } = await seedPost(be, { caption: 'At the lake', photos: 1, circles: [FIXTURE.circles.dadSide.id] });
  await renderApp(<PhotosScreen mode="feed" />, { be, user, kv: prefs(user, { easyView: easy }) });
  const card = await screen.findByTestId(`post-${id}`, {}, slow);
  await within(card).findByTestId(`who-${id}`, {}, slow);
  return { id, card };
}

describe('TYPE-6 each screen element carries its named style (Standard and Easy view)', () => {
  const GREETING = /^Good (morning|afternoon|evening)/;
  for (const easy of [false, true]) {
    const mode = easy ? 'Easy view' : 'Standard';

    it(`TYPE-6 (${mode}) Gallery greeting is largeTitle`, async () => {
      const be = FakeBackend.withFixture();
      await seedPost(be, { caption: 'Pumpkin patch', photos: 2, takenAt: new Date(2025, 9, 17, 10).toISOString() });
      await renderApp(<GalleryScreen />, { be, user: 'jo', kv: prefs('jo', { easyView: easy }) });
      const h = await screen.findByRole('header', { name: GREETING }, slow);
      expect(sizeOf(h)).toEqual(want('largeTitle', easy));
      expect(flat(textIn(h).props.style).fontFamily).toBe(FONT.semibold);
    });

    it(`TYPE-6 (${mode}) Gallery date group ("gallery-day-label") is subheadline emphasized`, async () => {
      const be = FakeBackend.withFixture();
      await seedPost(be, { caption: 'Pumpkin patch', photos: 2, takenAt: new Date(2025, 9, 17, 10).toISOString() });
      await renderApp(<GalleryScreen />, { be, user: 'jo', kv: prefs('jo', { easyView: easy }) });
      await screen.findByRole('header', { name: GREETING }, slow);
      const day = (await screen.findAllByTestId('gallery-day-label', {}, slow))[0]!;
      expect(sizeOf(day)).toEqual(want('subheadline', easy));
      expect(flat(day.props.style).fontFamily).toBe(FONT.semibold);
    });

    it(`TYPE-6 (${mode}) Gallery month name ("October 2025") is title2 (24 → 22 in Standard)`, async () => {
      const be = FakeBackend.withFixture();
      await seedPost(be, { caption: 'Pumpkin patch', photos: 2, takenAt: new Date(2025, 9, 17, 10).toISOString() });
      await renderApp(<GalleryScreen />, { be, user: 'jo', kv: prefs('jo', { easyView: easy }) });
      const month = await screen.findByRole('header', { name: 'October 2025' }, slow);
      expect(sizeOf(month)).toEqual(want('title2', easy));
    });

    it(`TYPE-6 (${mode}) Feed's title "Feed" is largeTitle`, async () => {
      await postIn('chase', easy);
      expect(sizeOf(screen.getByRole('header', { name: 'Feed' }))).toEqual(want('largeTitle', easy));
    });

    it(`TYPE-6 (${mode}) More's title "More" is largeTitle`, async () => {
      await renderApp(<MoreScreen />, { user: 'chase', kv: prefs('chase', { easyView: easy }) });
      expect(sizeOf(await screen.findByRole('header', { name: 'More' }, slow))).toEqual(want('largeTitle', easy));
    });

    it(`TYPE-6 (${mode}) a pushed page title (Birthdays and dates) is title1`, async () => {
      await renderApp(<BirthdaysScreen />, { user: 'chase', kv: prefs('chase', { easyView: easy }) });
      const h = await screen.findByRole('header', { name: 'Birthdays and dates' }, slow);
      expect(sizeOf(h)).toEqual(want('title1', easy));
      expect(textIn(h).props['aria-level']).toBe(1);
    });

    it(`TYPE-6 (${mode}) Share's "New post" is title2 (SHARE-ST-28)`, async () => {
      await renderApp(<ShareScreen />, { user: 'chase', kv: prefs('chase', { easyView: easy }) });
      expect(sizeOf(await screen.findByRole('header', { name: 'New post' }, slow))).toEqual(want('title2', easy));
    });

    it(`TYPE-6 (${mode}) a Button label is headline (SemiBold)`, () => {
      render(<BigTextContext.Provider value={easy}><kit.Button label="Send" onPress={() => {}} /></BigTextContext.Provider>);
      const s = flat(screen.getByText('Send').props.style);
      expect({ size: s.fontSize, line: s.lineHeight, fam: s.fontFamily }).toEqual({ ...want('headline', easy), fam: FONT.semibold });
    });

    it(`TYPE-6 (${mode}) a post's date ("when-<id>") is subheadline; who sees it stays body (A1)`, async () => {
      const { id, card } = await postIn('chase', easy);
      expect(sizeOf(within(card).getByTestId(`when-${id}`))).toEqual(want('subheadline', easy));
      const who = within(card).getByTestId(`who-${id}`);
      expect(sizeOf(who)).toEqual(want('body', easy));
    });

    it(`TYPE-6 (${mode}) FaceTile "N people" ("face-count") is subheadline, muted; the name stays headline`, () => {
      const c = theme.paletteFor('ios', false);
      render(<BigTextContext.Provider value={easy}><kit.FaceTile name="Everyone" count={4} faces={['Jo', 'Ruth']} picked={false} onPress={() => {}} across={3} /></BigTextContext.Provider>);
      const count = screen.getByTestId('face-count');
      expect({ ...sizeOf(count), color: flat(count.props.style).color }).toEqual({ ...want('subheadline', easy), color: c.muted });
      expect(sizeOf(screen.getByText('Everyone'))).toEqual(want('headline', easy));
    });

    it(`TYPE-6 (${mode}) Android's tab words (labelStyle) are caption1`, () => {
      const fn = (TabBar as unknown as { nativeTabLabelStyle?: (e: boolean) => S }).nativeTabLabelStyle;
      const s = fn?.(easy);
      expect({ size: s?.fontSize, line: s?.lineHeight }).toEqual(want('caption1', easy));
    });
  }

  it('TYPE-6 (Easy view) Hearth\'s own tab bar words are caption1 (17 / 22), not body 21', () => {
    render(<BigTextContext.Provider value><HearthTabBar role="owner" current={'gallery' as string as TabName} onNavigate={() => {}} /></BigTextContext.Provider>);
    expect(sizeOf(screen.getByText('Share'))).toEqual(want('caption1', true));
  });

  it('TYPE-6 a reaction count ("reaction-count") is subheadline', async () => {
    const be = FakeBackend.withFixture();
    const { id } = await seedPost(be, { caption: 'At the lake', photos: 1, circles: [FIXTURE.circles.dadSide.id] });
    await be.clientFor(FIXTURE.users.jo.id).setReaction(id, REACT);
    await renderApp(<PhotosScreen mode="feed" />, { be, user: 'chase', kv: prefs('chase', { easyView: false }) });
    const card = await screen.findByTestId(`post-${id}`, {}, slow);
    const count = (await within(card).findAllByTestId('reaction-count', {}, slow))[0]!;
    expect(sizeOf(count)).toEqual(want('subheadline', false));
  });
});

// =================================================================================================================
// TYPE-3 (screens) and TYPE-7: a sweep over the main screens. Easy view on: nothing under 17. Easy view off: only the
// allowed testIDs may be under 17 (and never under caption1's 12).
const SMALL_OK = /^(when-.+|gallery-day-label|face-count|reaction-count|share-kind-word-(event|news|saying))$/;
/** A Text's testID, or the nearest Text parent's (a nested Txt inherits its parent's size). */
function smallId(n: Inst): string | undefined {
  for (let p: Inst | null = n; p; p = p.parent) if (p.type === Text && typeof p.props.testID === 'string') return p.props.testID as string;
  return undefined;
}
const SWEEP: { name: string; user: FixtureUser; el: () => React.ReactElement; header: string | RegExp }[] = [
  { name: 'Gallery', user: 'jo', el: () => <GalleryScreen />, header: /^Good (morning|afternoon|evening)/ },
  { name: 'Feed', user: 'chase', el: () => <PhotosScreen mode="feed" />, header: 'Feed' },
  { name: 'Share', user: 'chase', el: () => <ShareScreen />, header: 'New post' },
  { name: 'More', user: 'chase', el: () => <MoreScreen />, header: 'More' },
  { name: 'Birthdays', user: 'chase', el: () => <BirthdaysScreen />, header: 'Birthdays and dates' },
];

describe('TYPE-3 / TYPE-7 screen sweep', () => {
  for (const s of SWEEP) {
    for (const easy of [true, false]) {
      it(`${easy ? 'TYPE-3' : 'TYPE-7'} ${s.name} with Easy view ${easy ? 'on: no Text under 17' : 'off: only the listed small elements are under 17 (and none under 12)'}`, async () => {
        const be = FakeBackend.withFixture();
        const { id } = await seedPost(be, { caption: 'At the lake', photos: 2, circles: [FIXTURE.circles.dadSide.id], takenAt: new Date(2025, 9, 17, 10).toISOString() });
        await be.clientFor(FIXTURE.users.jo.id).setReaction(id, REACT);
        await renderApp(s.el(), { be, user: s.user, kv: prefs(s.user, { easyView: easy }) });
        await screen.findByRole('header', { name: s.header }, slow);
        const bad: string[] = [];
        for (const t of screen.UNSAFE_root.findAll((x: Inst) => x.type === Text) as Inst[]) {
          const size = flat(t.props.style).fontSize;
          if (typeof size !== 'number' || size >= 17) continue;
          const tid = smallId(t);
          if (easy || size < 12 || !tid || !SMALL_OK.test(tid)) bad.push(`${tid ?? '(no testID)'} ${size}pt "${String(t.props.children).slice(0, 30)}"`);
        }
        expect(bad).toEqual([]);
      });
    }
  }
});

// =================================================================================================================
describe('TYPE-6 kit Txt: one style name plus a tone', () => {
  it('TYPE-6 Txt variant is a style name; tone="muted" colors it, the size stays the style\'s', () => {
    const c = theme.paletteFor('ios', false);
    const Txt = kit.Txt as unknown as React.ComponentType<Record<string, unknown>>;
    render(<>
      <Txt variant="largeTitle" role="header">Big</Txt>
      <Txt variant="title1" role="header">Page</Txt>
      <Txt variant="title2" role="header">Section</Txt>
      <Txt variant="subheadline" tone="muted">Nov 3</Txt>
      <Txt tone="accent">Accent words</Txt>
    </>);
    const s = (w: string) => flat(screen.getByText(w).props.style);
    expect({ size: s('Big').fontSize, line: s('Big').lineHeight }).toEqual(want('largeTitle', false));
    expect({ size: s('Page').fontSize, line: s('Page').lineHeight }).toEqual(want('title1', false));
    expect({ size: s('Section').fontSize, line: s('Section').lineHeight }).toEqual(want('title2', false));
    expect({ size: s('Nov 3').fontSize, color: s('Nov 3').color }).toEqual({ size: 15, color: c.muted });
    expect({ size: s('Accent words').fontSize, color: s('Accent words').color }).toEqual({ size: 17, color: c.accent });
    expect([screen.getByText('Big').props['aria-level'], screen.getByText('Page').props['aria-level'], screen.getByText('Section').props['aria-level']]).toEqual([1, 1, 2]);
  });
});

// =================================================================================================================
describe('TYPE-12 tokens.json carries the named styles', () => {
  it('TYPE-12 portableTokens().type has standard and easy, each with the 11 styles at the table\'s numbers', () => {
    const { portableTokens } = require('../tokens') as { portableTokens: () => { type: Record<string, Record<string, { fontSize: number; lineHeight: number }>> } };
    const t = portableTokens().type;
    expect(Object.keys(t).sort()).toEqual(['easy', 'standard']);
    for (const name of NAMES) {
      expect({ name, std: [t.standard?.[name]?.fontSize, t.standard?.[name]?.lineHeight], easy: [t.easy?.[name]?.fontSize, t.easy?.[name]?.lineHeight] })
        .toEqual({ name, std: [TABLE[name]![0], TABLE[name]![1]], easy: [TABLE[name]![2], TABLE[name]![3]] });
    }
  });
});
