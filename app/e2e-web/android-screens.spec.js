// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// HRT-WEB.2 (docs/product/SPEC-WEB-APP.md): every tab reads and taps right on Android-size phones, on the real
// fake-backend export in Chromium as a touch, mobile screen. WEB-APP-19: 360x800 and 412x915, Gallery, Feed,
// Share and More, Easy view on and off (16 runs). WEB-APP-20: the tab bar at both sizes. WEB-APP-21: both again in
// dark at 360x800. Written by qa-tdd, Nov 24. Each check collects every offender so one run shows them all.
const path = require('path');
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

const FIXTURE = path.join(__dirname, 'fixtures', 'park-gps.jpg');

const GREETING = /^Good (morning|afternoon|evening)/; // RD-11: the Gallery heading
const SIZES = [{ width: 360, height: 800 }, { width: 412, height: 915 }];
const TABS = ['Gallery', 'Share', 'Feed', 'More'];

async function signIn(page) {
  await page.goto('/sign-in');
  await page.getByLabel('Your email').fill('chase@example.com'); // Chase, a parent: Easy view starts Off (DEC-66)
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await page.getByLabel('6-number code').fill('123456');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: GREETING })).toBeVisible();
}

/** More → Easy view → On or Off, then back to Gallery. */
async function setEasyView(page, on) {
  await page.getByRole('tab', { name: /^More/ }).click();
  await page.getByRole('button', { name: /^Easy view, (On|Off)$/ }).click();
  await page.getByRole('radio', { name: on ? 'On' : 'Off', exact: true }).click();
  await expect(page.getByRole('radio', { name: on ? 'On' : 'Off', exact: true })).toBeChecked();
  await page.getByRole('tab', { name: /^Gallery/ }).click();
  await expect(page.getByRole('heading', { name: GREETING })).toBeVisible();
}

/** One post with a photo and a caption, so Gallery and Feed show real tiles and a post card, not only empty states. */
async function sharePhoto(page) {
  await page.getByRole('tab', { name: /^Share/ }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /^Add photos, up to \d+ at a time$/ }).click();
  await (await chooser).setFiles(FIXTURE);
  await page.getByLabel('Add a note (optional)').fill('Pumpkin patch with the whole family after school on Saturday');
  await page.getByLabel(/^Grandparents – Dad's side, 2 people, not picked$/).click();
  await page.getByRole('button', { name: /^Send to / }).click();
  await page.getByRole('tab', { name: /^Feed/ }).click();
  await expect(page.getByText('Pumpkin patch with the whole family after school on Saturday', { exact: true })).toBeVisible();
}

// What each tab shows once it has rendered (tabs load lazily; the old screen stays in the page, hidden).
const READY = {
  Gallery: (page) => page.getByRole('heading', { name: GREETING }),
  Share: (page) => page.getByText('New post', { exact: true }).filter({ visible: true }).first(),
  Feed: (page) => page.locator(':not([role="tab"] *)').getByText('Feed', { exact: true }).filter({ visible: true }).first(), // the screen title, not the tab's word
  More: (page) => page.getByRole('button', { name: /^Easy view, (On|Off)$/ }),
};

async function openTab(page, name) {
  const tab = page.getByRole('tab', { name: new RegExp(`^${name}`) });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(READY[name](page)).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** WEB-APP-19's four checks, run in the page; each list names its offenders (empty when it passes). */
function screenChecks(page) {
  return page.evaluate(() => {
    const W = window.innerWidth;
    const shown = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      for (let e = el; e; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
        if (e.getAttribute('aria-hidden') === 'true' && e !== document.body) return false;
      }
      return true;
    };
    const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    const name = (el) => (el.getAttribute('aria-label') || el.innerText || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 50);
    const scrollsX = (el) => { for (let e = el.parentElement; e; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
    const all = [...document.querySelectorAll('body *')];
    const texts = all.filter((el) => ownText(el) && shown(el));

    const sideways = [];
    if (document.documentElement.scrollWidth > W) sideways.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${W}`);
    if (document.body.scrollWidth > W) sideways.push(`body scrollWidth ${document.body.scrollWidth} > ${W}`);
    for (const el of texts) { // body is overflow:hidden on web, so also: nothing hangs off the right edge
      const r = el.getBoundingClientRect();
      if (r.right > W + 1 && r.left < W && !scrollsX(el)) sideways.push(`"${name(el)}" right edge ${Math.round(r.right)} > ${W}`);
    }

    const small = texts.map((el) => ({ el, px: parseFloat(getComputedStyle(el).fontSize) }))
      .filter((t) => t.px < 17).map((t) => `"${name(t.el)}" ${t.px}px`);

    const controls = all.filter((el) => el.matches('button, a[href], [role="button"], [role="link"], [role="tab"], [role="switch"]') && shown(el));
    const tiny = controls.map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 47.5 || r.height < 47.5)
      .map(({ el, r }) => `"${name(el)}" ${Math.round(r.width)}x${Math.round(r.height)}`);

    const cut = [];
    for (const el of all) {
      if (!shown(el)) continue;
      const s = getComputedStyle(el);
      const clipsX = /hidden|clip/.test(s.overflowX) || /hidden|clip/.test(s.overflow);
      const ellipsis = s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== 'none');
      const wideOver = el.scrollWidth > el.clientWidth + 1;
      const tallOver = el.scrollHeight > el.clientHeight + 1;
      if (!(el.innerText || '').trim()) continue;
      if (ellipsis && (wideOver || tallOver)) cut.push(`"${name(el)}" ellipsis`);
      else if (clipsX && wideOver) {
        const box = el.getBoundingClientRect();
        const spill = [...el.querySelectorAll('*')].find((d) => ownText(d) && shown(d) && d.getBoundingClientRect().right > box.right + 1 && d.getBoundingClientRect().left < box.right);
        if (spill) cut.push(`"${name(spill)}" cut by its box`);
      }
    }
    return { sideways, small, tiny, cut };
  });
}

/** WEB-APP-20: the four tabs, their words and their size. */
function tabBar(page) {
  return page.getByRole('tab').evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    const t = [...e.querySelectorAll('*')].find((d) => d.children.length === 0 && (d.innerText || '').trim() !== '');
    return {
      label: e.getAttribute('aria-label') || '',
      word: (e.innerText || '').replace(/[^A-Za-z ]/g, '').trim(),
      inside: r.left >= 0 && r.right <= window.innerWidth + 0.5 && r.top >= 0 && r.bottom <= window.innerHeight + 0.5,
      big: r.width >= 47.5 && r.height >= 47.5,
      wordCut: t ? t.scrollWidth > t.clientWidth + 1 : false,
    };
  }));
}

const looks = [
  { id: 'WEB-APP-19', scheme: 'light', sizes: SIZES },
  { id: 'WEB-APP-21', scheme: 'dark', sizes: [SIZES[0]] },
];

for (const look of looks) {
  for (const size of look.sizes) {
    for (const easy of [false, true]) {
      const where = `${size.width}x${size.height}, ${look.scheme}, Easy view ${easy ? 'on' : 'off'}`;
      test.describe(where, () => {
        test.use({ viewport: size, isMobile: true, hasTouch: true, colorScheme: look.scheme });

        for (const tab of TABS) {
          test(`${look.id} ${tab} at ${where}: no sideways scroll, text 17px+, targets 48x48, no cut text`, async ({ page }) => {
            await signIn(page);
            if (easy) await setEasyView(page, true);
            if (tab === 'Gallery' || tab === 'Feed') await sharePhoto(page);
            if (look.scheme === 'dark') expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
            await openTab(page, tab);
            const got = await screenChecks(page);
            expect.soft(got.sideways, 'no sideways scroll').toEqual([]);
            expect.soft(got.small, 'every visible text 17px or larger').toEqual([]);
            expect.soft(got.tiny, 'every button, link, tab and switch 48x48').toEqual([]);
            expect.soft(got.cut, 'no cut text').toEqual([]);
          });
        }

        test(`${look.id === 'WEB-APP-19' ? 'WEB-APP-20' : 'WEB-APP-21 WEB-APP-20'} tab bar at ${where}: four tabs inside the screen, 48x48, ${easy ? 'words uncut' : 'spoken names kept'}`, async ({ page }) => {
          await signIn(page);
          if (easy) await setEasyView(page, true);
          const tabs = await tabBar(page);
          expect(tabs.map((t) => t.label.split(',')[0].trim())).toEqual(TABS.map((t) => expect.stringMatching(new RegExp(`^${t}`))));
          for (const t of tabs) expect.soft({ label: t.label, inside: t.inside, big: t.big }).toEqual({ label: t.label, inside: true, big: true });
          if (easy) {
            expect(tabs.map((t) => t.word)).toEqual(TABS);
            expect(tabs.filter((t) => t.wordCut).map((t) => t.word)).toEqual([]);
          } else {
            expect(tabs.map((t) => t.word)).toEqual(['', '', '', '']); // DEC-66: icon-only, spoken names kept
          }
        });
      });
    }
  }
}
