// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// WEB-APP-7 (HRT-WEB.1): signing out with no network still removes the session on this device, so a reload
// shows the sign-in screen; the server-side revoke is retried or left to expire. Uses the real supabase-js
// client over a storage map with every network call failing ("offline").
import { createClient } from '@supabase/supabase-js';
import { SupabaseApi } from '../SupabaseApi';

const URL = 'https://x.supabase.co';
const SB_KEY = 'sb-x-auth-token';

function mapStorage() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => void m.set(k, v),
    removeItem: async (k: string) => void m.delete(k),
  };
}

const session = (expiresAt: number) => JSON.stringify({
  access_token: 'eyJhbGciOiJIUzI1NiJ9.e30.sig', refresh_token: 'refresh-offline-1', token_type: 'bearer',
  expires_in: 3600, expires_at: expiresAt,
  user: { id: 'u-offline', aud: 'authenticated', role: 'authenticated', email: 'pawpaw@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
});

const offline = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;

async function signOutOffline(stored: string) {
  const storage = mapStorage();
  storage.m.set(SB_KEY, stored);
  const client = createClient(URL, 'anon', {
    auth: { storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: offline },
  });
  const api = new SupabaseApi({ url: URL, anonKey: 'anon', client });
  // supabase-js backs off its refresh retries for up to ~30 s; run its clock forward instead of waiting.
  const done = api.signOut().then(() => 'ok', () => 'threw');
  for (let i = 0; i < 40; i++) await jest.advanceTimersByTimeAsync(1000);
  await done;
  return storage;
}

describe('WEB-APP-7 sign out while offline', () => {
  beforeEach(() => { jest.useFakeTimers({ now: Date.now() }); });
  afterEach(() => { jest.useRealTimers(); });

  it('WEB-APP-7 offline, token still fresh: the local session is removed', async () => {
    const storage = await signOutOffline(session(Math.floor(Date.now() / 1000) + 3600));
    expect([...storage.m.keys()].filter((k) => k.startsWith(SB_KEY))).toEqual([]);
  });

  it('WEB-APP-7 offline, access token expired (phone idle over an hour): the local session is still removed', async () => {
    const storage = await signOutOffline(session(Math.floor(Date.now() / 1000) - 3600));
    expect([...storage.m.keys()].filter((k) => k.startsWith(SB_KEY))).toEqual([]);
  });
});

// PRIV-WEB-R6 (privacy-security review of HRT-WEB.1): SupabaseApi.signOut's offline path leans on supabase-js's
// private auth._removeSession(). A supabase-js upgrade can drop or rename it without a type error (the call is
// cast). This canary fails the day it goes, so the offline sign-out is fixed before it ships, not found later.
describe('PRIV-WEB-R6 supabase-js still has the private _removeSession offline sign-out relies on', () => {
  it('PRIV-WEB-R6 auth._removeSession exists and removes the stored session (and its -user copy) with no network', async () => {
    const storage = mapStorage();
    storage.m.set(SB_KEY, session(Math.floor(Date.now() / 1000) + 3600));
    storage.m.set(`${SB_KEY}-user`, '{"user":{"id":"u-offline"}}');
    let calls = 0;
    const counted = (async () => { calls++; throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    const client = createClient(URL, 'anon', {
      auth: { storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: counted },
    });
    const auth = client.auth as unknown as { _removeSession?: unknown };
    expect(typeof auth._removeSession).toBe('function');
    await (auth._removeSession as () => Promise<void>).call(client.auth);
    expect([...storage.m.keys()].filter((k) => k.startsWith(SB_KEY))).toEqual([]);
    expect(calls).toBe(0);
  });
});
