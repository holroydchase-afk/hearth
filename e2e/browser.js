// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// T12 / QA-R6: which Chromium the e2e configs launch. Playwright's own build when it's installed (CI);
// otherwise the sandbox's /opt/pw-browsers/chromium (or HEARTH_PW_CHROMIUM), so cloud threads can run
// e2e without a second Playwright install. Never changes anything when Playwright's browser is there.
const fs = require('fs');

function launchOptions({ exists = fs.existsSync, bundled, fallback = process.env.HEARTH_PW_CHROMIUM || '/opt/pw-browsers/chromium' } = {}) {
  if (bundled === undefined) {
    try { bundled = require('@playwright/test').chromium.executablePath(); } catch { bundled = ''; }
  }
  if (bundled && exists(bundled)) return {};
  return exists(fallback) ? { executablePath: fallback } : {};
}

module.exports = { launchOptions };
