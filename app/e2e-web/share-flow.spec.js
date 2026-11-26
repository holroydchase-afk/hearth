// FLOW-23 (DEC-91, docs/product/SPEC-SHARE-FLOW.md): the two-step Share flow on the real app bundle (FakeApi web build)
// at 360 and 412 px wide: FLOW-1..14 hold, no sideways scroll, the pinned button sits above the floating tab bar
// (RD-109, useTabBarSpace). Written first (red), Nov 26, 2026, by qa-tdd.
const path = require('path');
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

const FIXTURE = path.join(__dirname, 'fixtures', 'park-gps.jpg');
async function signIn(page, email) {
  await page.goto('/sign-in');
  await page.getByLabel('Your email').fill(email);
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await page.getByLabel('6-number code').fill('123456');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
}
const noSideways = async (page) => expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll').toBe(true);
const aboveTabBar = async (page, button) => {
  const b = await button.boundingBox();
  const tab = await page.getByRole('tab', { name: /^Feed/ }).boundingBox();
  expect.soft(b.y + b.height, 'the pinned button sits above the tab bar').toBeLessThanOrEqual(tab.y + 1);
};

for (const width of [360, 412]) {
  test(`FLOW-23 real build at ${width} px: Photos step 1, step 2, sent; no "To:", no sideways scroll, button above the tab bar`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await signIn(page, 'chase@example.com');
    await page.getByRole('tab', { name: 'Share' }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /^Add photos, up to \d+ at a time$/ }).click();
    await (await chooser).setFiles(FIXTURE);
    await expect(page.getByRole('heading', { name: 'New post' })).toBeVisible();
    // step 1 (FLOW-1, FLOW-6)
    await expect.soft(page.getByText('Step 1 of 2')).toBeVisible();
    await expect.soft(page.getByText(/(^|\s)To:/)).toHaveCount(0);
    await expect.soft(page.getByLabel(/, \d+ people, (not )?picked$/)).toHaveCount(0);
    const next = page.getByRole('button', { name: 'Next: who gets it' });
    await expect(next).toBeEnabled();
    await aboveTabBar(page, next);
    await noSideways(page);
    await page.getByLabel('Say something, optional').fill('Pumpkin patch');
    // step 2 (FLOW-7, 9, 11)
    await next.click();
    await expect(page.getByRole('heading', { name: 'Who gets it?' })).toBeVisible();
    await expect.soft(page.getByText('Step 2 of 2')).toBeVisible();
    await expect.soft(page.getByTestId('share-summary')).toContainText('Nothing is picked yet. Tap one or more.');
    const send = page.getByRole('button', { name: /^Send/ });
    await expect.soft(send).toBeDisabled();
    await aboveTabBar(page, send);
    await noSideways(page);
    // Back keeps the note (FLOW-8)
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByLabel('Say something, optional')).toHaveValue('Pumpkin patch');
    await next.click();
    await page.getByLabel(/^Grandparents – Dad's side, 2 people, not picked$/).click();
    await expect.soft(page.getByTestId('share-summary')).toContainText('will see your photos');
    await page.getByRole('button', { name: /^Send to / }).click();
    // sent (FLOW-13)
    await expect(page.getByRole('heading', { name: 'Sent' })).toBeVisible();
    await expect.soft(page.getByText(/^Shared with /)).toHaveCount(0);
    await page.getByRole('button', { name: 'See it in Feed' }).click();
    await expect(page.getByText('Pumpkin patch', { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(__dirname, '..', 'test-results', 'flow-23', `photos-${width}.png`) });
  });
}
