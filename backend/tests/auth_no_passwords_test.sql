-- TS-SEC-R1 (docs/reviews/2026-11-19-text-sign-in/sec.md, P1): no passwords in Supabase Auth.
-- Hearth never uses passwords, but /auth/v1/signup {phone|email, password} is open to anyone with the anon key, so a
-- stranger could plant a password on Gammy's number and keep it after she confirms the same row by text code.
-- Design (architect, docs/eng/AUTH-NO-PASSWORDS.md): migration 0028_no_passwords adds a before insert or update
-- trigger on auth.users, private.tg_no_passwords(), that sets encrypted_password = '' on every row.
-- Not covered here (needs Docker and `supabase start`, see the doc's "Tests first" item 3): the real-stack
-- signup {phone,password} -> verifyOtp(sms) -> signInWithPassword fails, and signup {email,password} returns no session.
\set ON_ERROR_STOP 1
\pset footer off
\ir harness.sql

-- Auth's own role does the writes on hosted; let it record results.
grant usage on schema tests to supabase_auth_admin;
grant select, insert, update on tests.results, tests.vars to supabase_auth_admin;
grant usage on sequence tests.results_n_seq to supabase_auth_admin;
grant execute on all functions in schema tests to supabase_auth_admin;

-- ---------- the trigger exists ----------
select tests.ok_sql($$select exists (
    select 1 from pg_trigger t
    where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
      and t.tgfoid = 'private.tg_no_passwords()'::regprocedure
      and (t.tgtype & 2) <> 0          -- before
      and (t.tgtype & 4) <> 0          -- insert
      and (t.tgtype & 16) <> 0)$$,     -- update
  'TS-SEC-R1 a before insert or update trigger on auth.users runs private.tg_no_passwords() (migration 0028)');

-- ---------- as the migration runner (superuser) ----------
insert into auth.users (id, phone, encrypted_password)
  values ('5ec00000-0000-0000-0000-000000000001', '+13045550901', '$2a$10$attackerhashattackerhashattackerhashattackerhashat');
select tests.ok_sql($$select encrypted_password = '' from auth.users where id = '5ec00000-0000-0000-0000-000000000001'$$,
  'TS-SEC-R1 insert with a password hash leaves encrypted_password = ''''');

insert into auth.users (id, phone) values ('5ec00000-0000-0000-0000-000000000002', '+13045550902');
select tests.ok_sql($$select encrypted_password = '' from auth.users where id = '5ec00000-0000-0000-0000-000000000002'$$,
  'TS-SEC-R1 insert without a hash also leaves encrypted_password = ''''');

update auth.users set encrypted_password = '$2a$10$laterhashlaterhashlaterhashlaterhashlaterhashlater'
  where id = '5ec00000-0000-0000-0000-000000000002';
select tests.ok_sql($$select encrypted_password = '' from auth.users where id = '5ec00000-0000-0000-0000-000000000002'$$,
  'TS-SEC-R1 an UPDATE setting a hash (updateUser({password})) leaves encrypted_password = ''''');

-- ---------- as supabase_auth_admin (how GoTrue writes on hosted; it owns auth.users) ----------
set role supabase_auth_admin;
select tests.lives($$insert into auth.users (id, email, encrypted_password)
    values ('5ec00000-0000-0000-0000-000000000003', 'squat@example.com', '$2a$10$emailhashemailhashemailhashemailhashemailhashemai')$$,
  'TS-SEC-R1 supabase_auth_admin can still insert a user (no grant on the trigger function needed)');
select tests.lives($$insert into auth.users (id, phone) values ('5ec00000-0000-0000-0000-000000000004', '+13045550904')$$,
  'TS-SEC-R1 supabase_auth_admin can insert a user without a hash');
select tests.lives($$update auth.users set encrypted_password = '$2a$10$adminhashadminhashadminhashadminhashadminhashadmin'
    where id = '5ec00000-0000-0000-0000-000000000004'$$,
  'TS-SEC-R1 supabase_auth_admin can run the update');
reset role;
select tests.ok_sql($$select encrypted_password = '' from auth.users where id = '5ec00000-0000-0000-0000-000000000003'$$,
  'TS-SEC-R1 as supabase_auth_admin, insert with a hash leaves encrypted_password = ''''');
select tests.ok_sql($$select encrypted_password = '' from auth.users where id = '5ec00000-0000-0000-0000-000000000004'$$,
  'TS-SEC-R1 as supabase_auth_admin, an UPDATE setting a hash leaves encrypted_password = ''''');

-- ---------- nobody else can call the function ----------
select tests.ok_sql($$select not has_function_privilege('anon', 'private.tg_no_passwords()', 'execute')$$,
  'TS-SEC-R1 anon cannot EXECUTE private.tg_no_passwords()');
select tests.ok_sql($$select not has_function_privilege('authenticated', 'private.tg_no_passwords()', 'execute')$$,
  'TS-SEC-R1 authenticated cannot EXECUTE private.tg_no_passwords()');

-- ---------- no hash anywhere ----------
select tests.ok_sql($$select not exists (select 1 from auth.users where coalesce(encrypted_password, '') <> '')$$,
  'TS-SEC-R1 no auth.users row (seed included) keeps a password hash');

-- ---------- report ----------
\o
\pset format aligned
select n, case when ok then 'ok' else 'NOT OK' end as result, description from tests.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tests.results \gset
\echo
\echo AUTH NO PASSWORDS RESULT: :passed passed, :failed failed
select :failed = 0 as all_ok \gset
\if :all_ok
\else
  \echo SOME TESTS FAILED
  select 1/0 as force_nonzero_exit;
\endif
