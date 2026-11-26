// INTAKE-206 (QA-A8, HEA-FR111): wait on a condition, never on a fixed sleep.
// `settle` reads a value every animation frame until it has been the same for `need` reads in a row;
// `pageReady` is that for a screenshot: fonts loaded, images finished, layout and scroll position still.
const nextFrame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));  // two frames

// need = how many reads in a row must match (each read is two frames, so 4 is about 130 ms and 12 about 400 ms).
// Use SLOW after a click or a wheel, where the thing being waited for may not have started moving yet.
const SLOW = { need: 12, timeout: 8000 };
async function settle(page, read, { need = 4, timeout = 5000 } = {}) {
  const end = Date.now() + timeout;
  let last;
  let same = 0;
  for (;;) {
    const now = JSON.stringify((await read()) ?? null);
    same = now === last ? same + 1 : 1;
    last = now;
    if (same >= need) return JSON.parse(now);
    if (Date.now() > end) throw new Error(`settle: still changing after ${timeout} ms: ${now}`);
    await nextFrame(page);
  }
}

const pageReady = async (page, opts = SLOW) => {
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await settle(
    page,
    () =>
      page.evaluate(() => ({
        images: [...document.images].filter((i) => !i.complete).length,
        h: document.documentElement.scrollHeight,
        w: document.documentElement.scrollWidth,
        scrolls: [...document.querySelectorAll('*')].filter((e) => e.scrollTop).map((e) => e.scrollTop),
        anims: document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).length,
      })),
    opts,
  );
};

// Pace a gesture in animation frames (about 16 ms each), not wall-clock sleeps.
const frames = async (page, n) => { for (let i = 0; i < n; i++) await nextFrame(page); };

// Run `action` (a click that opens another screen), wait until the page text has changed, then until it is still.
const afterChange = async (page, action) => {
  const text = () => page.evaluate(() => document.body.innerText);
  const before = await text();
  await action();
  const end = Date.now() + 5000;
  while ((await text()) === before) {
    if (Date.now() > end) throw new Error('afterChange: the page never changed after the action');
    await nextFrame(page);
  }
  await pageReady(page);
};

module.exports = { settle, pageReady, nextFrame, frames, afterChange, SLOW };
