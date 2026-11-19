# Text sign-in: privacy-security review before turn-on (Nov 19, 2026)

Reviewer: `privacy-security`. Branch `claude/project-thread-df9051`, read only (nothing fixed here; each fix gets its own failing test first). Scope: migration 0026, `config.toml` `[auth]`/`[auth.sms*]`, `app/src/api/phone.ts`, `SupabaseApi` text methods and `Session.phone`, `SignInFlow`/`TextCodeFlow`, `JoinScreen`, the invite card phone field (`GroupsScreen`), `notify`'s push-only path, log scrubbing (BETA-SMS-15), `docs/architecture` text sign-in sections, ACCOUNTS Twilio row. DEC-57, DEC-74, `docs/product/SPEC-SMS-SIGN-IN.md`, `docs/eng/SMS-PROVIDER.md` (incl. "Nov 19 check").

The Nov 10 list's text (PRIV-R2..R6) is lost; this list is rebuilt from scratch and replaces it. PRIV-R1 (phone confirmations on) is still fixed: `config.toml:277` and `backend/tests/auth_config_test.sh` pass.

## Baseline (this branch, before any change)
- SQL: `backend/tests/run.sh` 1083 passed, 0 failed (SMS suite 35/35; smoke 9 ok; relay 24/24).
- App: `npm test` 1529 passed, 1 skipped, 1 todo (159 suites).
- `auth_config_test.sh` 4/4. `scripts/check-logs.mjs` OK.

## What holds up
- `invite_preview` never returns the target; `sign_in_with` only says phone/email/either (0026:183).
- `redeem_invite` compares E.164 to E.164 through `private.us_e164`, so `13045550100` and `+13045550100` both match and a phone-less account is refused with the same `rl_fail` error (0026:117).
- `target_phone` normalized by trigger whoever writes it; the refusal never echoes the number (0026:30-43). Helpers revoked from `public, anon, authenticated` (0026:52).
- New phone accounts no longer get the number as a placeholder name (0026:57-69, QA-R1).
- `report_client_error` checks fixed shapes first, then scrubs (0026:78-91). `safeMessage` and `errorReport` scrub numbers (`problemLog.ts:61`, `report.ts:27-30`). `check-logs.mjs` refuses log arguments named phone/mobile.
- Push-only: `claim_notification_batches` only picks email when `auth.users.email` is non-blank (0026:217, 235); `notify` filters `b.email` (`notify/index.ts:204`).
- `Session.phone` is E.164, only shown as last 4 (`MeScreen.tsx:33`, `TextCodeFlow.tsx:92`), kept in the Supabase session in SecureStore (`runtime.ts:44`); never logged.
- US-only parsing on both sides, same rule (`phone.ts:9-16`, 0026:10-21). No country picker. Twilio secrets via `env()` only (`config.toml:317-321`), test code commented out (`config.toml:292-293`).

## Findings

| ID | Sev | Where | Finding | Standard |
|---|---|---|---|---|
| TS-SEC-R1 | **P1** (P0 if the test confirms) | `config.toml:180,186` (`[auth] enable_signup = true`, passwords allowed), `config.toml:230` (`[auth.email] enable_confirmations = false`) | **Pre-account takeover through password sign-up.** Hearth has no passwords, but Supabase's `/auth/v1/signup {phone, password}` and `{email, password}` are open to anyone with the anon key. | ASVS 2.1/2.5 (V6 in 5.0), MASVS-AUTH |
| TS-SEC-R2 | **P1** | `SupabaseApi.ts:120`; `config.toml:205` (`sms_sent = 30`, project-wide) | **One stranger can lock every relative out of text sign-in.** No CAPTCHA, any US number makes an account (`shouldCreateUser: true`), and the hourly SMS cap is shared by the whole project. | ASVS V11 (business logic / anti-automation), LINDDUN (n/a), STRIDE D |
| TS-SEC-R3 | P2 | `0002_beta_api.sql:845-846` | Every parent who manages the space can read `invites.target_phone` and `target_email` through the column grant; the app never reads them. | ASVS V8 (data minimization), LINDDUN Identifiability |
| TS-SEC-R4 | P2 | `0026_sms_sign_in.sql:156` | `target_phone` is kept forever after the invite is used, revoked or expired. | ASVS V8.3 (retention), LINDDUN Non-compliance |
| TS-SEC-R5 | P2 | `0026_sms_sign_in.sql:57-69`; Supabase Auth OTP send | Every number anyone types makes an unconfirmed `auth.users` row (with the number) plus a `profiles` row, and nothing purges them. Numbers of people who never joined stay with Hearth. | LINDDUN Unawareness/Non-compliance, ASVS V8.3 |
| TS-SEC-R6 | P2 | `notify/index.ts:214` | The one unscrubbed log line: a run failure logs `e.message` with only URLs cut. A Postgres or fetch error that quotes a row could put an email (or a future phone field) in Edge Function logs. | ASVS V7.1 (no sensitive data in logs), CLAUDE.md rule 2 |
| TS-SEC-R7 | P2 | `docs/eng/SMS-PROVIDER.md:21,25`; `docs/architecture/01-system-overview.md:37,46` | Twilio facts still unrecorded: data region, DPA, retention. Search (Nov 19) found Verify marks `to` as PII with a 30-day minimum time to live and Twilio keeps deleted data in backups up to 30 more days ([Verifications](https://www.twilio.com/docs/verify/api/verification), [Data retention](https://support.twilio.com/hc/en-us/articles/4410585868443-Data-Retention-and-Deletion-in-Twilio-Products)); nothing on US-only residency. Fraud Guard is a predictive model, and Twilio's [Predictive and Generative AI/ML Features Addendum](https://www.twilio.com/en-us/legal/ai-terms/predictive-generative-ai-features) lets Twilio train the features you use on that feature's data. Phone numbers and traffic, not photos, but CLAUDE.md says "nothing is used for AI training". | Vendor review (A3, AI terms), LINDDUN Non-compliance |
| TS-SEC-R8 | P2 | `docs/architecture/04-threat-model.md:26` | The threat model says "no passwords to reuse", but password sign-up and sign-in endpoints are live (R1). A white-paper reader who tries `/signup` finds the claim false. | Surface-matches-code (A4) |
| TS-SEC-R9 | P2 (accept now, scheduled) | `04-threat-model.md:26` "Not defended" | SIM swap and number recycling: whoever holds a grandparent's old number gets her whole family. Documented as not defended. | ASVS V6 (re-authentication), STRIDE S |

### TS-SEC-R1 (P1): pre-account takeover through password sign-up
- **Failure scenario (phone):** Dad's new partner, or anyone who knows Gammy's number, calls `POST /auth/v1/signup {phone: "+1304…", password: "x"}` with the public anon key. Supabase makes an unconfirmed account with that password and texts Gammy a code she ignores. Days later Gammy signs in with "Send me a code"; verifying the text confirms **the same `auth.users` row**, and the attacker's password was never cleared. The attacker now signs in with phone and password and sees every post shared to Gammy's groups, forever (threats 1 and 3). Supabase's own docs name the pattern ([identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)); a public report describes it for email ([wichtelo #15](https://github.com/reh2ur/wichtelo/issues/15)). Whether Auth clears the password on OTP confirmation is **unverified** for phone; the test below settles it.
- **Failure scenario (email, today, if hosted matches local):** with `[auth.email] enable_confirmations = false`, `/signup {email, password}` returns a live session for any address without touching the inbox. That squats a relative's email (same takeover when she later signs in by code) and satisfies an email-bound invite's `target_email` check for anyone holding the code. Whether hosted "Confirm email" is on is **unknown**; Claude can read it (`mailer_autoconfirm` on `GET /v1/projects/{ref}/config/auth`).
- **Fix:** Hearth never uses passwords, so remove them at the database: a migration with a `before insert or update` trigger on `auth.users` that sets `encrypted_password` to `''`/null (owner `supabase_auth_admin` permitting; else a `before_user_created` hook that refuses any sign-up carrying a password). Also set `[auth.email] enable_confirmations = true` and confirm hosted "Confirm email" is on. **Failing test first:** on the local stack with `test_otp` uncommented, `signup {phone, password}` → `verifyOtp(sms)` → `signInWithPassword` must fail; same for email; plus a SQL test that the trigger blanks the hash. **Size:** S (one migration, one trigger, two tests, one config line).

### TS-SEC-R2 (P1): one stranger can lock every relative out
- **Failure scenario:** on beta weekend, anyone (a bored teen, an angry ex) loops "Send me a code" across 30 made-up US numbers in an hour. `sms_sent` is project-wide, so every real relative now gets a 429. `SupabaseApi.sendTextCode` maps 429 to `54000`, so Gammy reads "Too many tries" with no "Use email instead" (only `SMS_OFF` offers email), and on a phone-bound invite there is no other way in. It repeats every hour and also drains the $20 balance at ~$0.016 a text; when the balance is gone, texts stop with no alarm.
- **Fix:** (a) map Auth's project-wide limit (`error.code === 'over_sms_send_rate_limit'`) and any provider 429 to `SMS_OFF`, so the screen falls back to email or "ask {inviter} for an email invite" (BETA-SMS-6 words already exist); keep `54000` only for the per-number wait; (b) on Twilio, add Verify **Service Rate Limits** per phone number and per IP (bucket e.g. 3/10 min per number) ([rate limits](https://www.twilio.com/docs/verify/api/programmable-rate-limits)) so a single number can't be bombed; (c) a Twilio low-balance email alert to Chase. CAPTCHA stays deferred (spec §5). **Failing test first:** app test that a 429 with `over_sms_send_rate_limit` shows the email fallback. **Size:** S.

### TS-SEC-R3..R9 fixes (P2, after turn-on is fine)
- **R3:** `revoke select (target_email, target_phone) on public.invites from authenticated` in a new migration; SQL test that a manager's `select target_phone` errors (42501). Size XS.
- **R4:** in `redeem_invite`, `set use_count = use_count + 1, target_phone = null, target_email = null` once used up, and null them on revoke and in the existing expiry purge. SQL test. Size S.
- **R5:** daily cron: delete `auth.users` rows with `phone_confirmed_at is null and email_confirmed_at is null and created_at < now() - interval '1 day'` and no `space_members` row (profiles cascade). SQL test. Size S.
- **R6:** run the message through an email/phone scrub (or log only `e.name`, as `sign-media` does). Deno test. Size XS.
- **R7:** record region, DPA, the 30-day TTL and 30-day backup tail in `SMS-PROVIDER.md` and 01/02 with the date; ask Chase one word: keep Fraud Guard (US-only geo already blocks most pumping) or turn it off to keep "nothing used for AI training" literal. Recommendation: keep it on and word the claim as "photos and words are never used to train AI". Size S (docs).
- **R8:** after R1, the claim is true; until then, reword to "Hearth never asks for a password" and add the gap. Hand wording to `positioning`. Size XS.
- **R9:** accepted for the beta (12 known relatives, parents can remove a member). Scheduled for milestone 7: re-check the number on a new phone after 90 days idle, and a "removed by a parent" path in Help. ASVS V6.

## Hosted turn-on checklist (do all before the app flag ships)
Claude does each through the Management API or Twilio console after Chase's one step (`SMS-PROVIDER.md`), and records the date here.
1. Supabase Auth: **phone confirmations on** ("Enable phone confirmations"); phone provider `twilio_verify` with SID, token and Verify Service SID from secrets only.
2. Supabase: **`sms_sent` rate limit 30/hour or lower** (recommend 20 for 12 people); `sms_max_frequency` 60 s; `token_verifications` and `sign_in_sign_ups` left at 30 per 5 min per IP.
3. Supabase: **no `test_otp` on hosted.** Read back `config/auth` and fail the switch if the test-OTP field is non-empty (field name unverified; read it first). Never put `config.toml` through `deploy.sh`.
4. Supabase: "Confirm email" on (R1); password sign-up blocked by the R1 trigger, proven on hosted with one `signup {phone, password}` that ends unusable.
5. Twilio Verify service "Hearth": channel SMS only (no voice, WhatsApp or email); **Geo Permissions: United States only**; account-level Messaging geo permissions US only as well.
6. Twilio: **Fraud Guard on** (Standard or Maximum) after Chase's R7 answer; Service Rate Limits per number and per IP (R2b); max check attempts left at Twilio's default (5).
7. Twilio account: 2FA on the login, auto-recharge off, $20 balance, low-balance alert to Chase; auth token rotated after it is set in Supabase, and the old one never stored.
8. Twilio custom template filed (BETA-SMS-7) or Chase accepts the default.
9. Then BETA-SMS-16 on three phones, then the app flag `EXPO_PUBLIC_HEARTH_SMS=1`.

## Gate note
- **Open:** P0 0, P1 2 (R1, R2), P2 7 (R3..R9; R9 accepted).
- **Required now met:** RLS untouched and tested both ways; invite binding tested; no numbers in logs or reports (except R6's narrow case); no AI or analytics added; secrets via env only.
- **Scheduled:** R9 (milestone 7, ASVS V6); CAPTCHA on send (spec §5, revisit if R2's limits are hit); Twilio residency (A3, before "texts" goes in MARKETING).
- **Safe to switch texts on for the 12 grandparents: No**, until R1 and R2 are fixed with tests and checklist items 1 to 7 are done. Email sign-in can stay as it is today, but R1's email half should be checked on hosted now.
- **Needs Chase:** the R7 Fraud Guard / AI-training answer (one word: keep or off), and the Twilio sign-up step already in `SMS-PROVIDER.md`.

Last checked against code: 2026-11-19, branch claude/project-thread-df9051 (70d7b13).
