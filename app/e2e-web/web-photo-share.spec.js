// HRT-WEB.3 (docs/product/SPEC-WEB-APP.md, WEB-APP-25..34): photo sharing on the web, on the real web bundle in real
// Chromium (real IndexedDB and WebCrypto, Fake backend), 360 × 740, with real GPS-tagged JPEGs (made-up place; see
// scripts/make-web-photo-fixtures.py). The Fake backend keeps its family in localStorage, so a new page in the same
// browser context sees the same family: that is how "Chrome was closed" is played (WEB-APP-30).
//
// What these tests expect from the build (architect call, Nov 25):
//   IndexedDB database `hearth.uploads`, object store `items`, one record per photo { v: 1, spec, display, thumb }
//   (each a sealed Uint8Array); the queue job's item uri is `hearth-q:<stageId>/<index>`; localStorage's
//   `hearth.uploadQueue.v1` holds only job JSON.
const path = require('path');
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

const GPS = path.join(__dirname, 'fixtures', 'web3-gps.jpg');
const ROTATED = path.join(__dirname, 'fixtures', 'web3-rotated.jpg');
const QUEUE_KEY = 'hearth.uploadQueue.v1';
const FAKE_FAMILY_KEY = 'hearth.fakeBackend.v1';
/** What the fixtures carry that must never leave the phone (scripts/make-web-photo-fixtures.py). */
const MARKERS = ['HRTMAKERNOTE-9F3A', 'HRTSERIAL-0042', 'HRTMADEUPPLACE-77', 'ns.adobe.com/xap', 'HrtMakeCo', 'HrtModel', 'Exif\0\0'];

async function signIn(page, email = 'chase@example.com') {
  await page.goto('/sign-in');
  await page.getByLabel('Your email').fill(email);
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await page.getByLabel('6-number code').fill('123456');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
}

async function pickAndSend(page, file, note) {
  await page.getByRole('tab', { name: 'Share' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /^Add photos, up to \d+ at a time$/ }).click();
  await (await chooser).setFiles(file);
  await page.getByLabel('Add a note (optional)').fill(note);
  await page.getByLabel(/^Grandparents – Dad's side, 2 people, not picked$/).click();
  await page.getByRole('button', { name: /^Send to / }).click();
}

/** Stop the Fake backend taking uploads (a bad connection), and record each sign-media spec it is asked for. */
const holdUploads = (page) => page.evaluate(() => {
  const be = globalThis.__hearthFake;
  globalThis.__specs = [];
  const sign = be.signUpload.bind(be);
  be.signUpload = (u, p, items) => { globalThis.__specs.push(items); return sign(u, p, items); };
  be.putObject = () => { throw new TypeError('Failed to fetch'); };
});
const recordSpecs = (page) => page.evaluate(() => {
  const be = globalThis.__hearthFake;
  globalThis.__specs = [];
  const sign = be.signUpload.bind(be);
  be.signUpload = (u, p, items) => { globalThis.__specs.push(items); return sign(u, p, items); };
});

const queueJobs = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '[]'), QUEUE_KEY);

/** Every record of every IndexedDB database of the page, as { db, store, record } (Uint8Arrays kept as latin1 strings). */
const idbDump = (page) => page.evaluate(async () => {
  const out = [];
  const flat = (v, d = 0) => {
    if (v instanceof Uint8Array) return { bytes: Array.from(v, (c) => String.fromCharCode(c)).join(''), len: v.length, first: [v[0], v[1]] };
    if (v && typeof v === 'object' && d < 4 && !(typeof CryptoKey !== 'undefined' && v instanceof CryptoKey)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, flat(x, d + 1)]));
    return v;
  };
  for (const { name } of (indexedDB.databases ? await indexedDB.databases() : [])) {
    const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    for (const store of Array.from(db.objectStoreNames)) {
      const all = await new Promise((res, rej) => { const r = db.transaction(store, 'readonly').objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      for (const record of all) out.push({ db: name, store, record: flat(record) });
    }
    db.close();
  }
  return out;
});

/** The published post's display and thumb, decrypted in the page with the data key (single 64 KB chunk: fixtures are tiny). */
const sentBytes = (page, caption) => page.evaluate(async (cap) => {
  const be = globalThis.__hearthFake;
  const post = Object.values(be.state.posts).find((p) => p.caption === cap && !p.deleted);
  const m = Object.values(be.state.media).find((x) => x.post === post.id);
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', b64(m.dek), 'AES-GCM', false, ['decrypt']);
  const open = async (ct) => {
    if (ct.length > 65536 + 28) throw new Error('fixture grew past one chunk');
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ct.subarray(0, 12) }, key, ct.subarray(12)));
    return plain;
  };
  const sof = (p) => { for (let i = 2; i < p.length - 9;) { if (p[i] !== 0xff) { i++; continue; } const mk = p[i + 1]; if (mk >= 0xc0 && mk <= 0xc2) return { h: (p[i + 5] << 8) | p[i + 6], w: (p[i + 7] << 8) | p[i + 8] }; i += 2 + ((p[i + 2] << 8) | p[i + 3]); } return null; };
  const d = await open(b64(be.state.objects[m.display_key]));
  const t = await open(b64(be.state.objects[m.thumb_key]));
  const str = (u) => Array.from(u, (c) => String.fromCharCode(c)).join('');
  return { display: str(d), thumb: str(t), displayStartsJpeg: d[0] === 0xff && d[1] === 0xd8, thumbStartsJpeg: t[0] === 0xff && t[1] === 0xd8, displaySof: sof(d), thumbSof: sof(t), mediaWidth: m.width, mediaHeight: m.height, posts: Object.values(be.state.posts).filter((p) => p.caption === cap && !p.deleted).length };
}, caption);

const livePosts = (page, caption) => page.evaluate((cap) => Object.values(globalThis.__hearthFake.state.posts).filter((p) => p.caption === cap && !p.deleted && p.status === 'published').length, caption);

test('WEB-APP-25 Share on the web opens Chrome\'s file chooser for images only, several at a time', async ({ page }) => {
  await signIn(page);
  await page.getByRole('tab', { name: 'Share' }).click();
  const chooser = page.waitForEvent('filechooser');
  const add = page.getByRole('button', { name: /^Add photos, up to \d+ at a time$/ }); // no "or videos" in the name
  await expect(add).toBeVisible();
  await add.click();
  const fc = await chooser;
  expect(fc.isMultiple()).toBe(true);
  const accept = await fc.element().evaluate((el) => el.getAttribute('accept') || '');
  expect(accept).toMatch(/image/);
  expect(accept).not.toMatch(/video/);
  const limit = Number((await add.getAttribute('aria-label') || (await add.innerText())).match(/up to (\d+)/)[1]);
  expect([10, 100]).toContain(limit); // 10 for a grandparent, 100 for a parent with Easy view off (DEC-79; spec says 10)
});

test('WEB-APP-26 a GPS-tagged JPEG goes through the web pipeline and what is sent has no Exif, GPS, XMP or MakerNote', async ({ page }) => {
  await signIn(page);
  await recordSpecs(page);
  await pickAndSend(page, GPS, 'Pipeline check');
  await page.getByRole('tab', { name: /^Feed/ }).click();
  await expect(page.getByText('Pipeline check', { exact: true })).toBeVisible();
  const sent = await sentBytes(page, 'Pipeline check');
  expect(sent.displayStartsJpeg && sent.thumbStartsJpeg).toBe(true);
  for (const m of MARKERS) {
    expect({ part: 'display', marker: m, found: sent.display.includes(m) }).toEqual({ part: 'display', marker: m, found: false });
    expect({ part: 'thumb', marker: m, found: sent.thumb.includes(m) }).toEqual({ part: 'thumb', marker: m, found: false });
  }
  // The pipeline's own stage must have taken the photo before the job was saved: a web job never holds the raw blob: URL.
  const jobs = await queueJobs(page);
  expect(JSON.stringify(jobs)).not.toMatch(/blob:/);
});

test('WEB-APP-27 the spec sent to sign-media says JPEG, exif_stripped, within the shared media policy', async ({ page }) => {
  await signIn(page);
  await recordSpecs(page);
  await pickAndSend(page, GPS, 'Spec check');
  await page.getByRole('tab', { name: /^Feed/ }).click();
  await expect(page.getByText('Spec check', { exact: true })).toBeVisible();
  const specs = (await page.evaluate(() => globalThis.__specs)).flat();
  expect(specs).toHaveLength(1);
  const s = specs[0];
  expect(s).toEqual(expect.objectContaining({ kind: 'photo', mime_type: 'image/jpeg', exif_stripped: true }));
  expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(2048);
  expect(s.thumb_byte_size - 28).toBeLessThanOrEqual(48 * 1024); // MEDIA_POLICY thumb max (SPEC-MEDIA 1.2); 28 = AES-GCM chunk overhead
});

test('WEB-APP-28 a photo with EXIF orientation 6 is shared upright (width and height swapped against the raw pixels)', async ({ page }) => {
  await signIn(page);
  await recordSpecs(page);
  await pickAndSend(page, ROTATED, 'Upright check'); // raw pixels 600 x 400
  await page.getByRole('tab', { name: /^Feed/ }).click();
  await expect(page.getByText('Upright check', { exact: true })).toBeVisible();
  const sent = await sentBytes(page, 'Upright check');
  expect({ w: sent.mediaWidth, h: sent.mediaHeight }).toEqual({ w: 400, h: 600 });
  expect(sent.displaySof).toEqual({ w: 400, h: 600 });
  expect(sent.thumbSof.h).toBeGreaterThan(sent.thumbSof.w);
});

test('WEB-APP-29 a queued post: no original bytes or GPS in localStorage or IndexedDB; only sealed, cleaned bytes under hearth.uploads', async ({ page }) => {
  await signIn(page);
  await holdUploads(page);
  await pickAndSend(page, GPS, 'Held post');
  await expect.poll(async () => (await queueJobs(page)).length).toBe(1);

  const ls = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
  const job = JSON.parse(ls[QUEUE_KEY])[0];
  expect(job.items.map((i) => i.uri)).toEqual([expect.stringMatching(/^hearth-q:[^/]+\/0$/)]);
  for (const [k, v] of Object.entries(ls)) {
    if (k === FAKE_FAMILY_KEY) continue; // the Fake backend's own family file (the real backend has none)
    expect({ k, blob: /blob:|data:/.test(v), jpegB64: v.includes('/9j/'), marker: MARKERS.some((m) => v.includes(m)) }).toEqual({ k, blob: false, jpegB64: false, marker: false });
  }

  const dump = await idbDump(page);
  const items = dump.filter((r) => r.db === 'hearth.uploads' && r.store === 'items');
  expect(items).toHaveLength(1);
  const rec = items[0].record;
  expect(rec.v).toBe(1);
  for (const part of ['display', 'thumb', 'spec']) {
    expect(typeof rec[part].bytes).toBe('string'); // a Uint8Array, not base64 text
    expect(rec[part].first).not.toEqual([0xff, 0xd8]); // sealed: not a JPEG
  }
  for (const r of dump) for (const m of MARKERS) expect(JSON.stringify(r.record)).not.toContain(JSON.stringify(m).slice(1, -1));
  // ARCH-WEB-R1: still one sealing key in all of IndexedDB.
  const keyDump = dump.filter((r) => r.store === 'keys');
  expect(keyDump).toHaveLength(1);
});

test('WEB-APP-30 Chrome is closed before the upload finishes: a new page publishes the post once, with no second pick', async ({ page, context }) => {
  await signIn(page);
  await holdUploads(page);
  await pickAndSend(page, GPS, 'Survives closing');
  await expect.poll(async () => (await queueJobs(page))[0]?.state).toBe('failed-retryable');
  const before = (await queueJobs(page))[0];
  await page.close();

  const page2 = await context.newPage();
  await page2.goto('/');
  await expect(page2.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  await expect.poll(() => livePosts(page2, 'Survives closing'), { timeout: 25_000 }).toBe(1);
  await page2.getByRole('tab', { name: /^Feed/ }).click();
  await expect(page2.getByText('Survives closing', { exact: true })).toHaveCount(1);
  // One post only: the restart path may replace the draft, but never leaves two live posts.
  const sent = await sentBytes(page2, 'Survives closing');
  expect(sent.posts).toBe(1);
  expect(sent.display).not.toContain('HRTMADEUPPLACE-77');
  expect(before.items[0].uri).toMatch(/^hearth-q:/);
});

test('WEB-APP-32 a published post leaves nothing in hearth.uploads', async ({ page }) => {
  await signIn(page);
  await pickAndSend(page, GPS, 'Cleaned up');
  await page.getByRole('tab', { name: /^Feed/ }).click();
  await expect(page.getByText('Cleaned up', { exact: true })).toBeVisible();
  await expect.poll(async () => (await idbDump(page)).filter((r) => r.db === 'hearth.uploads' && r.store === 'items').length).toBe(0);
});

test('WEB-APP-32 sign-out deletes every queued byte (the whole hearth.uploads database)', async ({ page }) => {
  await signIn(page);
  await holdUploads(page);
  await pickAndSend(page, GPS, 'Held for sign-out');
  await expect.poll(async () => (await idbDump(page)).filter((r) => r.db === 'hearth.uploads').length).toBe(1);
  await page.getByRole('tab', { name: /^More/ }).click();
  await page.getByRole('button', { name: /^Me(,|$)/ }).click();
  await page.getByRole('button', { name: 'Sign out of Hearth' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('Welcome to Hearth')).toBeVisible();
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  expect(dbs).not.toContain('hearth.uploads');
});

test('B-WEB3-1 / WEB-APP-31 an old job with a dead blob: URL shows "Didn\'t send" with Try again / Remove, never "Sending…" forever', async ({ page }) => {
  await signIn(page);
  const uid = await page.evaluate(() => globalThis.__hearthFake.state.appSession);
  await page.evaluate(({ k, uid }) => {
    const be = globalThis.__hearthFake;
    const space = Object.keys(be.state.spaces)[0];
    const circle = Object.values(be.state.circles).find((c) => c.space === space && !c.deleted).id;
    localStorage.setItem(k, JSON.stringify([{
      id: 'old-job-1', userId: uid, clientId: 'old-client-1', space, caption: 'Left over', circleIds: [circle],
      items: [{ uri: 'blob:http://127.0.0.1:8089/0b1c2d3e-0000-4000-8000-0000000000aa', kind: 'photo' }],
      state: 'uploading', attempts: 0, restarts: 0, progress: { done: 0, total: 1 }, createdAt: Date.now(),
    }]));
  }, { k: QUEUE_KEY, uid });
  await page.reload();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Share' }).click();
  await expect(page.getByText(/Didn't send/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Sending…/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Try again/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Remove/ })).toBeVisible();
});

test('WEB-APP-33 with IndexedDB blocked the photo still sends, nothing is written in plain text, and Share says once that closing Chrome will stop it', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get: () => undefined, configurable: true }); });
  await signIn(page);
  await holdUploads(page); // keep it waiting so the line is on screen while it is not finished
  await pickAndSend(page, GPS, 'No storage');
  // grandparent-ux's words are not final; this asks only for the meaning: closing Chrome before it finishes will stop it.
  await expect(page.getByText(/clos\w+ (Chrome|this page|the app)[^.]*(stop|finish|before)/i)).toHaveCount(1);
  const ls = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
  for (const [k, v] of Object.entries(ls)) {
    if (k === FAKE_FAMILY_KEY) continue;
    expect({ k, blob: /blob:|data:/.test(v), jpegB64: v.includes('/9j/') }).toEqual({ k, blob: false, jpegB64: false });
  }
  // and it does send while the page stays open
  await page.evaluate(() => { const be = globalThis.__hearthFake; delete be.putObject; });
  await expect.poll(() => livePosts(page, 'No storage'), { timeout: 60_000 }).toBe(1);
});
