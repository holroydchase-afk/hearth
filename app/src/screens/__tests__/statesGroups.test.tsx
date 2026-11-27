// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// STATES-15..19 (SPEC-STATES, intake #208): Groups says "failed" apart from "none", and "New group" is a tinted capsule.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import React from 'react';
import { FakeBackend } from '../../api/fake/FakeBackend';
import type { Circle } from '../../api/types';
import { paletteFor } from '../../ui/theme';
import { expectGrandparentSafe, renderApp } from '../../test/renderApp';
import { apiFor, offline } from '../../test/states';
import { GroupsScreen } from '../GroupsScreen';

const circle = (id: string, name: string, extra: Partial<Circle> = {}): Circle => ({ circle_id: id, name, member_count: 1, member_names: ['Chase'], kind: 'group', parent_ids: [], comment_mode: 'private', ...extra });
const withCircles = async (be: FakeBackend, list: Circle[]) => {
  const api = apiFor(be, 'chase');
  jest.spyOn(api, 'myCircles').mockResolvedValue(list);
  return api;
};

describe('STATES-15 Groups load fails', () => {
  it('STATES-15 no signal: the error words (no "photos are safe"), Try again reloads; "New group" and the list stay hidden until it works', async () => {
    const be = FakeBackend.withFixture();
    const api = apiFor(be, 'chase');
    const spy = jest.spyOn(api, 'myCircles').mockRejectedValueOnce(offline());
    await renderApp(<GroupsScreen />, { be, user: 'chase', deps: { api } });
    expect(await screen.findByText('No signal right now. Check your Wi-Fi or signal, then tap Try again.')).toBeTruthy();
    expect(screen.queryByText(/photos are safe/)).toBeNull();
    expect(screen.queryByText('OK, hide this message')).toBeNull();
    expect(screen.queryByRole('button', { name: 'New group' })).toBeNull();
    expect(screen.queryByText('No groups yet')).toBeNull();
    expect(screen.queryByText(/Grandparents/)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'New group' })).toBeTruthy();
    expect(screen.queryByText(/No signal right now/)).toBeNull();
  });
});

describe('STATES-16 no groups yet', () => {
  it('STATES-16 "No groups yet", the what-is-a-group line, and "Make a group" that opens the New group form', async () => {
    const be = FakeBackend.withFixture();
    const api = await withCircles(be, []);
    await renderApp(<GroupsScreen />, { be, user: 'chase', deps: { api } });
    expect(await screen.findByText('No groups yet')).toBeTruthy();
    expect(screen.getByText('A group is the people who get a photo, like Grandparents or Cousins. Make one to choose who sees your photos.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Make a group' }));
    expect(await screen.findByRole('button', { name: 'Make the group' })).toBeTruthy();
  });
});

describe('STATES-17 "New group" is a tinted capsule', () => {
  const bg = (name: string) => {
    const el = screen.getByRole('button', { name });
    return (StyleSheet.flatten(typeof el.props.style === 'function' ? el.props.style({ pressed: false }) : el.props.style) ?? {}) as { backgroundColor?: string; minHeight?: number; alignSelf?: string };
  };
  it('STATES-17 with groups: "New group" is not the filled accent button; it is the soft accent capsule, 48 pt', async () => {
    await renderApp(<GroupsScreen />, { user: 'chase' });
    await screen.findByRole('button', { name: 'New group' });
    const s = bg('New group');
    const accents = [paletteFor('ios', false).accent, paletteFor('android', false).accent, paletteFor('ios', true).accent];
    expect(accents).not.toContain(s.backgroundColor);
    expect([paletteFor('ios', false).accentSoft, paletteFor('android', false).accentSoft, paletteFor('ios', true).accentSoft, paletteFor('android', true).accentSoft]).toContain(s.backgroundColor);
    expect(s.alignSelf).toBe('flex-start');
    expect(Number(s.minHeight)).toBeGreaterThanOrEqual(48);
    expectGrandparentSafe();
  });
  it('STATES-17 with no groups there is one button, "Make a group", and no second "New group"', async () => {
    const be = FakeBackend.withFixture();
    const api = await withCircles(be, []);
    await renderApp(<GroupsScreen />, { be, user: 'chase', deps: { api } });
    await screen.findByRole('button', { name: 'Make a group' });
    expect(screen.queryByRole('button', { name: 'New group' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Make a group$/ })).toHaveLength(1);
    const s = bg('Make a group');
    expect(paletteFor('ios', false).accent).not.toBe(s.backgroundColor);
  });
});

describe('STATES-18 a group that cannot take an invite', () => {
  it('STATES-18 shows "Invite someone" in place of the household text; it opens the form for the household', async () => {
    const be = FakeBackend.withFixture();
    const api = await withCircles(be, [
      circle('p', 'Grandparents'),
      circle('e', 'Birthday', { kind: 'event', parent_ids: ['p'] }),
      circle('h', "Mom's house", { kind: 'household' }),
    ]);
    await renderApp(<GroupsScreen />, { be, user: 'chase', deps: { api } });
    await screen.findByText('Grandparents');
    expect(screen.queryByText('To invite someone, use their household below.')).toBeNull();
    const buttons = screen.getAllByRole('button', { name: /^Invite someone/ });
    expect(buttons.some((b) => b.props.accessibilityLabel === 'Invite someone')).toBe(true);
    fireEvent.press(buttons.find((b) => b.props.accessibilityLabel === 'Invite someone')!);
    expect(await screen.findByRole('header', { name: "Invite someone to Mom's house" })).toBeTruthy();
  });

  it('STATES-18 when no group can take one: the line says make a group first, and "Make a group" shows', async () => {
    const be = FakeBackend.withFixture();
    const api = await withCircles(be, [circle('p', 'Grandparents'), circle('e', 'Birthday', { kind: 'event', parent_ids: ['p'] })]);
    await renderApp(<GroupsScreen />, { be, user: 'chase', deps: { api } });
    await screen.findByText('Grandparents');
    expect(screen.getByText('To invite someone, first make a group, then tap Invite someone under it.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Make a group' })).toBeTruthy();
  });
});

describe('STATES-19 how to invite, once', () => {
  it('STATES-19 under "Your groups" one muted line says how, whenever a group exists', async () => {
    await renderApp(<GroupsScreen />, { user: 'chase' });
    expect(await screen.findByText('To invite someone, tap Invite someone under a group.')).toBeTruthy();
    expect(screen.getAllByText('To invite someone, tap Invite someone under a group.')).toHaveLength(1);
  });
  it('STATES-19 with no groups the line is not shown', async () => {
    const be = FakeBackend.withFixture();
    const api = await withCircles(be, []);
    await renderApp(<GroupsScreen />, { be, user: 'chase', deps: { api } });
    await screen.findByText('No groups yet');
    expect(screen.queryByText('To invite someone, tap Invite someone under a group.')).toBeNull();
  });
});
