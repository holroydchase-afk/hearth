# SMS provider pick (answers SPEC-SMS-SIGN-IN §6)

Owner: architect. Nov 10, 2026. DEC-56, TRACKER R42. Status: **pick made; vendor facts partly unverified** (see "What was checked").

## The pick: Twilio Verify, through Supabase Auth's built-in `twilio_verify` provider

**Why, in one line a relative would notice:** it is the route most likely to have texts arriving before Nov 18 without Chase filing a carrier registration, and it costs a couple of dollars a month at our size.

| Option | Registration Chase files | Code to write | Verdict |
|---|---|---|---|
| **Twilio Verify** (Supabase `twilio_verify`) | **None expected**: Verify sends from Twilio's own registered senders, so no A2P 10DLC brand/campaign or toll-free verification by us (**unverified live**, see below) | None (config only) | **Pick** |
| Twilio Messaging + toll-free number (Supabase `twilio`) | Toll-free verification: business or sole-proprietor details, sample messages, opt-in wording; review takes days to weeks (**unverified live**) | None | Fallback if Verify turns out to need registration |
| Twilio Messaging + 10DLC | A2P 10DLC brand + campaign (sole-proprietor allowed), fees and review time (**unverified live**) | None | No: slowest, most forms |
| Send SMS hook (Edge Function calling any sender) | Same as whichever sender it calls | A new function, secrets, tests, logs to scrub | No: more code, same registration problem. Revisit only to add the "Never read this code" line if Verify's template can't carry it |
| Vonage, MessageBird (Bird), Textlocal | Vonage/MessageBird still need US sender registration for plain SMS; Textlocal is UK-focused (**all unverified live**) | None | No: no advantage over Verify, extra vendor learning |

The provider list (`twilio`, `twilio_verify`, `messagebird`, `textlocal`, `vonage`) is verified locally: it is the Supabase CLI's own comment in `backend/supabase/config.toml`.

## §6 answers

1. **Vendor and A3.** Twilio is a US company; its default processing region is the US. A DPA is part of its standard terms. What it holds: the phone number, the code (Verify generates and checks the code itself, so Supabase never sees it), delivery and verification logs. Retention: Twilio's Verify API docs mark the `to` number as PII with a 30-day minimum time to live (search snippet Nov 10, 2026, page not loaded live; privacy-security); data region and backup deletion still **unverified**; record both from Twilio's pages before go-live. Carriers also see the text.
2. **US registration.** Expected none for Verify (see table). **This is the one fact that decides the Nov 18 date and it is unverified.** First action once twilio.com loads: confirm on Twilio's Verify docs/FAQ that US SMS through Verify needs no 10DLC or toll-free registration. If it does, switch to toll-free + `twilio` the same day; if approval can't land by Nov 18, the spec's stop rule applies (beta on email).
3. **Cost for ~12 people.** Verify: about $0.05 per *successful* verification plus about $0.008 per US text attempt (search snippet of Twilio's pricing page, **not loaded live**). No phone number to rent with Verify (**unverified**). Sign-in codes are only needed on a new phone or after sign-out, so expect 15 to 40 a month: **about $1 to $3/month**. Even the brief's ceiling (12 people x 3 a week, ~155/month) is about $9/month. A Twilio account must be upgraded from trial (trial only texts numbers you verify by hand); a $20 top-up covers months (**top-up minimum unverified**).
4. **Fraud and cost guards.**
   - Twilio Verify **Fraud Guard** (SMS pumping protection, said to be included in the base fee; **search snippet only**) stays on.
   - Verify **Geo Permissions: United States only** (Verify service settings). Plus the account-level Messaging geo permissions left at US only.
   - App: US-only parsing (BETA-SMS-3), no country picker.
   - Supabase: `max_frequency = "60s"` per number (now in `config.toml`, matching the 60 s resend wait) and `[auth.rate_limit] sms_sent` (30/hour project-wide locally; set hosted to 30 or lower). Per-IP sign-in limit `sign_in_sign_ups = 30` per 5 min already applies.
   - A low Twilio balance with auto-recharge **off** is the hard spending cap.
   - Supabase **phone confirmations on** (`[auth.sms] enable_confirmations = true`, hosted "Enable phone confirmations"). Off, Auth's password sign-up makes an account for any number without a code, which beats the phone-bound invite (PRIV-R1, `backend/tests/auth_config_test.sh`).
5. **`auth.users.phone` form.** Expected: digits without the `+` (`13045550100`), from memory of Supabase Auth's behaviour; **unverified**. Confirm on the local stack: uncomment the `test_otp` line, `supabase start`, sign in with `+13045550100` / `123456`, then `select phone from auth.users`. BETA-SMS-8 must normalize both sides (strip a leading `+`) whatever the result, which the spec already asks for.
6. **Test path.** `[auth.sms.test_otp]` with fictional `13045550100 = "123456"`, local stack and CI only. Safe because `deploy.sh` never pushes `config.toml`; it PATCHes only the email templates through the Management API. **Never put test_otp on hosted.** Twilio's own test credentials are not needed.
7. **Architecture docs.** Updated in this commit: `docs/architecture/01-system-overview.md` (vendor row), `02-data-flow.md` (text sign-in, Planned), `04-threat-model.md` (SIM swap, SMS pumping).

## Changes to the spec this forces (for staff-pm and grandparent-ux)
- **The text's words.** With Verify, Supabase's `[auth.sms] template` is not used; Twilio sends its own template ("Your Hearth verification code is: 123456" style, using the Verify service's friendly name) (**unverified**). §3.5's "Never read this code to anyone..." line needs a Twilio custom template, which Twilio reviews (**unverified**). BETA-SMS-7 should test the Verify template once known, or accept Twilio's default for the beta. If the safety line is a must-have and Twilio won't allow it, the Send SMS hook becomes the route (more code, plus registration).
- **Code expiry and length** come from Verify's service settings (6 digits; expiry Twilio's default, believed 10 minutes, **unverified**), not Supabase's `otp_expiry`.

## Chase's one step
Sign up at **https://www.twilio.com/try-twilio** (choose: product "Verify", use "Two-factor authentication / sign-in codes", language "No code"), upgrade with a **$20** card top-up and auto-recharge **off**, then paste the Account SID and Auth Token into the Claude environment "Hearth" as two secrets. Claude does the rest (Verify service named "Hearth", SMS only, Geo Permissions US only, Fraud Guard on, Supabase config). Recommendation: do it after the GitHub hold lifts and only once staff-pm confirms texts still target Nov 22.

## Secret names (values never in git)
| Where | Name |
|---|---|
| Claude environment "Hearth" | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, later `TWILIO_VERIFY_SERVICE_SID` |
| Local `supabase start` env | `SUPABASE_AUTH_SMS_TWILIO_VERIFY_ACCOUNT_SID`, `SUPABASE_AUTH_SMS_TWILIO_VERIFY_SERVICE_SID`, `SUPABASE_AUTH_SMS_TWILIO_VERIFY_AUTH_TOKEN` |
| Hosted Supabase (Management API `config/auth`, via `deploy.sh` later) | provider `twilio_verify` and its SID / token / service SID fields; exact field names **unverified**, read them from api.supabase.com before scripting |

## What was checked
- **Verified locally:** Supabase provider list and the `[auth.sms.twilio_verify]` key shape (CLI-generated `config.toml`); `deploy.sh` only patches email templates.
- **Could not load live:** supabase.com and twilio.com did not resolve in this session (network allow-list). Search-result snippets only for Twilio Verify pricing and Fraud Guard. Everything marked **unverified** must be checked on the vendor pages before texts go on. That includes the no-registration claim for Verify, which the pick depends on.

Last checked against code: 2026-11-10, backend/supabase/config.toml, backend/scripts/deploy.sh
