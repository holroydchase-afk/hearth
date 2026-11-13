// DEMO-5 (RR-5): the hosted demo works under /demo/hearth/ on a static host (GitHub Pages rules):
// the first page, a cold load of each tab's address, the pictures, and no failed requests.
const { test, expect } = require('../../e2e/node_modules/@playwright/test');
// PAGES-1: the same checks run under GitHub Pages' path (SITE_BASE=/hearth) as under the portfolio's /demo/hearth.
const BASE = process.env.SITE_BASE || '/demo/hearth';
const baseRe = BASE.replace(/[/]/g, '\\/');

// DEMO-BAR: Grandma's view and Reset live in the Details drawer.
const details = async (page) => {
  const t = page.getByRole('button', { name: 'Demo details' });
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
};
const resetDemo = async (page) => {
  await details(page);
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
};

for (const tab of ['', 'photos', 'share', 'groups', 'me']) {
  test(`DEMO-5 a cold load of ${BASE}/${tab} works with no server fallback`, async ({ page, baseURL }) => {
    const failed = [];
    // ARCH-R3: only the demo's own files count; an outside script (Umami, when it's on) can't fail this.
    const own = (u) => u.startsWith(`${baseURL}${BASE}/`);
    page.on('response', (r) => { if (r.status() >= 400 && own(r.url())) failed.push(`${r.status()} ${r.url()}`); });
    page.on('pageerror', (e) => failed.push(String(e)));
    await page.goto(`${BASE}/${tab}`);
    await expect(page.getByRole('button', { name: 'Demo details' })).toBeVisible();
    if (tab === '' || tab === 'photos') {
      await expect(page.getByText('Mia turned 5!', { exact: true })).toBeVisible();
      await expect.poll(() => page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length)).toBeGreaterThan(0);
    }
    expect(failed).toEqual([]);
  });
}

test(`DEMO-5 every link inside the demo stays under ${BASE}/ or goes to chaseholroyd.com`, async ({ page }) => {
  await page.goto(`${BASE}/`);
  await expect(page.getByText('Mia turned 5!', { exact: true })).toBeVisible();
  const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
  for (const h of hrefs) expect(h.startsWith(BASE) || h.startsWith('https://chaseholroyd.com')).toBe(true);
});

test(`DEMO-5 Grandma's view and Start over stay inside ${BASE}/`, async ({ page }) => {
  await page.goto(`${BASE}/`);
  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await details(page);
  await expect(page.getByText(/You're Grandma Jo/)).toBeVisible();
  expect(new URL(page.url()).pathname).toMatch(new RegExp(`^${baseRe}\\/photos\\/?$`));
  await resetDemo(page);
  await expect(page.getByText(/You're Kai, a parent/)).toBeVisible();
  expect(new URL(page.url()).pathname).toMatch(new RegExp(`^${baseRe}\\/`));
});

test('RR-15 reloading an open full-screen photo on the static host keeps the photo open', async ({ page }) => {
  await page.goto(`${BASE}/`);
  await page.getByRole('button', { name: /Open photo 1 of/ }).first().click();
  await expect(page.getByRole('button', { name: 'Save to my phone' })).toBeVisible();
  const status = (await page.reload()).status();
  expect(status).toBe(200);
  await expect(page.getByRole('button', { name: 'Save to my phone' })).toBeVisible();
});

// DEMO-LIVE-2/3: the two newest things a visitor tries also work on the static host (and, with SITE_URL, live).
test('DEMO-LIVE-2 Search for "lake" finds the one lake photo', async ({ page }) => {
  await page.goto(`${BASE}/`);
  await expect(page.getByText('Mia turned 5!', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Search/ }).first().click();
  const box = page.getByRole('textbox').first();
  await box.fill('lake');
  await box.press('Enter');
  await expect(page.getByText('Found 1 photo', { exact: true })).toBeVisible();
});

test('DEMO-LIVE-3 All photos opens the wall with month headings', async ({ page }) => {
  await page.goto(`${BASE}/`);
  await expect(page.getByText('Mia turned 5!', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /All photos|three to a row/ }).first().click();
  await expect(page.getByText(/^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to Photos' }).first()).toBeVisible();
});

// DEMO-LIVE-4 (ARCH-R1): the build says which commit it is, so the live check waits for the new copy.
test('DEMO-LIVE-4 the build serves version.txt naming its commit', async ({ request }) => {
  const r = await request.get(`${BASE}/version.txt`);
  expect(r.status()).toBe(200);
  expect((await r.text()).trim()).toMatch(/^([0-9a-f]{40}|local)$/);
});

// DEMO-NEW-5 (R45 step 2): a first-time visitor lands on the New for you card and can walk the new photos.
test('DEMO-NEW-5 a first visit opens on New for you, and Next walks the new photos', async ({ page }) => {
  await page.goto(`${BASE}/`);
  const see = page.getByRole('button', { name: /See the new photos/ });
  await expect(see).toBeVisible();
  await see.click();
  await expect(page.getByText('New photos: 1 of 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Next/ }).first().click();
  await expect(page.getByText('New photos: 2 of 2', { exact: true })).toBeVisible();
});

// DEMO-META-2: a shared link has a preview: the tags are on the page and the picture is served.
test('DEMO-META-2 the page carries link-preview tags and serves the preview picture', async ({ page, request }) => {
  await page.goto(`${BASE}/`);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og-hearth\.png$/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /private family photo app/);
  const r = await request.get(`${BASE}/og-hearth.png`);
  expect(r.status()).toBe(200);
  expect(r.headers()['content-type']).toMatch(/image\/png/);
});
