// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Start a family (DEC-55, SPEC-START-FAMILY sections 3 and 5): the three screens after "Start a new family".
// Aunt Kim (newbie) is signed in and in no family; the server switch is on for these tests.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { ApiError } from '../../api/HearthApi';
import type { AppDeps } from '../../state/AppContext';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { expectGrandparentSafe, renderApp, screenWords } from '../../test/renderApp';
import { AppGate } from '../AppGate';

const KIM = FIXTURE.users.newbie.id;

function backend() {
  const be = FakeBackend.withFixture();
  be.state.featureFlags = { ...be.state.featureFlags, start_family_open: true };
  return be;
}

async function toNameScreen(be = backend(), deps?: Partial<AppDeps>) {
  const r = await renderApp(<AppGate />, { be, user: 'newbie', waitReady: false, deps });
  fireEvent.press(await screen.findByRole('button', { name: "I'm a parent: start a family" }));
  fireEvent.press(await screen.findByRole('button', { name: 'Start a new family' }));
  expect(await screen.findByText('Name your family')).toBeTruthy();
  return r;
}

const nameBox = () => screen.getByPlaceholderText(/Our kids/);
const next = () => screen.getByRole('button', { name: 'Next' });

async function toWhoScreen(name = 'Our kids', be = backend(), deps?: Partial<AppDeps>) {
  const r = await toNameScreen(be, deps);
  fireEvent.changeText(nameBox(), name);
  fireEvent.press(next());
  expect(await screen.findByText("Who's in it?")).toBeTruthy();
  return r;
}

const kimsFamilies = (be: FakeBackend) => be.clientFor(KIM).mySpaces();

describe('Start a family screens (BETA-START-2, -3, -4)', () => {
  it('BETA-START-2 Name your family: 1 to 60 characters, Next stays off outside that, and the 18+ line', async () => {
    await toNameScreen();
    expect(screen.getByText('Hearth is for parents and guardians 18 or older.')).toBeTruthy();
    expectGrandparentSafe();
    for (const bad of ['', '   ', 'x'.repeat(61)]) {
      fireEvent.changeText(nameBox(), bad);
      expect({ bad, state: next().props.accessibilityState }).toEqual({ bad, state: expect.objectContaining({ disabled: true }) });
    }
    for (const good of ['Our kids', 'x'.repeat(60)]) {
      fireEvent.changeText(nameBox(), good);
      expect({ good, state: next().props.accessibilityState }).toEqual({ good, state: expect.objectContaining({ disabled: false }) });
    }
  });

  it('BETA-START-2 Who\'s in it: Just Everyone is the default; nothing is made until she taps Start', async () => {
    const be = backend();
    await toWhoScreen('Our kids', be);
    expect(screen.getByRole('radio', { name: 'Just Everyone' }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByRole('radio', { name: 'Two sides' }).props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.queryByDisplayValue("Dad's side")).toBeNull();
    expectGrandparentSafe();
    expect(await kimsFamilies(be)).toEqual([]);
  });

  it('BETA-START-4 Two sides shows two names she can change; Start makes the family with those two groups', async () => {
    const be = backend();
    await toWhoScreen('Our kids', be);
    fireEvent.press(screen.getByRole('radio', { name: 'Two sides' }));
    expect(screen.getByRole('radio', { name: 'Two sides' }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByDisplayValue("Dad's side")).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue("Mom's side"), "Mama's side");
    expectGrandparentSafe();
    fireEvent.press(screen.getByRole('button', { name: 'Start the family' }));
    expect(await screen.findByText('Invite your first person')).toBeTruthy();
    const fams = await kimsFamilies(be);
    expect(fams).toEqual([expect.objectContaining({ name: 'Our kids', role: 'owner' })]);
    const circles = await be.clientFor(KIM).myCircles(fams[0]!.space_id);
    expect(circles.filter((c) => c.kind === 'everyone')).toHaveLength(1);
    expect(circles.filter((c) => c.kind === 'group').map((c) => c.name).sort()).toEqual(["Dad's side", "Mama's side"]);
  });

  it('BETA-START-3 Just Everyone, then "Skip for now" lands on Photos with one family and only Everyone', async () => {
    const be = backend();
    const { nav } = await toWhoScreen('Our kids', be);
    fireEvent.press(screen.getByRole('button', { name: 'Start the family' }));
    expect(await screen.findByText('Invite your first person')).toBeTruthy();
    expectGrandparentSafe();
    fireEvent.press(screen.getByRole('button', { name: 'Skip for now' }));
    await waitFor(() => expect(nav.goPhotos).toHaveBeenCalled());
    const fams = await kimsFamilies(be);
    expect(fams).toHaveLength(1);
    expect((await be.clientFor(KIM).myCircles(fams[0]!.space_id)).map((c) => c.kind)).toEqual(['everyone']);
  });

  it('BETA-START-3 Invite your first person reuses the invite card: a name, then the invite for the new Everyone', async () => {
    const be = backend();
    await toWhoScreen('Our kids', be);
    fireEvent.press(screen.getByRole('button', { name: 'Start the family' }));
    expect(await screen.findByText('Invite your first person')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Their name, the way your family says it'), 'Grandma June');
    const pastPhotos = screen.queryByRole('radio', { name: 'Share all past photos' });
    if (pastPhotos) fireEvent.press(pastPhotos);
    fireEvent.press(screen.getByRole('button', { name: 'Make the invite' }));
    expect(await screen.findByText('Invite ready')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Text the invite' })).toBeTruthy();
    expectGrandparentSafe();
    const fam = (await kimsFamilies(be))[0]!;
    const everyone = (await be.clientFor(KIM).myCircles(fam.space_id)).find((c) => c.kind === 'everyone')!;
    const invites = Object.values(be.state.invites).filter((i) => i.space === fam.space_id);
    expect(invites).toHaveLength(1);
    expect(invites[0]).toMatchObject({ name: 'Grandma June', created_by: KIM });
    expect(invites[0]!.circles).toContain(everyone.circle_id);
  });
});

describe('Start a family refusals (BETA-START-11, -13)', () => {
  it('BETA-START-11 too many starts today: plain words, no family name, nothing made', async () => {
    const be = backend();
    const api = be.clientFor(null, { trackAppSession: true });
    jest.spyOn(api, 'startFamily').mockRejectedValue(new ApiError('54000', 'rate limited'));
    await toWhoScreen('Smith Crew', be, { api });
    fireEvent.press(screen.getByRole('button', { name: 'Start the family' }));
    expect(await screen.findByText("You've started 3 families today. Try again tomorrow.")).toBeTruthy();
    expect(screenWords()).not.toMatch(/Smith Crew|54000|rate limited/);
    expectGrandparentSafe();
    expect(await kimsFamilies(be)).toEqual([]);
  });

  it('BETA-START-13 a refusal never shows server text or names (FAMILY_FULL from a capped stack)', async () => {
    const be = backend();
    const api = be.clientFor(null, { trackAppSession: true });
    jest.spyOn(api, 'startFamily').mockRejectedValue(new ApiError('FAMILY_FULL' as never, 'family_full'));
    await toWhoScreen('Smith Crew', be, { api });
    fireEvent.press(screen.getByRole('button', { name: 'Start the family' }));
    expect(await screen.findByText(/^Your family is full for now/)).toBeTruthy();
    expect(screenWords()).not.toMatch(/Smith Crew|family_full|HF001/);
  });
});
