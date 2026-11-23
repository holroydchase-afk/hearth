// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { ApiError } from '../../api/HearthApi';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV, type KV } from '../../platform/kv';
import { saveLastAudience } from '../../share/audienceMemory';
import { expectGrandparentSafe, renderApp, type FixtureUser } from '../../test/renderApp';
import type { AppDeps } from '../../state/AppContext';
import { ShareScreen } from '../ShareScreen';

const DAD = "Grandparents – Dad's side";
const MOM = "Grandparents – Mom's side";
const slow = { timeout: 5000 };

// Retargeted Nov 19 by qa-tdd for DEC-73 (SHARE-PC, SPEC-REDESIGN 1j): Share is a "New post" postcard; nothing is
// pre-picked (the old BETA-AUD-2 preselect is gone), one "Add a note (optional)" field, face tiles spoken
// "<name>, N people, (not) picked", a pinned "Pick who gets it" / "Send to <names>" button, and Send lands on Feed.
/** Get to the "New post" postcard with a photo: tap the empty postcard's "Add photos" target (DEC-79). */
async function newPost(opts: { user?: FixtureUser; kv?: KV; be?: FakeBackend; deps?: Partial<AppDeps> } = {}) {
  const r = await renderApp(<ShareScreen />, { user: opts.user ?? 'chase', kv: opts.kv, be: opts.be, deps: opts.deps });
  const pick = r.deps.pickPhotos as jest.Mock;
  await waitFor(() => {
    const btn = screen.queryAllByRole('button', { name: /^Add photos/ })[0];
    if (btn && !pick.mock.calls.length) fireEvent.press(btn);
    expect(pick.mock.calls.length).toBeGreaterThan(0);
  }, slow);
  await screen.findByRole('header', { name: 'New post' }, slow);
  return r;
}
const tileFor = (name: string, picked = false) => screen.getByLabelText(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, \\d+ people, ${picked ? '' : 'not '}picked$`));

describe('Share screen', () => {
  it('DEC-73 SHARE-PC-7 (was BETA-AUD-2 / B8 preselect): THIS user\'s last group is not ticked any more', async () => {
    const kv = memoryKV();
    await saveLastAudience(kv, FIXTURE.users.chase.id, [FIXTURE.circles.dadSide.id]);
    await newPost({ user: 'chase', kv });
    expect(tileFor(DAD)).toBeTruthy();
    expect(tileFor(MOM)).toBeTruthy();
    expect(screen.queryByLabelText(/, picked$/)).toBeNull();
  });

  it("B8 never another user's default on a shared phone; Send stays off with no group", async () => {
    const kv = memoryKV();
    await saveLastAudience(kv, FIXTURE.users.chase.id, [FIXTURE.circles.dadSide.id]);
    await newPost({ user: 'alex', kv });
    expect(screen.queryByLabelText(/, picked$/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Pick who gets it' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('BETA-SHARE-1 DEC-73 pick → note → tap a group → Send: it sends to that group only and lands on Feed', async () => {
    const be = FakeBackend.withFixture();
    const { nav } = await newPost({ be, user: 'chase' });
    fireEvent.changeText(screen.getByLabelText('Add a note (optional)'), 'First snow!');
    fireEvent.press(tileFor(DAD));
    fireEvent.press(screen.getByRole('button', { name: /^Send to / }));
    await waitFor(() => expect((nav as unknown as { goFeed: jest.Mock }).goFeed).toHaveBeenCalled());
    expect(nav.goPhotos).not.toHaveBeenCalled();
    await waitFor(async () => expect(await be.clientFor(FIXTURE.users.jo.id).getFeed({ space: FIXTURE.space.id })).toHaveLength(1));
    expect(await be.clientFor(FIXTURE.users.ruth.id).getFeed({ space: FIXTURE.space.id })).toHaveLength(0);
  });

  it('BETA-SHARE-4: shows "Waiting to send" when there is no signal', async () => {
    const be = FakeBackend.withFixture();
    const api = be.clientFor(null, { trackAppSession: true });
    jest.spyOn(api, 'createPost').mockRejectedValue(new ApiError('NETWORK'));
    await newPost({ be, user: 'chase', deps: { api } });
    fireEvent.press(tileFor(DAD));
    fireEvent.press(screen.getByRole('button', { name: /^Send to / }));
    expect(await screen.findByText(/Waiting to send/)).toBeTruthy();
  });

  // QA-R2 (staff-pm, Nov 19): the postcard keeps a labelled Remove for the photo showing, when there is more than one.
  it('DEC-73 QA-R2 the photo showing can be removed with a labeled button; with one photo there is none', async () => {
    const three = Array.from({ length: 3 }, (_, i) => ({ uri: `file:///pick/r${i}.jpg`, kind: 'photo' as const, width: 4032, height: 3024 }));
    await newPost({ user: 'chase', deps: { pickPhotos: jest.fn(async () => ({ items: three })) } });
    expect(screen.getByText('1 of 3')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Show photo 2' }));
    const remove = screen.getByRole('button', { name: 'Remove photo 2' });
    expect(screen.getAllByText('Remove').length).toBeGreaterThan(0);
    fireEvent.press(remove);
    expect(await screen.findByText(/^\d of 2$/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /^Remove photo / }));
    await waitFor(() => expect(screen.queryByText(/ of \d$/)).toBeNull());
    expect(screen.queryByRole('button', { name: /^Remove photo / })).toBeNull();
    expect(screen.getByRole('header', { name: 'New post' })).toBeTruthy();
    expectGrandparentSafe();
  });

  it('viewers who land here are told plainly', async () => {
    await renderApp(<ShareScreen />, { user: 'jo' });
    expect(await screen.findByText("You can't do that here.")).toBeTruthy();
  });

  it('HARD-2 picking more than 10 says plainly how many were left out', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ uri: `file:///pick/${i}.jpg`, kind: 'photo' as const, width: 4032, height: 3024 }));
    await newPost({ user: 'chase', deps: { pickPhotos: jest.fn(async () => ({ items: many })) } });
    expect(await screen.findByText('1 of 10')).toBeTruthy();
    expect(screen.getByText(/10 at a time.*2 photos were left out/)).toBeTruthy();
  });

  it('HARD-3 no group to send to is said in words, not a dead end', async () => {
    const be = FakeBackend.withFixture();
    const api = be.clientFor(null, { trackAppSession: true });
    jest.spyOn(api, 'myCircles').mockResolvedValue([]);
    await newPost({ be, user: 'chase', deps: { api } });
    expect(await screen.findByText(/no group to send to yet/i)).toBeTruthy();
    expectGrandparentSafe();
  });

  it('is grandparent-safe', async () => {
    await newPost({ user: 'chase' });
    await waitFor(() => expect(tileFor(DAD)).toBeTruthy());
    expectGrandparentSafe();
  });
});
