// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// HRT-WEB.3 (docs/product/SPEC-WEB-APP.md, architect call Nov 25): the web upload byte store. A picked photo is
// prepared (resized, EXIF/GPS stripped) BEFORE its job is saved; the CLEANED display, thumb and spec are sealed with
// the HRT-WEB.1 key (secureSession.web.ts sealBytes: this module never reads or makes a key, ARCH-WEB-R1) and kept in
// IndexedDB database `hearth.uploads`, one record per photo under `<stageId>/<index>`. The queue item's uri becomes
// `hearth-q:<stageId>/<index>`. The original (with GPS) never touches disk.
// Deleted when the post publishes or is removed (release), at sign-out (wipe: the whole database) and on the next
// open for records no saved job points at (sweep). 150 MB cap; over it, or blocked, or full, or no WebCrypto: that
// post stays in memory only (never refused), with one code-only report.
import { ApiError } from '../api/HearthApi';
import { uuid } from '../crypto/random';
import { verifyClean } from '../media/clean';
import type { Prepared, QueueItem } from '../upload/queue';
import { secureSessionStorage } from './secureSession.web';
import type { UploadStore, UploadStoreReport } from './uploadStoreTypes';

export type { UploadStore, UploadStoreReport };

const DB_NAME = 'hearth.uploads';
const OS_NAME = 'items';
const SCHEME = 'hearth-q:';
const DEFAULT_CAP = 150 * 1024 * 1024;

export interface UploadRecord { v: number; spec: Uint8Array; display: Uint8Array; thumb: Uint8Array }
export interface UploadDb {
  get(key: string): Promise<UploadRecord | undefined>;
  put(key: string, rec: UploadRecord): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  /** deleteDatabase('hearth.uploads') */
  wipe(): Promise<void>;
}
export interface ByteSealer {
  sealBytes(name: string, bytes: Uint8Array): Promise<Uint8Array | null>;
  openBytes(name: string, sealed: Uint8Array): Promise<Uint8Array | null>;
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const keyOf = (uri: string) => (uri.startsWith(SCHEME) ? uri.slice(SCHEME.length) : null);
const recBytes = (r: UploadRecord) => r.spec.length + r.display.length + r.thumb.length;
const isQuota = (e: unknown) => (e as { name?: string } | null)?.name === 'QuotaExceededError';

export function createUploadStore(o: { db: UploadDb; sealer: ByteSealer; report: (code: UploadStoreReport) => void; capBytes?: number }): UploadStore {
  const { db, sealer } = o;
  const cap = o.capBytes ?? DEFAULT_CAP;
  /** Photos of posts that could not be saved this visit, by key. */
  const mem = new Map<string, Prepared>();
  /** Sealed bytes per stored key; read from the database the first time a post is staged. */
  const sizes = new Map<string, number>();
  let scanned = false;
  let used = 0;

  async function scan(): Promise<void> {
    if (scanned) return;
    for (const k of await db.keys()) {
      const r = await db.get(k);
      if (r) { const n = recBytes(r); sizes.set(k, n); used += n; }
    }
    scanned = true; // only after a whole read, so a blocked first try is retried
  }

  async function drop(key: string): Promise<void> {
    mem.delete(key);
    used -= sizes.get(key) ?? 0;
    sizes.delete(key);
    try { await db.delete(key); } catch { /* blocked: nothing was saved there */ }
  }

  /** Seals and puts one photo. Throws a short reason string when it cannot be kept. */
  async function put(key: string, p: Prepared): Promise<void> {
    const parts: [string, Uint8Array][] = [['display', p.display], ['spec', enc.encode(JSON.stringify(p.spec))], ['thumb', p.thumb]];
    const sealed: Record<string, Uint8Array> = {};
    for (const [name, bytes] of parts) {
      const s = await sealer.sealBytes(`q.${key}/${name}`, bytes);
      if (!s) throw 'blocked';
      sealed[name] = s;
    }
    const rec: UploadRecord = { v: 1, spec: sealed.spec!, display: sealed.display!, thumb: sealed.thumb! };
    const n = recBytes(rec);
    if (used + n > cap) throw 'full';
    try { await db.put(key, rec); } catch (e) { throw isQuota(e) ? 'full' : 'blocked'; }
    sizes.set(key, n);
    used += n;
  }

  return {
    async stage(items, prepare, onProgress) {
      const stageId = uuid();
      const total = items.filter((i) => i.kind === 'photo').length;
      const out: QueueItem[] = [];
      const ready: { key: string; p: Prepared }[] = [];
      let done = 0;
      for (let i = 0; i < items.length; i++) {
        const item = items[i]!;
        if (item.kind !== 'photo') { out.push(item); continue; }
        const p = await prepare(item);
        verifyClean(p.display); // fails closed with META_<GROUP>; nothing has been written yet
        verifyClean(p.thumb);
        const key = `${stageId}/${i}`;
        ready.push({ key, p });
        out.push({ ...item, uri: SCHEME + key });
        onProgress?.(++done, total);
      }
      if (!ready.length) return { items: out, durable: true };
      let durable = true;
      try {
        await scan();
        for (const r of ready) await put(r.key, r.p);
      } catch (why) {
        durable = false;
        for (const r of ready) await drop(r.key); // all or nothing: a half-saved post would fail at the next open
        try { o.report(why === 'full' ? 'upload_store_full' : 'upload_store_blocked'); } catch { /* reporting never blocks */ }
        for (const r of ready) mem.set(r.key, r.p);
      }
      return { items: out, durable };
    },

    async open(uri) {
      const key = keyOf(uri);
      if (!key) return null;
      const m = mem.get(key);
      if (m) return m;
      try {
        const rec = await db.get(key);
        if (!rec || rec.v !== 1) return null;
        const [display, thumb, spec] = await Promise.all([
          sealer.openBytes(`q.${key}/display`, rec.display), sealer.openBytes(`q.${key}/thumb`, rec.thumb), sealer.openBytes(`q.${key}/spec`, rec.spec)]);
        if (!display || !thumb || !spec) return null;
        verifyClean(display); // WEB-APP-26: a record from an old build or a tampered one fails closed
        verifyClean(thumb);
        return { spec: JSON.parse(dec.decode(spec)) as Prepared['spec'], display, thumb };
      } catch {
        return null;
      }
    },

    async has(uri) {
      const key = keyOf(uri);
      if (!key) return false;
      if (mem.has(key)) return true;
      try {
        const rec = await db.get(key);
        // The spec must open too: with the key gone (cleared site data) the post can't be sent, so it isn't "there".
        return !!rec && !!(await sealer.openBytes(`q.${key}/spec`, rec.spec));
      } catch {
        return false;
      }
    },

    memoryOnly: (uri) => { const k = keyOf(uri); return !!k && mem.has(k); },

    async release(uris) {
      for (const u of uris) { const k = keyOf(u); if (k) await drop(k); }
    },

    async sweep(liveUris) {
      const live = new Set(liveUris.map(keyOf).filter((k): k is string => !!k));
      try {
        for (const k of await db.keys()) if (!live.has(k)) await drop(k);
      } catch { /* blocked */ }
    },

    async wipe() {
      mem.clear();
      sizes.clear();
      used = 0;
      scanned = false;
      try { await db.wipe(); } catch { /* blocked: the key is deleted at sign-out too, so leftovers can't be opened */ }
    },
  };
}

/** The real database: raw IndexedDB, no dependency (same style as indexedDbKeyStore). */
export function indexedDbUploadDb(idb: IDBFactory | undefined = (globalThis as { indexedDB?: IDBFactory }).indexedDB): UploadDb {
  let db: Promise<IDBDatabase> | undefined;
  const openDb = () => {
    if (!idb) return Promise.reject(new Error('no IndexedDB'));
    return (db ??= new Promise<IDBDatabase>((res, rej) => {
      const r = idb.open(DB_NAME, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore(OS_NAME); };
      r.onsuccess = () => {
        const d = r.result;
        d.onversionchange = () => { d.close(); db = undefined; }; // another tab's sign-out may delete the database
        res(d);
      };
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('blocked'));
    }).catch((e) => { db = undefined; throw e; }));
  };
  const run = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const t = (await openDb()).transaction(OS_NAME, mode);
    const r = f(t.objectStore(OS_NAME));
    return new Promise<T>((res, rej) => {
      t.oncomplete = () => res(r.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error ?? new Error('aborted'));
    });
  };
  return {
    get: (k) => run('readonly', (s) => s.get(k) as IDBRequest<UploadRecord | undefined>),
    put: async (k, r) => { await run('readwrite', (s) => s.put(r, k)); },
    delete: async (k) => { await run('readwrite', (s) => s.delete(k)); },
    keys: async () => (await run('readonly', (s) => s.getAllKeys())).map(String),
    wipe: async () => {
      if (!idb) return;
      const open = db;
      db = undefined;
      if (open) { try { (await open).close(); } catch { /* never opened */ } }
      await new Promise<void>((res) => {
        const r = idb.deleteDatabase(DB_NAME);
        r.onsuccess = () => res();
        r.onerror = () => res();
        r.onblocked = () => res(); // another tab still has it open: it closes on versionchange and the delete finishes
      });
    },
  };
}

/** The web build's store: real IndexedDB, sealed with the session store's key. */
export function createWebUploadStore(report: (code: UploadStoreReport) => void): UploadStore | null {
  return createUploadStore({ db: indexedDbUploadDb(), sealer: secureSessionStorage, report });
}
