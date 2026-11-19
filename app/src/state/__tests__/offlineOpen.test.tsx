// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// ENG-R1 (Nov 19 tech-debt review, P0): opening Hearth with no signal must not tell Grandma Jo she isn't in a
// family. Only an empty, successful answer from the server means "no family"; a failed read uses the family
// this phone last opened, or says Hearth can't be reached, with Try again.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { FIXTURE, FakeBackend } from '../../api/fake/FakeBackend';
import { memoryKV } from '../../platform/kv';
import { AppGate } from '../../screens/AppGate';
import { renderApp } from '../../test/renderApp';
import { useApp } from '../AppContext';

function Probe() {
  const app = useApp();
  return <Text testID="probe">{`${app.status}|${app.space?.space_id ?? '-'}`}</Text>;
}

function Both() {
  return (<><AppGate /><Probe /></>);
}

function signedInApi(be: FakeBackend) {
  be.state.appSession = FIXTURE.users.jo.id;
  return be.clientFor(null, { trackAppSession: true });
}

const offline = () => Object.assign(new Error('Network request failed'), { name: 'TypeError' });

describe('Opening Hearth offline (ENG-R1)', () => {
  it('ENG-R1 a failed family read uses the family this phone opened last, not "not part of a family"', async () => {
    const be = FakeBackend.withFixture();
    const kv = memoryKV();
    const first = await renderApp(<Both />, { be, kv });
    await waitFor(() => expect(screen.getByTestId('probe').props.children).toMatch(/^ready\|/));
    const spaceId = String(screen.getByTestId('probe').props.children).split('|')[1];
    first.unmount();

    const api = signedInApi(be);
    jest.spyOn(api, 'mySpaces').mockRejectedValue(offline());
    await renderApp(<Both />, { be, kv, deps: { api } });
    await waitFor(() => expect(screen.getByTestId('probe').props.children).toBe(`ready|${spaceId}`));
    expect(screen.queryByText(/not part of a family/)).toBeNull();
  });

  it('ENG-R1 with nothing saved, a failed read says Hearth can\'t be reached and Try again recovers', async () => {
    const be = FakeBackend.withFixture();
    const api = signedInApi(be);
    const spy = jest.spyOn(api, 'mySpaces').mockRejectedValueOnce(offline());
    await renderApp(<Both />, { be, deps: { api }, waitReady: false });
    expect(await screen.findByText("Can't reach Hearth")).toBeTruthy();
    expect(screen.queryByText(/not part of a family/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Sign out/ })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByTestId('probe').props.children).toMatch(/^ready\|/));
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('ENG-R1 an empty, successful answer still means no family (noSpace)', async () => {
    const be = FakeBackend.withFixture();
    const api = signedInApi(be);
    jest.spyOn(api, 'mySpaces').mockResolvedValue([]);
    await renderApp(<Both />, { be, deps: { api }, waitReady: false });
    await waitFor(() => expect(screen.getByTestId('probe').props.children).toBe('noSpace|-'));
    expect(screen.getByText(/not part of a family/)).toBeTruthy();
  });
});
