// TD-UX-R1 (Nov 19 tech-debt review, P0): on a laptop the demo's story panel fits or scrolls. At 1280 x 800 its
// top line ("Hearth (working name) · demo") and its last line ("The family here is made up...") were cut off and
// the panel didn't scroll, so the sample-data line a recruiter needs was the part they couldn't see.
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

for (const height of [800, 720]) {
  test(`TD-UX-R1 at 1280 x ${height} the story panel's first and last lines can be seen`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height });
    await page.goto('/');
    const top = page.getByText('Hearth (working name) · demo');
    const last = page.getByText(/The family here is made up/);
    await expect(top).toBeAttached();
    const inView = (loc) => loc.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
    });
    expect(await inView(top)).toBe(true);
    await last.scrollIntoViewIfNeeded();
    expect(await inView(last)).toBe(true);
    // The page itself never scrolls sideways or down; only the panel does.
    expect(await page.evaluate(() => document.scrollingElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
  });
}

// SITEBAR-4 (intake #183): on the portfolio site the demo sits under the site's shared top bar (demo-bar.js, loaded by
// add-site-bar.sh). That script lives on the portfolio site, not in this repo, so here we SIMULATE it: a 52 px header
// pinned to the top of the window (position: fixed, the way a sticky site bar behaves on a page that does not scroll)
// plus padding-top: 52px on body, which is how the bar reserves its room. Then the layout must still fit.
const BAR = 52;
const addSiteBar = (page) => page.evaluate((h) => {
  const bar = document.createElement('header');
  bar.id = 'sim-site-bar';
  bar.textContent = 'Site bar (simulated)';
  Object.assign(bar.style, { position: 'fixed', top: '0', left: '0', right: '0', height: `${h}px`, background: '#FFFFFF', zIndex: '2147483647' });
  document.body.prepend(bar);
  document.body.style.paddingTop = `${h}px`;
}, BAR);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth);
// The element really drawn at a locator's centre is that element (or inside it), not the bar.
const notUnderBar = (loc) => loc.evaluate((el) => {
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { top: Math.round(r.top), drawn: !!hit && (el === hit || el.contains(hit)) };
});

test('SITEBAR-4 at 1280 x 800 under a 52 px site bar the laptop frame still fits: panel and phone column below the bar, no side scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByTestId('demo-app-column')).toBeVisible();
  await addSiteBar(page);
  await expect(page.locator('#sim-site-bar')).toBeVisible();
  const top = page.getByText('Hearth (working name) · demo');
  const t = await notUnderBar(top);
  expect(t.top).toBeGreaterThanOrEqual(BAR);
  expect(t.drawn).toBe(true);
  const col = await page.getByTestId('demo-app-column').boundingBox();
  expect(col.y).toBeGreaterThanOrEqual(BAR);
  expect(col.y + col.height).toBeLessThanOrEqual(800 + 1);
  expect(col.width).toBeLessThanOrEqual(432);
  expect(await noSideScroll(page)).toBe(true);
});

test('SITEBAR-4 at 390 wide under a 52 px site bar the app is usable: greeting below the bar, tab bar on screen and works, no side scroll', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  await addSiteBar(page);
  const g = await notUnderBar(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ }));
  expect(g.top).toBeGreaterThanOrEqual(BAR);
  expect(g.drawn).toBe(true);
  // The tab bar is on the first screen without scrolling the page (a grandparent never hunts for it).
  const feed = page.getByRole('tab', { name: /^Feed/ });
  const fb = await feed.boundingBox();
  expect(fb.y).toBeGreaterThanOrEqual(BAR);
  expect(fb.y + fb.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight));
  expect(await noSideScroll(page)).toBe(true);
  await feed.click();
  await expect(page.getByText(/First ride on the balance bike/).filter({ visible: true }).first()).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
});
