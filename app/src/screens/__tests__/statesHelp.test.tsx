// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// STATES-20..23 (SPEC-STATES, intake #208): Help opens on who to call; the owner's block says what to do; works offline.
// STATES-23: deps.helpPhoneIsInviters (boolean, default false) marks the build-wide number as the inviter's.
import { act, screen } from '@testing-library/react-native';
import React from 'react';
import { FakeBackend } from '../../api/fake/FakeBackend';
import { renderApp, screenWords } from '../../test/renderApp';
import { apiFor, offline } from '../../test/states';
import { HelpScreen } from '../HelpScreen';

const MARKED = { helpPhoneIsInviters: true };
const headers = () => screen.getAllByRole('header').map((h) => String(h.props.children));

describe('STATES-20 "Who to call" comes first', () => {
  it('STATES-20 a viewer with a helper and a marked number: "Who to call" first, then "Chase can help." and "Call Chase"', async () => {
    const { deps } = await renderApp(<HelpScreen />, { user: 'jo', deps: MARKED });
    await screen.findByText('How should we tell you about new photos?');
    const h = headers();
    expect(h.indexOf('Who to call')).toBeGreaterThan(-1);
    expect(h.indexOf('Who to call')).toBeLessThan(h.indexOf('How should we tell you about new photos?'));
    expect(screen.getByText('Chase can help.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Call Chase' })).toBeTruthy();
    expect(deps.helpPhone).toBe('+1 304 555 0100');
  });
  it('STATES-20 no number set: "Ask Chase for help." and no Call button', async () => {
    await renderApp(<HelpScreen />, { user: 'jo', deps: { helpPhone: null, ...MARKED } });
    expect(await screen.findByText('Ask Chase for help.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Call Chase' })).toBeNull();
    expect(screenWords()).not.toMatch(/\d{3}[ -]\d{4}/);
  });
  it('STATES-20 no helper: "Ask the person who invited you for help."', async () => {
    const be = FakeBackend.withFixture();
    const api = apiFor(be, 'jo');
    const real = api.mySpaces.bind(api);
    jest.spyOn(api, 'mySpaces').mockImplementation(async () => (await real()).map((s) => ({ ...s, inviter_name: null })));
    await renderApp(<HelpScreen />, { be, user: 'jo', deps: { api, ...MARKED } });
    expect(await screen.findByText('Ask the person who invited you for help.')).toBeTruthy();
  });
});

describe('STATES-21 the owner\'s Help', () => {
  it('STATES-21 first block "If something isn\'t working" with the plain steps; "Email Hearth" directly under it', async () => {
    await renderApp(<HelpScreen />, { user: 'chase' });
    expect(await screen.findByRole('header', { name: "If something isn't working" })).toBeTruthy();
    expect(screen.getByText("Check your Wi-Fi or signal and tap Try again. Photos you sent are saved on your phone until they go through.")).toBeTruthy();
    const words = screenWords();
    expect(words.indexOf("If something isn't working")).toBeLessThan(words.indexOf('Email Hearth'));
    expect(words.indexOf('Email Hearth')).toBeLessThan(words.indexOf('How should we tell you about new photos?'));
    expect(screen.queryByText('Who to call')).toBeNull();
  });
  it('STATES-21 with no help email: no contact line and no dead row', async () => {
    await renderApp(<HelpScreen />, { user: 'chase', deps: { helpEmail: null } });
    expect(await screen.findByRole('header', { name: "If something isn't working" })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Email Hearth' })).toBeNull();
    expect(screenWords()).not.toMatch(/Our address is/);
  });
});

describe('STATES-22 Help offline', () => {
  it('STATES-22 with no signal Help still shows the name and steps, no error state, and makes no call to draw "Who to call"', async () => {
    const be = FakeBackend.withFixture();
    const api = apiFor(be, 'jo');
    const real = api.mySpaces.bind(api);
    const spaces = await real(); // what the phone already has
    jest.spyOn(api, 'mySpaces').mockResolvedValue(spaces);
    const { rerender, ..._r } = await renderApp(<HelpScreen />, { be, user: 'jo', deps: { api, ...MARKED } });
    await screen.findByText('Chase can help.');
    const calls = Object.keys(api).filter((k) => typeof (api as unknown as Record<string, unknown>)[k] === 'function');
    const spies = calls.map((k) => jest.spyOn(api as never, k as never).mockRejectedValue(offline() as never));
    // mySpaces was spied above (the app read the family through it), so its history holds that load: count from here.
    spies.forEach((sp) => sp.mockClear());
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(screen.getByText('Chase can help.')).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
    expect(screen.queryByText('No signal right now')).toBeNull();
    expect(spies.every((s) => s.mock.calls.length === 0)).toBe(true);
    void rerender;
  });
});

describe('STATES-23 the number only when it is the inviter\'s', () => {
  it('STATES-23 not marked: the name shows, "Ask Chase for help.", no number, no Call button', async () => {
    await renderApp(<HelpScreen />, { user: 'jo', deps: { helpPhone: '+1 304 555 0100', helpPhoneIsInviters: false } });
    expect(await screen.findByText('Ask Chase for help.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Call Chase' })).toBeNull();
    expect(screenWords()).not.toContain('555');
  });
  it('STATES-23 marked as the inviter\'s: "Call Chase" and the number show', async () => {
    await renderApp(<HelpScreen />, { user: 'jo', deps: { helpPhone: '+1 304 555 0100', helpPhoneIsInviters: true } });
    expect(await screen.findByRole('button', { name: 'Call Chase' })).toBeTruthy();
    expect(screenWords()).toContain('555');
  });
});
