-- WHO-1..5 (Chase, Nov 4): every post says who can see it, by people's names, to everyone who can see it;
-- a group's name stays with the parents. Migration 0022, post_viewers. Written FIRST: red until 0022 lands.
-- Seed: post a1 went to "Grandparents – Dad's side" in space A (Alex's). Grandma and Grandpa Rivera are in
-- it; Aunt Jo and Grandma Chen are in space A but not in that group, so they can't see a1.
\set ON_ERROR_STOP 1
\pset footer off
\ir harness.sql

\set as_admin 'reset role; select set_config(''request.jwt.claim.sub'', '''', false);'
\set as_ma    'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-0000000000a1'', false);'
\set as_jo    'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''c0000000-0000-0000-0000-0000000000c1'', false);'
\set p1       '''55555555-0000-0000-0000-0000000000a1'''

-- ---------- WHO-1 a grandparent sees who else can see the post, by name ----------
:as_ma
select tests.ok_sql(format($$select (select array_agg(v->>'name' order by v->>'name') from jsonb_array_elements(w.viewers) v)
                                    @> array['Alex', 'Grandma Rivera', 'Grandpa Rivera']
                               from public.post_viewers(array[%L]::uuid[]) w$$, :p1),
                    'WHO-1 Grandma sees that Alex, Grandpa and she herself can see the post');
select tests.ok_sql(format($$select not exists (select 1 from public.post_viewers(array[%L]::uuid[]) w, jsonb_array_elements(w.viewers) v
                                                where v->>'name' in ('Aunt Jo', 'Grandma Chen'))$$, :p1),
                    'WHO-1 ...and nobody who can''t see it is listed');

-- ---------- WHO-2 the list is exactly the people the privacy rule lets see it ----------
:as_admin
create temp table who_expected as
  select array_agg(sm.user_id::text order by sm.user_id::text) as ids
    from public.space_members sm join public.posts p on p.space_id = sm.space_id
   where p.id = :p1 and private.sees_post(sm.user_id, p.id);
grant select on who_expected to authenticated;
:as_ma
select tests.ok_sql(format($$select (select array_agg(v->>'user_id' order by v->>'user_id') from jsonb_array_elements(w.viewers) v)
                                    = (select ids from who_expected)
                               from public.post_viewers(array[%L]::uuid[]) w$$, :p1),
                    'WHO-2 the names are exactly who sees_post lets see it, no more and no fewer');

-- ---------- WHO-3 a post you can't see is "not found" ----------
:as_jo
select tests.ok_sql(format($$select not exists (select 1 from public.post_viewers(array[%L]::uuid[]))$$, :p1),
                    'WHO-3 Aunt Jo, who can''t see the post, gets nothing back about it');

-- ---------- WHO-4 people only: no group names, ids and names only ----------
:as_ma
select tests.ok_sql(format($$select bool_and((select array_agg(k order by k) from jsonb_object_keys(v) k) = array['name', 'user_id'])
                               from public.post_viewers(array[%L]::uuid[]) w, jsonb_array_elements(w.viewers) v$$, :p1),
                    'WHO-4 each viewer is a name and an id, nothing else');
select tests.ok_sql(format($$select position('Grandparents' in w.viewers::text) = 0 from public.post_viewers(array[%L]::uuid[]) w$$, :p1),
                    'WHO-4 the group''s name never appears');

-- ---------- WHO-5 signed-out callers can't use it ----------
:as_admin
select tests.ok_sql($$select not has_function_privilege('anon', 'public.post_viewers(uuid[])', 'execute')$$,
                    'WHO-5 anon can''t call post_viewers');

-- ---------- report ----------
\o
\pset format aligned
select n, case when ok then 'ok' else 'NOT OK' end as result, description from tests.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tests.results \gset
\echo
\echo WHO RESULT: :passed passed, :failed failed
select :failed = 0 as all_ok \gset
\if :all_ok
\else
  \echo SOME TESTS FAILED
  select 1/0 as force_nonzero_exit;
\endif
