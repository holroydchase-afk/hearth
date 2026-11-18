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
  await page.getByRole('button', { name: "Back to Chase's view, the parent" }).click();
  await details(page);
  await expect(page.getByText(/You're Chase, a parent/)).toBeVisible();
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
  await page.getByRole('button', { name: 'Post', exact: true }).click();
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

// RD-102 (SPEC-REDESIGN 1i, DEC-68, Chase Nov 18; replaces RD-27's Family color). Written first (red), Nov 18, by
// qa-tdd. Paper is the default page (rgb(250, 248, 243) light, rgb(19, 18, 16) dark; never white or tan); as Chase,
// More → Theme → Avocado and Pomegranate recolor the page and the pick survives a reload; Grandma Jo stays Paper with
// no Theme row; the tab bar is c.surface with a c.line top border (RD-104). Photo shadows stay for now (Chase
// deciding), so no shadow check here (RD-92 keeps it). Screenshots of all three themes, light and dark.
test('RD-102 Paper by default; Chase picks Avocado then Pomegranate, it survives a reload; Grandma Jo stays Paper', async ({ page }) => {
  const PAGE = {
    paper: { light: 'rgb(250, 248, 243)', dark: 'rgb(19, 18, 16)' },
    avocado: { light: 'rgb(238, 239, 211)', dark: 'rgb(16, 20, 12)' },
    pomegranate: { light: 'rgb(245, 234, 223)', dark: 'rgb(23, 13, 16)' },
  };
  const WORD = { paper: 'Paper', avocado: 'Avocado', pomegranate: 'Pomegranate' };
  const shots = path.join(__dirname, '..', 'test-results', 'rd-102');
  // The Gallery backing: the first painted ancestor of the grid (the browser's white if none).
  const galleryBg = () => page.evaluate(() => {
    const opaque = (c) => c && c !== 'transparent' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c);
    let g = document.querySelector('[data-testid="gallery-grid"]');
    while (g && !opaque(getComputedStyle(g).backgroundColor)) g = g.parentElement;
    return g ? getComputedStyle(g).backgroundColor : 'rgb(255, 255, 255)';
  });
  // T22 (qa-tdd, Nov 18 green run): the pick happens on the Theme screen, which has no "More" heading, so read
  // the Theme heading's backing (the old 'More' locator timed out with the page already recolored).
  const themeBg = () => page.getByRole('heading', { name: 'Theme' }).evaluate((el) => {
    const opaque = (c) => c && c !== 'transparent' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c);
    let n = el;
    while (n && !opaque(getComputedStyle(n).backgroundColor)) n = n.parentElement;
    return n ? getComputedStyle(n).backgroundColor : 'rgb(255, 255, 255)';
  });
  const tabBar = () => page.getByRole('tablist').evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, top: s.borderTopWidth, painted: s.backgroundColor !== 'rgba(0, 0, 0, 0)' };
  });
  const toGallery = async () => { await page.getByRole('tab', { name: /^Gallery/ }).click(); await galleryLoaded(page); };
  const pick = async (theme) => {
    await page.getByRole('tab', { name: /^More/ }).click();
    await page.getByRole('button', { name: /^Theme(,|$)/ }).click();
    await expect(page.getByRole('heading', { name: 'Theme' })).toBeVisible();
    await page.getByRole('radio', { name: `${WORD[theme]} theme` }).click();
    await expect(page.getByRole('radio', { name: `${WORD[theme]} theme` })).toBeChecked();
  };

  await page.setViewportSize({ width: 393, height: 852 });
  for (const look of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: look });
    await page.goto('/');
    await resetDemo(page);
    await page.reload();
    await galleryLoaded(page);
    // Light starts from a fresh demo (the default); dark follows light's Pomegranate, so it picks Paper back first.
    if (look === 'dark') { await pick('paper'); await toGallery(); }
    expect.soft({ look, gallery: await galleryBg() }).toEqual({ look, gallery: PAGE.paper[look] });
    const bar = await tabBar();
    expect.soft({ look, painted: bar.painted, notPage: bar.bg !== PAGE.paper[look], top: bar.top }).toEqual({ look, painted: true, notPage: true, top: '1px' });
    await page.screenshot({ path: path.join(shots, `rd-102-paper-${look}.png`) });
    for (const theme of ['avocado', 'pomegranate']) {
      await pick(theme);
      await expect.poll(themeBg).toBe(PAGE[theme][look]);
      await toGallery();
      expect.soft({ look, theme, gallery: await galleryBg() }).toEqual({ look, theme, gallery: PAGE[theme][look] });
      await page.screenshot({ path: path.join(shots, `rd-102-${theme}-${look}.png`) });
    }
    // The pick survives a reload.
    await page.reload();
    await galleryLoaded(page);
    expect.soft({ look, afterReload: await galleryBg() }).toEqual({ look, afterReload: PAGE.pomegranate[look] });
  }

  // Grandma Jo stays Paper, with no Theme row.
  await page.emulateMedia({ colorScheme: 'light' });
  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await details(page);
  await expect(page.getByText(/You're Grandma Jo/)).toBeVisible();
  await toGallery();
  expect.soft({ jo: await galleryBg() }).toEqual({ jo: PAGE.paper.light });
  await page.getByRole('tab', { name: /^More/ }).click();
  await expect(page.getByRole('heading', { name: 'More' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Theme|Family color)(,|$)/ })).toHaveCount(0);
});

// RD-9 / RD-10 / RD-15 (SPEC-REDESIGN 1b) on the demo build at a 360 px phone: Chase's tabs are Gallery, Share,
// Feed, More with Gallery picked on open; More is a full-screen menu in the spec's order; Grandma Jo's view has
// Gallery, Feed, More and no Groups or Theme (RD-98).
test('RD-9 RD-10 RD-15 Gallery opens first; More is a full-screen menu; Grandma Jo gets three tabs', async ({ page }) => {
  const before = errors.length; // `errors` spans the file; HARD-7's blocked storage logs one on purpose
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await galleryLoaded(page);
  // engineer, flagged for qa-tdd: Chase's Easy view is Off (RD-76), so the tabs are read by their spoken names, not their words.
  for (const name of ['Gallery', 'Share', 'Feed', 'More']) await expect(page.getByRole('tab', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(4);
  // qa-tdd: keep RD-9's order check (the words went with Easy view Off; the order must stay).
  expect(await page.getByRole('tab').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).toEqual(['Gallery', 'Share', 'Feed', 'More']);
  await expect(page.getByRole('tab', { name: 'Gallery' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  await page.getByRole('tab', { name: /^More/ }).click();
  await expect(page.getByRole('heading', { name: 'More' })).toBeVisible();
  const rows = ['Messages', 'Groups', 'Events', 'Easy view', 'Light or dark', 'Theme', 'Me', 'Help']; // engineer, flagged for qa-tdd: RD-78
  const labels = async () => (await page.getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.textContent ?? '')))
    .map((l) => l.split(',')[0]).filter((l) => /^(Messages|Groups|Events|Easy view|Light or dark|Theme|Me|Help)$/.test(l));
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
  expect(await labels()).toEqual(rows.filter((r) => r !== 'Groups' && r !== 'Theme'));
  expect(errors.slice(before)).toEqual([]);
});

// RD-18..RD-21 (SPEC-REDESIGN 1c) on the demo build at a 360 px phone: Chase's last visit was 3 days ago and Alex
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

// ---------------------------------------------------------------------------------------------------------------
// Review round 1 (ux-reviewer on Chase's iPhone, Nov 17; SPEC-REDESIGN RD-35..). Written first (red).

// UX-R12 (Chase, Nov 17): the demo parent is Chase, so the greeting uses his name.
test('UX-R12 the demo greets the parent as Chase and "Kai" appears nowhere', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening), Chase$/ })).toBeVisible();
  await details(page);
  await expect(page.getByText(/You're Chase, a parent/)).toBeVisible();
  expect(await page.evaluate(() => /\bKai\b/.test(document.body.innerText))).toBe(false);
});

// RD-44 (DEC-65, Nov 17; replaces UX-R7's edge-to-edge grid, RD-39) and UX-R13 (review round 2): Gallery is Apple
// Photos' months mosaic. Each MONTH opens on one wide 3:2 photo, then squares (three across; a short last row widens
// to fill, never one square alone); 16 px corners, 8 px gaps, inside 16 px side margins.
const MONTH = /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/;
for (const width of [360, 390]) {
  test(`RD-44 UX-R13 months mosaic at a ${width} px phone: one wide photo per month, then rounded squares that fill each row, inset 16`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await galleryLoaded(page);
    const tiles = page.locator('[data-testid^="gallery-tile-"]');
    await expect(tiles.first()).toBeAttached();
    await tiles.first().scrollIntoViewIfNeeded();
    const n = await tiles.count();
    const boxes = [];
    for (let i = 0; i < n; i++) {
      await tiles.nth(i).scrollIntoViewIfNeeded();
      boxes.push(await tiles.nth(i).boundingBox());
    }
    const hero = boxes[0];
    const inner = width - 32;
    const third = (inner - 16) / 3;
    const half = (inner - 8) / 2;
    expect({ left: Math.round(hero.x), right: Math.round(width - hero.x - hero.width), wide: Math.abs(hero.width / hero.height - 1.5) <= 0.03 })
      .toEqual({ left: 16, right: 16, wide: true });
    // Each tile is the month's wide opener (full inner width, 3:2) or a square a third or a half of the row.
    let wides = 0;
    for (const [i, t] of boxes.entries()) {
      const isWide = Math.abs(t.width - inner) <= 1.5 && Math.abs(t.width / t.height - 1.5) <= 0.03;
      const isSquare = [third, half].some((w) => Math.abs(t.width - w) <= 1.5) && Math.abs(t.width - t.height) <= 1.5;
      if (isWide) wides += 1;
      expect({ i, ok: isWide || isSquare, insideMargins: t.x >= 15.5 && t.x + t.width <= width - 15.5 }).toEqual({ i, ok: true, insideMargins: true });
    }
    // UX-R13: one wide photo per month, not per day.
    const months = await page.getByText(MONTH).count();
    expect({ wides, months }).toEqual({ wides: months, months });
    // UX-R13: no square alone on its row.
    const rows = new Map();
    for (const t of boxes) if (Math.abs(t.width - inner) > 1.5) rows.set(Math.round(t.y), (rows.get(Math.round(t.y)) ?? 0) + 1);
    expect([...rows.values()].filter((k) => k < 2)).toEqual([]);
    const radius = await tiles.first().evaluate((el) => {
      const all = [el, ...el.querySelectorAll('*')];
      return Math.max(...all.map((x) => parseFloat(getComputedStyle(x).borderTopLeftRadius) || 0));
    });
    expect(radius).toBe(16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

// RD-47 (Chase: "Search- B but hide the months vs all toggle for now"): a "Search photos" field under the greeting; no
// top-right Search or By date; no Months | All photos switch.
test('RD-47 a "Search photos" field under the greeting opens Search; By date and the view switch are gone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await galleryLoaded(page);
  const field = page.getByLabel('Search photos').first();
  await expect(field).toBeVisible();
  const g = await page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ }).boundingBox();
  const f = await field.boundingBox();
  expect(f.y).toBeGreaterThan(g.y + g.height - 1);
  expect(Math.round(f.height)).toBeGreaterThanOrEqual(48);
  await expect(page.getByRole('button', { name: 'Show photos by the date they were taken' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Search the photos' })).toHaveCount(0);
  await expect(page.getByText('By date', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^(Months|All photos)$/)).toHaveCount(0);
  // It pins under the bar when Gallery scrolls.
  await page.mouse.move(180, 500);
  await page.mouse.wheel(0, 1500);
  await expect.poll(async () => (await page.getByLabel('Search photos').first().boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
  await expect(page.getByLabel('Search photos').first()).toBeInViewport();
  await page.getByLabel('Search photos').first().click();
  await expect(page.getByRole('heading', { name: 'Search photos' })).toBeVisible();
});

// UX-R1 (P0): typing a comment in the walk. The tab bar goes away while the field is focused, and the field stays in
// view and uncovered when the screen gets shorter (a keyboard opening; a real iPhone keyboard is manual case M-19).
test('UX-R1 focusing the walk\'s comment field hides the tab bar and keeps the field uncovered when the keyboard opens', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await page.getByText('2 new', { exact: true }).click();
  await expect(page.getByText('New photos: 1 of 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(4);
  const field = page.getByRole('textbox');
  await expect(field).toHaveCount(1);
  await field.click();
  await field.fill('So pretty');
  await expect(page.getByRole('tab')).toHaveCount(0); // the tab bar is gone while typing
  await page.setViewportSize({ width: 390, height: 480 }); // about a keyboard's worth less screen
  await expect.poll(async () => field.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.bottom - 4;
    const hit = document.elementFromPoint(x, y);
    return r.bottom <= window.innerHeight && !!hit && (hit === el || el.contains(hit));
  })).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await field.evaluate((el) => el.blur());
  await expect(page.getByRole('tab')).toHaveCount(4);
});

test('DEMO-FRESH-1 a browser that saved an older demo family sees the current one on its next visit', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  // Pretend this browser kept the family from an older demo: the parent was Kai, and no seed version was saved.
  await page.evaluate(() => {
    const k = 'hearth.fakeBackend.v1';
    localStorage.setItem(k, localStorage.getItem(k).replaceAll('"Chase"', '"Kai"'));
    localStorage.removeItem('hearth.demoSeed');
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening), Chase$/ })).toBeVisible();
  await expect(page.getByText(/\bKai\b/)).toHaveCount(0);
});

// ---------------------------------------------------------------------------------------------------------------
// Review round 2 (ux-reviewer, Nov 17; SPEC-REDESIGN RD-56..). Written first (red).

// R18 (P2): scrolling Gallery, the current month's title sticks right under the pinned "Search photos" field.
test('R18 the current month title sticks under the pinned search field while Gallery scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await galleryLoaded(page);
  await page.mouse.move(195, 600);
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(400);
  const field = await page.getByLabel('Search photos').first().boundingBox();
  const heads = await page.getByText(MONTH).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }));
  // Some month title sits just under the field (within 24 px), not scrolled away above it.
  const stuck = heads.filter((h) => h.top >= field.y + field.height - 1 && h.top <= field.y + field.height + 24);
  expect({ field: Math.round(field.y + field.height), stuck: stuck.length }).toEqual({ field: Math.round(field.y + field.height), stuck: 1 });
});

// RD-83 (Chase on iPhone, Nov 17): scrolling down, then back up, the pinned month title stays glued to the search
// bar's backing: its top on the backing's bottom (±0.5 px), and no photo shows between them or past either side.
test('RD-83 greeting, search bar and month title stay one pinned block after scrolling down and back at 393 px', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/');
  await galleryLoaded(page);
  await page.mouse.move(196, 600);
  await page.mouse.wheel(0, 1600); // mouse.wheel fires RN-web's onScroll; scrollTo does not
  await page.waitForTimeout(400);
  // engineer, flagged for qa-tdd: back up 250, not 500. The demo's Gallery scrolls about 990 px in all, so 500 landed
  // 17 px above where the first month reaches the bar (its title then scrolls with the page, as RD-83's jest allows),
  // which measured that release point, not a pinned title. `reached` below proves the title is pinned here.
  await page.mouse.wheel(0, -250);
  await page.waitForTimeout(400);
  const got = await page.getByLabel('Search photos').first().evaluate((field) => {
    // The backing: the sticky wrapper's child that holds the field (RD-82's full-width bar).
    let el = field;
    while (el.parentElement && getComputedStyle(el.parentElement).position !== 'sticky') el = el.parentElement;
    const backing = el.parentElement ? el : field;
    const bottom = backing.getBoundingClientRect().bottom;
    const re = /^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/;
    const heads = [...document.querySelectorAll('[role="heading"]')].filter((h) => re.test(h.textContent.trim()))
      .map((h) => ({ h, top: h.getBoundingClientRect().top })).filter((x) => x.top < 852);
    const stuck = heads.sort((a, b) => Math.abs(a.top - bottom) - Math.abs(b.top - bottom))[0];
    // What shows just under the bar at the left edge, middle and right edge: it must be the month title, not a photo.
    const under = [2, 196, 391].map((x) => {
      const hit = document.elementFromPoint(x, bottom + 1);
      return { x, title: !!(hit && stuck && stuck.h.contains(hit)) || hit === stuck?.h, photo: !!hit?.closest('[data-testid^="gallery-tile-"]') };
    });
    // The month block has reached the bar (so its title should be pinned), and the title pins by the browser's own
    // sticky at the backing's height, not by a per-scroll-event transform that can lag on iPhone Safari.
    const cs = stuck ? getComputedStyle(stuck.h) : null;
    const reached = !!stuck && stuck.h.parentElement.getBoundingClientRect().top <= bottom;
    const native = !!cs && cs.position === 'sticky' && Math.abs(parseFloat(cs.top) - backing.getBoundingClientRect().height) <= 0.5 && cs.transform === 'none';
    return { gap: stuck ? Math.round((stuck.top - bottom) * 2) / 2 : null, under, reached, native };
  });
  expect({ reached: got.reached, native: got.native }).toEqual({ reached: true, native: true });
  expect(got.gap).not.toBeNull();
  expect(Math.abs(got.gap)).toBeLessThanOrEqual(0.5);
  expect(got.under).toEqual([2, 196, 391].map((x) => ({ x, title: true, photo: false })));
});

// R23 (P2, G9 in scripts/ux-rules.mjs): every tab has exactly one h1, its title.
test('R23 Gallery, Share, Feed and More each have exactly one h1', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await galleryLoaded(page);
  // Tabs left behind stay mounted but aria-hidden; count what a screen reader can reach.
  const h1s = async () => page.locator('h1').evaluateAll((els) => els.filter((e) => !e.closest('[aria-hidden="true"],[inert]')).map((e) => e.innerText));
  const got = {};
  for (const tab of ['Gallery', 'Share', 'Feed', 'More']) {
    await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
    await page.waitForTimeout(500);
    got[tab] = await h1s();
  }
  expect(Object.fromEntries(Object.entries(got).map(([k, v]) => [k, v.length]))).toEqual({ Gallery: 1, Share: 1, Feed: 1, More: 1 });
  expect(got.Gallery[0]).toMatch(/^Good (morning|afternoon|evening)/);
});

// UX-R27 (review round 3, RD-70): at default text size on a 390 px phone, each who-can-see line fits on one line
// (two names at most, then "and N more"); the Who sheet keeps the full list.
test('UX-R27 every "can see this." line on Feed is one line at 390 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await galleryLoaded(page);
  await onFeed(page);
  const lines = page.getByText(/can see this\.$/).filter({ visible: true });
  await expect(lines.first()).toBeVisible();
  const got = await lines.evaluateAll((els) => els.map((e) => {
    const lh = parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.3;
    return { words: e.innerText, lines: Math.round(e.getBoundingClientRect().height / lh) };
  }));
  expect(got.filter((l) => l.lines > 1)).toEqual([]);
});

// RD-77 / RD-80 (SPEC-REDESIGN 1g, DEC-66): Easy view. Chase (owner) starts Off: icon-only tabs that keep their
// spoken names. Grandma Jo (viewer) starts On: a word under each tab and bigger text. Each person's pick is kept
// separately in the browser. Written first (Nov 17), red until Easy view exists.
const tabWordsShown = (page) => page.getByRole('tab').evaluateAll((els) => els.map((e) => (e.innerText || '').replace(/[^A-Za-z ]/g, '').trim()));
const captionSize = (page) => page.getByText('Life jackets on and in all afternoon', { exact: true }).filter({ visible: true }).first()
  .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
const asJo = async (page) => {
  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await details(page);
  await expect(page.getByText(/You're Grandma Jo/)).toBeVisible();
};
const asChase = async (page) => {
  await details(page);
  await page.getByRole('button', { name: "Back to Chase's view, the parent" }).click();
  await details(page);
  await expect(page.getByText(/You're Chase, a parent/)).toBeVisible();
};

test('RD-80 RD-76 RD-77 Chase has icon-only tabs; Grandma Jo has words under the tabs and bigger text; back to Chase restores Off', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await galleryLoaded(page);
  await expect(page.getByRole('tab')).toHaveCount(4);
  for (const name of ['Gallery', 'Share', 'Feed', 'More']) await expect(page.getByRole('tab', { name, exact: true })).toBeVisible();
  expect(await tabWordsShown(page)).toEqual(['', '', '', '']); // RD-76: icons only, spoken names kept
  await expect(page.getByRole('tab', { name: 'Gallery', exact: true })).toHaveAttribute('aria-selected', 'true');
  for (const box of await page.getByRole('tab').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))) {
    expect({ h: box.height >= 48, w: box.width >= 48 }).toEqual({ h: true, w: true });
  }
  await onFeed(page);
  expect(await captionSize(page)).toBe(17);

  await asJo(page);
  await expect.poll(() => tabWordsShown(page)).toEqual(['Gallery', 'Feed', 'More']); // RD-77: a word under every tab
  const words = await page.getByRole('tab').evaluateAll((els) => els.map((e) => {
    const t = [...e.querySelectorAll('div')].find((d) => d.children.length === 0 && d.innerText.trim() !== '');
    return { size: t ? parseFloat(getComputedStyle(t).fontSize) : 0, clipped: t ? t.scrollWidth > t.clientWidth + 1 : true };
  }));
  for (const w of words) expect(w).toEqual({ size: expect.any(Number), clipped: false });
  expect(Math.min(...words.map((w) => w.size))).toBeGreaterThanOrEqual(17);
  await onFeed(page);
  expect(await captionSize(page)).toBe(21);

  await asChase(page);
  await expect.poll(() => tabWordsShown(page)).toEqual(['', '', '', '']);
  await onFeed(page);
  expect(await captionSize(page)).toBe(17);
});

test("RD-80 RD-78 each person's Easy view pick is kept separately: Chase turns it On, Jo turns hers Off, Chase's stays On", async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await page.getByRole('tab', { name: /^More/ }).click();
  await page.getByRole('button', { name: 'Easy view, Off' }).click();
  await expect(page.getByRole('heading', { name: 'Easy view' })).toBeVisible();
  await expect(page.getByText('Bigger words, and a word under each button at the bottom of the screen.')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Off', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'On', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'On', exact: true })).toBeChecked();
  await expect.poll(() => tabWordsShown(page)).toEqual(['Gallery', 'Share', 'Feed', 'More']); // at once, no reload

  await asJo(page);
  await page.getByRole('tab', { name: /^More/ }).click();
  await page.getByRole('button', { name: 'Easy view, On' }).click();
  await page.getByRole('radio', { name: 'Off', exact: true }).click();
  await expect.poll(() => tabWordsShown(page)).toEqual(['', '', '']);

  await asChase(page);
  await expect.poll(() => tabWordsShown(page)).toEqual(['Gallery', 'Share', 'Feed', 'More']);
  await page.reload();
  await galleryLoaded(page);
  await expect.poll(() => tabWordsShown(page)).toEqual(['Gallery', 'Share', 'Feed', 'More']);
});

// RD-92 (SPEC-REDESIGN 1h, DEC-67, Chase Nov 18): warm paper, soft photo shadows in light only, and the reaction pop
// (retargeted Nov 18 by qa-tdd for DEC-68: the page is Paper #FAF8F3 / #131210, not tan; shadows and pop unchanged)
// with its reduced-motion fallback, in the public demo at 393 px. Written first (red), Nov 18, by qa-tdd.
// Soft expects, so one run shows every part of RD-92 that is still missing.
test('RD-92 RD-94 Paper, photo shadows and the reaction pop in the demo, light and dark, with reduced motion', async ({ page }) => {
  const PAPER = 'rgb(250, 248, 243)';
  const WARM_BLACK = 'rgb(19, 18, 16)';
  const shots = path.join(__dirname, '..', 'test-results', 'rd-92');
  // The page behind the app (the demo frame, the app root, body, html; the browser's white if none) and the Gallery
  // backing (the first painted ancestor of the grid).
  const backings = () => page.evaluate(() => {
    const opaque = (c) => c && c !== 'transparent' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c);
    const bg = (el) => (el ? getComputedStyle(el).backgroundColor : null);
    const pageEl = [document.querySelector('[data-testid="demo-frame"]'), document.getElementById('root'), document.body, document.documentElement].find((el) => el && opaque(bg(el)));
    let g = document.querySelector('[data-testid="gallery-grid"]');
    while (g && !opaque(bg(g))) g = g.parentElement;
    return { page: pageEl ? bg(pageEl) : 'rgb(255, 255, 255)', gallery: g ? bg(g) : 'rgb(255, 255, 255)' };
  });
  // A photo tile's shadow: on the tile or one of its two wrappers.
  const shadowNear = (loc) => loc.evaluate((el) => {
    for (let n = el, i = 0; n && i < 3; n = n.parentElement, i++) {
      const s = getComputedStyle(n).boxShadow;
      if (s && s !== 'none') return s;
    }
    return 'none';
  });
  const galleryTile = () => page.locator('[data-testid^="gallery-tile-"]').filter({ visible: true }).first();
  const feedPhoto = () => page.getByRole('button', { name: /^Open photo 1 of \d+/ }).filter({ visible: true }).first();
  const love = () => page.getByRole('button', { name: 'Love it' }).filter({ visible: true }).first();
  const loveOff = async () => {
    if ((await love().getAttribute('aria-selected')) === 'true' || (await love().getAttribute('aria-pressed')) === 'true') {
      await love().click();
      await page.waitForTimeout(400);
    }
  };
  // Sample for 400 ms from just before the tap: the biggest scale drawn inside the heart, when it first passed 1, and
  // how far the heart and its neighbour (Haha) moved from where they started.
  const tapAndSample = async () => {
    await love().evaluate((btn) => {
      const haha = btn.parentElement.querySelector('[aria-label="Haha"]');
      const rect = (el) => el.getBoundingClientRect();
      const scaleOf = (el) => {
        const t = getComputedStyle(el).transform;
        if (!t || t === 'none') return 1;
        const m = /matrix\(([^)]+)\)/.exec(t);
        return m ? Math.hypot(...m[1].split(',').slice(0, 2).map(Number)) : 1;
      };
      const start = { heart: rect(btn), haha: rect(haha) };
      const t0 = performance.now();
      window.__rd92 = new Promise((resolve) => {
        const got = { maxScale: 1, firstAbove1: null, heartShift: 0, hahaShift: 0 };
        const tick = () => {
          const t = performance.now() - t0;
          const s = Math.max(...[btn, ...btn.querySelectorAll('*')].map(scaleOf));
          if (s > 1.001 && got.firstAbove1 === null) got.firstAbove1 = t;
          got.maxScale = Math.max(got.maxScale, s);
          const h = rect(btn); const n = rect(haha);
          got.heartShift = Math.max(got.heartShift, Math.abs(h.x - start.heart.x), Math.abs(h.width - start.heart.width), Math.abs(h.y - start.heart.y));
          got.hahaShift = Math.max(got.hahaShift, Math.abs(n.x - start.haha.x), Math.abs(n.y - start.haha.y));
          if (t < 400) requestAnimationFrame(tick); else resolve(got);
        };
        requestAnimationFrame(tick);
      });
    });
    await love().click();
    return page.evaluate(() => window.__rd92);
  };

  // Light
  await page.setViewportSize({ width: 393, height: 852 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.goto('/');
  await galleryLoaded(page);
  expect.soft(await backings()).toEqual({ page: PAPER, gallery: PAPER });
  expect.soft(await shadowNear(galleryTile())).not.toBe('none');
  await page.screenshot({ path: path.join(shots, 'rd-92-light-gallery.png') });
  await onFeed(page);
  expect.soft(await shadowNear(feedPhoto())).not.toBe('none');
  await loveOff();
  const pop = await tapAndSample();
  expect.soft({ popped: pop.maxScale > 1, inTime: pop.firstAbove1 !== null && pop.firstAbove1 <= 250, heartShift: pop.heartShift <= 0.5, hahaShift: pop.hahaShift <= 0.5 })
    .toEqual({ popped: true, inTime: true, heartShift: true, hahaShift: true });
  await page.screenshot({ path: path.join(shots, 'rd-92-light-feed.png') });

  // Reduced motion: no scale
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('tab', { name: /^Gallery/ }).click();
  await galleryLoaded(page);
  await onFeed(page);
  await loveOff();
  const calm = await tapAndSample();
  expect.soft({ maxScale: calm.maxScale }).toEqual({ maxScale: 1 });

  // Dark
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('tab', { name: /^Gallery/ }).click();
  await galleryLoaded(page);
  expect.soft(await backings()).toEqual({ page: WARM_BLACK, gallery: WARM_BLACK });
  expect.soft(await shadowNear(galleryTile())).toBe('none');
  await page.screenshot({ path: path.join(shots, 'rd-92-dark-gallery.png') });
  await onFeed(page);
  expect.soft(await shadowNear(feedPhoto())).toBe('none');
  await page.screenshot({ path: path.join(shots, 'rd-92-dark-feed.png') });
});
