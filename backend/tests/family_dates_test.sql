-- CAL-1..10, CAL-18, PRIV-R1..R3, PRIV-R5 (docs/product/SPEC-LIFE-CALENDAR.md, DEC-81): the life calendar, birthdays and important dates.
-- Migration 0029: public.family_dates, list_family_dates, set_my_birthday, save_family_date, delete_family_date.
-- Written FIRST (Nov 24, qa-tdd): red until 0029 lands.
-- Contract these tests fix (the spec names the RPCs; the returned columns are set here, engineer please follow):
--   list_family_dates(p_space) returns rows (id, kind, label, month, day, member_id, member_name), month then day.
--   month and day are sent as untyped literals so int or smallint parameters both resolve.
-- Seed: space A (Alex's): Alex owner; Grandma Rivera (ma), Grandpa Rivera (pa), Blair, Aunt Jo, Grandma Chen viewers.
-- Space B (Blair's): Blair owner; Grandma Chen and Alex viewers. Aunt Jo is made an adult in A below.
-- Robin is a new account in no family.
\set ON_ERROR_STOP 1
\pset footer off
\ir harness.sql

\set as_admin 'reset role; select set_config(''request.jwt.claim.sub'', '''', false);'
\set as_anon  'reset role; set role anon; select set_config(''request.jwt.claim.sub'', '''', false);'
\set as_alex  'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-00000000000a'', false);'
\set as_blair 'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''b0000000-0000-0000-0000-00000000000b'', false);'
\set as_ma    'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-0000000000a1'', false);'
\set as_pa    'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-0000000000a2'', false);'
\set as_chen  'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''b0000000-0000-0000-0000-0000000000b1'', false);'
\set as_jo    'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''c0000000-0000-0000-0000-0000000000c1'', false);'
\set as_robin 'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''d0000000-0000-0000-0000-0000000000d3'', false);'
\set sa       '''22222222-0000-0000-0000-00000000000a'''
\set sb       '''22222222-0000-0000-0000-00000000000b'''
\set alex     '''a0000000-0000-0000-0000-00000000000a'''
\set ma       '''a0000000-0000-0000-0000-0000000000a1'''
\set pa       '''a0000000-0000-0000-0000-0000000000a2'''
\set chen     '''b0000000-0000-0000-0000-0000000000b1'''
\set jo       '''c0000000-0000-0000-0000-0000000000c1'''

:as_admin
insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-0000-0000-0000000000d3', 'robin@example.com', '{"display_name":"Stranger Robin"}');
update public.space_members set role = 'adult'
 where space_id = '22222222-0000-0000-0000-00000000000a' and user_id = 'c0000000-0000-0000-0000-0000000000c1';
-- seed.sql predates 0011's container kinds: its two "Everyone" circles are kind 'group' until marked. A real family's
-- Everyone is kind 'everyone' (start_family, family-setup.sh), and PRIV-R2 reads the kind.
update public.circles set kind = 'everyone'
 where id in ('33333333-0000-0000-0000-0000000000a0', '33333333-0000-0000-0000-0000000000b0');

-- The refusal's SQLSTATE plus its message; null when nothing was raised.
create function tests.err_text(p_sql text) returns text language plpgsql as $$
declare m text; d text; h text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics m = message_text, d = pg_exception_detail, h = pg_exception_hint;
  return sqlstate || ': ' || coalesce(m, '') || ' ' || coalesce(d, '') || ' ' || coalesce(h, '');
end $$;
-- How many date rows the admin sees (no RLS) for a filter.
create function tests.n_dates(p_where text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from public.family_dates where ' || p_where into n;
  return n;
exception when others then return -1;
end $$;
-- Zero rows, or refused as not allowed (42501); anything else (missing function, an error, rows) is false.
create function tests.zero_or_denied(p_sql text) returns boolean language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') x' into n;
  return n = 0;
exception when insufficient_privilege then return true;
          when others then return false;
end $$;
grant execute on all functions in schema tests to authenticated, anon;

-- ---------- CAL-9: the shape. No year, no age, anywhere ----------
select tests.ok_sql($$select to_regclass('public.family_dates') is not null$$,
                    'CAL-9 public.family_dates exists (migration 0029)');
select tests.ok_sql($$select array_agg(column_name::text order by column_name) @> array['created_at','created_by','day','id','kind','label','member_id','month','space_id','updated_at']
                        from information_schema.columns where table_schema = 'public' and table_name = 'family_dates'$$,
                    'CAL-9 family_dates has id, space_id, kind, label, month, day, member_id, created_by, created_at, updated_at');
select tests.ok_sql($$select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'family_dates')
                        and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'family_dates'
                                         and (column_name ~* 'year' or column_name ~* '(^|_)age($|_)' or column_name ~* 'born|birth_?date|dob'))$$,
                    'CAL-9 no year, age or birth-date column');
select tests.ok_sql($$select count(*) = 4 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.proname in ('list_family_dates','set_my_birthday','save_family_date','delete_family_date')$$,
                    'CAL-9 the four calendar RPCs exist, one of each');
select tests.ok_sql($$select count(*) = 4 and bool_and(not exists (select 1 from unnest(coalesce(p.proargnames, '{}')) a where a ~* 'year|(^|_)age($|_)'))
                        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.proname in ('list_family_dates','set_my_birthday','save_family_date','delete_family_date')$$,
                    'CAL-9 no calendar RPC takes or returns a year or an age (argument and output names)');
select tests.ok_sql($$select count(*) = 4 and bool_and(p.prosecdef) and bool_and(p.proconfig @> array['search_path=""'])
                        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.proname in ('list_family_dates','set_my_birthday','save_family_date','delete_family_date')$$,
                    'CAL-9 every calendar RPC is security definer with search_path = ''''');
select tests.ok_sql($$select relrowsecurity from pg_class where oid = 'public.family_dates'::regclass$$,
                    'CAL-2 RLS is on for family_dates');
select tests.ok_sql($$select not has_table_privilege('authenticated', 'public.family_dates', 'insert')
                        and not has_table_privilege('authenticated', 'public.family_dates', 'update')
                        and not has_table_privilege('authenticated', 'public.family_dates', 'delete')
                        and not has_table_privilege('anon', 'public.family_dates', 'insert')$$,
                    'CAL-5 no direct writes: only the RPCs change dates');
select tests.ok_sql($$select count(*) = 4 and bool_and(has_function_privilege('authenticated', p.oid, 'execute'))
                        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.proname in ('list_family_dates','set_my_birthday','save_family_date','delete_family_date')$$,
                    'CAL-11 signed-in accounts can call all four RPCs');

-- ---------- CAL-3: any member saves their own birthday, once ----------
:as_ma
select tests.lives($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000a', '12', '8')$$,
                   'CAL-3 Grandma (a viewer) saves her birthday, December 8');
:as_admin
select tests.ok(tests.n_dates(format('space_id = %L and member_id = %L and kind = ''birthday'' and month = 12 and day = 8', :sa, :ma)) = 1,
                'CAL-3 one birthday row, linked to Grandma, in family A');
:as_ma
select tests.lives($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000a', '12', '9')$$,
                   'CAL-3 she changes it to December 9');
:as_admin
select tests.ok(tests.n_dates(format('space_id = %L and member_id = %L and kind = ''birthday''', :sa, :ma)) = 1
                and tests.n_dates(format('space_id = %L and member_id = %L and day = 9', :sa, :ma)) = 1,
                'CAL-3 a second call changes the row, never adds a second');
:as_ma
select tests.lives($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000a', null, null)$$,
                   'CAL-3 null and null clears it');
:as_admin
select tests.ok(tests.n_dates(format('space_id = %L and member_id = %L', :sa, :ma)) = 0,
                'CAL-3 ...and her birthday is gone');
:as_ma
select tests.try($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000a', '12', '8')$$);

-- ---------- CAL-4: real dates only ----------
:as_ma
select tests.throws_code($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000a', '2', '30')$$,  'CAL-4 February 30 is refused (22023)', '22023');
select tests.throws_code($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000a', '4', '31')$$,  'CAL-4 April 31 is refused (22023)', '22023');
select tests.throws_code($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000a', '13', '1')$$,  'CAL-4 month 13 is refused (22023)', '22023');
select tests.throws_code($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000a', '1', '0')$$,   'CAL-4 day 0 is refused (22023)', '22023');
select tests.throws_code($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000a', '0', '5')$$,   'CAL-4 month 0 is refused (22023)', '22023');
select tests.throws_code($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000a', '1', '32')$$,  'CAL-4 January 32 is refused (22023)', '22023');
:as_admin
select tests.ok(tests.n_dates(format('space_id = %L and member_id = %L and month = 12 and day = 8', :sa, :ma)) = 1,
                'CAL-4 a refused change leaves her December 8 as it was');
:as_alex
select tests.throws_code($$select public.save_family_date('22222222-0000-0000-0000-00000000000a', null, 'birthday', 'Leo', '2', '30', null)$$,
                         'CAL-4 a parent adding February 30 is refused too (22023)', '22023');
:as_admin
select tests.ok(tests.n_dates(format('space_id = %L and label = %L', :sa, 'Leo')) = 0, 'CAL-4 ...and nothing is stored');
:as_pa
select tests.lives($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000a', '2', '29')$$,
                   'CAL-4 February 29 is accepted');
:as_admin
select tests.ok(tests.n_dates(format('space_id = %L and member_id = %L and month = 2 and day = 29', :sa, :pa)) = 1,
                'CAL-4 ...and stored as February 29');

-- ---------- CAL-6: parents add, change and delete any date ----------
:as_alex
select tests.setv('mia', $$select public.save_family_date('22222222-0000-0000-0000-00000000000a', null, 'birthday', '  Mia  ', '3', '14', null)::text$$);
select tests.ok(tests.v('mia') is not null, 'CAL-6 the owner adds a kid''s birthday with a label and gets its id back');
select tests.setv('anniv', $$select public.save_family_date('22222222-0000-0000-0000-00000000000a', null, 'anniversary', 'Chase and Alex', '6', '20', null)::text$$);
select tests.ok(tests.v('anniv') is not null, 'CAL-6 the owner adds an anniversary');
:as_jo
select tests.setv('reunion', $$select public.save_family_date('22222222-0000-0000-0000-00000000000a', null, 'other', 'Family reunion', '7', '4', null)::text$$);
select tests.ok(tests.v('reunion') is not null, 'CAL-6 an adult adds "something else"');
:as_admin
select tests.ok(tests.n_dates(format('id::text = %L and label = ''Mia'' and kind = ''birthday'' and month = 3 and day = 14 and member_id is null and created_by = %L', tests.v('mia'), :alex)) = 1,
                'CAL-6 the label is stored trimmed, with who added it');
:as_alex
select tests.lives(format($$select public.save_family_date(%L, %L, 'birthday', 'Mia', '3', '15', null)$$, :sa, tests.v('mia')),
                   'CAL-6 the owner changes Mia''s birthday to March 15');
:as_admin
select tests.ok(tests.n_dates(format('id::text = %L and day = 15', tests.v('mia'))) = 1
                and tests.n_dates(format('space_id = %L and label = ''Mia''', :sa)) = 1,
                'CAL-6 ...the same row changed; no second Mia');
:as_alex
select tests.lives(format($$select public.delete_family_date(%L)$$, tests.v('anniv')), 'CAL-6 the owner deletes the anniversary');
:as_admin
select tests.ok(tests.n_dates(format('id::text = %L', tests.v('anniv'))) = 0, 'CAL-6 ...and it is gone');
:as_alex
select tests.setv('anniv', $$select public.save_family_date('22222222-0000-0000-0000-00000000000a', null, 'anniversary', 'Chase and Alex', '6', '20', null)::text$$);
-- a member's birthday, entered by a parent from far away (the spec's pivot)
select tests.setv('chen_bd', format($$select public.save_family_date(%L, null, 'birthday', null, '9', '1', %L)::text$$, :sa, :chen));
select tests.ok(tests.v('chen_bd') is not null, 'CAL-6 a parent enters Grandma Chen''s birthday for her (no label: it is hers)');
select tests.try(format($$select public.save_family_date(%L, null, 'birthday', null, '9', '2', %L)$$, :sa, :chen));
:as_admin
select tests.ok(tests.n_dates(format('space_id = %L and member_id = %L and kind = ''birthday''', :sa, :chen)) = 1,
                'CAL-6 one birthday per member per family: a second one for Grandma Chen never makes two rows');
:as_alex
select tests.throws_code(format($$select public.save_family_date(%L, null, 'other', %L, '1', '1', null)$$, :sa, repeat('x', 61)),
                         'CAL-6 a label over 60 characters is refused (22023)', '22023');
select tests.lives(format($$select public.save_family_date(%L, null, 'other', %L, '1', '2', null)$$, :sa, repeat('y', 60)),
                   'CAL-6 a label of exactly 60 characters is fine');
select tests.throws_code($$select public.save_family_date('22222222-0000-0000-0000-00000000000a', null, 'other', '   ', '1', '3', null)$$,
                         'CAL-6 a blank label with no member is refused (22023)', '22023');
select tests.throws_code($$select public.save_family_date('22222222-0000-0000-0000-00000000000a', null, 'anniversary', null, '1', '3', null)$$,
                         'CAL-6 no label and no member is refused (22023)', '22023');
:as_admin
select tests.ok(tests.n_dates(format('space_id = %L and month = 1 and day in (1, 3)', :sa)) = 0, 'CAL-6 ...and nothing refused was stored');

-- Blair's family B gets a date of its own (for CAL-1's "no other family").
:as_blair
select tests.setv('b_only', $$select public.save_family_date('22222222-0000-0000-0000-00000000000b', null, 'other', 'Moms side picnic', '5', '5', null)::text$$);
:as_chen
select tests.try($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000b', '9', '1')$$);

-- ---------- CAL-1: members see every date in their family, in calendar order, and nothing else ----------
:as_ma
select tests.ok_sql($$select count(*) >= 6 from public.list_family_dates('22222222-0000-0000-0000-00000000000a')$$,
                    'CAL-1 a viewer lists every date in family A');
select tests.ok_sql($$select array_agg(month * 100 + day order by ord) = array_agg(month * 100 + day order by month, day)
                        from public.list_family_dates('22222222-0000-0000-0000-00000000000a') with ordinality as t(id, kind, label, month, day, member_id, member_name, ord)$$,
                    'CAL-1 sorted by month, then day');
select tests.ok_sql($$select not exists (select 1 from public.list_family_dates('22222222-0000-0000-0000-00000000000a') where label = 'Moms side picnic')$$,
                    'CAL-1 nothing from family B comes back');
select tests.ok_sql(format($$select count(*) = 1 from public.list_family_dates(%L) where member_id = %L$$, :sa, :chen),
                    'CAL-1 Grandma Chen''s birthday shows once in A (her B one stays in B)');
select tests.ok_sql($$select count(*) = 0 from public.family_dates where space_id = '22222222-0000-0000-0000-00000000000b'$$,
                    'CAL-2 RLS: Grandma Rivera (not in B) reads no B rows from the table either');
:as_chen
select tests.ok_sql($$select exists (select 1 from public.list_family_dates('22222222-0000-0000-0000-00000000000b') where label = 'Moms side picnic')$$,
                    'CAL-1 a member of B sees B''s date');

-- ---------- CAL-2: outsiders get nothing, and a date id from F is "not found" ----------
:as_robin
select tests.ok_sql($$select count(*) = 0 from public.list_family_dates('22222222-0000-0000-0000-00000000000a')$$,
                    'CAL-2 someone in no family lists A''s dates and gets zero rows');
select tests.ok_sql($$select count(*) = 0 from public.family_dates$$, 'CAL-2 ...and reads no rows from the table');
select tests.throws_code(format($$select public.delete_family_date(%L)$$, tests.v('mia')),
                         'CAL-2 deleting a date in A from outside is not found (P0002)', 'P0002');
select tests.throws_code(format($$select public.save_family_date(%L, %L, 'birthday', 'Hacked', '1', '1', null)$$, :sa, tests.v('mia')),
                         'CAL-2 changing a date in A from outside is not found (P0002)', 'P0002');
select tests.throws_code($$select public.delete_family_date(gen_random_uuid())$$,
                         'CAL-2 an unknown id is not found the same way (P0002)', 'P0002');
select tests.throws_code($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000a', '1', '1')$$,
                         'CAL-2 someone outside can''t put a birthday in A (P0002)', 'P0002');
:as_pa
select tests.ok_sql($$select count(*) = 0 from public.list_family_dates('22222222-0000-0000-0000-00000000000b')$$,
                    'CAL-2 Grandpa Rivera (in A, not in B) lists B and gets zero rows');
select tests.throws_code(format($$select public.delete_family_date(%L)$$, tests.v('b_only')),
                         'CAL-2 ...and B''s date id is not found to him (P0002)', 'P0002');
:as_anon
select tests.ok(tests.zero_or_denied($$select * from public.list_family_dates('22222222-0000-0000-0000-00000000000a')$$),
                'CAL-2 signed out: zero rows (or not callable at all)');
:as_admin
select tests.ok(tests.n_dates(format('id::text = %L and label = ''Mia''', tests.v('mia'))) = 1, 'CAL-2 Mia''s birthday is untouched');

-- ---------- CAL-5: viewers can only touch their own birthday ----------
:as_ma
select tests.throws_code($$select public.save_family_date('22222222-0000-0000-0000-00000000000a', null, 'birthday', 'Leo', '8', '8', null)$$,
                         'CAL-5 a viewer adding a date is not found (P0002)', 'P0002');
select tests.throws_code(format($$select public.save_family_date(%L, %L, 'birthday', 'Mia', '1', '1', null)$$, :sa, tests.v('mia')),
                         'CAL-5 a viewer changing Mia''s birthday is not found (P0002)', 'P0002');
select tests.throws_code(format($$select public.delete_family_date(%L)$$, tests.v('mia')),
                         'CAL-5 a viewer deleting Mia''s birthday is not found (P0002)', 'P0002');
select tests.throws_code(format($$select public.delete_family_date(%L)$$, tests.v('chen_bd')),
                         'CAL-5 a viewer deleting another member''s birthday is not found (P0002)', 'P0002');
select tests.throws_code($$insert into public.family_dates (space_id, kind, label, month, day, created_by)
                           values ('22222222-0000-0000-0000-00000000000a', 'other', 'Sneaky', 1, 1, 'a0000000-0000-0000-0000-0000000000a1')$$,
                         'CAL-5 a direct insert is refused (42501)', '42501');
:as_admin
select tests.ok(tests.n_dates(format('space_id = %L and label in (''Leo'', ''Sneaky'')', :sa)) = 0
                and tests.n_dates(format('id::text = %L and month = 3 and day = 15', tests.v('mia'))) = 1
                and tests.n_dates(format('id::text = %L', tests.v('chen_bd'))) = 1,
                'CAL-5 ...and nothing changed');
:as_ma
select tests.setv('ma_bd', format($$select id::text from public.list_family_dates(%L) where member_id = %L$$, :sa, :ma));
select tests.lives(format($$select public.delete_family_date(%L)$$, tests.v('ma_bd')), 'CAL-5 a viewer may delete her own birthday');
:as_admin
select tests.ok(tests.n_dates(format('space_id = %L and member_id = %L', :sa, :ma)) = 0, 'CAL-5 ...and it is gone');

-- ---------- CAL-7: a member's birthday follows their name ----------
:as_pa
select tests.lives($$select public.set_my_name('Pawpaw')$$, 'CAL-7 Grandpa Rivera renames himself Pawpaw');
:as_ma
select tests.ok_sql(format($$select member_name = 'Pawpaw' from public.list_family_dates(%L) where member_id = %L$$, :sa, :pa),
                    'CAL-7 his birthday now shows the name Pawpaw to everyone');

-- ---------- CAL-8: leaving the family takes your birthday with you ----------
:as_admin
delete from public.space_members where space_id = '22222222-0000-0000-0000-00000000000a' and user_id = 'b0000000-0000-0000-0000-0000000000b1';
:as_alex
select tests.ok_sql(format($$select not exists (select 1 from public.list_family_dates(%L) where member_id = %L)$$, :sa, :chen),
                    'CAL-8 Grandma Chen leaves A: her birthday is gone from A''s list');
:as_admin
select tests.ok(tests.n_dates(format('space_id = %L and member_id = %L', :sa, :chen)) = 0, 'CAL-8 ...and from the table');
select tests.ok(tests.n_dates(format('space_id = %L and member_id = %L', :sb, :chen)) = 1, 'CAL-8 ...her birthday in B stays');

-- ---------- CAL-18: labels never reach a log, an error or a notice ----------
:as_alex
select tests.ok_sql($$select position('SECRETLABEL' in coalesce(tests.err_text(
                        format('select public.save_family_date(%L, null, ''other'', %L, ''1'', ''1'', null)',
                               '22222222-0000-0000-0000-00000000000a', 'SECRETLABEL' || repeat('z', 60))), 'none raised')) = 0
                        and tests.err_text(format('select public.save_family_date(%L, null, ''other'', %L, ''1'', ''1'', null)',
                               '22222222-0000-0000-0000-00000000000a', 'SECRETLABEL' || repeat('z', 60))) like '22023:%'$$,
                    'CAL-18 a refused label is not repeated in the error');
:as_admin
select tests.ok_sql($$select count(*) = 4 and bool_and(p.prosrc !~* 'raise\s+(log|notice|info|warning|debug)')
                        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.proname in ('list_family_dates','set_my_birthday','save_family_date','delete_family_date')$$,
                    'CAL-18 the calendar RPCs log nothing (no raise log/notice/info/warning)');
select tests.ok_sql($$select to_regclass('public.family_dates') is not null
                        and not exists (select 1 from public.notification_outbox o where o::text ~ 'Mia|Chase and Alex|Family reunion')$$,
                    'CAL-18 no notice in the outbox carries a date''s label');

-- ---------- Review fixes (Nov 24, privacy-security PRIV-R1..R3, R5). Written FIRST (qa-tdd): red until the fix ----------
-- Seed for PRIV-R2: Alex's new partner, Partner Sky, joins A as a viewer in A's Everyone group only. Blair (the co-parent
-- from the other household) is a viewer in A through the Co-parent group only (seed.sql; docs/architecture/05 S11),
-- so she can't see Partner Sky's profile (public.can_see_profile) and is not in A's Everyone group.
\set as_sky   'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''e0000000-0000-0000-0000-0000000000e1'', false);'
\set sky      '''e0000000-0000-0000-0000-0000000000e1'''
:as_admin
insert into auth.users (id, email, raw_user_meta_data) values
  ('e0000000-0000-0000-0000-0000000000e1', 'sky@example.com', '{"display_name":"Partner Sky"}');
insert into public.space_members (space_id, user_id, role, invited_by) values
  ('22222222-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000e1', 'viewer', 'a0000000-0000-0000-0000-00000000000a');
insert into public.circle_members (circle_id, user_id) values
  ('33333333-0000-0000-0000-0000000000a0', 'e0000000-0000-0000-0000-0000000000e1');
:as_sky
select tests.try($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000a', '4', '12')$$);
:as_alex
select tests.try($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000a', '5', '5')$$);
:as_blair
select tests.try($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000a', '8', '18')$$);
:as_admin
select tests.setv('sky_bd', format($$select id::text from public.family_dates where space_id = %L and member_id = %L$$, :sa, :sky));
select tests.ok(tests.v('sky_bd') is not null and tests.v('anniv') is not null and tests.v('reunion') is not null,
                'PRIV-R2 setup: Partner Sky''s birthday, the anniversary and the reunion are in family A');

-- PRIV-R1 (P1): members never read who added a date or when (created_at, updated_at, created_by).
select tests.ok_sql($$select not has_column_privilege('authenticated', 'public.family_dates', 'created_at', 'select')
                        and not has_column_privilege('authenticated', 'public.family_dates', 'updated_at', 'select')
                        and not has_column_privilege('authenticated', 'public.family_dates', 'created_by', 'select')$$,
                    'PRIV-R1 signed-in accounts have no select on family_dates.created_at, updated_at or created_by');
select tests.ok_sql($$select not has_column_privilege('anon', 'public.family_dates', 'created_at', 'select')
                        and not has_column_privilege('anon', 'public.family_dates', 'created_by', 'select')$$,
                    'PRIV-R1 ...nor does anon');
select tests.ok_sql($$select p.prosrc !~* 'created_at|updated_at|created_by'
                        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.proname = 'list_family_dates'$$,
                    'PRIV-R1 list_family_dates no longer orders (or ties) by created_at, nor reads updated_at or created_by');
:as_ma
select tests.throws_code($$select created_at from public.family_dates$$, 'PRIV-R1 a member selecting created_at is refused (42501)', '42501');
select tests.throws_code($$select updated_at from public.family_dates$$, 'PRIV-R1 a member selecting updated_at is refused (42501)', '42501');
select tests.throws_code($$select created_by from public.family_dates$$, 'PRIV-R1 a member selecting created_by is refused (42501)', '42501');
select tests.ok_sql($$select count(*) > 0 from (select id, space_id, kind, label, month, day, member_id from public.family_dates) x$$,
                    'PRIV-R1 ...while the date columns themselves still read (allowed direction)');

-- PRIV-R2 (P1): a member's birthday only to people who can see that member; a date with no member only to the
-- parents and the members of the family's Everyone group. Table (RLS) and list_family_dates alike.
:as_blair
select tests.ok_sql(format($$select not exists (select 1 from public.list_family_dates(%L) where member_id = %L or id::text = %L)$$, :sa, :sky, tests.v('sky_bd')),
                    'PRIV-R2 the co-parent (viewer in A, not in its Everyone group) does not list the new partner''s birthday');
select tests.ok_sql(format($$select not exists (select 1 from public.list_family_dates(%L) where id::text in (%L, %L) or label in ('Chase and Alex', 'Family reunion'))$$,
                           :sa, tests.v('anniv'), tests.v('reunion')),
                    'PRIV-R2 ...nor the anniversary or the "something else" date, not even their labels');
select tests.ok_sql(format($$select count(*) = 0 from public.family_dates where member_id = %L or id::text in (%L, %L) or label in ('Chase and Alex', 'Family reunion')$$,
                           :sky, tests.v('anniv'), tests.v('reunion')),
                    'PRIV-R2 RLS: the co-parent reads none of those rows from the table directly');
select tests.ok_sql(format($$select exists (select 1 from public.list_family_dates(%L) where member_id = %L)
                              and exists (select 1 from public.list_family_dates(%L) where member_id = %L)$$, :sa, :alex, :sa, 'b0000000-0000-0000-0000-00000000000b'),
                    'PRIV-R2 allowed: the co-parent still sees Alex''s birthday (a parent she can see) and her own');
select tests.throws_code(format($$select public.delete_family_date(%L)$$, tests.v('sky_bd')),
                         'PRIV-R2 the co-parent deleting the partner''s birthday is not found (P0002)', 'P0002');
select tests.throws_code(format($$select public.delete_family_date(%L)$$, tests.v('anniv')),
                         'PRIV-R2 the co-parent deleting the anniversary is not found (P0002)', 'P0002');
select tests.throws_code(format($$select public.save_family_date(%L, %L, 'anniversary', 'Changed', '1', '1', null)$$, :sa, tests.v('anniv')),
                         'PRIV-R2 the co-parent changing the anniversary is not found (P0002)', 'P0002');
:as_ma
select tests.ok_sql(format($$select exists (select 1 from public.list_family_dates(%L) where member_id = %L)
                              and exists (select 1 from public.list_family_dates(%L) where id::text = %L)
                              and exists (select 1 from public.list_family_dates(%L) where id::text = %L)$$,
                           :sa, :sky, :sa, tests.v('anniv'), :sa, tests.v('reunion')),
                    'PRIV-R2 allowed: Grandma Rivera (in A''s Everyone group) lists the partner''s birthday, the anniversary and the reunion');
select tests.ok_sql(format($$select count(*) = 3 from public.family_dates where member_id = %L or id::text in (%L, %L)$$, :sky, tests.v('anniv'), tests.v('reunion')),
                    'PRIV-R2 allowed: ...and reads them from the table');
:as_alex
select tests.ok_sql(format($$select count(*) = 3 from public.list_family_dates(%L) where member_id = %L or id::text in (%L, %L)$$, :sa, :sky, tests.v('anniv'), tests.v('reunion')),
                    'PRIV-R2 allowed: the owner lists all three');

-- PRIV-R3 (P2): export_my_data carries your own birthday and the dates you added, and nobody else's.
:as_pa
select tests.ok_sql($$select coalesce(public.export_my_data()->'family_dates', '[]') @> '[{"month": 2, "day": 29}]'$$,
                    'PRIV-R3 Grandpa''s export holds his own birthday (February 29) under family_dates');
:as_alex
select tests.ok_sql($$select coalesce(public.export_my_data()->'family_dates', '[]') @> '[{"label": "Mia"}]'
                         and coalesce(public.export_my_data()->'family_dates', '[]') @> '[{"label": "Chase and Alex"}]'$$,
                    'PRIV-R3 Alex''s export holds the dates he added (Mia, the anniversary)');
:as_ma
select tests.ok_sql($$select jsonb_typeof(public.export_my_data()->'family_dates') = 'array'
                         and not (public.export_my_data()->'family_dates' @> '[{"label": "Mia"}]')
                         and not (public.export_my_data()->'family_dates' @> '[{"month": 4, "day": 12}]')$$,
                    'PRIV-R3 ...and Grandma Rivera''s export has none of the dates others added or others'' birthdays');

-- PRIV-R5 (P2): the 200 cap holds under concurrent adds: the RPCs lock the family's spaces row before counting.
-- A real second session (dblink) tries to add while this session holds FOR NO KEY UPDATE on A's spaces row. That
-- lock does not block the foreign-key check (FOR KEY SHARE), so only an RPC that locks the row itself waits; with
-- lock_timeout it then fails 55P03. Returns 'waited' or what happened instead.
:as_admin
create extension if not exists dblink with schema tests;
create function tests.second_session(p_user uuid, p_sql text) returns text language plpgsql as $$
declare r text;
begin
  -- the server connects to itself: as this user, else as postgres (peer auth sees the server's own OS user)
  begin
    perform tests.dblink_connect('probe', format('dbname=%s user=%s', current_database(), current_user));
  exception when others then
    perform tests.dblink_connect('probe', format('dbname=%s user=postgres', current_database()));
  end;
  begin
    perform tests.dblink_exec('probe', 'set lock_timeout = ''1s''');
    perform tests.dblink_exec('probe', 'set role authenticated');
    perform * from tests.dblink('probe', format('select set_config(''request.jwt.claim.sub'', %L, false)', p_user)) as t(x text);
    perform * from tests.dblink('probe', 'select (' || p_sql || ')::text') as t(x text);
    r := 'did not wait for the spaces row';
  exception when others then
    r := case when sqlstate = '55P03' or sqlerrm ~* 'lock timeout' then 'waited' else 'error ' || sqlstate || ': ' || sqlerrm end;
  end;
  perform tests.dblink_disconnect('probe');
  return r;
exception when others then
  return 'probe failed: ' || sqlerrm;
end $$;
begin;
select 1 from public.spaces where id = '22222222-0000-0000-0000-00000000000a' for no key update;
select tests.setv('lock_save', $$select tests.second_session('a0000000-0000-0000-0000-00000000000a',
  'public.save_family_date(''22222222-0000-0000-0000-00000000000a'', null, ''other'', ''Lock probe'', 3, 3, null)')$$);
select tests.setv('lock_mine', $$select tests.second_session('c0000000-0000-0000-0000-0000000000c1',
  'public.set_my_birthday(''22222222-0000-0000-0000-00000000000a'', 3, 4)')$$);
commit;
select tests.ok(tests.v('lock_save') = 'waited', 'PRIV-R5 save_family_date waits on the family''s spaces row lock before adding (got: ' || coalesce(tests.v('lock_save'), 'null') || ')');
select tests.ok(tests.v('lock_mine') = 'waited', 'PRIV-R5 set_my_birthday waits on it too before adding (got: ' || coalesce(tests.v('lock_mine'), 'null') || ')');
-- whatever the probes managed to store goes, so CAL-10 below counts from the same place
delete from public.family_dates where space_id = '22222222-0000-0000-0000-00000000000a'
   and (label = 'Lock probe' or member_id = 'c0000000-0000-0000-0000-0000000000c1');

-- ---------- CAL-10: 200 dates per family ----------
:as_admin
select tests.try(format($$insert into public.family_dates (space_id, kind, label, month, day, created_by)
                          select %L, 'other', 'Filler ' || g, 1 + (g %% 12), 1 + (g %% 28), %L
                            from generate_series(1, 200 - (select count(*) from public.family_dates where space_id = %L)) g$$, :sa, :alex, :sa));
select tests.ok(tests.n_dates(format('space_id = %L', :sa)) = 200, 'CAL-10 setup: family A holds 200 dates');
:as_alex
select tests.throws_code($$select public.save_family_date('22222222-0000-0000-0000-00000000000a', null, 'other', 'One too many', '10', '10', null)$$,
                         'CAL-10 the 201st date is refused (P0001)', 'P0001');
select tests.ok_sql($$select e ~ '^P0001: \S' and e !~* 'violat|constraint|relation|null value|exception|family_dates|does not exist'
                        from tests.err_text(format('select public.save_family_date(%L, null, ''other'', ''One too many'', ''10'', ''10'', null)',
                                                   '22222222-0000-0000-0000-00000000000a')) e$$,
                    'CAL-10 ...with a plain message (no database words)');
:as_ma
select tests.throws_code($$select public.set_my_birthday('22222222-0000-0000-0000-00000000000a', '10', '11')$$,
                         'CAL-10 a member''s own birthday is refused too when the family is full (P0001)', 'P0001');
:as_admin
select tests.ok(tests.n_dates(format('space_id = %L', :sa)) = 200, 'CAL-10 ...and nothing was stored');

-- ---------- report ----------
\o
\pset format aligned
select n, case when ok then 'ok' else 'NOT OK' end as result, description from tests.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tests.results \gset
\echo
\echo FAMILY DATES RESULT: :passed passed, :failed failed
select :failed = 0 as all_ok \gset
\if :all_ok
\else
  \echo SOME TESTS FAILED
  select 1/0 as force_nonzero_exit;
\endif
