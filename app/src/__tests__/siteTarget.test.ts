// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Chase Holroyd
// DEMO-LIVE-1: the static-site checks can run against the live demo (SITE_URL) as well as a local build,
// so demo-site.yml checks chaseholroyd.com/hearth/ right after Pages publishes it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { siteTarget } = require('../../../e2e/site-target.js');

describe('DEMO-LIVE-1 where the site checks point', () => {
  it('DEMO-LIVE-1a serves the local build when SITE_URL is not set', () => {
    const t = siteTarget({ SITE_BASE: '/hearth' });
    expect(t.baseURL).toBe('http://127.0.0.1:8091');
    expect(t.webServer).toEqual(expect.objectContaining({ url: 'http://127.0.0.1:8091/hearth/' }));
    expect(t.webServer.command).toContain('dist-demo-site 8091 /hearth');
  });
  it('DEMO-LIVE-1b points at the live site with no local server when SITE_URL is set', () => {
    const t = siteTarget({ SITE_URL: 'https://chaseholroyd.com', SITE_BASE: '/hearth' });
    expect(t).toEqual({ baseURL: 'https://chaseholroyd.com', webServer: undefined });
  });
  it('DEMO-LIVE-1c drops a trailing slash so paths join cleanly', () => {
    expect(siteTarget({ SITE_URL: 'https://chaseholroyd.com/' }).baseURL).toBe('https://chaseholroyd.com');
  });
  it('DEMO-LIVE-1d refuses anything but an https address', () => {
    expect(() => siteTarget({ SITE_URL: 'http://chaseholroyd.com' })).toThrow(/https/);
    expect(() => siteTarget({ SITE_URL: 'chaseholroyd.com' })).toThrow(/https/);
  });
});
