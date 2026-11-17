// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Review round 2 (ux-reviewer, Nov 17; SPEC-REDESIGN RD-56..RD-66). Written first (red), Nov 17.
// The pure months layout for UX-R13 is in feed/__tests__/gallery.test.ts; R18 (on the web) and R23 (one h1 per tab)
// are also in e2e-web/demo.spec.js.
//
// The engineer's contract (everything else is found by role, label and words):
//   - Gallery keeps `gallery-scroll`, `gallery-grid`, `gallery-tile-<mediaId>` and `gallery-grid-row` (a row of squares).
//   - PostCard keeps `post-<id>`, `card-head-<id>`, `actions-<id>`, `who-<id>`, `more-<id>`; `reply-<id>` is now the one
//     rounded comment field box, holding the TextInput and (once typed) the Post button.
//   - The Post options rows stay buttons named "Edit description" and "Delete post".
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { MediaCache } from '../../media/cache';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { FeedScreen, GalleryScreen, MoreScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';
import { SystemIcon } from '../../ui/kit';
import { paletteFor, type Colors } from '../../ui/theme';
import { ShareScreen } from '../ShareScreen';

const { dadSide } = FIXTURE.circles;
const { jo } = FIXTURE.users;
const SEEN = (u: string) => `hearth.lastSeen.v1.${u}`;
const PREFS = (u: string) => `hearth.prefs.v1.${u}`;
const HOUR = 3600e3;
const slow = { timeout: 4000 };
const GREETING = /^Good (morning|afternoon|evening), Grandma Jo$/;
const light = (): Colors => paletteFor(Platform.OS as 'ios', false);

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const isHost = (n: Inst) => typeof n.type === 'string';
const num = (...v: unknown[]) => Number(v.find((x) => typeof x === 'number') ?? 0);
const TRANSPARENT = /^(transparent|rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\))$/;
const noFill = (v: unknown) => v === undefined || v === null || TRANSPARENT.test(String(v));
const hostOrder = (root: Inst) => root.findAll(isHost) as Inst[];
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
function wordsIn(root: Inst): string {
  const parts: string[] = [];
  const walk = (c: unknown) => {
    if (typeof c === 'string' || typeof c === 'number') parts.push(String(c));
    else if (Array.isArray(c)) c.forEach(walk);
  };
  for (const t of root.findAll((n: Inst) => n.type === Text)) walk(t.props.children);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
/** The host nodes whose nearest host ancestor is `root` (what a row really lays out). */
function hostKids(root: Inst): Inst[] {
  return (root.findAll(isHost) as Inst[]).filter((n) => {
    let p = n.parent;
    while (p && !isHost(p)) p = p.parent;
    return p === root;
  });
}
/** Left inset from `root`: ancestors' left padding and margins, plus the node's own left padding when `own`. */
function inset(node: Inst, root: Inst, own: boolean): number {
  const s0 = flat(node.props.style);
  let x = num(s0.marginLeft, s0.marginHorizontal, s0.margin) + (own ? num(s0.paddingLeft, s0.paddingHorizontal, s0.padding) : 0);
  for (let n = node.parent; n; n = n.parent) {
    if (isHost(n)) {
      // Under jest the ScrollView's content padding stays on RCTScrollView's contentContainerStyle.
      const s = { ...flat(n.props.style), ...((n.type as unknown) === 'RCTScrollView' ? flat(n.props.contentContainerStyle) : {}) };
      x += num(s.paddingLeft, s.paddingHorizontal, s.padding) + num(s.marginLeft, s.marginHorizontal, s.margin) + num(s.borderLeftWidth, s.borderWidth);
    }
    if (n === root) break;
  }
  return x;
}
const kvFor = (bigText: boolean) => memoryKV({
  [SEEN(jo.id)]: new Date(Date.now() + HOUR).toISOString(),
  [PREFS(jo.id)]: JSON.stringify({ bigText, notify: 'push', look: 'system', color: 'ember' }),
});

async function gallery(be: FakeBackend) {
  const r = await renderApp(<GalleryScreen />, { be, kv: kvFor(false), user: 'jo' });
  await screen.findByRole('header', { name: GREETING }, slow);
  await waitFor(() => expect(within(screen.getByTestId('gallery-grid')).getAllByTestId(/^gallery-tile-/).length).toBeGreaterThan(0), slow);
  return r;
}
async function feedCard(user: 'jo' | 'chase', opts: { photos?: number; bigText?: boolean } = {}) {
  const be = FakeBackend.withFixture();
  const { id } = await seedPost(be, { caption: 'First snow!', photos: opts.photos ?? 1, circles: [dadSide.id] });
  const kv = user === 'jo' ? kvFor(opts.bigText ?? true) : memoryKV();
  const r = await renderApp(<FeedScreen />, { be, kv, user });
  const card = await screen.findByTestId(`post-${id}`, {}, slow);
  await within(card).findByTestId(`who-${id}`, {}, slow);
  return { ...r, be, id, card };
}

// =================================================================================================================
describe('UX-R13 (P1) Gallery: one wide photo per month; quiet days join into a range; no lone square', () => {
  it('UX-R13 a day of 5 photos: one wide, then rows of 2 or 3 squares that fill the row (no lone square, no empty filler)', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Pumpkins', photos: 5, takenAt: new Date(2025, 9, 17, 10).toISOString() });
    await gallery(be);
    const grid = screen.getByTestId('gallery-grid');
    await waitFor(() => expect(within(grid).getAllByTestId(/^gallery-tile-/)).toHaveLength(5));
    const rows = within(grid).getAllByTestId('gallery-grid-row');
    const shape = rows.map((r) => hostKids(r).map((k) => (/^gallery-tile-/.test(String(k.props.testID ?? '')) ? 'tile' : 'filler')));
    expect({ bad: shape.filter((r) => r.length < 2 || r.length > 3 || r.some((k) => k !== 'tile')) }).toEqual({ bad: [] });
  });

  it('UX-R13 three quiet days (one photo each) show as one range, "Nov 11–15"; a full day keeps its own date', async () => {
    const be = FakeBackend.withFixture();
    for (const d of [3, 3, 3]) await seedPost(be, { caption: `Day ${d}`, takenAt: new Date(2025, 10, d, 9).toISOString() });
    for (const d of [11, 13, 15]) await seedPost(be, { caption: `Day ${d}`, takenAt: new Date(2025, 10, d, 9).toISOString() });
    await gallery(be);
    await waitFor(() => expect(within(screen.getByTestId('gallery-grid')).getAllByTestId(/^gallery-tile-/)).toHaveLength(6));
    const words = wordsIn(screen.getByTestId('gallery-grid'));
    expect(words.match(/\b(Nov) \d{1,2}(–\d{1,2})?\b/g)).toEqual(['Nov 11–15', 'Nov 3']);
    // One wide tile for the whole month.
    const wide = within(screen.getByTestId('gallery-grid')).getAllByTestId(/^gallery-tile-/).filter((t) => Number(flat(t.props.style).aspectRatio) === 1.5);
    expect(wide).toHaveLength(1);
  });
});

// =================================================================================================================
describe('UX-R14 (P1) Post options: plain iOS-style rows; Delete post is red text, not a red pill', () => {
  it('UX-R14 Edit description and Delete post are plain rows (no filled capsule, words not centered); Delete post is red text', async () => {
    const { id, card } = await feedCard('chase');
    fireEvent.press(within(card).getByRole('button', { name: 'Post options' }));
    const menu = await screen.findByTestId(`more-${id}`);
    const c = light();
    const row = (name: string) => {
      const b = within(menu).getByRole('button', { name });
      const s = flat(b.props.style);
      const words = (b.findAll((n: Inst) => n.type === Text) as Inst[]).find((t) => textOf(t) === name)!;
      const w = flat(words.props.style);
      return {
        plain: noFill(s.backgroundColor) || s.backgroundColor === c.surface || s.backgroundColor === c.bg,
        pill: Number(s.borderRadius ?? 0) >= 20,
        centered: s.justifyContent === 'center' || w.textAlign === 'center',
        color: w.color,
        tall: Number(s.minHeight ?? s.height ?? 0) >= 48,
      };
    };
    expect(row('Edit description')).toEqual({ plain: true, pill: false, centered: false, color: expect.not.stringMatching(new RegExp(`^${c.danger}$`)), tall: true });
    expect(row('Delete post')).toEqual({ plain: true, pill: false, centered: false, color: c.danger, tall: true });
  });

  it('UX-R14 Delete post still asks first; "No, keep it" keeps the post', async () => {
    const { be, id, card } = await feedCard('chase');
    fireEvent.press(within(card).getByRole('button', { name: 'Post options' }));
    fireEvent.press(within(await screen.findByTestId(`more-${id}`)).getByRole('button', { name: 'Delete post' }));
    expect(await screen.findByText('Delete this photo for everyone?')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'No, keep it' }));
    expect(be.state.posts[id]!.deleted).toBe(false);
  });
});

// =================================================================================================================
const WHO_WORDS = /can see this|Sent to|can read (this|it)|shared this (photo|post) with|will read this/;
describe('UX-R15 (P1) on my own post, who can see it is said once', () => {
  it('UX-R15 my own post has one who-can-see line (not the names line plus "Sent to" plus "can read this")', async () => {
    const { id, card } = await feedCard('chase');
    const lines = (card.findAll((n: Inst) => isHost(n) && (n.type as unknown) === 'Text') as Inst[])
      .filter((t) => !(t.findAll((n: Inst) => isHost(n) && n !== t && (n.type as unknown) === 'Text').length)) // innermost only
      .map(textOf).filter((w) => WHO_WORDS.test(w));
    expect(lines).toEqual([expect.stringMatching(/can see this\.?$/)]);
    expect(within(card).getByTestId(`who-${id}`)).toBeTruthy();
  });

  it('UX-R15 DEC-49 the sender still finds the group by name, in Post options', async () => {
    const { id, card } = await feedCard('chase');
    fireEvent.press(within(card).getByRole('button', { name: 'Post options' }));
    const menu = await screen.findByTestId(`more-${id}`);
    expect(wordsIn(menu)).toMatch(/Grandparents – Dad's side/);
  });

  it('UX-R15 someone else\'s post keeps its who-can-see line (the excluded direction is unchanged)', async () => {
    const { id, card } = await feedCard('jo');
    expect(within(card).getByTestId(`who-${id}`)).toBeTruthy();
    expect(within(card).queryByText(/^Sent to/)).toBeNull();
  });
});

// =================================================================================================================
describe('UX-R16 (P1) comments: no heading; one rounded "Add a comment…" field with Post inside it', () => {
  it('UX-R16 no "Comments" heading or word on the card', async () => {
    const { card } = await feedCard('jo');
    expect(within(card).queryByRole('header', { name: 'Comments' })).toBeNull();
    expect(within(card).queryByText('Comments')).toBeNull();
  });

  it('UX-R16 one rounded field box, 48 pt+ tall, with no second box drawn around the text input', async () => {
    const { id, card } = await feedCard('jo');
    const box = within(card).getByTestId(`reply-${id}`);
    const s = flat(box.props.style);
    const input = within(box).getByLabelText('Add a comment for Chase');
    const i = flat(input.props.style);
    expect({
      rounded: Number(s.borderRadius ?? 0) >= 18,
      tall: Number(s.minHeight ?? s.height ?? 0) >= 48,
      drawn: !noFill(s.backgroundColor) || Number(s.borderWidth ?? 0) > 0,
      inputBorder: Number(i.borderWidth ?? 0),
      placeholder: input.props.placeholder,
    }).toEqual({ rounded: true, tall: true, drawn: true, inputBorder: 0, placeholder: 'Add a comment…' });
  });

  it('UX-R16 Post is hidden or off until there are words, then on, inside the field at its right end', async () => {
    const { id, card } = await feedCard('jo');
    const post = () => within(card).queryByRole('button', { name: 'Post' });
    const empty = post();
    expect(empty === null || empty.props.accessibilityState?.disabled === true).toBe(true);
    fireEvent.changeText(within(card).getByLabelText('Add a comment for Chase'), 'So cute!');
    await waitFor(() => expect(post()?.props.accessibilityState?.disabled).toBeFalsy());
    const box = within(card).getByTestId(`reply-${id}`);
    const order = hostOrder(box);
    const input = within(box).getByLabelText('Add a comment for Chase');
    const btn = within(box).queryByRole('button', { name: 'Post' });
    expect({ inside: !!btn, after: btn ? order.indexOf(btn) > order.indexOf(input) : false, row: flat(box.props.style).flexDirection })
      .toEqual({ inside: true, after: true, row: 'row' });
  });
});

// =================================================================================================================
describe('R17 (P2) More: one outline icon style; separators inset from the left', () => {
  const ROWS = /^(Messages|Groups|Events|Bigger text|Light or dark|Family color|Me|Help)(,|$)/;
  it('R17 every More row uses an outline symbol (no ".fill" / "filled" names)', async () => {
    await renderApp(<MoreScreen />, { user: 'chase' });
    await screen.findByRole('header', { name: 'More' }, slow);
    const rows = screen.getAllByRole('button').filter((b) => ROWS.test(String(b.props.accessibilityLabel)));
    expect(rows).toHaveLength(8);
    const filled = rows.flatMap((r) => within(r).UNSAFE_queryAllByType(SystemIcon).map((i) => (i.props as { icon: { sf: string; md: string } }).icon))
      .filter((i) => /\.fill\b|filled/i.test(i.sf) || /_filled\b|filled/i.test(i.md));
    expect(filled).toEqual([]);
  });

  it('R17 rows carry no full-width line; each separator starts after the icon (iOS inset)', async () => {
    await renderApp(<MoreScreen />, { user: 'chase' });
    await screen.findByRole('header', { name: 'More' }, slow);
    const rows = screen.getAllByRole('button').filter((b) => ROWS.test(String(b.props.accessibilityLabel)));
    const hair = (n: Inst) => {
      const s = flat(n.props.style);
      const edge = (w: unknown) => Number(w ?? 0) > 0 && Number(w) <= 1;
      return edge(s.borderBottomWidth) || edge(s.borderTopWidth) || (Number(s.height ?? 99) <= 1 && !noFill(s.backgroundColor));
    };
    const fullWidth = rows.filter((r) => hair(r)).map((r) => r.props.accessibilityLabel);
    expect(fullWidth).toEqual([]);
    const list = rows[0]!.parent!;
    let scope: Inst = list;
    while (scope.parent && !rows.every((r) => scope.findAll(isHost).includes(r))) scope = scope.parent;
    const lines = (scope.findAll(isHost) as Inst[]).filter((n) => hair(n) && !rows.includes(n));
    expect(lines.length).toBeGreaterThanOrEqual(rows.length - 1);
    const indented = (n: Inst) => {
      const s = flat(n.props.style);
      if (num(s.marginLeft, s.marginStart, s.left, s.marginHorizontal) >= 40) return true;
      // or the line sits on the words' box, which comes after the icon in the row
      let p = n.parent;
      while (p && !isHost(p)) p = p.parent;
      return !!p && flat(p.props.style).flexDirection === 'row' && hostKids(p).indexOf(n) > 0;
    };
    expect(lines.filter((n) => !indented(n)).length).toBe(0);
  });
});

// =================================================================================================================
describe('R18 (P2) Gallery: the month title sticks while scrolling', () => {
  it('R18 each month title is a sticky header of the Gallery scroll (under the pinned search field)', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Hay ride', photos: 3, takenAt: new Date(2025, 9, 17, 15).toISOString() });
    await seedPost(be, { caption: 'Back to school', photos: 3, takenAt: new Date(2025, 8, 3, 9).toISOString() });
    await gallery(be);
    const scroll = screen.getByTestId('gallery-scroll');
    await act(async () => {
      fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y: 600 }, contentSize: { width: 390, height: 3000 }, layoutMeasurement: { width: 390, height: 844 } } });
    });
    const months = ['October 2025', 'September 2025'].map((m) => screen.getByRole('header', { name: m }));
    const sticky = (scroll.props.stickyHeaderIndices as number[] | undefined) ?? [];
    const content = scroll.findAll(isHost)[0];
    const kids = hostKids(content ?? scroll);
    const isSticky = (h: Inst) => sticky.some((i) => kids[i] && (kids[i] === h || kids[i]!.findAll(isHost).includes(h)));
    expect(months.map((h) => ({ month: h.props.accessibilityLabel, sticky: isSticky(h) })))
      .toEqual([{ month: 'October 2025', sticky: true }, { month: 'September 2025', sticky: true }]);
  });
});

// =================================================================================================================
describe('R19 (P2) Share: one 16 pt left edge for all content', () => {
  it('R19 the title, Pick photos, the boxes\' labels, "Who can see it" and the group rows all start 16 pt in', async () => {
    await renderApp(<ShareScreen />, { user: 'chase' });
    const title = await screen.findByRole('header', { name: 'Share photos' }, slow);
    await screen.findAllByRole('checkbox', {}, slow);
    let root: Inst = title;
    while (root.parent) root = root.parent;
    const pick = screen.getByRole('button', { name: /^Pick photos/ });
    const got = {
      title: inset(title, root, false),
      pick: inset(pick, root, true),
      titleLabel: inset(screen.getByText('Title (optional)'), root, false),
      whoCanSee: inset(screen.getByRole('header', { name: 'Who can see it' }), root, false),
      firstGroup: inset(screen.getAllByRole('checkbox')[0]!, root, true),
    };
    expect(got).toEqual({ title: 16, pick: 16, titleLabel: 16, whoCanSee: 16, firstGroup: 16 });
  });
});

// =================================================================================================================
describe('R20 (P2) a photo still loading in a small square says so without clipping', () => {
  beforeEach(() => { jest.spyOn(MediaCache.prototype, 'uri').mockImplementation(() => new Promise<string>(() => {})); });
  afterEach(() => jest.restoreAllMocks());
  const loadingOk = (tile: Inst) => {
    const words = wordsIn(tile);
    const spinner = tile.findAll((n: Inst) => n.type === ActivityIndicator)[0];
    return {
      short: words === '' || words === 'Loading…',
      spoken: /Loading/.test(words) || /Loading/.test(String(spinner?.props.accessibilityLabel ?? '')),
    };
  };

  it('R20 a Gallery square shows "Loading…" or a spinner with a spoken label, never "Loading the photo…"', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Pumpkins', photos: 4, takenAt: new Date(2025, 9, 17, 10).toISOString() });
    await gallery(be);
    const squares = within(screen.getByTestId('gallery-grid')).getAllByTestId(/^gallery-tile-/).filter((t) => Number(flat(t.props.style).aspectRatio) === 1);
    expect(squares.length).toBeGreaterThan(0);
    for (const s of squares) expect(loadingOk(s)).toEqual({ short: true, spoken: true });
  });

  it('R20 the Feed mosaic\'s small tiles too', async () => {
    const { id, card } = await feedCard('jo', { photos: 4, bigText: true });
    const tiles = within(within(card).getByTestId(`collage-${id}`)).getAllByRole('button', { name: /^Open photo \d of 4/ }).slice(1);
    for (const t of tiles) expect(loadingOk(t)).toEqual({ short: true, spoken: true });
  });
});

// =================================================================================================================
describe('R21 (P2) the reaction row starts at the 16 pt content edge', () => {
  it('R21 the first emoji sits 16 pt in, like the name, the photos and the words', async () => {
    const { id, card } = await feedCard('jo');
    const row = within(card).getByTestId(`actions-${id}`);
    const first = within(row).getAllByRole('button')[0]!;
    const s = flat(first.props.style);
    expect(inset(first, card, true) - num(s.borderLeftWidth, s.borderWidth)).toBe(16);
  });
});

// =================================================================================================================
describe('R22 (P2) names grow with Bigger text, like the words around them', () => {
  it.each([[true, 21], [false, 17]] as const)('R22 Bigger text %s: the name on the post, in the description and on a comment are all %i pt', async (bigText, size) => {
    const { be, id } = await (async () => {
      const be0 = FakeBackend.withFixture();
      const p = await seedPost(be0, { caption: 'First snow!', circles: [dadSide.id] });
      await be0.clientFor(FIXTURE.users.alex.id).addComment({ post: p.id, body: 'So pretty', clientId: 'alex-c' });
      return { be: be0, id: p.id };
    })();
    await renderApp(<FeedScreen />, { be, kv: kvFor(bigText), user: 'jo' });
    const card = await screen.findByTestId(`post-${id}`, {}, slow);
    await within(card).findByText(/So pretty/, {}, slow);
    const sizeOf = (t: Inst) => {
      // a nested name inherits its parent's size when it sets none
      for (let n: Inst | null = t; n; n = n.parent) { const f = flat(n.props.style).fontSize; if (f !== undefined) return f; }
      return undefined;
    };
    const head = within(within(card).getByTestId(`card-head-${id}`)).getByText('Chase');
    const names = (card.findAll((n: Inst) => n.type === Text) as Inst[]).filter((t) => textOf(t) === 'Chase' || textOf(t) === 'Alex');
    expect({ head: sizeOf(head), others: names.map(sizeOf) }).toEqual({ head: size, others: names.map(() => size) });
  });
});
