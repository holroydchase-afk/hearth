// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-83 (docs/product/SPEC-REDESIGN.md 1g; Chase on his iPhone, Nov 17): scrolling Gallery back down, the sticky
// month title ("October 2026") came apart from the pinned Search photos bar and a thin strip of photo showed between
// them. Wanted: greeting, search bar and the current month title behave as one pinned block. The month title's top
// sits exactly on the search backing's bottom (its sticky offset is the backing's measured height: no gap, no
// overlap), its backing spans the full screen width in c.bg, and RD-82's shade sits under the whole block (below the
// month title when one is pinned). Written first (Nov 17). The real-scroll check is demo.spec.js RD-83.
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { FakeBackend } from '../../api/fake/FakeBackend';
import { seedPost } from '../../test/seed';
import { GalleryScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';
import { paletteFor } from '../../ui/theme';

type Inst = ReturnType<typeof screen.getByTestId>;
const isHost = (n: Inst) => typeof n.type === 'string';
const flat = (s: unknown) => (StyleSheet.flatten(s as never) ?? {}) as Record<string, unknown>;
const num = (...v: unknown[]) => Number(v.find((x) => typeof x === 'number') ?? 0);
const side = (s: Record<string, unknown>, kind: 'padding' | 'margin', edge: 'Left' | 'Right') =>
  num(s[`${kind}${edge}`], s[`${kind}${edge === 'Left' ? 'Start' : 'End'}`], s[`${kind}Horizontal`], s[kind]);
const slow = { timeout: 5000 };
const W = 393;
const layout = (n: Inst, y: number, height: number) => act(async () => {
  n.props.onLayout?.({ nativeEvent: { layout: { x: 0, y, width: W, height } } });
});
const scrollTo = (scroll: Inst, y: number) => act(async () => {
  fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: W, height: 4000 }, layoutMeasurement: { width: W, height: 852 } } });
});
const translateY = (n: Inst) => {
  const t = (flat(n.props.style).transform as Record<string, unknown>[] | undefined) ?? [];
  return num(...t.map((x) => x.translateY));
};

// A fixed, made-up layout, the shape the phone reports: greeting 0..96, backing 96..160 (64 tall, with its 8 pt
// under the field), grid at 200, October's block 0..900 inside it with a 42 pt title, September's after it.
const BACKING = { y: 96, h: 64 };
const GRID_Y = 200;
const OCT = { y: 0, h: 900, head: 42 };
const SEP = { y: 932, h: 900, head: 42 };

async function pinnedGallery() {
  const be = FakeBackend.withFixture();
  await seedPost(be, { caption: 'Hay ride', photos: 6, takenAt: new Date(2026, 9, 17, 15).toISOString() });
  await seedPost(be, { caption: 'Back to school', photos: 6, takenAt: new Date(2026, 8, 3, 9).toISOString() });
  await renderApp(<GalleryScreen />, { be, user: 'jo', waitReady: false });
  const scroll = await screen.findByTestId('gallery-scroll', {}, slow);
  await waitFor(() => expect(screen.getByRole('header', { name: 'September 2026' })).toBeTruthy(), slow);
  const field = screen.getAllByLabelText('Search photos').find(isHost)!;
  // The backing: the field's nearest ancestor that reports its layout (RD-82's full-width bar).
  let backing = field.parent as Inst;
  while (backing && !(isHost(backing) && backing.props.onLayout)) backing = backing.parent as Inst;
  await layout(backing, BACKING.y, BACKING.h);
  await layout(screen.getByTestId('gallery-grid'), GRID_Y, 2000);
  const head = (name: string) => screen.getByRole('header', { name });
  const block = (h: Inst) => { let p = h.parent as Inst; while (p && !(isHost(p) && p.props.onLayout && p !== h)) p = p.parent as Inst; return p; };
  for (const [name, m] of [['October 2026', OCT], ['September 2026', SEP]] as const) {
    await layout(block(head(name)), m.y, m.h);
    await layout(head(name), 0, m.head);
  }
  return { scroll, head, backing };
}

/** Where a month title's top sits on screen (from the scroll's top) at scroll offset y. */
const titleTop = (h: Inst, m: { y: number }, y: number) => GRID_Y + m.y + translateY(h) - y;

describe('RD-83 greeting, search bar and month title are one pinned block', () => {
  it('RD-83 the pinned month title sits exactly on the search backing\'s bottom, scrolling down and back', async () => {
    const { scroll, head } = await pinnedGallery();
    // Down into October, deeper, then back up toward the top of October (Chase's "scrolling back down").
    for (const y of [300, 500, 700, 450, 260]) {
      await scrollTo(scroll, y);
      const top = titleTop(head('October 2026'), OCT, y);
      expect({ y, gap: Math.round((top - BACKING.h) * 10) / 10 }).toEqual({ y, gap: 0 });
    }
  });

  it('RD-83 before the title reaches the bar it scrolls with the photos (no jump), and the next month pushes it away', async () => {
    const { scroll, head } = await pinnedGallery();
    await scrollTo(scroll, 100); // October still below the bar
    expect(translateY(head('October 2026'))).toBe(0);
    await scrollTo(scroll, GRID_Y + SEP.y - BACKING.h + 10); // September reached the bar: it is pinned now
    expect(Math.round(titleTop(head('September 2026'), SEP, GRID_Y + SEP.y - BACKING.h + 10))).toBe(BACKING.h);
    expect(titleTop(head('October 2026'), OCT, GRID_Y + SEP.y - BACKING.h + 10)).toBeLessThan(BACKING.h); // pushed up
  });

  it('RD-83 the month title\'s backing spans the full screen width in the page color', async () => {
    await pinnedGallery();
    const s = flat(screen.getByRole('header', { name: 'October 2026' }).props.style);
    for (const edge of ['Left', 'Right'] as const) {
      // The scroll's 16 pt padding plus the title backing's own margin must come to 0; the words keep 16 pt inside.
      expect({ edge, inset: 16 + side(s, 'margin', edge), gutter: side(s, 'padding', edge) }).toEqual({ edge, inset: 0, gutter: 16 });
    }
    expect(s.backgroundColor).toBe(paletteFor(Platform.OS as 'ios', false).bg);
  });

  it('RD-83 RD-82 with a month pinned the shade sits under the month title, not between it and the bar; none at the top', async () => {
    const { scroll, head, backing } = await pinnedGallery();
    await scrollTo(scroll, 0);
    expect(screen.queryAllByTestId('search-bar-shade')).toHaveLength(0);
    await scrollTo(scroll, 500);
    const shades = screen.queryAllByTestId('search-bar-shade');
    expect(shades).toHaveLength(1);
    const inside = (root: Inst) => root.findAll((n: Inst) => n === shades[0]).length > 0;
    expect({ underMonth: inside(head('October 2026')), underSearch: inside(backing) }).toEqual({ underMonth: true, underSearch: false });
  });
});
