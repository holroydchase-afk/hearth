// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Review round 4 (ux-reviewer, Nov 17; screenshots design/2026-11-17-round4-comment-focus.png, -delete-alert.png).
// Written first (red) by qa-tdd, Nov 17.
//
// The engineer's contract (everything else is found by role, label and words):
//   - UX-R31: on the web the comment field's text input draws no browser outline (outlineStyle 'none' or
//     outlineWidth 0). While it is focused, the rounded field (`reply-<id>`) shows a 2 pt ring in the family accent
//     (borderColor c.accent, borderWidth 2) with the same borderRadius it has at rest; not focused, no accent ring.
//   - UX-R32: the Feed description (`desc-<id>`) never starts with the poster's name. No title: just the words.
//     A title: "Title – words" (an en dash with a space each side).
//   - UX-R33: Post options on your own post has no "Who can see this" heading; its first line reads
//     "Shared with <group>, N people", then Edit description, then Delete post. The group's title is for the
//     owner or an adult who sent it (DEC-49); a grandparent's Post options never names a group.
//   - UX-R34: the names sentence in a grandparent's Post options is in the normal text color (c.ink), not green
//     (c.safe), and ends with a period. The Who sheet's names are c.ink too.
//   - UX-R35: in Bigger text (Grandma Jo's view) the who-can-see line names one person then "and N more". The
//     space above that line's words is 12 pt in both views, counted as: the words' container gap + the line's
//     marginTop + paddingTop + any room its 48 pt target leaves above the words (half the slack when centered,
//     all of it at the bottom).
import { fireEvent, screen, within } from '@testing-library/react-native';
import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { FeedScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';
import { paletteFor, type Colors } from '../../ui/theme';

const { dadSide, momSide } = FIXTURE.circles;
const SEEN = (u: string) => `hearth.lastSeen.v1.${u}`;
const PREFS = (u: string) => `hearth.prefs.v1.${u}`;
const HOUR = 3600e3;
const slow = { timeout: 4000 };
const GROUP = /Grandparents|Dad's side|Mom's side/;
const light = (os: string = Platform.OS): Colors => paletteFor(os as 'ios', false);

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
/** Host nodes in render order. */
const hosts = (root: Inst) => root.findAll((n: Inst) => typeof n.type === 'string') as Inst[];
/** The outermost host Texts (a nested Text is part of its parent's words), in order, with their words. */
function texts(root: Inst): { node: Inst; words: string }[] {
  const all = hosts(root).filter((n) => (n.type as unknown) === 'Text');
  const inner = new Set<Inst>();
  for (const n of all) for (const m of n.findAll((x: Inst) => x !== n && (x.type as unknown) === 'Text') as Inst[]) inner.add(m);
  return all.filter((n) => !inner.has(n)).map((node) => ({ node, words: textOf(node) })).filter((x) => x.words.trim());
}

const kvFor = (user: string, bigText = false) => memoryKV({
  [SEEN(user)]: new Date(Date.now() + HOUR).toISOString(),
  [PREFS(user)]: JSON.stringify({ bigText, notify: 'push', look: 'light', color: 'ember' }),
});
type Who = 'jo' | 'chase' | 'earl' | 'alex';
async function feedCard(user: Who, opts: { title?: string; author?: Who; circle?: string; bigText?: boolean; replies?: 'everyone' } = {}) {
  const be = FakeBackend.withFixture();
  if (opts.replies) be.state.spaces[FIXTURE.space.id]!.reply_audience = opts.replies;
  const { id } = await seedPost(be, {
    caption: 'First snow!', title: opts.title ?? null, circles: [opts.circle ?? dadSide.id],
    author: FIXTURE.users[opts.author ?? 'chase'].id,
  });
  const r = await renderApp(<FeedScreen />, { be, kv: kvFor(FIXTURE.users[user].id, opts.bigText), user });
  const card = await screen.findByTestId(`post-${id}`, {}, slow);
  await within(card).findByTestId(`who-${id}`, {}, slow);
  return { ...r, be, id, card };
}
async function openOptions(card: Inst, id: string) {
  fireEvent.press(within(card).getByRole('button', { name: 'Post options' }));
  return screen.findByTestId(`more-${id}`);
}

afterEach(() => jest.restoreAllMocks());

// =================================================================================================================
describe('UX-R31 (P1) the comment field on the web: no square browser outline; a 2 pt accent ring on the rounded edge', () => {
  // The web build watches the visual viewport while typing (UX-R1); jest's window has none, so give it a quiet one
  // for this block, restored after the screen unmounts.
  type Win = Record<'visualViewport' | 'addEventListener' | 'removeEventListener', unknown>;
  const g = globalThis as unknown as { window?: Win };
  let had: Partial<Win> | null = null;
  const quiet = () => ({ addEventListener: jest.fn(), removeEventListener: jest.fn() });
  beforeAll(() => {
    if (!g.window) return;
    had = { visualViewport: g.window.visualViewport, addEventListener: g.window.addEventListener, removeEventListener: g.window.removeEventListener };
    Object.assign(g.window, { visualViewport: quiet(), ...quiet() });
  });
  afterAll(() => { if (g.window && had) Object.assign(g.window, had); });

  it('UX-R31 web: the text input turns the browser outline off; focus draws a 2 pt accent ring with the same corners', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const { id, card } = await feedCard('jo', { replies: 'everyone' });
    const c = light('web');
    const field = within(card).getByLabelText('Add a comment for Chase');
    const input = flat(field.props.style);
    const row = () => flat(within(card).getByTestId(`reply-${id}`).props.style);
    const atRest = row();
    fireEvent(field, 'focus');
    const focused = row();
    fireEvent(field, 'blur');
    const blurred = row();
    expect({
      noOutline: input.outlineStyle === 'none' || input.outlineWidth === 0,
      restRing: atRest.borderColor === c.accent,
      focusColor: focused.borderColor, focusWidth: focused.borderWidth, sameCorners: focused.borderRadius === atRest.borderRadius,
      blurRing: blurred.borderColor === c.accent,
    }).toEqual({ noOutline: true, restRing: false, focusColor: c.accent, focusWidth: 2, sameCorners: true, blurRing: false });
  });
});

// =================================================================================================================
describe('UX-R32 (P2) the Feed description never starts with the poster\'s name; a title reads "Title – words"', () => {
  it('UX-R32 no title: the description is just the words, without "Chase"', async () => {
    const { id, card } = await feedCard('jo');
    expect(textOf(within(card).getByTestId(`desc-${id}`))).toBe('First snow!');
  });

  it('UX-R32 with a title: "Pumpkin patch – First snow!" (en dash, a space each side)', async () => {
    const { id, card } = await feedCard('jo', { title: 'Pumpkin patch' });
    expect(textOf(within(card).getByTestId(`desc-${id}`))).toBe('Pumpkin patch – First snow!');
  });
});

// =================================================================================================================
describe('UX-R33 (P2) Post options on your own post: "Shared with <group>, N people", then Edit and Delete; no heading', () => {
  it.each([
    ['chase', 'owner', 'chase', dadSide.id, "Shared with Grandparents – Dad's side, 3 people"],
    ['alex', 'adult', 'alex', momSide.id, "Shared with Grandparents – Mom's side, 3 people"],
  ] as const)('UX-R33 DEC-49 %s (%s) on their own post', async (user, _role, author, circle, shared) => {
    const { id, card } = await feedCard(user, { author, circle });
    const sheet = await openOptions(card, id);
    const words = texts(sheet).map((x) => x.words);
    expect({
      heading: within(sheet).queryByText('Who can see this') !== null,
      first: words[0],
      order: [shared, 'Edit description', 'Delete post'].map((w) => words.indexOf(w)),
    }).toEqual({ heading: false, first: shared, order: [0, 1, 2] });
  });

  it.each(['jo', 'earl'] as const)('UX-R33 DEC-49 other direction: %s\'s Post options on Chase\'s post names no group and has no Edit or Delete', async (user) => {
    const { id, card } = await feedCard(user);
    const sheet = await openOptions(card, id);
    expect({
      group: texts(sheet).some((x) => GROUP.test(x.words)),
      edit: within(sheet).queryByRole('button', { name: 'Edit description' }) !== null,
      del: within(sheet).queryByRole('button', { name: 'Delete post' }) !== null,
    }).toEqual({ group: false, edit: false, del: false });
  });
});

// =================================================================================================================
describe('UX-R34 (P2) the names are in the normal text color, not green, and the sentence ends with a period', () => {
  it('UX-R34 Grandma Jo\'s Post options: "... can see this." in c.ink, never c.safe', async () => {
    const { id, card } = await feedCard('jo');
    const sheet = await openOptions(card, id);
    const c = light();
    const line = texts(sheet).find((x) => x.words !== 'Who can see this' && /can see this\.?$/.test(x.words));
    expect({
      words: line?.words.endsWith('can see this.'),
      color: line ? flat(line.node.props.style).color : 'no names sentence',
    }).toEqual({ words: true, color: c.ink });
  });

  it('UX-R34 the Who sheet: every name in c.ink, nothing in green', async () => {
    const { id, card } = await feedCard('jo');
    fireEvent.press(within(card).getByTestId(`who-${id}`));
    const sheet = await screen.findByTestId(`who-sheet-${id}`);
    const c = light();
    const colors = within(sheet).getAllByTestId('person-name').map((n) => flat(n.props.style).color);
    expect({
      names: colors.every((x) => x === c.ink),
      green: texts(sheet).some((x) => flat(x.node.props.style).color === c.safe),
    }).toEqual({ names: true, green: false });
  });
});

// =================================================================================================================
describe('UX-R35 (P2) Bigger text: one name then "and N more"; 12 pt above the who-can-see line in both views', () => {
  /** The space above the line's words, per the contract in the header. */
  function gapAbove(who: Inst): number {
    let parent: Inst | null = who.parent;
    while (parent && typeof parent.type !== 'string') parent = parent.parent;
    const p = parent ? flat(parent.props.style) : {};
    const s = flat(who.props.style);
    const words = hosts(who).find((n) => (n.type as unknown) === 'Text');
    const lineH = words ? num(flat(words.props.style).lineHeight) : 0;
    const padTop = num(s.paddingTop ?? s.paddingVertical ?? s.padding);
    const padBottom = num(s.paddingBottom ?? s.paddingVertical ?? s.padding);
    const slack = Math.max(0, num(s.minHeight) - padTop - padBottom - lineH);
    const room = s.justifyContent === 'center' ? slack / 2 : s.justifyContent === 'flex-end' ? slack : 0;
    return num(p.rowGap ?? p.gap) + num(s.marginTop ?? s.marginVertical ?? s.margin) + padTop + room;
  }

  it('UX-R35 Grandma Jo in Bigger text reads one name and "2 more"', async () => {
    const { id, card } = await feedCard('jo', { bigText: true });
    expect(textOf(hosts(within(card).getByTestId(`who-${id}`)).find((n) => (n.type as unknown) === 'Text')!))
      .toMatch(/^[^,]+ and 2 more can see this\.$/);
  });

  it.each([false, true])('UX-R35 bigText=%s: 12 pt above the who-can-see words', async (bigText) => {
    const { id, card } = await feedCard('jo', { bigText });
    expect(gapAbove(within(card).getByTestId(`who-${id}`))).toBe(12);
  });
});
