// HRT-WEB.1 (docs/product/SPEC-WEB-APP.md): staying signed in on the web, on the real web bundle in real Chromium
// (real IndexedDB and WebCrypto), 360 × 740. The fake build keeps its own session, but the messenger store goes
// through secureSessionStorage, so opening a chat writes sealed values and makes the IndexedDB key.
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

const GREETING = /^Good (morning|afternoon|evening)/; // RD-11: the Gallery heading

async function signIn(page, email) {
  await page.goto('/sign-in');
  await page.getByLabel('Your email').fill(email);
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await page.getByLabel('6-number code').fill('123456');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: GREETING })).toBeVisible();
}

async function openChat(page) {
  await page.getByRole('tab', { name: /^More/ }).click();
  await page.getByRole('button', { name: /^Messages(,|$)/ }).click();
  await page.getByRole('button', { name: "Open Grandparents – Dad's side" }).click();
  await expect(page.getByText('No messages yet. Say hello!')).toBeVisible({ timeout: 15000 });
}

async function signOut(page) {
  await page.getByRole('tab', { name: /^More/ }).click();
  await page.getByRole('button', { name: /^Me(,|$)/ }).click();
  await page.getByRole('button', { name: 'Sign out of Hearth' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('Welcome to Hearth')).toBeVisible();
}

/** Every CryptoKey held in any IndexedDB database of the page, described without its bytes. */
function cryptoKeysInIndexedDB(page) {
  return page.evaluate(async () => {
    const found = [];
    const walk = (v, depth = 0) => {
      if (!v || depth > 3) return;
      if (typeof CryptoKey !== 'undefined' && v instanceof CryptoKey) {
        found.push({ extractable: v.extractable, name: v.algorithm.name, length: v.algorithm.length });
      } else if (typeof v === 'object') for (const x of Object.values(v)) walk(x, depth + 1);
    };
    const dbs = indexedDB.databases ? await indexedDB.databases() : [];
    for (const { name } of dbs) {
      if (!name) continue;
      const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      for (const store of Array.from(db.objectStoreNames)) {
        const all = await new Promise((res, rej) => {
          const r = db.transaction(store, 'readonly').objectStore(store).getAll();
          r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
        });
        all.forEach((v) => walk(v));
      }
      db.close();
    }
    return found;
  });
}

/** localStorage entries written by the session store: anything but the fake backend's own family file. */
function sessionStoreEntries(page) {
  return page.evaluate(() => Object.keys(localStorage)
    .filter((k) => !k.startsWith('hearth.fakeBackend'))
    .map((k) => ({ k, v: localStorage.getItem(k) })));
}

test('WEB-APP-1 signed in on web, the page reloads: Gallery, still signed in, no sign-in screen', async ({ page }) => {
  await signIn(page, 'chase@example.com');
  await page.reload();
  await expect(page.getByRole('heading', { name: GREETING })).toBeVisible();
  await expect(page.getByText('Welcome to Hearth')).toHaveCount(0);
});

test('WEB-APP-2 the tab is closed and Hearth opened again in a new tab: still signed in', async ({ page, context }) => {
  await signIn(page, 'chase@example.com');
  await page.close();
  const again = await context.newPage();
  await again.goto('/');
  await expect(again.getByRole('heading', { name: GREETING })).toBeVisible();
  await expect(again.getByText('Welcome to Hearth')).toHaveCount(0);
});

test('WEB-APP-3 WEB-APP-4 in real Chromium the store writes only sealed values and keeps one non-extractable AES-GCM key in IndexedDB', async ({ page }) => {
  await signIn(page, 'chase@example.com');
  await openChat(page); // the messenger writes its identity through secureSessionStorage
  const entries = await sessionStoreEntries(page);
  const chat = entries.filter((e) => /chat\./.test(e.k));
  expect(chat.length).toBeGreaterThan(0);
  // nonce + ciphertext, base64; no JSON (and no MLS private keys) in plain text. Report keys only, never values.
  const sealed = (v) => /^[A-Za-z0-9+/]+={0,2}$/.test(v) && !/[{}"]/.test(v);
  expect(chat.filter((e) => !sealed(e.v)).map((e) => e.k)).toEqual([]);
  expect(await cryptoKeysInIndexedDB(page)).toEqual([{ extractable: false, name: 'AES-GCM', length: 256 }]);
  // The key never lands in localStorage as a JWK.
  expect(JSON.stringify(entries)).not.toMatch(/\\"kty\\"/);
});

test('WEB-APP-6 sign out removes the sealed store and the IndexedDB key, and a reload shows the sign-in screen', async ({ page }) => {
  await signIn(page, 'chase@example.com');
  await openChat(page);
  expect((await cryptoKeysInIndexedDB(page)).length).toBe(1);
  await signOut(page);
  expect((await sessionStoreEntries(page)).filter((e) => /chat\.|auth-token/.test(e.k))).toEqual([]);
  expect(await cryptoKeysInIndexedDB(page)).toEqual([]);
  await page.reload();
  await expect(page.getByText('Welcome to Hearth')).toBeVisible();
  await expect(page.getByRole('heading', { name: GREETING })).toHaveCount(0);
});

// SPEC-WEB-APP.md, HRT-WEB.1 done-when: "request navigator.storage.persist() after sign-in so Chrome is less likely
// to clear Hearth's storage". Counted in the page itself; the real persist() still runs.
test('HRT-WEB.1 persist: navigator.storage.persist() is requested after sign-in on web, not before', async ({ page }) => {
  await page.addInitScript(() => {
    window.__persistCalls = 0;
    const s = navigator.storage;
    if (s && typeof s.persist === 'function') {
      const real = s.persist.bind(s);
      s.persist = () => { window.__persistCalls += 1; return real(); };
    }
  });
  await page.goto('/sign-in');
  await expect(page.getByLabel('Your email')).toBeVisible();
  expect(await page.evaluate(() => window.__persistCalls)).toBe(0); // the sign-in screen asks for nothing yet
  await signIn(page, 'chase@example.com');
  await expect.poll(() => page.evaluate(() => window.__persistCalls), { timeout: 5000 }).toBeGreaterThan(0);
});
