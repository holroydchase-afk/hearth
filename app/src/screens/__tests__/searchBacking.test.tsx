// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// RD-82 (docs/product/SPEC-REDESIGN.md 1g; Chase on his iPhone, Nov 17): while Gallery scrolls, the pinned "Search
// photos" bar's backing stopped 16 pt short of each edge (it sat inside the scroll's 16 pt padding), so the sideways
// New-for-you photos showed through at the right. Wanted: the backing spans the full screen width in the page color
// (the field keeps its 16 pt gutters inside it), and once content is under it a soft shade (testID
// "search-bar-shade") shows below the bar; none at the top. Written first (Nov 17), red until fixed.
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { FakeBackend, FIXTURE } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { seedPost } from '../../test/seed';
import { GalleryScreen } from '../../test/redesignScreens';
import { renderApp } from '../../test/renderApp';
import { paletteFor } from '../../ui/theme';

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten(s as never) ?? {}) as Record<string, number | string | undefined>;
const isHost = (n: Inst) => typeof n.type === 'string';
const num = (...v: unknown[]) => Number(v.find((x) => typeof x === 'number') ?? 0);
const side = (s: Record<string, unknown>, kind: 'padding' | 'margin', edge: 'Left' | 'Right') =>
  num(s[`${kind}${edge}`], s[`${kind}${edge === 'Left' ? 'Start' : 'End'}`], s[`${kind}Horizontal`], s[kind]);
const slow = { timeout: 5000 };

async function gallery() {
  const be = FakeBackend.withFixture();
  for (const caption of ['Pumpkin patch', 'Hay ride', 'Lake day']) await seedPost(be, { caption, photos: 2 });
  await renderApp(<GalleryScreen />, { be, user: 'jo', waitReady: false, kv: memoryKV({ [`hearth.lastSeen.v1.${FIXTURE.users.jo.id}`]: new Date(Date.now() - 3 * 864e5).toISOString() }) });
  await screen.findByLabelText('Search photos', {}, slow);
  return screen.getByTestId('gallery-scroll');
}
const scrollTo = async (scroll: Inst, y: number) => act(async () => {
  fireEvent.scroll(scroll, { nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 390, height: 3000 }, layoutMeasurement: { width: 390, height: 844 } } });
});

/** The scroll's sticky child that holds the search field: the bar's backing. */
function backing(scroll: Inst): Inst {
  const sticky = (scroll.props.stickyHeaderIndices as number[] | undefined) ?? [];
  // engineer, flagged for qa-tdd: findAll includes the scroll itself (and the refresh control is its first child), so
  // take the content container, the scroll's first host View, whose children are the sticky-indexed rows.
  const content = scroll.findAll((n) => isHost(n) && (n.type as unknown) === 'View')[0]!;
  const kids = content.children as Inst[];
  const field = screen.getAllByLabelText('Search photos').find(isHost)!;
  const hit = sticky.map((i) => kids[i]).find((k) => k && (k === field || k.findAll(isHost).includes(field)));
  expect(hit).toBeTruthy();
  return hit!;
}

describe('RD-82 the pinned Search photos bar spans the screen', () => {
  it('RD-82 the backing reaches both screen edges in the page color; the field keeps its 16 pt gutters inside it', async () => {
    const scroll = await gallery();
    await scrollTo(scroll, 600);
    const pad = flat(scroll.props.contentContainerStyle);
    const box = backing(scroll);
    const s = flat(box.props.style);
    for (const edge of ['Left', 'Right'] as const) {
      // How far the backing's edge sits in from the screen's edge: the scroll's padding plus the backing's own margin.
      const inset = side(pad, 'padding', edge) + side(s, 'margin', edge);
      expect({ edge, inset }).toEqual({ edge, inset: 0 });
      const field = screen.getAllByLabelText('Search photos').find(isHost)!;
      const gutter = side(s, 'padding', edge) + side(flat(field.props.style), 'margin', edge);
      expect({ edge, gutter }).toEqual({ edge, gutter: 16 });
    }
    expect(s.backgroundColor).toBe(paletteFor(Platform.OS as 'ios', false).bg); // the page color, no gray
  });

  it('RD-82 a soft shade shows under the bar only while content is scrolled under it', async () => {
    const scroll = await gallery();
    await scrollTo(scroll, 0);
    expect(screen.queryByTestId('search-bar-shade')).toBeNull();
    await scrollTo(scroll, 120);
    await waitFor(() => expect(screen.getByTestId('search-bar-shade')).toBeTruthy());
    await scrollTo(scroll, 0);
    await waitFor(() => expect(screen.queryByTestId('search-bar-shade')).toBeNull());
  });
});
