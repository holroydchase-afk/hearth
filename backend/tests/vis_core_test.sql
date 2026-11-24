-- VIS-7, VIS-22, VIS-24: the one dispatch agrees with today's rules, and nobody calls it from the app
-- (SPEC-VISIBILITY-CORE Phase 1 and 1b; docs/architecture/07-visibility-model.md). Written FIRST (Nov 24, 2026):
-- red until vis.can_see / vis.sees_item land (migrations 0031+). Fixture family: supabase/seed.sql
-- (space A: Alex, Grandma and Grandpa Rivera, Aunt Jo; space B: Blair, Grandma Chen). VIS-8's generated
-- families (Phase 2) widen this later.
-- Names follow 07 (vis.can_see(user, kind, id), vis.sees_item(user, item)); the spec's C2 and VIS-7 text say
-- private.can_see. The test follows 07, the data model doc; see the QA report.
\set ON_ERROR_STOP 1
\pset footer off
\ir harness.sql

\set alex    '''a0000000-0000-0000-0000-00000000000a'''
\set grandma '''a0000000-0000-0000-0000-0000000000a1'''
\set jo      '''c0000000-0000-0000-0000-0000000000c1'''
\set blair   '''b0000000-0000-0000-0000-00000000000b'''
\set p_a1    '''55555555-0000-0000-0000-0000000000a1'''
\set as_alex_export 'reset role; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-00000000000a'', false); set role authenticated;'

-- VIS-7 family_date rows (QA, Nov 24, 2026; engineer flag on d7870c5): seed.sql has no family dates, so the
-- per-row check below never touched kind family_date. Personas only. seed.sql predates 0011's kinds; a real
-- family's Everyone is kind 'everyone' (as in family_dates_test.sql), so dates with no member have a real audience.
-- Family C (Alex owner, Grandma Rivera viewer) is deleted: nobody sees its dates, parents included.
update public.circles set kind = 'everyone'
 where id in ('33333333-0000-0000-0000-0000000000a0', '33333333-0000-0000-0000-0000000000b0');
insert into public.spaces (id, household_id, name, plan, created_by, deleted_at) values
  ('22222222-0000-0000-0000-00000000000c', '11111111-0000-0000-0000-00000000000a', 'Old family', 'free',
   'a0000000-0000-0000-0000-00000000000a', now());
insert into public.space_members (space_id, user_id, role, invited_by) values
  ('22222222-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a', 'owner', null),
  ('22222222-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-0000000000a1', 'viewer', 'a0000000-0000-0000-0000-00000000000a');
-- VIS-7 child, both directions (QA review of 3eb777d): seed.sql's only child, Sam, is seen by all six people, so
-- the child rule was never checked saying no. Kit is in family B only, Blair the guardian; Grandma Rivera,
-- Grandpa Rivera and Aunt Jo (family A only) must not see Kit.
insert into public.children (id, display_name, created_by) values
  ('44444444-0000-0000-0000-000000000002', 'Kit', 'b0000000-0000-0000-0000-00000000000b');
insert into public.space_children (space_id, child_id) values
  ('22222222-0000-0000-0000-00000000000b', '44444444-0000-0000-0000-000000000002');
insert into public.family_dates (id, space_id, kind, label, month, day, member_id, created_by) values
  -- A: Alex (owner), Grandma Rivera (viewer), Blair (co-parent, Co-parent group only), Grandma Chen (Everyone only)
  ('77777777-0000-0000-0000-0000000000a1', '22222222-0000-0000-0000-00000000000a', 'birthday', null, 5, 5,
   'a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a'),
  ('77777777-0000-0000-0000-0000000000a2', '22222222-0000-0000-0000-00000000000a', 'birthday', null, 3, 3,
   'a0000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-0000000000a1'),
  ('77777777-0000-0000-0000-0000000000a3', '22222222-0000-0000-0000-00000000000a', 'birthday', null, 8, 18,
   'b0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000b'),
  ('77777777-0000-0000-0000-0000000000a4', '22222222-0000-0000-0000-00000000000a', 'birthday', null, 2, 14,
   'b0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-0000000000b1'),
  ('77777777-0000-0000-0000-0000000000a5', '22222222-0000-0000-0000-00000000000a', 'anniversary', 'Anniversary', 6, 1,
   null, 'a0000000-0000-0000-0000-00000000000a'),
  -- B: Blair (owner), Grandma Chen (viewer), Alex (co-parent)
  ('77777777-0000-0000-0000-0000000000b1', '22222222-0000-0000-0000-00000000000b', 'birthday', null, 9, 9,
   'b0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b'),
  ('77777777-0000-0000-0000-0000000000b2', '22222222-0000-0000-0000-00000000000b', 'other', 'Reunion', 7, 4,
   null, 'b0000000-0000-0000-0000-00000000000b'),
  -- C (deleted family)
  ('77777777-0000-0000-0000-0000000000c1', '22222222-0000-0000-0000-00000000000c', 'birthday', null, 1, 1,
   'a0000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a'),
  ('77777777-0000-0000-0000-0000000000c2', '22222222-0000-0000-0000-00000000000c', 'other', 'Old date', 10, 10,
   null, 'a0000000-0000-0000-0000-00000000000a');

-- ---------- VIS-7 pinned answers in the fixture family (both directions) ----------
select tests.ok_sql(format($$select vis.can_see(%L, (select kind from vis.kinds where relation = 'public.posts'::regclass), %L)$$, :grandma, :p_a1),
                    'VIS-7 Grandma Rivera, in the post''s group, can see post a1 through can_see');
select tests.ok_sql(format($$select vis.can_see(%L, (select kind from vis.kinds where relation = 'public.posts'::regclass), %L)$$, :alex, :p_a1),
                    'VIS-7 Alex, its author, can see post a1 through can_see');
select tests.ok_sql(format($$select vis.can_see(%L, (select kind from vis.kinds where relation = 'public.posts'::regclass), %L) is false$$, :jo, :p_a1),
                    'VIS-7 Aunt Jo, same family but not in the group, can''t see post a1 (false, not null)');
select tests.ok_sql(format($$select vis.can_see(%L, (select kind from vis.kinds where relation = 'public.posts'::regclass), %L) is false$$, :blair, :p_a1),
                    'VIS-7 Blair, the other home, can''t see post a1 (false, not null)');
select tests.ok_sql(format($$select vis.can_see(%L, 'vis_no_such_kind', %L) is false$$, :grandma, :p_a1),
                    'VIS-7 an unregistered kind is seen by nobody (default deny, false not an error)');

-- ---------- VIS-7 every user x every row of every registered kind equals its reach's rule ----------
-- item (no hook): = private.sees_post(user, item column). item with a hook: never wider than sees_post.
-- person (profiles): = public.can_see_profile(id) as that user. self: = owner column is the user. server: false.
-- container and admin: = what that user's RLS select returns today (the registry names the rule, it doesn't change it).
create function tests.vis7(p_reach text) returns text language plpgsql as $f$
declare k record; u uuid; r record; got boolean; want boolean; bad int := 0; checked int := 0; first text;
begin
  for k in select * from vis.kinds where reach = p_reach
             and exists (select 1 from pg_attribute a where a.attrelid = relation and a.attname = 'id' and not a.attisdropped
                           and a.atttypid = 'uuid'::regtype)   -- can_see takes a uuid; bigint-id kinds (comment_mode_log) can't be addressed
           order by kind loop
    for r in execute format('select id::text as id%s from %s',
                            case when k.item_column is not null then format(', %I::uuid as item', k.item_column) else ', null::uuid as item' end
                            || case when k.owner_column is not null then format(', %I::uuid as owner', k.owner_column) else ', null::uuid as owner' end,
                            k.relation) loop
      for u in select id from auth.users order by id loop
        got := vis.can_see(u, k.kind, r.id::uuid);
        if p_reach = 'item' then
          want := private.sees_post(u, r.item);
          if k.narrow_fn is not null then want := case when want then got else false end; end if;
        elsif p_reach = 'person' then
          -- Each Person-class kind is held to its own table's rule (QA, Nov 24): profiles to can_see_profile,
          -- family_dates to private.may_see_family_date (its RLS rule, 0029). A person kind with no oracle here
          -- fails instead of borrowing the profile rule.
          perform set_config('request.jwt.claim.sub', u::text, true);
          if k.relation = 'public.profiles'::regclass then
            want := public.can_see_profile(r.id::uuid);
          elsif k.relation = 'public.children'::regclass then
            -- 0033 (QA-R1): the child rule is children_select itself, read as that user under RLS
            execute 'set local role authenticated';
            execute 'select exists (select 1 from public.children where id = $1)' into want using r.id::uuid;
            execute 'reset role';
          elsif k.relation = 'public.family_dates'::regclass then
            select private.may_see_family_date(d.space_id, d.member_id) into want
              from public.family_dates d where d.id = r.id::uuid;
          else
            perform set_config('request.jwt.claim.sub', '', true);
            return format('no oracle for person kind %s (%s): add one to tests.vis7', k.kind, k.relation);
          end if;
          perform set_config('request.jwt.claim.sub', '', true);
        elsif p_reach = 'self' then
          want := (r.owner = u);
        elsif p_reach = 'server' then
          want := false;
        else
          perform set_config('request.jwt.claim.sub', u::text, true);
          execute 'set local role authenticated';
          execute format('select exists (select 1 from %s where id::text = $1)', k.relation) into want using r.id;
          execute 'reset role';
          perform set_config('request.jwt.claim.sub', '', true);
        end if;
        checked := checked + 1;
        if got is distinct from coalesce(want, false) then
          bad := bad + 1;
          if first is null then first := format('%s %s user %s: can_see %s, rule %s', k.kind, r.id, u, got, want); end if;
        end if;
      end loop;
    end loop;
  end loop;
  if checked = 0 then return 'nothing checked'; end if;
  return case when bad = 0 then 'ok' else format('%s of %s wrong; first: %s', bad, checked, first) end;
end $f$;

begin;
select tests.setv('vis7_' || reach, format('select tests.vis7(%L)', reach))
  from unnest(array['item', 'person', 'container', 'self', 'admin', 'server']) reach;
commit;
select tests.ok(tests.v('vis7_' || reach) = 'ok',
                format('VIS-7 every user and %s-reach row: can_see equals the %s rule  [%s]', reach, reach,
                       coalesce(tests.v('vis7_' || reach), 'errored: vis.kinds / vis.can_see missing')))
  from unnest(array['item', 'person', 'container', 'self', 'admin', 'server']) reach;

-- VIS-7 family_date (QA, Nov 24): the person check above really covered the calendar rows, both directions.
create function tests.vis7_dates() returns text language plpgsql as $f$
declare yes int := 0; no int := 0; d uuid; u uuid;
begin
  for d in select id from public.family_dates loop
    for u in select id from auth.users loop
      if vis.can_see(u, 'family_date', d) then yes := yes + 1; else no := no + 1; end if;
    end loop;
  end loop;
  return case when yes > 0 and no > 0 then 'ok' else format('vacuous: %s visible, %s hidden', yes, no) end;
end $f$;
begin;
select tests.setv('vis7_dates', 'select tests.vis7_dates()');
commit;
select tests.ok(tests.v('vis7_dates') = 'ok',
                format('VIS-7 the fixture''s family dates are checked in both directions (seen and not seen)  [%s]',
                       coalesce(tests.v('vis7_dates'), 'errored: kind family_date or vis.can_see missing')));

select tests.ok_sql($$select count(*) filter (where vis.can_see(u.id, 'child', c.id)) > 0
                          and count(*) filter (where not vis.can_see(u.id, 'child', c.id)) > 0
                     from auth.users u cross join public.children c$$,
                    'VIS-7 the fixture''s children are checked in both directions (seen and not seen)');
select tests.ok_sql($$select not vis.can_see('a0000000-0000-0000-0000-0000000000a1', 'child', '44444444-0000-0000-0000-000000000002')
                         and vis.can_see('b0000000-0000-0000-0000-00000000000b', 'child', '44444444-0000-0000-0000-000000000002')$$,
                    'VIS-7 Blair (guardian) sees Kit; Grandma Rivera (other family only) does not');

-- VIS-18 parity with the RPC the app calls (QA, Nov 24): for every user x family (deleted one included),
-- list_family_dates returns exactly the dates vis.can_see says yes to. This is what keeps list_family_dates'
-- allowlist entry in 0032 honest; it reads may_see_family_date, not vis.can_see.
create function tests.vis18_list() returns text language plpgsql as $f$
declare u uuid; sp uuid; got text; want text; bad int := 0; checked int := 0; first text;
begin
  for sp in select id from public.spaces order by id loop
    for u in select id from auth.users order by id loop
      want := (select coalesce(string_agg(d.id::text, ',' order by d.id), '') from public.family_dates d
                where d.space_id = sp and vis.can_see(u, 'family_date', d.id));
      perform set_config('request.jwt.claim.sub', u::text, true);
      execute 'set local role authenticated';
      got := (select coalesce(string_agg(l.id::text, ',' order by l.id), '') from public.list_family_dates(sp) l);
      execute 'reset role';
      perform set_config('request.jwt.claim.sub', '', true);
      checked := checked + 1;
      if got is distinct from want then
        bad := bad + 1;
        if first is null then first := format('family %s user %s: list_family_dates [%s], can_see [%s]', sp, u, got, want); end if;
      end if;
    end loop;
  end loop;
  if checked = 0 then return 'nothing checked'; end if;
  return case when bad = 0 then 'ok' else format('%s of %s wrong; first: %s', bad, checked, first) end;
end $f$;
begin;
select tests.setv('vis18_list', 'select tests.vis18_list()');
commit;
select tests.ok(tests.v('vis18_list') = 'ok',
                format('VIS-18 every user and family: list_family_dates returns exactly the dates can_see allows  [%s]',
                       coalesce(tests.v('vis18_list'), 'errored: kind family_date or vis.can_see missing')));

-- VIS-7 (QA review of 0f64e37): the per-row check above can only address kinds with a uuid `id`. Pin the kinds it
-- skips so a new kind can't drop out of the parity proof quietly; adding one here is a reviewed choice.
select tests.ok_sql($$select coalesce(string_agg(kind, ',' order by kind), '') =
                       'chat_device,chat_group,chat_message,child_guardian,circle_link,circle_member,circle_person,client_error,'
                       'comment_mode_log,household_member,invite_circle,media_key,notification_pref,post_audience,post_child,'
                       'post_view,reaction,space_child,space_feature,space_member,storage_purge_queue'
                       from vis.kinds k
                      where not exists (select 1 from pg_attribute a where a.attrelid = k.relation and a.attname = 'id'
                                          and not a.attisdropped and a.atttypid = 'uuid'::regtype)$$,
                    'VIS-7 the kinds can_see can''t address by id (no uuid id) are exactly the 21 reviewed ones');

-- ---------- R82 (QA-R6, P2): the export leaves out dates you created in a deleted family ----------
-- export_my_data (0029) takes every date with created_by = you, so Alex's export still carries the dates he
-- added in family C after C was deleted. Both directions: his live family's dates stay in it.
:as_alex_export
select tests.ok_sql($$select jsonb_typeof(public.export_my_data()->'family_dates') = 'array'
                         and not exists (select 1 from jsonb_array_elements(public.export_my_data()->'family_dates') x
                                          where x->>'space_id' = '22222222-0000-0000-0000-00000000000c')$$,
                    'R82 Alex''s export has none of the dates he created in a deleted family (family C)');
select tests.ok_sql($$select exists (select 1 from jsonb_array_elements(public.export_my_data()->'family_dates') x
                                      where x->>'id' = '77777777-0000-0000-0000-0000000000a5')$$,
                    'R82 ...and still has the date he created in his live family (A''s anniversary)');
-- Closed (chief of staff, Nov 24): your own birthday stays in your own export, even from a deleted family.
reset role; select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000a1', false); set role authenticated;
select tests.ok_sql($$select exists (select 1 from jsonb_array_elements(public.export_my_data()->'family_dates') x
                                      where x->>'id' = '77777777-0000-0000-0000-0000000000c1')$$,
                    'R82 Grandma Rivera''s export keeps her own birthday from deleted family C (her own data)');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------- VIS-22 vis.sees_item agrees with private.sees_post on every user x post (gate for the swap) ----------
select tests.ok_sql($$select count(*) = 0 from auth.users u cross join public.posts p
                       where vis.sees_item(u.id, p.id) is distinct from private.sees_post(u.id, p.id)$$,
                    'VIS-22 vis.sees_item equals private.sees_post for every user and every post in the fixtures');
select tests.ok_sql($$select count(*) > 0 from auth.users u cross join public.posts p where vis.sees_item(u.id, p.id)$$,
                    'VIS-22 ...and the comparison is not vacuous (someone sees something)');
select tests.ok_sql($$select count(*) > 0 from auth.users u cross join public.posts p where not vis.sees_item(u.id, p.id)$$,
                    'VIS-22 ...and someone is kept out of something');

-- ---------- VIS-24 functions that take a user id are never callable through the API (PRIV-VC-R3) ----------
-- PostgREST exposes public and graphql_public (config.toml [api] schemas; tests/vis_gate_test.sh checks the file).
create temp table vis24 (fn text);
insert into vis24 values ('private.sees_post(uuid,uuid)'), ('vis.sees_item(uuid,uuid)'), ('vis.can_see(uuid,text,uuid)');
select tests.ok_sql(format($$select to_regprocedure(%L) is not null$$, fn), format('VIS-24 %s exists', fn)) from vis24;
select tests.ok_sql(format($$select n.nspname not in ('public', 'graphql_public')
                               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.oid = %L::regprocedure$$, fn),
                    format('VIS-24 %s lives in a schema PostgREST does not expose', fn)) from vis24;
select tests.ok_sql(format($$select not has_function_privilege('anon', %L, 'execute')$$, fn),
                    format('VIS-24 signed out (anon) can''t execute %s', fn)) from vis24;
select tests.ok_sql(format($$select (select proconfig from pg_proc where oid = %L::regprocedure) @> array['search_path=""']$$, fn),
                    format('VIS-24 %s pins search_path to empty', fn)) from vis24;
-- can_see is for tests, sign-media, notify and export (server side); RLS never calls it, so the app role can't.
select tests.ok_sql($$select not has_function_privilege('authenticated', 'vis.can_see(uuid,text,uuid)', 'execute')$$,
                    'VIS-24 a signed-in user (authenticated) can''t execute vis.can_see');
select tests.ok_sql($$select not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                         where n.nspname in ('public', 'graphql_public')
                                           and (p.proname in ('sees_post', 'sees_item', 'can_see')))$$,
                    'VIS-24 no wrapper named sees_post, sees_item or can_see sits in an exposed schema');
-- PRIV-VC-B1 (P2, privacy review Nov 24): every private.vis_* rule takes a viewer id, so each would answer "can
-- this other person see X" if callable. All nine are pinned (0033 added vis_sees_child on purpose, QA-R1), and
-- neither anon nor authenticated may execute any of them.
create temp table vis24_rules (fn text);
insert into vis24_rules values
  ('private.vis_sees_person(uuid,uuid)'), ('private.vis_sees_family_date(uuid,uuid)'), ('private.vis_sees_circle(uuid,uuid)'),
  ('private.vis_sees_space(uuid,uuid)'), ('private.vis_sees_invite(uuid,uuid)'), ('private.vis_sees_household(uuid,uuid)'),
  ('private.vis_media_ok(uuid,uuid)'), ('private.vis_comment_ok(uuid,uuid)'), ('private.vis_sees_child(uuid,uuid)');
select tests.ok_sql($$select coalesce(string_agg(p.oid::regprocedure::text, ',' order by p.oid::regprocedure::text), '')
                             = (select string_agg(fn, ',' order by fn) from vis24_rules)
                        from pg_proc p where p.pronamespace = 'private'::regnamespace and p.proname like 'vis\_%'$$,
                    'PRIV-VC-B1 the private.vis_* viewer-id rules are exactly the nine pinned ones');
select tests.ok_sql(format($$select not has_function_privilege('anon', %L, 'execute')$$, fn),
                    format('PRIV-VC-B1 signed out (anon) can''t execute %s', fn)) from vis24_rules order by fn;
select tests.ok_sql(format($$select not has_function_privilege('authenticated', %L, 'execute')$$, fn),
                    format('PRIV-VC-B1 a signed-in user (authenticated) can''t execute %s', fn)) from vis24_rules order by fn;
select tests.ok_sql(format($$select (select proconfig from pg_proc where oid = %L::regprocedure) @> array['search_path=""']$$, fn),
                    format('PRIV-VC-B1 %s pins search_path to empty', fn)) from vis24_rules order by fn;

-- through the API: as a signed-in user, asking about someone else is refused, not answered
\set as_jo 'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''c0000000-0000-0000-0000-0000000000c1'', false);'
:as_jo
select tests.ok_sql(format($$select r->>'status' = 'raised' and r->'body'->>'code' = '42501'
                               from tests.rest(format('select vis.can_see(%%L, ''post'', %%L)', %L, %L)) r$$, :grandma, :p_a1),
                    'VIS-24 Aunt Jo asking can_see whether Grandma sees a post is refused (42501), not answered');
reset role;

-- ---------- report ----------
\o
\pset format aligned
select n, case when ok then 'ok' else 'NOT OK' end as result, description from tests.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tests.results \gset
\echo
\echo VIS CORE RESULT: :passed passed, :failed failed
select :failed = 0 as all_ok \gset
\if :all_ok
\else
  \echo SOME TESTS FAILED
  select 1/0 as force_nonzero_exit;
\endif
