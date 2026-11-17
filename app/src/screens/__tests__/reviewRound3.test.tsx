// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Review round 3 (ux-reviewer, Nov 17; SPEC-REDESIGN RD-67..RD-73). Written first (red), Nov 17.
// UX-R30's pure layout is in feed/__tests__/gallery.test.ts; UX-R27 at 390 px on the web is in e2e-web/demo.spec.js.
//
// The engineer's contract (everything else is found by role, label and words):
//   - UX-R24: Delete post opens an alert-style dialog inside a Modal (never inline in the feed). Title exactly
//     "Delete this post?" (one photo or many). Two plain text buttons, no fill: "Keep it" (Semibold, the default) and
//     "Delete" (Regular, red text). "Keep it" keeps the post; "Delete" deletes it.
//   - UX-R25: the sticky month title (role header, `aria-level` 2) has the page color (c.bg) and 12 pt of bottom
//     padding inside it, so photos sliding under it never touch the words.
//   - UX-R26: "Your comment goes to the same people." shows only while the comment field is focused or holds words.
//     The fewer-readers line ("Alex and Chase will read this.") still shows all the time (privacy, both directions).
//   - UX-R27: `namesLine` names at most 2 others, then "and N more"; the Who sheet still lists everyone.
//   - UX-R28: no header with the post title; `desc-<id>` starts with the title, in Medium; the title comes after the
//     name row. (Whether the sender's name also stays in the description is the engineer's and ux-reviewer's call.)
//   - UX-R29: "Delete post" (and the dialog's "Delete") are #FF453A in dark mode; in light, #D70015 or the palette's
//     red, at 4.5:1 or better on the sheet.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { Modal, Platform, StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { FeedScreen, GalleryScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';
import { contrast, paletteFor, type Colors } from '../../ui/theme';
import { namesLine } from '../PostCard';

const { dadSide } = FIXTURE.circles;
const { jo } = FIXTURE.users;
const SEEN = (u: string) => `hearth.lastSeen.v1.${u}`;
const PREFS = (u: string) => `hearth.prefs.v1.${u}`;
const HOUR = 3600e3;
const slow = { timeout: 4000 };
const GREETING = /^Good (morning|afternoon|evening), Grandma Jo$/;
const light = (): Colors => paletteFor(Platform.OS as 'ios', false);
const dark = (): Colors => paletteFor(Platform.OS as 'ios', true);
const SAME = 'Your comment goes to the same people.';

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const isHost = (n: Inst) => typeof n.type === 'string';
const num = (...v: unknown[]) => Number(v.find((x) => typeof x === 'number') ?? 0);
const TRANSPARENT = /^(transparent|rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\))$/;
const noFill = (v: unknown) => v === undefined || v === null || TRANSPARENT.test(String(v));
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
/** The words of a button, and their own color and weight (the Text whose words are exactly `name`). */
function wordsStyle(b: Inst, name: string) {
  const t = (b.findAll((n: Inst) => n.type === Text) as Inst[]).find((x) => textOf(x) === name);
  const s = t ? flat(t.props.style) : {};
  return { color: s.color, weight: String(s.fontWeight ?? '400') };
}
const kvFor = (user: string, opts: { bigText?: boolean; look?: 'system' | 'light' | 'dark' } = {}) => memoryKV({
  [SEEN(user)]: new Date(Date.now() + HOUR).toISOString(),
  [PREFS(user)]: JSON.stringify({ bigText: opts.bigText ?? false, notify: 'push', look: opts.look ?? 'light', color: 'ember' }),
});
async function feedCard(user: 'jo' | 'chase' | 'earl', opts: { photos?: number; look?: 'light' | 'dark'; title?: string; replies?: 'parents' | 'everyone' } = {}) {
  const be = FakeBackend.withFixture();
  if (opts.replies) be.state.spaces[FIXTURE.space.id]!.reply_audience = opts.replies;
  const { id } = await seedPost(be, { caption: 'First snow!', title: opts.title ?? null, photos: opts.photos ?? 1, circles: [dadSide.id] });
  const r = await renderApp(<FeedScreen />, { be, kv: kvFor(FIXTURE.users[user].id, { look: opts.look }), user });
  const card = await screen.findByTestId(`post-${id}`, {}, slow);
  await within(card).findByTestId(`who-${id}`, {}, slow);
  return { ...r, be, id, card };
}
async function openDelete(card: Inst, id: string) {
  fireEvent.press(within(card).getByRole('button', { name: 'Post options' }));
  fireEvent.press(within(await screen.findByTestId(`more-${id}`)).getByRole('button', { name: 'Delete post' }));
}

// =================================================================================================================
describe('UX-R24 (P1) RD-67 Delete asks in an iOS-style alert: "Delete this post?", Keep it (bold) and Delete (red text)', () => {
  it.each([1, 3])('UX-R24 %i photo(s): the title is "Delete this post?" in a dialog over the screen, not inline in the feed', async (photos) => {
    const { id, card } = await feedCard('chase', { photos });
    await openDelete(card, id);
    const title = await screen.findByText('Delete this post?');
    let inModal = false;
    for (let p: Inst | null = title; p; p = p.parent) if (p.type === Modal) { inModal = true; break; }
    expect({ inModal, oldWords: screen.queryByText(/for everyone\?$/) }).toEqual({ inModal: true, oldWords: null });
  });

  it('UX-R24 two plain text buttons: "Keep it" Semibold (the default) and "Delete" in red Regular text; no filled button', async () => {
    const { id, card } = await feedCard('chase');
    await openDelete(card, id);
    await screen.findByText('Delete this post?');
    const c = light();
    const keep = screen.getByRole('button', { name: 'Keep it' });
    const del = screen.getByRole('button', { name: 'Delete' });
    const plain = (b: Inst) => { const bg = flat(b.props.style).backgroundColor; return noFill(bg) || bg === c.surface || bg === c.bg; };
    const reds = [c.danger, '#D70015', '#FF3B30'];
    expect({
      keepPlain: plain(keep), delPlain: plain(del),
      keepWeight: wordsStyle(keep, 'Keep it').weight, keepRed: reds.includes(String(wordsStyle(keep, 'Keep it').color)),
      delWeight: wordsStyle(del, 'Delete').weight, delRed: reds.includes(String(wordsStyle(del, 'Delete').color)),
    }).toEqual({ keepPlain: true, delPlain: true, keepWeight: '600', keepRed: false, delWeight: '400', delRed: true });
    expect(screen.queryByRole('button', { name: /^(Yes, delete|No, keep)/ })).toBeNull();
  });

  it('UX-R24 "Keep it" keeps the post; "Delete" deletes it', async () => {
    const { be, id, card } = await feedCard('chase');
    await openDelete(card, id);
    fireEvent.press(await screen.findByRole('button', { name: 'Keep it' }));
    await waitFor(() => expect(screen.queryByText('Delete this post?')).toBeNull());
    expect(be.state.posts[id]!.deleted).toBe(false);
    await openDelete(card, id);
    fireEvent.press(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(be.state.posts[id]!.deleted).toBe(true));
  });
});

// =================================================================================================================
describe('UX-R25 (P2) RD-68 12 pt of page-colored space under the sticky month title', () => {
  it('UX-R25 the month title box has the page color and 12 pt of padding under the words', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Pumpkins', photos: 4, takenAt: new Date(2025, 9, 17, 10).toISOString() });
    await renderApp(<GalleryScreen />, { be, kv: kvFor(jo.id), user: 'jo' });
    await screen.findByRole('header', { name: GREETING }, slow);
    const head = await screen.findByRole('header', { name: 'October 2025' }, slow);
    const s = flat(head.props.style);
    expect({ bg: s.backgroundColor, under: num(s.paddingBottom, s.paddingVertical, s.padding) })
      .toEqual({ bg: light().bg, under: 12 });
  });
});

// =================================================================================================================
describe('UX-R26 (P2) RD-69 "Your comment goes to the same people." only while commenting', () => {
  it('UX-R26 hidden at rest; shown on focus; hidden again on blur while empty; shown while the field holds words', async () => {
    const { card } = await feedCard('jo', { replies: 'everyone' });
    const field = within(card).getByLabelText('Add a comment for Chase');
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); }); // let the reader list arrive
    const shown = () => !!within(card).queryByText(SAME);
    const steps: Record<string, boolean> = { rest: shown() };
    fireEvent(field, 'focus');
    await waitFor(() => expect(shown()).toBe(true));
    steps.focused = shown();
    fireEvent(field, 'blur');
    await waitFor(() => expect(shown()).toBe(false));
    steps.blurredEmpty = shown();
    fireEvent(field, 'focus');
    fireEvent.changeText(field, 'So pretty');
    fireEvent(field, 'blur');
    await waitFor(() => expect(shown()).toBe(true));
    steps.blurredWithWords = shown();
    expect(steps).toEqual({ rest: false, focused: true, blurredEmpty: false, blurredWithWords: true });
  });

  it('UX-R26 privacy, other direction: when fewer people read the comment, that line stays at rest', async () => {
    const { card } = await feedCard('jo', { replies: 'parents' });
    expect(await within(card).findByText('Alex and Chase will read this.', {}, slow)).toBeTruthy();
  });
});

// =================================================================================================================
describe('UX-R27 (P2) RD-70 the who-can-see line is one line: at most 2 names, then "and N more"', () => {
  const v = (...names: string[]) => [{ user_id: 'me', name: 'Me' }, ...names.map((name, i) => ({ user_id: `u${i}`, name }))];
  it('UX-R27 namesLine: 1, 2, 3 and 5 others', () => {
    expect([
      namesLine(v('Alex'), 'me'),
      namesLine(v('Alex', 'Chase'), 'me'),
      namesLine(v('Alex', 'Chase', 'Grandma Jo'), 'me'),
      namesLine(v('Alex', 'Chase', 'Grandma Jo', 'Grandpa Earl', 'Nana Ruth'), 'me'),
    ]).toEqual([
      'Alex can see this.',
      'Alex and Chase can see this.',
      'Alex, Chase and 1 more can see this.',
      'Alex, Chase and 3 more can see this.',
    ]);
  });

  it('UX-R27 on the card Grandpa Earl reads two names and "1 more"; the Who sheet still lists everyone', async () => {
    const { id, card } = await feedCard('earl');
    const who = within(card).getByTestId(`who-${id}`);
    expect(within(who).getByText('Alex, Chase and 1 more can see this.')).toBeTruthy();
    fireEvent.press(who);
    const sheet = await screen.findByTestId(`who-sheet-${id}`);
    expect(within(sheet).getAllByTestId('person-name').map((n) => n.props.children)).toEqual(['You', 'Alex', 'Chase', 'Grandma Jo']);
  });
});

// =================================================================================================================
describe('UX-R28 (P2) RD-71 the title opens the description, in Medium; never a heading above it', () => {
  it('UX-R28 no title heading; the description starts with the title in Medium, after the name row', async () => {
    const { id, card } = await feedCard('jo', { title: 'Pumpkin patch' });
    const desc = within(card).getByTestId(`desc-${id}`);
    const titleText = (desc.findAll((n: Inst) => n.type === Text) as Inst[]).find((t) => textOf(t) === 'Pumpkin patch');
    const order = card.findAll(isHost) as Inst[];
    const firstTitle = order.findIndex((n) => (n.type as unknown) === 'Text' && textOf(n).startsWith('Pumpkin patch'));
    expect({
      heading: within(card).queryByRole('header', { name: 'Pumpkin patch' }) !== null,
      starts: textOf(desc).startsWith('Pumpkin patch'),
      weight: titleText ? String(flat(titleText.props.style).fontWeight) : 'no title in the description',
      afterName: firstTitle > order.indexOf(within(card).getByTestId(`card-head-${id}`)),
      caption: textOf(desc).includes('First snow!'),
    }).toEqual({ heading: false, starts: true, weight: '500', afterName: true, caption: true });
  });
});

// =================================================================================================================
describe('UX-R29 (P2) RD-72 Delete is iOS red: #FF453A in dark, a 4.5:1 red in light', () => {
  it('UX-R29 dark mode: "Delete post" and the dialog\'s "Delete" are #FF453A', async () => {
    const { id, card } = await feedCard('chase', { look: 'dark' });
    fireEvent.press(within(card).getByRole('button', { name: 'Post options' }));
    const row = within(await screen.findByTestId(`more-${id}`)).getByRole('button', { name: 'Delete post' });
    const rowColor = wordsStyle(row, 'Delete post').color;
    expect({ row: rowColor }).toEqual({ row: '#FF453A' });
    fireEvent.press(row);
    const del = await screen.findByRole('button', { name: 'Delete' });
    expect({ row: rowColor, dialog: wordsStyle(del, 'Delete').color }).toEqual({ row: '#FF453A', dialog: '#FF453A' });
    expect(contrast('#FF453A', dark().surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('UX-R29 light mode: "Delete post" is #D70015 or the palette red, at 4.5:1 or better on the sheet', async () => {
    const { id, card } = await feedCard('chase', { look: 'light' });
    fireEvent.press(within(card).getByRole('button', { name: 'Post options' }));
    const row = within(await screen.findByTestId(`more-${id}`)).getByRole('button', { name: 'Delete post' });
    const color = String(wordsStyle(row, 'Delete post').color);
    const c = light();
    expect({ red: ['#D70015', c.danger].includes(color), ok: contrast(color, c.surface) >= 4.5 }).toEqual({ red: true, ok: true });
  });
});

