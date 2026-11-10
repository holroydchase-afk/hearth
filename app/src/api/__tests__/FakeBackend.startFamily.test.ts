// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// Start a family (0024, SPEC-START-FAMILY, DEC-55): the fake mirrors the server rules the contract suite
// can't reach on a shared stack (the 3-in-24-hours limit needs a family to go away between starts).
import { ApiError } from '../HearthApi';
import { FIXTURE, FakeBackend } from '../fake/FakeBackend';
import { uuid } from '../../crypto/random';

const F = FIXTURE;
const code = (p: Promise<unknown>) => p.then(() => 'ok', (e: unknown) => (e instanceof ApiError ? e.code : `non-ApiError: ${String(e)}`));

function backend(open = true) {
  const be = FakeBackend.withFixture();
  if (open) be.state.featureFlags = { ...be.state.featureFlags, start_family_open: true };
  return be;
}

describe('FakeBackend start_family (BETA-START, 0024)', () => {
  it('BETA-START-8 the switch is off by default, like the server ships', async () => {
    const be = backend(false);
    const me = be.clientFor(F.users.newbie2.id);
    expect(await me.canStartFamily()).toBe(false);
    expect(await code(me.startFamily({ clientId: uuid(), name: 'Our kids', sides: [] }))).toBe('42501');
  });

  it('BETA-START-11 a 4th start in 24 hours is 54000, even when the earlier families are gone', async () => {
    const be = backend();
    const id = F.users.newbie2.id;
    const me = be.clientFor(id);
    for (let i = 0; i < 3; i++) {
      expect(await code(me.startFamily({ clientId: uuid(), name: `Our kids ${i}`, sides: [] }))).toBe('ok');
      be.state.members = be.state.members.filter((m) => m.user !== id); // the family goes away (retired or removed)
    }
    expect(await me.canStartFamily()).toBe(false);
    expect(await code(me.startFamily({ clientId: uuid(), name: 'Our kids 4', sides: [] }))).toBe('54000');
  });

  it('BETA-START-13 every refusal is a fixed message: no family name, side name, email or id', async () => {
    const be = backend();
    const me = be.clientFor(F.users.newbie2.id);
    const name = 'Secret Family Name';
    const msgs: string[] = [];
    for (const p of [
      me.startFamily({ clientId: uuid(), name: `${name}${'x'.repeat(60)}`, sides: [] }),
      me.startFamily({ clientId: uuid(), name, sides: ['Secret Side', 'Secret Side'] }),
      be.clientFor(F.users.chase.id).startFamily({ clientId: uuid(), name, sides: [] }),
    ]) msgs.push(await p.then(() => 'ok', (e: Error) => e.message));
    for (const m of msgs) {
      expect(m).not.toBe('ok');
      expect(m).not.toMatch(/Secret|example\.com|[0-9a-f]{8}-[0-9a-f]{4}/i);
    }
  });
});
