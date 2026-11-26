// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// STATES-* (SPEC-STATES, intake #208): test support for "the list failed to load" and "the list is empty".
import { screen } from '@testing-library/react-native';
import { FIXTURE, type FakeBackend } from '../api/fake/FakeBackend';
import type { HearthApi } from '../api/HearthApi';
import { ApiError } from '../api/HearthApi';
import type { FixtureUser } from './renderApp';

/** A phone with no signal: what fetch throws (messageFor maps it to NETWORK). */
export const offline = () => new ApiError('NETWORK');

/** The signed-in api for a fixture user, to spy on before renderApp (pass it as `deps: { api }`). */
export function apiFor(be: FakeBackend, user: FixtureUser): HearthApi {
  be.state.appSession = FIXTURE.users[user].id;
  return be.clientFor(null, { trackAppSession: true });
}

export const NO_SIGNAL_TITLE = 'No signal right now';
export const NO_SIGNAL_LINE = 'Your photos are safe. Check your Wi-Fi or signal, then tap Try again.';

/** The error state is on screen: title, line and a "Try again" button; nothing dismissible, no spinner, no empty words. */
export function expectNoSignalState(opts: { title?: string; line?: string } = {}): void {
  expect(screen.getByText(opts.title ?? NO_SIGNAL_TITLE)).toBeTruthy();
  expect(screen.getByText(opts.line ?? NO_SIGNAL_LINE)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  expect(screen.queryByText('OK, hide this message')).toBeNull();
  expect(screen.queryByRole('button', { name: 'OK, hide this message' })).toBeNull();
}
