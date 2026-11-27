// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// MOMENT-1..8 (Chase, UAT 9, Oct 19 and Oct 24): a moment is one upload shown as one compact card,
// like a standard photo feed: who and when, a photo collage, one row of actions, the newest comment and a
// one-row reply box (DEC-30 keeps the box on the card); older comments, who can see it and Delete are one
// worded tap away. Prototype: prototype/moments.html. Written first.
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { seedPost } from '../../test/seed';
import { expectGrandparentSafe, renderApp } from '../../test/renderApp';
import { MediaImage } from '../MediaImage';
import { SystemIcon } from '../../ui/kit';
import { PhotosScreen } from '../PhotosScreen';
import { collageShape, collageTiles, singleAspect } from '../PhotoCollage';

const { dadSide } = FIXTURE.circles;
const flat = (s: unknown) => StyleSheet.flatten(s as never) as Record<string, unknown>;

async function one(opts: { photos?: number; caption?: string; sizes?: Array<[number, number]> } = {}) {
  const be = FakeBackend.withFixture();
  const { id } = await seedPost(be, { caption: opts.caption ?? 'At the lake', circles: [dadSide.id], ...opts });
  return { be, id };
}

describe('MOMENT: one compact card per upload', () => {
  it('MOMENT-1 the head says who and when, and the sender sees who it went to', async () => {
    const { be, id } = await one();
    await renderApp(<PhotosScreen />, { be, user: 'chase' });
    const card = await screen.findByTestId(`post-${id}`);
    expect(within(within(card).getByTestId(`card-head-${id}`)).getByText('Chase')).toBeTruthy(); // RD-48: the description repeats the name
    // RD-58 (UX-R15): the card says who can see it once (the names line); the group's name is in Post options.
    expect(await within(card).findByTestId(`who-${id}`)).toBeTruthy();
    expect(within(card).getByText('At the lake')).toBeTruthy();
    fireEvent.press(within(card).getByRole('button', { name: 'Post options' }));
    expect(within(await screen.findByTestId(`more-${id}`)).getByText(/Grandparents – Dad's side/)).toBeTruthy();
  });

  it('MOMENT-2 collage shapes: 1 photo alone, 2 side by side, 3 = one big and two, 4+ = one big and three with "+N"', () => {
    expect(collageShape(1)).toEqual({ big: 1, small: 0, more: 0 });
    expect(collageShape(2)).toEqual({ big: 0, small: 2, more: 0 });
    expect(collageShape(3)).toEqual({ big: 1, small: 2, more: 0 });
    expect(collageShape(4)).toEqual({ big: 1, small: 3, more: 0 });
    expect(collageShape(9)).toEqual({ big: 1, small: 3, more: 5 });
  });

  it('MOMENT-2 a 9-photo moment shows 4 photos at once, "+5" on the last, and each opens the viewer there', async () => {
    const { be, id } = await one({ photos: 9 });
    const { nav } = await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const card = await screen.findByTestId(`post-${id}`);
    expect(within(card).UNSAFE_queryAllByType(MediaImage)).toHaveLength(4);
    expect(within(card).getByText('+5')).toBeTruthy();
    fireEvent.press(within(card).getByRole('button', { name: /^Open photo 2 of 9 full screen(,|$)/ }));
    expect(nav.openViewer).toHaveBeenCalledWith(id, 1);
    fireEvent.press(within(card).getByRole('button', { name: /^Open photo 4 of 9 full screen, and 5 more(,|$)/ }));
    expect(nav.openViewer).toHaveBeenCalledWith(id, 3);
    // no in-card swiping and no "1 of 9" buttons: the viewer has Back and Next
    expect(within(card).queryByRole('button', { name: 'Next photo' })).toBeNull();
    expect(within(card).queryByText('1 of 9')).toBeNull();
  });

  it('MOMENT-2 every photo fills its tile (no grey bars); one photo keeps its shape between 4:5 and 1.91:1', async () => {
    const { be, id } = await one({ photos: 1, sizes: [[1536, 4000]] });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const card = await screen.findByTestId(`post-${id}`);
    for (const img of within(card).UNSAFE_queryAllByType(MediaImage)) expect(img.props.fit ?? 'cover').toBe('cover');
    const tile = within(card).getByRole('button', { name: /^Open photo 1 of 1 full screen(,|$)/ });
    expect(flat(tile.props.style).aspectRatio).toBe(0.8);
  });

  // Updated Nov 17 for UX-R5 (Chase: "I don't think we need a comment emoji"): 💬 / "Write a comment" leaves the row.
  it('REACT-7 UX-R5 (Chase, Oct 25 / Nov 17) Love, Haha, Like and Hooray sit in one row as icons only, each labeled for screen readers', async () => {
    const { be, id } = await one();
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const card = await screen.findByTestId(`post-${id}`);
    const row = within(card).getByTestId(`actions-${id}`);
    expect(flat(row.props.style).flexDirection).toBe('row');
    const names = within(row).getAllByRole('button').map((b) => b.props.accessibilityLabel);
    expect(names).toEqual(['Love it', 'Haha', 'Like it', 'Hooray']); // REACT-12 (Chase, Nov 5): 🎉 added; UX-R5: no 💬
    // no words under the icons (REACT-7), and REACT-11 (Chase, Nov 5: "the standard, not 3D emojis, not line
    // icons"): the phone's own emoji, the same ones on its keyboard
    const shown = within(row).UNSAFE_queryAllByType(Text).map((t) => String(t.props.children)).join(' ');
    expect(shown).toBe('❤️ 😂 👍 🎉');
    expect(within(row).UNSAFE_queryAllByType(SystemIcon)).toHaveLength(0);
  });

  it('REACT-12 Hooray works like the others and is counted', async () => {
    const { be, id } = await one();
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const card = await screen.findByTestId(`post-${id}`);
    fireEvent.press(within(card).getByRole('button', { name: 'Hooray' }));
    await waitFor(() => expect(be.state.hearts).toEqual([{ post: id, user: FIXTURE.users.jo.id, emoji: '🎉' }]));
    // RD-53 (B3, Nov 17): the count sits beside the emoji in its own button, and is read as its value.
    await waitFor(() => expect(within(card).getByRole('button', { name: 'Hooray' }).props.accessibilityValue?.text).toBe('1'));
    expect(within(within(card).getByRole('button', { name: 'Hooray' })).UNSAFE_queryAllByType(Text).map((t) => String(t.props.children)).join(' ')).toBe('🎉 1');
  });

  // Updated Nov 17 for RD-53 (B3, DEC-65): no chip row under the photo; each emoji button carries its own count.
  it('REACT-11 RD-53 each kind\'s count sits beside its emoji in the one row (the phone\'s own emoji, no icons)', async () => {
    const { be, id } = await one();
    await be.clientFor(FIXTURE.users.jo.id).setReaction(id, '❤️');
    await renderApp(<PhotosScreen />, { be, user: 'chase' });
    const card = await screen.findByTestId(`post-${id}`);
    const love = within(within(card).getByTestId(`actions-${id}`)).getByRole('button', { name: 'Love it' });
    await waitFor(() => expect(within(love).UNSAFE_queryAllByType(Text).map((t) => String(t.props.children)).join(' ')).toBe('❤️ 1'));
    expect(within(card).queryAllByTestId(/^chip-/)).toHaveLength(0);
    expect(within(card).UNSAFE_queryAllByType(SystemIcon).filter((i) => /heart|thumb|smil/.test(JSON.stringify(i.props.icon)))).toHaveLength(0);
  });

  it('REACT-8 tapping Haha picks it, Love switches to Love, tapping Love again takes it back', async () => {
    const { be, id } = await one();
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const card = await screen.findByTestId(`post-${id}`);
    const row = within(card).getByTestId(`actions-${id}`);
    const btn = (name: string) => within(row).getByRole('button', { name });
    fireEvent.press(btn('Haha'));
    await waitFor(() => expect(be.state.hearts).toEqual([{ post: id, user: FIXTURE.users.jo.id, emoji: '😂' }]));
    expect(btn('Haha').props.accessibilityState.selected).toBe(true);
    const words = (name: string) => within(btn(name)).UNSAFE_queryAllByType(Text).map((t) => String(t.props.children)).join(' ');
    await waitFor(() => expect(words('Haha')).toBe('😂 1')); // RD-53: the count beside the emoji
    fireEvent.press(btn('Love it'));
    await waitFor(() => expect(be.state.hearts).toEqual([{ post: id, user: FIXTURE.users.jo.id, emoji: '❤️' }]));
    expect(btn('Love it').props.accessibilityState.selected).toBe(true);
    expect(btn('Haha').props.accessibilityState.selected).toBe(false);
    await waitFor(() => expect({ love: words('Love it'), haha: words('Haha') }).toEqual({ love: '❤️ 1', haha: '😂' }));
    fireEvent.press(btn('Love it'));
    await waitFor(() => expect(be.state.hearts).toHaveLength(0));
    expect(btn('Love it').props.accessibilityState.selected).toBe(false);
    await waitFor(() => expect(words('Love it')).toBe('❤️')); // a zero shows no number (RD-53)
  });

  // Retargeted Nov 20 for DEC-76 / RD-114: spec 1k supersedes LIVE-3's "no outline"; a pick is a 2 pt accent outline, no fill.
  it('LIVE-3 RD-114 my reaction shows as a 2 pt outline with no fill (DEC-76, Nov 20)', async () => {
    const { be, id } = await one();
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const card = await screen.findByTestId(`post-${id}`);
    const row = within(card).getByTestId(`actions-${id}`);
    fireEvent.press(within(row).getByRole('button', { name: 'Love it' }));
    await waitFor(() => expect(within(row).getByRole('button', { name: 'Love it' }).props.accessibilityState.selected).toBe(true));
    const s = StyleSheet.flatten(within(row).getByRole('button', { name: 'Love it' }).props.style);
    expect(s.borderWidth).toBe(2);
    expect(s.backgroundColor === undefined || s.backgroundColor === 'transparent').toBe(true);
  });

  // Updated Nov 17 for RD-53 (B3): the four stay in their fixed order, each with its count; no "most first" chip line.
  it('REACT-9 RD-53 the card counts each kind from everyone, beside each emoji, and reads each count out', async () => {
    const { be, id } = await one();
    await be.clientFor(FIXTURE.users.alex.id).setReaction(id, '😂');
    await be.clientFor(FIXTURE.users.chase.id).setReaction(id, '😂');
    await be.clientFor(FIXTURE.users.jo.id).setReaction(id, '❤️');
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const card = await screen.findByTestId(`post-${id}`);
    const row = within(card).getByTestId(`actions-${id}`);
    const words = (name: string) => within(within(row).getByRole('button', { name })).UNSAFE_queryAllByType(Text).map((t) => String(t.props.children)).join(' ');
    await waitFor(() => expect([words('Love it'), words('Haha'), words('Like it'), words('Hooray')]).toEqual(['❤️ 1', '😂 2', '👍', '🎉']));
    expect(within(row).getByRole('button', { name: 'Haha' }).props.accessibilityValue?.text).toBe('2');
    expect(within(card).getByRole('button', { name: 'Love it' }).props.accessibilityState.selected).toBe(true);
  });

  it('MOMENT-4 UX-R5 the reply box is one row with Post beside it, says who will read it, and no Delete sits on the card', async () => {
    const { be, id } = await one();
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    const card = await screen.findByTestId(`post-${id}`);
    const row = within(card).getByTestId(`reply-${id}`);
    expect(flat(row.props.style).flexDirection).toBe('row');
    expect(within(row).getByLabelText('Add a comment for Chase')).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Post' })).toBeTruthy();
    expect(await within(card).findByText('Alex and Chase will read this.')).toBeTruthy();
    expect(within(card).queryByRole('button', { name: /Delete/ })).toBeNull();
    fireEvent.changeText(within(row).getByLabelText('Add a comment for Chase'), 'So cute!');
    fireEvent.press(within(row).getByRole('button', { name: 'Post' }));
    expect(await within(card).findByText('Sent. Alex and Chase will read it.')).toBeTruthy();
    expect(await within(card).findByText(/So cute!/)).toBeTruthy();
  });

  // Retired Nov 17 (UX-R5, Chase): "MOMENT-4 Comment puts the cursor in the reply box". The 💬 button is gone; the
  // "Add a comment…" field is always on the card, so there is nothing to tap first (reviewRound1.test.tsx UX-R5).

  it('MOMENT-5 the card shows only the newest comment and "See all 3 comments"', async () => {
    const { be, id } = await one();
    for (const [who, body] of [['jo', 'First'], ['alex', 'Second'], ['chase', 'Third and newest']] as const) {
      await be.clientFor(FIXTURE.users[who].id).addComment({ post: id, body, clientId: `${who}-c` });
    }
    await renderApp(<PhotosScreen />, { be, user: 'chase' });
    const card = await screen.findByTestId(`post-${id}`);
    expect(await within(card).findByText(/Third and newest/)).toBeTruthy();
    expect(within(card).queryByText(/First/)).toBeNull();
    fireEvent.press(within(card).getByRole('button', { name: 'See all 3 comments' }));
    const sheet = await screen.findByTestId(`comments-${id}`);
    expect(within(sheet).getByRole('header', { name: 'Comments' })).toBeTruthy();
    expect(within(sheet).getByText(/First/)).toBeTruthy();
    expect(within(sheet).getByText(/Second/)).toBeTruthy();
    expectGrandparentSafe();
    fireEvent.press(within(sheet).getByRole('button', { name: 'Close comments' }));
    await waitFor(() => expect(screen.queryByTestId(`comments-${id}`)).toBeNull());
  });

  it('MOMENT-6 More says who can see it; the sender can Delete there, after a confirm', async () => {
    const { be, id } = await one({ photos: 3 });
    await renderApp(<PhotosScreen />, { be, user: 'chase' });
    fireEvent.press(within(await screen.findByTestId(`post-${id}`)).getByRole('button', { name: 'Post options' }));
    const menu = await screen.findByTestId(`more-${id}`);
    expect(within(menu).getByText("Shared with Grandparents – Dad's side, 3 people")).toBeTruthy(); // UX-R33 (engineer, flagged for qa-tdd)
    expectGrandparentSafe();
    fireEvent.press(within(menu).getByRole('button', { name: 'Delete post' }));
    expect(await screen.findByText('Delete this post?')).toBeTruthy(); // UX-R24 (RD-67): the iOS-style alert
    fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(be.state.posts[id]!.deleted).toBe(true));
  });

  it('MOMENT-6 a viewer\'s More has no Delete, and Close shuts it', async () => {
    const { be, id } = await one();
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    await screen.findByTestId(`who-${id}`);
    fireEvent.press(within(await screen.findByTestId(`post-${id}`)).getByRole('button', { name: 'Post options' }));
    const menu = await screen.findByTestId(`more-${id}`);
    expect(within(menu).getByText(/^You, .+ can see this\.$/)).toBeTruthy(); // WHO-7: names, not a group; UX-R34: ends with a period
    expect(within(menu).queryByRole('button', { name: /Delete/ })).toBeNull();
    fireEvent.press(within(menu).getByRole('button', { name: 'Close this menu' }));
    await waitFor(() => expect(screen.queryByTestId(`more-${id}`)).toBeNull());
  });

  it('MOMENT-7 each upload is its own moment, even three within an hour', async () => {
    const be = FakeBackend.withFixture();
    const ids = [];
    for (const caption of ['Lake', 'Dock', 'Boat']) ids.push((await seedPost(be, { caption, photos: 2 })).id);
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    for (const id of ids) expect(await screen.findByTestId(`post-${id}`)).toBeTruthy();
    expect(screen.queryByTestId(/^session-/)).toBeNull();
  });

  it('MOMENT-8 the card is grandparent-safe (48 pt targets, 17 pt text, every button labeled)', async () => {
    const { be } = await one({ photos: 5 });
    await renderApp(<PhotosScreen />, { be, user: 'jo' });
    await screen.findByText('At the lake');
    expectGrandparentSafe();
  });
});

// RD-54 (C1, DEC-65): the post mosaic's shapes as a pure function.
describe('RD-54 collage tiles (pure)', () => {
  it('RD-54 at most 4 tiles: one alone keeps its shape, two side by side 4:5, three or more a wide 3:2 then squares', () => {
    expect(collageTiles(1, 0.8)).toEqual([{ aspect: 0.8, wide: true }]);
    expect(collageTiles(2)).toEqual([{ aspect: 0.8, wide: false }, { aspect: 0.8, wide: false }]);
    expect(collageTiles(3)).toEqual([{ aspect: 1.5, wide: true }, { aspect: 1, wide: false }, { aspect: 1, wide: false }]);
    expect(collageTiles(9)).toHaveLength(4);
    expect(collageTiles(9).map((t) => t.aspect)).toEqual([1.5, 1, 1, 1]);
  });
  it('RD-54 one photo is clamped to Instagram\'s range, 4:5 tall to 3:2 wide', () => {
    expect(singleAspect({ width: 1536, height: 4000 })).toBe(0.8);
    expect(singleAspect({ width: 4000, height: 1000 })).toBe(1.5);
    expect(singleAspect({ width: 1200, height: 1000 })).toBe(1.2);
  });
});
