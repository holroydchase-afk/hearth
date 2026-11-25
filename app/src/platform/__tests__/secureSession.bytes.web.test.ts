// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// HRT-WEB.3 (docs/product/SPEC-WEB-APP.md, ARCH-WEB-R1): the web session store is the ONE owner of the sealing key. It
// gains byte sealing for the upload store, on the same key, serial chain and memory-mode switch.
//
// The contract these tests hold the build to (secureSession.web.ts):
//   createSecureSessionStorage({ keys }) also returns
//     sealBytes(name, bytes): Promise<Uint8Array | null>   AES-256-GCM, `name` bound as additional data; null = cannot seal
//     openBytes(name, sealed): Promise<Uint8Array | null>  null = wrong name, tampered, key gone, or unavailable
//   clear() (sign-out) deletes the key, so bytes sealed before it can no longer be opened.
import * as web from '../secureSession.web';

type KeyStore = { get(): Promise<CryptoKey | null>; put(k: CryptoKey): Promise<void>; delete(): Promise<void> };
type Store = {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
  clear(): Promise<void>;
  sealBytes?(name: string, bytes: Uint8Array): Promise<Uint8Array | null>;
  openBytes?(name: string, sealed: Uint8Array): Promise<Uint8Array | null>;
};
const create = (keys: KeyStore): Required<Store> => {
  const f = (web as unknown as { createSecureSessionStorage?: (o: { keys: KeyStore }) => Store }).createSecureSessionStorage;
  if (typeof f !== 'function') throw new Error('secureSession.web.ts does not export createSecureSessionStorage({ keys })');
  const s = f({ keys });
  if (typeof s.sealBytes !== 'function' || typeof s.openBytes !== 'function') {
    throw new Error('secureSession.web.ts store has no sealBytes/openBytes yet (ARCH-WEB-R1: one key owner)');
  }
  return s as Required<Store>;
};

function memoryKeys() {
  let key: CryptoKey | null = null;
  const handed: CryptoKey[] = [];
  return { handed, get: async () => key, put: async (k: CryptoKey) => { key = k; handed.push(k); }, delete: async () => { key = null; } };
}

const PLAIN = new Uint8Array(3000).map((_, i) => (i * 7 + 3) & 0xff);
const has = (hay: Uint8Array, needle: Uint8Array) => Buffer.from(hay).indexOf(Buffer.from(needle)) !== -1;

describe('HRT-WEB.3 sealBytes / openBytes (ARCH-WEB-R1)', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      get length() { return m.size; }, key: (i: number) => [...m.keys()][i] ?? null,
      getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); },
      removeItem: (k: string) => { m.delete(k); }, clear: () => m.clear(),
    };
  });

  it('WEB-APP-29 sealBytes returns bytes that hold no part of the plain bytes, and openBytes gives them back', async () => {
    const s = create(memoryKeys());
    const sealed = await s.sealBytes('q.stage1/0/display', PLAIN);
    expect(sealed).toBeInstanceOf(Uint8Array);
    expect(sealed!.length).toBeGreaterThan(PLAIN.length);
    expect(has(sealed!, PLAIN.subarray(100, 140))).toBe(false);
    expect(Buffer.from((await s.openBytes('q.stage1/0/display', sealed!))!)).toEqual(Buffer.from(PLAIN));
  });

  it('WEB-APP-29 the name is bound: the same bytes will not open under another name (a record moved to another slot)', async () => {
    const s = create(memoryKeys());
    const sealed = (await s.sealBytes('q.stage1/0/display', PLAIN))!;
    expect(await s.openBytes('q.stage1/0/thumb', sealed)).toBeNull();
    expect(await s.openBytes('q.stage1/1/display', sealed)).toBeNull();
  });

  it('WEB-APP-29 a flipped byte fails to open (null, never garbage)', async () => {
    const s = create(memoryKeys());
    const sealed = (await s.sealBytes('q.s/0/spec', PLAIN))!.slice();
    sealed[sealed.length - 1]! ^= 1;
    expect(await s.openBytes('q.s/0/spec', sealed)).toBeNull();
  });

  it('ARCH-WEB-R1 one key: concurrent sealBytes and a session setItem on a fresh store make exactly one key', async () => {
    const keys = memoryKeys();
    const s = create(keys);
    await Promise.all([s.sealBytes('q.a/0/display', PLAIN), s.sealBytes('q.a/0/thumb', PLAIN), s.setItem('sb-x-auth-token', '{}'), s.sealBytes('q.a/1/display', PLAIN)]);
    expect(keys.handed).toHaveLength(1);
    expect(keys.handed[0]!.extractable).toBe(false);
  });

  it('WEB-APP-32 sign-out (clear) deletes the key, so bytes sealed before it can never be opened again', async () => {
    const keys = memoryKeys();
    const s = create(keys);
    const sealed = (await s.sealBytes('q.s/0/display', PLAIN))!;
    await s.clear();
    expect(await s.openBytes('q.s/0/display', sealed)).toBeNull();
  });

  it('WEB-APP-33 when the key store is blocked (private window) sealBytes says null, never plain bytes, and does not throw', async () => {
    const broken: KeyStore = { get: async () => { throw new Error('blocked'); }, put: async () => { throw new Error('blocked'); }, delete: async () => {} };
    const s = create(broken);
    expect(await s.sealBytes('q.s/0/display', PLAIN)).toBeNull();
    expect(await s.openBytes('q.s/0/display', new Uint8Array(60))).toBeNull();
  });
});
