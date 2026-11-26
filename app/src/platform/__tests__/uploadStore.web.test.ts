// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// HRT-WEB.3 (docs/product/SPEC-WEB-APP.md, architect call Nov 25): the web upload byte store. A picked photo is
// prepared (resized, EXIF/GPS stripped) BEFORE the job is saved; the cleaned display, thumb and spec are sealed with
// the WEB.1 key and kept in IndexedDB database `hearth.uploads` under `<stageId>/<index>`, and the queue item's uri
// becomes `hearth-q:<stageId>/<index>`. Jest uses an injected Map fake for IndexedDB (ARCH-WEB-R3: no fake-indexeddb);
// real IndexedDB, real WebCrypto and a real GPS JPEG are covered by e2e-web/web-photo-share.spec.js.
//
// The contract these tests hold the build to (app/src/platform/uploadStore.web.ts; uploadStore.ts is a no-op on phones):
//   createUploadStore({ db, sealer, report, capBytes? }) → UploadStore
//     db: { get(key): Promise<UploadRecord | undefined>; put(key, rec): Promise<void>; delete(key): Promise<void>;
//           keys(): Promise<string[]>; wipe(): Promise<void> }   (wipe = deleteDatabase('hearth.uploads'))
//     sealer: { sealBytes(name, bytes): Promise<Uint8Array | null>; openBytes(name, sealed): Promise<Uint8Array | null> }
//             (secureSession.web.ts; the store never reads or makes a key itself, ARCH-WEB-R1)
//     report(code: 'upload_store_full' | 'upload_store_blocked'): void   (code only: no sizes, names or bytes)
//     capBytes: sealed bytes allowed in the db (default 150 MB)
//   store.stage(items: QueueItem[], prepare: (item) => Promise<Prepared>, onProgress?: (done, total) => void)
//        → Promise<{ items: QueueItem[]; durable: boolean }>
//        photo items are prepared, verifyClean-checked, sealed and put; their uri becomes `hearth-q:<stageId>/<index>`.
//        Video items pass through untouched (Fake-build videos stay blob: and memory-only). When the db is blocked,
//        full, or the sealer says null, the post is kept in memory only: durable false, same uris, one report.
//   store.open(uri) → Promise<Prepared | null>   null when missing or unopenable; re-runs verifyClean and fails closed
//   store.has(uri) → Promise<boolean>            true for a stored or memory-only item of this visit
//   store.release(uris: string[]) → Promise<void>
//   store.sweep(liveUris: string[]) → Promise<void>   deletes every record no live uri points at
//   store.wipe() → Promise<void>                 sign-out: the whole database goes (and memory)
import { ApiError } from '../../api/HearthApi';
import type { Prepared, QueueItem } from '../../upload/queue';
import { APP0_JFIF, APP1_FULL_EXIF, SECRETS, contains, imageData, jpeg } from '../../test/jpeg';
import * as mod from '../uploadStore.web';
import { createSecureSessionStorage } from '../secureSession.web';

type Rec = { v: number; spec: Uint8Array; display: Uint8Array; thumb: Uint8Array };
interface Db { get(k: string): Promise<Rec | undefined>; put(k: string, r: Rec): Promise<void>; delete(k: string): Promise<void>; keys(): Promise<string[]>; wipe(): Promise<void> }
interface Sealer { sealBytes(n: string, b: Uint8Array): Promise<Uint8Array | null>; openBytes(n: string, s: Uint8Array): Promise<Uint8Array | null> }
interface Store {
  stage(items: QueueItem[], prepare: (i: QueueItem) => Promise<Prepared>, onProgress?: (d: number, t: number) => void): Promise<{ items: QueueItem[]; durable: boolean }>;
  open(uri: string): Promise<Prepared | null>;
  has(uri: string): Promise<boolean>;
  release(uris: string[]): Promise<void>;
  sweep(live: string[]): Promise<void>;
  wipe(): Promise<void>;
}
type Opts = { db: Db; sealer: Sealer; report: (code: string) => void; capBytes?: number };
const create = (o: Opts): Store => {
  const f = (mod as unknown as { createUploadStore?: (o: Opts) => Store }).createUploadStore;
  if (typeof f !== 'function') throw new Error('platform/uploadStore.web.ts does not export createUploadStore({ db, sealer, report })');
  return f(o);
};

/** The Map fake: what IndexedDB would hold, with a switch for "blocked" and "quota". */
function mapDb(opts: { putFails?: () => Error | null } = {}) {
  const m = new Map<string, Rec>();
  const db: Db & { m: Map<string, Rec>; wiped: number } = {
    m, wiped: 0,
    get: async (k) => m.get(k),
    put: async (k, r) => { const e = opts.putFails?.(); if (e) throw e; m.set(k, r); },
    delete: async (k) => { m.delete(k); },
    keys: async () => [...m.keys()],
    wipe: async () => { m.clear(); db.wiped += 1; },
  };
  return db;
}

/** A stand-in for secureSession.web's sealBytes/openBytes: XOR, name remembered. Records every name it was asked for. */
function xorSealer(opts: { nullSeal?: boolean } = {}) {
  const names: string[] = [];
  const tag = new WeakMap<Uint8Array, string>();
  const sealer: Sealer & { names: string[] } = {
    names,
    sealBytes: async (n, b) => {
      names.push(n);
      if (opts.nullSeal) return null;
      const out = new Uint8Array(b.length + 28).map((_, i) => (i < b.length ? b[i]! ^ 0x5a : 0x11));
      tag.set(out, n);
      return out;
    },
    openBytes: async (n, s) => (tag.get(s) === n ? s.subarray(0, s.length - 28).map((x) => x ^ 0x5a) : null),
  };
  return sealer;
}

const clean = (w = 640, h = 480, scan = 400) => jpeg(APP0_JFIF, imageData(w, h, scan));
function prep(scan = 400): Prepared {
  const display = clean(2048, 1536, scan);
  const thumb = clean(320, 240, 64);
  return { spec: { kind: 'photo', mime_type: 'image/jpeg', width: 2048, height: 1536, duration_ms: null, byte_size: display.length + 28, thumb_byte_size: thumb.length + 28, exif_stripped: true }, display, thumb };
}
const photo = (n: number): QueueItem => ({ uri: `blob:http://127.0.0.1/${n}`, kind: 'photo' });
const has = (hay: Uint8Array, needle: Uint8Array) => Buffer.from(hay).indexOf(Buffer.from(needle)) !== -1;

function setup(extra: Partial<Opts> = {}, dbOpts: Parameters<typeof mapDb>[0] = {}) {
  const db = mapDb(dbOpts);
  const sealer = xorSealer();
  const reports: string[] = [];
  const store = create({ db, sealer, report: (c) => { reports.push(c); }, ...extra });
  return { db, sealer, reports, store };
}

describe('HRT-WEB.3 upload byte store: staging cleaned bytes (WEB-APP-29)', () => {
  it('WEB-APP-29 stage seals display, thumb and spec into one record per photo under <stageId>/<index>, and points each item at hearth-q:', async () => {
    const { db, store, sealer } = setup();
    const p = prep();
    const r = await store.stage([photo(1), photo(2)], async () => p);
    expect(r.durable).toBe(true);
    expect(r.items.map((i) => i.uri)).toEqual([expect.stringMatching(/^hearth-q:[^/]+\/0$/), expect.stringMatching(/^hearth-q:[^/]+\/1$/)]);
    expect(r.items.every((i) => i.kind === 'photo')).toBe(true);
    const keys = [...db.m.keys()].sort();
    expect(keys).toEqual(r.items.map((i) => i.uri.replace('hearth-q:', '')).sort());
    for (const rec of db.m.values()) {
      expect(rec.v).toBe(1);
      for (const part of [rec.display, rec.thumb, rec.spec]) expect(part).toBeInstanceOf(Uint8Array); // no base64 strings
    }
    const stageId = r.items[0]!.uri.slice('hearth-q:'.length).split('/')[0]!;
    expect(sealer.names.sort()).toEqual([0, 1].flatMap((i) => ['display', 'spec', 'thumb'].map((k) => `q.${stageId}/${i}/${k}`)).sort());
  });

  it('WEB-APP-29 no plain bytes at rest: nothing of the cleaned display, thumb or spec JSON is readable in the stored record', async () => {
    const { db, store } = setup();
    const p = prep(900);
    await store.stage([photo(1)], async () => p);
    const rec = [...db.m.values()][0]!;
    expect(has(rec.display, p.display.subarray(60, 100))).toBe(false);
    expect(has(rec.thumb, p.thumb.subarray(20, 50))).toBe(false);
    expect(has(rec.spec, new TextEncoder().encode('image/jpeg'))).toBe(false);
  });

  it('WEB-APP-29 every stage gets a fresh id (two posts never share a key)', async () => {
    const { store } = setup();
    const a = await store.stage([photo(1)], async () => prep());
    const b = await store.stage([photo(2)], async () => prep());
    expect(a.items[0]!.uri).not.toBe(b.items[0]!.uri);
  });

  it('WEB-APP-29 open gives the cleaned bytes and spec back, and has() is true; an unknown uri is null/false', async () => {
    const { store } = setup();
    const p = prep();
    const r = await store.stage([photo(1)], async () => p);
    const uri = r.items[0]!.uri;
    const got = (await store.open(uri))!;
    expect(Buffer.from(got.display)).toEqual(Buffer.from(p.display));
    expect(Buffer.from(got.thumb)).toEqual(Buffer.from(p.thumb));
    expect(got.spec).toEqual(p.spec);
    expect(await store.has(uri)).toBe(true);
    expect(await store.has('hearth-q:nope/0')).toBe(false);
    expect(await store.open('hearth-q:nope/0')).toBeNull();
  });

  it('WEB-APP-29 stage reports "Getting photos ready… 1 of 3" progress, one call per photo', async () => {
    const { store } = setup();
    const seen: [number, number][] = [];
    await store.stage([photo(1), photo(2), photo(3)], async () => prep(), (d, t) => seen.push([d, t]));
    expect(seen).toEqual([[1, 3], [2, 3], [3, 3]]);
  });

  it('WEB-APP-29 a video item passes through untouched (Fake-build videos stay blob: and memory-only): not prepared, nothing stored', async () => {
    const { store, db } = setup();
    const prepare = jest.fn(async () => prep());
    const v: QueueItem = { uri: 'blob:http://127.0.0.1/v', kind: 'video', durationMs: 9000 };
    const r = await store.stage([v], prepare);
    expect(r.items).toEqual([v]);
    expect(prepare).not.toHaveBeenCalled();
    expect(db.m.size).toBe(0);
  });

  it('WEB-APP-29 a prepare that fails halfway leaves nothing behind (no orphan record from the photos that did work)', async () => {
    const { store, db } = setup();
    let n = 0;
    await expect(store.stage([photo(1), photo(2), photo(3)], async () => { if (++n === 3) throw new TypeError('Failed to fetch'); return prep(); })).rejects.toBeDefined();
    expect(db.m.size).toBe(0);
  });
});

describe('HRT-WEB.3 the original never lands on disk (WEB-APP-26, 29)', () => {
  it('WEB-APP-26 stage refuses a prepared photo that still carries Exif/GPS (verifyClean fails closed, META_ code) and stores nothing', async () => {
    const { store, db } = setup();
    const dirty = { ...prep(), display: jpeg(APP0_JFIF, APP1_FULL_EXIF, imageData(640, 480, 200)) };
    expect(SECRETS.some((s) => contains(dirty.display, s))).toBe(true); // the fixture really carries GPS and a serial
    const err = await store.stage([photo(1)], async () => dirty).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toMatch(/^META_/);
    expect(db.m.size).toBe(0);
  });

  it('WEB-APP-26 open re-runs verifyClean: a record whose bytes carry Exif (tampered, or written by an old build) opens as null', async () => {
    const { store, db, sealer } = setup();
    const r = await store.stage([photo(1)], async () => prep());
    const uri = r.items[0]!.uri;
    const key = uri.replace('hearth-q:', '');
    const dirtyDisplay = jpeg(APP0_JFIF, APP1_FULL_EXIF, imageData(640, 480, 200));
    const sealed = (await sealer.sealBytes(`q.${key}/display`, dirtyDisplay))!;
    db.m.set(key, { ...db.m.get(key)!, display: sealed });
    expect(await store.open(uri)).toBeNull();
  });
});

describe('HRT-WEB.3 blocked or full storage keeps sharing working (WEB-APP-33, architect: cap 150 MB)', () => {
  it('WEB-APP-33 IndexedDB blocked: stage still returns the items, durable false, memory-only open works, nothing written, one upload_store_blocked report', async () => {
    const { store, db, reports } = setup({}, { putFails: () => new Error('blocked') });
    const p = prep();
    const r = await store.stage([photo(1), photo(2)], async () => p);
    expect(r.durable).toBe(false);
    expect(r.items.every((i) => i.uri.startsWith('hearth-q:'))).toBe(true);
    expect(db.m.size).toBe(0);
    expect(Buffer.from((await store.open(r.items[0]!.uri))!.display)).toEqual(Buffer.from(p.display));
    expect(await store.has(r.items[1]!.uri)).toBe(true);
    expect(reports).toEqual(['upload_store_blocked']);
  });

  it('WEB-APP-33 WebCrypto/key unavailable (sealer says null): memory-only, and no unsealed bytes are ever handed to IndexedDB', async () => {
    const reports: string[] = [];
    const db = mapDb();
    const store = create({ db, sealer: xorSealer({ nullSeal: true }), report: (c) => { reports.push(c); } });
    const r = await store.stage([photo(1)], async () => prep());
    expect(r.durable).toBe(false);
    expect(db.m.size).toBe(0);
    expect(reports).toEqual(['upload_store_blocked']);
  });

  it('WEB-APP-33 QuotaExceededError: memory-only, one upload_store_full report (code only)', async () => {
    const quota = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    const { store, reports } = setup({}, { putFails: () => quota });
    const r = await store.stage([photo(1)], async () => prep());
    expect(r.durable).toBe(false);
    expect(reports).toEqual(['upload_store_full']);
  });

  it('WEB-APP-33 over the cap: the first post is kept, the second goes memory-only with upload_store_full; sharing is never refused', async () => {
    const one = prep(2000);
    const { store, db, reports } = setup({ capBytes: (one.display.length + one.thumb.length) * 2 });
    const a = await store.stage([photo(1)], async () => one);
    const b = await store.stage([photo(2), photo(3)], async () => one);
    expect(a.durable).toBe(true);
    expect(b.durable).toBe(false);
    expect(reports).toEqual(['upload_store_full']);
    expect(db.m.size).toBe(1);
    expect(await store.has(b.items[1]!.uri)).toBe(true);
  });
});

describe('HRT-WEB.3 deleting bytes (WEB-APP-32, ARCH-WEB-R4)', () => {
  it('WEB-APP-32 release removes the records (and memory copies) of the given uris and only those', async () => {
    const { store, db } = setup();
    const a = await store.stage([photo(1), photo(2)], async () => prep());
    const b = await store.stage([photo(3)], async () => prep());
    await store.release(a.items.map((i) => i.uri));
    expect(db.m.size).toBe(1);
    expect(await store.has(a.items[0]!.uri)).toBe(false);
    expect(await store.open(a.items[1]!.uri)).toBeNull();
    expect(await store.has(b.items[0]!.uri)).toBe(true);
  });

  it('WEB-APP-32 release also frees a memory-only post', async () => {
    const { store } = setup({}, { putFails: () => new Error('blocked') });
    const r = await store.stage([photo(1)], async () => prep());
    await store.release([r.items[0]!.uri]);
    expect(await store.has(r.items[0]!.uri)).toBe(false);
  });

  it('ARCH-WEB-R4 sweep deletes records no saved job points at (a crash between put and save) and keeps the live ones', async () => {
    const { store, db } = setup();
    const live = await store.stage([photo(1)], async () => prep());
    await store.stage([photo(2), photo(3)], async () => prep()); // never saved by any job
    await store.sweep([live.items[0]!.uri]);
    expect([...db.m.keys()]).toEqual([live.items[0]!.uri.replace('hearth-q:', '')]);
  });

  it('WEB-APP-32 wipe (sign-out) deletes the whole database and every memory copy', async () => {
    const { store, db } = setup();
    const r = await store.stage([photo(1)], async () => prep());
    const mem = setup({}, { putFails: () => new Error('blocked') });
    const m = await mem.store.stage([photo(2)], async () => prep());
    await store.wipe();
    await mem.store.wipe();
    expect(db.wiped).toBe(1);
    expect(db.m.size).toBe(0);
    expect(await store.has(r.items[0]!.uri)).toBe(false);
    expect(await mem.store.has(m.items[0]!.uri)).toBe(false);
  });
});

describe('HRT-WEB.3 sign-out during stage (PRIV-WEB3-R1)', () => {
  it('PRIV-WEB3-R1 a sign-out (sealer clear + wipe) that lands during stage() leaves no sealed record in hearth.uploads and mints no new session key', async () => {
    const handed: CryptoKey[] = [];
    let kept: CryptoKey | null = null;
    const keys = { get: async () => kept, put: async (k: CryptoKey) => { kept = k; handed.push(k); }, delete: async () => { kept = null; } };
    const sealer = createSecureSessionStorage({ keys });
    expect(await sealer.sealBytes('q.warm/0/display', new Uint8Array(8))).not.toBeNull(); // a signed-in visit: one key exists
    expect(handed).toHaveLength(1);

    const db = mapDb();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const realKeys = db.keys;
    db.keys = async () => { await gate; return realKeys(); }; // stage() is held inside scan(), before any seal or put
    const store = create({ db, sealer, report: () => {} });

    const staging = store.stage([photo(1)], async () => prep()).catch(() => undefined);
    await new Promise((r) => setTimeout(r, 0));
    await sealer.clear(); // sign-out lands now: key deleted
    await store.wipe();
    release();
    await staging;

    expect(db.m.size).toBe(0); // no sealed record written after the wipe
    expect(handed).toHaveLength(1); // no new key minted by the in-flight sealBytes
    expect(kept).toBeNull(); // and none left behind
  });
});
