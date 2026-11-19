// TD-UX-R1 (Nov 19 tech-debt review, P0): on a laptop the demo's story panel fits or scrolls. At 1280 x 800 its
// top line ("Hearth (working name) · demo") and its last line ("The family here is made up...") were cut off and
// the panel didn't scroll, so the sample-data line a recruiter needs was the part they couldn't see.
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

for (const height of [800, 720]) {
  test(`TD-UX-R1 at 1280 x ${height} the story panel's first and last lines can be seen`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height });
    await page.goto('/');
    const top = page.getByText('Hearth (working name) · demo');
    const last = page.getByText(/The family here is made up/);
    await expect(top).toBeAttached();
    const inView = (loc) => loc.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
    });
    expect(await inView(top)).toBe(true);
    await last.scrollIntoViewIfNeeded();
    expect(await inView(last)).toBe(true);
    // The page itself never scrolls sideways or down; only the panel does.
    expect(await page.evaluate(() => document.scrollingElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
  });
}
