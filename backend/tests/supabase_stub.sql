-- Local stand-in for the bits of Supabase that the migration depends on.
-- NOT deployed: hosted Supabase already provides all of this.
-- Applied before 0001_init.sql in local test runs only.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  -- Supabase Auth (GoTrue) connects as this role and owns auth.users on hosted (TS-SEC-R1).
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin noinherit; end if;
end $$;

create schema if not exists auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

grant usage on schema auth, extensions, public to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  phone text unique,
  encrypted_password varchar(255),  -- GoTrue's password hash column (TS-SEC-R1); Hearth keeps it ''
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Same semantics as Supabase: the JWT "sub" claim, surfaced by PostgREST as a GUC.
-- As on hosted: Auth's own role owns the table, not the migration runner (TS-SEC-R1, docs/eng/AUTH-NO-PASSWORDS.md).
grant usage on schema auth to supabase_auth_admin;
alter table auth.users owner to supabase_auth_admin;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )
$$;

grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
