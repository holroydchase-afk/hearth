-- 0028: no passwords in Supabase Auth (TS-SEC-R1, docs/reviews/2026-11-19-text-sign-in/sec.md;
-- design docs/eng/AUTH-NO-PASSWORDS.md). Hearth signs in only by invite link plus a texted or mailed code, but
-- Auth's /signup {phone|email, password} is open to anyone with the anon key: a stranger could plant a password on
-- Gammy's number and keep it after she confirms the same auth.users row by code.
-- * private.tg_no_passwords(): a before insert or update trigger on auth.users sets encrypted_password = '' on
--   every row ('' not null: GoTrue reads an empty hash as "no password", older versions scan it as non-null).
--   Covers /signup, updateUser({password}), admin create. It lives in private (no new objects in auth).
-- * One backfill blanks any hash already stored.
-- * Execute revoked from public, anon, authenticated; a before trigger needs no grant to fire for Auth's role.
-- Pairs with "Confirm email" on (config.toml [auth.email], deploy.sh "mailer_autoconfirm": false).
-- NO CONTENT IS USED FOR AI/ML TRAINING, ADVERTISING OR PROFILING (see 0001 header).

create or replace function private.tg_no_passwords() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.encrypted_password := '';
  return new;
end
$$;
revoke all on function private.tg_no_passwords() from public, anon, authenticated;

drop trigger if exists no_passwords on auth.users;
create trigger no_passwords before insert or update on auth.users
  for each row execute function private.tg_no_passwords();

update auth.users set encrypted_password = '' where coalesce(encrypted_password, '') <> '';
