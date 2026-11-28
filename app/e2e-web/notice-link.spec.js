// HRT-WEB.4 WEB-APP-42 (docs/product/SPEC-WEB-APP.md, ARCH-WEB4-R3/R4): the link in a notice email is <web>/p/<post id>.
// Signed in, it opens that post; signed out, it opens it after the 6-digit sign-in; a post she can't see is "not found".
// On the Fake (the state lives in the page), so the link is followed inside the same page load (history push).
// Written first: red until /p/[id] exists and the path is kept across sign-in. 360 × 740.
const path = require('path');
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

const PHOTO = path.join(__dirname, 'fixtures', 'park-gps.jpg');

async function signInAt(page, email) {
  await page.getByLabel('Your email').fill(email);
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await page.getByLabel('6-number code').fill('123456');
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function signOut(page) {
  await page.getByRole('tab', { name: /^More/ }).click();
  await page.getByRole('button', { name: /^Me(,|$)/ }).click();
  await page.getByRole('button', { name: 'Sign out of Hearth' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('Welcome to Hearth')).toBeVisible();
}

/** Follow an emailed link without a reload (the Fake's state lives in this page). */
const followLink = (page, id) => page.evaluate((p) => {
  window.history.pushState({}, '', `/p/${p}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}, id);

test('WEB-APP-42 the notice link /p/<id> opens the post: signed in, signed out then 6-digit sign-in, and "not found" for someone who cannot see it', async ({ page }) => {
  // Chase shares one photo to Dad's side only.
  await page.goto('/sign-in');
  await signInAt(page, 'chase@example.com');
  await page.getByRole('tab', { name: 'Share' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /^Add photos, up to \d+ at a time$/ }).click();
  await (await chooser).setFiles(PHOTO);
  await expect(page.getByRole('heading', { name: 'New post' })).toBeVisible();
  await page.getByLabel('Say something, optional').fill('Notice link');
  await page.getByRole('button', { name: 'Next: who gets it' }).click();
  await page.getByLabel(/^Grandparents – Dad's side, 2 people, not picked$/).click();
  await page.getByRole('button', { name: /^Send to / }).click();
  await page.getByRole('button', { name: 'See it in Feed' }).click();
  const id = await page.evaluate(() => Object.values(globalThis.__hearthFake.state.posts).find((p) => p.caption === 'Notice link').id);

  // Signed in: /p/<id> opens that post.
  await followLink(page, id);
  await expect(page.getByRole('button', { name: 'Close' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).first().click();

  // Signed out: the link asks her to sign in, then the 6-digit code lands on that post.
  await signOut(page);
  await followLink(page, id);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await signInAt(page, 'chase@example.com');
  await expect(page.getByRole('button', { name: 'Close' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close' }).first().click();

  // Nana Ruth (Mom's side) cannot see it: privacy rule 2, the same as a post that is not there.
  await signOut(page);
  await followLink(page, id);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await signInAt(page, 'ruth@example.com');
  await expect(page.getByRole('button', { name: 'Close' })).toHaveCount(0);
  await expect(page.getByText('Notice link')).toHaveCount(0);
});
