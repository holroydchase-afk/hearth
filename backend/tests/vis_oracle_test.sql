-- VIS-8, VIS-9, VIS-10, VIS-11 (fixture sync): the oracle across readers (SPEC-VISIBILITY-CORE Phase 2, C4;
-- TRACKER R51 folded in). Written FIRST (Nov 24, 2026, qa-tdd): red until backend/tests/vis_oracle/ exists.
--
-- What the engineer builds (the contract this suite holds them to; test infrastructure, no product code):
--   backend/tests/vis_oracle/generate.sql   creates schema vis_oracle with
--     vis_oracle.generate(p_seed integer) returns void
--         Builds generated families on top of supabase/seed.sql, as a superuser, through the real tables
--         (triggers on). Same seed => the same rows, ids and timestamps (ids derived from the seed, times from a
--         fixed base, never now()/random()). Different seed => a different family. Personas only: display names
--         are the kids' nicknames from docs/product/PERSONAS.md (optionally with a number), emails @example.com.
--         The shape it must contain is listed under "VIS-8 shape" below (overlapping groups, removed members,
--         a demoted parent, a co-parent in the other family, share-history cutoffs, deleted posts, drafts,
--         events, households, replies, reactions, media, life-calendar dates, chats, pending notices).
--     vis_oracle.fixture_json() returns jsonb
--         The generated rows plus the oracle's answers, in the shape app/src/api/__tests__/visOracle.test.ts
--         reads (VIS-11). Deterministic for a seed. The seed-42 copy is committed at
--         backend/tests/vis_oracle/fixtures/seed-42.json and must stay equal to it (checked below).
--   backend/tests/vis_oracle/nightly.sh     VIS-12 (tests/vis_oracle_nightly_test.sh). It may run this file
--         with -v vo_seed=<n>; the matrix is printed below the marker line "VIS ORACLE MATRIX".
--
-- The oracle is vis.can_see(user, kind, id). For every person x every item x every read path, this suite
-- compares the path's answer with it. A mismatch prints user, kind, path, id and whether it is a wrong yes
-- (P0: someone saw what they shouldn't) or a wrong no (P1).
\set ON_ERROR_STOP 1
\pset footer off
\ir harness.sql

\if :{?vo_seed}
\else
  \set vo_seed 42
\endif
-- generate.sql is the engineer's; until it exists every VIS-8..11 check below records a failure (the right red).
\set have_gen `test -f tests/vis_oracle/generate.sql && echo true || echo false`
\if :have_gen
  \ir vis_oracle/generate.sql
\endif
\set as_admin 'reset role; select set_config(''request.jwt.claim.sub'', '''', false);'

select (to_regprocedure('vis_oracle.generate(integer)') is not null) as have_fn,
       (to_regprocedure('vis_oracle.fixture_json()') is not null) as have_fx \gset
select tests.ok(:'have_fn'::boolean, 'VIS-8 harness: tests/vis_oracle/generate.sql defines vis_oracle.generate(seed integer)');
select tests.ok(:'have_fx'::boolean, 'VIS-11 harness: tests/vis_oracle/generate.sql defines vis_oracle.fixture_json()');

\if :have_fn
-- ======================================================================================================
-- 0. What existed before the generator (seed.sql), so the shape checks count only generated rows
-- ======================================================================================================
create table tests.vo_before (rel text, id uuid, primary key (rel, id));
insert into tests.vo_before
  select 'user', id from auth.users union all select 'space', id from public.spaces
  union all select 'household', id from public.households union all select 'circle', id from public.circles
  union all select 'post', id from public.posts union all select 'comment', id from public.comments
  union all select 'family_date', id from public.family_dates union all select 'media', id from public.media_items;
create function tests.vo_new(p_rel text, p_id uuid) returns boolean language sql stable as $$
  select not exists (select 1 from tests.vo_before b where b.rel = p_rel and b.id = p_id) $$;

-- fingerprint of the generated rows (ids, links and timestamps)
create function tests.vo_fp() returns text language sql stable as $$
  select md5(concat_ws('|',
    (select string_agg(concat_ws(',', id, space_id, author_id, status, published_at, taken_at, deleted_at), ';' order by id)
       from public.posts where tests.vo_new('post', id)),
    (select string_agg(concat_ws(',', post_id, circle_id), ';' order by post_id, circle_id) from public.post_audiences
      where tests.vo_new('post', post_id)),
    (select string_agg(concat_ws(',', space_id, user_id, role), ';' order by space_id, user_id) from public.space_members
      where tests.vo_new('space', space_id)),
    (select string_agg(concat_ws(',', id, space_id, kind, deleted_at), ';' order by id) from public.circles
      where tests.vo_new('circle', id)),
    (select string_agg(concat_ws(',', circle_id, user_id, sees_from), ';' order by circle_id, user_id) from public.circle_members
      where tests.vo_new('circle', circle_id)),
    (select string_agg(concat_ws(',', id, post_id, author_id, created_at, deleted_at), ';' order by id) from public.comments
      where tests.vo_new('comment', id)),
    (select string_agg(concat_ws(',', post_id, user_id, emoji), ';' order by post_id, user_id) from public.reactions
      where tests.vo_new('post', post_id)),
    (select string_agg(concat_ws(',', id, space_id, member_id, created_by), ';' order by id) from public.family_dates
      where tests.vo_new('family_date', id)))) $$;

-- ---------- VIS-8 fixed seed: the same seed builds the same family; another seed builds another ----------
begin;
select vis_oracle.generate(:vo_seed);
select tests.vo_fp() as fp_a, coalesce((select vis_oracle.fixture_json()::text where :'have_fx'::boolean), 'none') as fx_a \gset
rollback;
begin;
select vis_oracle.generate(:vo_seed);
select tests.vo_fp() as fp_b, coalesce((select vis_oracle.fixture_json()::text where :'have_fx'::boolean), 'none') as fx_b \gset
rollback;
begin;
select vis_oracle.generate(:vo_seed + 1);
select tests.vo_fp() as fp_c \gset
rollback;
select tests.ok(:'fp_a' = :'fp_b', 'VIS-8 fixed seed: generate(' || :vo_seed || ') twice gives the same rows, ids and times');
select tests.ok(:'fp_a' <> :'fp_c', 'VIS-8 fixed seed: a different seed gives a different family');
select tests.ok(:'fx_a' <> 'none' and :'fx_a' = :'fx_b', 'VIS-11 fixture_json() is the same for the same seed');

-- the real run
select vis_oracle.generate(:vo_seed);

-- ---------- VIS-11 the committed seed-42 fixture is what the generator makes today (Jest reads it) ----------
\if :have_fx
select (:vo_seed = 42) as is42 \gset
\if :is42
\set fx_file `cat tests/vis_oracle/fixtures/seed-42.json 2>/dev/null || echo null`
select tests.ok_sql(format('select %L::jsonb = vis_oracle.fixture_json()', :'fx_file'),
  'VIS-11 backend/tests/vis_oracle/fixtures/seed-42.json equals vis_oracle.fixture_json() for seed 42 (regenerate it with nightly.sh --seed 42 --fixture)');
\endif
\endif

-- ======================================================================================================
-- 1. VIS-8 shape: the generated family has every case R51 and C4 name (counts only generated rows)
-- ======================================================================================================
select tests.ok_sql($$select count(*) >= 2 from public.households where tests.vo_new('household', id)$$,
  'VIS-8 shape: at least two generated households');
select tests.ok_sql($$select count(*) >= 3 from public.spaces where tests.vo_new('space', id) and deleted_at is null$$,
  'VIS-8 shape: at least three live generated families');
select tests.ok_sql($$select count(*) >= 1 from public.spaces where tests.vo_new('space', id) and deleted_at is not null$$,
  'VIS-8 shape: a deleted family (its members must see nothing in it)');
select tests.ok_sql($$select count(*) >= 12 from auth.users where tests.vo_new('user', id)$$,
  'VIS-8 shape: at least 12 generated people');
select tests.ok_sql($$select bool_and(p.display_name ~ '^(Dad|Mom|Gammy|Grandaddy|Grandmomma|Memaw|Pawpaw|Granny|Gigi|Bebar|Great-Grandma|Aunt|Uncle|Cousin)( [0-9]+)?$'
                           and u.email like '%@example.com')
                      from auth.users u join public.profiles p on p.id = u.id where tests.vo_new('user', u.id)$$,
  'VIS-8 shape: personas only (PERSONAS.md nicknames, emails at example.com)');
select tests.ok_sql($$select exists (select 1 from public.space_members a join public.space_members b on b.user_id = a.user_id and b.space_id <> a.space_id
                       where tests.vo_new('space', a.space_id) and tests.vo_new('space', b.space_id)
                         and a.role in ('owner','adult') and b.role = 'viewer')$$,
  'VIS-8 shape: a co-parent: a parent in one family who is a relative in the other');
select tests.ok_sql($$select exists (select 1 from public.circle_members a join public.circle_members b on b.user_id = a.user_id and b.circle_id <> a.circle_id
                       join public.circles ca on ca.id = a.circle_id join public.circles cb on cb.id = b.circle_id
                       where ca.space_id = cb.space_id and tests.vo_new('circle', ca.id) and tests.vo_new('circle', cb.id)
                         and ca.kind <> 'everyone' and cb.kind <> 'everyone' and ca.deleted_at is null and cb.deleted_at is null)$$,
  'VIS-8 shape: overlapping groups (someone in two groups of one family)');
select tests.ok_sql($$select exists (select 1 from public.posts p where tests.vo_new('post', p.id)
                       and not exists (select 1 from public.space_members sm where sm.space_id = p.space_id and sm.user_id = p.author_id))$$,
  'VIS-8 shape: a removed member (wrote a post, no longer in that family)');
select tests.ok_sql($$select exists (select 1 from public.posts p join public.space_members sm on sm.space_id = p.space_id and sm.user_id = p.author_id
                       join public.spaces s on s.id = p.space_id
                       where tests.vo_new('post', p.id) and sm.role = 'viewer' and not s.viewers_can_post)$$,
  'VIS-8 shape: a demoted parent (wrote posts, now a relative in a family where relatives can''t post)');
select tests.ok_sql($$select exists (select 1 from public.circle_members cm join public.post_audiences pa on pa.circle_id = cm.circle_id
                       join public.posts p on p.id = pa.post_id
                       where tests.vo_new('post', p.id) and cm.sees_from is not null and p.status = 'published'
                         and p.published_at < cm.sees_from)
                   and exists (select 1 from public.circle_members cm join public.post_audiences pa on pa.circle_id = cm.circle_id
                       join public.posts p on p.id = pa.post_id
                       where tests.vo_new('post', p.id) and cm.sees_from is not null and p.status = 'published'
                         and p.published_at >= cm.sees_from)$$,
  'VIS-8 shape: a share-history cutoff with posts on both sides of it');
select tests.ok_sql($$select count(*) filter (where deleted_at is not null) >= 1 and count(*) filter (where status = 'draft') >= 1
                       and count(*) filter (where status = 'published' and deleted_at is null) >= 40
                      from public.posts where tests.vo_new('post', id)$$,
  'VIS-8 shape: at least 40 live posts, a deleted post and a draft');
select tests.ok_sql($$select count(distinct kind) filter (where deleted_at is null and kind in ('everyone','household','event','group')) = 4
                       and count(*) filter (where deleted_at is not null) >= 1
                      from public.circles where tests.vo_new('circle', id)$$,
  'VIS-8 shape: Everyone, household, event and plain groups, and a retired group');
select tests.ok_sql($$select exists (select 1 from public.posts p where tests.vo_new('post', p.id) and p.status = 'published'
                       and exists (select 1 from public.post_audiences pa where pa.post_id = p.id)
                       and not exists (select 1 from public.post_audiences pa join public.circles c on c.id = pa.circle_id
                                       where pa.post_id = p.id and c.deleted_at is null))$$,
  'VIS-8 shape: a post sent only to a group that was retired since');
select tests.ok_sql($$select count(*) filter (where deleted_at is null) >= 10 and count(*) filter (where deleted_at is not null) >= 1
                      from public.comments where tests.vo_new('comment', id)$$,
  'VIS-8 shape: at least 10 replies and a deleted reply');
select tests.ok_sql($$select count(*) >= 10 from public.reactions where tests.vo_new('post', post_id)$$,
  'VIS-8 shape: at least 10 reactions');
select tests.ok_sql($$select count(distinct reply_audience) = 2 from public.spaces where tests.vo_new('space', id) and deleted_at is null$$,
  'VIS-8 shape: one family keeps replies with the parents, another opens them to everyone');
select tests.ok_sql($$select count(*) filter (where upload_status = 'ready') >= 1 and count(*) filter (where upload_status <> 'ready') >= 1
                      from public.media_items where tests.vo_new('media', id)$$,
  'VIS-8 shape: ready and unfinished media');
select tests.ok_sql($$select exists (select 1 from public.posts p where tests.vo_new('post', p.id) and p.status = 'published'
                       and not exists (select 1 from public.media_items m where m.post_id = p.id))$$,
  'VIS-8 shape: a words-only post (SHARE-U-4)');
select tests.ok_sql($$select count(*) filter (where member_id is not null) >= 2 and count(*) filter (where member_id is null) >= 1
                      from public.family_dates where tests.vo_new('family_date', id)$$,
  'VIS-8 shape: life-calendar birthdays and a family date with no member');
select tests.ok_sql($$select count(*) >= 2 from public.chat_groups where tests.vo_new('circle', circle_id)$$,
  'VIS-8 shape: at least two chats');
select tests.ok_sql($$select exists (select 1 from public.notification_outbox o where o.sent_at is null and o.kind = 'post'
                       and tests.vo_new('post', o.post_id)
                       and (exists (select 1 from public.push_tokens t where t.user_id = o.recipient_id)
                            or exists (select 1 from auth.users u where u.id = o.recipient_id and u.email like '%@example.com')))$$,
  'VIS-8 shape: pending notices to people who can be reached (push token or email)');

-- ======================================================================================================
-- 2. the oracle's answers (as the superuser): vis.can_see for every person x every addressable row
-- ======================================================================================================
\timing on
select clock_timestamp() as t0 \gset
\timing off
-- kinds can_see can answer: uuid id plus an item column, an owner column or a rule; server kinds answer no
create table tests.vo_kinds as
  select k.kind, k.relation::text as rel, k.reach from vis.kinds k
   where exists (select 1 from pg_attribute a where a.attrelid = k.relation and a.attname = 'id' and not a.attisdropped
                   and a.atttypid = 'uuid'::regtype)
     and ((k.reach = 'item' and k.item_column is not null) or k.reach in ('self', 'server') or k.rule_fn is not null);
create table tests.vo_rows (kind text, id uuid, primary key (kind, id));
do $$ declare k record; begin
  for k in select * from tests.vo_kinds loop
    execute format('insert into tests.vo_rows select %L, id from %s', k.kind, k.rel);
  end loop; end $$;
create table tests.vo_users as select id from auth.users;
create table tests.vo_want (u uuid, kind text, id uuid, primary key (u, kind, id));
insert into tests.vo_want select u.id, r.kind, r.id from tests.vo_users u cross join tests.vo_rows r
  where vis.can_see(u.id, r.kind, r.id);
-- read-path domains, readable by app users (ids only)
create table tests.vo_posts as select id, space_id, (status = 'published' and deleted_at is null) as listed,
  exists (select 1 from public.reactions r where r.post_id = p.id) as has_reactions from public.posts p;
create table tests.vo_spaces as select id from public.spaces;
create table tests.vo_circles as select id, space_id from public.circles;
create table tests.vo_comments as select c.id, c.post_id from public.comments c;
create table tests.vo_dates as select id from public.family_dates;
create table tests.vo_got (u uuid, kind text, path text, id uuid);
create table tests.vo_also (u uuid, what text, a uuid, b uuid);       -- post_viewers names, chat roster people, own chats
create table tests.vo_sig (u uuid, post uuid, probe text, sig text);  -- VIS-9 answers
grant select on tests.vo_kinds, tests.vo_posts, tests.vo_spaces, tests.vo_circles, tests.vo_comments, tests.vo_dates
  to authenticated;
grant insert on tests.vo_got, tests.vo_also, tests.vo_sig to authenticated;

-- ======================================================================================================
-- 3. every person reads through every path (as that person: role authenticated, their JWT sub)
-- ======================================================================================================
create function tests.vo_observe(p_me uuid) returns void language plpgsql as $f$
declare k record; s record; p record; c record; r record; v_ts timestamptz; v_id uuid; n int; ids uuid[]; v_ok boolean; j jsonb;
begin
  -- table selects under RLS, every addressable kind (a denied table reads as nothing)
  for k in select * from tests.vo_kinds loop
    begin
      execute format('insert into tests.vo_got select %L, %L, %L, id from %s', p_me, k.kind, 'table', k.rel);
    exception when insufficient_privilege then null; end;
  end loop;
  for s in select id from tests.vo_spaces loop
    -- feed (keyset pages of 50)
    v_ts := null; v_id := null;
    loop
      begin
        n := 0;
        for r in select post_id, published_at from public.get_feed(s.id, v_ts, v_id, 50) loop
          insert into tests.vo_got values (p_me, 'post', 'feed', r.post_id); v_ts := r.published_at; v_id := r.post_id; n := n + 1;
        end loop;
      exception when others then n := 0; end;
      exit when n < 50;
    end loop;
    -- timeline
    v_ts := null; v_id := null;
    loop
      begin
        n := 0;
        for r in select post_id, sort_at from public.get_timeline(s.id, v_ts, v_id, 50) loop
          insert into tests.vo_got values (p_me, 'post', 'timeline', r.post_id); v_ts := r.sort_at; v_id := r.post_id; n := n + 1;
        end loop;
      exception when others then n := 0; end;
      exit when n < 50;
    end loop;
    -- search (every date, so every post qualifies)
    v_ts := null; v_id := null;
    loop
      begin
        n := 0;
        for r in select post_id, sort_at from public.search_posts(s.id, null, null, '1900-01-01', '2200-01-01', v_ts, v_id, 50) loop
          insert into tests.vo_got values (p_me, 'post', 'search', r.post_id); v_ts := r.sort_at; v_id := r.post_id; n := n + 1;
        end loop;
      exception when others then n := 0; end;
      exit when n < 50;
    end loop;
    -- life calendar
    begin
      insert into tests.vo_got select p_me, 'family_date', 'family_dates', d.id from public.list_family_dates(s.id) d;
    exception when others then null; end;
    -- the person's own chats (the allowed side of chat_roster)
    begin
      insert into tests.vo_also select p_me, 'own_chat', l.circle_id, null from public.chat_list(s.id) l;
    exception when others then null; end;
  end loop;
  for p in select * from tests.vo_posts loop
    -- post by id, and sign-media's gate (can_view_post, then ready media under RLS)
    begin v_ok := public.can_view_post(p.id); exception when others then v_ok := false; end;
    if v_ok then
      insert into tests.vo_got values (p_me, 'post', 'post_by_id', p.id);
      insert into tests.vo_got values (p_me, 'post', 'sign_media', p.id);
      insert into tests.vo_got select p_me, 'media_item', 'sign_media', m.id from public.media_items m
        where m.post_id = p.id and m.upload_status = 'ready';
    end if;
    -- replies
    begin
      ids := array(select comment_id from public.get_comments(p.id, 1000));
      insert into tests.vo_got values (p_me, 'post', 'comments', p.id);
      insert into tests.vo_got select p_me, 'comment', 'comments', x from unnest(ids) x;
    exception when others then null; end;
    begin
      if public.reply_readers(p.id) is not null then   -- null is its "not found" (same as a post that doesn't exist)
        insert into tests.vo_got values (p_me, 'post', 'reply_readers', p.id);
      end if;
    exception when others then null; end;
  end loop;
  -- reactions, post_viewers (100 posts per call)
  for ids in select array_agg(id order by id) from (select id, (row_number() over (order by id) - 1) / 100 as g from tests.vo_posts) t group by g loop
    begin
      insert into tests.vo_got select p_me, 'post', 'reactions', x.post_id from public.reaction_summary(ids) x;
    exception when others then null; end;
    begin
      for r in select x.post_id, x.viewers from public.post_viewers(ids) x loop
        insert into tests.vo_got values (p_me, 'post', 'post_viewers', r.post_id);
        insert into tests.vo_also select p_me, 'viewer', r.post_id, (v ->> 'user_id')::uuid from jsonb_array_elements(r.viewers) v;
      end loop;
    exception when others then null; end;
  end loop;
  begin
    insert into tests.vo_got select distinct p_me, 'post', 'reactions_table', post_id from public.reactions;
  exception when others then null; end;
  begin
    insert into tests.vo_got select distinct p_me, 'post', 'post_audiences_table', post_id from public.post_audiences;
  exception when others then null; end;
  -- chat roster, every group
  for c in select * from tests.vo_circles loop
    begin
      n := 0;
      for r in select user_id from public.chat_roster(c.id) loop
        insert into tests.vo_also values (p_me, 'roster', c.id, r.user_id); n := n + 1;
      end loop;
      if n > 0 then insert into tests.vo_got values (p_me, 'circle', 'chat_roster', c.id); end if;
    exception when others then null; end;
  end loop;
  -- export
  begin
    j := public.export_my_data();
    insert into tests.vo_got select p_me, 'post', 'export', (x ->> 'id')::uuid from jsonb_array_elements(j -> 'posts') x;
    insert into tests.vo_got select p_me, 'comment', 'export', (x ->> 'id')::uuid from jsonb_array_elements(j -> 'comments') x;
    insert into tests.vo_got select p_me, 'family_date', 'export', (x ->> 'id')::uuid from jsonb_array_elements(j -> 'family_dates') x;
  exception when others then null; end;
end $f$;

-- VIS-9: one answer per probe, each run in a subtransaction that is always rolled back (no side effects)
create function tests.vo_sig1(p_sql text, p_post uuid) returns text language plpgsql as $f$
declare v text;
begin
  begin
    execute p_sql into v;
    raise exception using errcode = 'QAV09', message = coalesce(v, '<null>');
  exception when sqlstate 'QAV09' then return 'ok:' || sqlerrm;
            when others then return 'err:' || sqlstate || ':' || replace(sqlerrm, p_post::text, '<id>');
  end;
end $f$;
create function tests.vo_probe(p_me uuid, p_post uuid, p_as uuid) returns void language plpgsql as $f$
declare q record;
begin
  for q in select * from (values
      ('can_view_post',    'select public.can_view_post(%L)::text'),
      ('get_comments',     'select count(*)::text from public.get_comments(%L)'),
      ('reply_readers',    'select coalesce(array_length(public.reply_readers(%L), 1), 0)::text'),
      ('reply_scope',      'select public.reply_scope(%L)'),
      ('post_viewers',     'select count(*)::text from public.post_viewers(array[%L]::uuid[])'),
      ('reaction_summary', 'select count(*)::text from public.reaction_summary(array[%L]::uuid[])'),
      ('mark_seen',        'select public.mark_seen(%L)::text'),
      ('toggle_heart',     'select public.toggle_heart(%L)::text is not null'),
      ('set_reaction',     'select public.set_reaction(%L, ''❤️'')::text is not null'),
      ('add_comment',      'select public.add_comment(''eeeeeeee-0000-4000-8000-000000000009'', %L, ''Hi'')::text is not null'),
      ('edit_post_words',  'select public.edit_post_words(%L, null, ''Hi'')::text is not null'),
      ('delete_post',      'select public.delete_post(%L)::text'),
      ('publish_post',     'select public.publish_post(%L)::text'),
      ('set_post_audience','select public.set_post_audience(%L, ''{}''::uuid[])::text'),
      ('posts',            'select count(*)::text from public.posts where id = %L'),
      ('media_items',      'select count(*)::text from public.media_items where post_id = %L'),
      ('comments',         'select count(*)::text from public.comments where post_id = %L'),
      ('reactions',        'select count(*)::text from public.reactions where post_id = %L'),
      ('post_audiences',   'select count(*)::text from public.post_audiences where post_id = %L')) t(probe, sql) loop
    insert into tests.vo_sig values (p_me, p_as, q.probe, tests.vo_sig1(format(q.sql, p_post), p_post));
  end loop;
end $f$;
create function tests.vo_probe_all(p_me uuid, p_hidden uuid[]) returns void language plpgsql as $f$
declare x uuid;
begin
  perform tests.vo_probe(p_me, 'ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid, null);          -- the post that doesn't exist
  foreach x in array p_hidden loop perform tests.vo_probe(p_me, x, x); end loop;
end $f$;
grant execute on all functions in schema tests to authenticated;

-- run every person (psql: one statement list per person)
:as_admin
\o /dev/null
select format($s$reset role; select set_config('request.jwt.claim.sub', %L, false); set role authenticated;
                 select tests.vo_observe(%L); select tests.vo_probe_all(%L, %L::uuid[]); reset role;$s$,
              u.id, u.id, u.id,
              array(select p.id from tests.vo_posts p
                     where not exists (select 1 from tests.vo_want w where w.u = u.id and w.kind = 'post' and w.id = p.id)
                     order by p.id))
  from tests.vo_users u order by u.id \gexec
:as_admin

-- ======================================================================================================
-- 4. VIS-8 compare every path with the oracle (both directions unless the path is one-way by design)
-- ======================================================================================================
-- tests.vo_cmp(path, kind, u, id, want, got): one row per checked pair
create table tests.vo_cmp (path text, kind text, u uuid, id uuid, want boolean, got boolean);
create function tests.vo_w(p_u uuid, p_kind text, p_id uuid) returns boolean language sql stable as $$
  select exists (select 1 from tests.vo_want w where w.u = p_u and w.kind = p_kind and w.id = p_id) $$;
create function tests.vo_g(p_u uuid, p_kind text, p_path text, p_id uuid) returns boolean language sql stable as $$
  select exists (select 1 from tests.vo_got g where g.u = p_u and g.kind = p_kind and g.path = p_path and g.id = p_id) $$;
-- table selects: every addressable row of every kind
insert into tests.vo_cmp select 'table', r.kind, u.id, r.id, tests.vo_w(u.id, r.kind, r.id), tests.vo_g(u.id, r.kind, 'table', r.id)
  from tests.vo_users u cross join tests.vo_rows r;
-- list paths: live published posts
insert into tests.vo_cmp select x.path, 'post', u.id, p.id, tests.vo_w(u.id, 'post', p.id), tests.vo_g(u.id, 'post', x.path, p.id)
  from tests.vo_users u cross join tests.vo_posts p cross join (values ('feed'), ('timeline'), ('search'), ('comments'),
       ('reply_readers'), ('post_viewers')) x(path)
 where p.listed;
insert into tests.vo_cmp select 'reactions', 'post', u.id, p.id, tests.vo_w(u.id, 'post', p.id), tests.vo_g(u.id, 'post', 'reactions', p.id)
  from tests.vo_users u cross join tests.vo_posts p where p.listed and p.has_reactions;
-- reaction and audience rows are narrowed further (reactions follow the reply rules, audiences show only your
-- own groups), so these two are one-way: any row you read must be on a post can_see lets you see (wrong yes)
insert into tests.vo_cmp select g.path, 'post', g.u, g.id, tests.vo_w(g.u, 'post', g.id), true
  from tests.vo_got g where g.path in ('reactions_table', 'post_audiences_table');
-- by-id paths: every post (drafts, deleted, other families)
insert into tests.vo_cmp select x.path, 'post', u.id, p.id, tests.vo_w(u.id, 'post', p.id), tests.vo_g(u.id, 'post', x.path, p.id)
  from tests.vo_users u cross join tests.vo_posts p cross join (values ('post_by_id'), ('sign_media')) x(path);
insert into tests.vo_cmp select 'sign_media', 'media_item', u.id, m.id, tests.vo_w(u.id, 'media_item', m.id), tests.vo_g(u.id, 'media_item', 'sign_media', m.id)
  from tests.vo_users u cross join public.media_items m where m.upload_status = 'ready';
-- replies, one by one, on live posts
insert into tests.vo_cmp select 'comments', 'comment', u.id, c.id, tests.vo_w(u.id, 'comment', c.id), tests.vo_g(u.id, 'comment', 'comments', c.id)
  from tests.vo_users u cross join tests.vo_comments c join tests.vo_posts p on p.id = c.post_id and p.listed;
-- life calendar
insert into tests.vo_cmp select 'family_dates', 'family_date', u.id, d.id, tests.vo_w(u.id, 'family_date', d.id), tests.vo_g(u.id, 'family_date', 'family_dates', d.id)
  from tests.vo_users u cross join tests.vo_dates d;
-- post_viewers' names: the people it names for a post are exactly the people can_see lets see it
insert into tests.vo_cmp select 'post_viewers:names', 'post', v.id, a.post, tests.vo_w(v.id, 'post', a.post),
       exists (select 1 from tests.vo_also n where n.what = 'viewer' and n.a = a.post and n.b = v.id)
  from (select distinct a as post from tests.vo_also where what = 'viewer') a cross join tests.vo_users v;
-- chat roster: chats are not a vis kind with a rule (chat_group has none; the circle rule hides plain group names
-- from relatives, which chats don't), so the chat side is held to the person's own chat list, both ways: a roster
-- opens for exactly the chats chat_list shows you. The people it lists must be people you may see (next check).
insert into tests.vo_cmp select 'chat_roster', 'chat_group', u.id, c.id,
       exists (select 1 from tests.vo_also o where o.what = 'own_chat' and o.u = u.id and o.a = c.id),
       tests.vo_g(u.id, 'circle', 'chat_roster', c.id)
  from tests.vo_users u cross join tests.vo_circles c;
insert into tests.vo_cmp select distinct 'chat_roster:people', 'profile', r.u, r.b, tests.vo_w(r.u, 'profile', r.b), true
  from tests.vo_also r where r.what = 'roster';
-- export: one-way by design (your own data); anything else in it must be something can_see lets you see
insert into tests.vo_cmp select 'export', g.kind, g.u, g.id,
       case g.kind when 'post' then exists (select 1 from public.posts p where p.id = g.id and p.author_id = g.u)
                   when 'comment' then exists (select 1 from public.comments c where c.id = g.id and c.author_id = g.u)
                   when 'family_date' then exists (select 1 from public.family_dates d where d.id = g.id and d.member_id = g.u)
                                           or tests.vo_w(g.u, 'family_date', g.id) end,
       true
  from tests.vo_got g where g.path = 'export';
-- other people's posts and replies never ride along in your export (they must be checked, not just absent)
insert into tests.vo_cmp select 'export', 'post', u.id, p.id, false, tests.vo_g(u.id, 'post', 'export', p.id)
  from tests.vo_users u cross join public.posts p where p.author_id <> u.id;

create table tests.vo_matrix as
  select path, kind, count(*) as checked, count(*) filter (where got and not want) as wrong_yes,
         count(*) filter (where want and not got) as wrong_no
    from tests.vo_cmp group by path, kind;
-- the paths R51 and C4 name: each must have been checked, and checked against both answers where it is two-way
select tests.ok_sql(format($q$select coalesce((select checked > 0 and wrong_yes = 0 and wrong_no = 0 from tests.vo_matrix where path = %L and kind = %L), false)$q$, x.path, x.kind),
                    format('VIS-8 %s (%s) equals vis.can_see for every person: %s', x.path, x.kind,
                           coalesce((select format('%s pairs, %s wrong yes (P0), %s wrong no (P1)', checked, wrong_yes, wrong_no)
                                       from tests.vo_matrix m where m.path = x.path and m.kind = x.kind), 'never checked')))
  from (values ('table','post'), ('table','comment'), ('table','media_item'), ('table','profile'),
               ('table','circle'), ('table','space'), ('table','family_date'), ('table','notification_outbox'),
               ('post_audiences_table','post'), ('feed','post'), ('timeline','post'), ('search','post'), ('post_by_id','post'), ('comments','post'),
               ('comments','comment'), ('reply_readers','post'), ('reactions','post'), ('reactions_table','post'),
               ('post_viewers','post'), ('post_viewers:names','post'), ('sign_media','post'), ('sign_media','media_item'),
               ('family_dates','family_date'), ('chat_roster','chat_group'), ('chat_roster:people','profile'),
               ('export','post'), ('export','comment')) x(path, kind);
-- every other kind the table path reached
select tests.ok_sql(format($q$select wrong_yes = 0 and wrong_no = 0 from tests.vo_matrix where path = 'table' and kind = %L$q$, m.kind),
                    format('VIS-8 table (%s) equals vis.can_see for every person: %s pairs, %s wrong yes (P0), %s wrong no (P1)',
                           m.kind, m.checked, m.wrong_yes, m.wrong_no))
  from tests.vo_matrix m
 where m.path = 'table' and m.kind not in ('post','comment','media_item','post_audience','profile','circle','space','family_date','notification_outbox')
 order by m.kind;
-- both directions really happen: each two-way path has someone it lets in and someone it keeps out
select tests.ok_sql(format($q$select count(*) filter (where want) > 0 and count(*) filter (where not want) > 0 from tests.vo_cmp where path = %L$q$, x.path),
                    'VIS-8 ' || x.path || ' was checked both ways (someone allowed, someone excluded)')
  from (values ('feed'), ('timeline'), ('search'), ('post_by_id'), ('comments'), ('post_viewers'), ('sign_media'),
               ('family_dates'), ('chat_roster')) x(path);

-- ======================================================================================================
-- 5. VIS-9 invisible == nonexistent: every hidden post answers every probe exactly as a post that doesn't exist
-- ======================================================================================================
create table tests.vo_vis9 as
  select h.u, h.probe, h.post, h.sig, g.sig as ghost_sig
    from tests.vo_sig h join tests.vo_sig g on g.u = h.u and g.probe = h.probe and g.post is null
   where h.post is not null;
select tests.ok_sql(format($q$select count(*) > 0 and count(*) filter (where sig is distinct from ghost_sig) = 0 from tests.vo_vis9 where probe = %L$q$, x.probe),
                    format('VIS-9 %s: a post you can''t see answers like one that doesn''t exist (%s)', x.probe,
                           coalesce((select format('%s hidden pairs, %s differ', count(*), count(*) filter (where sig is distinct from ghost_sig))
                                       from tests.vo_vis9 v where v.probe = x.probe), 'never checked')))
  from (values ('can_view_post'), ('get_comments'), ('reply_readers'), ('reply_scope'), ('post_viewers'), ('reaction_summary'),
               ('mark_seen'), ('toggle_heart'), ('set_reaction'), ('add_comment'), ('edit_post_words'), ('delete_post'),
               ('publish_post'), ('set_post_audience'), ('posts'), ('media_items'), ('comments'), ('reactions'),
               ('post_audiences')) x(probe);
-- the ghost really reads as "not found" or empty on the by-id RPCs (so "same as ghost" means hidden, not broken)
select tests.ok_sql($q$select bool_and(sig in ('ok:false', 'ok:0') or sig like 'err:P0002:%') from tests.vo_sig
                       where post is null and probe in ('can_view_post', 'get_comments', 'post_viewers', 'reaction_summary', 'posts')$q$,
  'VIS-9 a post that doesn''t exist reads as P0002, false or empty for every person');

-- ======================================================================================================
-- 6. VIS-10 notices: every recipient passes can_see when the notice is sent, not only when it was written
-- ======================================================================================================
:as_admin
-- then, before the send, take access away from up to 3 relatives with a pending notice
create table tests.vo_revoked as
  select distinct on (o.recipient_id) o.recipient_id as u, o.post_id as post
    from public.notification_outbox o
    join public.posts p on p.id = o.post_id
    join public.space_members sm on sm.space_id = p.space_id and sm.user_id = o.recipient_id and sm.role = 'viewer'
   where o.sent_at is null and o.kind = 'post' and o.recipient_id <> p.author_id
   order by o.recipient_id, o.post_id
   limit 3;
delete from public.circle_members cm using tests.vo_revoked r, public.post_audiences pa
 where pa.post_id = r.post and cm.circle_id = pa.circle_id and cm.user_id = r.u;
select tests.ok_sql($q$select count(*) > 0 and bool_and(not vis.can_see(u, 'post', post)) from tests.vo_revoked$q$,
  'VIS-10 setup: relatives taken out of a post''s groups after the notice was written can no longer see it');
-- and delete one post that still has pending notices
create table tests.vo_gone as
  select o.post_id as post from public.notification_outbox o
   where o.sent_at is null and o.kind = 'post' and o.post_id not in (select post from tests.vo_revoked)
   order by o.post_id limit 1;
update public.posts set deleted_at = now() where id in (select post from tests.vo_gone);
create table tests.vo_sent as select * from public.claim_notification_batches(now() + interval '2 days');
create table tests.vo_sent_pairs as select s.recipient_id as u, x as post from tests.vo_sent s, unnest(s.post_ids) x;
select tests.ok_sql($q$select count(*) > 0 from tests.vo_sent_pairs$q$,
  'VIS-10 the send claimed notices (the check below is not vacuous)');
select tests.ok_sql($q$select bool_and(vis.can_see(u, 'post', post)) from tests.vo_sent_pairs$q$,
  'VIS-10 every notice sent (new posts, replies, reactions) names only posts its recipient can see at send time');
select tests.ok_sql($q$select not exists (select 1 from tests.vo_sent_pairs s join tests.vo_revoked r on r.u = s.u and r.post = s.post)
                       and not exists (select 1 from tests.vo_sent_pairs s join tests.vo_gone g on g.post = s.post)$q$,
  'VIS-10 a relative removed before the send, and a post deleted before the send, get no notice');

select extract(epoch from clock_timestamp() - :'t0'::timestamptz)::int as vo_secs \gset

-- ---------- matrix and mismatches (for the nightly job and for whoever reads a red run) ----------
\o
\echo
\echo VIS ORACLE MATRIX seed=:vo_seed seconds=:vo_secs
\pset format aligned
select path, kind, checked, wrong_yes, wrong_no from tests.vo_matrix order by path, kind;
\echo VIS ORACLE MISMATCHES (first 50: user, kind, path, id)
select u as "user", kind, path, id, case when got then 'wrong yes (P0)' else 'wrong no (P1)' end as mismatch
  from tests.vo_cmp where want is distinct from got order by got desc, path, kind, u, id limit 50;
\echo VIS-9 DIFFERENCES (first 30: user, probe, hidden post answer vs missing post answer)
select u as "user", probe, post, sig, ghost_sig from tests.vo_vis9 where sig is distinct from ghost_sig order by probe, u, post limit 30;
\o /dev/null

\else
-- generator missing: say so once per criterion, so the red names every check that can't run yet
select tests.ok(false, 'VIS-8 every person x every item x every path equals vis.can_see: not run, generator missing (tests/vis_oracle/generate.sql)');
select tests.ok(false, 'VIS-9 invisible == nonexistent on every path: not run, generator missing');
select tests.ok(false, 'VIS-10 notice recipients pass can_see at send time: not run, generator missing');
select tests.ok(false, 'VIS-11 committed seed-42 fixture equals fixture_json(): not run, generator missing');
\endif

-- ---------- report ----------
\o
\pset format aligned
select n, case when ok then 'ok' else 'NOT OK' end as result, description from tests.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tests.results \gset
\echo
\echo VIS ORACLE RESULT: :passed passed, :failed failed
select :failed = 0 as all_ok \gset
\if :all_ok
\else
  \echo SOME TESTS FAILED
  select 1/0 as force_nonzero_exit;
\endif
