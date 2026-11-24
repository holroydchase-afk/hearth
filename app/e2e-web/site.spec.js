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
// T33: switching who you are and Reset reload the page (async since #144); wait for the reloaded greeting before
// opening Details again, or the drawer opens on the old page and is lost in the reload.
const greeted = (page, who) => expect(page.getByRole('heading', { name: new RegExp(`^Good (morning|afternoon|evening), ${who}$`) })).toBeVisible();
const resetDemo = async (page) => {
  await details(page);
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await greeted(page, 'Kevin'); // DEMO-PHOTO-10 (DEC-82): the demo parent is Kevin
};

for (const tab of ['', 'photos', 'share', 'groups', 'me', 'help']) {
  test(`DEMO-5 a cold load of ${BASE}/${tab} works with no server fallback`, async ({ page, baseURL }) => {
    const failed = [];
    // ARCH-R3: only the demo's own files count; an outside script (Umami, when it's on) can't fail this.
    const own = (u) => u.startsWith(`${baseURL}${BASE}/`);
    page.on('response', (r) => { if (r.status() >= 400 && own(r.url())) failed.push(`${r.status()} ${r.url()}`); });
    page.on('pageerror', (e) => failed.push(String(e)));
    await page.goto(`${BASE}/${tab}`);
    await expect(page.getByRole('button', { name: 'Demo details' })).toBeVisible();
    if (tab === '' || tab === 'photos') {
      await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible(); // RD-18: Gallery shows photos, not captions
      await expect.poll(() => page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length)).toBeGreaterThan(0);
    }
    // B19 (QA-R1): the old Groups, Me and Help tabs land on that row under More.
    if (['groups', 'me', 'help'].includes(tab)) {
      await expect(page.getByRole('button', { name: 'Back to More' })).toBeVisible();
      // T17 (QA-R2): the row that opened is the one asked for, not just any row under More.
      const heading = { groups: 'Your groups', me: 'Me', help: 'Help' }[tab];
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      for (const other of ['Your groups', 'Me', 'Help'].filter((h) => h !== heading)) {
        await expect(page.getByRole('heading', { name: other, exact: true })).toHaveCount(0);
      }
      if (tab === 'groups') await expect(page.getByText(/Grandparents –|Dad's side|Mom's side/).first()).toBeVisible(); // DEC-49 allowed half: the demo's parent sees a group
    }
    expect(failed).toEqual([]);
  });
}

test(`DEMO-5 every link inside the demo stays under ${BASE}/ or goes to chaseholroyd.com`, async ({ page }) => {
  await page.goto(`${BASE}/`);
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible(); // RD-18: Gallery shows photos, not captions
  const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
  for (const h of hrefs) expect(h.startsWith(BASE) || h.startsWith('https://chaseholroyd.com')).toBe(true);
});

test(`DEMO-5 Grandma's view and Start over stay inside ${BASE}/`, async ({ page }) => {
  await page.goto(`${BASE}/`);
  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await greeted(page, 'Grandma Jo'); // T33
  await details(page);
  await expect(page.getByText(/You're Grandma Jo/)).toBeVisible();
  expect(new URL(page.url()).pathname).toMatch(new RegExp(`^${baseRe}\\/gallery\\/?$`));
  await resetDemo(page);
  await expect(page.getByText(/You're Kevin, a parent/)).toBeVisible(); // DEMO-PHOTO-10
  expect(new URL(page.url()).pathname).toMatch(new RegExp(`^${baseRe}\\/`));
});

test('RR-15 reloading an open full-screen photo on the static host keeps the photo open', async ({ page }) => {
  await page.goto(`${BASE}/`);
  await page.getByRole('button', { name: /^Open photo from / }).first().click(); // RD-18: a Gallery grid tile
  await expect(page.getByRole('button', { name: 'Save to my phone' })).toBeVisible();
  const status = (await page.reload()).status();
  expect(status).toBe(200);
  await expect(page.getByRole('button', { name: 'Save to my phone' })).toBeVisible();
});

// DEMO-LIVE-2/3: the two newest things a visitor tries also work on the static host (and, with SITE_URL, live).
// DEMO-PHOTO-8 (DEC-82): only post 1's title, "Apple blossoms at the orchard", says "orchard" (search reads title, caption, sender).
test('DEMO-LIVE-2 Search for "orchard" finds the one orchard post', async ({ page }) => {
  await page.goto(`${BASE}/`);
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible(); // RD-18: Gallery shows photos, not captions
  // RD-47 (Nov 17): the "Search photos" field under the greeting; the old top-right button until the live site is republished.
  await page.getByLabel('Search photos').or(page.getByRole('button', { name: /Search/ })).first().click();
  const box = page.getByRole('textbox').first();
  await box.fill('orchard');
  await box.press('Enter');
  await expect(page.getByText('Found 1 photo', { exact: true })).toBeVisible();
});

test('DEMO-LIVE-3 RD-18 Gallery is the wall: month headings and photo tiles on the first screen, no All photos button', async ({ page }) => {
  await page.goto(`${BASE}/`);
  await expect(page.getByText(/^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Open photo from / }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /All photos|three to a row/ })).toHaveCount(0);
});

// DEMO-LIVE-4 (ARCH-R1): the build says which commit it is, so the live check waits for the new copy.
test('DEMO-LIVE-4 the build serves version.txt naming its commit', async ({ request }) => {
  const r = await request.get(`${BASE}/version.txt`);
  expect(r.status()).toBe(200);
  expect((await r.text()).trim()).toMatch(/^([0-9a-f]{40}|local)$/);
});

// DEMO-NEW-5 (R45 step 2; RD-19..21): a first-time visitor lands on New for you and can walk the new photos.
test('DEMO-NEW-5 RD-21 a first visit opens on New for you; See all walks the new photos', async ({ page }) => {
  await page.goto(`${BASE}/`);
  await expect(page.getByText(/^From Alex (today|since \S+)$/)).toBeVisible(); // DEC-61: the sender line, no "Tap a photo to start"
  await expect(page.getByText('Tap a photo to start', { exact: true })).toHaveCount(0);
  const see = page.getByRole('button', { name: /^See all(?! the photos)/ });
  await expect(see).toBeVisible();
  await see.click();
  // DEMO-PHOTO-12 (DEC-82): one new post since the last visit, Alex's balance bike ride; it is the last step, so Done, no Next.
  await expect(page.getByText('New photos: 1 of 1', { exact: true })).toBeVisible();
  await expect(page.getByText(/First ride on the balance bike/).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next new photo' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Done/ }).first().click();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening), Kevin$/ })).toBeVisible();
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
