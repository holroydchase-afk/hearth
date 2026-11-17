// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Redesign polish (grandparent-ux review of 1a..1c, Nov 16): GUX-R1..R10. Written first (red), Nov 16.
// GUX-R11 (words under the reaction emoji) is skipped on purpose: it conflicts with REACT-7 (Chase: emoji only).
//
// The engineer's contract (everything else is found by role and words):
//   - Back buttons keep their spoken name ("Back to More", "Back to Gallery") but show only the place's word with a
//     back chevron ("‹ More"), as a text button (no fill, no border) at the top left, above the screen's title, 48 pt+.
//   - testID `who-<postId>` stays on the card's "can see this" button (now words, not initials).
//   - The post's options sheet keeps testID `more-<postId>`.
// Assumption to confirm (grandparent-ux): the card's names line leaves out "You" (the reviewer's example
// "Alex, Grandma Jo and 2 more can see this."); up to 3 others are all named, past 3 the first two and "N more".
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { demoTip } from '../../demo/DemoTip';
import { memoryKV } from '../../platform/kv';
import { saveLastAudience } from '../../share/audienceMemory';
import { seedPost } from '../../test/seed';
import { FeedScreen, GalleryScreen, MoreScreen } from '../../test/redesignScreens';
import { renderApp, screenWords } from '../../test/renderApp';
import { tapSearchField } from '../../test/galleryEntry';
import { paletteFor } from '../../ui/theme';
import { HelpScreen } from '../HelpScreen';
import { ShareScreen } from '../ShareScreen';

const { dadSide, everyone } = FIXTURE.circles;
const { jo } = FIXTURE.users;
const light = () => paletteFor(Platform.OS as 'ios', false);
const KEY = (u: string) => `hearth.lastSeen.v1.${u}`;
const HOUR = 3600e3;
const slow = { timeout: 5000 };
const GROUP_NAMES = /Grandparents –|Dad's side|Mom's side|\bgroups?\b/i;

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const isHost = (n: Inst) => typeof n.type === 'string';
const isView = (n: Inst) => (n.type as unknown) === 'View';
/** All host nodes in document order. */
const hostOrder = () => screen.UNSAFE_root.findAll(isHost) as Inst[];
function wordsIn(root: Inst): string {
  const parts: string[] = [];
  const walk = (c: unknown) => {
    if (typeof c === 'string' || typeof c === 'number') parts.push(String(c));
    else if (Array.isArray(c)) c.forEach(walk);
  };
  for (const t of root.findAll((n: Inst) => n.type === Text)) walk(t.props.children);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
const TRANSPARENT = /^(transparent|rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\))$/;
const noColor = (v: unknown) => v === undefined || v === null || TRANSPARENT.test(String(v));
/** A grey (or no color at all): red, green and blue within 8 of each other. */
function neutral(v: unknown): boolean {
  if (noColor(v)) return true;
  const s = String(v);
  let rgb: number[] | null = null;
  const hex = /^#([0-9a-f]{6})$/i.exec(s) ?? /^#([0-9a-f]{3})$/i.exec(s);
  if (hex) {
    const h = hex[1]!.length === 3 ? hex[1]!.split('').map((x) => x + x).join('') : hex[1]!;
    rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else {
    const m = /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/.exec(s);
    if (m) rgb = [m[1], m[2], m[3]].map(Number);
  }
  if (!rgb) return false;
  return Math.max(...rgb) - Math.min(...rgb) <= 8;
}

// ---------------------------------------------------------------------------------------------------------------
// GUX-R1: a top-left text back button "‹ More" / "‹ Gallery".
// ---------------------------------------------------------------------------------------------------------------

const parentIsRow = (n: Inst) => {
  for (let p = n.parent; p; p = p.parent) if (isHost(p)) return flat(p.props.style).flexDirection === 'row';
  return false;
};

/** The back button: spoken "Back to <word>", shows only "<word>" (a chevron allowed), a text button with no
 *  capsule, 48 pt+, not stretched full width, and above the screen's first heading (top left). */
function expectTopBack(word: 'More' | 'Gallery') {
  const btn = screen.getByRole('button', { name: `Back to ${word}` });
  const s = flat(btn.props.style);
  const shown = wordsIn(btn).replace(/[‹<]/g, '').trim();
  const firstHeader = screen.getAllByRole('header')[0]!;
  const order = hostOrder();
  expect({
    word,
    shown,
    capsuleFill: noColor(s.backgroundColor),
    border: Number(s.borderWidth ?? 0) === 0 || noColor(s.borderColor),
    tall: Number(s.minHeight ?? s.height ?? 0) >= 48,
    // Not stretched across the screen: it hugs its word (flex-start) or sits in a top-bar row.
    notFullWidth: s.alignSelf === 'flex-start' || s.alignSelf === 'baseline' || parentIsRow(btn),
    aboveTitle: order.indexOf(btn) < order.indexOf(firstHeader),
  }).toEqual({ word, shown: word, capsuleFill: true, border: true, tall: true, notFullWidth: true, aboveTitle: true });
}

describe('GUX-R1 a top-left "‹ More" / "‹ Gallery" back button', () => {
  it('GUX-R1 every screen opened from More shows "‹ More" at the top left, a 48 pt text button, not a full-width capsule', async () => {
    await renderApp(<MoreScreen />, { user: 'chase' });
    await screen.findByRole('header', { name: 'More' });
    for (const row of ['Messages', 'Groups', 'Events', 'Bigger text', 'Light or dark', 'Family color', 'Me', 'Help']) {
      fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${row}(,|$)`) }));
      await screen.findByRole('button', { name: 'Back to More' }, slow);
      expectTopBack('More');
      fireEvent.press(screen.getByRole('button', { name: 'Back to More' }));
      await screen.findByRole('header', { name: 'More' });
    }
  });

  // Updated Nov 17 for RD-47 (DEC-65): Search opens from the "Search photos" field; By date is no longer on Gallery.
  it('GUX-R1 RD-47 Search, opened from Gallery\'s field, shows "‹ Gallery" the same way', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Lake day' });
    await renderApp(<GalleryScreen />, { be, user: 'jo' });
    await tapSearchField();
    await screen.findByRole('header', { name: 'Search photos' });
    expectTopBack('Gallery');
    fireEvent.press(screen.getByRole('button', { name: 'Back to Gallery' }));
    expect(await screen.findByRole('header', { name: /^Good (morning|afternoon|evening)/ })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// GUX-R2: no box inside a box.
// ---------------------------------------------------------------------------------------------------------------

/** Every boxed thing (its own border, or a fill unlike the box around it) that holds words and sits inside another
 *  box. The screen's own background is not a box. The few filled accent / red buttons (RD-7) are allowed. */
function boxesInBoxes(): string[] {
  const c = light();
  const allowed = new Set([c.accent, c.danger]);
  const fillOf = (n: Inst) => {
    const s = flat(n.props.style);
    return noColor(s.backgroundColor) || s.backgroundColor === c.bg ? null : String(s.backgroundColor);
  };
  const isBox = (n: Inst, outerFill: string | null) => {
    if (!isView(n)) return false;
    const s = flat(n.props.style);
    const border = Number(s.borderWidth ?? 0) > 0 && !noColor(s.borderColor);
    const fill = fillOf(n);
    return border || (fill !== null && fill !== outerFill);
  };
  const out: string[] = [];
  for (const n of screen.UNSAFE_root.findAll((x: Inst) => isView(x)) as Inst[]) {
    if (!n.findAll((x: Inst) => x.type === Text).length) continue;
    if (allowed.has(String(flat(n.props.style).backgroundColor))) continue;
    let outer: Inst | null = null;
    for (let p = n.parent; p; p = p.parent) if (isView(p) && isBox(p, null)) { outer = p; break; }
    if (outer && isBox(n, fillOf(outer))) out.push(n.props.accessibilityLabel ?? (wordsIn(n).slice(0, 40) || '(no words)'));
  }
  return out;
}

describe('GUX-R2 plain grouped rows, one level: no box inside a box', () => {
  it('GUX-R2 Help (Grandma Jo): every row sits straight in its section, with no box of its own', async () => {
    await renderApp(<HelpScreen />, { user: 'jo' });
    await screen.findByRole('header', { name: 'Help' });
    await screen.findByText('How should we tell you about new photos?');
    expect(boxesInBoxes()).toEqual([]);
  });

  it('GUX-R2 Bigger text (from More): the switch row is a plain row in one section', async () => {
    await renderApp(<MoreScreen />, { user: 'jo' });
    fireEvent.press(await screen.findByRole('button', { name: 'Bigger text' }));
    await screen.findByRole('switch', { name: 'Bigger text' });
    expect(boxesInBoxes()).toEqual([]);
  });

  it('GUX-R2 Share: "Who can see it" rows and the Pick photos section have no boxes inside them', async () => {
    const kv = memoryKV();
    await saveLastAudience(kv, FIXTURE.users.chase.id, [dadSide.id]);
    await renderApp(<ShareScreen />, { user: 'chase', kv });
    await screen.findByRole('checkbox', { name: "Grandparents – Dad's side, 3 people" });
    fireEvent.press(screen.getByRole('button', { name: 'Pick photos from your phone' }));
    await screen.findByText('1 photo picked');
    expect(boxesInBoxes()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// GUX-R3: the post's "··· More" is "Options". Updated Nov 17 for RD-50 (DEC-65): the word goes; a small "⋯" spoken
// "Post options" opens the same menu. Still no "More" on the card.
// ---------------------------------------------------------------------------------------------------------------

describe('GUX-R3 RD-50 the post\'s menu button is "⋯" (Post options), not More', () => {
  it('GUX-R3 RD-50 one photo: "⋯" (spoken "Post options") opens who can see it; no "More" on the card', async () => {
    const be = FakeBackend.withFixture();
    const { id } = await seedPost(be, { caption: 'Lake day' });
    await renderApp(<FeedScreen />, { be, user: 'jo' });
    const card = await screen.findByTestId(`post-${id}`);
    const btn = within(card).getByRole('button', { name: 'Post options' });
    expect(wordsIn(btn)).toMatch(/^[⋯…·\s]*$/);
    expect(within(card).queryByText('More')).toBeNull();
    expect(within(card).queryByRole('button', { name: /^More\b/ })).toBeNull();
    fireEvent.press(btn);
    expect(within(await screen.findByTestId(`more-${id}`)).getByText('Who can see this')).toBeTruthy();
  });

  it('GUX-R3 RD-50 several photos: the same "Post options"', async () => {
    const be = FakeBackend.withFixture();
    const { id } = await seedPost(be, { caption: 'Lake day', photos: 3 });
    await renderApp(<FeedScreen />, { be, user: 'jo' });
    const card = await screen.findByTestId(`post-${id}`);
    expect(wordsIn(within(card).getByRole('button', { name: 'Post options' }))).toMatch(/^[⋯…·\s]*$/);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// GUX-R4 and GUX-R5: words.
// ---------------------------------------------------------------------------------------------------------------

// DEC-61 (Chase, Nov 16): the numbered Try-this steps are gone from Gallery and Feed, so GUX-R4's wording moot.
describe('GUX-R4 / DEC-61 no demo steps on Gallery or Feed', () => {
  it('GUX-R4 DEC-61 no numbered steps for the parent on a phone, so nothing says "parent\'s Photos"', () => {
    expect(demoTip(390, 'parent')).toBeNull();
  });
});

describe('GUX-R5 the Feed screen is titled Feed', () => {
  it('GUX-R5 Feed\'s large title is "Feed", not "Photos of Mia and Leo"', async () => {
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Lake day' });
    await renderApp(<FeedScreen />, { be, user: 'jo' });
    await screen.findByText('Lake day');
    const title = screen.getAllByRole('header').find((h) => h.props['aria-level'] === 1)!;
    expect(String(title.props.accessibilityLabel ?? [title.props.children].flat().join(''))).toBe('Feed');
    expect(screen.queryByText(/^Photos of /)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// GUX-R6: who can see it, in names (DEC-49: people, never group titles).
// ---------------------------------------------------------------------------------------------------------------

describe('GUX-R6 the card names who can see it', () => {
  async function card(user: 'jo' | 'earl' | 'ruth' | 'chase', circle: string) {
    const be = FakeBackend.withFixture();
    const { id } = await seedPost(be, { caption: 'At the lake', circles: [circle] });
    await renderApp(<FeedScreen />, { be, user });
    return { id };
  }

  // Chase, Nov 16 (DEC-60): "Names". Reverses WHO-10 / LIVE-4 (Nov 5).
  it('GUX-R6 a long list: "Alex, Chase and 2 more can see this." in words, no initials circles', async () => {
    const { id } = await card('jo', everyone.id);
    const who = await screen.findByTestId(`who-${id}`, {}, slow);
    expect(wordsIn(who)).toBe('Alex, Chase and 2 more can see this.');
    expect(within(who).queryAllByTestId(/^face-/)).toHaveLength(0);
    expect(within(who).queryByText(/^\+\d+$/)).toBeNull();
    expect(wordsIn(who)).not.toMatch(GROUP_NAMES);
  });

  // Chase, Nov 16 (DEC-60): "Names". Reverses WHO-10 / LIVE-4 (Nov 5).
  it('GUX-R6 three others are all named: Grandpa Earl reads "Alex, Chase and Grandma Jo can see this."', async () => {
    const { id } = await card('earl', dadSide.id);
    const who = await screen.findByTestId(`who-${id}`, {}, slow);
    expect(wordsIn(who)).toBe('Alex, Chase and Grandma Jo can see this.');
  });

  // Chase, Nov 16 (DEC-60): "Names". Reverses WHO-10 / LIVE-4 (Nov 5).
  it('GUX-R6 DEC-49 the sender sees people\'s names on that line too, never the group\'s title', async () => {
    const { id } = await card('chase', dadSide.id);
    const who = await screen.findByTestId(`who-${id}`, {}, slow);
    expect(wordsIn(who)).toMatch(/can see this\.$/);
    expect(wordsIn(who)).toMatch(/Grandma Jo/);
    expect(wordsIn(who)).not.toMatch(GROUP_NAMES);
  });

  // Privacy both ways for the names line (GUX-R6, DEC-60).
  it('GUX-R6 privacy both ways: Nana Ruth (not in Dad\'s side) is never named, and she never sees that post', async () => {
    const { id } = await card('jo', dadSide.id);
    const who = await screen.findByTestId(`who-${id}`, {}, slow);
    expect(wordsIn(who)).not.toMatch(/Nana Ruth/);
    screen.unmount();
    const be = FakeBackend.withFixture();
    await seedPost(be, { caption: 'Dad side only', circles: [dadSide.id] });
    await seedPost(be, { caption: 'For everyone', circles: [everyone.id] });
    await renderApp(<FeedScreen />, { be, user: 'ruth' });
    await screen.findByText('For everyone');
    expect(screen.queryByText('Dad side only')).toBeNull();
  });

  // Privacy both ways for the names line (GUX-R6, DEC-60).
  it('GUX-R6 tapping the names still opens everyone who can see it', async () => {
    const { id } = await card('jo', dadSide.id);
    fireEvent.press(await screen.findByTestId(`who-${id}`, {}, slow));
    const sheet = await screen.findByTestId(`who-sheet-${id}`);
    expect(within(sheet).getAllByTestId('person-name').map((p) => p.props.children)).toEqual(['You', 'Alex', 'Chase', 'Grandpa Earl']);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// GUX-R7 and GUX-R8: the New for you walk.
// ---------------------------------------------------------------------------------------------------------------

async function joWithNew(captions: string[]) {
  const be = FakeBackend.withFixture();
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const earlier = new Date(Math.max(midnight.getTime(), Date.now() - HOUR)).toISOString();
  for (const caption of captions) await seedPost(be, { caption, circles: [dadSide.id] });
  return { be, kv: memoryKV({ [KEY(jo.id)]: earlier }) };
}

describe('GUX-R7 finishing the walk clears New for you', () => {
  it('GUX-R7 after Done, Gallery no longer shows New for you or its "N new" chip for those photos', async () => {
    const { be, kv } = await joWithNew(['First at the park', 'Then the cake']);
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    const section = await screen.findByTestId('new-for-you');
    expect(within(section).getByText('2 new')).toBeTruthy();
    fireEvent.press(within(section).getByRole('button', { name: /^See all(?! the photos)/ }));
    await screen.findByTestId('new-one-at-a-time');
    fireEvent.press(screen.getByRole('button', { name: 'Next new photo' }));
    fireEvent.press(await screen.findByRole('button', { name: /^Done/ }));
    await screen.findByTestId('gallery-grid');
    expect(screen.queryByTestId('new-for-you')).toBeNull();
    expect(screen.queryByText(/^\d+ new$/)).toBeNull();
  });
});

describe('GUX-R8 Previous left and Done right, on one row', () => {
  it('GUX-R8 from step 2, Previous and Next (Done on the last) share one row, Previous first', async () => {
    const { be, kv } = await joWithNew(['One', 'Two', 'Three']);
    await renderApp(<GalleryScreen />, { be, kv, user: 'jo' });
    fireEvent.press(within(await screen.findByTestId('new-for-you')).getByRole('button', { name: /^See all(?! the photos)/ }));
    await screen.findByTestId('new-one-at-a-time');
    fireEvent.press(screen.getByRole('button', { name: 'Next new photo' }));
    await screen.findByText('Two');
    for (const forward of ['Next new photo', 'Done, back to Gallery']) {
      const prev = screen.getByRole('button', { name: 'Previous new photo' });
      const next = screen.getByRole('button', { name: forward });
      // The nearest row holding Previous also holds the forward button, and Previous comes first.
      let row: Inst | null = null;
      for (let n = prev.parent; n; n = n.parent) if (isHost(n) && flat(n.props.style).flexDirection === 'row') { row = n; break; }
      const order = hostOrder();
      expect({
        forward,
        sameRow: !!row && row.findAll((x: Inst) => x === next).length === 1,
        previousFirst: order.indexOf(prev) < order.indexOf(next),
      }).toEqual({ forward, sameRow: true, previousFirst: true });
      if (forward === 'Next new photo') {
        fireEvent.press(next);
        await screen.findByText('Three');
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// GUX-R9: neutral avatars; picked rows get an accent check mark, not a pink fill.
// ---------------------------------------------------------------------------------------------------------------

/** An accent check mark inside `row`: a check symbol tinted accent, or a "✓" in the accent color. */
function accentCheck(row: Inst): boolean {
  const accent = light().accent;
  const symbols = row.findAll((n: Inst) => n.type === SymbolView && /check/.test(JSON.stringify(n.props.name)) && n.props.tintColor === accent);
  const ticks = row.findAll((n: Inst) => n.type === Text && /[✓✔]/.test(String(n.props.children)) && flat(n.props.style).color === accent);
  return symbols.length + ticks.length > 0;
}

describe('GUX-R9 neutral avatars and accent check marks', () => {
  it('GUX-R9 the post\'s sender avatar is a neutral grey, not tinted with the family color', async () => {
    const be = FakeBackend.withFixture();
    const { id } = await seedPost(be, { caption: 'Lake day' });
    await renderApp(<FeedScreen />, { be, user: 'jo' });
    const head = await screen.findByTestId(`card-head-${id}`);
    const fills = (head.findAll((n: Inst) => isView(n)) as Inst[]).map((n) => flat(n.props.style).backgroundColor).filter((v) => !noColor(v));
    expect(fills.length).toBeGreaterThan(0); // the avatar circle has a fill
    expect(fills.filter((v) => !neutral(v))).toEqual([]);
  });

  it('GUX-R9 the faces in "Who can see this" are neutral grey too', async () => {
    const be = FakeBackend.withFixture();
    const { id } = await seedPost(be, { caption: 'Lake day' });
    await renderApp(<FeedScreen />, { be, user: 'jo' });
    fireEvent.press(await screen.findByTestId(`who-${id}`, {}, slow));
    const sheet = await screen.findByTestId(`who-sheet-${id}`);
    const fills = (sheet.findAll((n: Inst) => isView(n)) as Inst[]).map((n) => flat(n.props.style).backgroundColor).filter((v) => !noColor(v) && v !== light().bg && v !== light().surface);
    expect(fills.filter((v) => !neutral(v))).toEqual([]);
  });

  it('GUX-R9 Light or dark: the picked row has no tinted fill and shows an accent check mark; the others show none', async () => {
    await renderApp(<MoreScreen />, { user: 'jo' });
    fireEvent.press(await screen.findByRole('button', { name: 'Light or dark' }));
    const picked = await screen.findByRole('radio', { name: 'Same as my phone (Recommended)' });
    expect(picked.props.accessibilityState).toMatchObject({ checked: true });
    expect({ fill: flat(picked.props.style).backgroundColor, neutral: neutral(flat(picked.props.style).backgroundColor) }).toMatchObject({ neutral: true });
    expect(accentCheck(picked)).toBe(true);
    for (const name of ['Light screen', 'Dark screen']) expect({ name, check: accentCheck(screen.getByRole('radio', { name })) }).toEqual({ name, check: false });
  });

  it('GUX-R9 Share: a picked group has no tinted fill and shows an accent check mark', async () => {
    const kv = memoryKV();
    await saveLastAudience(kv, FIXTURE.users.chase.id, [dadSide.id]);
    await renderApp(<ShareScreen />, { user: 'chase', kv });
    const picked = await screen.findByRole('checkbox', { name: "Grandparents – Dad's side, 3 people" });
    expect(neutral(flat(picked.props.style).backgroundColor)).toBe(true);
    expect(accentCheck(picked)).toBe(true);
    expect(accentCheck(screen.getByRole('checkbox', { name: "Grandparents – Mom's side, 3 people" }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// GUX-R10: Help doesn't repeat More's rows, and names who to ask.
// ---------------------------------------------------------------------------------------------------------------

describe('GUX-R10 Help', () => {
  it('GUX-R10 Help has no Bigger text or Light or dark (they are rows in More); More still has both', async () => {
    const r = await renderApp(<HelpScreen />, { user: 'jo' });
    await screen.findByText('How should we tell you about new photos?');
    expect(screen.queryByRole('switch', { name: 'Bigger text' })).toBeNull();
    for (const name of ['Light screen', 'Dark screen', 'Same as my phone (Recommended)']) expect(screen.queryByRole('radio', { name })).toBeNull();
    expect(screen.queryByText('Light or dark screen')).toBeNull();
    r.unmount();
    await renderApp(<MoreScreen />, { user: 'jo' });
    expect(await screen.findByRole('button', { name: 'Bigger text' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Light or dark' })).toBeTruthy();
  });

  it('GUX-R10 with a number: Help names the person who invited her and shows the number', async () => {
    const { deps } = await renderApp(<HelpScreen />, { user: 'jo' });
    const call = await screen.findByRole('button', { name: 'Call Chase' });
    expect(screenWords()).toMatch(/Chase/);
    expect(screenWords()).toMatch(/304\D{0,3}555\D{0,2}0100/);
    expect(screenWords()).not.toMatch(/the person who invited you/);
    fireEvent.press(call);
    expect(deps.openUrl).toHaveBeenCalledWith('tel:+13045550100');
  });

  it('GUX-R10 without a number: the name only, "Ask Chase for help."', async () => {
    await renderApp(<HelpScreen />, { user: 'jo', deps: { helpPhone: null } });
    expect(await screen.findByText('Ask Chase for help.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Call/ })).toBeNull();
    expect(screenWords()).not.toMatch(/the person who invited you/);
  });

  it('GUX-R10 the owner, whom nobody invited, is never told to ask "the person who invited you"', async () => {
    await renderApp(<HelpScreen />, { user: 'chase' });
    await screen.findByRole('header', { name: 'Help' });
    await waitFor(() => expect(screenWords()).toMatch(/How should we tell you/));
    expect(screenWords()).not.toMatch(/the person who invited you/);
  });
});
