// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-34 (docs/product/SPEC-REDESIGN.md; Chase, Nov 16: "why is everything grey?"). Apple HIG Color: grouped
// background only for grouped (Settings-style) lists; content sits on the plain system background. Written first
// (red), Nov 16.
//
// The engineer's contract:
//   - Content (Gallery, Feed, post cards, New for you and its walk, Share, the top bar) draws on c.bg (the theme's
//     page: Paper #F7F7F4 / #131210 by default since DEC-68) with no c.surface / c.fill box. The tab bar is c.surface
//     with a c.line top border (RD-104). Posts are split by a hairline in c.line plus space.
//   - Grey stays only on: Settings-style lists under More (Easy view, Light or dark, Theme, Help, Me), the
//     text input fields (reply field, Share caption), and reaction / tinted capsules (buttons, chips, the "who can see" people, chat bubbles).
//   - In source, c.surface / c.fill appear only inside the allowlisted components below. The Settings-style section
//     lives in a kit component named `GroupedSection` (Card turns plain), used only by the More settings screens.
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { FeedScreen, GalleryScreen, MoreScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';
import { LookContext, paletteFor, type Colors } from '../../ui/theme';
import { HelpScreen } from '../HelpScreen';
import { ShareScreen } from '../ShareScreen';
import { HearthTabBar } from '../TabBar';

const { dadSide } = FIXTURE.circles;
const { jo, chase } = FIXTURE.users;
const HOUR = 3600e3;
const slow = { timeout: 5000 };
const LOOKS = [false, true] as const;
const lookName = (dark: boolean) => (dark ? 'dark' : 'light');
const pal = (dark: boolean): Colors => paletteFor(Platform.OS as 'ios', dark);

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const isHost = (n: Inst) => typeof n.type === 'string';
const hostOrder = () => screen.UNSAFE_root.findAll(isHost) as Inst[];
const TRANSPARENT = /^(transparent|rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\))$/;
const noColor = (v: unknown) => v === undefined || v === null || TRANSPARENT.test(String(v));
const bgOf = (n: Inst) => flat(n.props.style).backgroundColor;
/** Plain: the screen's own background, or no color of its own (so the screen shows through). */
const plain = (n: Inst, c: Colors) => noColor(bgOf(n)) || bgOf(n) === c.bg;
const grey = (v: unknown, c: Colors) => v === c.surface || v === c.fill;

/** Allowed grey on content screens: text input fields (the reply field, Share's caption), reaction chips and tinted
 *  capsules (buttons). Text input fields: chief of staff's call, Nov 16 (an input field, like the reply field). */
function allowedGrey(n: Inst): boolean {
  for (let p: Inst | null = n; p; p = p.parent) {
    if ((p.type as unknown) === 'TextInput') return true;
    const id = String(p.props?.testID ?? '');
    if (/^(reply|chip|person)-/.test(id)) return true;
    if (isHost(p) && p.props?.accessibilityRole === 'button') return true;
  }
  return false;
}
/** Every host node on screen with a grey (c.surface / c.fill) background that isn't an allowed capsule or field. */
function greyBoxes(c: Colors, root: Inst = screen.UNSAFE_root): string[] {
  return (root.findAll(isHost) as Inst[])
    .filter((n) => grey(bgOf(n), c) && !allowedGrey(n))
    .map((n) => `${String(n.type)}${n.props.testID ? `#${n.props.testID}` : ''} bg ${String(bgOf(n))}`);
}

const look = (dark: boolean, userId: string) => memoryKV({ [`hearth.prefs.v1.${userId}`]: JSON.stringify({ look: lookName(dark) }) });

async function joWithNew(dark: boolean, captions: string[]) {
  const be = FakeBackend.withFixture();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const earlier = new Date(Math.max(midnight.getTime(), Date.now() - HOUR)).toISOString();
  for (const caption of captions) await seedPost(be, { caption, circles: [dadSide.id] });
  const kv = look(dark, jo.id);
  await kv.setItem(`hearth.lastSeen.v1.${jo.id}`, earlier);
  return { be, kv };
}

/** A hairline divider in c.line: a top or bottom border, or a 1 pt-or-less line drawn in c.line. */
function isDivider(n: Inst, c: Colors): boolean {
  const s = flat(n.props.style);
  const edge = (w: unknown, col: unknown) => Number(w ?? 0) > 0 && Number(w) <= 1 && col === c.line;
  return edge(s.borderBottomWidth, s.borderBottomColor ?? s.borderColor) || edge(s.borderTopWidth, s.borderTopColor ?? s.borderColor)
    || (s.backgroundColor === c.line && Number(s.height ?? 99) <= 1);
}

describe('RD-34 content screens sit on the plain background, no grey card fill', () => {
  for (const dark of LOOKS) {
    const name = lookName(dark);

    it(`RD-34 Feed (${name}): each post card is on the plain background, with no grey box anywhere on the screen`, async () => {
      const be = FakeBackend.withFixture();
      const a = await seedPost(be, { caption: 'Lake day' });
      const b = await seedPost(be, { caption: 'Cake time' });
      await renderApp(<FeedScreen />, { be, user: 'jo', kv: look(dark, jo.id) });
      const c = pal(dark);
      for (const id of [a.id, b.id]) {
        const card = await screen.findByTestId(`post-${id}`, {}, slow);
        expect({ card: id, bg: bgOf(card), plain: plain(card, c) }).toEqual({ card: id, bg: bgOf(card), plain: true });
      }
      expect(greyBoxes(c)).toEqual([]);
    });

    // Updated Nov 17 for RD-52 (DEC-65, Chase picked "A - 1"): no divider lines between posts; space does it.
    it(`RD-34 RD-52 Feed (${name}): posts are separated by space, with no hairline divider and no boxes`, async () => {
      const be = FakeBackend.withFixture();
      await seedPost(be, { caption: 'Lake day' });
      await seedPost(be, { caption: 'Cake time' });
      await renderApp(<FeedScreen />, { be, user: 'jo', kv: look(dark, jo.id) });
      const c = pal(dark);
      await screen.findByText(/Cake time/, {}, slow);
      const cards = hostOrder().filter((n) => /^post-/.test(String(n.props.testID ?? '')));
      expect(cards.length).toBeGreaterThanOrEqual(2);
      const [first, second] = cards as [Inst, Inst];
      const order = hostOrder();
      const between = order.slice(order.indexOf(first), order.indexOf(second) + 1);
      expect(between.filter((n) => isDivider(n, c)).map((n) => n.props.testID ?? n.type)).toEqual([]);
      // No card keeps a boxed outline (a border on every side) or a rounded card shape.
      for (const card of cards) expect({ id: card.props.testID, border: Number(flat(card.props.style).borderWidth ?? 0) }).toEqual({ id: card.props.testID, border: 0 });
    });

    it(`RD-34 Gallery (${name}): the screen, the top bar and New for you are plain, with no grey box`, async () => {
      const { be, kv } = await joWithNew(dark, ['First at the park', 'Then the cake']);
      await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
      const c = pal(dark);
      const section = await screen.findByTestId('new-for-you', {}, slow);
      expect({ newForYou: plain(section, c) }).toEqual({ newForYou: true });
      expect({ topBar: bgOf(screen.getByTestId('top-bar')) }).toEqual({ topBar: c.bg });
      expect(greyBoxes(c)).toEqual([]);
    });

    it(`RD-34 New for you walk (${name}): one photo at a time sits on the plain background`, async () => {
      const { be, kv } = await joWithNew(dark, ['One', 'Two']);
      await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
      fireEvent.press(within(await screen.findByTestId('new-for-you', {}, slow)).getByRole('button', { name: /^See all(?! the photos)/ }));
      await screen.findByTestId('new-one-at-a-time');
      await screen.findByText('One');
      expect(greyBoxes(pal(dark))).toEqual([]);
    });

    it(`RD-34 Share (${name}): the share screen has no grey cards (its text input fields may keep their fill)`, async () => {
      await renderApp(<ShareScreen />, { user: 'chase', kv: look(dark, chase.id) });
      await screen.findByRole('checkbox', { name: "Grandparents – Dad's side, 3 people" });
      fireEvent.press(screen.getByRole('button', { name: 'Pick photos from your phone' }));
      await screen.findByText('1 photo picked');
      expect(greyBoxes(pal(dark))).toEqual([]);
    });

    // qa-tdd, Nov 18: RD-104 (DEC-68, Chase) sets the tab bar apart on c.surface with a c.line top border; it is no
    // longer the plain page. The bar's own surface is allowed; nothing inside it is a grey box.
    it(`RD-34 → RD-104 tab bar (${name}): the bar is c.surface, with no grey box inside it`, () => {
      const c = pal(dark);
      render(<LookContext.Provider value={dark ? 'dark' : 'light'}><HearthTabBar role="owner" current="gallery" onNavigate={() => {}} newMessages={1} /></LookContext.Provider>);
      const bar = (screen.UNSAFE_root.findAll(isHost) as Inst[]).find((n) => n.props.accessibilityRole === 'tablist')!; // not an accessible element itself
      expect(bar).toBeTruthy();
      expect({ bar: bgOf(bar) }).toEqual({ bar: c.surface });
      expect((screen.UNSAFE_root.findAll(isHost) as Inst[]).filter((n) => n !== bar && grey(bgOf(n), c) && !allowedGrey(n)).map((n) => String(n.type))).toEqual([]);
    });
  }
});

describe('RD-34 grey stays where Apple uses it (the other direction)', () => {
  for (const dark of LOOKS) {
    const name = lookName(dark);

    // engineer, flagged for qa-tdd: Easy view's page (RD-78) replaces Bigger text's.
    it(`RD-34 More → Easy view and Help (${name}) keep the grouped (grey) section`, async () => {
      const c = pal(dark);
      const groupedOn = () => (screen.UNSAFE_root.findAll(isHost) as Inst[]).some((n) => grey(bgOf(n), c));
      const first = await renderApp(<MoreScreen />, { user: 'jo', kv: look(dark, jo.id) });
      fireEvent.press(await screen.findByRole('button', { name: 'Easy view, On' }));
      await screen.findByRole('radio', { name: 'On' });
      expect({ biggerText: groupedOn() }).toEqual({ biggerText: true });
      first.unmount();
      await renderApp(<HelpScreen />, { user: 'jo', kv: look(dark, jo.id) });
      await screen.findByRole('header', { name: 'Help' });
      expect({ help: groupedOn() }).toEqual({ help: true });
    });

    it(`RD-34 the reply field (${name}) keeps its grey field on iPhone`, async () => {
      if (Platform.OS !== 'ios') return; // Android's outlined field is transparent by design.
      const be = FakeBackend.withFixture();
      const { id } = await seedPost(be, { caption: 'Lake day' });
      await renderApp(<FeedScreen />, { be, user: 'jo', kv: look(dark, jo.id) });
      const row = await screen.findByTestId(`reply-${id}`, {}, slow);
      const c = pal(dark);
      expect((row.findAll(isHost) as Inst[]).some((n) => grey(bgOf(n), c))).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------
// RD-34 source lint: c.surface / c.fill only in the allowlisted components.
// ---------------------------------------------------------------------------------------------------------------

const SRC = path.join(__dirname, '..', '..');
function sources(dir = SRC): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'test' ? [] : sources(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}
const rel = (p: string) => path.relative(SRC, p).split(path.sep).join('/');

/** file → components (the enclosing top-level function) allowed to use c.surface / c.fill, and why. */
const GREY_ALLOWED: Record<string, Record<string, string>> = {
  'ui/kit.tsx': {
    Button: 'tinted capsule (iPhone gray button, waiting state)',
    GroupedSection: 'Settings-style grouped list under More',
    Field: 'a text input field, like the reply field (Share caption; chief of staff, Nov 16)',
    Confirm: 'dialog layered on top',
    AlertDialog: 'iOS-style alert layered on top (RD-67)',
    BottomSheet: 'sheet layered on top',
  },
  'screens/PostCard.tsx': {
    ReplyBox: 'the reply text field',
    WhoSheet: 'people capsules in the "who can see this" sheet',
  },
  'screens/MessagesScreen.tsx': { Line: 'chat bubble capsule' },
  'screens/GalleryTop.tsx': { SearchField: 'the "Search photos" field (RD-47), a field like the reply field' },
  'screens/TabBar.tsx': { HearthTabBar: 'the tab bar, set apart from the page on c.surface (RD-104)' },
  'demo/DemoBar.tsx': { DemoBar: 'demo chrome, outside the app' },
  'demo/DemoFrame.tsx': { DemoFrame: 'demo chrome, outside the app' },
};
/** A reaction chip in PostCard is a capsule too; it is allowed by its own line, not the whole card. */
const LINE_ALLOWED: { file: string; re: RegExp }[] = [{ file: 'screens/PostCard.tsx', re: /styles\.chip\b/ }];
/** Where GroupedSection may be used: the Settings-style screens under More. */
const GROUPED_HOMES = new Set(['ui/kit.tsx', 'screens/Preferences.tsx', 'screens/MeScreen.tsx', 'screens/HelpScreen.tsx', 'screens/MoreScreen.tsx', 'screens/YourName.tsx', 'screens/NoticeTiming.tsx']);

/** The name of the top-level function (or `const X = memo(function X` / `forwardRef(function X`) holding line i. */
function enclosing(lines: string[], i: number): string {
  for (let k = i; k >= 0; k--) {
    const m = /^(?:export\s+)?(?:default\s+)?(?:const\s+\w+\s*=\s*\w+(?:<[^>]*>)?\(\s*)?function\s+(\w+)/.exec(lines[k]!) ?? /^(?:export\s+)?const\s+(\w+)\s*=/.exec(lines[k]!);
    if (m) return m[1]!;
  }
  return '(top)';
}

describe('RD-34 source lint', () => {
  it('RD-34 c.surface / c.fill appear only in the allowlisted components (no grey content boxes)', () => {
    const hits: string[] = [];
    for (const f of sources()) {
      const file = rel(f);
      if (file === 'ui/theme.ts') continue;
      const lines = fs.readFileSync(f, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!/\bc\.(surface|fill)\b/.test(line)) return;
        if (/activeThumbColor/.test(line)) return; // the switch's thumb, not a background
        if (LINE_ALLOWED.some((a) => a.file === file && a.re.test(line))) return;
        const fn = enclosing(lines, i);
        if (GREY_ALLOWED[file]?.[fn]) return;
        hits.push(`${file}:${i + 1} ${fn}: ${line.trim().slice(0, 90)}`);
      });
    }
    expect(hits).toEqual([]);
  });

  it('RD-34 the Settings-style GroupedSection exists in the kit and is used only on the More settings screens', () => {
    const kit = fs.readFileSync(path.join(SRC, 'ui', 'kit.tsx'), 'utf8');
    expect(/export function GroupedSection\b/.test(kit)).toBe(true);
    const outside = sources().map(rel).filter((file) => !GROUPED_HOMES.has(file)
      && /<GroupedSection\b/.test(fs.readFileSync(path.join(SRC, file), 'utf8')));
    expect(outside).toEqual([]);
  });
});
