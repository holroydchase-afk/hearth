// Showcase screenshots of the public demo for each review round (docs/reviews/2026-10-22-recruiter-ready.md).
// Skipped unless SHOWCASE_DIR is set:
//   SHOWCASE_DIR=/tmp/shots npm run e2e:demo -- demo-showcase.spec.js
// Every demo screen at 390 × 844 and 1280 × 800, light and dark, viewport and full page;
// console errors, failed requests and sideways scrolling go to SHOWCASE_DIR/console.json.
// SHOWCASE_BASE=https://chaseholroyd.com/demo/hearth/ runs the same sweep against the published demo (read only).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

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

const DIR = process.env.SHOWCASE_DIR;
const BASE = (process.env.SHOWCASE_BASE || 'http://127.0.0.1:8090/').replace(/\/?$/, '/');
const PICTURE = path.join(__dirname, '..', 'public', 'demo-pictures', 'snow.jpg');
const SIZES = [
  { name: 'phone', width: 390, height: 844, touch: true },
  { name: 'laptop', width: 1280, height: 800, touch: false },
];
const problems = [];

for (const size of SIZES) {
  for (const scheme of ['light', 'dark']) {
    test(`demo showcase ${size.name} ${scheme}`, async ({ browser }) => {
      test.skip(!DIR, 'set SHOWCASE_DIR to take showcase screenshots');
      const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: size.width, height: size.height }, hasTouch: size.touch, colorScheme: scheme });
      const page = await ctx.newPage();
      const tag = `${size.name}-${scheme}`;
      page.on('console', (m) => { if (m.type() === 'error') problems.push({ tag, url: page.url(), text: m.text() }); });
      page.on('pageerror', (e) => problems.push({ tag, url: page.url(), text: String(e) }));
      page.on('requestfailed', (r) => problems.push({ tag, url: r.url(), text: `request failed: ${r.failure()?.errorText}` }));
      let n = 0;
      const shot = async (name) => {
        // UI-5: wait for the screen's own header, not a fixed delay (a cold tab takes ~750 ms to draw).
        await page.getByRole('heading').first().waitFor({ timeout: 3000 }).catch(() => {}); // the full-screen viewer has none
        await page.waitForTimeout(300);
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        if (sideways) problems.push({ tag, url: page.url(), text: `sideways scroll on ${name}` });
        n += 1;
        const base = path.join(DIR, `${tag}-${String(n).padStart(2, '0')}-${name}`);
        await page.screenshot({ path: `${base}.png` });
        await page.screenshot({ path: `${base}-full.png`, fullPage: true });
      };

      await page.goto('');
      await expect(page.getByText(/First ride on the balance bike/).first()).toBeVisible();
      await shot('photos');
      // RD-47 (Nov 17): By date left Gallery's top bar; the months are the by-date view, so no by-date shot.
      await page.goto('photos');
      await page.getByRole('tab', { name: /^More/ }).click(); // RD-15: Messages is a row in More
      await page.getByRole('button', { name: /^Messages(,|$)/ }).click();
      await shot('messages');
      await page.goto('share');
      await shot('share-empty');
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: /^Add photos, up to \d+ at a time$/ }).click();
      await (await chooser).setFiles(PICTURE);
      await page.getByLabel('Say something, optional').fill('First snow!');
      await page.getByRole('button', { name: 'Next: who gets it' }).click(); // DEC-90: step 2
      await page.getByLabel(/^Grandparents – Dad's side, \d+ people, not picked$/).click();
      await shot('share-filled');
      await page.getByRole('button', { name: /^Send to / }).click();
      await expect(page.getByText('First snow!', { exact: true })).toBeVisible();
      await shot('posted');
      await page.getByRole('button', { name: /Open photo 1 of/ }).first().click();
      await shot('full-screen');
      await page.getByRole('button', { name: 'Close' }).click();
      await page.getByRole('tab', { name: /^More/ }).click(); // RD-15: Groups is a row in More
      await page.getByRole('button', { name: /^Groups(,|$)/ }).click();
      await shot('groups');
      await page.getByRole('tab', { name: /^More/ }).click(); // RD-15: Me is a row in More
      await page.getByRole('button', { name: /^Me(,|$)/ }).click();
      await shot('me');
      await details(page);
      await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
      await details(page);
      await expect(page.getByText(/You're Grandma Jo/)).toBeVisible();
      await shot('grandparent');
      await page.getByRole('tab', { name: /^More/ }).click(); // RD-15: Help is a row in More
      await page.getByRole('button', { name: /^Help(,|$)/ }).click();
      await shot('grandparent-help');
      await page.goto('no-such-page');
      await shot('not-found');
      await page.goto('');
      await resetDemo(page);
      await expect(page.getByText(/You're Graham, a parent/)).toBeVisible();
      await ctx.close();
    });
  }
}

test.afterAll(() => {
  if (DIR) fs.writeFileSync(path.join(DIR, 'console.json'), JSON.stringify(problems, null, 2));
});
