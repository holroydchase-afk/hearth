// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// START-ON-6 (SPEC-START-FAMILY section 8, QA-R1): the 0024 contract cases (BETA-START-1, 5, 8, 11) must run on the
// real PostgREST harness, not be skipped. The harness needs (a) a pool of signed-in starter accounts in no family,
// a fresh one for each test (every BETA-START case ends with the starter owning a family), each with its email
// (BETA-START-7 invites the starter), and (b) a service-only flip of start_family_open. Contract for the engineer:
//   HEARTH_USERS_JSON  start.sh / supabase_harness.sh add users named starter_01, starter_02, ... (no family), each
//                      {"id", "jwt", "email"}; mint_keys.py carries the email through.
//   HEARTH_DB_URL      a superuser/service connection the harness uses for the flip (contract-real.sh passes it;
//                      never the app's anon key). The flip changes only private.feature_flags.start_family_open.
// No stack is needed here: these check the harness wiring with fake env values (nothing is fetched).
import { supabaseCaps, supabaseHarness } from './supabaseHarness';

const ENV = ['HEARTH_API_URL', 'HEARTH_ANON_KEY', 'HEARTH_USERS_JSON', 'HEARTH_CAST', 'HEARTH_DB_URL'] as const;

describe('START-ON-6 the real harness has a starter user and a switch flip', () => {
  const saved: Partial<Record<(typeof ENV)[number], string | undefined>> = {};
  beforeEach(() => {
    for (const k of ENV) saved[k] = process.env[k];
    const user = (n: number) => ({ id: `d0000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`, jwt: `jwt-${n}`, email: `starter${n}@example.test` });
    process.env.HEARTH_API_URL = 'http://127.0.0.1:3001';
    process.env.HEARTH_ANON_KEY = 'anon-test';
    process.env.HEARTH_USERS_JSON = JSON.stringify({
      alex: { id: 'a0000000-0000-0000-0000-00000000000a', jwt: 'jwt-alex', email: 'alex@example.com' },
      grandma_rivera: { id: 'a0000000-0000-0000-0000-0000000000a1', jwt: 'jwt-gr', email: 'grandma.rivera@example.com' },
      grandma_chen: { id: 'b0000000-0000-0000-0000-0000000000b1', jwt: 'jwt-gc', email: 'grandma.chen@example.com' },
      blair: { id: 'b0000000-0000-0000-0000-00000000000b', jwt: 'jwt-b', email: 'blair@example.com' },
      starter_01: user(1), starter_02: user(2), starter_03: user(3),
    });
    delete process.env.HEARTH_CAST;
    process.env.HEARTH_DB_URL = 'postgresql://root@127.0.0.1:5432/hearth_it';
  });
  afterEach(() => {
    for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });

  it('START-ON-6 supabaseCaps().starter is true when the stack has starter users and a switch flip (BETA-START-1, 5, 8, 11 run, not skip)', () => {
    expect(supabaseCaps().starter).toBe(true);
  });

  it('START-ON-6 without a switch flip (no HEARTH_DB_URL) starter stays false, so the cases are honestly skipped', () => {
    delete process.env.HEARTH_DB_URL;
    expect(supabaseCaps().starter).toBe(false);
  });

  it('START-ON-6 the harness hands out a starter with its email and can flip start_family_open', async () => {
    const h = await supabaseHarness();
    expect(h.has('starter')).toBe(true);
    expect(typeof h.setStartFamilyOpen).toBe('function');
    expect(h.starterEmail).toMatch(/^starter\d+@example\.test$/);
  });

  it('START-ON-6 each test gets a fresh starter (no family yet): two harnesses never share one', async () => {
    const a = await supabaseHarness();
    const b = await supabaseHarness();
    expect(a.starterEmail).toBeDefined();
    expect(b.starterEmail).toBeDefined();
    expect(a.starterEmail).not.toBe(b.starterEmail);
  });
});
