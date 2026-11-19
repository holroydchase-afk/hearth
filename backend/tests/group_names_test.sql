-- SEC-R1 (Nov 19 tech-debt review): a group's name stays with the parents (docs/architecture/05-access-control.md;
-- Chase, Nov 4). A relative must not read the names of the groups they are in through the raw API
-- (GET /rest/v1/circles) or in their data export. Parents (owner, adult) still see every live group in their space.
-- Everyone and event names stay readable to their members (the app shows those). Migration 0027.
-- Seed: Grandma Rivera is a viewer in Alex's space, in "Grandparents – Dad's side".
\set ON_ERROR_STOP 1
\pset footer off
\ir harness.sql

\set as_alex  'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-00000000000a'', false);'
\set as_ma    'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-0000000000a1'', false);'

:as_ma
select tests.ok_sql($$select not exists (select 1 from public.circles where kind in ('group', 'household'))$$,
                    'SEC-R1 Grandma Rivera reads no group or household row (so no name) from circles');
select tests.ok_sql($$select position('Grandparents' in public.export_my_data()::text) = 0$$,
                    'SEC-R1 her data export carries no group name');

:as_alex
select tests.ok_sql($$select exists (select 1 from public.circles where name like 'Grandparents%')$$,
                    'SEC-R1 Alex, a parent, still reads his groups by name');
select tests.ok_sql($$select position('Grandparents' in public.export_my_data()::text) > 0$$,
                    'SEC-R1 a parent''s export still names the groups');

-- ---------- report ----------
\o
\pset format aligned
select n, case when ok then 'ok' else 'NOT OK' end as result, description from tests.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tests.results \gset
\echo
\echo GROUP NAMES RESULT: :passed passed, :failed failed
select :failed = 0 as all_ok \gset
\if :all_ok
\else
  \echo SOME TESTS FAILED
  select 1/0 as force_nonzero_exit;
\endif
