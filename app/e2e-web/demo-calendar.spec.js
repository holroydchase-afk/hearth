// CAL-19 (docs/product/SPEC-LIFE-CALENDAR.md, DEC-81): the public demo shows the life calendar. Grandma Jo's birthday
// is today (set relative to the visit, so the Gallery line always shows), Grandpa Hollis's is in 9 days, plus a made-up
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

test("DEMO-NAMES-5 CAL-19 a fresh visit's Gallery says \"Today is Grandma Jo's birthday\" and See birthdays opens the list", async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await expect(page.getByText(/^Today is Grandma Jo[’']s birthday$/).filter({ visible: true })).toBeVisible();
  await page.getByRole('button', { name: 'See birthdays' }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: 'Birthdays and dates' })).toBeVisible();
  expect(errors).toEqual([]);
});

// Updated Nov 24 (DEMO-PHOTO-9, DEC-82): the parents are Graham and Eliza.
test('DEMO-NAMES-5 CAL-19 DEMO-PHOTO-9 Birthdays lists Grandma Jo today, Grandpa Hollis in 9 days, Clara\'s birthday and Graham and Eliza\'s anniversary', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await openBirthdays(page);
  await expect(page.getByText('Only your family can see these.').filter({ visible: true })).toBeVisible();
  for (const t of [/Grandma Jo/, /Grandpa Hollis/, /Clara[’']s birthday/, /Graham and Eliza[’']s anniversary/, /^Today$/, /^In 9 days$/]) {
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

test("DEMO-NAMES-5 CAL-19 Grandma Jo's view: her only action on Birthdays is \"Change my birthday\"", async ({ page }) => {
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

// Grandparent-ux review fixes (Nov 24, GUX-R1..R3). Written FIRST (qa-tdd): red until the fixes land.
// The demo signs in as Graham, who has no birthday saved, so Me shows "Add my birthday" on a fresh visit.
const tabBarTop = async (page) => {
  const ys = [];
  for (const t of await page.getByRole('tab').filter({ visible: true }).all()) ys.push((await t.boundingBox()).y);
  return Math.min(...ys);
};

// CAL-S4 (Nov 26, Chase: "hide this from the feed ... in the settings"): the Gallery card is gone, so GUX-R1 and GUX-R2
// (which clicked "Add my birthday" on the card) now start from More -> Me -> "My birthday" -> "Add my birthday". Same
// assertions otherwise. Written FIRST (qa-tdd): red until the card is removed and the Me section is built.
const openMyBirthday = async (page) => {
  await page.getByRole('tab', { name: /^More/ }).click();
  await page.getByRole('button', { name: 'Me', exact: true }).filter({ visible: true }).click({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Me', exact: true })).toBeVisible();
  const section = page.getByTestId('my-birthday').filter({ visible: true });
  await expect(section.getByRole('heading', { name: 'My birthday' })).toBeVisible();
  return section;
};

test('CAL-S4 a fresh visit\'s Gallery shows no "When\'s your birthday?" card (it lives in Me now), but keeps the "Today is" line', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await expect(page.getByText(/^Today is Grandma Jo[’']s birthday$/).filter({ visible: true })).toBeVisible(); // calendar has loaded
  await expect(page.getByTestId('birthday-card')).toHaveCount(0);
  await expect(page.getByText(/^When[’']s your birthday\?$/)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('GUX-R1 CAL-S4 at 390x844 Me -> My birthday -> "Add my birthday" opens the form, and after month and day Save is fully on-screen above the tab bar', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  const section = await openMyBirthday(page);
  await section.getByRole('button', { name: 'Add my birthday' }).click({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Add my birthday' })).toBeVisible();
  await page.getByRole('button', { name: 'December', exact: true }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'December 8', exact: true }).filter({ visible: true }).click();
  const save = page.getByRole('button', { name: 'Save', exact: true }).filter({ visible: true });
  await expect(save).toBeInViewport({ ratio: 1 }); // no scrolling needed
  const box = await save.boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(await tabBarTop(page)); // not under the tab bar
  expect(errors).toEqual([]);
});

test('GUX-R2 CAL-S2 CAL-S4 after Save from Me, "Saved. December 8 is your birthday." is on-screen at the top of Birthdays, and Me then shows "December 8"', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  const section = await openMyBirthday(page);
  await section.getByRole('button', { name: 'Add my birthday' }).click({ timeout: 15_000 });
  await page.getByRole('button', { name: 'December', exact: true }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'December 8', exact: true }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).filter({ visible: true }).click();
  const saved = page.getByText('Saved. December 8 is your birthday.').filter({ visible: true });
  await expect(saved).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('heading', { name: 'Birthdays and dates' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Back to )?Gallery$/ }).filter({ visible: true })).toHaveCount(0); // More's stack
  await page.getByRole('button', { name: /^(Back to )?More$/ }).filter({ visible: true }).click();
  const again = await openMyBirthday(page);
  await expect(again.getByText('December 8', { exact: true })).toBeVisible();
  await expect(again.getByRole('button', { name: 'Change my birthday' })).toBeVisible();
});

test('GUX-R3 Gallery → See birthdays → the back button reads "Gallery" and goes back to Gallery', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await page.getByRole('button', { name: 'See birthdays' }).filter({ visible: true }).click();
  await expect(page.getByRole('heading', { name: 'Birthdays and dates' })).toBeVisible();
  const back = page.getByRole('button', { name: /^(Back to )?Gallery$/ }).filter({ visible: true });
  await expect(back).toHaveText(/Gallery/);
  await back.click();
  await galleryLoaded(page);
  await expect(page.getByRole('tab', { name: /^Gallery/, selected: true })).toBeVisible();
});
