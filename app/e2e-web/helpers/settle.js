// INTAKE-206 (QA-A8, HEA-FR111): wait on a condition, never on a fixed sleep.
// `settle` reads a value every animation frame until it has been the same for `need` reads in a row;
// `pageReady` is that for a screenshot: fonts loaded, images finished, layout and scroll position still.
const nextFrame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));  // two frames

async function settle(page, read, { need = 4, timeout = 5000 } = {}) {
  const end = Date.now() + timeout;
  let last;
  let same = 0;
  for (;;) {
    const now = JSON.stringify(await read());
    same = now === last ? same + 1 : 1;
    last = now;
    if (same >= need) return JSON.parse(now);
    if (Date.now() > end) throw new Error(`settle: still changing after ${timeout} ms: ${now}`);
    await nextFrame(page);
  }
}

const pageReady = async (page, opts) => {
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await settle(
    page,
    () =>
      page.evaluate(() => ({
        images: [...document.images].filter((i) => !i.complete).length,
        h: document.documentElement.scrollHeight,
        w: document.documentElement.scrollWidth,
        scrolls: [...document.querySelectorAll('*')].filter((e) => e.scrollTop).map((e) => e.scrollTop),
        anims: document.getAnimations().filter((a) => a.playState === 'running').length,
      })),
    opts,
  );
};

// Pace a gesture in animation frames (about 16 ms each), not wall-clock sleeps.
const frames = async (page, n) => { for (let i = 0; i < n; i++) await nextFrame(page); };

module.exports = { settle, pageReady, nextFrame, frames };
