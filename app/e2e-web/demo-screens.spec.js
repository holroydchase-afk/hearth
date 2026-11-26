// Portfolio screenshots from the public demo (RR-9): drawn sample pictures, made-up family.
// Skipped unless SNAPSHOT_DIR is set:
//   SNAPSHOT_DIR=../docs/portfolio/screens npm run e2e:demo -- demo-screens.spec.js
// Phone shots hide the demo bar so the app's own screens show; the laptop shot keeps the whole demo.
const path = require('path');
const { test, expect } = require('../../e2e/node_modules/@playwright/test');
const { pageReady } = require('./helpers/settle');

// DEMO-BAR: Grandma's view and Reset live in the Details drawer.
const details = async (page) => {
  const t = page.getByRole('button', { name: 'Demo details' });
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
};

const DIR = process.env.SNAPSHOT_DIR;
const PICTURE = path.join(__dirname, '..', 'public', 'demo-pictures', 'snow.jpg');
const HIDE_BAR = '[data-testid="demo-bar"] { display: none !important; }';

test('portfolio screenshots from the demo', async ({ page }) => {
  test.skip(!DIR, 'set SNAPSHOT_DIR to take portfolio screenshots');
  const shot = async (name) => { await pageReady(page); await page.screenshot({ path: path.join(DIR, `${name}.png`) }); };

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByText(/First ride on the balance bike/).first()).toBeVisible();
  await shot('laptop-01-demo');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  let hide = await page.addStyleTag({ content: HIDE_BAR });
  await expect(page.getByText(/First ride on the balance bike/).first()).toBeVisible();
  await shot('iphone-01-photos');

  await page.getByRole('tab', { name: 'Share' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /^Add photos, up to \d+ at a time$/ }).click();
  await (await chooser).setFiles(PICTURE);
  await expect(page.getByRole('heading', { name: 'New post' })).toBeVisible(); // DEC-73 postcard
  await page.getByLabel('Add a note (optional)').fill('First snow!');
  await page.getByLabel(/^Grandparents – Dad's side, \d+ people, not picked$/).click();
  await shot('iphone-02-share');
  await page.getByRole('button', { name: /^Send to / }).click();
  await expect(page.getByText('First snow!', { exact: true })).toBeVisible();
  await shot('iphone-03-posted');

  await page.getByRole('tab', { name: /^More/ }).click(); // RD-15: Groups is a row in More

  await page.getByRole('button', { name: /^Groups(,|$)/ }).click();
  await shot('iphone-04-groups');

  await hide.evaluate((el) => el.remove());
  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await details(page);
  await expect(page.getByText(/You're Grandma Jo/)).toBeVisible();
  hide = await page.addStyleTag({ content: HIDE_BAR });
  await expect(page.getByText('First snow!', { exact: true })).toBeVisible();
  await shot('iphone-05-grandparent');
  await page.getByRole('button', { name: /Open photo 1 of 1 full screen/ }).first().click();
  await expect(page.getByRole('button', { name: 'Save to my phone' })).toBeVisible();
  await shot('iphone-06-full-screen');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('tab', { name: /^More/ }).click(); // RD-15: Help is a row in More
  await page.getByRole('button', { name: /^Help(,|$)/ }).click();
  await shot('iphone-07-help');
});
