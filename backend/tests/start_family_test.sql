-- BETA-START-1, 3..8, 10..13 (DEC-55, SPEC-START-FAMILY "Build design"): a signed-in parent with no family starts one.
-- Migration 0024: start_family, can_start_family, private.started_families, the start_family_open switch, the
-- 3-a-day limit, the cap for app-started families (HF001), retiring an empty family on redeem, and the revoke of
-- create_household/create_space. Written FIRST: red until 0024 lands.
-- Seed families (Alex's, Blair's) were made the old way, so they are never capped. New accounts below have no family.
\set ON_ERROR_STOP 1
\pset footer off
\ir harness.sql

\set as_admin 'reset role; select set_config(''request.jwt.claim.sub'', '''', false);'
\set as_anon  'reset role; set role anon; select set_config(''request.jwt.claim.sub'', '''', false);'
\set as_alex  'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-00000000000a'', false);'
\set as_pat   'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''d0000000-0000-0000-0000-0000000000d1'', false);'
\set as_quinn 'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''d0000000-0000-0000-0000-0000000000d2'', false);'
\set as_robin 'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''d0000000-0000-0000-0000-0000000000d3'', false);'
\set as_sky   'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''d0000000-0000-0000-0000-0000000000d4'', false);'
\set as_tay   'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''d0000000-0000-0000-0000-0000000000d5'', false);'
\set as_uma   'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''d0000000-0000-0000-0000-0000000000d6'', false);'
\set as_val   'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''d0000000-0000-0000-0000-0000000000d7'', false);'
\set as_wren  'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''d0000000-0000-0000-0000-0000000000d8'', false);'
\set as_xan   'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''d0000000-0000-0000-0000-0000000000d9'', false);'
\set pat      '''d0000000-0000-0000-0000-0000000000d1'''
\set space_a  '''22222222-0000-0000-0000-00000000000a'''
\set dad_side '''33333333-0000-0000-0000-0000000000a1'''

:as_admin
-- New accounts, none in any family (profiles come from the on_auth_user_created trigger).
insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-0000-0000-0000000000d1', 'pat@example.com',   '{"display_name":"Parent Pat"}'),
  ('d0000000-0000-0000-0000-0000000000d2', 'quinn@example.com', '{"display_name":"Cousin Quinn"}'),
  ('d0000000-0000-0000-0000-0000000000d3', 'robin@example.com', '{"display_name":"Stranger Robin"}'),
  ('d0000000-0000-0000-0000-0000000000d4', 'sky@example.com',   '{"display_name":"Parent Sky"}'),
  ('d0000000-0000-0000-0000-0000000000d5', 'tay@example.com',   '{"display_name":"Parent Tay"}'),
  ('d0000000-0000-0000-0000-0000000000d6', 'uma@example.com',   '{"display_name":"Parent Uma"}'),
  ('d0000000-0000-0000-0000-0000000000d7', 'val@example.com',   '{"display_name":"Parent Val"}'),
  ('d0000000-0000-0000-0000-0000000000d8', 'wren@example.com',  '{"display_name":"Parent Wren"}'),
  ('d0000000-0000-0000-0000-0000000000d9', 'xan@example.com',   '{"display_name":"Parent Xan"}');

-- The refusal's SQLSTATE plus every word it carries (message, detail, hint); null when nothing was raised.
create function tests.err_text(p_sql text) returns text language plpgsql as $$
declare m text; d text; h text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics m = message_text, d = pg_exception_detail, h = pg_exception_hint;
  return sqlstate || ': ' || coalesce(m, '') || ' ' || coalesce(d, '') || ' ' || coalesce(h, '');
end $$;
-- n photo items, as sign-media sends them.
create function tests.photos(p_post text, p_n integer, p_bytes bigint default 1000) returns text language sql as $$
  select format($q$select * from public.prepare_media_upload(%L, %L::jsonb)$q$, p_post,
    (select jsonb_agg(jsonb_build_object('kind','photo','mime_type','image/jpeg','width',100,'height',100,
                                         'byte_size',p_bytes,'thumb_byte_size',10,'exif_stripped',true))
       from generate_series(1, p_n))::text)
$$;
-- Admin back door for filling a family fast: n items on one post (positions from p_from), each p_bytes + 10.
create function tests.fill(p_post uuid, p_n integer, p_bytes bigint, p_from integer default 0) returns void language sql as $$
  insert into public.media_items (post_id, space_id, uploader_id, position, kind, mime_type, display_key, thumb_key,
                                  width, height, byte_size, thumb_byte_size, exif_stripped)
  select p_post, '00000000-0000-0000-0000-000000000000', p.author_id, p_from + g, 'photo', 'image/jpeg', 'pending', 'pending',
         100, 100, p_bytes, 10, true
    from public.posts p, generate_series(0, p_n - 1) g where p.id = p_post
$$;
grant execute on all functions in schema tests to authenticated, anon;

-- ---------- BETA-START-8: the switch ships off, and off means no ----------
select tests.ok_sql($$select enabled = false from private.feature_flags where feature = 'start_family_open'$$,
                    'BETA-START-8 the start_family_open switch exists and ships off');
select tests.ok_sql($$select pg_get_function_result('public.can_start_family()'::regprocedure) = 'boolean'$$,
                    'BETA-START-8 can_start_family() returns a boolean and nothing else');
select tests.ok_sql($$select not exists (select 1 from public.my_features('22222222-0000-0000-0000-00000000000a') f
                                         where f.feature = 'start_family_open')$$,
                    'BETA-START-8 my_features never lists the switch');
:as_pat
select tests.throws_code($$select public.start_family(gen_random_uuid(), 'Our kids', '{}')$$,
                         'BETA-START-8 with the switch off, starting a family is refused', '42501');
select tests.ok_sql($$select public.can_start_family() = false$$,
                    'BETA-START-8 with the switch off, can_start_family() says false');
select tests.throws_code($$select * from private.feature_flags$$,
                         'BETA-START-8 an app user can''t read or flip the switch', '42501');
:as_admin
select tests.ok_sql($$select not exists (select 1 from public.spaces where created_by = 'd0000000-0000-0000-0000-0000000000d1')$$,
                    'BETA-START-8 the refused start made nothing');

-- ---------- BETA-START-10: the old functions are closed to the app ----------
select tests.ok_sql($$select not has_function_privilege('authenticated', 'public.create_household(text)', 'execute')
                         and not has_function_privilege('anon', 'public.create_household(text)', 'execute')
                         and not has_function_privilege('public', 'public.create_household(text)', 'execute')$$,
                    'BETA-START-10 create_household is revoked from authenticated, anon and public');
select tests.ok_sql($$select not has_function_privilege('authenticated', 'public.create_space(uuid, text)', 'execute')
                         and not has_function_privilege('anon', 'public.create_space(uuid, text)', 'execute')
                         and not has_function_privilege('public', 'public.create_space(uuid, text)', 'execute')$$,
                    'BETA-START-10 create_space is revoked from authenticated, anon and public');
select tests.ok_sql($$select has_function_privilege('service_role', 'public.create_household(text)', 'execute')
                         and has_function_privilege('service_role', 'public.create_space(uuid, text)', 'execute')$$,
                    'BETA-START-10 the service role keeps both');
select tests.ok_sql($$select has_function_privilege('authenticated', 'public.start_family(uuid, text, text[])', 'execute')
                         and not has_function_privilege('anon', 'public.start_family(uuid, text, text[])', 'execute')
                         and has_function_privilege('authenticated', 'public.can_start_family()', 'execute')
                         and not has_function_privilege('anon', 'public.can_start_family()', 'execute')$$,
                    'BETA-START-10 start_family and can_start_family are for signed-in accounts only');
:as_robin
select tests.throws_code($$select public.create_household('Sneaky')$$,
                         'BETA-START-10 a signed-in account calling create_household directly is denied', '42501');
:as_anon
select tests.throws_code($$select public.start_family(gen_random_uuid(), 'Our kids', '{}')$$,
                         'BETA-START-10 a signed-out caller can''t start a family', '42501');

-- Chase turns the switch on for the rest of the suite.
:as_admin
insert into private.feature_flags (feature, enabled) values ('start_family_open', true)
  on conflict (feature) do update set enabled = true;

-- ---------- BETA-START-1: the new family is the creator's alone ----------
:as_robin
select tests.ok_sql($$select public.can_start_family() = true$$,
                    'BETA-START-8 with the switch on, an account with no family may start one');
:as_pat
select tests.setv('pat_client', 'select gen_random_uuid()::text');
select tests.setv('pat_space', format($$select public.start_family(%L, 'Our kids', '{}')$$, tests.v('pat_client')));
select tests.ok(tests.v('pat_space') is not null, 'BETA-START-1 Pat starts "Our kids" and gets its id back');
select tests.ok_sql(format($$select public.start_family(%L, 'Our kids', '{}') = %L$$, tests.v('pat_client'), tests.v('pat_space')),
                    'BETA-START-1 the same request sent twice returns the same family (idempotent)');
select tests.ok_sql(format($$select exists (select 1 from public.space_members where space_id = %L and user_id = auth.uid() and role = 'owner')$$,
                           tests.v('pat_space')),
                    'BETA-START-1 Pat is Owner');
:as_admin
select tests.ok_sql(format($$select count(*) = 1 from public.spaces where created_by = %L and deleted_at is null$$, :pat),
                    'BETA-START-1 exactly one family exists for Pat');
select tests.ok_sql(format($$select count(*) = 1 from public.households h join public.household_members hm on hm.household_id = h.id
                               where h.created_by = %L and hm.user_id = %L and hm.role = 'admin'$$, :pat, :pat),
                    'BETA-START-1 one household, Pat as its admin');
select tests.ok_sql(format($$select count(*) = 1 from public.circles c join public.circle_members cm on cm.circle_id = c.id
                               where c.space_id = %L and c.kind = 'everyone' and cm.user_id = %L$$, tests.v('pat_space'), :pat),
                    'BETA-START-1 one Everyone, with Pat in it');
select tests.ok_sql(format($$select count(*) = 1 from public.circles where space_id = %L and deleted_at is null$$, tests.v('pat_space')),
                    'BETA-START-1 Just Everyone: no other groups');
select tests.ok_sql(format($$select exists (select 1 from public.notification_prefs where space_id = %L and user_id = %L)$$,
                           tests.v('pat_space'), :pat),
                    'BETA-START-1 Pat has notification settings for it');
select tests.ok_sql(format($$select count(*) = 1 from public.space_members where space_id = %L$$, tests.v('pat_space')),
                    'BETA-START-1 nobody else is in it');
select tests.ok_sql(format($$select started_by = %L and known_at is null from private.started_families where space_id = %L$$,
                           :pat, tests.v('pat_space')),
                    'BETA-START-1 it is marked as started in the app (so the cap applies)');
select tests.ok_sql(format($$select count(*) = 1 from private.rate_limit_events where key = 'start:' || %L and action = 'start_family'$$, :pat),
                    'BETA-START-11 one start is counted (the repeat request did not count twice)');
:as_alex
select tests.ok_sql(format($$select not exists (select 1 from public.spaces where id = %L)
                               and not exists (select 1 from public.circles where space_id = %L)
                               and not exists (select 1 from public.space_members where space_id = %L)$$,
                           tests.v('pat_space'), tests.v('pat_space'), tests.v('pat_space')),
                    'BETA-START-1 another account (Alex) can''t see the family, its groups or its people');
:as_robin
select tests.ok_sql(format($$select not exists (select 1 from public.spaces where id = %L)$$, tests.v('pat_space')),
                    'BETA-START-1 nor can an account with no family');
select tests.throws_code('select * from private.started_families',
                         'BETA-START-1 an app user can''t read which families were started in the app', '42501');

-- ---------- BETA-START-5: one family per account ----------
:as_pat
select tests.throws_code($$select public.start_family(gen_random_uuid(), 'Second try', '{}')$$,
                         'BETA-START-5 Pat, who already has a family, is refused a second one', '23505');
select tests.ok_sql($$select public.can_start_family() = false$$,
                    'BETA-START-5 can_start_family() is false for Pat, so no start button');
:as_alex
select tests.throws_code($$select public.start_family(gen_random_uuid(), 'Another', '{}')$$,
                         'BETA-START-5 Alex, who is in an old family, is refused too', '23505');
select tests.ok_sql($$select public.can_start_family() = false$$,
                    'BETA-START-5 can_start_family() is false for Alex');

-- ---------- BETA-START-3: invites into the new family work, and only for the invited ----------
:as_pat
select tests.setv('pat_everyone', format($$select id from public.circles where space_id = %L and kind = 'everyone'$$, tests.v('pat_space')));
select tests.setv('quinn_code', format($$select (public.create_invite(%L, 'viewer', array[%L]::uuid[], 'email', 'quinn@example.com',
                                          null, interval '7 days', 1, null, 'all')).code$$, tests.v('pat_space'), tests.v('pat_everyone')));
select tests.ok(tests.v('quinn_code') is not null, 'BETA-START-3 Pat invites Quinn by email to Everyone');
select tests.setv('pat_post', format($$select public.create_post(gen_random_uuid(), %L, null, array[%L]::uuid[])$$,
                                     tests.v('pat_space'), tests.v('pat_everyone')));
:as_admin
select tests.try(format($$update public.posts set status = 'published' where id = %L$$, tests.v('pat_post')));
:as_quinn
select tests.ok_sql(format($$select (public.redeem_invite(%L))::text = to_json(%L::uuid)::text$$, tests.v('quinn_code'), tests.v('pat_space')),
                    'BETA-START-3 Quinn redeems the code and lands in Pat''s family');
select tests.ok_sql(format($$select exists (select 1 from public.posts where id = %L)$$, tests.v('pat_post')),
                    'BETA-START-3 Quinn sees the post shared to Everyone');
select tests.ok_sql($$select not exists (select 1 from public.posts where space_id <> (select space_id from public.space_members
                                                                         where user_id = auth.uid() limit 1))$$,
                    'BETA-START-3 and no other family''s posts');
:as_robin
select tests.ok_sql(format($$select not exists (select 1 from public.posts where id = %L)$$, tests.v('pat_post')),
                    'BETA-START-3 Robin, with no invite, sees none of it');

-- ---------- BETA-START-4: Two sides ----------
:as_val
select tests.setv('val_space', $$select public.start_family(gen_random_uuid(), 'Val family', array['Dad''s side', 'Mom''s side'])$$);
select tests.ok(tests.v('val_space') is not null, 'BETA-START-4 Val starts a family with Two sides');
:as_admin
select tests.ok_sql(format($$select array_agg(name order by name) = array['Dad''s side', 'Mom''s side']
                               from public.circles where space_id = %L and kind = 'group' and deleted_at is null$$, tests.v('val_space')),
                    'BETA-START-4 both sides exist as groups');
select tests.ok_sql(format($$select bool_and(comment_mode = 'private') from public.circles where space_id = %L and kind = 'group'$$,
                           tests.v('val_space')),
                    'BETA-START-4 both have Private comments');
select tests.ok_sql(format($$select not exists (select 1 from public.circles c join public.circle_members cm on cm.circle_id = c.id
                                                where c.space_id = %L and c.kind = 'group')
                               and not exists (select 1 from public.circles c join public.circle_people cp on cp.circle_id = c.id
                                                where c.space_id = %L and c.kind = 'group')
                               and not exists (select 1 from public.circle_links l join public.circles c on c.id = l.child_id
                                                where c.space_id = %L)$$,
                           tests.v('val_space'), tests.v('val_space'), tests.v('val_space')),
                    'BETA-START-4 nobody is in the sides yet, and nothing is linked');
select tests.ok_sql(format($$select count(*) = 1 from public.circles where space_id = %L and kind = 'everyone'$$, tests.v('val_space')),
                    'BETA-START-4 Everyone is still there');

-- ---------- BETA-START-6: a failure partway leaves nothing behind ----------
:as_wren
select tests.throws_code($$select public.start_family(gen_random_uuid(), 'Wren family', array['Zebra side', 'Zebra side'])$$,
                         'BETA-START-6 two sides with the same name are refused', '23514');
select tests.throws_code($$select public.start_family(gen_random_uuid(), 'Wren family', array['Only one side'])$$,
                         'BETA-START-6 one side alone is refused', '23514');
select tests.throws_code($$select public.start_family(gen_random_uuid(), 'Wren family', array['A', 'B', 'C'])$$,
                         'BETA-START-6 three sides are refused', '23514');
select tests.throws_code($$select public.start_family(gen_random_uuid(), '   ', '{}')$$,
                         'BETA-START-6 a blank name is refused', '23514');
select tests.throws_code(format($$select public.start_family(gen_random_uuid(), %L, '{}')$$, repeat('x', 61)),
                         'BETA-START-6 a name over 60 characters is refused', '23514');
select tests.throws_code($$select public.start_family(gen_random_uuid(), 'Wren family', array['Dad''s side', ''])$$,
                         'BETA-START-6 a blank side name is refused', '23514');
:as_admin
select tests.ok_sql($$select not exists (select 1 from public.households where created_by = 'd0000000-0000-0000-0000-0000000000d8')
                         and not exists (select 1 from public.spaces where created_by = 'd0000000-0000-0000-0000-0000000000d8')
                         and not exists (select 1 from public.circles where created_by = 'd0000000-0000-0000-0000-0000000000d8')$$,
                    'BETA-START-6 the failures left no household, family or group behind');
select tests.ok_sql($$select not exists (select 1 from private.rate_limit_events where key = 'start:d0000000-0000-0000-0000-0000000000d8')$$,
                    'BETA-START-6 and no start was counted against Wren');
:as_wren
select tests.ok_sql($$select public.can_start_family() = true$$,
                    'BETA-START-6 so Wren can still start one');

-- ---------- BETA-START-7: an empty self-started family is retired when its creator joins another ----------
-- (The seed's family has no 'everyone'-kind group, so Alex invites to Dad's side.)
:as_alex
select tests.setv('sky_code', format($$select (public.create_invite(%L, 'viewer',
                                        array[%L]::uuid[],
                                        'email', 'sky@example.com', null, interval '7 days', 1, null, 'all')).code$$, :space_a, :dad_side));
select tests.setv('xan_code', format($$select (public.create_invite(%L, 'viewer',
                                        array[%L]::uuid[],
                                        'email', 'xan@example.com', null, interval '7 days', 1, null, 'all')).code$$, :space_a, :dad_side));
:as_sky
select tests.setv('sky_space', $$select public.start_family(gen_random_uuid(), 'Sky family', '{}')$$);
select tests.ok_sql(format($$select (public.redeem_invite(%L))::text = to_json(%L::uuid)::text$$, tests.v('sky_code'), :space_a),
                    'BETA-START-7 Sky, who started an empty family, redeems Alex''s code and lands in Alex''s family');
:as_admin
select tests.ok_sql(format($$select deleted_at is not null from public.spaces where id = %L$$, tests.v('sky_space')),
                    'BETA-START-7 Sky''s empty family is retired');
select tests.ok_sql($$select count(*) = 1 from private.rate_limit_events where key = 'start:d0000000-0000-0000-0000-0000000000d4'$$,
                    'BETA-START-7 retiring it does not reset Sky''s count of starts');
:as_xan
select tests.setv('xan_space', $$select public.start_family(gen_random_uuid(), 'Xan family', '{}')$$);
select tests.setv('xan_post', format($$select public.create_post(gen_random_uuid(), %L, null,
                                       array[(select id from public.circles where space_id = %L and kind = 'everyone')]::uuid[])$$,
                                     tests.v('xan_space'), tests.v('xan_space')));
select tests.ok(tests.v('xan_post') is not null, 'BETA-START-7 Xan starts a family and drafts a post in it');
select tests.ok_sql(format($$select (public.redeem_invite(%L))::text = to_json(%L::uuid)::text$$, tests.v('xan_code'), :space_a),
                    'BETA-START-7 Xan redeems Alex''s code');
:as_admin
select tests.ok_sql(format($$select deleted_at is null from public.spaces where id = %L$$, tests.v('xan_space')),
                    'BETA-START-7 a family with a post in it (even a draft) is never retired');
select tests.ok_sql(format($$select deleted_at is null from public.spaces where id = %L$$, tests.v('pat_space')),
                    'BETA-START-7 nor is a family with another member (Pat''s, which Quinn joined)');

-- ---------- BETA-START-11: 3 starts a day, and the hourly purge doesn't forget them ----------
-- Tay started 3 families 2 hours ago (each since retired); Uma's 3 were 25 hours ago.
insert into private.rate_limit_events (key, action, at)
select 'start:d0000000-0000-0000-0000-0000000000d5', 'start_family', now() - interval '2 hours' from generate_series(1, 3);
insert into private.rate_limit_events (key, action, at)
select 'start:d0000000-0000-0000-0000-0000000000d6', 'start_family', now() - interval '25 hours' from generate_series(1, 3);
select tests.lives($$select private.rl_fail(array['user:00000000-0000-0000-0000-0000000000ff'], 'redeem')$$,
                   'BETA-START-11 setup: a failed redeem runs the 1-hour purge');
select tests.lives($$select public.purge_client_errors()$$, 'BETA-START-11 setup: the server''s purge runs too');
select tests.ok_sql($$select count(*) = 3 from private.rate_limit_events where key = 'start:d0000000-0000-0000-0000-0000000000d5'$$,
                    'BETA-START-11 starts from 2 hours ago survive the 1-hour purge');
select tests.ok_sql($$select count(*) = 0 from private.rate_limit_events where key = 'start:d0000000-0000-0000-0000-0000000000d6'$$,
                    'BETA-START-11 starts older than 24 hours are purged');
:as_tay
select tests.ok_sql($$select public.can_start_family() = false$$,
                    'BETA-START-11 can_start_family() is false after 3 starts today');
select tests.throws_code($$select public.start_family(gen_random_uuid(), 'Fourth', '{}')$$,
                         'BETA-START-11 the 4th start in 24 hours is refused', '54000');
:as_uma
select tests.ok_sql($$select public.can_start_family() = true$$,
                    'BETA-START-11 starts from yesterday don''t count');
select tests.setv('uma_space', $$select public.start_family(gen_random_uuid(), 'Uma family', '{}')$$);
select tests.ok(tests.v('uma_space') is not null, 'BETA-START-11 so Uma can start one');

-- ---------- BETA-START-12: the cap for app-started families; old families exempt ----------
-- Pat: 500 items. One sent by Pat, then 499 filled by the server.
:as_pat
select tests.setv('pp' || g, format($$select public.create_post(gen_random_uuid(), %L, null, array[%L]::uuid[])$$,
                                    tests.v('pat_space'), tests.v('pat_everyone')))
  from generate_series(1, 6) g;
select tests.lives(tests.photos(tests.v('pp6'), 1), 'BETA-START-12 Pat sends a photo while under the cap');
:as_admin
select tests.try(format('select tests.fill(%L, 100, 1)', tests.v('pp' || g))) from generate_series(1, 4) g;
select tests.try(format('select tests.fill(%L, 99, 1)', tests.v('pp5')));
select tests.ok_sql(format($$select count(*) = 500 from public.media_items where space_id = %L$$, tests.v('pat_space')),
                    'BETA-START-12 setup: Pat''s family holds 500 items');
:as_pat
select tests.throws_code(tests.photos(tests.v('pp6'), 1), 'BETA-START-12 the 501st item is refused: family full', 'HF001');
select tests.ok_sql(format($$select (public.space_upload_quota(%L)->>'family_full')::boolean$$, tests.v('pat_space')),
                    'BETA-START-12 space_upload_quota says family_full before Pat picks photos');
:as_admin
select tests.ok_sql(format($$select count(*) = 500 from public.media_items where space_id = %L$$, tests.v('pat_space')),
                    'BETA-START-12 the refused item left no row');
select tests.throws_code(format('select tests.fill(%L, 1, 1, 50)', tests.v('pp6')),
                         'BETA-START-12 a direct insert is refused the same way', 'HF001');
-- Val: 2 GiB. The server fills it close to the line.
:as_val
select tests.setv('vp', format($$select public.create_post(gen_random_uuid(), %L, null,
                                 array[(select id from public.circles where space_id = %L and kind = 'everyone')]::uuid[])$$,
                               tests.v('val_space'), tests.v('val_space')));
:as_admin
select tests.try(format('select tests.fill(%L, 1, 2147480000)', tests.v('vp')));
:as_val
select tests.lives(format($$select * from public.prepare_media_upload(%L, '[{"kind":"photo","mime_type":"image/jpeg","width":100,"height":100,
                            "byte_size":1000,"thumb_byte_size":10,"exif_stripped":true}]')$$, tests.v('vp')),
                   'BETA-START-12 Val sends a photo that still fits under 2 GB');
select tests.throws_code(format($$select * from public.prepare_media_upload(%L, '[{"kind":"photo","mime_type":"image/jpeg","width":100,"height":100,
                                  "byte_size":3000,"thumb_byte_size":10,"exif_stripped":true}]')$$, tests.v('vp')),
                         'BETA-START-12 a photo that would pass 2 GB is refused', 'HF001');
-- Old families are never capped.
:as_alex
select tests.setv('ap' || g, format($$select public.create_post(gen_random_uuid(), %L, null, array[%L]::uuid[])$$, :space_a, :dad_side))
  from generate_series(1, 6) g;
:as_admin
select tests.try(format('select tests.fill(%L, 100, 1)', tests.v('ap' || g))) from generate_series(1, 5) g;
:as_alex
select tests.lives(tests.photos(tests.v('ap6'), 1), 'BETA-START-12 Alex''s family (made the old way) is not capped past 500');
select tests.ok_sql(format($$select (public.space_upload_quota(%L)->>'family_full')::boolean = false$$, :space_a),
                    'BETA-START-12 and its quota says family_full false');
-- Chase marks Pat's family known: no cap.
:as_admin
select tests.try(format($$update private.started_families set known_at = now() where space_id = %L$$, tests.v('pat_space')));
:as_pat
select tests.lives(tests.photos(tests.v('pp6'), 1), 'BETA-START-12 once Chase marks it known, Pat''s family is not capped');

-- ---------- BETA-START-13: refusals name nobody ----------
-- Each refusal must carry its code and none of: family name, side name, email, user id, display name.
create temp table forbidden (s text);
insert into forbidden values ('Our kids'), ('Second try'), ('Wren family'), ('Zebra side'), ('Fourth'),
  ('pat@example.com'), ('wren@example.com'), ('tay@example.com'), ('Parent Pat'), ('Parent Wren'), ('Parent Tay'),
  ('d0000000-0000-0000-0000-0000000000d1'), ('d0000000-0000-0000-0000-0000000000d8'), ('d0000000-0000-0000-0000-0000000000d5');
grant select on forbidden to authenticated;
:as_pat
select tests.ok_sql($$select e like '23505:%' and not exists (select 1 from forbidden where position(s in e) > 0)
                        from tests.err_text($q$select public.start_family(gen_random_uuid(), 'Second try', '{}')$q$) e$$,
                    'BETA-START-13 the already-in-a-family refusal names nobody');
:as_wren
select tests.ok_sql($$select e like '23514:%' and not exists (select 1 from forbidden where position(s in e) > 0)
                        from tests.err_text($q$select public.start_family(gen_random_uuid(), 'Wren family', array['Zebra side', 'Zebra side'])$q$) e$$,
                    'BETA-START-13 the bad-side refusal names no side, family or person');
select tests.ok_sql(format($$select e like '23514:%%' and not exists (select 1 from forbidden where position(s in e) > 0)
                               from tests.err_text(%L) e$$,
                           format($q$select public.start_family(gen_random_uuid(), %L, '{}')$q$, 'Wren family' || repeat('x', 60))),
                    'BETA-START-13 the name-too-long refusal doesn''t echo the name');
:as_tay
select tests.ok_sql($$select e like '54000:%' and not exists (select 1 from forbidden where position(s in e) > 0)
                        from tests.err_text($q$select public.start_family(gen_random_uuid(), 'Fourth', '{}')$q$) e$$,
                    'BETA-START-13 the too-many-starts refusal names nobody');
:as_admin
update private.feature_flags set enabled = false where feature = 'start_family_open';
:as_wren
select tests.ok_sql($$select e like '42501:%' and not exists (select 1 from forbidden where position(s in e) > 0)
                        from tests.err_text($q$select public.start_family(gen_random_uuid(), 'Wren family', '{}')$q$) e$$,
                    'BETA-START-13 the switch-off refusal names nobody');
-- The app reports the refusal through report_client_error; the stored fields carry no name or id.
select tests.lives($$select public.report_client_error('1.0.0', 'ios 17.0', 'StartFamily', 'start_family_refused', '23514')$$,
                   'BETA-START-13 the app reports a start_family refusal');
:as_admin
select tests.ok_sql($$select not exists (select 1 from public.client_errors c, forbidden f
                                         where c.kind = 'start_family_refused'
                                           and position(f.s in concat_ws(' ', c.app_version, c.os, c.screen, c.kind, c.code)) > 0)$$,
                    'BETA-START-13 the error report''s fields name nobody');

-- ---------- BETA-START-8: off again never touches existing families ----------
:as_robin
select tests.ok_sql($$select public.can_start_family() = false$$,
                    'BETA-START-8 switched off again, can_start_family() is false for everyone');
select tests.throws_code($$select public.start_family(gen_random_uuid(), 'Late', '{}')$$,
                         'BETA-START-8 and starting is refused', '42501');
:as_pat
select tests.ok_sql(format($$select exists (select 1 from public.spaces where id = %L and deleted_at is null)$$, tests.v('pat_space')),
                    'BETA-START-8 turning it off leaves Pat''s family as it was');
:as_quinn
select tests.ok_sql(format($$select exists (select 1 from public.posts where id = %L)$$, tests.v('pat_post')),
                    'BETA-START-8 and Quinn still sees Pat''s post');

-- ---------- report ----------
\o
\pset format aligned
select n, case when ok then 'ok' else 'NOT OK' end as result, description from tests.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tests.results \gset
\echo
\echo START FAMILY RESULT: :passed passed, :failed failed
select :failed = 0 as all_ok \gset
\if :all_ok
\else
  \echo SOME TESTS FAILED
  select 1/0 as force_nonzero_exit;
\endif
