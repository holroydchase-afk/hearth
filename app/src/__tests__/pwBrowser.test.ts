// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// T12 / QA-R6: the web e2e must launch in the cloud sandbox, where Playwright's own Chromium build isn't
// installed but /opt/pw-browsers/chromium is. CI (browsers installed) keeps Playwright's own choice.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { launchOptions } = require('../../../e2e/browser.js');

describe('T12 Playwright browser pick', () => {
  it('T12-1 keeps Playwright\'s own Chromium when it is installed (CI)', () => {
    expect(launchOptions({ bundled: '/pw/chromium-1194/chrome', exists: () => true })).toEqual({});
  });
  it('T12-2 falls back to the sandbox Chromium when the pinned one is missing', () => {
    const have = new Set(['/opt/pw-browsers/chromium']);
    expect(launchOptions({ bundled: '/pw/chromium-1194/chrome', exists: (p: string) => have.has(p) }))
      .toEqual({ executablePath: '/opt/pw-browsers/chromium' });
  });
  it('T12-3 changes nothing when neither is there (Playwright then says what to install)', () => {
    expect(launchOptions({ bundled: '/pw/chromium-1194/chrome', exists: () => false })).toEqual({});
  });
  it('T12-4 HEARTH_PW_CHROMIUM names another fallback', () => {
    expect(launchOptions({ bundled: '/x', fallback: '/my/chrome', exists: (p: string) => p === '/my/chrome' }))
      .toEqual({ executablePath: '/my/chrome' });
  });
});
