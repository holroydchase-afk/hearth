// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// HRT-WEB.2 WEB-APP-18 (docs/product/SPEC-WEB-APP.md): the manifest and icons resolve when Hearth is served under a
// sub-path (HEARTH_BASE_URL, the static demo build from scripts/build-demo.sh, served by serve-static.js with no
// fallback). Runs in the site config (npm run e2e:site); the plain e2e:demo build has no sub-path to test.
// Written first (red) by qa-tdd, Nov 24.
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

const BASE = process.env.SITE_BASE || '/demo/hearth';

for (const at of ['', 'feed/']) test(`WEB-APP-18${at ? ' QA-R1' : ''} under ${BASE}/${at} the manifest link, the manifest and every icon resolve, with no root-absolute path`, async ({ page, request }) => {
  await page.goto(`${BASE}/${at}`); // QA-R1: build-demo.sh copies index.html into each route's folder
  const href = await page.locator('link[rel="manifest"]').getAttribute('href', { timeout: 5000 }).catch(() => null);
  expect(href, 'index.html has a manifest link').not.toBeNull();
  expect(href, 'no other origin').not.toMatch(/^[a-z]+:|^\/\//i);
  if (href.startsWith('/')) expect(href, 'a root-absolute link must stay under the sub-path').toMatch(new RegExp(`^${BASE}/`));
  const manifestUrl = new URL(href, page.url()).href;
  expect(manifestUrl).toBe(new URL(`${BASE}/manifest.webmanifest`, page.url()).href);
  const res = await request.get(manifestUrl);
  expect(res.status()).toBe(200);
  const m = JSON.parse(await res.text());
  for (const key of ['start_url', 'scope']) {
    expect(m[key], `${key} is relative`).not.toMatch(/^\/|^[a-z]+:/i);
    expect(new URL(m[key], manifestUrl).href).toBe(new URL(`${BASE}/`, page.url()).href);
  }
  expect((m.icons || []).length).toBeGreaterThanOrEqual(3);
  for (const icon of m.icons) {
    expect(icon.src, 'icon paths are relative').not.toMatch(/^\/|^[a-z]+:/i);
    const r = await request.get(new URL(icon.src, manifestUrl).href);
    expect({ src: icon.src, status: r.status() }).toEqual({ src: icon.src, status: 200 });
  }
});
