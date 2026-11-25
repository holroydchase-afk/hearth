// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// HRT-WEB.1 (docs/product/SPEC-WEB-APP.md): staying signed in on the web. The web session store seals every
// value with AES-256-GCM (WebCrypto) into localStorage; the key is a non-extractable CryptoKey kept in
// IndexedDB. Jest has no IndexedDB, so the key store is injected (the real one is covered by e2e-web).
//
// The contract these tests hold the build to (secureSession.web.ts):
//   createSecureSessionStorage({ keys }) → { getItem, setItem, removeItem, clear }
//   keys: SessionKeyStore = { get(): Promise<CryptoKey | null>; put(k: CryptoKey): Promise<void>; delete(): Promise<void> }
//   clear() removes every value the store wrote (session + messenger store) and deletes the key (sign-out).
//   secureSessionStorage (the default export the app uses) is the same store over IndexedDB.
import * as web from '../secureSession.web';

type KeyStore = { get(): Promise<CryptoKey | null>; put(k: CryptoKey): Promise<void>; delete(): Promise<void> };
type Store = {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
  removeItem(k: string): Promise<void>;
  clear(): Promise<void>;
};
const create = (keys: KeyStore): Store => {
  const f = (web as unknown as { createSecureSessionStorage?: (o: { keys: KeyStore }) => Store }).createSecureSessionStorage;
  if (typeof f !== 'function') throw new Error('secureSession.web.ts does not export createSecureSessionStorage({ keys }) yet');
  return f({ keys });
};

/** What IndexedDB would hold, in memory. Records every key it was handed. */
function memoryKeys() {
  let key: CryptoKey | null = null;
  const handed: CryptoKey[] = [];
  return {
    handed,
    get held() { return key; },
    get: async () => key,
    put: async (k: CryptoKey) => { key = k; handed.push(k); },
    delete: async () => { key = null; },
  };
}

/** A real-looking localStorage (Map-backed), installed on globalThis for each test. */
function fakeLocalStorage() {
  const m = new Map<string, string>();
  const ls = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
  return { m, ls };
}

const SB_KEY = 'sb-x-auth-token'; // supabase-js's storage key for https://x.supabase.co
const ACCESS = 'eyJhbGciOiJIUzI1NiJ9.access-token-ABC123';
const REFRESH = 'refresh-token-XYZ789';
const EMAIL = 'gammy@example.com';
const USER = '6f1c2a90-1111-4abc-8def-0123456789ab';
const SESSION = JSON.stringify({
  access_token: ACCESS, refresh_token: REFRESH, token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: USER, email: EMAIL },
});
const SECRETS = [ACCESS, REFRESH, EMAIL, USER, 'access_token', 'refresh_token'];

const realLS = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const realCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
let store: ReturnType<typeof fakeLocalStorage>;
beforeEach(() => {
  store = fakeLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: store.ls });
});
afterEach(() => {
  if (realLS) Object.defineProperty(globalThis, 'localStorage', realLS); else delete (globalThis as { localStorage?: unknown }).localStorage;
  if (realCrypto) Object.defineProperty(globalThis, 'crypto', realCrypto);
});

/** Everything in localStorage, keys and values, as one string to search. */
const dump = () => [...store.m.entries()].map(([k, v]) => `${k}=${v}`).join('\n');
const b64decode = (s: string) => Uint8Array.from(Buffer.from(s, 'base64'));
const first = <T,>(xs: Iterable<T>): T => { const [x] = [...xs]; if (x === undefined) throw new Error('nothing stored'); return x; };
const isBase64 = (s: string) => /^[A-Za-z0-9+/]+={0,2}$/.test(s) && Buffer.from(s, 'base64').toString('base64') === s;

describe('HRT-WEB.1 secureSession.web', () => {
  it('WEB-APP-3 a stored session is sealed: no token, email or user id in localStorage; the value is nonce + ciphertext only', async () => {
    const s = create(memoryKeys());
    await s.setItem(SB_KEY, SESSION);
    expect(store.m.size).toBe(1);
    for (const secret of SECRETS) expect(dump()).not.toContain(secret);
    const value = first(store.m.values());
    expect(isBase64(value)).toBe(true);
    // 12-byte GCM nonce + ciphertext (same length as the plaintext) + 16-byte tag; nothing else stored beside it.
    expect(b64decode(value).length).toBe(12 + new TextEncoder().encode(SESSION).length + 16);
    expect(await s.getItem(SB_KEY)).toBe(SESSION);
  });

  it('WEB-APP-3 the same value sealed twice gives different bytes (a fresh nonce each time)', async () => {
    const s = create(memoryKeys());
    await s.setItem(SB_KEY, SESSION);
    const one = first(store.m.values());
    await s.setItem(SB_KEY, SESSION);
    const two = first(store.m.values());
    expect(two).not.toBe(one);
    expect(b64decode(two).subarray(0, 12)).not.toEqual(b64decode(one).subarray(0, 12));
  });

  it('WEB-APP-4 the sealing key is a non-extractable AES-GCM 256 CryptoKey held in the key store (IndexedDB), never in localStorage', async () => {
    const keys = memoryKeys();
    const s = create(keys);
    await s.setItem(SB_KEY, SESSION);
    await s.setItem('chat.identity.u1', '{"id":1}');
    expect(keys.handed).toHaveLength(1); // one key, reused
    const k = keys.held!;
    expect(k).toBeTruthy();
    expect(k.extractable).toBe(false);
    expect(k.type).toBe('secret');
    expect(k.algorithm).toEqual(expect.objectContaining({ name: 'AES-GCM', length: 256 }));
    expect([...k.usages].sort()).toEqual(['decrypt', 'encrypt']);
    await expect(globalThis.crypto.subtle.exportKey('raw', k)).rejects.toBeTruthy();
    // localStorage holds only the two sealed values: no JWK, no raw key bytes beside them.
    expect(store.m.size).toBe(2);
    expect(dump()).not.toMatch(/"kty"|"k"\s*:|"alg"/);
  });

  it('WEB-APP-4 a reload (new store instance, same key store) opens what the last visit sealed', async () => {
    const keys = memoryKeys();
    await create(keys).setItem(SB_KEY, SESSION);
    expect(await create(keys).getItem(SB_KEY)).toBe(SESSION);
    expect(keys.handed).toHaveLength(1);
  });

  it('WEB-APP-5 a session saved by the old plain-text web build is kept, re-stored sealed, and the plain copy is gone', async () => {
    store.m.set(SB_KEY, SESSION); // what webKV() wrote: the raw key, the session in plain text
    store.m.set('chat.identity.u1', '{"identity":"old-plain-chat"}');
    const keys = memoryKeys();
    const s = create(keys);
    expect(await s.getItem(SB_KEY)).toBe(SESSION); // still signed in
    expect(await s.getItem('chat.identity.u1')).toBe('{"identity":"old-plain-chat"}'); // chats kept too
    for (const secret of SECRETS) expect(dump()).not.toContain(secret);
    expect(dump()).not.toContain('old-plain-chat');
    expect(keys.held?.extractable).toBe(false);
    // The next visit reads the sealed copy, not a plain one.
    expect(await create(keys).getItem(SB_KEY)).toBe(SESSION);
    for (const secret of SECRETS) expect(dump()).not.toContain(secret);
  });

  it('WEB-APP-6 sign-out (clear) removes the sealed session, the messenger store and the IndexedDB key', async () => {
    const keys = memoryKeys();
    const s = create(keys);
    await s.setItem(SB_KEY, SESSION);
    await s.setItem('chat.identity.u1', '{"id":1}');
    await s.setItem('chat.group.u1.c1', '{"g":1}');
    store.m.set('hearth.easyView', 'on'); // a setting that is not the store's
    await s.clear();
    expect(keys.held).toBeNull();
    expect(await s.getItem(SB_KEY)).toBeNull();
    expect(await s.getItem('chat.identity.u1')).toBeNull();
    expect([...store.m.keys()]).toEqual(['hearth.easyView']);
    // "Reload": a fresh store finds nothing, so the app shows the sign-in screen.
    expect(await create(keys).getItem(SB_KEY)).toBeNull();
  });

  it('WEB-APP-6 removeItem removes one sealed value and leaves the rest', async () => {
    const s = create(memoryKeys());
    await s.setItem(SB_KEY, SESSION);
    await s.setItem('chat.identity.u1', '{"id":1}');
    await s.removeItem(SB_KEY);
    expect(await s.getItem(SB_KEY)).toBeNull();
    expect(await s.getItem('chat.identity.u1')).toBe('{"id":1}');
    expect(store.m.size).toBe(1);
  });

  it('WEB-APP-8 IndexedDB blocked: the visit works from memory, nothing is written in plain text, no crash', async () => {
    const boom = async () => { throw new Error('InvalidStateError: IndexedDB blocked'); };
    const s = create({ get: boom, put: boom, delete: boom });
    await expect(s.setItem(SB_KEY, SESSION)).resolves.toBeUndefined();
    expect(await s.getItem(SB_KEY)).toBe(SESSION);
    for (const secret of SECRETS) expect(dump()).not.toContain(secret);
    await expect(s.removeItem(SB_KEY)).resolves.toBeUndefined();
    await expect(s.clear()).resolves.toBeUndefined();
    expect(await s.getItem(SB_KEY)).toBeNull();
  });

  it('WEB-APP-8 WebCrypto missing: the visit works from memory, nothing is written in plain text, no crash', async () => {
    const nodeCrypto = require('crypto').webcrypto as Crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true, value: { getRandomValues: nodeCrypto.getRandomValues.bind(nodeCrypto), subtle: undefined },
    });
    const s = create(memoryKeys());
    await expect(s.setItem(SB_KEY, SESSION)).resolves.toBeUndefined();
    expect(await s.getItem(SB_KEY)).toBe(SESSION);
    for (const secret of SECRETS) expect(dump()).not.toContain(secret);
  });

  it('WEB-APP-8 localStorage blocked (HARD-7 kept): the visit works from memory, no crash', async () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('SecurityError'); } });
    const s = create(memoryKeys());
    await expect(s.setItem(SB_KEY, SESSION)).resolves.toBeUndefined();
    expect(await s.getItem(SB_KEY)).toBe(SESSION);
    await s.removeItem(SB_KEY);
    expect(await s.getItem(SB_KEY)).toBeNull();
  });

  it('WEB-APP-9 a tampered value is treated as signed out and the leftover is cleared, with no error', async () => {
    const keys = memoryKeys();
    await create(keys).setItem(SB_KEY, SESSION);
    const [k, v] = first(store.m.entries());
    const bytes = b64decode(v);
    bytes[bytes.length - 1]! ^= 0x01; // flip one tag bit
    store.m.set(k, Buffer.from(bytes).toString('base64'));
    const s = create(keys);
    await expect(s.getItem(SB_KEY)).resolves.toBeNull();
    expect(store.m.has(k)).toBe(false);
  });

  it('WEB-APP-9 a sealed value whose key is gone is treated as signed out and the leftovers are cleared, with no error', async () => {
    await create(memoryKeys()).setItem(SB_KEY, SESSION);
    expect(store.m.size).toBe(1);
    const s = create(memoryKeys()); // IndexedDB wiped (or a different browser profile's key)
    await expect(s.getItem(SB_KEY)).resolves.toBeNull();
    expect(store.m.size).toBe(0);
  });

  it('WEB-APP-9 garbage under the session key (not base64, too short) is signed out, cleared, no error', async () => {
    const keys = memoryKeys();
    await create(keys).setItem(SB_KEY, SESSION);
    const k = first(store.m.keys());
    for (const junk of ['%%%not-base64%%%', 'AAAA']) {
      store.m.set(k, junk);
      await expect(create(keys).getItem(SB_KEY)).resolves.toBeNull();
      expect(store.m.has(k)).toBe(false);
    }
  });

  // privacy-security review of HRT-WEB.1. PRIV-WEB-R1 (P1): WEB-APP-5 only sealed a plain value when it was
  // read, so legacy chat.* values of chats never reopened (and the supabase "-user" copy) stayed in plain text.
  // Every legacy plain key the old build wrote is sealed on the store's first use, whatever is asked for first.
  const LEGACY_PLAIN: Record<string, string> = {
    [SB_KEY]: SESSION,
    [`${SB_KEY}-user`]: JSON.stringify({ user: { id: USER, email: EMAIL } }),
    'chat.identity.u1': '{"identity":"old-plain-identity","signKey":"old-plain-signkey"}',
    'chat.group.u1.c1': '{"state":"old-plain-group-c1","cursor":3,"lines":[]}',
    'chat.group.u1.c2': '{"state":"old-plain-group-c2","cursor":9,"lines":[]}',
  };
  const PLAIN_MARKERS = [...SECRETS, 'old-plain-identity', 'old-plain-signkey', 'old-plain-group-c1', 'old-plain-group-c2'];
  const seedLegacy = () => { for (const [k, v] of Object.entries(LEGACY_PLAIN)) store.m.set(k, v); store.m.set('hearth.easyView', 'on'); };

  it('PRIV-WEB-R1 on the first use every legacy plain key (sb-*-auth-token*, chat.* incl. chat.group.<user>.<circle>) is sealed and its plain copy removed, even if never read', async () => {
    seedLegacy();
    const keys = memoryKeys();
    const s = create(keys);
    expect(await s.getItem(SB_KEY)).toBe(SESSION); // the only value asked for (what supabase-js reads at start)
    for (const k of Object.keys(LEGACY_PLAIN)) expect({ k, plainLeft: store.m.has(k) }).toEqual({ k, plainLeft: false });
    for (const marker of PLAIN_MARKERS) expect(dump()).not.toContain(marker);
    expect(store.m.get('hearth.easyView')).toBe('on'); // not the store's: untouched
    // Nothing lost: each one opens later, from its sealed copy.
    const again = create(keys);
    for (const [k, v] of Object.entries(LEGACY_PLAIN)) expect(await again.getItem(k)).toBe(v);
  });

  it('PRIV-WEB-R1 the first use being a write (not a read) still seals every legacy plain key', async () => {
    seedLegacy();
    const s = create(memoryKeys());
    await s.setItem('chat.identity.u2', '{"id":2}');
    for (const k of Object.keys(LEGACY_PLAIN)) expect({ k, plainLeft: store.m.has(k) }).toEqual({ k, plainLeft: false });
    for (const marker of PLAIN_MARKERS) expect(dump()).not.toContain(marker);
    expect(await s.getItem('chat.group.u1.c2')).toBe(LEGACY_PLAIN['chat.group.u1.c2']);
  });

  // PRIV-WEB-R2: when sealing fails during the migration (IndexedDB or WebCrypto blocked), the plain copy stayed
  // in localStorage for good. It must still be removed; the value lives in memory for this visit (WEB-APP-8).
  it('PRIV-WEB-R2 sealing fails during migration (IndexedDB blocked): the plain copy is still removed, the visit works from memory', async () => {
    seedLegacy();
    const boom = async () => { throw new Error('InvalidStateError: IndexedDB blocked'); };
    const s = create({ get: boom, put: boom, delete: boom });
    expect(await s.getItem(SB_KEY)).toBe(SESSION); // still signed in for this visit
    for (const k of Object.keys(LEGACY_PLAIN)) expect({ k, plainLeft: store.m.has(k) }).toEqual({ k, plainLeft: false });
    for (const marker of PLAIN_MARKERS) expect(dump()).not.toContain(marker);
    expect(store.m.get('hearth.easyView')).toBe('on');
    // Nothing lost this visit: chats not yet opened are still there, from memory.
    expect(await s.getItem('chat.group.u1.c1')).toBe(LEGACY_PLAIN['chat.group.u1.c1']);
  });

  it('PRIV-WEB-R2 sealing fails during migration (WebCrypto missing): the plain copy is still removed, the visit works from memory', async () => {
    seedLegacy();
    const nodeCrypto = require('crypto').webcrypto as Crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true, value: { getRandomValues: nodeCrypto.getRandomValues.bind(nodeCrypto), subtle: undefined },
    });
    const s = create(memoryKeys());
    expect(await s.getItem(SB_KEY)).toBe(SESSION);
    for (const k of Object.keys(LEGACY_PLAIN)) expect({ k, plainLeft: store.m.has(k) }).toEqual({ k, plainLeft: false });
    for (const marker of PLAIN_MARKERS) expect(dump()).not.toContain(marker);
  });

  it('HRT-WEB.1 the default secureSessionStorage has the same shape (getItem, setItem, removeItem, clear)', () => {
    const d = web.secureSessionStorage as unknown as Partial<Store>;
    expect(typeof d.getItem).toBe('function');
    expect(typeof d.setItem).toBe('function');
    expect(typeof d.removeItem).toBe('function');
    expect(typeof d.clear).toBe('function');
  });
});
