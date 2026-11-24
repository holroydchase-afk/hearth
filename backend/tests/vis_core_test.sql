-- VIS-7, VIS-22, VIS-24: the one dispatch agrees with today's rules, and nobody calls it from the app
-- (SPEC-VISIBILITY-CORE Phase 1 and 1b; docs/architecture/07-visibility-model.md). Written FIRST (Nov 24, 2026):
-- red until vis.can_see / vis.sees_item land (migrations 0030+). Fixture family: supabase/seed.sql
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
          perform set_config('request.jwt.claim.sub', u::text, true);
          want := public.can_see_profile(r.id::uuid);
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
