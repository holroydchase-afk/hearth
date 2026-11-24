// DEMO-SAFARI-1..4 (Chase, Nov 21, iPhone Safari 390 px): "See it as Grandma Jo" did nothing on the public demo.
// Safari caps localStorage at 5 MB counted as UTF-16 (2 bytes a character). The demo saved its whole family,
// photo bytes included (~3.5M characters), under one key, so the save threw QuotaExceededError, was swallowed,
// and every reload reseeded as Chase. Chrome's quota is bigger, so demo.spec.js never saw it. Each test here
// installs Safari's quota before the page loads. Written first (red), Nov 21, by qa-tdd.
const path = require('path');
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

// Safari's rule: the whole origin's keys + values, at 2 bytes a character, must fit in 5 MB.
const safariQuota = () => {
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function setItem(k, v) {
    let chars = 0;
    for (let i = 0; i < this.length; i++) {
      const kk = this.key(i);
      if (kk !== k) chars += kk.length + (this.getItem(kk) || '').length;
    }
    chars += String(k).length + String(v).length;
    if (chars * 2 > 5 * 1024 * 1024) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    return orig.call(this, k, v);
  };
};

const details = async (page) => {
  const t = page.getByRole('button', { name: 'Demo details' });
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
};
const greeting = (page, who) => page.getByRole('heading', { name: new RegExp(`, ${who}$`) });
const galleryLoaded = async (page) => {
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length)).toBeGreaterThan(0);
};
const onFeed = async (page) => {
  await page.getByRole('tab', { name: /^Feed/ }).click();
  await expect(page.getByText(/First ride on the balance bike/).first().filter({ visible: true })).toBeVisible();
};
const FIXTURE = path.join(__dirname, 'fixtures', 'park-gps.jpg');
// Retargeted Nov 23 for the empty-postcard Share (SHARE-ST-8): same steps as demo.spec.js.
const ADD_PHOTOS = /^Add photos( or videos)?, up to \d+ at a time$/;
const openNewPost = async (page, files) => {
  await page.getByRole('tab', { name: /^Share/ }).click();
  await expect(page.getByRole('heading', { name: 'New post' })).toBeVisible();
  const chooser = page.waitForEvent('filechooser', { timeout: 15_000 });
  await page.getByRole('button', { name: ADD_PHOTOS }).filter({ visible: true }).first().click();
  await (await chooser).setFiles(files);
  await expect(page.getByRole('button', { name: 'Cancel this post' })).toBeVisible();
};

test.beforeEach(async ({ page }, info) => {
  // DEMO-SAFARI-4 measures what the demo tries to save, so it runs without the cap (a capped save never lands).
  if (!info.title.startsWith('DEMO-SAFARI-4')) await page.addInitScript(safariQuota);
});

test('DEMO-SAFARI-1 phone 390 px, Safari quota: Demo details, See it as Grandma Jo greets Jo; back to Kevin works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  // A fresh visitor taps as soon as the app shows, before the sample photos finish drawing.
  await expect(greeting(page, 'Kevin')).toBeVisible();
  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await expect(greeting(page, 'Grandma Jo')).toBeVisible();
  await details(page);
  await page.getByRole('button', { name: "Back to Kevin's view, the parent" }).click();
  await expect(greeting(page, 'Kevin')).toBeVisible();
});

test('DEMO-SAFARI-2 laptop 1280 px, Safari quota: Grandma Jo from the story panel, then back to Kevin', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await galleryLoaded(page);
  await expect(greeting(page, 'Kevin')).toBeVisible();
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await expect(greeting(page, 'Grandma Jo')).toBeVisible();
  await page.getByRole('button', { name: "Back to Kevin's view, the parent" }).click();
  await expect(greeting(page, 'Kevin')).toBeVisible();
});

test("DEMO-SAFARI-3 phone, Safari quota: Chase's new post to Dad's side survives a reload, and Grandma Jo sees it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await galleryLoaded(page);
  await openNewPost(page, [FIXTURE]);
  await page.getByLabel('Add a note (optional)').fill('Leaf pile');
  await page.getByLabel(/^Grandparents – Dad's side, \d+ people, not picked$/).click();
  await page.getByRole('button', { name: /^Send to / }).click();
  await onFeed(page);
  await expect(page.getByText('Leaf pile', { exact: true }).filter({ visible: true })).toBeVisible();
  await page.reload();
  await onFeed(page);
  await expect(page.getByText('Leaf pile', { exact: true }).filter({ visible: true })).toBeVisible();
  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await expect(greeting(page, 'Grandma Jo')).toBeVisible();
  await onFeed(page);
  await expect(page.getByText('Leaf pile', { exact: true }).filter({ visible: true })).toBeVisible();
});

test('DEMO-SAFARI-4 (no cap) after the demo loads, no localStorage key holds more than 200,000 characters', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  // The seed saves nothing until the sample family is complete; wait for the saved family to appear.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('hearth.fakeBackend.v1') !== null)).toBe(true);
  const big = await page.evaluate(() => Object.keys(localStorage)
    .map((k) => ({ k, chars: k.length + (localStorage.getItem(k) || '').length }))
    .filter((e) => e.chars > 200_000));
  expect(big).toEqual([]);
});
