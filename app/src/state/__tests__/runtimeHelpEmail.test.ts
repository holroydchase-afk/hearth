// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// START-ON-1/2: the help address is read from EXPO_PUBLIC_HEARTH_HELP_EMAIL (never in the repo), like helpPhone.

describe('START-ON-1 runtime reads the help email from EXPO_PUBLIC_HEARTH_HELP_EMAIL', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; jest.resetModules(); });

  const load = () => {
    let mod: typeof import('../runtime') | undefined;
    jest.isolateModules(() => { mod = require('../runtime'); });
    return mod!;
  };

  it('START-ON-1 a set EXPO_PUBLIC_HEARTH_HELP_EMAIL becomes deps.helpEmail', () => {
    delete process.env.EXPO_PUBLIC_HEARTH_FAKE;
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-test';
    process.env.EXPO_PUBLIC_HEARTH_HELP_EMAIL = 'help@example.test';
    const rt = load().createRuntime();
    expect('error' in rt).toBe(false);
    expect((rt as { helpEmail?: string | null }).helpEmail).toBe('help@example.test');
  });

  it('START-ON-2 no EXPO_PUBLIC_HEARTH_HELP_EMAIL means helpEmail is null (no start button, no dead row)', () => {
    delete process.env.EXPO_PUBLIC_HEARTH_FAKE;
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-test';
    delete process.env.EXPO_PUBLIC_HEARTH_HELP_EMAIL;
    const rt = load().createRuntime();
    expect('error' in rt).toBe(false);
    expect((rt as { helpEmail?: string | null }).helpEmail).toBeNull();
  });
});
