// ONB-3 / ONB-4: the link a parent sends opens the web build on "Chase invited you", not a 404, and it
// points at the hosted web build, never at hearth.family (not bought: docs/product/ACCOUNTS.md).
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

// RD-110-R1: a tap on the shrunk glass oval only brings the tabs back, so tap again to act on the tab.
const tapTab = async (page, name) => {
  const tab = page.getByRole('tab', { name });
  const shrunk = /show all tabs/.test((await tab.getAttribute('aria-label')) ?? '');
  await tab.click();
  if (shrunk) await page.getByRole('tab', { name }).click();
};

const HOSTED_JOIN = 'https://thefreighttrains-team-hearth.expo.app/join/';

test('ONB-4 a link from "Make the invite" opens the "invited you" preview in the web build', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByLabel('Your email').fill('chase@example.com');
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await page.getByLabel('6-number code').fill('123456');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ } /* RD-11 */)).toBeVisible();

  await page.getByRole('tab', { name: /^More/ }).click(); // RD-15: Groups is a row in More

  await page.getByRole('button', { name: /^Groups(,|$)/ }).click();
  await page.getByRole('button', { name: "Invite someone to Grandparents – Dad's side" }).click();
  await page.getByRole('radio', { name: 'Share all past photos' }).click();
  await page.getByRole('button', { name: 'Make the invite' }).click();
  await expect(page.getByText('Invite ready')).toBeVisible();
  const link = (await page.getByText(/\/join\//).first().textContent()).trim();

  // ONB-3: the link is on the hosted web build, not a domain we don't own.
  expect(link.startsWith(HOSTED_JOIN)).toBe(true);
  expect(link).not.toContain('hearth.family');

  // Sign out (a signed-in person redeems straight away), then open the link's path as the relative would.
  await tapTab(page, /^More/); // RD-15: Me is a row in More
  await page.getByRole('button', { name: /^Me(,|$)/ }).click();
  await page.getByRole('button', { name: 'Sign out of Hearth' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('Welcome to Hearth')).toBeVisible();

  await page.goto(new URL(link).pathname);
  await expect(page.getByText('Chase invited you to see the family photos.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'See the photos' })).toBeVisible();
  await expect(page.getByText(/Unmatched Route|doesn't exist|not found/i)).toHaveCount(0);
});
