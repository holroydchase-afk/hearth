# Spec: Text message (SMS) sign-in codes

Owner: staff-pm. Nov 10, 2026. Status: **decided** (Chase, Nov 10, go-live list item 8: build it now; DEC-57, closes TRACKER D11). **Built Nov 10 behind the flag, off** (migration 0026; BETA-SMS-1..15 green; QA-R3: the RPC is `invite_preview`, not `preview_invite`). Milestone: M4 (the grandparents). Persona check: `docs/product/decisions/2026-11-10-sms-sign-in.md`. TRACKER: R43.

Source, Chase, Oct 18 (ANCHORS ideas log): "I want texts to be the primary and default way folks receive their OTP." Email stays a fallback.

## Decision in two lines
When texts are switched on, sign-in asks for a mobile number first and sends a 6-number code by text, with **Use email instead** one tap away. It ships **off** (email only, exactly as today) until Chase has an SMS provider and US carrier registration.

## 1. The bet and the signal
- **Who has to do what:** a WV grandparent (LG, AG) gets in without finding an email, a junk folder or a password.
- **Signal:** time from "Send me a code" to signed in (BETA-SMS-16, under 60 s median on 3 real phones) and sign-in help calls in M4 (target 0; the email flow's junk-folder call is the one we are removing).
- **Stop or pivot:** if carrier registration is not approved by **Nov 18**, the beta runs on email (flag stays off) and texts move after Thanksgiving. No half-on state for relatives.

## 2. What exists (checked Nov 10)
- App: email 6-digit OTP only (`EmailCodeFlow.tsx`, `SignInScreen.tsx`, `app/join/[code].tsx`; `HearthApi.sendCode/verifyCode`; `SupabaseApi` uses `auth.signInWithOtp({ email })`). `Session` is `{ userId, email }`.
- Backend: `invite_channel` has `'sms'`; `invites.target_phone` exists; `create_invite` takes `p_target_phone`; `redeem_invite` (0024 ~line 254) compares `auth.users.phone` to `target_phone` as raw strings.
- `config.toml`: `[auth.sms]` `enable_signup = false`, template "Your code is {{ .Code }}"; `[auth.sms.twilio]` disabled. No provider chosen.
- Notices: `notify` sends email to the `auth.users` email. A phone-only account has none.
- Problem reports: `safeMessage` scrubs emails, URLs, tokens; **not phone numbers**.

## 3. Behaviour
1. **Flag.** App build flag `EXPO_PUBLIC_HEARTH_SMS=1` and server `[auth.sms] enable_signup = true` plus a provider. App flag off: the sign-in screens are today's email screens, unchanged. App flag on but the server refuses: one calm line and the email screen (no dead end).
2. **Phone first.** Flag on: "Your mobile number" is the first and only field; below the button, a secondary **Use email instead**. Email has its own **Use a text instead** back.
3. **US numbers only.** Accepts `(304) 555-0100`, `304-555-0100`, `304.555.0100`, `3045550100`, `1 304 555 0100`, `+1 304 555 0100`. Stored and sent as E.164 `+13045550100`. Refuses anything that isn't 10 digits after an optional leading 1, or whose area code or exchange starts with 0 or 1, with "Please type a US mobile number, like 304-555-0100." No country picker.
4. **Same code screen.** "We texted a 6-number code to the number ending in 0100. Type it here." Same field rules as email: digits only, paste of "123 456" or "123-456" works, `autoComplete="one-time-code"` / `textContentType="oneTimeCode"` (Android: `sms-otp`), 60 s before "Send a new code", the same wrong-code and too-many-tries words. Change number goes back one step. The full number is never shown again after step 1 (last 4 only).
5. **The text.** `Hearth code: {{ .Code }}. Never read this code to anyone, even family. Hearth will never call you for it.` Under 160 GSM-7 characters (no emoji or curly quotes), so it is one segment. Code first so the phone's autofill finds it.
6. **Accounts are separate.** A phone sign-in and an email sign-in are two accounts in this pass. Existing email accounts keep using email (Use email instead). A phone account with no family sees, on the no-family screen, "Signed in with email before? Use email instead" so a relative who switched by mistake isn't stranded in an empty account.
7. **Invites.** Flag on: the invite card asks "Their mobile number" first, with **They'll use email** (GUX-R2: it makes a link invite, so the card then says "They'll sign in with their email. Anyone you send the invite to can open it." and offers **Add their mobile number**); a number makes a `channel = 'sms'` invite with `target_phone` in E.164. Hearth still never sends the invite itself (the parent shares it as today; SMS notices stay out of scope). The join screen opens on the way the invite was made: a phone invite asks for a number, an email invite for an email, a link invite asks phone first. A phone or email invite offers no switch to the other way (GUX-R1: it could never open); if texts are down on a phone invite, the screen says "Texts aren't working right now. Ask {inviter} to send you a new invite by email." `invite_preview` gains `sign_in_with` (`'phone' | 'email' | 'either'`) and **never** returns the target.
8. **Phone-only accounts get push only.** No email notices. Preferences hides the email switch. Help says: "You sign in with a text, so Hearth tells you about new photos on this phone, not by email." If push is off too, Photos shows the existing "Turn on notices" nudge.
9. **No numbers in logs.** No phone number in app logs, problem reports, `report_client_error` rows, Edge Function logs or raised SQL messages. Analytics: none exist; none added.

## 4. Acceptance criteria
App criteria run on the Fake backend (`FakeBackend` grows `sendTextCode` / `verifyTextCode` with the same fixed test code as email). SQL criteria run in `backend/tests` (local Postgres). Contract: new methods go in `docs/eng/API.md` and `app/src/api/contract/` first; the contract suite runs them against the Fake and, once a provider exists, the integration harness with Supabase's `[auth.sms.test_otp]` so CI never sends a real text.

| ID | Type | Pri | Given / When / Then |
|---|---|---|---|
| BETA-SMS-1 | auto | P0 | **Given** the SMS flag off, **When** the signed-out screen, the join screen and the invite card render, **Then** they match today's email-only screens (no phone field, no "Use a text instead"); the existing JOIN tests pass unchanged. |
| BETA-SMS-2 | auto | P0 | **Given** the flag on, **When** sign-in renders, **Then** "Your mobile number" is the only field, "Send me a code" is the primary button, and "Use email instead" (secondary, 48 pt) switches to the email field; "Use a text instead" switches back. |
| BETA-SMS-3 | auto | P0 | **Given** each of `(304) 555-0100`, `304-555-0100`, `304.555.0100`, `3045550100`, `1 304 555 0100`, `+1 304 555 0100`, **When** sent, **Then** the API receives `+13045550100`. **Given** `555-0100`, `+44 20 7946 0000`, `(104) 555-0100`, `304-155-0100` or 12 digits, **When** sent, **Then** nothing is sent and the screen says "Please type a US mobile number, like 304-555-0100." |
| BETA-SMS-4 | auto | P0 | **Given** a code was texted, **When** the code screen renders, **Then** it names only the last 4 digits, takes a pasted "123 456" or "123-456" as 6 digits, has the one-time-code autofill hints, and disables "Send a new code" for 60 s with the countdown. |
| BETA-SMS-5 | auto | P1 | **Given** a wrong code, too many tries (`54000`) or no signal, **When** verified, **Then** the words are the email flow's words for the same case (one shared message table; test compares them). |
| BETA-SMS-6 | auto | P1 | **Given** the flag on and the server refusing texts (provider off or not set up), **When** "Send me a code" is tapped, **Then** the screen says "Texts aren't working right now. Use your email instead." and shows the email field; nothing crashes. |
| BETA-SMS-7 | auto | P0 | **Given** the SMS template in `config.toml` (and the provider template, once set), **When** a test renders it with code 123456, **Then** it starts "Hearth code: 123456", contains "Never read this code to anyone", is at most 160 characters and is all GSM-7. |
| BETA-SMS-8 | auto | P0 | **Given** an invite with `target_phone = '+13045550100'`, **When** an account whose `auth.users.phone` holds that number in the form Supabase Auth stores it (with or without the `+`) redeems it, **Then** it joins; a different number, an email-only account, or no phone gets the same "invalid or expired" error and a `rl_fail`. `create_invite` normalizes `p_target_phone` to E.164 and refuses a non-US number with a coded error (SQL, new migration). |
| BETA-SMS-9 | auto | P0 | **Given** a phone invite, an email invite and a link invite, **When** `invite_preview` is called, **Then** it returns `sign_in_with` = phone, email, either respectively and no target email or phone (SQL); **When** the join screen opens each, **Then** it asks for a number, an email, and a number first (app). |
| BETA-SMS-10 | auto | P1 | **Given** the flag on, **When** a parent fills the invite card with "304-555-0100", **Then** `createInvite` gets `channel: 'sms'` and `targetPhone: '+13045550100'`; "They'll use email" makes today's invite (GUX-R2). |
| BETA-SMS-11 | auto | P0 | **Given** an existing email account, **When** the flag turns on and she taps "Use email instead", **Then** she signs in to the same account with the same family (Fake: same `userId`). |
| BETA-SMS-12 | auto | P1 | **Given** a phone account with no family, **When** the no-family screen renders, **Then** it shows "Signed in with email before? Use email instead", which signs out and opens the email field (beside BETA-START-2's code entry, below it). |
| BETA-SMS-13 | auto | P0 | **Given** a phone-only account (no email) with notices on, **When** a post shared to it is queued, **Then** the outbox makes a push batch and no email batch (SQL), and `notify` skips email for a null address without failing the run (Deno). |
| BETA-SMS-14 | auto | P1 | **Given** a phone-only account, **When** Preferences and Help render, **Then** there is no email-notice switch and Help says "You sign in with a text, so Hearth tells you about new photos on this phone, not by email." |
| BETA-SMS-15 | auto | P0 | **Given** an error message holding `(304) 555-0100`, `304-555-0100`, `3045550100` or `+13045550100`, **When** `safeMessage` and `report_client_error` handle it, **Then** the kept text says `[phone]` (app test and SQL test); a grep of `notify` and `sign-media` log lines finds no phone field. |
| BETA-SMS-16 | manual | P0 | **Given** the flag on with the real provider, **When** Chase, one iPhone relative and one Android relative each sign in from "Send me a code", **Then** the text arrives in under 30 s on WV signal, the iPhone offers the code above the keyboard, the Android phone offers or fills it, and sign-in takes under 60 s median (Test Log, phone model and time). |
| BETA-SMS-17 | manual | P1 | **Given** a far-away parent on a call with a grandparent, **When** the parent reads the guide's sign-in step aloud, **Then** the step says "type the 6 numbers from the text yourself" and never asks the grandparent to read the code out (grandparent-ux review of the guide and Help). |

## 5. Deferred (not this pass)
- Linking a phone and an email on one account, or adding a phone to an existing email account (needs Supabase identity linking and a verify-both flow; revisit if BETA-SMS-12 shows people splitting into two accounts).
- Non-US numbers, a country picker.
- SMS or text-link notices and Hearth sending invites by text (BETA-SPEC Not now; doubles text volume and carrier review).
- Android SMS Retriever app-hash autofill (only if BETA-SMS-16 shows Android won't offer the code).
- CAPTCHA on send; WhatsApp or voice codes.

## 6. What the architect must answer (provider pick is theirs, not this spec's)
1. A provider Supabase Auth supports (or a Send SMS hook) with **US data handling** (A3) and a DPA; what it stores (number, message body, delivery logs) and for how long.
2. The US registration route (A2P 10DLC or toll-free verification), what it needs from Chase (business name, EIN or sole proprietor, sample messages, opt-in wording), its cost and how long approval takes, against the Nov 18 stop date.
3. Per-text and monthly cost for about 12 people (a few texts each a week) and the fixed fees.
4. Fraud and cost guards: per-number and per-IP send limits, US-only destination lock at the provider (toll-fraud / SMS pumping), and Supabase's `max_frequency`.
5. The form Supabase Auth stores in `auth.users.phone` (with or without `+`), confirmed on the live stack, so BETA-SMS-8 tests the real form.
6. A test path that never sends a real text in CI (`[auth.sms.test_otp]` or a fake hook).
7. The `docs/architecture/` updates: data flow (a new vendor sees phone numbers and codes), threat model (SIM swap; phone codes are weaker than email for an account takeover), and the vendor table.

## 7. Reviews needed before build
- `privacy-security`: the vendor, phone numbers as new personal data, `preview_invite.sign_in_with`, log scrubbing (BETA-SMS-15), SIM-swap note.
- `grandparent-ux`: every word in §3 (sign-in, code screen, the text itself, Help line, guide step).
- `architect`: §6. `positioning`: no "texts" claim in MARKETING until BETA-SMS-16 passes.

## 8. Provider pick (architect, Nov 10)
**Twilio Verify**, through Supabase Auth's built-in `twilio_verify` provider; full answers to §6, costs, guards and the secret names in [`docs/eng/SMS-PROVIDER.md`](../eng/SMS-PROVIDER.md).
- **Why:** expected to need no A2P 10DLC or toll-free registration from Chase (Verify uses Twilio's own senders) and no code. **Unverified live** (twilio.com wouldn't load); confirm before relying on Nov 18. Fallback: Twilio + toll-free verification.
- **Cost:** about $0.06 per sign-in code (unverified live), about $1 to $3 a month for ~12 people; $20 prepaid, auto-recharge off.
- **Chase's one step:** sign up at https://www.twilio.com/try-twilio, upgrade with $20, paste the Account SID and Auth Token into the Claude environment. Claude does the rest.
- **Spec impact:** with Verify, Twilio's template sends the text, not `config.toml`'s; the §3.5 "Never read this code" line needs a Twilio custom template (BETA-SMS-7). `auth.users.phone` form (with or without `+`) is still to be confirmed on the local stack (BETA-SMS-8).
- `config.toml`: `[auth.sms.twilio_verify]` (off, secrets via `env()`), `max_frequency = "60s"`, local-only `test_otp` guidance.
