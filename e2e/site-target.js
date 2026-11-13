// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-LIVE-1: where the static-site checks (app/e2e-web/site.spec.js) point.
// No SITE_URL: serve the local build (dist-demo-site) under SITE_BASE, as before.
// SITE_URL=https://chaseholroyd.com: check the live demo; no local server.
function siteTarget(env = process.env) {
  const base = env.SITE_BASE || '/demo/hearth';
  if (env.SITE_URL) {
    if (!/^https:\/\/[^/\s]+/.test(env.SITE_URL)) throw new Error('SITE_URL must be an https address');
    return { baseURL: env.SITE_URL.replace(/\/+$/, ''), webServer: undefined };
  }
  return {
    baseURL: 'http://127.0.0.1:8091',
    webServer: {
      command: `node scripts/serve-static.js dist-demo-site 8091 ${base}`,
      cwd: '..',
      url: `http://127.0.0.1:8091${base}/`,
      reuseExistingServer: false,
    },
  };
}
module.exports = { siteTarget };
