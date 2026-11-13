// DEMO-5 (RR-5): the demo as it will be hosted, under /demo/hearth/ on a static host with no fallback.
// Build first: bash scripts/build-demo.sh. Or check the live demo: SITE_URL=https://chaseholroyd.com SITE_BASE=/hearth
const { defineConfig } = require('../../e2e/node_modules/@playwright/test');
const { launchOptions } = require('../../e2e/browser'); // T12: cloud sandbox browser fallback
const { siteTarget } = require('../../e2e/site-target'); // DEMO-LIVE-1: SITE_URL checks the live demo
const { baseURL, webServer } = siteTarget(); // PAGES-1: SITE_BASE=/hearth for GitHub Pages
module.exports = defineConfig({
  testDir: '.',
  testMatch: /site\.spec\.js/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: '../test-results/e2e-site-artifacts',
  use: { launchOptions: launchOptions(), baseURL, viewport: { width: 390, height: 844 }, hasTouch: true },
  webServer,
});
