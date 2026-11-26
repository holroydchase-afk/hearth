// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// HRT-WEB.3 (docs/product/SPEC-WEB-APP.md): the queue on the web. Found Nov 25 (B-WEB3-1, P1): a saved job's item `uri`
// is a blob: URL that dies with the page, so after Chrome closes the job retries forever as "Sending…".
//
// The contract these tests hold the build to (upload/queue.ts, platform-blind):
//   QueueDeps.store?: {
//     has(uri): Promise<boolean>              is this item's saved copy still there?   (uploadStore.web.ts has())
//     release(job: Job): Promise<void> | void called when a job publishes and from remove(), never otherwise
//     sweep(liveUris: string[]): Promise<void> records no saved job points at go (ARCH-WEB-R4)
//   }
//   UploadQueue.open() runs, BEFORE its first kick(): sweep(uris of every unpublished job's items), then fails any
//   unpublished job (WEB-APP-31) whose item uri is a blob:/data: URL or whose copy `has` says is gone. Such a job is
//   state 'failed' (words "Didn't send": Remove only) with one code-only error report. No store dep: no change.
import { type HearthApi } from '../../api/HearthApi';
import { FakeBackend, FIXTURE } from '../../api/fake/FakeBackend';
import { encryptedSize } from '../../crypto/media';
import { memoryKV } from '../../platform/kv';
import { UploadQueue, STORAGE_KEY, jobLabel, type Job, type Prepared, type QueueDeps } from '../queue';

const CHASE = FIXTURE.users.chase.id;
const tick = () => new Promise((r) => setImmediate(r));
async function until(cond: () => boolean, tries = 5000) {
  for (let i = 0; i < tries && !cond(); i++) await tick();
  if (!cond()) throw new Error('condition never became true');
}

function prepared(): Prepared {
  const display = new Uint8Array(900).map((_, i) => (i * 13) & 0xff);
  const thumb = new Uint8Array(200).map((_, i) => (i * 3) & 0xff);
  return { spec: { kind: 'photo', mime_type: 'image/jpeg', width: 2048, height: 1536, duration_ms: null, byte_size: encryptedSize(display.length), thumb_byte_size: encryptedSize(thumb.length), exif_stripped: true }, display, thumb };
}

interface WebStore { has(uri: string): Promise<boolean>; release(job: Job): void | Promise<void>; sweep(live: string[]): Promise<void> }

function setup() {
  const be = FakeBackend.withFixture();
  const kv = memoryKV();
  const reports: unknown[] = [];
  const api: HearthApi = new Proxy(be.clientFor(CHASE), {
    get(t, p: string) {
      const v = (t as unknown as Record<string, unknown>)[p];
      if (p === 'reportClientError') return (r: unknown) => { reports.push(r); return Promise.resolve(); };
      return v;
    },
  }) as HearthApi;
  const here = new Set<string>();
  const store = { has: jest.fn(async (u: string) => here.has(u)), release: jest.fn(async () => {}), sweep: jest.fn(async () => {}) } satisfies WebStore;
  const prepare = jest.fn(async () => prepared());
  const deps = (extra: Partial<QueueDeps> = {}): QueueDeps => ({
    api, kv, userId: CHASE, prepare, setTimer: () => () => {}, ...extra,
  } as QueueDeps);
  const input = (uris: string[]) => ({ space: FIXTURE.space.id, caption: 'Mia at the park', circleIds: [FIXTURE.circles.dadSide.id], items: uris.map((uri) => ({ uri, kind: 'photo' as const })) });
  const live = () => Object.values(be.state.posts).filter((p) => p.author === CHASE && !p.deleted);
  /** Save a job the way an earlier visit would have (Chrome then closed): open, enqueue while sending can't progress, stop. */
  async function savedJob(uris: string[]) {
    const gate = new Promise<never>(() => {});
    const q1 = await UploadQueue.open({ ...deps({ prepare: () => gate }) });
    await q1.enqueue(input(uris));
    q1.stop();
    return JSON.parse((await kv.getItem(STORAGE_KEY))!) as Job[];
  }
  return { be, kv, reports, store, here, prepare, deps, input, live, savedJob };
}
const withStore = (s: WebStore): Partial<QueueDeps> => ({ store: s } as unknown as Partial<QueueDeps>);

describe('B-WEB3-1 / WEB-APP-31 a saved job whose bytes are gone ends as failed, not "Sending…" forever', () => {
  it('WEB-APP-31 an old blob: job (saved by the build before this PR) is failed at open, before anything is sent', async () => {
    const s = setup();
    await s.savedJob(['blob:http://127.0.0.1:8089/0b1c2d3e-0000-4000-8000-000000000001']);
    s.prepare.mockImplementation(async () => { throw new TypeError('Failed to fetch'); }); // what a dead blob: URL does
    const q = await UploadQueue.open(s.deps(withStore(s.store)));
    const [j] = q.jobs();
    expect(j!.state).toBe('failed'); // right after open(): R4, a dead job never shows "Sending…"
    expect(jobLabel(j!)).toBe("Didn't send");
    expect(s.prepare).not.toHaveBeenCalled();
    await q.idle();
    expect(s.live()).toHaveLength(0); // nothing was created on the server for it
  });

  it('WEB-APP-31 a hearth-q: job whose record is gone (cleared site data) is failed at open', async () => {
    const s = setup();
    await s.savedJob(['hearth-q:stage9/0', 'hearth-q:stage9/1']);
    s.here.add('hearth-q:stage9/0'); // one copy left, one gone: the post cannot be sent whole
    const q = await UploadQueue.open(s.deps(withStore(s.store)));
    expect(q.jobs()[0]!.state).toBe('failed');
    await q.idle();
    expect(s.prepare).not.toHaveBeenCalled();
  });

  it('WEB-APP-31 the failed job sends exactly one code-only error report (no blob: URL, no caption, no bytes)', async () => {
    const s = setup();
    await s.savedJob(['blob:http://127.0.0.1:8089/0b1c2d3e-0000-4000-8000-000000000002']);
    const q = await UploadQueue.open(s.deps(withStore(s.store)));
    await q.idle();
    await until(() => s.reports.length > 0);
    expect(s.reports).toHaveLength(1);
    const text = JSON.stringify(s.reports[0]);
    expect(text).not.toMatch(/blob:|http|Mia at the park|0b1c2d3e/);
    expect(s.reports[0]).toEqual(expect.objectContaining({ screen: 'upload' }));
  });

  it('WEB-APP-31 the person can still choose: Try again keeps the job (the plain retry/remove choice), Remove drops it and frees its bytes', async () => {
    const s = setup();
    await s.savedJob(['hearth-q:stage9/0']);
    const q = await UploadQueue.open(s.deps(withStore(s.store)));
    expect(q.jobs()[0]!.state).toBe('failed');
    const id = q.jobs()[0]!.id;
    q.remove(id);
    expect(q.jobs()).toHaveLength(0);
    expect(s.store.release).toHaveBeenCalledTimes(1);
  });

  it('WEB-APP-31 guard: a job whose copy is still there is untouched and publishes (not every reopen is a failure)', async () => {
    const s = setup();
    await s.savedJob(['hearth-q:stage1/0']);
    s.here.add('hearth-q:stage1/0');
    const q = await UploadQueue.open(s.deps(withStore(s.store)));
    await q.idle();
    expect(q.jobs()[0]!.state).toBe('published');
    expect(s.live()).toHaveLength(1);
  });

  it('WEB-APP-31 guard: real bad network with the copy present still waits and retries (not turned into a failure)', async () => {
    const s = setup();
    await s.savedJob(['hearth-q:stage1/0']);
    s.here.add('hearth-q:stage1/0');
    s.prepare.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
    const q = await UploadQueue.open(s.deps(withStore(s.store)));
    await q.idle();
    expect(q.jobs()[0]!.state).toBe('failed-retryable');
  });

  it('WEB-APP-31 guard: with no store dep (phones) a file:// job is exactly as before', async () => {
    const s = setup();
    await s.savedJob(['file:///a.jpg']);
    const q = await UploadQueue.open(s.deps());
    await q.idle();
    expect(q.jobs()[0]!.state).toBe('published');
  });

  it('ARCH-WEB-R4 open sweeps with the uris of unpublished jobs only, before the first send', async () => {
    const s = setup();
    await s.savedJob(['hearth-q:stage1/0', 'hearth-q:stage1/1']);
    s.here.add('hearth-q:stage1/0'); s.here.add('hearth-q:stage1/1');
    const order: string[] = [];
    s.store.sweep.mockImplementation(async () => { order.push('sweep'); });
    s.prepare.mockImplementation(async () => { order.push('prepare'); return prepared(); });
    const q = await UploadQueue.open(s.deps(withStore(s.store)));
    await q.idle();
    expect(s.store.sweep).toHaveBeenCalledWith(['hearth-q:stage1/0', 'hearth-q:stage1/1']);
    expect(order[0]).toBe('sweep');
  });
});

describe('WEB-APP-32 bytes are released when a post is done', () => {
  it('WEB-APP-32 release(job) is called once when the job publishes, with that job (its items name what to delete)', async () => {
    const s = setup();
    for (const u of ['hearth-q:s1/0', 'hearth-q:s1/1']) s.here.add(u);
    const q = await UploadQueue.open(s.deps(withStore(s.store)));
    await q.enqueue(s.input(['hearth-q:s1/0', 'hearth-q:s1/1']));
    await q.idle();
    expect(q.jobs()[0]!.state).toBe('published');
    expect(s.store.release).toHaveBeenCalledTimes(1);
    const job = (s.store.release.mock.calls[0] as unknown as [Job])[0];
    expect(job.items.map((i) => i.uri)).toEqual(['hearth-q:s1/0', 'hearth-q:s1/1']);
  });

  it('WEB-APP-32 remove(id) of a waiting job releases its bytes; a job that is only retrying is NOT released', async () => {
    const s = setup();
    s.here.add('hearth-q:s2/0');
    s.prepare.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
    const q = await UploadQueue.open(s.deps(withStore(s.store)));
    await q.enqueue(s.input(['hearth-q:s2/0']));
    await q.idle();
    expect(q.jobs()[0]!.state).toBe('failed-retryable');
    expect(s.store.release).not.toHaveBeenCalled(); // still needed to retry
    q.remove(q.jobs()[0]!.id);
    expect(s.store.release).toHaveBeenCalledTimes(1);
  });
});

describe('WEB-APP-29 what the job JSON holds in localStorage', () => {
  it('WEB-APP-29 a staged web post is saved as hearth-q: uris only: no blob: or data: URI and no bytes in the queue JSON', async () => {
    const uploadStore = require('../../platform/uploadStore.web') as object;
    const create = (uploadStore as unknown as { createUploadStore?: (o: unknown) => { stage(i: unknown[], p: () => Promise<Prepared>): Promise<{ items: { uri: string }[] }> } }).createUploadStore;
    if (typeof create !== 'function') throw new Error('platform/uploadStore.web.ts does not export createUploadStore({ db, sealer, report })');
    const m = new Map();
    const store = create({
      db: { get: async (k: string) => m.get(k), put: async (k: string, r: unknown) => { m.set(k, r); }, delete: async (k: string) => { m.delete(k); }, keys: async () => [...m.keys()], wipe: async () => m.clear() },
      sealer: { sealBytes: async (_n: string, b: Uint8Array) => b.slice().reverse(), openBytes: async (_n: string, b: Uint8Array) => b.slice().reverse() },
      report: () => {},
    });
    const s = setup();
    const { items } = await store.stage([{ uri: 'blob:http://127.0.0.1:8089/abc', kind: 'photo' }], async () => {
      const display = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
      return { ...prepared(), display, thumb: display };
    });
    const q = await UploadQueue.open(s.deps({ prepare: () => new Promise<Prepared>(() => {}) }));
    await q.enqueue({ ...s.input([]), items: items as never });
    const json = (await s.kv.getItem(STORAGE_KEY))!;
    expect(json).toContain('hearth-q:');
    expect(json).not.toMatch(/blob:|data:/);
    q.stop();
  });
});
