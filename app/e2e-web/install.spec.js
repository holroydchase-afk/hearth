// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// HRT-WEB.2 (docs/product/SPEC-WEB-APP.md): add to home screen. The web manifest, its icons and the tags in
// index.html, on the real fake-backend export (dist-fake) served by scripts/serve-dist.js, in real Chromium.
// Written first (red) by qa-tdd, Nov 24: no manifest, icons or theme-color exist yet.
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

const PAPER = '#F7F7F4';
const PAPER_DARK = '#131210';

/** The manifest as served, or null when the server answers with something that isn't one. */
async function fetchManifest(request) {
  const res = await request.get('/manifest.webmanifest');
  const type = res.headers()['content-type'] || '';
  let json = null;
  try { json = JSON.parse(await res.text()); } catch { json = null; }
  return { status: res.status(), type, json };
}

/** Real pixel size of a PNG fetched by the page (the browser decodes it). */
function pngSize(page, url) {
  return page.evaluate(async (u) => {
    const r = await fetch(u);
    const blob = await r.blob();
    const bmp = await createImageBitmap(blob);
    return { status: r.status, type: r.headers.get('content-type'), width: bmp.width, height: bmp.height };
  }, url);
}

test('WEB-APP-13 index.html has one manifest link, a light and a dark theme-color, and the viewport meta', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const manifests = html.match(/<link\b[^>]*\brel=["']manifest["'][^>]*>/gi) || [];
  expect(manifests).toHaveLength(1);
  expect(manifests[0]).toMatch(/\bhref=["']\/manifest\.webmanifest["']/); // root-relative to the base path, so nested routes resolve it (QA-R1); the site build rewrites it (WEB-APP-18)
  const themes = (html.match(/<meta\b[^>]*\bname=["']theme-color["'][^>]*>/gi) || []).map((t) => ({
    content: (t.match(/\bcontent=["']([^"']+)["']/i) || [])[1]?.toUpperCase(),
    media: (t.match(/\bmedia=["']([^"']+)["']/i) || [])[1]?.replace(/\s+/g, ''),
  }));
  expect(themes).toEqual(expect.arrayContaining([
    { content: PAPER, media: '(prefers-color-scheme:light)' },
    { content: PAPER_DARK, media: '(prefers-color-scheme:dark)' },
  ]));
  expect(html).toMatch(/<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no"\s*\/?>/);
  expect(html).toContain('<div id="root"></div>');
});

test('WEB-APP-14 the manifest is served as JSON: Hearth, standalone, relative start_url and scope, Paper colours', async ({ request }) => {
  const m = await fetchManifest(request);
  expect(m.status).toBe(200);
  expect(m.type).toMatch(/^application\/(manifest\+)?json/);
  expect(m.json).not.toBeNull();
  expect(m.json).toMatchObject({
    name: 'Hearth',
    short_name: 'Hearth',
    display: 'standalone',
    start_url: '.',
    scope: '.',
    background_color: PAPER,
    theme_color: PAPER,
  });
  expect(m.json.start_url).not.toContain('?'); // no tracking params (anchors A2/A3)
});

test('WEB-APP-15 the manifest icons: 192 and 512 PNG (any) and a 512 maskable PNG, each 200 at its real size', async ({ page, request }) => {
  const m = await fetchManifest(request);
  expect(m.json, 'manifest.webmanifest must be served as JSON first (WEB-APP-14)').not.toBeNull();
  const icons = m.json.icons || [];
  const has = (size, purpose) => icons.find((i) => i.type === 'image/png' && i.sizes === size && (i.purpose || 'any').split(/\s+/).includes(purpose));
  expect({ any192: !!has('192x192', 'any'), any512: !!has('512x512', 'any'), maskable512: !!has('512x512', 'maskable') })
    .toEqual({ any192: true, any512: true, maskable512: true });
  await page.goto('/');
  for (const icon of icons) {
    expect(icon.src, 'icon paths stay relative (WEB-APP-18)').not.toMatch(/^\/|^[a-z]+:/i);
    const got = await pngSize(page, new URL(icon.src, new URL('/manifest.webmanifest', page.url())).href);
    const [w, h] = icon.sizes.split('x').map(Number);
    expect({ src: icon.src, ...got }).toEqual({ src: icon.src, status: 200, type: 'image/png', width: w, height: h });
  }
});

test('WEB-APP-16 the maskable icon keeps its outer 10% ring solid Paper, so Android\'s crop never cuts the mark', async ({ page, request }) => {
  const m = await fetchManifest(request);
  expect(m.json, 'manifest.webmanifest must be served as JSON first (WEB-APP-14)').not.toBeNull();
  const maskable = (m.json.icons || []).find((i) => (i.purpose || '').split(/\s+/).includes('maskable'));
  expect(maskable, 'a maskable icon in the manifest (WEB-APP-15)').toBeTruthy();
  await page.goto('/');
  const off = await page.evaluate(async (src) => {
    const bmp = await createImageBitmap(await (await fetch(src)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
    const ring = Math.floor(bmp.width * 0.1);
    let bad = 0; let first = null;
    for (let y = 0; y < bmp.height; y++) for (let x = 0; x < bmp.width; x++) {
      if (x >= ring && x < bmp.width - ring && y >= ring && y < bmp.height - ring) continue;
      const i = (y * bmp.width + x) * 4;
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a !== 255 || Math.abs(r - 0xf7) > 1 || Math.abs(g - 0xf7) > 1 || Math.abs(b - 0xf4) > 1) { bad++; first ||= { x, y, r, g, b, a }; }
    }
    return { bad, first };
  }, new URL(maskable.src, new URL('/manifest.webmanifest', page.url())).href);
  expect(off).toEqual({ bad: 0, first: null });
});

test('WEB-APP-17 Chromium finds the export installable (no installability errors) with no service worker', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('#root')).not.toBeEmpty();
  const cdp = await context.newCDPSession(page);
  await expect.poll(async () => (await cdp.send('Page.getAppManifest')).url || '', { message: 'Chromium sees a manifest link' }).not.toBe('');
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
  expect(await page.evaluate(async () => (navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0))).toBe(0);
});

// QA-R1 (qa-tdd, Nov 24): a relative manifest href resolves against the page's address, so it must also work when
// the inviter is on a deeper screen (a reload of /more/easy-view, or a link that lands there) when they tap
// "Add to home screen". On a nested address `manifest.webmanifest` points at /more/manifest.webmanifest.
test('WEB-APP-17 QA-R1 Chromium still finds the manifest and the app installable from a nested address (/more/easy-view)', async ({ page, context }) => {
  await page.goto('/sign-in'); // signed in, so the app stays on the nested address instead of going to /sign-in
  await page.getByLabel('Your email').fill('chase@example.com');
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await page.getByLabel('6-number code').fill('123456');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  await page.goto('/more/easy-view');
  await expect(page.getByRole('heading', { name: 'Easy view' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/more/easy-view');
  const cdp = await context.newCDPSession(page);
  await expect.poll(async () => (await cdp.send('Page.getAppManifest')).url || '', { message: 'Chromium sees a manifest link' }).not.toBe('');
  const got = await cdp.send('Page.getAppManifest');
  expect({ url: got.url, errors: got.errors }).toEqual({ url: expect.stringMatching(/^http:\/\/127\.0\.0\.1:8089\/manifest\.webmanifest$/), errors: [] });
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
});
