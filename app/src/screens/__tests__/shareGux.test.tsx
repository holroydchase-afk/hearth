// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// GUX-R1..GUX-R4 (grandparent-ux on the DEC-73 postcard Share, Nov 19). Reference look: direction B of
// /mnt/project-files/design/share-redo-2026-11-19/share-tester.html. Written first (red), Nov 19, by qa-tdd.
// GUX-R1's "no name ever spills out of its tile" is measured in a real browser in app/e2e-web/demo.spec.js; here
// the column rule (2 across for Easy view, text 130%+, or a word wider than the tile) and "names are never cut".
//
// The window (width, text scale) is faked through useWindowDimensions, Dimensions and PixelRatio, so whichever the
// engineer reads gives the same phone.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Dimensions, PixelRatio, Platform, StyleSheet, Text, TextInput } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import type { Circle } from '../../api/types';
import { memoryKV, type KV } from '../../platform/kv';
import { renderApp } from '../../test/renderApp';
import { paletteFor } from '../../ui/theme';
import { ShareScreen } from '../ShareScreen';

const mockWin = { width: 750, height: 1334, scale: 2, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockWin }));

const DAD = "Grandparents – Dad's side";
const light = () => paletteFor(Platform.OS as 'ios', false);
const slow = { timeout: 5000 };

type Inst = ReturnType<typeof screen.getByTestId>;
const flat = (s: unknown) => (StyleSheet.flatten((typeof s === 'function' ? (s as (p: object) => unknown)({ pressed: false }) : s) as never) ?? {}) as Record<string, unknown>;
const isHost = (n: Inst) => typeof n.type === 'string';
function wordsIn(root: Inst): string {
  const parts: string[] = [];
  const walk = (c: unknown) => {
    if (typeof c === 'string' || typeof c === 'number') parts.push(String(c));
    else if (Array.isArray(c)) c.forEach(walk);
  };
  for (const t of root.findAll((n: Inst) => n.type === Text)) walk(t.props.children);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tiles = () => screen.UNSAFE_root.findAll((n: Inst) => isHost(n) && /, \d+ (person|people), (not )?picked$/.test(String(n.props.accessibilityLabel ?? ''))) as Inst[];
const tile = (name: string) => screen.getByLabelText(new RegExp(`^${esc(name)}, \\d+ (person|people), (not )?picked$`));
/** Columns from a tile's width (or flexBasis) as a share of its row, on the tile or one of its two wrappers. */
const across = (t: Inst) => {
  for (let n: Inst | null = t, i = 0; n && i < 3; n = n.parent, i++) {
    const s = flat(n.props.style);
    const w = s.width ?? s.flexBasis;
    if (typeof w === 'string' && w.endsWith('%')) return Math.floor(100 / parseFloat(w) + 0.05);
  }
  return null;
};

const photo = { uri: 'file:///pick/1.jpg', kind: 'photo' as const, width: 4032, height: 3024 };

function phone(width: number, fontScale = 1) {
  Object.assign(mockWin, { width, height: 800, scale: 3, fontScale });
  const d = { width, height: 800, scale: 3, fontScale };
  jest.spyOn(Dimensions, 'get').mockReturnValue(d);
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(fontScale);
}

/** Groups with only short words in their names (the widest, "Everyone", fits a 3-across tile on a 360 px phone). */
function shortCircles(): Circle[] {
  const g = (id: string, name: string, names: string[], kind: Circle['kind'] = 'group'): Circle => ({ circle_id: id, name, member_count: names.length, member_names: names, kind, parent_ids: [] });
  return [
    g(FIXTURE.circles.everyone.id, 'Everyone', ['Alex', 'Chase', 'Grandma Jo', 'Grandpa Earl', 'Nana Ruth'], 'everyone'),
    g(FIXTURE.circles.dadSide.id, 'Our house', ['Alex', 'Chase']),
    g(FIXTURE.circles.momSide.id, 'Cousins', ['Aunt Kim', 'Chase', 'Tammy']),
  ];
}

async function openPostcard(opts: { circles?: Circle[]; kv?: KV } = {}) {
  const be = FakeBackend.withFixture();
  const api = be.clientFor(null, { trackAppSession: true });
  if (opts.circles) jest.spyOn(api, 'myCircles').mockResolvedValue(opts.circles);
  const pickPhotos = jest.fn(async () => ({ items: [photo] }));
  await renderApp(<ShareScreen />, { user: 'chase', kv: opts.kv, be, deps: { api, pickPhotos } });
  await waitFor(() => {
    const pickBtn = screen.queryAllByRole('button', { name: /^Pick photos/ })[0];
    if (pickBtn && !pickPhotos.mock.calls.length) fireEvent.press(pickBtn);
    expect(pickPhotos.mock.calls.length).toBeGreaterThan(0);
  }, slow);
  await screen.findByRole('header', { name: 'New post' }, slow);
  await waitFor(() => expect(tiles().length).toBe(3), slow);
}

afterEach(() => { jest.restoreAllMocks(); Object.assign(mockWin, { width: 750, height: 1334, scale: 2, fontScale: 1 }); });

describe('GUX-R1 face-tile names stay inside their tile', () => {
  it('GUX-R1 360 px phone: "Grandparents" (113 px) is wider than a 3-across tile (103 px), so the tiles go 2 across', async () => {
    phone(360);
    await openPostcard();
    expect(tiles().map(across)).toEqual([2, 2, 2]);
  });

  it('GUX-R1 390 px phone: a 3-across tile is 112 px, still narrower than "Grandparents", so 2 across', async () => {
    phone(390);
    await openPostcard();
    expect(tiles().map(across)).toEqual([2, 2, 2]);
  });

  it('GUX-R1 360 px phone with only short words ("Everyone", "Our house", "Cousins"): 3 across stays', async () => {
    phone(360);
    await openPostcard({ circles: shortCircles() });
    expect(tiles().map(across)).toEqual([3, 3, 3]);
  });

  it('GUX-R1 the phone\'s text at 130%: 2 across even with short names on a wide phone; 120% keeps 3', async () => {
    phone(430, 1.3);
    await openPostcard({ circles: shortCircles() });
    expect(tiles().map(across)).toEqual([2, 2, 2]);
    screen.unmount();
    jest.restoreAllMocks();
    phone(430, 1.2);
    await openPostcard({ circles: shortCircles() });
    expect(tiles().map(across)).toEqual([3, 3, 3]);
  });

  it('GUX-R1 Easy view On: 2 across with short names too', async () => {
    phone(430);
    const kv = memoryKV({ [`hearth.prefs.v1.${FIXTURE.users.chase.id}`]: JSON.stringify({ easyView: true }) });
    await openPostcard({ circles: shortCircles(), kv });
    expect(tiles().map(across)).toEqual([2, 2, 2]);
  });

  it('GUX-R1 names are never shortened: the whole group name shows, with no line limit or "…"', async () => {
    phone(360);
    await openPostcard();
    const t = tile(DAD);
    expect(wordsIn(t)).toContain(DAD);
    const nameText = (t.findAll((n: Inst) => n.type === Text) as Inst[]).find((n) => wordsIn(n) === DAD)!;
    expect(nameText).toBeTruthy();
    expect({ lines: nameText.props.numberOfLines ?? null, fit: nameText.props.adjustsFontSizeToFit ?? false }).toEqual({ lines: null, fit: false });
  });
});

describe('GUX-R2 the Add tile is an outline, not a grey box', () => {
  it('GUX-R2 Add: dashed c.line border, no fill, "Add" in the accent', async () => {
    await openPostcard();
    const c = light();
    const add = screen.getAllByRole('button').find((b) => wordsIn(b) === 'Add')!;
    expect(add).toBeTruthy();
    const s = flat(add.props.style);
    const word = (add.findAll((n: Inst) => n.type === Text) as Inst[]).find((n) => wordsIn(n) === 'Add')!;
    expect({
      dashed: s.borderStyle,
      edge: s.borderColor,
      edgeShown: Number(s.borderWidth ?? 0) > 0,
      fill: s.backgroundColor === undefined || s.backgroundColor === 'transparent' ? 'none' : s.backgroundColor,
      word: flat(word.props.style).color,
    }).toEqual({ dashed: 'dashed', edge: c.line, edgeShown: true, fill: 'none', word: c.accent });
  });
});

describe('GUX-R3 the note sits on the card', () => {
  it('GUX-R3 note field: no fill; a hairline c.line underline only', async () => {
    await openPostcard();
    const c = light();
    const input = screen.UNSAFE_getByType(TextInput);
    expect(input.props.accessibilityLabel).toBe('Add a note (optional)');
    // The input and its own wrapper (the field), up to the card.
    const chain: Inst[] = [];
    for (let n: Inst | null = input, i = 0; n && i < 3 && n.props.testID !== 'share-card'; n = n.parent, i++) chain.push(n);
    const styles = chain.map((n) => flat(n.props.style));
    const fills = styles.map((s) => s.backgroundColor).filter((b) => b !== undefined && b !== 'transparent');
    const underline = styles.find((s) => s.borderBottomWidth === StyleSheet.hairlineWidth && (s.borderBottomColor ?? s.borderColor) === c.line);
    const box = styles.find((s) => Number(s.borderWidth ?? 0) > 0 && s.borderColor !== 'transparent' && s.borderBottomWidth === undefined);
    expect({ fills, underline: !!underline, boxEdge: !!box }).toEqual({ fills: [], underline: true, boxEdge: false });
  });
});

describe('GUX-R4 the picked mark', () => {
  it('GUX-R4 picked: a filled accent check and a soft accent tint inside the ring; not an outlined check on the page color', async () => {
    await openPostcard();
    const c = light();
    fireEvent.press(tile(DAD));
    const picked = screen.getByLabelText(new RegExp(`^${esc(DAD)}, \\d+ people, picked$`));
    const hosts = picked.findAll((n: Inst) => isHost(n)) as Inst[];
    // The ring is the host drawn with the accent border.
    const ring = hosts.find((n) => flat(n.props.style).borderColor === c.accent && Number(flat(n.props.style).borderWidth ?? 0) > 0);
    const symbols = picked.findAll((n: Inst) => /check/.test(JSON.stringify(n.props.name ?? ''))) as Inst[];
    const filledGlyph = symbols.some((s) => /checkmark\.circle\.fill/.test(JSON.stringify(s.props.name)) && s.props.tintColor === c.accent);
    const filledDisc = hosts.some((n) => flat(n.props.style).backgroundColor === c.accent
      && (n.findAll((m: Inst) => /check/.test(JSON.stringify(m.props.name ?? '')) && m.props.tintColor === c.accentInk) as Inst[]).length > 0);
    const outlined = symbols.some((s) => /"checkmark\.circle"|"check_circle_outline"/.test(JSON.stringify(s.props.name)));
    expect({ ringTint: ring && flat(ring.props.style).backgroundColor, filledCheck: filledGlyph || filledDisc, outlined })
      .toEqual({ ringTint: c.accentSoft, filledCheck: true, outlined: false });
  });

  it('GUX-R4 not picked: no tint inside the ring and no check', async () => {
    await openPostcard();
    const c = light();
    const t = tile(DAD);
    const hosts = t.findAll((n: Inst) => isHost(n)) as Inst[];
    expect(hosts.some((n) => flat(n.props.style).backgroundColor === c.accentSoft)).toBe(false);
    expect((t.findAll((n: Inst) => /check/.test(JSON.stringify(n.props.name ?? ''))) as Inst[]).length).toBe(0);
  });
});
