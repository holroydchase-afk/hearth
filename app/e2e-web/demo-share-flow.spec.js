// FLOW-17 and FLOW-22 (DEC-90, docs/product/SPEC-SHARE-FLOW.md): the two-step Share flow in the public demo.
// Written first (red), Nov 26, 2026, by qa-tdd. Soft expects where several parts can be missing, so one run shows all.
const path = require('path');
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

const FIXTURE = path.join(__dirname, 'fixtures', 'park-gps.jpg');
const galleryLoaded = async (page) => {
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length)).toBeGreaterThan(0);
};
const BOX = /^(What's happening\?|What's your news\?|What did they say\?)$/;
const EVERYONE = /^Everyone, \d+ people, not picked$/;
const noToOrUnderline = async (page) => {
  await expect.soft(page.getByText(/(^|\s)To:/)).toHaveCount(0);
  for (const id of ['share-note-rule', 'share-to-rule']) await expect.soft(page.getByTestId(id)).toHaveCount(0);
  // no ruled underline field: no input draws a bottom border
  const underlined = await page.locator('input, textarea').evaluateAll((els) => els.filter((e) => parseFloat(getComputedStyle(e).borderBottomWidth) > 0 && getComputedStyle(e).borderBottomStyle !== 'none').length);
  expect.soft(underlined, 'no underline field on Share').toBe(0);
  expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
};
const step2 = async (page) => {
  await page.getByRole('button', { name: 'Next: who gets it' }).click();
  await expect(page.getByRole('heading', { name: 'Who gets it?' })).toBeVisible();
  await expect.soft(page.getByText('Step 2 of 2')).toBeVisible();
  await noToOrUnderline(page);
};
const pickDay = async (page) => {
  await page.getByRole('button', { name: 'Pick a day' }).click();
  await expect(page.getByTestId('day-sheet')).toBeVisible();
  await page.getByRole('button', { name: 'Tomorrow' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
};

for (const scheme of ['light', 'dark']) {
  for (const kind of ['Photos', 'Event', 'News', 'Saying']) {
    test(`FLOW-22 demo 393 px, ${scheme}: ${kind} goes step 1, step 2, sent; no "To:" and no underline field`, async ({ page }) => {
      await page.setViewportSize({ width: 393, height: 852 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      await galleryLoaded(page);
      await page.getByRole('tab', { name: /^Share/ }).click();
      if (kind === 'Photos') {
        const chooser = page.waitForEvent('filechooser', { timeout: 15_000 });
        await page.getByRole('button', { name: /^Add photos( or videos)?, up to \d+ at a time$/ }).filter({ visible: true }).first().click();
        await (await chooser).setFiles([FIXTURE]);
        await expect(page.getByRole('heading', { name: 'New post' })).toBeVisible();
      } else {
        await page.getByRole('button', { name: { Event: 'Add an event', News: 'Share news', Saying: 'Add a saying' }[kind] }).click();
        await page.getByLabel(BOX).fill({ Event: 'Pumpkin patch', News: 'We found a house', Saying: 'The moon is following our car' }[kind]);
        if (kind === 'Event') await pickDay(page);
        if (kind === 'Saying') { await page.getByRole('button', { name: 'Who said it?' }).click(); await page.getByLabel('Who said it', { exact: true }).fill('Leo'); }
      }
      await expect.soft(page.getByText('Step 1 of 2')).toBeVisible();
      await noToOrUnderline(page);
      await step2(page);
      await page.getByRole('button', { name: EVERYONE }).click();
      await page.getByRole('button', { name: /^Send to / }).click();
      await expect(page.getByRole('heading', { name: 'Sent' })).toBeVisible({ timeout: 60_000 });
      await expect.soft(page.getByRole('button', { name: 'See it in Feed' })).toBeVisible();
      await expect.soft(page.getByRole('button', { name: 'Share another' })).toBeVisible();
      await page.screenshot({ path: path.join(__dirname, '..', 'test-results', 'flow-22', `${kind}-${scheme}.png`) });
    });
  }
}

for (const width of [360, 412]) {
  test(`FLOW-17 the day sheet at ${width} px: month buttons and every day cell >= 48 tall and >= 44 wide, none clipped`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await galleryLoaded(page);
    await page.getByRole('tab', { name: /^Share/ }).click();
    await page.getByRole('button', { name: 'Add an event' }).click();
    await page.getByRole('button', { name: 'Pick a day' }).click();
    const sheet = page.getByTestId('day-sheet');
    await expect(sheet).toBeVisible();
    const sb = await sheet.boundingBox();
    const cells = page.locator('[data-testid^="day-20"]').filter({ visible: true });
    expect(await cells.count()).toBeGreaterThanOrEqual(28);
    const bad = await cells.evaluateAll((els, vw) => els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.testid, w: r.width, h: r.height, out: r.left < 0 || r.right > vw }; }).filter((c) => c.h < 48 || c.w < 44 || c.out), width);
    expect(bad).toEqual([]);
    expect(sb.x).toBeGreaterThanOrEqual(0);
    expect(sb.x + sb.width).toBeLessThanOrEqual(width);
    for (const name of ['Earlier month', 'Later month']) {
      const b = await page.getByRole('button', { name }).boundingBox();
      expect({ name, ok: b.height >= 48 && b.width >= 44 }).toEqual({ name, ok: true });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // the page behind is covered, and a tap outside closes the sheet
    await page.mouse.click(Math.round(width / 2), 250);
    await expect(sheet).toHaveCount(0);
  });
}
