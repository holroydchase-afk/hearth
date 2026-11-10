// VID-18 (SPEC-MEDIA 4.1) on the real web bundle (Fake backend, placeholder poster on web): Chase posts a video,
// then on Photos and on the post screen the poster shows with a visible "Play" word button (17 pt+, 48 pt target,
// accessible name "Play video"); tapping it opens the full-screen player. 360 × 740.
const path = require('path');
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

const VIDEO = path.join(__dirname, '..', 'src', 'test', 'fixtures', 'android-like.mp4');

async function signIn(page, email) {
  await page.goto('/sign-in');
  await page.getByLabel('Your email').fill(email);
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await page.getByLabel('6-number code').fill('123456');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Photos of Mia and Leo' })).toBeVisible();
}

async function expectPlayButton(page) {
  const play = page.getByRole('button', { name: 'Play video' }).first();
  await expect(play).toBeVisible();
  await expect(play).toContainText('Play');
  const box = await play.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(48);
  expect(box.height).toBeGreaterThanOrEqual(48);
  const size = await play.getByText('Play', { exact: true }).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(17);
  return play;
}

async function expectPlayerOpens(page, play) {
  await play.click();
  await expect(page.locator('video')).toHaveCount(1);
  const close = page.getByRole('button', { name: 'Close the video' });
  await expect(close).toBeVisible();
  await close.click();
  await expect(page.locator('video')).toHaveCount(0);
}

test('VID-18 a video post shows its poster with a Play word button on Photos and the post screen; Play opens the player', async ({ page }) => {
  await signIn(page, 'chase@example.com');
  // video_posting is off by default (FLAG-5); turn it on in the Fake backend the way the server switch would.
  await page.evaluate((space) => {
    const be = globalThis.__hearthFake;
    be.state.featureFlags = { video_posting: true };
    be.state.spaceFeatures = { [`${space}:video_posting`]: true };
    be.changed();
  }, await page.evaluate(() => Object.keys(globalThis.__hearthFake.state.spaces)[0]));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Photos of Mia and Leo' })).toBeVisible();

  await page.getByRole('tab', { name: 'Share' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Pick photos or videos from your phone' }).click();
  await (await chooser).setFiles(VIDEO);
  await page.getByLabel("What's happening?").fill('Leo on the slide');
  await page.getByRole('checkbox', { name: "Grandparents – Dad's side, 2 people" }).click();
  await page.getByRole('button', { name: 'Post' }).click();
  await expect(page.getByText('Leo on the slide', { exact: true })).toBeVisible();

  // Stored as a video with a poster thumb (no migration: display = MP4, thumb = JPEG).
  const stored = await page.evaluate(() => {
    const be = globalThis.__hearthFake;
    const post = Object.values(be.state.posts).find((p) => p.caption === 'Leo on the slide');
    return Object.values(be.state.media).filter((m) => m.post === post.id).map((m) => ({ kind: m.kind, status: m.status }));
  });
  expect(stored).toEqual([{ kind: 'video', status: 'ready' }]);

  // Photos.
  await expectPlayerOpens(page, await expectPlayButton(page));

  // The post screen (full-screen viewer).
  await page.getByRole('button', { name: /full screen/ }).first().click();
  await expect(page.getByText(/^From Chase · /)).toBeVisible();
  await expectPlayerOpens(page, await expectPlayButton(page));
});
