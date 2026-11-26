// Core loop on the real app bundle: share as Chase → Grandma Jo sees it → Nana Ruth doesn't →
// heart → comment → Chase deletes it. 360 × 740 (a 4-year-old Galaxy A).
const path = require('path');
const { test, expect } = require('../../e2e/node_modules/@playwright/test');

const FIXTURE = path.join(__dirname, 'fixtures', 'park-gps.jpg');

// RD-18 (redesign 1c): Gallery is the photo grid; the post cards (captions, hearts, replies) are on Feed (RD-17).
const onFeed = (page) => page.getByRole('tab', { name: /^Feed/ }).click();

async function signIn(page, email) {
  await page.goto('/sign-in');
  await page.getByLabel('Your email').fill(email);
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await page.getByLabel('6-number code').fill('123456');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/ } /* RD-11 */)).toBeVisible();
}

async function signOut(page, row) {
  await page.getByRole('tab', { name: /^More/ }).click(); // RD-15: Me and Help are rows in More
  await page.getByRole('button', { name: new RegExp(`^${row}(,|$)`) }).click(); // the row's own word: a bare 'Me' also matches "Write a comment"
  await page.getByRole('button', { name: 'Sign out of Hearth' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText('Welcome to Hearth')).toBeVisible();
}

/** Decrypt the first chunk of the stored display image with WebCrypto, inside the page. */
async function storedDisplayHeader(page, caption) {
  return page.evaluate(async (cap) => {
    const be = globalThis.__hearthFake;
    const post = Object.values(be.state.posts).find((p) => p.caption === cap);
    const m = Object.values(be.state.media).find((x) => x.post === post.id);
    const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const ct = b64(be.state.objects[m.display_key]);
    const key = await crypto.subtle.importKey('raw', b64(m.dek), 'AES-GCM', false, ['decrypt']);
    const first = ct.subarray(0, Math.min(ct.length, 65536 + 28));
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: first.subarray(0, 12) }, key, first.subarray(12)));
    const text = Array.from(plain.subarray(0, 4096), (c) => String.fromCharCode(c)).join('');
    return { cipherStartsJpeg: ct[0] === 0xff && ct[1] === 0xd8, plainStartsJpeg: plain[0] === 0xff && plain[1] === 0xd8, hasExif: text.includes('Exif'), width: m.width, height: m.height };
  }, caption);
}

test('core loop: share → Jo sees it → Ruth does not → heart → comment → delete', async ({ page }) => {
  // 1. Chase shares a 3000×2000 photo that carries GPS EXIF, to Dad's side only.
  await signIn(page, 'chase@example.com');
  await page.getByRole('tab', { name: 'Share' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /^Add photos, up to \d+ at a time$/ }).click();
  await (await chooser).setFiles(FIXTURE);
  await expect(page.getByRole('heading', { name: 'New post' })).toBeVisible(); // DEC-73 postcard
  await page.getByLabel('Say something, optional').fill('Pumpkin patch');
  await page.getByRole('button', { name: 'Next: who gets it' }).click(); // DEC-91: step 2
  await page.getByLabel(/^Grandparents – Dad's side, 2 people, not picked$/).click(); // Jo hasn't joined yet
  await page.getByRole('button', { name: /^Send to / }).click();
  await page.getByRole('button', { name: 'See it in Feed' }).click(); // DEC-91: the sent page
  await onFeed(page);
  await expect(page.getByText('Pumpkin patch', { exact: true })).toBeVisible();
  await expect(page.getByText(/can see this\.$/).first()).toBeVisible(); // RD-58 (UX-R15): one who-can-see line; the group's name is in Post options
  await page.getByRole('button', { name: 'Post options' }).click(); // MOMENT-6: the full words are under More
  await expect(page.getByText("Shared with Grandparents – Dad's side, 2 people")).toBeVisible(); // UX-R33 (engineer, flagged for qa-tdd)
  await page.getByRole('button', { name: 'Close this menu' }).click();

  // BETA-SHARE-2/3/5 on the real pipeline: stored bytes are ciphertext; inside, a 2048 px JPEG with no EXIF.
  const stored = await storedDisplayHeader(page, 'Pumpkin patch');
  expect(stored).toEqual({ cipherStartsJpeg: false, plainStartsJpeg: true, hasExif: false, width: 2048, height: 1365 });
  await signOut(page, 'Me');

  // 2. Grandma Jo joins from her invite link and sees it.
  await page.goto('/join/GRANDMAJ23');
  await expect(page.getByText('Chase invited you to see the family photos.')).toBeVisible();
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await page.getByRole('button', { name: 'See the photos' }).click();
  await page.getByLabel('Your email').fill('jo@example.com');
  await page.getByRole('button', { name: 'Send me a code' }).click();
  await page.getByLabel('6-number code').fill('123456');
  await page.getByRole('button', { name: 'Continue' }).click();
  await onFeed(page);
  await expect(page.getByText('Pumpkin patch', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^You, .+ can see this$/ })).toBeVisible(); // WHO-6/10: names, never the group
  await page.getByRole('button', { name: 'Post options' }).click();
  await expect(page.getByText('Who can see this')).toBeVisible();
  await page.getByRole('button', { name: 'Close this menu' }).click();
  await expect(page.getByRole('tab')).toHaveText([/Gallery/, /Feed/, /More/]); // RD-9: no Share tab for viewers
  await signOut(page, 'Help');

  // 3. Nana Ruth (Mom's side) does not see it.
  await signIn(page, 'ruth@example.com');
  await onFeed(page);
  await expect(page.getByText(/No photos yet/)).toBeVisible();
  await expect(page.getByText('Pumpkin patch', { exact: true })).toHaveCount(0);
  await signOut(page, 'Help');

  // 4. Grandma Jo hearts it and writes back.
  await signIn(page, 'jo@example.com');
  await onFeed(page);
  await page.getByRole('button', { name: 'Love it' }).click();
  await expect(page.getByRole('button', { name: /^Love it/ }).first()).toHaveText(/❤️\s*1/); // RD-53 (B3): the count beside the emoji
  await page.getByLabel('Add a comment for Chase').fill('Look at those cheeks!');
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page.getByText(/^Sent\. .+ will read it\.$/)).toBeVisible(); // BETA-REPLY-6/11: names the readers (AUD-8 default: the parents)
  // Full screen and back (BETA-SEE-3).
  await page.getByRole('button', { name: /^Open photo 1 of 1 full screen/ }).click();
  await expect(page.getByText(/^From Chase · /)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save to my phone' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await signOut(page, 'Help');

  // 5. Chase sees the heart and the comment (no "Seen by" count), then deletes it.
  await signIn(page, 'chase@example.com');
  await onFeed(page);
  await expect(page.getByRole('button', { name: /^Love it/ }).first()).toHaveText(/❤️\s*1/); // RD-53 (B3): the count beside the emoji
  await expect(page.getByText(/Look at those cheeks!/)).toBeVisible();
  await expect(page.getByText(/Seen by/)).toHaveCount(0); // RV-U1 (DEC-21): no "Seen by" count
  await page.getByRole('button', { name: 'Post options' }).click();
  await page.getByRole('button', { name: 'Delete post' }).click();
  await expect(page.getByText('Delete this post?')).toBeVisible(); // UX-R24 (RD-67): the iOS-style alert
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Pumpkin patch', { exact: true })).toHaveCount(0);
  const left = await page.evaluate(() => Object.values(globalThis.__hearthFake.state.posts).filter((p) => !p.deleted && p.status === 'published').length);
  expect(left).toBe(0);
});
