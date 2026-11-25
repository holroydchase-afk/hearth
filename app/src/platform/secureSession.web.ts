// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// HRT-WEB.1 (docs/product/SPEC-WEB-APP.md, WEB-APP-3..9): the web session store. Every value (the Supabase
// session, the messenger's MLS identity and group state) is sealed with AES-256-GCM (WebCrypto) into
// localStorage as base64(nonce ‖ ciphertext ‖ tag); the value's name is bound as additional data. The key is
// a non-extractable CryptoKey kept in IndexedDB, so page script can use it but never read its bytes.
// Values the old plain-text build wrote are all sealed on the store's first use, read or not, and every plain
// copy is removed even when sealing fails (then the value lives in memory for the visit) (WEB-APP-5,
// PRIV-WEB-R1/R2; no forced sign-in).
// When IndexedDB, WebCrypto or localStorage is unavailable the visit works from memory and nothing is
// written in plain text (WEB-APP-8). A value that will not open is treated as signed out (WEB-APP-9).
import { fromBase64, toBase64 } from '../crypto/base64';
import { webStorage } from './webStorage';

/** Where the sealing key lives (IndexedDB in the browser; injected in tests). */
export interface SessionKeyStore {
  get(): Promise<CryptoKey | null>;
  put(k: CryptoKey): Promise<void>;
  delete(): Promise<void>;
}

export interface SecureSessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  /** Sign-out: removes every value this store wrote (session + messenger store) and deletes the key. */
  clear(): Promise<void>;
}

/** Sealed values are kept under this prefix, so a sealed value is never mistaken for an old plain one. */
const PREFIX = 'hs.';
/** Names the old plain-text build wrote through this store (supabase-js session keys, the messenger store). */
const LEGACY = /^(sb-.+-auth-token(-.*)?|chat\..*)$/;
const NONCE = 12;
const TAG = 16;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

const enc = new TextEncoder();
const dec = new TextDecoder();

function subtleCrypto(): SubtleCrypto | undefined {
  try {
    const c = globalThis.crypto;
    if (c?.subtle && typeof c.subtle.encrypt === 'function' && typeof c.getRandomValues === 'function') return c.subtle;
  } catch { /* no WebCrypto */ }
  return undefined;
}

function decode(s: string): Uint8Array<ArrayBuffer> | null {
  if (!B64.test(s) || s.length % 4 !== 0) return null;
  try {
    const b = new Uint8Array(fromBase64(s));
    return b.length >= NONCE + TAG ? b : null;
  } catch {
    return null;
  }
}

/** Keys of localStorage, read safely. */
function lsKeys(ls: Storage): string[] {
  const out: string[] = [];
  for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k != null) out.push(k); }
  return out;
}

export function createSecureSessionStorage({ keys }: { keys: SessionKeyStore }): SecureSessionStorage {
  /** Memory mode (WEB-APP-8): something the sealed store needs is missing; nothing touches localStorage. */
  let memory = false;
  const mem = new Map<string, string>();
  /** undefined: not read from the key store yet. */
  let key: CryptoKey | null | undefined;
  // One operation at a time, so two first writes never make two keys.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(f: () => Promise<T>): Promise<T> => {
    const p = chain.then(f, f);
    chain = p.catch(() => undefined);
    return p;
  };

  const ls = (): Storage | undefined => webStorage();

  /** The sealing key; creates one when asked. Throws when IndexedDB or WebCrypto is unusable. */
  async function sealingKey(create: boolean): Promise<CryptoKey | null> {
    const subtle = subtleCrypto();
    if (!subtle) throw new Error('no WebCrypto');
    if (key === undefined) key = await keys.get();
    if (!key && create) {
      const fresh = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await keys.put(fresh);
      key = fresh;
    }
    return key ?? null;
  }

  /** Drops every sealed value (they cannot be opened without the key). */
  function purgeSealed(s: Storage) {
    for (const k of lsKeys(s)) if (k.startsWith(PREFIX)) s.removeItem(k);
  }

  function goMemory() { memory = true; }

  /** PRIV-WEB-R1/R2: seals every legacy plain value once, on the first use; the plain copy always goes. */
  let migrated = false;
  async function migrate(): Promise<void> {
    if (migrated) return;
    migrated = true;
    let s: Storage | undefined;
    try { s = ls(); } catch { s = undefined; }
    if (!s) return;
    let names: string[];
    try { names = lsKeys(s).filter((k) => LEGACY.test(k)); } catch { return; }
    for (const name of names) {
      try {
        const plain = s.getItem(name);
        if (plain == null) continue;
        let sealed = false;
        if (!memory) {
          if (s.getItem(PREFIX + name) != null) sealed = true; // already sealed: the plain copy is stale
          else sealed = await seal(name, plain);
        }
        if (!sealed) { goMemory(); mem.set(name, plain); }
        s.removeItem(name);
      } catch {
        try { s.removeItem(name); } catch { /* blocked */ }
      }
    }
  }

  async function seal(name: string, value: string): Promise<boolean> {
    const s = ls();
    if (!s) return false;
    try {
      const k = (await sealingKey(true))!;
      const nonce = globalThis.crypto.getRandomValues(new Uint8Array(NONCE));
      const ct = new Uint8Array(await subtleCrypto()!.encrypt(
        { name: 'AES-GCM', iv: nonce, additionalData: enc.encode(name) }, k, enc.encode(value)));
      const out = new Uint8Array(NONCE + ct.length);
      out.set(nonce);
      out.set(ct, NONCE);
      s.setItem(PREFIX + name, toBase64(out));
      return true;
    } catch {
      return false;
    }
  }

  async function open(s: Storage, name: string, sealed: string): Promise<string | null> {
    const k = await sealingKey(false); // throws → memory mode
    if (!k) { purgeSealed(s); return null; } // the key is gone: nothing here can be opened (WEB-APP-9)
    const raw = decode(sealed);
    if (raw) {
      try {
        const pt = await subtleCrypto()!.decrypt(
          { name: 'AES-GCM', iv: raw.subarray(0, NONCE), additionalData: enc.encode(name) }, k, raw.subarray(NONCE));
        return dec.decode(pt);
      } catch { /* tampered or another key */ }
    }
    s.removeItem(PREFIX + name);
    return null;
  }

  const getItem = (name: string) => serial(async (): Promise<string | null> => {
    await migrate();
    if (memory) return mem.get(name) ?? null;
    const s = ls();
    if (!s) { goMemory(); return mem.get(name) ?? null; }
    try {
      const sealed = s.getItem(PREFIX + name);
      if (sealed != null) return await open(s, name, sealed);
      // WEB-APP-5: a value the old plain-text build wrote. Keep it, seal it, remove the plain copy.
      const plain = s.getItem(name);
      if (plain == null) return null;
      if (!(await seal(name, plain))) { goMemory(); mem.set(name, plain); }
      s.removeItem(name);
      return plain;
    } catch {
      goMemory();
      return mem.get(name) ?? null;
    }
  });

  const setItem = (name: string, value: string) => serial(async (): Promise<void> => {
    await migrate();
    if (!memory && (await seal(name, value))) return;
    goMemory();
    mem.set(name, value);
  });

  const removeItem = (name: string) => serial(async (): Promise<void> => {
    mem.delete(name);
    try {
      const s = ls();
      s?.removeItem(PREFIX + name);
      s?.removeItem(name); // a plain leftover from the old build
    } catch { /* blocked */ }
  });

  const clear = () => serial(async (): Promise<void> => {
    mem.clear();
    try {
      const s = ls();
      if (s) for (const k of lsKeys(s)) if (k.startsWith(PREFIX) || LEGACY.test(k)) s.removeItem(k);
    } catch { /* blocked */ }
    key = null;
    try { await keys.delete(); } catch { /* IndexedDB blocked: nothing was kept there */ }
  });

  return { getItem, setItem, removeItem, clear };
}

const DB = 'hearth.session';
const STORE = 'keys';
const ID = 'seal';

/** The sealing key in IndexedDB (stored as a CryptoKey by structured clone; its bytes never reach script). */
export function indexedDbKeyStore(idb: IDBFactory | undefined = (globalThis as { indexedDB?: IDBFactory }).indexedDB): SessionKeyStore {
  let db: Promise<IDBDatabase> | undefined;
  const openDb = () => {
    if (!idb) return Promise.reject(new Error('no IndexedDB'));
    return (db ??= new Promise<IDBDatabase>((res, rej) => {
      const r = idb.open(DB, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore(STORE); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('blocked'));
    }).catch((e) => { db = undefined; throw e; }));
  };
  const run = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const t = (await openDb()).transaction(STORE, mode);
    const r = f(t.objectStore(STORE));
    return new Promise<T>((res, rej) => {
      t.oncomplete = () => res(r.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error ?? new Error('aborted'));
    });
  };
  return {
    get: async () => {
      const v = await run('readonly', (s) => s.get(ID) as IDBRequest<unknown>);
      return typeof CryptoKey !== 'undefined' && v instanceof CryptoKey ? v : null;
    },
    put: async (k) => { await run('readwrite', (s) => s.put(k, ID)); },
    delete: async () => { await run('readwrite', (s) => s.delete(ID)); },
  };
}

export const secureSessionStorage: SecureSessionStorage = createSecureSessionStorage({ keys: indexedDbKeyStore() });
