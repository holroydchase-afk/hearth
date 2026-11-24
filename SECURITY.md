# Security

Hearth holds family photos, so security reports matter here.

Please report a vulnerability privately: message the maintainer, @holroydchase-afk, on GitHub, or use the repo's **Security** tab and **Report a vulnerability** if it is shown. Don't open a public issue for it, and don't test against real accounts or the hosted backend; the public demo at chaseholroyd.com/hearth runs entirely in your browser with a made-up family.

You'll get a reply within a week. This is a one-person proof of concept, so there is no bug bounty, but credit is given in the fix if you'd like it.

What's in place: row-level security on every table with SQL tests for each rule (`backend/tests/`), a CI check that no secrets reach the logs, a Dependabot config (`.github/dependabot.yml`; security fixes arrive once Dependabot security updates is switched on in Settings), and the threat model in [`docs/architecture/`](docs/architecture/).
