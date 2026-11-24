-- START-ON-3, START-ON-4 (SPEC-START-FAMILY section 8, PRIV-R7): the SQL that Chase's service-role scripts run.
--   backend/scripts/suspend-family.sql       psql variables: space_id (uuid), action (suspend | undo | known), apply (yes | no)
--   backend/scripts/start-family-switch.sql  psql variables: mode (on | off | status), apply (yes | no)
-- The .sh wrappers (suspend-family.sh, start-family-switch.sh) send the same SQL through the Management API like
-- family-setup.sh; tests/start_on_scripts_test.sh checks them (dry-run default, arguments, output). This suite checks
-- what the SQL does to the database. No new migration: suspending is spaces.deleted_at, which purge_soft_deleted()
-- removes for good after 30 days. Written FIRST: red until the two .sql files exist.
\set ON_ERROR_STOP 1
\pset footer off
\ir harness.sql

\set as_admin 'reset role; select set_config(''request.jwt.claim.sub'', '''', false);'
\set as_pat   'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''d0000000-0000-0000-0000-0000000000d1'', false);'
\set as_quinn 'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''d0000000-0000-0000-0000-0000000000d2'', false);'
\set as_alex  'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-00000000000a'', false);'
\set pat      '''d0000000-0000-0000-0000-0000000000d1'''
\set space_a  '''22222222-0000-0000-0000-00000000000a'''

-- Both script files must exist (run.sh runs from backend/).
\! test -f scripts/suspend-family.sql
select :SHELL_ERROR = 'false' as have_suspend \gset
\! test -f scripts/start-family-switch.sql
select :SHELL_ERROR = 'false' as have_switch \gset
select tests.ok(:'have_suspend'::boolean, 'START-ON-3 backend/scripts/suspend-family.sql exists');
select tests.ok(:'have_switch'::boolean,  'START-ON-4 backend/scripts/start-family-switch.sql exists');

-- A family's shape, to prove "unchanged": members, groups, posts, media, invites (ids and soft-delete marks).
create function tests.shape(p_space uuid) returns text language sql as $$
  select md5(coalesce(string_agg(x, '|' order by x), '')) from (
    select 'm' || user_id || role x from public.space_members where space_id = p_space
    union all select 'c' || id || name || coalesce(deleted_at::text, '') from public.circles where space_id = p_space
    union all select 'p' || id || status || coalesce(deleted_at::text, '') from public.posts where space_id = p_space
    union all select 'i' || id from public.media_items where space_id = p_space
    union all select 'v' || id || coalesce(revoked_at::text, '') from public.invites where space_id = p_space) z
$$;
create function tests.photo(p_post text) returns text language sql as $$
  select format($q$select * from public.prepare_media_upload(%L, %L::jsonb)$q$, p_post,
    jsonb_build_array(jsonb_build_object('kind','photo','mime_type','image/jpeg','width',100,'height',100,
                                         'byte_size',1000,'thumb_byte_size',10,'exif_stripped',true))::text)
$$;
grant execute on all functions in schema tests to authenticated, anon;

-- ---------- setup: Pat starts a family; Quinn joins; one post to Everyone ----------
:as_admin
insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-0000-0000-0000000000d1', 'pat@example.com',   '{"display_name":"Parent Pat"}'),
  ('d0000000-0000-0000-0000-0000000000d2', 'quinn@example.com', '{"display_name":"Cousin Quinn"}');
insert into private.feature_flags (feature, enabled) values ('start_family_open', true)
  on conflict (feature) do update set enabled = true;
:as_pat
select tests.setv('pat_space', $$select public.start_family(gen_random_uuid(), 'Our kids', '{}')$$);
select tests.setv('pat_everyone', format($$select id from public.circles where space_id = %L and kind = 'everyone'$$, tests.v('pat_space')));
select tests.setv('quinn_code', format($$select (public.create_invite(%L, 'viewer', array[%L]::uuid[], 'email', 'quinn@example.com',
                                          null, interval '7 days', 1, null, 'all')).code$$, tests.v('pat_space'), tests.v('pat_everyone')));
select tests.setv('pat_post', format($$select public.create_post(gen_random_uuid(), %L, null, array[%L]::uuid[])$$,
                                     tests.v('pat_space'), tests.v('pat_everyone')));
:as_admin
select tests.try(format($$update public.posts set status = 'published' where id = %L$$, tests.v('pat_post')));
:as_quinn
select tests.try(format($$select public.redeem_invite(%L)$$, tests.v('quinn_code')));
:as_admin
-- The switch is back off for START-ON-4 below; START-ON-3 doesn't need it on.
update private.feature_flags set enabled = false where feature = 'start_family_open';
select tests.ok(tests.v('pat_space') is not null and tests.v('pat_post') is not null,
                'START-ON-3 setup: Pat started a family with a post, Quinn joined');
select tests.setv('shape_before', format($$select tests.shape(%L)$$, tests.v('pat_space')));
select tests.setv('shape_a', format($$select tests.shape(%L)$$, :space_a));
select tests.v('pat_space') as space_id \gset

-- ---------- START-ON-3: dry run changes nothing ----------
\set ON_ERROR_STOP 0
\set action suspend
\set apply no
\if :have_suspend
  \ir ../scripts/suspend-family.sql
\endif
\set ON_ERROR_STOP 1
:as_admin
select tests.ok_sql(format($$select deleted_at is null from public.spaces where id = %L$$, tests.v('pat_space')),
                    'START-ON-3 suspend without apply (the dry run) leaves the family alone');

-- ---------- START-ON-3: apply suspends it: not found for every member, uploads refused ----------
\set ON_ERROR_STOP 0
\set apply yes
\if :have_suspend
  \ir ../scripts/suspend-family.sql
\endif
\set ON_ERROR_STOP 1
:as_admin
select tests.ok_sql(format($$select deleted_at is not null and deleted_at > now() - interval '1 minute' from public.spaces where id = %L$$,
                           tests.v('pat_space')),
                    'START-ON-3 suspend with apply sets spaces.deleted_at to now');
select tests.ok_sql(format($$select tests.shape(%L) = %L$$, :space_a, tests.v('shape_a')),
                    'START-ON-3 only the named family changes (Alex''s family untouched)');
select tests.ok_sql(format($$select deleted_at is null from public.spaces where id = %L$$, :space_a),
                    'START-ON-3 Alex''s family is not suspended');
:as_pat
select tests.ok_sql(format($$select not exists (select 1 from public.spaces where id = %L and deleted_at is null)
                               and not exists (select 1 from public.posts where id = %L)$$, tests.v('pat_space'), tests.v('pat_post')),
                    'START-ON-3 suspended: the owner (Pat) no longer finds the family or its post (rule 2: not found)');
select tests.ok_sql(format($$select not exists (select 1 from public.my_spaces() where space_id = %L)$$, tests.v('pat_space')),
                    'START-ON-3 suspended: the family is not in Pat''s my_spaces()');
select tests.throws_any(tests.photo(tests.v('pat_post')),
                        'START-ON-3 suspended: Pat''s upload to the family is refused', array['42501', 'P0002']);
:as_quinn
select tests.ok_sql(format($$select not exists (select 1 from public.posts where id = %L)$$, tests.v('pat_post')),
                    'START-ON-3 suspended: a member (Quinn) no longer finds the post');
:as_alex
select tests.ok_sql($$select exists (select 1 from public.posts where space_id = '22222222-0000-0000-0000-00000000000a')$$,
                    'START-ON-3 suspended: another family (Alex) still sees its own posts');

-- ---------- START-ON-3: purge_soft_deleted is what removes it for good (after 30 days, not before) ----------
:as_admin
select tests.ok_sql(format($$select (public.purge_soft_deleted() ->> 'spaces')::int = 0
                                  and exists (select 1 from public.spaces where id = %L)$$, tests.v('pat_space')),
                    'START-ON-3 within 30 days purge_soft_deleted keeps the suspended family (undo still possible)');

-- ---------- START-ON-3: undo within 30 days brings it back unchanged ----------
\set ON_ERROR_STOP 0
\set action undo
\set apply no
\if :have_suspend
  \ir ../scripts/suspend-family.sql
\endif
\set ON_ERROR_STOP 1
:as_admin
select tests.ok_sql(format($$select deleted_at is not null from public.spaces where id = %L$$, tests.v('pat_space')),
                    'START-ON-3 undo without apply (the dry run) leaves it suspended');
\set ON_ERROR_STOP 0
\set apply yes
\if :have_suspend
  \ir ../scripts/suspend-family.sql
\endif
\set ON_ERROR_STOP 1
:as_admin
select tests.ok_sql(format($$select deleted_at is null from public.spaces where id = %L$$, tests.v('pat_space')),
                    'START-ON-3 undo with apply clears spaces.deleted_at');
select tests.ok_sql(format($$select tests.shape(%L) = %L$$, tests.v('pat_space'), tests.v('shape_before')),
                    'START-ON-3 after undo the family is unchanged (members, groups, posts, media, invites)');
:as_quinn
select tests.ok_sql(format($$select exists (select 1 from public.posts where id = %L)$$, tests.v('pat_post')),
                    'START-ON-3 after undo Quinn sees the post again');
:as_pat
select tests.lives(tests.photo(tests.v('pat_post')), 'START-ON-3 after undo Pat can upload again');

-- ---------- START-ON-3: --known lifts the cap (started_families.known_at) ----------
:as_admin
select tests.ok_sql(format($$select known_at is null from private.started_families where space_id = %L$$, tests.v('pat_space')),
                    'START-ON-3 setup: an app-started family starts not known (capped)');
\set ON_ERROR_STOP 0
\set action known
\set apply no
\if :have_suspend
  \ir ../scripts/suspend-family.sql
\endif
\set ON_ERROR_STOP 1
:as_admin
select tests.ok_sql(format($$select known_at is null from private.started_families where space_id = %L$$, tests.v('pat_space')),
                    'START-ON-3 known without apply (the dry run) leaves the cap on');
\set ON_ERROR_STOP 0
\set apply yes
\if :have_suspend
  \ir ../scripts/suspend-family.sql
\endif
\set ON_ERROR_STOP 1
:as_admin
select tests.ok_sql(format($$select known_at is not null from private.started_families where space_id = %L$$, tests.v('pat_space')),
                    'START-ON-3 known with apply sets started_families.known_at (cap lifted)');
select tests.ok_sql(format($$select deleted_at is null from public.spaces where id = %L$$, tests.v('pat_space')),
                    'START-ON-3 known does not suspend the family');

-- ---------- START-ON-3: an unknown space id changes nothing ----------
select tests.setv('all_spaces', $$select md5(string_agg(id || coalesce(deleted_at::text, ''), '|' order by id)) from public.spaces$$);
select '99999999-0000-0000-0000-000000000099' as space_id \gset
\set ON_ERROR_STOP 0
\set action suspend
\set apply yes
\if :have_suspend
  \ir ../scripts/suspend-family.sql
\endif
\set ON_ERROR_STOP 1
:as_admin
select tests.ok_sql(format($$select md5(string_agg(id || coalesce(deleted_at::text, ''), '|' order by id)) = %L from public.spaces$$,
                           tests.v('all_spaces')),
                    'START-ON-3 an unknown space id suspends nothing');

-- ---------- START-ON-4: the switch script changes start_family_open and nothing else ----------
:as_admin
select tests.setv('other_flags', $$select md5(coalesce(string_agg(feature || enabled::text, '|' order by feature), ''))
                                     from private.feature_flags where feature <> 'start_family_open'$$);
select tests.setv('space_count', 'select count(*) from public.spaces');
\set ON_ERROR_STOP 0
\set mode on
\set apply no
\if :have_switch
  \ir ../scripts/start-family-switch.sql
\endif
\set ON_ERROR_STOP 1
:as_admin
select tests.ok_sql($$select not enabled from private.feature_flags where feature = 'start_family_open'$$,
                    'START-ON-4 on without apply (the dry run) leaves the switch off');
\set ON_ERROR_STOP 0
\set apply yes
\if :have_switch
  \ir ../scripts/start-family-switch.sql
\endif
\set ON_ERROR_STOP 1
:as_admin
select tests.ok_sql($$select enabled from private.feature_flags where feature = 'start_family_open'$$,
                    'START-ON-4 on with apply turns start_family_open on');
select tests.ok_sql(format($$select md5(coalesce(string_agg(feature || enabled::text, '|' order by feature), '')) = %L
                               from private.feature_flags where feature <> 'start_family_open'$$, tests.v('other_flags')),
                    'START-ON-4 no other feature flag changes');
select tests.ok_sql(format($$select count(*)::text = %L from public.spaces$$, tests.v('space_count')),
                    'START-ON-4 no family is made or removed');
\set ON_ERROR_STOP 0
\set mode status
\set apply yes
\if :have_switch
  \ir ../scripts/start-family-switch.sql
\endif
\set ON_ERROR_STOP 1
:as_admin
select tests.ok_sql($$select enabled from private.feature_flags where feature = 'start_family_open'$$,
                    'START-ON-4 status changes nothing (still on)');
\set ON_ERROR_STOP 0
\set mode off
\set apply yes
\if :have_switch
  \ir ../scripts/start-family-switch.sql
\endif
\set ON_ERROR_STOP 1
:as_admin
select tests.ok_sql($$select not enabled from private.feature_flags where feature = 'start_family_open'$$,
                    'START-ON-4 off with apply turns start_family_open off');
select tests.ok_sql(format($$select md5(coalesce(string_agg(feature || enabled::text, '|' order by feature), '')) = %L
                               from private.feature_flags where feature <> 'start_family_open'$$, tests.v('other_flags')),
                    'START-ON-4 still no other feature flag changes');
select tests.ok_sql(format($$select deleted_at is null from public.spaces where id = %L$$, tests.v('pat_space')),
                    'START-ON-4 turning it off leaves existing families as they were');

-- ---------- report ----------
\o
\pset format aligned
select n, case when ok then 'ok' else 'NOT OK' end as result, description from tests.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tests.results \gset
\echo
\echo SUSPEND FAMILY RESULT: :passed passed, :failed failed
select :failed = 0 as all_ok \gset
\if :all_ok
\else
  \echo SOME TESTS FAILED
  select 1/0 as force_nonzero_exit;
\endif
