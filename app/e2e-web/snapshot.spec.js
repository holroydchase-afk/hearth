// UI snapshots for the design history (docs/design/versions/). Skipped unless SNAPSHOT_DIR is set:
//   SNAPSHOT_DIR=../docs/design/versions/v2-native npm run e2e:web -- snapshot.spec.js
// Same demo data and the same steps for every version, so screens line up side by side.
// 390 × 844 is an iPhone 14/15 in points; 360 × 740 is a 4-year-old Galaxy A.
const path = require('path');
const { test, expect } = require('../../e2e/node_modules/@playwright/test');
const { pageReady } = require('./helpers/settle');

const DIR = process.env.SNAPSHOT_DIR;
const FIXTURE = path.join(__dirname, 'fixtures', 'park-gps.jpg');
const PHONES = [
  { name: 'iphone', width: 390, height: 844 },
  { name: 'android', width: 360, height: 740 },
];

for (const phone of PHONES) {
  test(`snapshot (${phone.name})`, async ({ page }) => {
    test.skip(!DIR, 'set SNAPSHOT_DIR to take snapshots');
    await page.setViewportSize({ width: phone.width, height: phone.height });
    const shot = async (name) => { await pageReady(page); return page.screenshot({ path: path.join(DIR, `${phone.name}-${name}.png`) }); };
    const signIn = async (email) => {
      await page.goto('/sign-in');
      await page.getByLabel('Your email').fill(email);
      await page.getByRole('button', { name: 'Send me a code' }).click();
      await page.getByLabel('6-number code').fill('123456');
      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ } /* RD-11 */)).toBeVisible();
    };

    await page.goto('/sign-in');
    await expect(page.getByLabel('Your email')).toBeVisible();
    await shot('01-sign-in');

    await signIn('chase@example.com');
    await page.getByRole('tab', { name: 'Share' }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /^Add photos, up to \d+ at a time$/ }).click();
    await (await chooser).setFiles(FIXTURE);
    await expect(page.getByRole('heading', { name: 'New post' })).toBeVisible(); // DEC-73 postcard
    await page.getByLabel('Say something, optional').fill('Pumpkin patch');
    await page.getByRole('button', { name: 'Next: who gets it' }).click(); // DEC-91: step 2
    await page.getByLabel(/^Grandparents – Dad's side, 2 people, not picked$/).click();
    await shot('02-share');
    await page.getByRole('button', { name: /^Send to / }).click();
    await expect(page.getByText('Pumpkin patch', { exact: true })).toBeVisible();
    await shot('03-photos-poster');
    await page.getByRole('tab', { name: /^More/ }).click(); // RD-15: Groups is a row in More
    await page.getByRole('button', { name: /^Groups(,|$)/ }).click();
    await shot('04-groups');
    await page.getByRole('tab', { name: /^More/ }).click(); // RD-15: Me is a row in More
    await page.getByRole('button', { name: /^Me(,|$)/ }).click();
    await shot('05-me');
    await page.getByRole('button', { name: 'Sign out of Hearth' }).click();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await shot('06-confirm');
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();

    await page.goto('/join/GRANDMAJ23');
    await expect(page.getByText('Chase invited you to see the family photos.')).toBeVisible();
    await shot('07-invite');
    await page.getByRole('button', { name: 'See the photos' }).click();
    await page.getByLabel('Your email').fill('jo@example.com');
    await page.getByRole('button', { name: 'Send me a code' }).click();
    await page.getByLabel('6-number code').fill('123456');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Pumpkin patch', { exact: true })).toBeVisible();
    await shot('08-photos-grandparent');
    await page.getByRole('button', { name: /^Open photo 1 of 1 full screen/ }).click();
    await expect(page.getByRole('button', { name: 'Save to my phone' })).toBeVisible();
    await shot('09-full-screen');
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('tab', { name: /^More/ }).click(); // RD-15: Help is a row in More
    await page.getByRole('button', { name: /^Help(,|$)/ }).click();
    await shot('10-help');
  });
}
