// CAL-19 (docs/product/SPEC-LIFE-CALENDAR.md, DEC-81): the public demo shows the life calendar. Grandma Jo's birthday
// is today (set relative to the visit, so the Gallery line always shows), Grandpa Earl's is in 9 days, plus a made-up
// kid's birthday and the parents' anniversary. Grandma Jo's view offers only "Change my birthday".
// Written FIRST (Nov 24, qa-tdd): red until the calendar and its demo dates land.
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

const details = async (page) => {
  const t = page.getByRole('button', { name: 'Demo details' });
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
};
const galleryLoaded = async (page) => {
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
};
const openBirthdays = async (page) => {
  await page.getByRole('tab', { name: /^More/ }).click();
  // engineer, flagged for qa-tdd: exact, because Playwright's name match is a substring and Gallery's "See birthdays"
  // (CAL-16, always shown in the demo) stays in the page under More on the web.
  await page.getByRole('button', { name: 'Birthdays', exact: true }).filter({ visible: true }).click({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Birthdays and dates' })).toBeVisible();
};
const errors = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
});

test("CAL-19 a fresh visit's Gallery says \"Today is Grandma Jo's birthday\" and See birthdays opens the list", async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await expect(page.getByText(/^Today is Grandma Jo[’']s birthday$/).filter({ visible: true })).toBeVisible();
  await page.getByRole('button', { name: 'See birthdays' }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: 'Birthdays and dates' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('CAL-19 Birthdays lists Grandma Jo today, Grandpa Earl in 9 days, Mia\'s birthday and Chase and Alex\'s anniversary', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await openBirthdays(page);
  await expect(page.getByText('Everyone in the family sees these.').filter({ visible: true })).toBeVisible();
  for (const t of [/Grandma Jo/, /Grandpa Earl/, /Mia[’']s birthday/, /Chase and Alex[’']s anniversary/, /^Today$/, /^In 9 days$/]) {
    await expect(page.getByText(t).filter({ visible: true }).first()).toBeVisible();
  }
});

test('CAL-19 a returning visitor with a pre-calendar demo saved gets the dates too', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await page.evaluate(() => localStorage.setItem('hearth.demoSeed', '659ibx')); // the demo version before CAL-19
  await page.reload();
  await galleryLoaded(page);
  await expect(page.getByText(/^Today is Grandma Jo[’']s birthday$/).filter({ visible: true })).toBeVisible();
});

test("CAL-19 Grandma Jo's view: her only action on Birthdays is \"Change my birthday\"", async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await details(page);
  await expect(page.getByText(/You're Grandma Jo/)).toBeVisible();
  await openBirthdays(page);
  await expect(page.getByRole('button', { name: 'Change my birthday' }).filter({ visible: true })).toBeVisible();
  for (const name of ['Add my birthday', 'Add a date', 'Change', 'Delete']) {
    await expect(page.getByRole('button', { name, exact: true }).filter({ visible: true })).toHaveCount(0);
  }
});
