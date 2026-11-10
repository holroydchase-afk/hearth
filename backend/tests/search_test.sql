-- SEARCH-1..14 (Chase, Nov 10, go-live list item 9): find posts by their words, who sent them and when.
-- Non-AI only: plain words in the title, caption and sender's name; never media, faces, places or replies.
-- Migration 0025, search_posts. Written FIRST: red until 0025 lands.
-- Seed: space A (Alex's). a1 "Sam's first bike ride" went to "Grandparents – Dad's side" (Grandma and Grandpa
-- Rivera); a2 "Report card" went to "Co-parent" (Blair); a3 "Soccer game!" went to Everyone (Grandma and Grandpa
-- Rivera, Aunt Jo, Grandma Chen). Grandpa replied "Look at him go!" on a1.
\set ON_ERROR_STOP 1
\pset footer off
\ir harness.sql

\set as_admin 'reset role; select set_config(''request.jwt.claim.sub'', '''', false);'
\set as_alex  'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-00000000000a'', false);'
\set as_blair 'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''b0000000-0000-0000-0000-00000000000b'', false);'
\set as_ma    'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-0000000000a1'', false);'
\set as_jo    'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''c0000000-0000-0000-0000-0000000000c1'', false);'
\set sa       '''22222222-0000-0000-0000-00000000000a'''
\set sb       '''22222222-0000-0000-0000-00000000000b'''
\set alex     '''a0000000-0000-0000-0000-00000000000a'''
\set blair    '''b0000000-0000-0000-0000-00000000000b'''
\set p1       '''55555555-0000-0000-0000-0000000000a1'''
\set p2       '''55555555-0000-0000-0000-0000000000a2'''
\set p3       '''55555555-0000-0000-0000-0000000000a3'''

-- capture dates so the date filter and the order have something to work with
:as_admin
update public.posts set taken_at = '2026-07-04 15:00+00' where id = :p1;
update public.posts set taken_at = '2026-05-20 15:00+00' where id = :p2;
update public.posts set taken_at = '2025-12-25 15:00+00' where id = :p3;
update public.posts set title = 'Fourth of July' where id = :p1;
update public.posts set caption = 'Soccer game!' where id = :p3;   -- the seed's caption says "(everyone)"

-- ---------- SEARCH-1 a grandparent finds a post she can see by a word in its caption ----------
:as_ma
select tests.ok_sql(format($$select array_agg(post_id::text) = array[%L] from public.search_posts(%L, 'bike')$$, :p1, :sa),
                    'SEARCH-1 Grandma finds the bike ride by typing "bike"');
select tests.ok_sql(format($$select array_agg(post_id::text) = array[%L] from public.search_posts(%L, 'BIKE  ride')$$, :p1, :sa),
                    'SEARCH-1 ...in any case, every word must match, extra spaces are fine');
select tests.ok_sql(format($$select not exists (select 1 from public.search_posts(%L, 'bike piano'))$$, :sa),
                    'SEARCH-1 ...a word that isn''t there finds nothing');

-- ---------- SEARCH-2 a post you can't see is never found ----------
:as_jo
select tests.ok_sql(format($$select not exists (select 1 from public.search_posts(%L, 'bike'))$$, :sa),
                    'SEARCH-2 Aunt Jo, who can''t see the bike ride, finds nothing for "bike"');
select tests.ok_sql(format($$select array_agg(post_id::text) = array[%L] from public.search_posts(%L, 'soccer')$$, :p3, :sa),
                    'SEARCH-2 ...but finds the Everyone post for "soccer"');
select tests.ok_sql(format($$select not exists (select 1 from public.search_posts(%L, 'report'))$$, :sa),
                    'SEARCH-2 ...and never the co-parent''s report card');

-- ---------- SEARCH-3 group names are never searched or returned (GROUP PRIVACY, Nov 4) ----------
:as_blair
select tests.ok_sql(format($$select not exists (select 1 from public.search_posts(%L, 'Co-parent'))$$, :sa),
                    'SEARCH-3 Blair typing her group''s name "Co-parent" finds nothing');
:as_jo
select tests.ok_sql(format($$select not exists (select 1 from public.search_posts(%L, 'Everyone'))$$, :sa),
                    'SEARCH-3 Aunt Jo typing "Everyone" finds nothing (group names aren''t searched)');
:as_ma
select tests.ok_sql(format($$select bool_and(audience is null and position('Grandparents –' in r::text) = 0)
                               from public.search_posts(%L, 'bike') r$$, :sa),
                    'SEARCH-3 a found post carries no audience and no group title for someone who didn''t send it');
:as_alex
select tests.ok_sql(format($$select audience is not null from public.search_posts(%L, 'bike') r$$, :sa),
                    'SEARCH-3 ...the sender still gets their own audience, as on the timeline');

-- ---------- SEARCH-4 replies are not searched ----------
:as_ma
select tests.ok_sql(format($$select not exists (select 1 from public.search_posts(%L, 'Look at him go'))$$, :sa),
                    'SEARCH-4 words from a reply find nothing (reply rules stay with the replies)');

-- ---------- SEARCH-5 the title and the sender's name are searched too ----------
:as_ma
select tests.ok_sql(format($$select array_agg(post_id::text) = array[%L] from public.search_posts(%L, 'july')$$, :p1, :sa),
                    'SEARCH-5 the title "Fourth of July" is found by "july"');
select tests.ok_sql(format($$select array_agg(post_id::text order by post_id) = array[%L, %L]
                               from public.search_posts(%L, 'alex')$$, :p1, :p3, :sa),
                    'SEARCH-5 typing the sender''s name finds what they sent that you can see');

-- ---------- SEARCH-6 from one person ----------
:as_alex
select tests.ok_sql(format($$select array_agg(post_id::text) = array[%L, %L, %L]
                               from public.search_posts(%L, null, p_author => %L)$$, :p1, :p2, :p3, :sa, :alex),
                    'SEARCH-6 "From Alex" with no words lists everything Alex sent, newest photo first');
:as_ma
select tests.ok_sql(format($$select not exists (select 1 from public.search_posts(%L, null, p_author => %L))$$, :sa, :blair),
                    'SEARCH-6 "From Blair" in a family where Blair sent nothing Grandma can see finds nothing');

-- ---------- SEARCH-7 a date range, on the day the photo was taken ----------
:as_alex
select tests.ok_sql(format($$select array_agg(post_id::text) = array[%L, %L]
                               from public.search_posts(%L, null, p_from => '2026-01-01', p_until => '2027-01-01')$$, :p1, :p2, :sa),
                    'SEARCH-7 "2026" finds the two photos taken in 2026 and not last Christmas');
select tests.ok_sql(format($$select array_agg(post_id::text) = array[%L]
                               from public.search_posts(%L, 'soccer', p_from => '2025-12-01', p_until => '2026-01-01')$$, :p3, :sa),
                    'SEARCH-7 words and dates together');

-- ---------- SEARCH-8 typed symbols are words, not patterns ----------
:as_alex
select tests.ok_sql(format($$select not exists (select 1 from public.search_posts(%L, '%%'))$$, :sa),
                    'SEARCH-8 "%" is a literal percent sign, not "match everything"');
select tests.ok_sql(format($$select not exists (select 1 from public.search_posts(%L, '_'))$$, :sa),
                    'SEARCH-8 "_" is a literal underscore');

-- ---------- SEARCH-9 nothing to search for, or too much ----------
:as_alex
select tests.throws_code(format($$select * from public.search_posts(%L, '   ')$$, :sa),
                         'SEARCH-9 blank words with no person or dates is refused', '22023');
select tests.throws_code(format($$select * from public.search_posts(%L, %L)$$, :sa, repeat('x', 101)),
                         'SEARCH-9 more than 100 characters is refused', '22023');
select tests.throws_code(format($$select * from public.search_posts(%L, 'a b c d e f g h i')$$, :sa),
                         'SEARCH-9 more than 8 words is refused', '22023');

-- ---------- SEARCH-10 another family's posts are never found ----------
:as_ma
select tests.ok_sql(format($$select not exists (select 1 from public.search_posts(%L, 'baking'))$$, :sb),
                    'SEARCH-10 Grandma Rivera, not in Mom''s family, finds nothing there');
select tests.ok_sql(format($$select not exists (select 1 from public.search_posts(%L, 'baking'))$$, :sa),
                    'SEARCH-10 ...and Mom''s posts never show up in Dad''s family');

-- ---------- SEARCH-11 a deleted post is gone ----------
:as_admin
update public.posts set deleted_at = now() where id = :p3;
:as_jo
select tests.ok_sql(format($$select not exists (select 1 from public.search_posts(%L, 'soccer'))$$, :sa),
                    'SEARCH-11 a deleted post is not found');
:as_admin
update public.posts set deleted_at = null where id = :p3;

-- ---------- SEARCH-12 paging, newest photo first ----------
:as_alex
select tests.ok_sql(format($$select array_agg(post_id::text) = array[%L] from public.search_posts(%L, 'alex', p_limit => 1)$$, :p1, :sa),
                    'SEARCH-12 page one holds the newest match');
select tests.ok_sql(format($$select array_agg(post_id::text) = array[%L]
                               from public.search_posts(%L, 'alex', p_before_at => '2026-07-04 15:00+00', p_before_id => %L, p_limit => 1)$$,
                           :p2, :sa, :p1),
                    'SEARCH-12 page two starts after the last one shown');

-- ---------- SEARCH-13 search reads only: nothing is written or kept ----------
:as_admin
select tests.ok_sql($$select provolatile = 's' from pg_proc where oid = 'public.search_posts(uuid, text, uuid, timestamptz, timestamptz, timestamptz, uuid, integer)'::regprocedure$$,
                    'SEARCH-13 search_posts is STABLE, so it can''t store what anyone typed');

-- ---------- SEARCH-14 signed-out callers can't use it ----------
select tests.ok_sql($$select not has_function_privilege('anon', 'public.search_posts(uuid, text, uuid, timestamptz, timestamptz, timestamptz, uuid, integer)', 'execute')$$,
                    'SEARCH-14 anon can''t call search_posts');
select tests.ok_sql($$select has_function_privilege('authenticated', 'public.search_posts(uuid, text, uuid, timestamptz, timestamptz, timestamptz, uuid, integer)', 'execute')$$,
                    'SEARCH-14 signed-in people can');

-- ---------- report ----------
\o
\pset format aligned
select n, case when ok then 'ok' else 'NOT OK' end as result, description from tests.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tests.results \gset
\echo
\echo SEARCH RESULT: :passed passed, :failed failed
select :failed = 0 as all_ok \gset
\if :all_ok
\else
  \echo SOME TESTS FAILED
  select 1/0 as force_nonzero_exit;
\endif
