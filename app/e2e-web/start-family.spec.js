// START-ON-5 (SPEC-START-FAMILY section 8, QA-R2): the whole start-a-family walk on the real web bundle with the fake
// backend, at 360 × 740. Aunt Kim (kim@example.com) has an account and no family. Chase's switch is on (set on the
// fake backend, like the service-only flip on hosted), and the web fake build has a help address (START-ON-2: no
// help email means no start button).
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

const START = "I'm a parent: start a family";

test('START-ON-5 a parent with no family starts one with Two sides, makes the first invite and lands on Gallery', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByLabel('Your email')).toBeVisible();
  await page.waitForFunction(() => !!globalThis.__hearthFake);
  // The service-only switch, flipped on the fake backend before she signs in (persisted like any fake change).
  await page.evaluate(() => {
    const be = globalThis.__hearthFake;
    be.state.featureFlags = { ...(be.state.featureFlags || {}), start_family_open: true };
    be.changed();
  });
  const spacesBefore = await page.evaluate(() => Object.keys(globalThis.__hearthFake.state.spaces).length);

  await page.getByLabel('Your email').fill('kim@example.com');
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await page.getByLabel('6-number code').fill('123456');
  await page.getByRole('button', { name: 'Continue' }).click();

  // The no-family screen: the code entry first, the start button below it.
  await expect(page.getByLabel('Invite code')).toBeVisible();
  await page.getByRole('button', { name: START }).click();
  await expect(page.getByText('Did someone send you a code?')).toBeVisible();
  await page.getByRole('button', { name: 'Start a new family' }).click();

  await expect(page.getByText('Name your family')).toBeVisible();
  await page.getByLabel('Family name').fill('Our kids');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText("Who's in it?")).toBeVisible();
  await page.getByRole('radio', { name: 'Two sides' }).click();
  await expect(page.getByLabel("First group's name")).toBeVisible();
  await expect(page.getByLabel("Second group's name")).toBeVisible();
  await page.getByRole('button', { name: 'Start the family' }).click();

  await expect(page.getByText('Invite your first person')).toBeVisible();
  await page.getByLabel('Their name, the way your family says it').fill('Grandma June');
  await page.getByRole('button', { name: 'Make the invite' }).click();
  await expect(page.getByText('Invite ready')).toBeVisible();
  await page.getByRole('button', { name: 'Go to Gallery' }).click();

  // Gallery, in the new family.
  await expect(page.getByRole('tab', { name: /^Gallery/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  const made = await page.evaluate(() => {
    const s = globalThis.__hearthFake.state;
    const kim = Object.values(s.users).find((u) => u.email === 'kim@example.com');
    const mine = s.members.filter((m) => m.user === kim.id).map((m) => m.space);
    const space = mine.length === 1 ? mine[0] : null;
    const groups = Object.values(s.circles).filter((c) => c.space === space && c.kind === 'group').map((c) => c.name).sort();
    const invites = Object.values(s.invites).filter((i) => i.space === space).map((i) => i.name);
    return { families: mine.length, name: space ? s.spaces[space].name : null, groups: groups.length, invites, spaces: Object.keys(s.spaces).length };
  });
  expect(made).toEqual({ families: 1, name: 'Our kids', groups: 2, invites: ['Grandma June'], spaces: spacesBefore + 1 });

  // START-ON-1 on web: the new owner finds the abuse contact in Help (the fake build's help address, never a real one).
  await page.getByRole('tab', { name: /^More/ }).click();
  await page.getByRole('button', { name: /^Help(,|$)/ }).click();
  await expect(page.getByText('Something wrong?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Email Hearth' })).toBeVisible();
});
