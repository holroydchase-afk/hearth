# No passwords in Supabase Auth (TS-SEC-R1)

Architect's call, Nov 19, 2026. Finding: `docs/reviews/2026-11-19-text-sign-in/sec.md` TS-SEC-R1 (P1).

## Pick: (a) migration `0028_no_passwords.sql`, plus "Confirm email" on
- A `before insert or update` trigger on `auth.users` that sets `new.encrypted_password := ''` on every row. Function `private.tg_no_passwords()`, `set search_path = ''`, execute revoked from `public, anon, authenticated`. Same migration: one backfill `update auth.users set encrypted_password = '' where coalesce(encrypted_password,'') <> ''`.
- Use `''`, not null: GoTrue treats an empty hash as "no password", and older GoTrue versions scan the column as a non-null string.
- Covers every path: `/signup {phone|email, password}`, `updateUser({password})`, admin create, and rows made before 0028.
- `[auth.email] enable_confirmations = true` in `config.toml`, and `deploy.sh` step 5 adds `"mailer_autoconfirm": false` to its existing `PATCH config/auth` (hosted "Confirm email" on). The trigger alone does not stop `/signup {email, password}` from returning a live session while autoconfirm is on.

## Why not (b) or (c)
- (b) `before_user_created` hook: its payload is the user object, which (as far as we know) omits the password, so it may not be able to tell a password sign-up apart. It also misses `updateUser({password})` and old rows, and needs hook config pushed through the Management API. Kept as the fallback only if hosted refuses the trigger.
- (c) config only: Supabase has no switch that turns off email passwords but keeps email codes. The email provider toggle turns off both.

## Hosted fit
- `auth.users` is owned by `supabase_auth_admin`. A trigger needs the TRIGGER privilege. Hosted already allows this: 0001's `on_auth_user_created` (after insert on `auth.users`) went live through the same `deploy.sh` Management API path. Supabase's 2025 auth-schema lockdown stops new objects *in* `auth`, so the function lives in `private`, not `auth`.
- A before trigger only edits `NEW`, so Auth's role needs no grant on the function or on `private` when it fires.
- `deploy.sh` can ship all of it: it applies migrations and already PATCHes `config/auth`. `config.toml` never reaches hosted.

## Email codes with confirmations on
Safe. A new address gets the **confirmation** email instead of the magic-link one. `deploy.sh` already pushes `confirmation.html` with the 6-digit `{{ .Token }}`, and `verifyOtp({type: 'email'})` accepts both. Existing users are unchanged. On hosted, `mailer_autoconfirm` must be `false`.

## Verified vs not
- **Verified locally** (Postgres 16, a mock of hosted ownership: `auth.users` owned by a non-superuser `supabase_auth_admin`): without TRIGGER, a non-owner gets `permission denied for table users`. With it, the trigger blanks the hash on insert-with-hash, insert-without and update, run as `supabase_auth_admin` with no execute grant or schema usage.
- **Not verified** (supabase.com is blocked and there is no Docker daemon, so no `supabase start`): whether GoTrue leaves the attacker's hash in place on OTP confirmation (the trigger makes this moot), whether hosted `postgres` may `update auth.users` for the backfill (if not, deploy fails loudly; then drop the backfill and rely on the trigger plus a check that 0 rows have a hash), the hook payload, and hosted's current `mailer_autoconfirm`.

## Tests first (qa-tdd)
1. SQL `backend/tests/auth_no_passwords_test.sql` (the stub gains `encrypted_password` and `supabase_auth_admin` ownership): TS-SEC-R1 insert with hash gives `''`; insert without gives `''`; update to a hash gives `''`; fires as `supabase_auth_admin`; `anon`/`authenticated` can't execute the function.
2. `auth_config_test.sh`: TS-SEC-R1 `[auth.email] enable_confirmations = true`; `deploy.sh` PATCH body has `"mailer_autoconfirm": false`.
3. Real stack (`run_supabase.sh`, Docker): `signup {phone,password}` → `verifyOtp(sms)` → `signInWithPassword` fails; `signup {email,password}` returns no session.

Status (qa-tdd, Nov 19): 1 and 2 written and red (`backend/tests/auth_no_passwords_test.sql`, wired into `tests/run.sh`; the stub now has `encrypted_password` and `supabase_auth_admin` owning `auth.users`). 3 is **todo, not written**: no Docker daemon here. Write and run it where `supabase start` works, before the hosted turn-on (sec.md checklist item 4).

Last checked against code: 2026-11-19, branch claude/project-thread-df9051 (migrations through 0027).
