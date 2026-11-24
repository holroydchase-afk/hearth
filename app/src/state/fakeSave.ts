// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-SAFARI-1..4: how the fake backend saves itself in a browser. Safari caps localStorage at 5 MB counted as
// UTF-16, and the sample family's photo bytes alone are ~3.5M characters, so the family (small) stays in
// localStorage and the photo bytes (write-once) go to IndexedDB. Only fakeRuntime.ts imports this file, so it
// ships in the demo and fake web builds only (ENG-R5).
import type { FakeState } from '../api/fake/FakeBackend';

/** Where photo bytes live, key -> base64 ciphertext. */
export type ObjectStore = {
  getAll(): Promise<Record<string, string>>;
  put(entries: [string, string][]): Promise<void>;
  clear(): Promise<void>;
};

type LS = { setItem(k: string, v: string): void };

const DB = 'hearth.demoObjects';
const STORE = 'objects';
// Inline bytes waiting for the store stay well under Safari's cap (characters; 2 bytes each).
const INLINE_MAX = 1_000_000;

/** IndexedDB behind ObjectStore; undefined when the browser (or jest) has none. */
export function idbObjects(idb: IDBFactory | undefined = (globalThis as { indexedDB?: IDBFactory }).indexedDB): ObjectStore | undefined {
  if (!idb) return undefined;
  let db: Promise<IDBDatabase> | undefined;
  const open = () => (db ??= new Promise<IDBDatabase>((res, rej) => {
    const r = idb.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('blocked'));
  }));
  const run = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => () => T): Promise<T> => {
    const t = (await open()).transaction(STORE, mode);
    const done = f(t.objectStore(STORE));
    return new Promise<T>((res, rej) => {
      t.oncomplete = () => res(done());
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error ?? new Error('aborted'));
    });
  };
  return {
    getAll: () => run('readonly', (s) => {
      const keys = s.getAllKeys();
      const vals = s.getAll();
      return () => Object.fromEntries(keys.result.map((k, i) => [String(k), vals.result[i] as string]));
    }),
    put: (entries) => run('readwrite', (s) => { for (const [k, v] of entries) s.put(v, k); return () => undefined; }),
    clear: () => run('readwrite', (s) => { s.clear(); return () => undefined; }),
  };
}

/** Saves the family to localStorage at once, with photo bytes not yet in the store kept inline until they land
 * there (so a reload right after sharing keeps the post). A big batch (the sample family's 10 photos) waits for
 * the store instead. Without a store, or once it fails, the whole state is saved inline as before DEMO-SAFARI. */
export function splitSaver(ls: LS, key: string, store?: ObjectStore, inlineMax = INLINE_MAX) {
  let stored = new Set<string>();
  let pending: Record<string, string> = {};
  let latest: FakeState | undefined;
  let chain: Promise<void> = Promise.resolve();
  let inline = !store;
  const write = () => {
    if (!latest) return;
    const v = inline ? JSON.stringify(latest) : JSON.stringify({ ...latest, objects: pending });
    try { ls.setItem(key, v); } catch { /* full or blocked: the next write tries again */ }
  };
  return {
    save(s: FakeState): void {
      latest = s;
      if (inline || !store) { write(); return; }
      const fresh = Object.keys(s.objects).filter((k) => !stored.has(k) && !(k in pending));
      for (const k of fresh) pending[k] = s.objects[k]!;
      const size = Object.values(pending).reduce((n, v) => n + v.length, 0);
      if (size <= inlineMax) write();
      if (!fresh.length) return;
      const entries = fresh.map((k): [string, string] => [k, s.objects[k]!]);
      const batch = pending;
      chain = chain.then(() => store.put(entries)).then(() => {
        if (batch !== pending) return; // reset since: these bytes belong to the old family
        for (const [k] of entries) { stored.add(k); delete pending[k]; }
        write();
      }, () => { inline = true; write(); });
    },
    /** Photo keys already in the store (after a load), so they aren't written again. */
    know(keys: string[]): void { keys.forEach((k) => stored.add(k)); },
    /** A fresh family: drop the old photo bytes first. */
    reset(): void {
      stored = new Set();
      pending = {};
      chain = chain.then(() => store?.clear()).catch(() => undefined);
    },
    flush: (): Promise<void> => chain,
  };
}

/** True when every ready photo's bytes are present (a store wiped by the browser would leave grey tiles). */
export function objectsComplete(s: FakeState): boolean {
  return Object.values(s.media).every((m) => m.status !== 'ready' || (!!s.objects[m.display_key] && !!s.objects[m.thumb_key]));
}
