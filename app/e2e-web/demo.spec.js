// DEMO-1..3, DEMO-10, RR-14: the public demo a recruiter opens from chaseholroyd.com.
// No sign-in, a sample family with pictures, a demo bar, Grandma Jo's view, and add / edit / reload / start over.
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

// RD-18 (redesign 1c): Gallery shows photos, not captions. "Loaded" = the greeting and a drawn picture; captions are
// checked on Feed (RD-17), which keeps the post list.
const galleryLoaded = async (page) => {
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length)).toBeGreaterThan(0);
};
const onFeed = async (page) => {
  await page.getByRole('tab', { name: /^Feed/ }).click();
  await expect(page.getByText('Life jackets on and in all afternoon', { exact: true }).filter({ visible: true })).toBeVisible();
};

const FIXTURE = path.join(__dirname, 'fixtures', 'park-gps.jpg');
const errors = [];

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
});

test('DEMO-1/2/3 opens straight into the sample family: no sign-in, pictures, a demo bar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ } /* RD-11 */)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Demo details' })).toBeVisible();
  await galleryLoaded(page);
  await expect(page.getByLabel('Your email')).toHaveCount(0);
  // The first card's picture really drew (decrypted from the sample bytes).
  await expect.poll(() => page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length)).toBeGreaterThan(0);
  await expect(page.getByRole('link', { name: 'Back to the portfolio' })).toBeVisible();
  expect(errors).toEqual([]);
});

test("DEMO-10 RD-17 Grandma Jo's view hides the Mom's-side posts; the parent's view shows them again", async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await details(page);
  await expect(page.getByText(/You're Grandma Jo/)).toBeVisible();
  await onFeed(page);
  await expect(page.getByText('Bridge walk on the trail', { exact: true })).toBeVisible();
  await expect(page.getByText('Bike day at the lake', { exact: true })).toHaveCount(0);
  await details(page);
  await page.getByRole('button', { name: "Back to Kai's view, the parent" }).click();
  await details(page);
  await expect(page.getByText(/You're Kai, a parent/)).toBeVisible();
  await onFeed(page);
  await page.getByText('Bike day at the lake', { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText('Bike day at the lake', { exact: true })).toBeVisible();
});

test('RR-14 add a photo, reload keeps it, Start over brings back the sample family', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await page.getByRole('tab', { name: 'Share' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Pick photos from your phone' }).click();
  await (await chooser).setFiles(FIXTURE);
  await page.getByLabel("What's happening?").fill('Leaf pile');
  await page.getByRole('checkbox', { name: /Grandparents – Dad's side/ }).click();
  await page.getByRole('button', { name: 'Post' }).click();
  await onFeed(page); // RD-18: captions live on Feed (Gallery may stay mounted behind it, so only what shows counts)
  await expect(page.getByText('Leaf pile', { exact: true }).filter({ visible: true })).toBeVisible();
  await page.reload();
  await onFeed(page);
  await expect(page.getByText('Leaf pile', { exact: true }).filter({ visible: true })).toBeVisible();
  await resetDemo(page);
  await onFeed(page);
  await expect(page.getByText('Leaf pile', { exact: true }).filter({ visible: true })).toHaveCount(0);
});

test('DEMO-6 / NF-1 laptop shows the story panel beside the app; an unknown link shows plain words', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A private photo app for split families' })).toBeVisible();
  const box = await page.getByTestId('demo-app-column').boundingBox();
  expect(box.width).toBeLessThanOrEqual(432);
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: "We couldn't find that page." })).toBeVisible();
  await expect(page.getByText('Unmatched Route')).toHaveCount(0);
  await page.getByRole('button', { name: 'Go to Gallery' }).click();
  await galleryLoaded(page);
});

test('HARD-7 storage blocked (private window, strict cookie settings): the demo still opens with the sample family', async ({ page }) => {
  await page.addInitScript(() => {
    const deny = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
    Object.defineProperty(window, 'localStorage', { configurable: true, get: deny });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, get: deny });
  });
  const mine = [];
  page.on('pageerror', (e) => mine.push(String(e)));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ } /* RD-11 */)).toBeVisible();
  await galleryLoaded(page);
  expect(mine).toEqual([]);
});

// DEMO-BAR (intake #82, pm-tools docs/DEMO-BANNER.md "Done when").
for (const width of [390, 1280]) {
  test(`DEMO-BAR at ${width} px: collapsed and slim, pushes the app down, Esc closes, Hearth's font and no accent badge`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await galleryLoaded(page);
    const bar = page.getByRole('region', { name: 'Demo' });
    const toggle = page.getByRole('button', { name: 'Demo details' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('link', { name: 'Back to the portfolio' })).toBeVisible();
    expect((await bar.boundingBox()).height).toBeLessThanOrEqual(48);
    // The middle note only where it fits whole at 17 pt (DS-2).
    await expect(page.getByText(/^Sample data/)).toHaveCount(0); // 390 px phone and the 430 px laptop column: no room at 17 pt
    // DEC-61 (Chase, Nov 16: "that is messy"): no numbered Try-this steps on Gallery at any width (replaces FIRSTMIN-3).
    await expect(page.getByTestId('demo-tip')).toHaveCount(0);
    await expect(page.getByText(/^\d\. (You're seeing a parent's Gallery|Tap Details|Tap See it as Grandma Jo)/)).toHaveCount(0);
    const heading = page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ } /* RD-11 */);
    const before = (await heading.boundingBox()).y;
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText(/^This is the real Hearth, running on made-up sample data\./)).toBeVisible();
    expect((await heading.boundingBox()).y).toBeGreaterThan(before + 40); // pushed down, not covered
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
    const look = await page.evaluate(() => {
      const badge = document.querySelector('[data-testid="demo-badge"]');
      return {
        barFont: getComputedStyle(badge.firstElementChild ?? badge).fontFamily,
        bodyFont: getComputedStyle(document.querySelector('[role="heading"]')).fontFamily,
        badgeBorder: getComputedStyle(badge).borderTopColor, badgeBg: getComputedStyle(badge).backgroundColor,
      };
    });
    expect(look.barFont).toBe(look.bodyFont);
    expect(['rgb(0, 64, 221)', 'rgb(64, 156, 255)']).not.toContain(look.badgeBorder); // Hearth's accent, light and dark
    expect(look.badgeBg).toBe('rgba(0, 0, 0, 0)');
  });
}

test('DEMO-BAR no sideways scroll down to 320 px, back link still there', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await galleryLoaded(page);
  await expect(page.getByRole('link', { name: 'Back to the portfolio' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('DEMO-BAR Reset asks first: Keep changes nothing; Reset restores and says so once', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await details(page);
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('Put the sample data back? Your changes will be lost.')).toBeVisible();
  await page.getByRole('button', { name: 'Keep' }).click();
  await expect(page.getByText(/Put the sample data back/)).toHaveCount(0);
  await expect(page.getByText('Sample data restored.')).toHaveCount(0);
  await resetDemo(page);
  await expect(page.getByText('Sample data restored.')).toBeVisible();
  await page.reload();
  await galleryLoaded(page);
  await expect(page.getByRole('button', { name: 'Demo details' })).toHaveAttribute('aria-expanded', 'false');
});

// RD-27 (SPEC-REDESIGN, DEC-59): Kai, the family's owner, can switch Family color and the demo recolors;
// Grandma Jo's view stays Ember and has no picker. 1b: the picker is More → Family color (RD-15).
test('RD-27 Kai switches Family color to Forest and the demo recolors; Grandma Jo stays Ember with no picker', async ({ page }) => {
  const EMBER = 'rgb(178, 58, 30)';
  const FOREST = 'rgb(46, 125, 79)';
  const pickedTabColor = (name) => page.getByRole('tab', { name: new RegExp(`^${name}`) }).getByText(name, { exact: true })
    .evaluate((el) => getComputedStyle(el).color);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await galleryLoaded(page);
  await page.getByRole('tab', { name: /^More/ }).click();
  await page.getByRole('button', { name: 'Family color' }).click();
  await expect(page.getByRole('heading', { name: 'Family color' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Ember' })).toBeChecked();
  expect(await pickedTabColor('More')).toBe(EMBER);
  await page.getByRole('radio', { name: 'Forest' }).click();
  await expect(page.getByRole('radio', { name: 'Forest' })).toBeChecked();
  await expect.poll(() => pickedTabColor('More')).toBe(FOREST);
  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await details(page);
  await expect(page.getByText(/You're Grandma Jo/)).toBeVisible();
  await page.getByRole('tab', { name: /^More/ }).click();
  await expect(page.getByRole('heading', { name: 'More' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Family color' })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Forest' })).toHaveCount(0);
  expect(await pickedTabColor('More')).toBe(EMBER);
});

// RD-9 / RD-10 / RD-15 (SPEC-REDESIGN 1b) on the demo build at a 360 px phone: Kai's tabs are Gallery, Share,
// Feed, More with Gallery picked on open; More is a full-screen menu in the spec's order; Grandma Jo's view has
// Gallery, Feed, More and no Groups or Family color.
test('RD-9 RD-10 RD-15 Gallery opens first; More is a full-screen menu; Grandma Jo gets three tabs', async ({ page }) => {
  const before = errors.length; // `errors` spans the file; HARD-7's blocked storage logs one on purpose
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await galleryLoaded(page);
  await expect(page.getByRole('tab')).toHaveText([/Gallery/, /Share/, /Feed/, /More/]);
  await expect(page.getByRole('tab', { name: 'Gallery' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  await page.getByRole('tab', { name: /^More/ }).click();
  await expect(page.getByRole('heading', { name: 'More' })).toBeVisible();
  const rows = ['Messages', 'Groups', 'Events', 'Bigger text', 'Light or dark', 'Family color', 'Me', 'Help'];
  const labels = async () => (await page.getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.textContent ?? '')))
    .map((l) => l.split(',')[0]).filter((l) => /^(Messages|Groups|Events|Bigger text|Light or dark|Family color|Me|Help)$/.test(l));
  expect(await labels()).toEqual(rows);
  for (const r of rows) {
    const box = await page.getByRole('button', { name: new RegExp(`^${r}(,|$)`) }).boundingBox();
    expect({ r, tall: box.height >= 48, wide: box.width >= 300 }).toEqual({ r, tall: true, wide: true }); // big full-width rows
  }
  await page.getByRole('button', { name: /^Groups/ }).click();
  await page.getByRole('button', { name: 'Back to More' }).click();
  await expect(page.getByRole('heading', { name: 'More' })).toBeVisible();

  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await details(page);
  await expect(page.getByText(/You're Grandma Jo/)).toBeVisible();
  await expect(page.getByRole('tab')).toHaveText([/Gallery/, /Feed/, /More/]);
  await page.getByRole('tab', { name: /^More/ }).click();
  await expect(page.getByRole('heading', { name: 'More' })).toBeVisible(); // wait for the menu before reading its rows
  expect(await labels()).toEqual(rows.filter((r) => r !== 'Groups' && r !== 'Family color'));
  expect(errors.slice(before)).toEqual([]);
});

// RD-18..RD-21 (SPEC-REDESIGN 1c) on the demo build at a 360 px phone: Kai's last visit was 3 days ago and Alex
// sent two posts since, one picture each. Gallery: New for you with a sideways row, "2 new" on the first photo,
// the sender line and See all (no "Tap a photo to start", DEC-61); under it the grid by month. Any photo opens the walk at
// the oldest new post; Done comes back to Gallery. No All photos button, no group name.
test('RD-18 RD-19 RD-20 RD-21 New for you and the grid at 360 px; a tap walks the new photos and Done comes back', async ({ page }) => {
  const before = errors.length;
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await galleryLoaded(page);
  await expect(page.getByRole('heading', { name: 'New for you' })).toBeVisible();
  await expect(page.getByText('2 new', { exact: true })).toBeVisible();
  await expect(page.getByText('Tap a photo to start', { exact: true })).toHaveCount(0); // DEC-61
  await expect(page.getByText(/^From Alex (today|since \S+)$/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^See all(?! the photos)/ })).toBeVisible();
  await expect(page.getByText(/^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Open photo from / }).first()).toBeAttached();
  await expect(page.getByRole('button', { name: /All photos|three to a row|See the new photos/ })).toHaveCount(0);
  await expect(page.getByText(/^Sent by /)).toHaveCount(0);
  await expect(page.getByText(/Grandparents –|Dad's side|Mom's side/)).toHaveCount(0); // RD-23
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); // the row scrolls inside itself
  await page.getByText('2 new', { exact: true }).click(); // the first tile
  await expect(page.getByText('New photos: 1 of 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Next/ }).first().click();
  await page.getByRole('button', { name: /^Done/ }).first().click();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  expect(errors.slice(before)).toEqual([]);
});
