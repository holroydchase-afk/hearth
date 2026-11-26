// DEMO-1..3, DEMO-10, RR-14: the public demo a recruiter opens from chaseholroyd.com.
// No sign-in, a sample family with pictures, a demo bar, Grandma Jo's view, and add / edit / reload / start over.
const path = require('path');
const { test, expect } = require('../../e2e/node_modules/@playwright/test');
const { settle: settleWith, pageReady, frames, SLOW } = require('./helpers/settle');
// INTAKE-206: every settle here follows a click, wheel or theme change, so it must stay still for ~400 ms (QA-R2).
const settle = (page, read) => settleWith(page, read, SLOW);

// DEMO-BAR: Grandma's view and Reset live in the Details drawer.
const details = async (page) => {
  const t = page.getByRole('button', { name: 'Demo details' });
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
};
const resetDemo = async (page) => {
  await details(page);
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  // QA-R2 (T28): Reset waits for saves before it navigates (DEMO-SAFARI), so wait for the fresh page's note.
  await expect(page.getByText('Sample data restored.')).toBeVisible();
};

// RD-18 (redesign 1c): Gallery shows photos, not captions. "Loaded" = the greeting and a drawn picture; captions are
// checked on Feed (RD-17), which keeps the post list.
const galleryLoaded = async (page) => {
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth > 0).length)).toBeGreaterThan(0);
};
// INTAKE-206: after a wheel, wait for the month titles to stop moving (not a fixed sleep).
const settleMonths = (page) => settle(page, () => page.getByText(MONTH).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top))));
const onFeed = async (page) => {
  await page.getByRole('tab', { name: /^Feed/ }).click();
  // DEMO-PHOTO-8: the newest post (Eliza's balance bike ride) tops Feed.
  await expect(page.getByText(/First ride on the balance bike/).filter({ visible: true }).first()).toBeVisible();
};
// DEMO-PHOTO-11: Gallery's photo tiles (RD-44), all in the page at once (a ScrollView, not a list).
const galleryTiles = (page) => page.locator('[data-testid^="gallery-tile-"]');
// Every post's words on Feed (title and caption), from PostCard's description block.
const feedWords = (page) => page.locator('[data-testid^="desc-"]').evaluateAll((els) => els.map((e) => e.textContent.trim()));

const FIXTURE = path.join(__dirname, 'fixtures', 'park-gps.jpg');

// DEC-79 (SHARE-ST-8; retargeted Nov 21 by qa-tdd): Share opens on the empty postcard ("New post"); its one
// "Add photos, up to N at a time" target opens the file chooser. Set the files and wait for the postcard's Cancel.
const ADD_PHOTOS = /^Add photos( or videos)?, up to \d+ at a time$/;
const openNewPost = async (page, files) => {
  await page.getByRole('tab', { name: /^Share/ }).click();
  await expect(page.getByRole('heading', { name: 'New post' })).toBeVisible();
  const chooser = page.waitForEvent('filechooser', { timeout: 15_000 });
  await page.getByRole('button', { name: ADD_PHOTOS }).filter({ visible: true }).first().click();
  await (await chooser).setFiles(files);
  await expect(page.getByRole('button', { name: 'Cancel this post' })).toBeVisible();
};
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

test("DEMO-NAMES-5 DEMO-10 RD-17 Grandma Jo's view hides the Mom's-side posts; the parent's view shows them again", async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await details(page);
  await expect(page.getByText(/You're Grandma Jo/)).toBeVisible();
  await onFeed(page);
  // Updated Nov 24 (DEMO-PHOTO-8): Dad's side shows (the pancakes), Mom's side (one orchard photo) does not.
  await expect(page.getByText(/Aunt Libby taught the kids to make pancakes/).first()).toBeAttached();
  await expect.poll(async () => (await feedWords(page)).length).toBe(6);
  await details(page);
  await page.getByRole('button', { name: "Back to Graham's view, the parent" }).click();
  await details(page);
  await expect(page.getByText(/You're Graham, a parent/)).toBeVisible();
  await onFeed(page);
  await expect.poll(async () => (await feedWords(page)).length).toBe(7);
});

// DEMO-PHOTO-11 (SPEC-DEMO-PHOTOS, DEC-82). Written first (Nov 24, qa-tdd): Grandma Jo's Gallery and Feed hold posts
// 1, 2, 4, 5, 6 and 7 (18 photos), never Mom's-side post 3 (orchard-4543661); the way back reads "Back to Graham's view".
test("DEMO-NAMES-5 DEMO-PHOTO-11 Grandma Jo's view: 18 photos in 6 posts, never Mom's-side post 3; the way back reads Back to Graham's view", async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await expect.poll(() => galleryTiles(page).count()).toBe(19);
  await onFeed(page);
  await expect.poll(async () => (await feedWords(page)).length).toBe(7);
  const kevins = await feedWords(page);
  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await details(page);
  await expect(page.getByText(/You're Grandma Jo/)).toBeVisible();
  await expect(page.getByRole('button', { name: "Back to Graham's view, the parent" })).toBeVisible();
  await expect(page.getByText("Back to Graham's view", { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /^Gallery/ }).click();
  await expect.poll(() => galleryTiles(page).count()).toBe(18);
  await onFeed(page);
  await expect.poll(async () => (await feedWords(page)).length).toBe(6);
  const hers = await feedWords(page);
  for (const t of ['Apple blossoms at the orchard', 'Shoulder rides all afternoon', 'Aunt Libby taught the kids to make pancakes', 'First ride on the balance bike']) {
    expect({ t, shown: hers.some((w) => w.includes(t)) }).toEqual({ t, shown: true });
  }
  // The one post Graham sees and Jo doesn't is post 3, Mom's side.
  expect(kevins.filter((w) => !hers.includes(w))).toHaveLength(1);
});

test('RR-14 add a photo, reload keeps it, Start over brings back the sample family', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  // Retargeted Nov 19 by qa-tdd for DEC-73 (SHARE-PC): the postcard's note, a face tile and "Send to ...".
  await openNewPost(page, [FIXTURE]);
  await page.getByLabel('Say something, optional').fill('Leaf pile');
  await page.getByRole('button', { name: 'Next: who gets it' }).click(); // DEC-91: step 2
  await page.getByLabel(/^Grandparents – Dad's side, \d+ people, not picked$/).click();
  await page.getByRole('button', { name: /^Send to / }).click();
  await page.getByRole('button', { name: 'See it in Feed' }).click(); // DEC-91: the sent page
  await onFeed(page); // RD-18: captions live on Feed (Gallery may stay mounted behind it, so only what shows counts)
  await expect(page.getByText('Leaf pile', { exact: true }).filter({ visible: true })).toBeVisible();
  await page.reload();
  await onFeed(page);
  await expect(page.getByText('Leaf pile', { exact: true }).filter({ visible: true })).toBeVisible();
  await resetDemo(page);
  await onFeed(page);
  await expect(page.getByText('Leaf pile', { exact: true }).filter({ visible: true })).toHaveCount(0);
});

// FONT-5 (DEC-78, Nov 21): the web demo reads in Atkinson Hyperlegible Next too, the heading SemiBold and a caption
// Regular, and the bundled font file really loaded (not just named in CSS and falling back to the system font).
test('FONT-5 the demo\'s heading and body words are Atkinson Hyperlegible Next, and the font really loaded', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await onFeed(page);
  const look = await page.evaluate(async () => {
    await document.fonts.ready;
    const caption = [...document.querySelectorAll('div,span')].find((n) => n.textContent === 'Aunt Libby taught the kids to make pancakes' && n.offsetParent);
    const heading = document.querySelector('[role="heading"]');
    return {
      heading: heading ? getComputedStyle(heading).fontFamily : 'no heading',
      body: caption ? getComputedStyle(caption).fontFamily : 'no caption',
      loaded: ['AtkinsonHyperlegibleNext_400Regular', 'AtkinsonHyperlegibleNext_600SemiBold']
        .map((f) => [...document.fonts].some((ff) => ff.family.replace(/["']/g, '') === f && ff.status === 'loaded')),
    };
  });
  expect(look.heading).toMatch(/^"?AtkinsonHyperlegibleNext_600SemiBold/);
  expect(look.body).toMatch(/^"?AtkinsonHyperlegibleNext_400Regular/);
  expect(look.loaded).toEqual([true, true]);
  expect(errors).toEqual([]);
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

// DEMO-BAR-LAPTOP-1 (Chase, Nov 19): on a laptop the story panel already says "demo", so the bar is gone and
// Grandma Jo's view and Reset sit in the panel under Try this. The phone keeps the slim bar.
test('DEMO-BAR-LAPTOP-1 at 1280 px: no demo bar; Grandma Jo and Reset work from the story panel', async ({ page }) => {
  const mine = []; // its own list: the shared one already holds HARD-7's deliberate storage errors
  page.on('pageerror', (e) => mine.push(String(e)));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await galleryLoaded(page);
  await expect(page.getByRole('region', { name: 'Demo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Demo details' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /, Graham$/ })).toBeVisible();
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await expect(page.getByRole('heading', { name: /, Grandma Jo$/ })).toBeVisible();
  await page.getByRole('button', { name: "Back to Graham's view, the parent" }).click();
  await expect(page.getByRole('heading', { name: /, Graham$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await galleryLoaded(page);
  await expect(page.getByText('Sample data restored.')).toBeVisible();
  expect(mine).toEqual([]);
});

// DEMO-BAR (intake #82, pm-tools docs/DEMO-BANNER.md "Done when"). Phone only since DEMO-BAR-LAPTOP-1.
for (const width of [390]) {
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
// qa-tdd. Paper is the default page (rgb(247, 247, 244) light, rgb(19, 18, 16) dark; never white or tan); as Chase,
// More → Theme → Avocado and Pomegranate recolor the page and the pick survives a reload; Grandma Jo stays Paper with
// no Theme row; the tab bar is c.surface with a c.line top border (RD-104). Photo shadows stay for now (Chase
// deciding), so no shadow check here (RD-92 keeps it). Screenshots of all three themes, light and dark.
// qa-tdd, Nov 23 (FRUIT-11, SPEC-REDESIGN 1l, DEC-80): now walks Paper plus all nine fruits; each fruit's page is the
// JSON's `page` as rgb() (fixture copy of palettes-v2.json); Pomegranate light is rgb(251, 245, 233), replacing
// RD-117's rgb(245, 234, 223). The last pick (Red cabbage) must survive the reload. Screenshots of all 10, light and dark.
test('RD-102 RD-117 FRUIT-11 Paper by default; Chase picks each of the nine fruits, the last survives a reload; Grandma Jo stays Paper', async ({ page }) => {
  const FRUIT = require('../src/ui/__tests__/fixtures/fruit-palettes.json');
  const toRgb = (h) => `rgb(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ')})`;
  const PAGE = {
    paper: { light: 'rgb(247, 247, 244)', dark: 'rgb(19, 18, 16)' },
    ...Object.fromEntries(Object.entries(FRUIT).map(([k, v]) => [k, { light: toRgb(v.light.page), dark: toRgb(v.dark.page) }])),
  };
  expect({ avocado: PAGE.avocado, pomegranateLight: PAGE.pomegranate.light }).toEqual({ avocado: { light: 'rgb(246, 245, 228)', dark: 'rgb(42, 36, 38)' }, pomegranateLight: 'rgb(251, 245, 233)' });
  const WORD = { paper: 'Paper (standard)', ...Object.fromEntries(Object.entries(FRUIT).map(([k, v]) => [k, v.name])) };
  const FRUITS = Object.keys(FRUIT);
  const LAST = FRUITS[FRUITS.length - 1];
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
  // T-FRUIT (qa-tdd, Nov 23): with 10 rows, scrolling a fruit into view shrinks the glass bar (RD-110); a tap on the
  // shrunk oval only brings the tabs back (RD-110-R1), so restore the bar first, as T28 does in RD-117.
  const restoreTabs = async () => {
    const shrunk = page.getByRole('tab', { name: /show all tabs/ });
    if (await shrunk.count()) await shrunk.click();
  };
  const toGallery = async () => { await restoreTabs(); await page.getByRole('tab', { name: /^Gallery/ }).click(); await galleryLoaded(page); };
  const pick = async (theme) => {
    await restoreTabs();
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
    // Light starts from a fresh demo (the default); dark follows light's last fruit, so it picks Paper back first.
    if (look === 'dark') { await pick('paper'); await toGallery(); }
    expect.soft({ look, gallery: await galleryBg() }).toEqual({ look, gallery: PAGE.paper[look] });
    const bar = await tabBar();
    expect.soft({ look, painted: bar.painted, notPage: bar.bg !== PAGE.paper[look], top: bar.top }).toEqual({ look, painted: true, notPage: true, top: '1px' });
    await page.screenshot({ path: path.join(shots, `rd-102-paper-${look}.png`) });
    for (const theme of FRUITS) {
      await pick(theme);
      await expect.poll(themeBg).toBe(PAGE[theme][look]);
      await toGallery();
      expect.soft({ look, theme, gallery: await galleryBg() }).toEqual({ look, theme, gallery: PAGE[theme][look] });
      await page.screenshot({ path: path.join(shots, `rd-102-${theme}-${look}.png`) });
    }
    // The pick survives a reload.
    await page.reload();
    await galleryLoaded(page);
    expect.soft({ look, afterReload: await galleryBg() }).toEqual({ look, afterReload: PAGE[LAST][look] });
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

// RD-18..RD-21 (SPEC-REDESIGN 1c) on the demo build at a 360 px phone: the parent's last visit was 3 days ago and Eliza
// sent one post since, 3 photos (DEMO-PHOTO-12, Nov 24). Gallery: New for you with a sideways row, "3 new" on the first photo,
// the sender line and See all (no "Tap a photo to start", DEC-61); under it the grid by month. Any photo opens the walk at
// the oldest new post; Done comes back to Gallery. No All photos button, no group name.
test('RD-18 RD-19 RD-20 RD-21 New for you and the grid at 360 px; a tap walks the new photos and Done comes back', async ({ page }) => {
  const before = errors.length;
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await galleryLoaded(page);
  await expect(page.getByRole('heading', { name: 'New for you' })).toBeVisible();
  await expect(page.getByText('3 new', { exact: true })).toBeVisible();
  await expect(page.getByText('Tap a photo to start', { exact: true })).toHaveCount(0); // DEC-61
  await expect(page.getByText(/^From Eliza (today|since \S+)$/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^See all(?! the photos)/ })).toBeVisible();
  await expect(page.getByText(/^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Open photo from / }).first()).toBeAttached();
  await expect(page.getByRole('button', { name: /All photos|three to a row|See the new photos/ })).toHaveCount(0);
  await expect(page.getByText(/^Sent by /)).toHaveCount(0);
  await expect(page.getByText(/Grandparents –|Dad's side|Mom's side/)).toHaveCount(0); // RD-23
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); // the row scrolls inside itself
  await page.getByText('3 new', { exact: true }).click(); // the first tile
  await expect(page.getByText('New photos: 1 of 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Done/ }).first().click();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
  expect(errors.slice(before)).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------
// Review round 1 (ux-reviewer on Chase's iPhone, Nov 17; SPEC-REDESIGN RD-35..). Written first (red).

// UX-R12 (Nov 17) made the demo parent Chase; DEMO-PHOTO-10 (DEC-82, Nov 24) makes it Graham, since the stock photos
// show a model. Written first (qa-tdd): "Chase" appears nowhere on Gallery, Feed, More, Birthdays or the demo bar.
const saysChase = (page) => page.evaluate(() => {
  const words = [document.body.innerText, ...[...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label'))];
  return words.filter((w) => /Chase/.test(w || '')).map((w) => w.slice(0, 80));
});
test('DEMO-NAMES-5 UX-R12 DEMO-PHOTO-10 the demo greets the parent as Graham; "Chase" and "Kai" appear nowhere', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening), Graham$/ })).toBeVisible();
  await galleryLoaded(page);
  expect(await saysChase(page)).toEqual([]);
  await details(page);
  await expect(page.getByText("You're Graham, a parent.")).toBeVisible();
  expect(await saysChase(page)).toEqual([]);
  expect(await page.evaluate(() => /\bKai\b/.test(document.body.innerText))).toBe(false);
  await onFeed(page);
  expect(await saysChase(page)).toEqual([]);
  await page.getByRole('tab', { name: /^More/ }).click();
  await page.getByRole('button', { name: 'Birthdays', exact: true }).filter({ visible: true }).click({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Birthdays and dates' })).toBeVisible();
  await expect(page.getByText(/Graham and Eliza[’']s anniversary/).filter({ visible: true }).first()).toBeVisible();
  expect(await saysChase(page)).toEqual([]);
});

// DEMO-PHOTO-12 (DEC-82). Written first (Nov 24, qa-tdd): a fresh visit (last visit 3 days ago, DEMO-NEW-1) opens
// New for you on Eliza's balance bike post, its 3 photos first.
test("DEMO-NAMES-5 DEMO-PHOTO-12 a fresh visit's New for you shows Eliza's balance bike post first, with its 3 photos", async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await expect(page.getByRole('heading', { name: 'New for you' })).toBeVisible();
  const tiles = page.locator('[data-testid^="new-tile-"]');
  await expect.poll(() => tiles.count()).toBe(3);
  await expect(tiles.first()).toHaveAttribute('aria-label', /^3 new\. New photo from Eliza, /);
  for (const label of await tiles.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))) expect(label).toMatch(/New photo from Eliza, /);
  await tiles.first().click();
  await expect(page.getByText('New photos: 1 of 1', { exact: true })).toBeVisible();
  await expect(page.getByText(/First ride on the balance bike/).filter({ visible: true }).first()).toBeVisible();
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
      // RD-109: y is measured from the grid's top, not the viewport, so rows don't depend on where the scroll stopped.
      boxes.push(await tiles.nth(i).evaluate((el) => {
        const r = el.getBoundingClientRect();
        const g = (el.closest('[data-testid="gallery-grid"]') || document.body).getBoundingClientRect();
        return { x: r.x, y: r.y - g.y, width: r.width, height: r.height };
      }));
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
    // UX-R13: one wide photo per month, not per day; RD-73: a month of exactly 2 photos is two squares, no wide one.
    // (Fixed Nov 20: the sample photos' dates move with today, so some days a month holds exactly 2.)
    const months = await page.getByText(MONTH).count();
    const twoPhotoMonths = await page.getByTestId('gallery-grid').evaluate((g) =>
      [...g.children].filter((m) => m.querySelectorAll('[data-testid^="gallery-tile-"]').length === 2).length);
    expect({ wides, months }).toEqual({ wides: months - twoPhotoMonths, months });
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
test('DEMO-NAMES-5 UX-R1 focusing the walk\'s comment field hides the tab bar and keeps the field uncovered when the keyboard opens', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  // DEMO-PHOTO-12: the newest post is Eliza's balance bike post, 3 photos; the walk counts posts (1 of 1).
  await page.getByText('3 new', { exact: true }).click();
  await expect(page.getByText('New photos: 1 of 1', { exact: true })).toBeVisible();
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
    localStorage.setItem(k, localStorage.getItem(k).replaceAll('"Graham"', '"Kai"'));
    localStorage.removeItem('hearth.demoSeed');
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening), Graham$/ })).toBeVisible();
  await expect(page.getByText(/\bKai\b/)).toHaveCount(0);
});

// DEMO-PHOTO-13 (DEC-82). Written first (Nov 24, qa-tdd): a browser that saved the Nov 16 family (parent "Chase",
// seed version u4ie58, its photo bytes in IndexedDB) gets the new family and its 19 photos with no Start over.
test('DEMO-NAMES-5 DEMO-PHOTO-13 a browser that saved the Nov 16 demo family gets the new 19 photos and Graham, without Start over', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await page.evaluate(() => {
    const k = 'hearth.fakeBackend.v1';
    localStorage.setItem(k, localStorage.getItem(k).replaceAll('"Graham"', '"Chase"'));
    localStorage.setItem('hearth.demoSeed', 'u4ie58'); // demoSeedVersion() on main before DEMO-PHOTO
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening), Graham$/ })).toBeVisible();
  await galleryLoaded(page);
  await expect.poll(() => galleryTiles(page).count()).toBe(19);
  expect(await page.evaluate(() => localStorage.getItem('hearth.demoSeed'))).not.toBe('u4ie58');
  await expect(page.getByText('Sample data restored.')).toHaveCount(0); // no Start over happened
});

// ---------------------------------------------------------------------------------------------------------------
// Review round 2 (ux-reviewer, Nov 17; SPEC-REDESIGN RD-56..). Written first (red).

// R18 (P2): scrolling Gallery, the current month's title sticks right under the pinned "Search photos" field.
test('R18 the current month title sticks under the pinned search field while Gallery scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await galleryLoaded(page);
  await page.mouse.move(195, 600);
  // Land 200 px inside the second month's section (not on a month boundary, which depends on the photo set):
  // how far its title starts below the search field, plus 200.
  const fieldAt = await page.getByLabel('Search photos').first().boundingBox();
  const tops = await page.getByText(MONTH).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  expect(tops.length).toBeGreaterThanOrEqual(2);
  await page.mouse.wheel(0, Math.round(tops[1] - (fieldAt.y + fieldAt.height)) + 200);
  await settleMonths(page);
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
  await settleMonths(page);
  // engineer, flagged for qa-tdd: back up 250, not 500. The demo's Gallery scrolls about 990 px in all, so 500 landed
  // 17 px above where the first month reaches the bar (its title then scrolls with the page, as RD-83's jest allows),
  // which measured that release point, not a pinned title. `reached` below proves the title is pinned here.
  await page.mouse.wheel(0, -250);
  await settleMonths(page);
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
    got[tab] = await settle(page, h1s);
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
const captionSize = (page) => page.getByText('Aunt Libby taught the kids to make pancakes', { exact: true }).filter({ visible: true }).first()
  .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
const asJo = async (page) => {
  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await details(page);
  await expect(page.getByText(/You're Grandma Jo/)).toBeVisible();
};
const asChase = async (page) => {
  await details(page);
  await page.getByRole('button', { name: "Back to Graham's view, the parent" }).click();
  await details(page);
  await expect(page.getByText(/You're Graham, a parent/)).toBeVisible();
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
// (retargeted Nov 18 by qa-tdd for DEC-68: the page is Paper #F7F7F4 / #131210, not tan; shadows and pop unchanged)
// with its reduced-motion fallback, in the public demo at 393 px. Written first (red), Nov 18, by qa-tdd.
// Soft expects, so one run shows every part of RD-92 that is still missing.
test('RD-92 RD-94 Paper, photo shadows and the reaction pop in the demo, light and dark, with reduced motion', async ({ page }) => {
  const PAPER = 'rgb(247, 247, 244)';
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
      await settle(page, () => love().boundingBox());
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

// RD-117 (SPEC-REDESIGN 1k, Chase Nov 20, DEC-76): Avocado is a Hass avocado (page rgb(246, 245, 228) light,
// rgb(42, 36, 38) dark) and a picked reaction is a 2 px accent outline with the count in the accent, no fill; an
// unpicked one has a 1 px border; tapping never moves the heart's box or its neighbour (RD-116). Written first (red),
// Nov 20, by qa-tdd. Soft expects so one run shows every miss. Screenshots: Avocado light and dark, and a picked
// reaction in all three themes.
test('RD-117 RD-116 Avocado (Hass) light and dark; a picked ❤️ is a 2 px accent outline with an accent count, no fill, in every theme', async ({ page }) => {
  const PAGE = {
    paper: { light: 'rgb(247, 247, 244)' },
    avocado: { light: 'rgb(246, 245, 228)', dark: 'rgb(42, 36, 38)' },
    pomegranate: { light: 'rgb(251, 245, 233)' }, // qa-tdd, Nov 23: FRUIT-11 (DEC-80) replaces rgb(245, 234, 223)
  };
  // Accent per theme, light (RD-94, RD-111, FRUIT-2); Avocado dark is Fresh leaf #7ED69B (RD-112).
  // qa-tdd, Nov 23: Pomegranate's accent is the JSON's #B3122F (DEC-80), replacing RD-95's rgb(163, 23, 47).
  const ACCENT = { paper: 'rgb(173, 55, 29)', avocado: 'rgb(47, 84, 25)', pomegranate: 'rgb(179, 18, 47)', avocadoDark: 'rgb(126, 214, 155)' };
  const WORD = { paper: 'Paper (standard)', avocado: 'Avocado', pomegranate: 'Pomegranate' };
  const shots = path.join(__dirname, '..', 'test-results', 'rd-117');
  const pick = async (theme) => {
    // T28: tapping the heart can scroll Feed and shrink the glass bar (RD-110); a tap on the shrunk oval
    // only brings the tabs back (RD-110-R1), so restore it first.
    const shrunk = page.getByRole('tab', { name: /show all tabs/ });
    if (await shrunk.count()) await shrunk.click();
    await page.getByRole('tab', { name: /^More/ }).click();
    await page.getByRole('button', { name: /^Theme(,|$)/ }).click();
    await page.getByRole('radio', { name: `${WORD[theme]} theme` }).click();
    await expect(page.getByRole('radio', { name: `${WORD[theme]} theme` })).toBeChecked();
  };
  const themeBg = () => page.getByRole('heading', { name: 'Theme' }).evaluate((el) => {
    const opaque = (c) => c && c !== 'transparent' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c);
    let n = el;
    while (n && !opaque(getComputedStyle(n).backgroundColor)) n = n.parentElement;
    return n ? getComputedStyle(n).backgroundColor : 'rgb(255, 255, 255)';
  });
  const love = () => page.getByRole('button', { name: 'Love it' }).filter({ visible: true }).first();
  // RN-web renders no aria-selected / aria-pressed on the reaction (QA-R1), so "picked" is read from the count:
  // tapping on raises it by one. turnOn() leaves the heart picked whatever the demo started with.
  const countOf = async () => Number((await love().innerText()).replace(/\D/g, '') || 0);
  const turnOn = async () => {
    const before = await countOf();
    await love().click();
    await expect.poll(countOf).not.toBe(before);
    if ((await countOf()) < before) { await settle(page, () => love().boundingBox()); await love().click(); await expect.poll(countOf).toBe(before); }
  };
  const turnOff = async () => { await turnOn(); const n = await countOf(); await settle(page, () => love().boundingBox()); await love().click(); await expect.poll(countOf).toBe(n - 1); };
  const look = () => love().evaluate((btn) => {
    const s = getComputedStyle(btn);
    const count = [...btn.querySelectorAll('*')].find((n) => n.children.length === 0 && /^\d+$/.test((n.textContent || '').trim()));
    const r = btn.getBoundingClientRect();
    const haha = btn.parentElement.querySelector('[aria-label="Haha"]');
    return {
      bg: s.backgroundColor,
      widths: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth],
      color: s.borderTopColor,
      count: count ? getComputedStyle(count).color : 'no count',
      box: { x: r.x, y: r.y, w: r.width, h: r.height },
      haha: haha ? haha.getBoundingClientRect().x : null,
    };
  });
  const clear = (c) => c === 'transparent' || c === 'rgba(0, 0, 0, 0)';
  const near = (a, b) => Math.abs(a - b) <= 0.5;

  await page.setViewportSize({ width: 393, height: 852 });
  for (const mode of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
    await page.goto('/');
    await resetDemo(page);
    await page.reload();
    await galleryLoaded(page);
    await pick('avocado');
    await settle(page, themeBg); // soft, so one red run also shows the reaction checks below
    expect.soft({ mode, page: await themeBg() }).toEqual({ mode, page: PAGE.avocado[mode] });
    await page.screenshot({ path: path.join(shots, `rd-117-avocado-${mode}.png`) });
    if (mode === 'dark') {
      await onFeed(page);
      await turnOn();
      const on = await look();
      expect.soft({ mode, clear: clear(on.bg), widths: on.widths, color: on.color, count: on.count })
        .toEqual({ mode, clear: true, widths: ['2px', '2px', '2px', '2px'], color: ACCENT.avocadoDark, count: ACCENT.avocadoDark });
    }
  }

  // Light: a picked heart in every theme; Paper and Pomegranate pages unchanged.
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  for (const theme of ['paper', 'avocado', 'pomegranate']) {
    await pick(theme);
    await settle(page, themeBg);
    expect.soft({ theme, page: await themeBg() }).toEqual({ theme, page: PAGE[theme].light });
    await onFeed(page);
    await turnOff();
    await settle(page, look);
    const off = await look();
    expect.soft({ theme, offClear: clear(off.bg), offWidths: off.widths }).toEqual({ theme, offClear: true, offWidths: ['1px', '1px', '1px', '1px'] });
    await love().click();
    await settle(page, look);
    const on = await look();
    expect.soft({ theme, clear: clear(on.bg), bg: clear(on.bg) ? 'clear' : on.bg, widths: on.widths, color: on.color, count: on.count })
      .toEqual({ theme, clear: true, bg: 'clear', widths: ['2px', '2px', '2px', '2px'], color: ACCENT[theme], count: ACCENT[theme] });
    // RD-116: the heart's outer box and its neighbour stay put (±0.5 px).
    expect.soft({ theme, same: near(on.box.x, off.box.x) && near(on.box.y, off.box.y) && near(on.box.w, off.box.w) && near(on.box.h, off.box.h), haha: off.haha !== null && near(on.haha, off.haha) })
      .toEqual({ theme, same: true, haha: true });
    await love().screenshot({ path: path.join(shots, `rd-117-picked-${theme}-light.png`) });
  }
});

// RD-108 / RD-109 (Chase, Nov 19, DEC-72): with Easy view Off (Chase) the web shows a lookalike of iOS 26's floating
// glass tab bar, and the bottom of Gallery scrolls clear of it; Grandma Jo (Easy view On) keeps the fixed bar.
test('RD-108 RD-109 Chase gets the floating glass tab bar and Gallery clears it; Grandma Jo keeps the fixed bar', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await resetDemo(page);
  await page.reload();
  await galleryLoaded(page);
  const bar = () => page.getByRole('tablist').evaluate((el) => {
    const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    return { position: s.position, radius: parseFloat(s.borderTopLeftRadius), blur: /blur\(/.test(s.backdropFilter || s.webkitBackdropFilter || ''), left: r.left, top: r.top, width: r.width };
  });
  const chase = await bar();
  expect({ position: chase.position, round: chase.radius >= 28, blur: chase.blur, inset: Math.round(chase.left) }).toEqual({ position: 'absolute', round: true, blur: true, inset: 16 });
  // RD-109: at the very bottom of Gallery, the last photo ends above the bar.
  const lastBottom = await page.evaluate(async () => {
    const scrollers = [...document.querySelectorAll('div')].filter((d) => d.scrollHeight > d.clientHeight + 10 && /(auto|scroll)/.test(getComputedStyle(d).overflowY));
    for (const s of scrollers) s.scrollTop = s.scrollHeight;
    await new Promise((r) => setTimeout(r, 400));
    const imgs = [...document.querySelectorAll('[data-testid="gallery-grid"] img, [data-testid="gallery-grid"] [role="img"], [data-testid="gallery-grid"] [role="button"]')];
    return Math.max(...imgs.map((i) => i.getBoundingClientRect().bottom));
  });
  expect(lastBottom).toBeLessThanOrEqual(chase.top + 1);
  await page.screenshot({ path: path.join(__dirname, '..', 'test-results', 'rd-108', 'chase-glass-bar.png') });

  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await details(page);
  await page.getByRole('tab', { name: /^Gallery/ }).click();
  await galleryLoaded(page);
  const jo = await bar();
  expect({ position: jo.position, blur: jo.blur, fullWidth: Math.round(jo.width) }).toEqual({ position: 'relative', blur: false, fullWidth: 393 });
  await page.screenshot({ path: path.join(__dirname, '..', 'test-results', 'rd-108', 'jo-fixed-bar.png') });
});

// DEMO-EASY-1 (Chase, Nov 19): "its a poor experience that clicking grandma jo makes the screen much larger".
// On a laptop, switching to Grandma Jo (Easy view On) enlarges the app in the phone column only, not the panel.
test('DEMO-EASY-1 on a laptop, Grandma Jo\'s Easy view leaves the story panel the same size', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/');
  await galleryLoaded(page);
  const panel = () => page.getByRole('heading', { name: 'A private photo app for split families' }).evaluate((el) => {
    const r = el.closest('[data-testid="demo-frame"]').firstElementChild.getBoundingClientRect();
    return { font: getComputedStyle(el).fontSize, width: Math.round(r.width) };
  });
  const before = await panel();
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await expect(page.getByText(/You're Grandma Jo/)).toBeVisible();
  expect(await panel()).toEqual(before);
});
// SHARE-PC-13 (SPEC-REDESIGN 1j, DEC-73, Chase Nov 19): the postcard Share in the public demo at 393 px. Written first
// (red), Nov 19, by qa-tdd. Soft expects after the page opens, so one run shows every part still missing.
test('SHARE-PC-13 (DEC-91) postcard Share: 3 photos, step 1, Next, nothing picked, two groups, "Send to ...", sent page, See it in Feed; Jo sees names only', async ({ page }) => {
  const shots = path.join(__dirname, '..', 'test-results', 'share-pc-13');
  await page.setViewportSize({ width: 393, height: 852 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await galleryLoaded(page);
  await openNewPost(page, [FIXTURE, FIXTURE, FIXTURE]);
  await expect(page.getByText('1 of 3', { exact: true })).toBeVisible();
  const tiles = page.getByLabel(/, \d+ people, (not )?picked$/).filter({ visible: true });
  expect.soft(await page.getByLabel(/, \d+ people, picked$/).count()).toBe(0);
  // DEC-91: step 1 has no tiles; "Next: who gets it" opens step 2, where nothing is picked and Send is off.
  expect.soft(await tiles.count(), 'no group tile on step 1').toBe(0);
  await expect.soft(page.getByText('Step 1 of 2')).toBeVisible();
  await page.getByRole('button', { name: 'Next: who gets it' }).click();
  await expect(page.getByRole('heading', { name: 'Who gets it?' })).toBeVisible();
  expect.soft(await tiles.count()).toBeGreaterThan(1);
  const off = page.getByRole('button', { name: /^Send/ });
  await expect.soft(off, 'Send is off with nothing picked').toBeDisabled();
  expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(shots, 'share-pc-13-light.png') });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: path.join(shots, 'share-pc-13-dark.png') });
  await page.emulateMedia({ colorScheme: 'light' });

  await page.getByLabel(/^Grandparents – Dad's side, \d+ people, not picked$/).click();
  await page.getByLabel(/^Grandparents – Mom's side, \d+ people, not picked$/).click();
  const send = page.getByRole('button', { name: /^Send to .+/ });
  await expect(send).toBeEnabled();
  const names = String(await send.getAttribute('aria-label') ?? await send.innerText()).replace(/^Send to /, '');
  await send.click();
  await expect(page.getByRole('heading', { name: 'Sent' })).toBeVisible(); // DEC-91: the sent page, no banner
  await expect(page.getByText(/^Shared with /)).toHaveCount(0);
  await page.getByRole('button', { name: 'See it in Feed' }).click();
  // T39 (QA-R13): wait for the new post itself, then check it is on top. Every demo seed post is 3+ hours old, so
  // the new one is the only post that reads "Just now". "The first visible post" alone could be an older one
  // under load. Sending runs in the browser (resize, strip, encrypt 3 photos); under full-suite load it was still
  // "Sending 1 of 3…" after 15 s (Nov 24), so the wait for the post allows 60 s. The test's own limit is 90 s.
  const posts = page.locator('[data-testid^="post-"]').filter({ visible: true });
  const newPost = posts.filter({ has: page.getByText('Just now', { exact: true }) });
  await expect(newPost, 'the new post shows on Feed').toHaveCount(1, { timeout: 60_000 });
  expect.soft(await posts.first().getAttribute('data-testid'), 'the new post is on top of Feed').toBe(await newPost.getAttribute('data-testid'));
  await expect.soft(newPost.getByRole('button', { name: /^Open photo 1 of 3/ }), 'the new post holds the 3 photos').toBeVisible();

  // Grandma Jo (Easy view on for her): her Share, if she can post, names people only; never a group's title.
  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await details(page);
  const joShare = page.getByRole('tab', { name: /^Share/ });
  if (await joShare.count()) {
    await openNewPost(page, [FIXTURE]);
    await page.getByRole('button', { name: 'Next: who gets it' }).click();
    const labels = await page.getByLabel(/, \d+ people, (not )?picked$/).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect.soft(labels.filter((l) => /Grandparents|Dad's side|Mom's side|^Everyone/.test(l))).toEqual([]);
  }
  await page.screenshot({ path: path.join(shots, 'share-pc-13-easy-view.png') });
});

// GUX-R1 (grandparent-ux, Nov 19): a face tile's name never spills out of its tile. "Grandparents" is about 113 px
// and a 3-across tile 103 px at 360 (112 px at 390), so those phones show 2 across; names are never shortened.
// Written first (red), Nov 19, by qa-tdd. The column rule's other cases are in src/screens/__tests__/shareGux.test.tsx.
for (const width of [360, 390]) {
  test(`GUX-R1 ${width} px: every face-tile name stays inside its own tile; 2 across; full names`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await galleryLoaded(page);
    await openNewPost(page, [FIXTURE]);
    await page.getByRole('button', { name: 'Next: who gets it' }).click(); // DEC-91: the tiles are on step 2
    const tiles = page.getByLabel(/, \d+ people, (not )?picked$/).filter({ visible: true });
    await expect(tiles.first()).toBeVisible();
    const found = await tiles.evaluateAll((els) => els.map((el) => {
      const name = String(el.getAttribute('aria-label')).replace(/, \d+ people, (not )?picked$/, '');
      const box = el.getBoundingClientRect();
      // The words of the name: the text node(s) whose text is the name, measured where they are drawn.
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let left = Infinity; let right = -Infinity; let shown = '';
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.textContent.trim() !== name) continue;
        shown += n.textContent;
        const r = document.createRange(); r.selectNodeContents(n);
        for (const q of r.getClientRects()) { left = Math.min(left, q.left); right = Math.max(right, q.right); }
      }
      return { name, shown: shown.trim(), top: Math.round(box.top), spill: Math.max(0, Math.round(box.left - left), Math.round(right - box.right)) };
    }));
    const spills = found.filter((f) => f.spill > 0).map((f) => `${f.name}: ${f.spill}px out`);
    expect.soft(spills).toEqual([]);
    expect.soft(found.filter((f) => f.shown !== f.name).map((f) => f.name)).toEqual([]);
    const firstRow = found.filter((f) => f.top === found[0].top).length;
    expect.soft(firstRow).toBe(2);
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(__dirname, '..', 'test-results', 'gux-r1', `gux-r1-${width}.png`) });
  });
}

// RD-110 (Chase, Nov 19, DEC-75): "the full iOS glass oval interaction on scroll". Scrolling down shrinks the floating
// bar to a small oval with only the picked tab; scrolling up or tapping the oval brings the whole bar back. Grandma
// Jo's fixed bar (Easy view On) never shrinks. Review of PR 138 (Nov 19): RD-110-R2 only the app's own up-and-down
// scrolling counts, RD-110-R3 changing tabs brings the bar back, RD-110-R6 no fixed pixel widths or timed waits.
const bar = (page) => page.getByRole('tablist');
const barWidth = (page) => bar(page).evaluate((el) => el.getBoundingClientRect().width);
const fullWidth = (page) => bar(page).evaluate((el) => el.parentElement.getBoundingClientRect().width - 32);
// The phone column's middle (above the bar), where a finger or a mouse wheel would scroll the page.
const appMiddle = (page) => bar(page).evaluate((el) => {
  const r = el.parentElement.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 3 };
});
// How far the scrolling area under a point has scrolled; the area is found the way the browser finds it.
const scrolledAt = (page, pt) => page.evaluate(({ x, y }) => {
  let n = document.elementFromPoint(x, y);
  while (n && !(n.scrollHeight > n.clientHeight && /(auto|scroll)/.test(getComputedStyle(n).overflowY))) n = n.parentElement;
  return n ? n.scrollTop : -1;
}, pt);
const wheel = async (page, pt, dy) => {
  await page.mouse.move(pt.x, pt.y);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, dy / 6);
};
const settled = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const isShrunk = async (page) => (await page.getByRole('tab').count()) === 1;

test('RD-110 the glass bar shrinks on scroll down and comes back on scroll up or a tap; Grandma Jo\'s bar never shrinks', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto('/');
  await galleryLoaded(page);
  const full = await fullWidth(page);
  expect(await barWidth(page)).toBeCloseTo(full, 0);
  const mid = await appMiddle(page);
  await wheel(page, mid, 600);
  await expect.poll(() => barWidth(page)).toBeLessThanOrEqual(66);
  await expect(page.getByRole('tab')).toHaveCount(1);
  await expect(page.getByRole('tab', { name: 'Gallery, show all tabs' })).toBeVisible();
  await page.screenshot({ path: path.join(__dirname, '..', 'test-results', 'rd-110', 'shrunk.png') });
  await wheel(page, mid, -200);
  await expect.poll(() => barWidth(page)).toBeCloseTo(full, 0);
  await expect(page.getByRole('tab')).toHaveCount(4);

  // Tapping the shrunk oval brings the bar back and stays on Gallery where it was.
  await wheel(page, mid, 600);
  await expect.poll(() => barWidth(page)).toBeLessThanOrEqual(66);
  const at = await scrolledAt(page, mid);
  await page.getByRole('tab', { name: /show all tabs/ }).click();
  await expect.poll(() => barWidth(page)).toBeCloseTo(full, 0);
  await expect(page.getByRole('tab', { name: /^Gallery/ })).toHaveAttribute('aria-selected', 'true');
  expect(await scrolledAt(page, mid)).toBe(at);

  // Grandma Jo (Easy view On): the fixed bar never shrinks, even after the page has really scrolled.
  await details(page);
  await page.getByRole('button', { name: 'See the photos as Grandma Jo sees them' }).click();
  await details(page);
  await page.getByRole('tab', { name: /^Gallery/ }).click();
  await galleryLoaded(page);
  const jo = await appMiddle(page);
  const before = await scrolledAt(page, jo);
  await wheel(page, jo, 600);
  await expect.poll(() => scrolledAt(page, jo)).toBeGreaterThan(before + 100);
  await settled(page);
  expect(await isShrunk(page)).toBe(false);
  expect(await barWidth(page)).toBeCloseTo(await bar(page).evaluate((el) => el.parentElement.getBoundingClientRect().width), 0);
});

test('RD-110-R2 scrolling the laptop\'s story panel never shrinks the bar, and a sideways strip never brings it back', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.goto('/');
  await galleryLoaded(page);
  const panel = page.getByRole('heading', { name: 'A private photo app for split families' });
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  const pt = { x: box.x + 20, y: box.y + 20 };
  await wheel(page, pt, 400);
  await expect.poll(() => scrolledAt(page, pt)).toBeGreaterThan(0); // the panel really scrolled
  await settled(page);
  expect(await isShrunk(page)).toBe(false);

  // Shrink it with the app's own scrolling, then move a sideways strip in the app: still shrunk.
  const mid = await appMiddle(page);
  await wheel(page, mid, 600);
  await expect(page.getByRole('tab')).toHaveCount(1);
  const moved = await bar(page).evaluate((el) => {
    const strip = [...el.parentElement.querySelectorAll('div')].find((d) => d.scrollWidth > d.clientWidth + 20 && /(auto|scroll)/.test(getComputedStyle(d).overflowX));
    if (!strip) return false;
    strip.scrollLeft += 120;
    return true;
  });
  expect(moved).toBe(true);
  await settled(page);
  await settled(page);
  expect(await isShrunk(page)).toBe(true);
});

test('RD-110-R3 the bar shrunk on Share comes back whole on Feed after sending', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 600 });
  await page.goto('/');
  await galleryLoaded(page);
  await openNewPost(page, [FIXTURE]);
  await page.getByRole('button', { name: 'Next: who gets it' }).click(); // DEC-91: the tiles are on step 2
  await wheel(page, await appMiddle(page), 800);
  await expect(page.getByRole('tab')).toHaveCount(1);
  await page.getByLabel(/^Grandparents – Dad's side, \d+ people, not picked$/).click();
  await page.getByRole('button', { name: /^Send to / }).click();
  await page.getByRole('button', { name: 'See it in Feed' }).click(); // DEC-91: the sent page comes first
  await expect(page.getByRole('tab', { name: /^Feed/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(4);
  await resetDemo(page);
});

// SHARE-ST-8 / SHARE-ST-27 (SPEC-REDESIGN 1j-2, DEC-79; round 3 "Quiet postcard", wordless, Chase Nov 24): Share opens
// on an empty postcard in the public demo at 393 px. Reference: option A of
// /mnt/project-files/design/share-start-2026-11-20/share-start-quiet-tester.html. Retargeted and written first (red),
// Nov 24, by qa-tdd: SHARE-ST-27 wins over SHARE-ST-8's "Up to 100", faded To: and SHARE-ST-10/14/15's words.
// Contract (same as the jest file): the whole card (data-testid "share-card") is one button "Add photos, up to N at a
// time"; data-testid "share-spot", "share-stamp", "share-note-rule" x2, "share-to-rule"; the only words in the card
// are "Add photos", "To:" and the stamp's month and day. Soft expects, so one run shows every part still missing.
// QA-R (staff-pm): the demo's Grandma Jo is a viewer with no Share tab (RD-9), so her "up to 10" can't be reached here;
// it runs only if the demo ever lets her post, and the jest SHARE-ST-21 cases cover it meanwhile.
test('SHARE-ST-8 SHARE-ST-27 (DEC-91) wordless Share start: only "New post", "Add photos" and the stamp (no To:, no ruled lines); one card button; a tap on the card with 3 photos shows "1 of 3"', async ({ page }) => {
  const shots = path.join(__dirname, '..', 'test-results', 'share-st-27');
  await page.setViewportSize({ width: 393, height: 852 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await galleryLoaded(page);
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const startPage = async (limit, shot) => {
    await page.getByRole('tab', { name: /^Share/ }).click();
    await expect(page.getByRole('heading', { name: 'New post' })).toBeVisible();
    const add = page.getByRole('button', { name: `Add photos, up to ${limit} at a time` }).filter({ visible: true });
    await expect.soft(add).toHaveCount(1);
    const card = page.getByTestId('share-card').filter({ visible: true }).first();
    await expect.soft(card).toBeVisible();
    // The card is the one button (or sits inside it): the button holds the card.
    if (await add.count()) {
      const holds = await add.first().evaluate((b) => b.getAttribute('data-testid') === 'share-card' || !!b.querySelector('[data-testid="share-card"]') || ['share-spot', 'share-note-rule', 'share-to-rule'].every((id) => !!b.querySelector(`[data-testid="${id}"]`)));
      expect.soft(holds).toBe(true);
    }
    for (const id of ['share-spot', 'share-stamp']) await expect.soft(page.getByTestId(id).filter({ visible: true })).toHaveCount(1);
    // DEC-91: no ruled lines and no "To:" on the empty card.
    for (const id of ['share-note-rule', 'share-to-rule']) await expect.soft(page.getByTestId(id)).toHaveCount(0);
    // Only these words in the card: "Add photos", "To:", the stamp's month and day.
    const now = new Date();
    const want = ['ADD', 'PHOTOS', MONTHS[now.getMonth()], String(now.getDate())].sort();
    if (await card.count()) {
      // engineer, flagged for qa-tdd: on the web expo-symbols draws the add-photo icon as a Material Symbols glyph (a
      // private-use character in an aria-hidden Text), which innerText includes; it is not a word, so it is dropped.
      // QA-R2 (qa-tdd, Nov 24): drop only private-use glyphs (U+E000-U+F8FF); any other stray token still fails.
      const got = (await card.innerText()).replace(/[\uE000-\uF8FF]/g, ' ').split(/\s+/).filter(Boolean).map((w) => w.toUpperCase()).sort();
      expect.soft(got).toEqual(want);
    }
    // None of the older start-page words anywhere on the page.
    await expect.soft(page.getByText(/Only the people you pick|For your family, nobody else|Up to \d+ at a time|To: you pick after|Add a note \(optional\)|Last shared|Add photos first|Pick lots of photos|Lots of photos\?|Share photos|Pick photos/)).toHaveCount(0);
    await expect.soft(page.getByRole('button', { name: /^(Send to |Next: who gets it$|Pick who gets it$)/ })).toHaveCount(0);
    // "Add photos" stays inside the spot; the card is at least 48 px; the page never scrolls sideways.
    const spot = page.getByTestId('share-spot').filter({ visible: true }).first();
    if (await spot.count()) {
      const spill = await spot.evaluate((el) => {
        const box = el.getBoundingClientRect(); let out = 0;
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          if (!/Add photos/.test(n.textContent)) continue;
          const r = document.createRange(); r.selectNodeContents(n);
          for (const q of r.getClientRects()) out = Math.max(out, box.left - q.left, q.right - box.right, box.top - q.top, q.bottom - box.bottom);
        }
        return Math.round(out);
      });
      expect.soft(spill).toBe(0);
    }
    if (await add.count()) expect.soft((await add.first().boundingBox()).height).toBeGreaterThanOrEqual(48);
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(shots, `${shot}.png`) });
  };

  await startPage(100, 'chase-light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await startPage(100, 'chase-dark');
  await page.emulateMedia({ colorScheme: 'light' });
  // Chase with Easy view On: spoken "up to 10" (SHARE-ST-21).
  await page.getByRole('tab', { name: /^More/ }).click();
  await page.getByRole('button', { name: 'Easy view, Off' }).click();
  await page.getByRole('radio', { name: 'On', exact: true }).click();
  await expect.poll(() => tabWordsShown(page)).toEqual(['Gallery', 'Share', 'Feed', 'More']);
  await startPage(10, 'chase-easy-view');
  // Easy view back Off for the rest.
  await page.getByRole('tab', { name: /^More/ }).click();
  await page.getByRole('button', { name: 'Easy view, On' }).click();
  await page.getByRole('radio', { name: 'Off', exact: true }).click();

  // As Chase, a tap on the card (DEC-91: no ruled lines left to tap) opens the chooser; 3 photos open the postcard at "1 of 3".
  await page.getByRole('tab', { name: /^Share/ }).click();
  const chooser = page.waitForEvent('filechooser', { timeout: 15_000 });
  await page.getByTestId('share-card').filter({ visible: true }).first().click();
  await (await chooser).setFiles([FIXTURE, FIXTURE, FIXTURE]);
  await expect(page.getByText('1 of 3', { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(shots, 'chase-1-of-3.png') });

  // Grandma Jo (Easy view on for her): "up to 10", if the demo lets her post.
  await asJo(page);
  if (await page.getByRole('tab', { name: /^Share/ }).count()) {
    await startPage(10, 'jo-easy-view');
  } else {
    test.info().annotations.push({ type: 'SHARE-ST-27', description: 'Grandma Jo has no Share tab in the demo (viewer, RD-9); her "up to 10" is not checked here.' });
  }
});

// DARK-ELEV-6 (intake #155, studio DARK-5; written first by qa-tdd, Nov 23): in dark, raised things are a lighter
// surface step, never a shadow. At a 390 px phone in dark, nothing visible on the demo's first screen draws a
// box-shadow. The DemoBar's 1 px bottom line is an inset divider, not elevation, so inset-only shadows are allowed.
// qa-tdd (Nov 23, green run): also scrolled a little so RD-82's pinned shade line (search-bar-shade) is on screen,
// with the other direction: in light that shade line keeps its drop shadow (DARK-ELEV-3 in a real browser).
const dropShadows = (page) => page.evaluate(() => [...document.querySelectorAll('body *')].flatMap((el) => {
  const s = getComputedStyle(el);
  if (s.boxShadow === 'none' || s.visibility === 'hidden' || s.display === 'none') return [];
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) return [];
  // Split on commas outside rgb()/rgba(); keep only the drop (non-inset) shadows.
  const drops = s.boxShadow.split(/,(?![^(]*\))/).filter((p) => !/\binset\b/.test(p));
  if (drops.length === 0) return [];
  const name = el.getAttribute('aria-label') || el.getAttribute('role') || el.getAttribute('data-testid') || el.tagName;
  return [`${name}: ${s.boxShadow}`];
}));
const shadeShadow = (page) => page.getByTestId('search-bar-shade').first().evaluate((el) => getComputedStyle(el).boxShadow);
test('DARK-ELEV-6 at 390 px dark: no visible element on the first screen has a drop shadow (DemoBar inset divider allowed)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await galleryLoaded(page);
  expect(await dropShadows(page)).toEqual([]);
  // Scrolled a little: the pinned shade line shows, still no drop shadow anywhere (floating tab bar included).
  await page.mouse.move(195, 600);
  await page.mouse.wheel(0, 300); // mouse.wheel fires RN-web's onScroll; scrollTo does not
  await expect(page.getByTestId('search-bar-shade').first()).toBeAttached();
  expect(await dropShadows(page)).toEqual([]);
  expect(await shadeShadow(page)).toBe('none');
  // The other direction: in light the same shade line keeps its soft drop shadow (light is unchanged).
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => shadeShadow(page)).not.toBe('none');
});

// ---------------------------------------------------------------------------------------------------------------
// SPEC-VIEWER (R113, qa-tdd Nov 24, written first, red): the full-screen viewer overhaul, look B (look A plus the
// photo strip, DEC-92). Real mouse drags, double-clicks and keys on the real Gallery (react-native-zoom-toolkit).
// Kevin (the demo parent) has Easy view Off; Grandma Jo has it On. Light and dark. Seams: data-testid
// viewer-backdrop (the black root) and viewer-strip (the small photos, each a button "Photo n of m, from <name>").
const VSTRIP = /^Photo \d+ of \d+, from .+$/;
const openPhoto = async (page, nth = 0) => {
  await galleryLoaded(page);
  await galleryTiles(page).nth(nth).click();
  await expect(page.getByTestId('viewer-backdrop')).toBeVisible();
  await expect.poll(() => visiblePhoto(page).then((p) => p && p.w)).toBeGreaterThan(0);
};
/** The photo on screen: the drawn image inside the viewer whose middle is inside the viewer (neighbours sit off to the side). */
const visiblePhoto = (page) => page.evaluate(() => {
  const root = document.querySelector('[data-testid="viewer-backdrop"]');
  if (!root) return null;
  const rr = root.getBoundingClientRect();
  const cands = [...root.querySelectorAll('img, div')].filter((e) => e.tagName === 'IMG' || /url\(/.test(getComputedStyle(e).backgroundImage))
    .filter((e) => !e.closest('[data-testid="viewer-strip"]'))
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && r.height > 0 && r.left + r.width / 2 > rr.left && r.left + r.width / 2 < rr.right);
  cands.sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
  const c = cands[0];
  if (!c) return null;
  const src = c.e.tagName === 'IMG' ? c.e.getAttribute('src') : getComputedStyle(c.e).backgroundImage;
  return { x: c.r.left - rr.left, y: c.r.top - rr.top, w: c.r.width, h: c.r.height, src: (src || '').slice(-60), vw: rr.width, vh: rr.height, top: rr.top, left: rr.left };
});
/** A slow drag that holds still before letting go (no flick), or a fast one (flick). */
const drag = async (page, from, to, { fast = false, release = true } = {}) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const steps = fast ? 3 : 15;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    if (!fast) await frames(page, 1); // one pacing step of about 30 ms, in frames
  }
  if (!fast) await frames(page, 8); // hold still before letting go (about 250 ms), so there is no flick
  if (release) await page.mouse.up();
};
const mid = async (page) => { const p = await visiblePhoto(page); return { x: p.left + p.vw / 2, y: p.top + p.vh / 2, p }; };
/** How dark the backdrop is now: 1 = solid black. */
const backdropFade = (page) => page.evaluate(() => {
  const root = document.querySelector('[data-testid="viewer-backdrop"]');
  if (!root) return null;
  const alphaOf = (e) => { const m = getComputedStyle(e).backgroundColor.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(',').map(Number); return p[0] === 0 && p[1] === 0 && p[2] === 0 ? (p.length > 3 ? p[3] : 1) : 0; };
  const opacityChain = (e) => { let o = 1; for (let n = e; n && n !== document.body; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
  const layers = [root, ...root.querySelectorAll('div')].filter((e) => alphaOf(e) > 0 && e.getBoundingClientRect().width >= root.getBoundingClientRect().width - 1);
  return Math.max(0, ...layers.map((e) => alphaOf(e) * opacityChain(e)));
});
const isBlack = (c) => /^rgba?\(0,\s*0,\s*0(,\s*1)?\)$/.test(c);
const caption = (page) => page.getByTestId('viewer-backdrop').evaluate((r) => r.innerText);

for (const look of ['light', 'dark']) {
  test(`VIEWER-1 VIEWER-2 VIEWER-8 VIEWER-9 Kevin (Easy view Off, ${look}): black, the photo fills the viewer, round Close top left and Save bottom left, no pills or counter`, async ({ page }) => {
    const before = errors.length;
    await page.emulateMedia({ colorScheme: look });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await openPhoto(page);
    const bg = await page.getByTestId('viewer-backdrop').evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(isBlack(bg)).toBe(true);
    const p = await visiblePhoto(page);
    expect(Math.abs(p.w - p.vw)).toBeLessThanOrEqual(1); // VIEWER-2: edge to edge
    expect(Math.abs(p.h - p.vh)).toBeLessThanOrEqual(1); // Off: full height too
    const view = await page.getByTestId('viewer-backdrop').boundingBox();
    const close = await page.getByRole('button', { name: 'Close', exact: true }).boundingBox();
    const save = await page.getByRole('button', { name: 'Save to my phone' }).boundingBox();
    expect(close.x + close.width / 2).toBeLessThan(view.x + view.width / 2);
    expect(close.y + close.height / 2).toBeLessThan(view.y + view.height / 4);
    expect(save.x + save.width / 2).toBeLessThan(view.x + view.width / 2);
    expect(save.y + save.height / 2).toBeGreaterThan(view.y + (view.height * 3) / 4);
    for (const b of [close, save]) expect({ w: b.width >= 48, h: b.height >= 48 }).toEqual({ w: true, h: true });
    await expect(page.getByRole('button', { name: /^(Next photo|Back to the previous photo|Zoom in|Zoom out)$/ })).toHaveCount(0);
    await expect(page.getByText(/^Photo \d+ of \d+$/)).toHaveCount(0);
    expect(errors.slice(before)).toEqual([]);
  });

  test(`VIEWER-1 VIEWER-2 VIEWER-10 Grandma Jo (Easy view On, ${look}): black, photo full width, Close pill, 48 pt Back / Save / Next, Zoom in, counter`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: look });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await galleryLoaded(page);
    await asJo(page);
    await openPhoto(page, 1);
    expect(isBlack(await page.getByTestId('viewer-backdrop').evaluate((e) => getComputedStyle(e).backgroundColor))).toBe(true);
    const p = await visiblePhoto(page);
    expect(Math.abs(p.w - p.vw)).toBeLessThanOrEqual(1);
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toHaveText(/Close/);
    for (const name of ['Save to my phone', 'Zoom in']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    for (const b of await page.getByRole('button', { name: /^(Close|Back to the previous photo|Save to my phone|Next photo|Zoom in)$/ }).all()) {
      expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(48);
    }
    await expect(page.getByText(/· Photo \d+ of \d+$/)).toBeVisible();
  });
}

test('VIEWER-3 the photo follows the finger; past a third goes next, a short slow drag springs back, a flick goes next, the first photo rubber-bands', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await asJo(page);
  await openPhoto(page, 1);
  // Back to the first photo with the pills.
  while (await page.getByRole('button', { name: 'Back to the previous photo' }).count()) await page.getByRole('button', { name: 'Back to the previous photo' }).click();
  await expect(page.getByText(/· Photo 1 of \d+$/)).toBeVisible();
  const { x, y, p } = await mid(page);
  // Rubber band at the first photo: a drag right stays on photo 1 and settles back at 0.
  await drag(page, { x, y }, { x: x + p.vw * 0.5, y });
  await expect(page.getByText(/· Photo 1 of \d+$/)).toBeVisible();
  await expect.poll(async () => Math.round((await visiblePhoto(page)).x)).toBe(0);
  // Follows the finger: mid-drag the photo has moved with it.
  await drag(page, { x: x + 100, y }, { x: x - 20, y }, { release: false });
  expect((await visiblePhoto(page)).x).toBeLessThan(-60);
  await page.mouse.up();
  // A short slow drag springs back.
  await expect.poll(async () => Math.round((await visiblePhoto(page)).x)).toBe(0);
  await expect(page.getByText(/· Photo 1 of \d+$/)).toBeVisible();
  // Past a third goes next.
  await drag(page, { x: x + p.vw * 0.3, y }, { x: x - p.vw * 0.2, y });
  await expect(page.getByText(/· Photo 2 of \d+$/)).toBeVisible();
  // A fast short flick goes next.
  await drag(page, { x: x + 40, y }, { x: x - 40, y }, { fast: true });
  await expect(page.getByText(/· Photo 3 of \d+$/)).toBeVisible();
});

test('VIEWER-4 VIEWER-5 a double-click zooms 3x on that point, drag pans without changing photo, a second double-click returns to fit', async ({ page }) => {
  await page.goto('/');
  await openPhoto(page);
  const before = await visiblePhoto(page);
  const words = await caption(page);
  const at = { x: before.left + before.x + before.w * 0.35, y: before.top + before.vh / 2 };
  const fx = (at.x - before.left - before.x) / before.w;
  await page.mouse.dblclick(at.x, at.y);
  await expect.poll(async () => (await visiblePhoto(page)).w / before.w, { timeout: 5000 }).toBeGreaterThan(2.7);
  const z = await visiblePhoto(page);
  expect(z.w / before.w).toBeLessThan(3.3); // maxScale 3
  expect(Math.abs((at.x - z.left - z.x) / z.w - fx)).toBeLessThan(0.08); // centered on the tapped point
  // VIEWER-5: dragging while zoomed pans, never changes photo.
  await drag(page, { x: at.x, y: at.y }, { x: at.x - 150, y: at.y });
  const panned = await visiblePhoto(page);
  expect(panned.src).toBe(z.src);
  expect(Math.abs(panned.x - z.x)).toBeGreaterThan(50);
  expect(await caption(page)).toBe(words);
  // VIEWER-6: zoomed, a drag down pans and never closes.
  await drag(page, { x: at.x, y: at.y - 100 }, { x: at.x, y: at.y + 150 });
  await expect(page.getByTestId('viewer-backdrop')).toBeVisible();
  await page.mouse.dblclick(at.x, at.y);
  await expect.poll(async () => Math.round((await visiblePhoto(page)).w)).toBe(Math.round(before.w));
});

test('VIEWER-6 dragging down fades the backdrop; a short drag springs back, past 120 pt closes', async ({ page }) => {
  await page.goto('/');
  await openPhoto(page);
  const { x, y } = await mid(page);
  expect(await backdropFade(page)).toBeGreaterThan(0.99);
  await drag(page, { x, y }, { x, y: y + 60 }, { release: false });
  const faded = await backdropFade(page);
  expect(faded).toBeLessThan(0.99);
  expect(faded).toBeGreaterThan(0);
  await page.mouse.up();
  await expect.poll(() => backdropFade(page)).toBeGreaterThan(0.99);
  await expect(page.getByTestId('viewer-backdrop')).toBeVisible();
  await drag(page, { x, y }, { x, y: y + 200 });
  await expect(page.getByTestId('viewer-backdrop')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
});

// QA-R2 / QA-R3 (qa-tdd review of the viewer build, Nov 26; engineer wrote them red first).
test('QA-R2 VIEWER-5 VIEWER-6 after a double-click zoom, a long drag down pans and never closes', async ({ page }) => {
  await page.goto('/');
  await openPhoto(page);
  const before = await visiblePhoto(page);
  const { x, y } = await mid(page);
  await page.mouse.dblclick(x, y);
  await expect.poll(async () => (await visiblePhoto(page)).w).toBeGreaterThan(before.w * 1.05); // the zoom has started, its animation not ended
  await drag(page, { x, y: y - 150 }, { x, y: y + 200 }, { fast: true });
  await settle(page, async () => Math.round((await visiblePhoto(page)).w));
  expect((await visiblePhoto(page)).w / before.w).toBeGreaterThan(2.7);
  await expect(page.getByTestId('viewer-backdrop')).toBeVisible();
  expect(await backdropFade(page)).toBeGreaterThan(0.99);
});

test('QA-R3 VIEWER-6 a drag down the browser cancels (pointercancel) leaves the backdrop solid and the viewer open', async ({ page }) => {
  await page.goto('/');
  await openPhoto(page);
  const { x, y } = await mid(page);
  await drag(page, { x, y }, { x, y: y + 60 }, { release: false });
  expect(await backdropFade(page)).toBeLessThan(0.99);
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 })));
  await expect.poll(() => backdropFade(page)).toBeGreaterThan(0.99);
  await expect(page.getByTestId('viewer-backdrop')).toBeVisible();
  await page.mouse.up();
});

test('VIEWER-7 VIEWER-23 Kevin: a click hides the controls and the strip, a second click brings them back', async ({ page }) => {
  await page.goto('/');
  await openPhoto(page);
  const { x, y } = await mid(page);
  await page.mouse.click(x, y);
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: VSTRIP })).toHaveCount(0);
  await page.mouse.click(x, y);
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
  await expect(page.getByTestId('viewer-strip')).toBeVisible();
});

test('VIEWER-12 Grandma Jo at 360 px: every label on one line, nothing cut off, nothing overlapping', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await galleryLoaded(page);
  await asJo(page);
  await openPhoto(page, 1);
  const report = await page.getByTestId('viewer-backdrop').evaluate((root) => {
    const strip = root.querySelector('[data-testid="viewer-strip"]');
    const buttons = [...root.querySelectorAll('[role="button"]')].filter((b) => !strip || !strip.contains(b));
    const leaves = [...root.querySelectorAll('div, span')].filter((e) => e.children.length === 0 && e.innerText && e.innerText.trim() && (!strip || !strip.contains(e)));
    const bad = [];
    for (const t of leaves) {
      const cs = getComputedStyle(t);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
      const inButton = !!t.closest('[role="button"]');
      const isCaption = !inButton && t.getBoundingClientRect().height > lh * 1.6 && !/Photo \d+ of/.test(t.innerText);
      if (t.scrollWidth > t.clientWidth + 1 || t.scrollHeight > t.clientHeight + 1) bad.push(`cut: ${t.innerText.slice(0, 30)}`);
      if (!isCaption && t.getBoundingClientRect().height > lh * 1.6) bad.push(`wraps: ${t.innerText.slice(0, 30)}`);
    }
    const boxes = [...buttons, ...leaves.filter((l) => !l.closest('[role="button"]'))].map((e) => ({ name: (e.getAttribute('aria-label') || e.innerText).slice(0, 24), r: e.getBoundingClientRect() }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, b = boxes[j].r;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 1 && oy > 1) bad.push(`overlap: ${boxes[i].name} / ${boxes[j].name}`);
    }
    return bad;
  });
  expect(report).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('VIEWER-18 on the web: arrow keys move, Escape closes (Kevin and Grandma Jo)', async ({ page }) => {
  await page.goto('/');
  await openPhoto(page);
  const first = (await visiblePhoto(page)).src;
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await visiblePhoto(page)).src).not.toBe(first);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await visiblePhoto(page)).src).toBe(first);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('viewer-backdrop')).toHaveCount(0);
  await asJo(page);
  await openPhoto(page, 1);
  const n = Number((await page.getByText(/· Photo \d+ of \d+$/).innerText()).match(/Photo (\d+)/)[1]);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText(new RegExp(`· Photo ${n + 1} of \\d+$`))).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('viewer-backdrop')).toHaveCount(0);
});

test('VIEWER-21 VIEWER-22 Kevin: the strip sits above Save, marks the current photo, a tap jumps unzoomed, and it keeps the current one in view', async ({ page }) => {
  await page.goto('/');
  await openPhoto(page);
  const strip = page.getByTestId('viewer-strip');
  await expect(strip).toBeVisible();
  const sb = await strip.boundingBox();
  const save = await page.getByRole('button', { name: 'Save to my phone' }).boundingBox();
  expect(sb.y + sb.height).toBeLessThanOrEqual(save.y + 1);
  const thumbs = strip.getByRole('button', { name: VSTRIP });
  expect(await thumbs.count()).toBeGreaterThan(1);
  const current = strip.locator('[aria-selected="true"]');
  await expect(current).toHaveCount(1);
  const cw = (await current.boundingBox()).width;
  const other = await strip.locator('[role="button"]:not([aria-selected="true"])').first().boundingBox();
  expect(cw).toBeGreaterThan(other.width);
  // Zoom, then tap another small photo: it opens unzoomed and the strip follows.
  const { x, y, p } = await mid(page);
  await page.mouse.dblclick(x, y);
  await expect.poll(async () => (await visiblePhoto(page)).w).toBeGreaterThan(p.w * 2);
  const target = strip.locator('[role="button"]:not([aria-selected="true"])').nth(2);
  const name = await target.getAttribute('aria-label');
  await target.click();
  await expect(strip.getByRole('button', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect.poll(async () => Math.round((await visiblePhoto(page)).w)).toBe(Math.round(p.w));
  // Swipe on several photos: the current small photo stays inside the screen.
  for (let i = 0; i < 6; i++) { await page.keyboard.press('ArrowRight'); await settle(page, () => strip.locator('[aria-selected="true"]').boundingBox()); }
  const cb = await strip.locator('[aria-selected="true"]').boundingBox();
  expect(cb.x).toBeGreaterThanOrEqual(0);
  expect(cb.x + cb.width).toBeLessThanOrEqual(390);
});

test('VIEWER-22 VIEWER-23 Grandma Jo: small photos are 48 by 48 or more, named, and a tap opens that photo', async ({ page }) => {
  await page.goto('/');
  await galleryLoaded(page);
  await asJo(page);
  await openPhoto(page, 1);
  const thumbs = page.getByTestId('viewer-strip').getByRole('button', { name: VSTRIP });
  expect(await thumbs.count()).toBeGreaterThan(1);
  for (const t of (await thumbs.all()).slice(0, 6)) {
    const b = await t.boundingBox();
    if (b && b.x >= 0 && b.x < 390) expect({ w: b.width >= 48, h: b.height >= 48 }).toEqual({ w: true, h: true });
  }
  const t3 = page.getByTestId('viewer-strip').getByRole('button', { name: /^Photo 3 of \d+, from / });
  await t3.click();
  await expect(page.getByText(/· Photo 3 of \d+$/)).toBeVisible();
  // A click on the photo never hides the strip in Easy view On.
  const { x, y } = await mid(page);
  await page.mouse.click(x, y);
  await pageReady(page); // a hide, if it were going to happen, has finished
  await expect(page.getByTestId('viewer-strip')).toBeVisible();
});

// TYPE-10 (docs/product/SPEC-TYPE.md, DEC-84): the public demo at 393 px as Kevin, light and dark, Easy view off and
// on: computed font sizes match SPEC-TYPE's table. Written by the engineer (Nov 24) from the spec, flagged for qa-tdd:
// "a post title" is Feed's inline title (post-title-<id>), which opens the description at body size (RD-71), and
// "a button" is the reply row's "Post" (a kit Button, headline).
const sizeOfEl = (loc) => loc.evaluate((el) => {
  const leaf = [el, ...el.querySelectorAll('*')].reverse().find((n) => n.children.length === 0 && n.textContent.trim() !== '') ?? el;
  return parseFloat(getComputedStyle(leaf).fontSize);
});
const setEasyView = async (page, on) => {
  await page.getByRole('tab', { name: /^More/ }).click();
  await page.getByRole('button', { name: /^Easy view, (On|Off)$/ }).click();
  await page.getByRole('radio', { name: on ? 'On' : 'Off', exact: true }).click();
  await expect(page.getByRole('radio', { name: on ? 'On' : 'Off', exact: true })).toBeChecked();
};
for (const look of ['light', 'dark']) {
  test(`TYPE-10 (${look}) Kevin's text sizes match the named scale, Easy view off and on`, async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.emulateMedia({ colorScheme: look });
    await page.goto('/');
    await galleryLoaded(page);
    for (const easy of [false, true]) {
      if (easy) await setEasyView(page, true);
      // SPEC-TYPE's table: [Standard, Easy view].
      const want = (std, ez) => (easy ? ez : std);
      await page.getByRole('tab', { name: /^Gallery/ }).click();
      const got = {};
      got.greeting = await sizeOfEl(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ }).first());
      await onFeed(page);
      got.feedTitle = await sizeOfEl(page.getByRole('heading', { name: 'Feed', exact: true }).first());
      got.postTitle = await sizeOfEl(page.locator('[data-testid^="post-title-"]').filter({ visible: true }).first());
      got.postBody = await captionSize(page);
      got.postDate = await sizeOfEl(page.locator('[data-testid^="when-"]').filter({ visible: true }).first());
      got.button = await sizeOfEl(page.getByRole('button', { name: 'Post', exact: true }).filter({ visible: true }).first());
      await page.getByRole('tab', { name: /^Share/ }).click();
      got.newPost = await sizeOfEl(page.getByRole('heading', { name: 'New post' }));
      got.addPhotos = await sizeOfEl(page.locator('[data-testid="share-spot"]').getByText(/^Add photos( or videos)?$/).first());
      expect({ easy, ...got }).toEqual({
        easy,
        greeting: want(34, 38), // largeTitle
        feedTitle: want(34, 38), // largeTitle
        postTitle: want(17, 21), // body (inline title, RD-71)
        postBody: want(17, 21), // body
        postDate: want(15, 19), // subheadline
        button: want(17, 21), // headline
        newPost: want(22, 26), // title2 (SHARE-ST-28)
        addPhotos: want(17, 21), // headline (SHARE-ST-29)
      });
    }
  });
}

// SHARE-ST-34 (SPEC-REDESIGN 1j-2 round 4, DEC-84; written by qa-tdd, Nov 24; REWRITTEN Nov 25, DEMO-KINDS-7): the
// public demo at 393 px, light, dark and Easy view. "New post" is 22 (Easy 26), "Add photos" 17 (Easy 21), the circle
// 52 (Easy 60). SUPERSEDED expectation: Nov 24 asserted NO kind tile (post_kinds off). Chase turned post_kinds on for
// the web demo only on Nov 25, so the parent now sees the Event, News and Saying row, each word at headline 17 (Easy 21).
// EXACT, NOT LOOSENED: the three tiles are required, with these sizes. SUBSTITUTION (qa-tdd): the spec says "as Kevin
// and as Grandma Jo", but the demo's Grandma Jo is a viewer with no Share tab (RD-9), so her Easy view column is checked as
// Graham (the demo parent, was Kevin) with Easy view turned on. If the demo ever gives Jo a Share tab, her own run below
// takes over. Screenshots for grandparent-ux in test-results/share-st-34/.
const circleIn = (spot) => spot.evaluate((root) => {
  const hits = [...root.querySelectorAll('*')].map((el) => {
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return { w: Math.round(r.width), h: Math.round(r.height), radius: parseFloat(s.borderTopLeftRadius) || 0, bg: s.backgroundColor };
  }).filter((x) => x.w >= 40 && x.w === x.h && x.radius >= x.w / 2 - 1 && x.bg !== 'rgba(0, 0, 0, 0)');
  return hits.length ? hits[0].w : null;
});
test('SHARE-ST-34 DEMO-KINDS-7 Share start at standard sizes on the demo: "New post" 22/26, "Add photos" 17/21, circle 52/60, Event/News/Saying row at headline 17/21 (light, dark, Easy view)', async ({ page }) => {
  const shots = path.join(__dirname, '..', 'test-results', 'share-st-34');
  await page.setViewportSize({ width: 393, height: 852 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await galleryLoaded(page);
  const check = async (easy, shot) => {
    await page.getByRole('tab', { name: /^Share/ }).click();
    const heading = page.getByRole('heading', { name: 'New post' });
    await expect(heading).toBeVisible();
    const spot = page.getByTestId('share-spot').filter({ visible: true }).first();
    const got = {
      newPost: await sizeOfEl(heading),
      addPhotos: await sizeOfEl(spot.getByText(/^Add photos( or videos)?$/).first()),
      circle: await circleIn(spot),
    };
    expect.soft({ shot, ...got }).toEqual({ shot, newPost: easy ? 26 : 22, addPhotos: easy ? 21 : 17, circle: easy ? 60 : 52 });
    // Switch on for the demo (DEMO-KINDS-7): the three kinds show, each word at headline size (SPEC-TYPE: 17, Easy view 21).
    await expect.soft(page.getByRole('button', { name: /^(Add an event|Share news|Add a saying)$/ })).toHaveCount(3);
    for (const k of ['event', 'news', 'saying']) {
      expect.soft(await sizeOfEl(page.getByTestId(`share-kind-word-${k}`)), `${k} word size`).toBe(easy ? 21 : 17);
    }
    await page.screenshot({ path: path.join(shots, `${shot}.png`) });
  };
  await check(false, 'kevin-light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await check(false, 'kevin-dark');
  await page.emulateMedia({ colorScheme: 'light' });
  // Grandma Jo's column (Easy view on), checked as Kevin with Easy view on: see the substitution note above.
  await setEasyView(page, true);
  await check(true, 'kevin-easy-view-light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await check(true, 'kevin-easy-view-dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await setEasyView(page, false);
  await asJo(page);
  if (await page.getByRole('tab', { name: /^Share/ }).count()) {
    await check(true, 'jo-easy-view');
  } else {
    test.info().annotations.push({ type: 'SHARE-ST-34', description: 'Grandma Jo has no Share tab in the demo (viewer, RD-9); her Easy view sizes were checked as Kevin with Easy view on.' });
  }
  await resetDemo(page);
});

// ===== DEMO-KINDS (Chase, Nov 25: post_kinds ON for the web demo only), written first (red) by qa-tdd =====
// The demo parent is Graham (fixture owner; Chase called him Kevin before T45). Grandma Jo is a viewer with no Share tab.
// These SUPERSEDE the Nov 24 switch-off expectations (SHARE-ST-34's "no kind tile"; SHARE-ST-30 in the demo). Exact, not loosened.
const KIND_BUTTONS = /^(Add an event|Share news|Add a saying)$/;
const kindsRowAt = async (page, { width, look, easy }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.emulateMedia({ colorScheme: look });
  await page.goto('/');
  await galleryLoaded(page);
  if (easy) await setEasyView(page, true);
  await page.getByRole('tab', { name: /^Share/ }).click();
  await expect(page.getByRole('heading', { name: 'New post' })).toBeVisible();
};
for (const look of ['light', 'dark']) {
  for (const easy of [false, true]) {
    test(`DEMO-KINDS-7 the demo parent sees Event, News and Saying on Share at 390 px (${look}, Easy view ${easy ? 'on' : 'off'}), headline ${easy ? 21 : 17}`, async ({ page }) => {
      await kindsRowAt(page, { width: 390, look, easy });
      await expect(page.getByTestId('share-kinds')).toBeVisible();
      await expect(page.getByRole('button', { name: KIND_BUTTONS })).toHaveCount(3);
      for (const [k, word] of [['event', 'Event'], ['news', 'News'], ['saying', 'Saying']]) {
        const w = page.getByTestId(`share-kind-word-${k}`);
        await expect(w).toHaveText(word);
        expect(await sizeOfEl(w)).toBe(easy ? 21 : 17);
        const box = await page.getByTestId(`share-kind-${k}`).boundingBox();
        expect(box.height).toBeGreaterThanOrEqual(48);
        expect(box.x + box.width).toBeLessThanOrEqual(390);
      }
    });
  }
}

test('DEMO-KINDS-8 Grandma Jo (a viewer) has no Share tab and so no kinds row anywhere', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await galleryLoaded(page);
  await asJo(page);
  await expect(page.getByRole('tab', { name: /^Share/ })).toHaveCount(0);
  await expect(page.locator('[data-testid^="share-kind"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: KIND_BUTTONS })).toHaveCount(0);
});

test('DEMO-KINDS-9 a returning visitor whose browser saved an earlier demo family (before the kinds switch) gets the kinds row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await galleryLoaded(page);
  // Pretend this browser saved the family on an earlier visit: the seed version the demo had before the switch went on.
  await page.evaluate(() => localStorage.setItem('hearth.demoSeed', 'wofmn'));
  await page.reload();
  await galleryLoaded(page);
  await page.getByRole('tab', { name: /^Share/ }).click();
  await expect(page.getByRole('button', { name: KIND_BUTTONS })).toHaveCount(3);
  // and the family is the sample one, saved at the current version (not an empty or half-cleared one)
  expect(await page.evaluate(() => localStorage.getItem('hearth.demoSeed'))).not.toBe('wofmn');
});

// The walk (DEC-91): Graham picks a kind, writes in the one big box, sets the chips, Next, picks a group, Send, "See it in Feed".
const BOX = /^(What's happening\?|What's your news\?|What did they say\?)$/;
const pickDayOnSheet = async (page, iso) => {
  await page.getByRole('button', { name: 'Pick a day' }).click();
  for (let i = 0; i < 14 && !(await page.getByTestId(`day-${iso}`).filter({ visible: true }).count()); i++) await page.getByRole('button', { name: 'Later month' }).click();
  await page.getByTestId(`day-${iso}`).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Done' }).click();
};
const CHIPS = { 'Where, optional': ['Add a place', 'Where'], 'Who said it': ['Who said it?', 'Who said it'], 'Age then, optional': ['Add their age', 'Age'] };
const sendKind = async (page, kindLabel, fields, groupTile) => {
  await page.getByRole('tab', { name: /^Share/ }).click();
  await page.getByRole('button', { name: kindLabel }).click();
  for (const [label, text] of Object.entries(fields)) {
    if (label === 'What day') await pickDayOnSheet(page, text);
    else if (CHIPS[label]) { await page.getByRole('button', { name: CHIPS[label][0] }).click(); await page.getByLabel(CHIPS[label][1], { exact: true }).fill(text); }
    else await page.getByLabel(BOX).fill(text);
  }
  await page.getByRole('button', { name: 'Next: who gets it' }).click();
  await page.getByRole('button', { name: groupTile }).click();
  await page.getByRole('button', { name: /^Send to / }).click();
  await page.getByRole('button', { name: 'See it in Feed' }).click();
};
const EVERYONE = /^Everyone, \d+ people, not picked$/;
const MOM_SIDE = /^Grandparents . Mom's side, \d+ people, not picked$/;
const noGroupTitlesFor = async (page) => {
  // members never see group names (Jo is in Everyone and Dad's side, and still sees neither title)
  await expect(page.getByText(/Grandparents . (Mom|Dad)'s side/)).toHaveCount(0);
};
const inFeed = async (page) => {
  await page.getByRole('tab', { name: /^Feed/ }).click();
};

test('DEMO-KINDS-10 News walk: Graham sends News to Mom\'s side; Feed shows the news card; Grandma Jo is not in that group so never sees it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await galleryLoaded(page);
  await sendKind(page, 'Share news', { 'Your news': 'We found a house with a big yard!' }, MOM_SIDE);
  await inFeed(page);
  await expect(page.getByText('We found a house with a big yard!').filter({ visible: true }).first()).toBeVisible();
  await expect(page.locator('[data-testid^="kind-"]').filter({ visible: true }).first()).toContainText('We found a house with a big yard!');
  await asJo(page);
  await inFeed(page);
  await expect(page.getByText(/First ride on the balance bike/).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText('We found a house with a big yard!')).toHaveCount(0);
  await noGroupTitlesFor(page);
});

test('DEMO-KINDS-11 News walk: sent to Everyone, Grandma Jo sees the news card and no group titles', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await galleryLoaded(page);
  await sendKind(page, 'Share news', { 'Your news': 'Pawpaw is home from the hospital.' }, EVERYONE);
  await asJo(page);
  await inFeed(page);
  await expect(page.locator('[data-testid^="kind-"]').filter({ visible: true }).first()).toContainText('Pawpaw is home from the hospital.');
  await noGroupTitlesFor(page);
});

test('DEMO-KINDS-12 Event walk: What day 2026-12-24, Feed shows the event with its day; Grandma Jo (in Everyone) sees it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await galleryLoaded(page);
  await sendKind(page, 'Add an event', { "What's happening": 'Christmas Eve supper', 'What day': '2026-12-24', 'Where, optional': 'Gammy\'s house' }, EVERYONE);
  await inFeed(page);
  const card = page.locator('[data-testid^="kind-"]').filter({ visible: true }).first();
  await expect(card).toContainText('Christmas Eve supper');
  await expect(card).toContainText(/Dec(ember)? 24/);
  await expect(card).toContainText("Gammy's house");
  await asJo(page);
  await inFeed(page);
  await expect(page.locator('[data-testid^="kind-"]').filter({ visible: true }).first()).toContainText('Christmas Eve supper');
  await noGroupTitlesFor(page);
});

test('DEMO-KINDS-13 Saying walk: the card says who sees the words and the age; Feed shows the words, who and the age', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await galleryLoaded(page);
  await page.getByRole('tab', { name: /^Share/ }).click();
  await page.getByRole('button', { name: 'Add a saying' }).click();
  await page.getByLabel(BOX).fill('The moon is following our car');
  await page.getByRole('button', { name: 'Who said it?' }).click();
  await page.getByLabel('Who said it', { exact: true }).fill('Leo');
  await page.getByRole('button', { name: 'Add their age' }).click();
  await page.getByLabel('Age', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Next: who gets it' }).click();
  await page.getByRole('button', { name: EVERYONE }).click();
  // DEC-91: the summary on step 2 says who sees the words and the age.
  await expect(page.getByTestId('share-summary')).toContainText('these words, who said them, and the age');
  await page.getByRole('button', { name: /^Send to / }).click();
  await page.getByRole('button', { name: 'See it in Feed' }).click();
  await inFeed(page);
  const card = page.locator('[data-testid^="kind-"]').filter({ visible: true }).first();
  await expect(card).toContainText('The moon is following our car');
  await expect(card).toContainText('Leo, age 4');
  await asJo(page);
  await inFeed(page);
  await expect(page.locator('[data-testid^="kind-"]').filter({ visible: true }).first()).toContainText('Leo, age 4');
  await noGroupTitlesFor(page);
});

test('DEMO-KINDS-14 the demo\'s Try this panel has a step for Share, Event, News and Saying (laptop width)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await galleryLoaded(page);
  const step = page.getByText(/^4\. /);
  await expect(step).toBeVisible();
  for (const w of ['Share', 'Event', 'News', 'Saying']) await expect(step).toContainText(w);
});

// ===== PR #174 fix round (grandparent-ux), written first (red), Nov 24, by qa-tdd =====
// GUX-T2 (P1): at 390 x 844 the empty postcard starts right under the "New post" row (the row is the heading's
// nearest box at least 48 px tall), not centered with a big gap. Light and dark.
const rowBottom = (heading) => heading.evaluate((el) => {
  let n = el;
  while (n && n.getBoundingClientRect().height < 48) n = n.parentElement;
  return (n ?? el).getBoundingClientRect().bottom;
});
test('GUX-T2 at 390 px the empty postcard is top-aligned: its top is within 32 px of the "New post" row (light, dark)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await galleryLoaded(page);
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.getByRole('tab', { name: /^Share/ }).click();
    const heading = page.getByRole('heading', { name: 'New post' });
    await expect(heading).toBeVisible();
    const card = page.getByTestId('share-card').filter({ visible: true }).first();
    await expect(card).toBeVisible();
    const gap = Math.round((await card.boundingBox()).y - (await rowBottom(heading)));
    expect.soft({ scheme, gap, close: gap >= 0 && gap <= 32 }).toEqual({ scheme, gap, close: true });
  }
});

// GUX-T6 (P2) tested Gallery's birthday card "Not now" against the floating tab bar. CAL-S4 (Nov 26, Chase: "hide this
// from the feed"): the card is gone, so that test was replaced by this one. At 390 x 844 nothing on Gallery asks for a
// birthday, and Me's "My birthday" button, once scrolled to, sits clear above the tab bar (the same reach rule GUX-T6 held).
test('GUX-T6 CAL-S4 at 390 x 844 Gallery has no birthday card, and Me\'s "Add my birthday", once scrolled to, sits clear above the floating tab bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await galleryLoaded(page);
  await expect(page.getByTestId('birthday-card')).toHaveCount(0);
  await page.getByRole('tab', { name: /^More/ }).click();
  await page.getByRole('button', { name: 'Me', exact: true }).filter({ visible: true }).click();
  const add = page.getByTestId('my-birthday').filter({ visible: true }).getByRole('button', { name: 'Add my birthday' });
  const bar = page.getByRole('tablist');
  await expect(bar).toBeVisible();
  await add.scrollIntoViewIfNeeded();
  await settle(page, () => add.boundingBox());
  const b = await add.boundingBox();
  const barTop = (await bar.boundingBox()).y;
  expect({ bottom: Math.round(b.y + b.height), barTop: Math.round(barTop), clear: b.y + b.height <= barTop })
    .toEqual({ bottom: Math.round(b.y + b.height), barTop: Math.round(barTop), clear: true });
});

// EF-HE-1-AC1/AC2 (intake #162, SPEC-EVAL-FIXES): supersedes the ff4543e guard ("Open" shown, "Open the chat …" spoken).
// Each Messages Open button now shows which chat it opens, and its accessible name is exactly the words shown.
test('EF-HE-1-AC1 EF-HE-1-AC2 at 390 px: each Messages Open button shows distinct words and its accessible name is exactly them', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await galleryLoaded(page);
  await page.getByRole('tab', { name: /^More/ }).click();
  await page.getByRole('button', { name: /^Messages(,|$)/ }).click();
  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
  const open = page.getByRole('button', { name: /^Open / });
  await expect(open.first()).toBeVisible();
  const seen = await open.evaluateAll((bs) => bs.map((b) => ({ name: b.getAttribute('aria-label'), shown: (b.innerText || '').replace(/\s+/g, ' ').trim() })));
  expect(seen.length).toBeGreaterThan(1);
  for (const s of seen) expect(s.name).toBe(s.shown);
  const shown = seen.map((s) => s.shown);
  expect(new Set(shown).size).toBe(shown.length);
  await expect(page.getByRole('button', { name: /^Open the chat/ })).toHaveCount(0);
});
// REACT-13a/c/d (Chase, Nov 24: 😂 👍 🎉 look small and blurry on Feed, ❤️ is crisp, and the ❤️ pill doesn't line up).
// Written first (red), Nov 24, by qa-tdd. Apple Color Emoji are bitmaps, so a pill at a fractional x resamples them;
// every reaction pill must sit at a whole-pixel x with a whole-pixel width, and the first pill's outline must start on
// the photo's left edge (RD-64's -8 margin put it 8 px outside). Jest contract: src/screens/__tests__/reactEmoji.test.tsx.
const PILL = '[aria-label="Love it"], [aria-label="Haha"], [aria-label="Like it"], [aria-label="Hooray"]';
for (const width of [390, 1280]) {
  test(`REACT-13 at ${width} px: every reaction pill has a whole-pixel x and width; the first lines up with the photo`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto('/');
    await galleryLoaded(page);
    await onFeed(page);
    const pills = page.locator(PILL).filter({ visible: true });
    await expect(pills.first()).toBeVisible();
    const boxes = await pills.evaluateAll((els) => els.map((e) => {
      const r = e.getBoundingClientRect();
      return { label: e.getAttribute('aria-label'), x: r.x, width: r.width };
    }));
    expect(boxes.length).toBeGreaterThanOrEqual(4);
    expect.soft(boxes.filter((b) => !Number.isInteger(b.x) || !Number.isInteger(b.width))).toEqual([]);
    // The first post's first pill (Love it) against the same post's first photo.
    const edges = await page.locator('[data-testid^="post-"]').filter({ visible: true }).first().evaluate((card, sel) => {
      const pill = card.querySelector(sel);
      const photo = card.querySelector('[aria-label^="Open photo"]');
      return { pill: pill && pill.getBoundingClientRect().left, photo: photo && photo.getBoundingClientRect().left };
    }, PILL);
    expect(edges.pill).not.toBeNull();
    expect(edges.photo).not.toBeNull();
    expect(Math.abs(edges.pill - edges.photo)).toBeLessThanOrEqual(0.5);
  });
}
