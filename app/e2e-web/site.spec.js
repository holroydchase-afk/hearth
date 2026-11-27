// DEMO-5 (RR-5): the hosted demo works under /demo/hearth/ on a static host (GitHub Pages rules):
// the first page, a cold load of each tab's address, the pictures, and no failed requests.
const { test, expect } = require('../../e2e/node_modules/@playwright/test');
// PAGES-1: the same checks run under GitHub Pages' path (SITE_BASE=/hearth) as under the portfolio's /demo/hearth.
const BASE = process.env.SITE_BASE || '/demo/hearth';
const baseRe = BASE.replace(/[/]/g, '\\/');

// DEMO-BAR-HIDE-1: the public build (what demo-site.yml and the live check test) has no phone demo bar; only
// `npm run e2e:site` builds it on, and sets EXPO_PUBLIC_HEARTH_DEMO_BAR=1 for these specs too.
const BAR = process.env.EXPO_PUBLIC_HEARTH_DEMO_BAR === '1';
// DEMO-BAR: Grandma's view and Reset live in the Details drawer. With the bar off they are in the laptop story panel,
// always open, so there is nothing to open.
const details = async (page) => {
  if (!BAR) return;
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
  await greeted(page, 'Graham'); // DEMO-NAMES-5 (T45, Nov 24): the demo parent is Graham (was Kevin, DEC-82)
};

for (const tab of ['', 'photos', 'share', 'groups', 'me', 'help']) {
  test(`DEMO-5 a cold load of ${BASE}/${tab} works with no server fallback`, async ({ page, baseURL }) => {
    const failed = [];
    // ARCH-R3: only the demo's own files count; an outside script (Umami, when it's on) can't fail this.
    const own = (u) => u.startsWith(`${baseURL}${BASE}/`);
    page.on('response', (r) => { if (r.status() >= 400 && own(r.url())) failed.push(`${r.status()} ${r.url()}`); });
    page.on('pageerror', (e) => failed.push(String(e)));
    await page.goto(`${BASE}/${tab}`);
    await expect(page.getByRole('button', { name: 'Demo details' })).toHaveCount(BAR ? 1 : 0);
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

test(`DEMO-NAMES-5 DEMO-5 Grandma's view and Start over stay inside ${BASE}/`, async ({ page }) => {
  if (!BAR) await page.setViewportSize({ width: 1280, height: 800 }); // DEMO-BAR-HIDE-1: the story panel holds the controls
  await page.goto(`${BASE}/`);
  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await greeted(page, 'Grandma Jo'); // T33
  await details(page);
  await expect(page.getByText(/You're Grandma Jo/)).toBeVisible();
  expect(new URL(page.url()).pathname).toMatch(new RegExp(`^${baseRe}\\/gallery\\/?$`));
  await resetDemo(page);
  await expect(page.getByText(/You're Graham, a parent/)).toBeVisible(); // DEMO-PHOTO-10
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
test('DEMO-NAMES-5 DEMO-NEW-5 RD-21 a first visit opens on New for you; See all walks the new photos', async ({ page }) => {
  await page.goto(`${BASE}/`);
  await expect(page.getByText(/^From Eliza (today|since \S+)$/)).toBeVisible(); // DEC-61: the sender line, no "Tap a photo to start"
  await expect(page.getByText('Tap a photo to start', { exact: true })).toHaveCount(0);
  const see = page.getByRole('button', { name: /^See all(?! the photos)/ });
  await expect(see).toBeVisible();
  await see.click();
  // DEMO-PHOTO-12 (DEC-82): one new post since the last visit, Eliza's balance bike ride; it is the last step, so Done, no Next.
  await expect(page.getByText('New photos: 1 of 1', { exact: true })).toBeVisible();
  await expect(page.getByText(/First ride on the balance bike/).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next new photo' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Done/ }).first().click();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening), Graham$/ })).toBeVisible();
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

// DEMO-BAR-HIDE-1 (Chase, Nov 27): the public build (EXPO_PUBLIC_HEARTH_DEMO_BAR=0) has no demo bar on a phone, while the
// laptop story panel still has Grandma Jo and Reset. Runs on the public build (the default); skips under e2e:site.
test('DEMO-BAR-HIDE-1 a build with the bar off: no Demo details at 390 px, story panel keeps Grandma Jo and Reset at 1280 px', async ({ page }) => {
  test.skip(BAR, 'the bar-on build (npm run e2e:site) keeps the phone bar');
  await page.goto(`${BASE}/`);
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Demo details' })).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset demo' })).toBeVisible();
});

// DEMO-DRAWER-E2E-1..4: the bottom demo drawer the portfolio's top bar opens, on the public (bar off) build. The contract is
// window event 'hearth-demo-drawer' (toggles) -> documentElement.dataset.hearthDemoDrawer + 'hearth-demo-drawer-state'.
// Runs on the public build (the default); skips under e2e:site.
const toggleDrawer = (page) => page.evaluate(() => window.dispatchEvent(new Event('hearth-demo-drawer')));
const drawerDialog = (page) => page.getByRole('dialog', { name: 'Demo info' });
for (const width of [390, 1280]) {
  test(`DEMO-DRAWER-E2E-1 at ${width} px the portfolio event opens a dialog with Grandma Jo and Reset, and Esc closes it`, async ({ page }) => {
    test.skip(BAR, 'the bar-on build (npm run e2e:site) has the phone bar, not the drawer');
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${BASE}/`);
    await greeted(page, 'Graham');
    await expect(drawerDialog(page)).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.hearthDemoDrawer)).toBe('closed');
    await toggleDrawer(page);
    await expect(drawerDialog(page)).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.hearthDemoDrawer)).toBe('open');
    await expect(drawerDialog(page).getByRole('button', { name: 'See the photos as Grandma Jo sees them' })).toBeVisible();
    await expect(drawerDialog(page).getByRole('button', { name: 'Reset demo' })).toBeVisible();
    const box = await page.getByTestId('demo-drawer-sheet').boundingBox();
    expect(box.width).toBeLessThanOrEqual(560 + 1);
    if (width === 1280) { // on a laptop the sheet sits at the bottom of the phone-wide app column, centered in it
      const col = await page.getByTestId('demo-app-column').boundingBox();
      expect(Math.abs(box.x + box.width / 2 - (col.x + col.width / 2))).toBeLessThanOrEqual(2);
    }
    await page.keyboard.press('Escape');
    await expect(drawerDialog(page)).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.hearthDemoDrawer)).toBe('closed');
  });
}

test('DEMO-DRAWER-E2E-2 the event toggles; the scrim and Done close it', async ({ page }) => {
  test.skip(BAR, 'the bar-on build (npm run e2e:site) has the phone bar, not the drawer');
  await page.goto(`${BASE}/`);
  await greeted(page, 'Graham');
  await toggleDrawer(page);
  await expect(drawerDialog(page)).toBeVisible();
  await toggleDrawer(page);
  await expect(drawerDialog(page)).toHaveCount(0);
  await toggleDrawer(page);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(drawerDialog(page)).toHaveCount(0);
  await toggleDrawer(page);
  await page.getByTestId('demo-drawer-scrim').click({ position: { x: 5, y: 5 } });
  await expect(drawerDialog(page)).toHaveCount(0);
});

test('DEMO-DRAWER-E2E-3 Grandma Jo from the drawer changes the greeting after the reload; Reset asks first', async ({ page }) => {
  test.skip(BAR, 'the bar-on build (npm run e2e:site) has the phone bar, not the drawer');
  await page.goto(`${BASE}/`);
  await greeted(page, 'Graham');
  await toggleDrawer(page);
  await drawerDialog(page).getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText(/Put the sample data back\?/)).toBeVisible();
  await page.getByRole('button', { name: 'Keep' }).click();
  await expect(page.getByText(/Put the sample data back\?/)).toHaveCount(0);
  await drawerDialog(page).getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await greeted(page, 'Grandma Jo');
  await toggleDrawer(page);
  await expect(drawerDialog(page).getByRole('button', { name: "Back to Graham's view, the parent" })).toBeVisible();
  await drawerDialog(page).getByRole('button', { name: "Back to Graham's view, the parent" }).click();
  await greeted(page, 'Graham');
});

test('DEMO-DRAWER-E2E-4 a returning visitor: after a reload the event still opens the drawer and focus returns on close', async ({ page }) => {
  test.skip(BAR, 'the bar-on build (npm run e2e:site) has the phone bar, not the drawer');
  await page.goto(`${BASE}/`);
  await greeted(page, 'Graham');
  await page.reload();
  await greeted(page, 'Graham');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.hearthDemoDrawer)).toBe('closed');
  await toggleDrawer(page);
  await expect(drawerDialog(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Done' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawerDialog(page)).toHaveCount(0);
});
