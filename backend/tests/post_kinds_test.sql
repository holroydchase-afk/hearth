-- SHARE-U-4, SHARE-U-5, SHARE-U-11..16 (docs/product/SPEC-VISIBILITY-CORE.md "One Share composer", Phase 4):
-- saving News, Event and Saying posts. Backend + API first; the composer UI comes later (on PR #174's ShareKinds.tsx).
-- Written FIRST (Nov 24, 2026, qa-tdd): red until migration 0034 lands.
--
-- The contract these tests fix (engineer: build 0034 to this; API.md gets the same section):
--   posts.kind text not null default 'photos', check in ('photos','news','event','saying'). Existing posts are photos.
--   create_post gains two trailing args, both defaulted so every older app build keeps working:
--       p_kind text default 'photos', p_details jsonb default null
--     photos  p_details must be null (else 23514). Unchanged otherwise (media, publish rules as today).
--     news    words required: p_caption trimmed non-empty (else 23514); p_details null (else 23514); never any media.
--     event   p_details {"what": text (required), "when": "YYYY-MM-DD" (required, a real date), "where": text (optional)}
--             -> one row in public.post_events (id uuid, post_id uuid, ...). Missing or blank what/when, or a when
--             that isn't a date: 23514.
--     saying  p_details {"words": text (required), "who": text (required), "age": integer 0..120 (optional)}
--             -> one row in public.post_sayings (id uuid, post_id uuid, ...). Missing words/who, or a bad age: 23514.
--     unknown kind: 23514. One post, one audience: at least one group, same checks as today (23514 / 42501).
--     Idempotent on (author, p_client_id) as today: a retry returns the same post and writes no second child row.
--   Who: news/event/saying only for parents (owner/adult) AND only while feature 'post_kinds' is on
--     (private.feature_on: Hearth's global switch AND the family's switch AND a parent; off by default, a missing row
--     is off). Otherwise 42501 with message 'post_kinds_off' (like 'video_posting_off'); photos are never affected.
--     my_features(space) lists 'post_kinds' exactly when it is on for the caller.
--   No media on a news, event or saying post: prepare_media_upload on one is 23514; a direct media insert is refused.
--   publish_post publishes a news/event/saying draft with no media; a photos draft still needs ready media (23514).
--   Reads: get_feed, get_timeline and search_posts rows gain `kind text`. The event and saying fields are read by the
--     app from public.post_events / public.post_sayings under RLS. Both tables are attached with vis.attach as
--     item kinds of the post (item_column post_id): NO new visibility rule, no rule_fn, no hook, no app writes.
--   export_my_data: the author's own event and saying fields are in their export; nobody else's ever are.
--
-- Seed: space A (Alex's). Alex owner; Grandma Rivera (ma) and Grandpa Rivera (pa) in "Grandparents – Dad's side";
-- Blair (co-parent, viewer, "Co-parent" group), Aunt Jo and Grandma Chen viewers in Everyone only.
-- Every post below goes to "Grandparents – Dad's side": ma is the allowed person, chen and blair the excluded ones.
\set ON_ERROR_STOP 1
\pset footer off
\ir harness.sql

\set as_admin 'reset role; select set_config(''request.jwt.claim.sub'', '''', false);'
\set as_alex  'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-00000000000a'', false);'
\set as_blair 'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''b0000000-0000-0000-0000-00000000000b'', false);'
\set as_ma    'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-0000000000a1'', false);'
\set as_chen  'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''b0000000-0000-0000-0000-0000000000b1'', false);'
\set as_jo    'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''c0000000-0000-0000-0000-0000000000c1'', false);'
\set sa       '''22222222-0000-0000-0000-00000000000a'''
\set gp       '''33333333-0000-0000-0000-0000000000a1'''
\set every    '''33333333-0000-0000-0000-0000000000a0'''

:as_admin
-- seed.sql predates 0011's container kinds (same fix as family_dates_test.sql)
update public.circles set kind = 'everyone'
 where id in ('33333333-0000-0000-0000-0000000000a0', '33333333-0000-0000-0000-0000000000b0');
-- make sure no earlier row turned the switch on: off by default
delete from private.feature_flags where feature = 'post_kinds';
delete from public.space_features where feature = 'post_kinds';

-- tests.mk(kind, caption, details, circles, client) : create_post as the current user with the new args
create function tests.mk(p_kind text, p_caption text, p_details jsonb, p_circles uuid[] default array['33333333-0000-0000-0000-0000000000a1']::uuid[],
                         p_client uuid default gen_random_uuid()) returns uuid language plpgsql as $$
begin   -- plpgsql binds late, so this helper exists (and every check fails for the right reason) before 0034
  return public.create_post(p_client_id => p_client, p_space => '22222222-0000-0000-0000-00000000000a', p_caption => p_caption,
                            p_circle_ids => p_circles, p_kind => p_kind, p_details => p_details);
end $$;
-- the message of an error, or 'none'
create function tests.errmsg(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return 'none'; exception when others then return sqlstate || ' ' || sqlerrm; end $$;
grant execute on all functions in schema tests to authenticated;

-- ======================================================================================================
-- SHARE-U-12 the new kinds are off by default (feature post_kinds), photos never are
-- ======================================================================================================
:as_alex
select tests.ok_sql(format($$select not exists (select 1 from public.my_features(%L) f where f.feature = 'post_kinds')$$, :sa),
  'SHARE-U-12 my_features never lists post_kinds while no switch row exists (off by default)');
select tests.ok(tests.errmsg($$select tests.mk('news', 'Gammy is coming for Thanksgiving!', null)$$) like '42501 %post_kinds_off%',
  'SHARE-U-12 with post_kinds off, the owner''s news post is refused 42501 post_kinds_off  [' ||
  tests.errmsg($$select tests.mk('news', 'Gammy is coming for Thanksgiving!', null)$$) || ']');
select tests.throws_code($$select tests.mk('event', null, '{"what":"Pawpaw''s birthday picnic","when":"2026-12-12"}')$$,
  'SHARE-U-12 with post_kinds off, an event is refused (42501)', '42501');
select tests.throws_code($$select tests.mk('saying', null, '{"words":"Your hair went on vacation","who":"Mia"}')$$,
  'SHARE-U-12 with post_kinds off, a saying is refused (42501)', '42501');
select tests.lives($$select tests.mk('photos', 'Pumpkin patch', null)$$,
  'SHARE-U-12 with post_kinds off, a photos post (p_kind photos) is still created');
select tests.lives($$select public.create_post(gen_random_uuid(), '22222222-0000-0000-0000-00000000000a', 'Old app build',
                                               array['33333333-0000-0000-0000-0000000000a1']::uuid[])$$,
  'SHARE-U-12 an older app build (no p_kind, no p_details) still creates a post');
:as_admin
select tests.ok_sql($$select count(*) = 0 from public.posts where caption = 'Old app build' and kind <> 'photos'$$,
  'SHARE-U-12 a post made without p_kind is kind photos');
select tests.ok_sql($$select count(*) = 0 from public.posts where kind is distinct from 'photos' and caption in
                       ('Sam''s first bike ride (Dad''s side grandparents only)', 'Soccer game! (everyone)')$$,
  'SHARE-U-12 every existing post is kind photos after the migration');

-- the family switch alone, then the global switch alone, are not enough
insert into public.space_features (space_id, feature, enabled) values (:sa, 'post_kinds', true);
:as_alex
select tests.throws_code($$select tests.mk('news', 'Family switch only', null)$$,
  'SHARE-U-12 the family switch on but Hearth''s global switch missing: still refused (42501)', '42501');
:as_admin
delete from public.space_features where feature = 'post_kinds';
insert into private.feature_flags (feature, enabled) values ('post_kinds', true);
:as_alex
select tests.throws_code($$select tests.mk('news', 'Global switch only', null)$$,
  'SHARE-U-12 Hearth''s global switch on but the family''s off: still refused (42501)', '42501');
:as_admin
insert into public.space_features (space_id, feature, enabled) values (:sa, 'post_kinds', true);

:as_alex
select tests.ok_sql(format($$select exists (select 1 from public.my_features(%L) f where f.feature = 'post_kinds')$$, :sa),
  'SHARE-U-12 both switches on: my_features lists post_kinds for the owner');
:as_ma
select tests.ok_sql(format($$select not exists (select 1 from public.my_features(%L) f where f.feature = 'post_kinds')$$, :sa),
  'SHARE-U-12 ...and never for a relative (parents only)');

-- ======================================================================================================
-- SHARE-U-4 news: words, no media, one audience
-- ======================================================================================================
:as_alex
select tests.setv('news', $$select tests.mk('news', '  Gammy is coming for Thanksgiving!  ', null)$$);
select tests.ok(tests.v('news') is not null, 'SHARE-U-4 the owner creates a news post (words only) for one group');
select tests.lives(format('select public.publish_post(%L)', tests.v('news')),
  'SHARE-U-4 a news post publishes with no media');
select tests.throws_code($$select tests.mk('news', '   ', null)$$, 'SHARE-U-4 news with blank words is refused (23514)', '23514');
select tests.throws_code($$select tests.mk('news', null, null)$$, 'SHARE-U-4 news with no words is refused (23514)', '23514');
select tests.throws_code($$select tests.mk('news', 'Big news', null, '{}'::uuid[])$$,
  'SHARE-U-4 news with no audience is refused (23514, one post one audience)', '23514');
select tests.throws_code($$select tests.mk('news', 'Big news', '{"what":"x","when":"2026-12-12"}')$$,
  'SHARE-U-4 news with event fields is refused (23514)', '23514');
select tests.setv('news_draft', $$select tests.mk('news', 'A news draft', null)$$);
select tests.throws_code(format($q$select count(*) from public.prepare_media_upload(%L, '[{"kind":"photo","mime_type":"image/jpeg","width":4,"height":3,"byte_size":100,"thumb_byte_size":10,"exif_stripped":true}]'::jsonb)$q$,
                                tests.v('news_draft')),
  'SHARE-U-4 news with media: prepare_media_upload on a news post is refused (23514)', '23514');
select tests.throws_any(format($q$insert into public.media_items (post_id, space_id, uploader_id, position, kind, mime_type, display_key, thumb_key,
                                    width, height, byte_size, thumb_byte_size, exif_stripped)
                                  values (%L, '00000000-0000-0000-0000-000000000000', auth.uid(), 0, 'photo', 'image/jpeg', 'p', 'p', 4, 3, 100, 10, true)$q$,
                               tests.v('news_draft')),
  'SHARE-U-4 news with media: a direct media insert on a news post is refused', array['23514', '42501']);
:as_admin
select tests.ok_sql(format($$select kind = 'news' and status = 'published' and caption = 'Gammy is coming for Thanksgiving!'
                               and not exists (select 1 from public.media_items m where m.post_id = p.id)
                               and (select array_agg(circle_id::text) from public.post_audiences where post_id = p.id) = array[%L]
                              from public.posts p where p.id = %L$$, '33333333-0000-0000-0000-0000000000a1', tests.v('news')),
  'SHARE-U-4 stored as posts.kind news, words trimmed, no media, its one audience');
select tests.ok_sql($$select count(*) = 0 from public.media_items m join public.posts p on p.id = m.post_id where p.kind in ('news','event','saying')$$,
  'SHARE-U-4 no news, event or saying post has any media row');
:as_alex
select tests.setv('photo_draft', $$select tests.mk('photos', 'Photos still need photos', null)$$);
select tests.throws_code(format('select public.publish_post(%L)', tests.v('photo_draft')),
  'SHARE-U-4 a photos draft with no media still can''t be published (23514)', '23514');
select tests.throws_code($$select tests.mk('photos', 'Photos with fields', '{"words":"x","who":"Mia"}')$$,
  'SHARE-U-4 a photos post with kind fields is refused (23514)', '23514');
select tests.throws_code($$select tests.mk('poll', 'Which pie?', null)$$, 'SHARE-U-4 an unknown kind is refused (23514)', '23514');

-- ======================================================================================================
-- SHARE-U-11 event: what's happening, when, where (optional)
-- ======================================================================================================
select tests.setv('event', $$select tests.mk('event', null,
  '{"what":"Pawpaw''s 80th birthday picnic","when":"2026-12-12","where":"the church hall"}')$$);
select tests.ok(tests.v('event') is not null, 'SHARE-U-11 the owner creates an event (what, when, where) for one group');
select tests.lives(format('select public.publish_post(%L)', tests.v('event')), 'SHARE-U-11 an event publishes with no media');
select tests.setv('event_nowhere', $$select tests.mk('event', null, '{"what":"Gammy''s pie night","when":"2026-11-27"}')$$);
select tests.ok(tests.v('event_nowhere') is not null, 'SHARE-U-11 where is optional');
select tests.throws_code($$select tests.mk('event', null, '{"what":"Pie night"}')$$, 'SHARE-U-11 an event without when is refused (23514)', '23514');
select tests.throws_code($$select tests.mk('event', null, '{"what":"Pie night","when":""}')$$, 'SHARE-U-11 an event with a blank when is refused (23514)', '23514');
select tests.throws_code($$select tests.mk('event', null, '{"what":"Pie night","when":"soon"}')$$, 'SHARE-U-11 an event whose when isn''t a date is refused (23514)', '23514');
select tests.throws_code($$select tests.mk('event', null, '{"when":"2026-11-27"}')$$, 'SHARE-U-11 an event without what is refused (23514)', '23514');
select tests.throws_code($$select tests.mk('event', null, '{"what":"   ","when":"2026-11-27"}')$$, 'SHARE-U-11 an event with blank what is refused (23514)', '23514');
select tests.throws_code($$select tests.mk('event', null, null)$$, 'SHARE-U-11 an event with no fields is refused (23514)', '23514');
-- idempotent: a retry returns the same post and writes no second event row
select tests.setv('evt_client', $$select gen_random_uuid()$$);
select tests.setv('evt_a', format($$select tests.mk('event', null, '{"what":"Retry picnic","when":"2026-12-13"}', array[%L]::uuid[], %L)$$,
                                  '33333333-0000-0000-0000-0000000000a1', tests.v('evt_client')));
select tests.setv('evt_b', format($$select tests.mk('event', null, '{"what":"Retry picnic","when":"2026-12-13"}', array[%L]::uuid[], %L)$$,
                                  '33333333-0000-0000-0000-0000000000a1', tests.v('evt_client')));
select tests.ok(tests.v('evt_a') is not null and tests.v('evt_a') = tests.v('evt_b'), 'SHARE-U-11 an event retry with the same client id returns the same post');
:as_admin
select tests.ok_sql(format($$select count(*) = 1 from public.post_events where post_id = %L$$, tests.v('evt_a')),
  'SHARE-U-11 ...and writes one event row, not two');
select tests.ok_sql(format($$select p.kind = 'event' and (select count(*) from public.post_events e where e.post_id = p.id) = 1
                               and (select bool_and(to_jsonb(e)::text like '%%Pawpaw''s 80th birthday picnic%%' and to_jsonb(e)::text like '%%2026-12-12%%'
                                                    and to_jsonb(e)::text like '%%the church hall%%') from public.post_events e where e.post_id = p.id)
                              from public.posts p where p.id = %L$$, tests.v('event')),
  'SHARE-U-11 stored as posts.kind event plus one post_events row with what, when and where');

-- ======================================================================================================
-- SHARE-U-13 saying: what they said, who said it, age (optional)
-- ======================================================================================================
:as_alex
select tests.setv('saying', $$select tests.mk('saying', null, '{"words":"Pawpaw, your hair went on vacation","who":"Mia","age":4}')$$);
select tests.ok(tests.v('saying') is not null, 'SHARE-U-13 the owner creates a saying (words, who, age) for one group');
select tests.lives(format('select public.publish_post(%L)', tests.v('saying')), 'SHARE-U-13 a saying publishes with no media');
select tests.setv('saying_noage', $$select tests.mk('saying', null, '{"words":"I want the crunchy water","who":"Mia"}')$$);
select tests.ok(tests.v('saying_noage') is not null, 'SHARE-U-13 age is optional');
select tests.throws_code($$select tests.mk('saying', null, '{"who":"Mia","age":4}')$$, 'SHARE-U-13 a saying without words is refused (23514)', '23514');
select tests.throws_code($$select tests.mk('saying', null, '{"words":"  ","who":"Mia"}')$$, 'SHARE-U-13 a saying with blank words is refused (23514)', '23514');
select tests.throws_code($$select tests.mk('saying', null, '{"words":"Crunchy water"}')$$, 'SHARE-U-13 a saying without who is refused (23514)', '23514');
select tests.throws_code($$select tests.mk('saying', null, '{"words":"Crunchy water","who":" "}')$$, 'SHARE-U-13 a saying with blank who is refused (23514)', '23514');
select tests.throws_code($$select tests.mk('saying', null, '{"words":"Crunchy water","who":"Mia","age":-1}')$$, 'SHARE-U-13 a negative age is refused (23514)', '23514');
select tests.throws_code($$select tests.mk('saying', null, '{"words":"Crunchy water","who":"Mia","age":200}')$$, 'SHARE-U-13 an age over 120 is refused (23514)', '23514');
select tests.throws_code($$select tests.mk('saying', null, '{"words":"Crunchy water","who":"Mia","age":"four"}')$$, 'SHARE-U-13 an age that isn''t a number is refused (23514)', '23514');
:as_admin
select tests.ok_sql(format($$select p.kind = 'saying' and (select count(*) from public.post_sayings s where s.post_id = p.id) = 1
                               and (select bool_and(to_jsonb(s)::text like '%%Pawpaw, your hair went on vacation%%' and to_jsonb(s)::text like '%%Mia%%')
                                      from public.post_sayings s where s.post_id = p.id)
                              from public.posts p where p.id = %L$$, tests.v('saying')),
  'SHARE-U-13 stored as posts.kind saying plus one post_sayings row with the words and who said it');

-- ======================================================================================================
-- SHARE-U-15 no new visibility rule: both child tables are vis.attach item kinds of the post (VIS-19)
-- ======================================================================================================
select tests.ok_sql($$select count(*) = 2 and bool_and(k.reach = 'item' and k.item_column = 'post_id' and k.rule_fn is null and k.narrow_fn is null)
                      from vis.kinds k where k.relation in (to_regclass('public.post_events'), to_regclass('public.post_sayings'))$$,
  'SHARE-U-15 post_events and post_sayings are registered as item kinds on post_id, with no rule and no hook (no new visibility rule)');
select tests.ok_sql($$select bool_and(c.relrowsecurity and c.relforcerowsecurity) and count(*) = 2
                      from pg_class c where c.oid in (to_regclass('public.post_events'), to_regclass('public.post_sayings'))$$,
  'SHARE-U-15 RLS is on and forced on both');
select tests.ok_sql($$select count(*) = 2 and bool_and(pol.policyname = 'vis_select' and pol.qual like '%vis.viewer_sees_item(post_id)%')
                      from pg_policies pol where pol.schemaname = 'public' and pol.tablename in ('post_events', 'post_sayings')
                       and pol.permissive = 'PERMISSIVE' and pol.cmd in ('SELECT', 'ALL')$$,
  'SHARE-U-15 each has exactly one permissive read policy, vis.attach''s (the post''s own rule)');
select tests.ok_sql($$select not (has_table_privilege('authenticated', 'public.post_events', 'INSERT') or has_table_privilege('authenticated', 'public.post_events', 'UPDATE')
                           or has_table_privilege('authenticated', 'public.post_events', 'DELETE') or has_table_privilege('authenticated', 'public.post_sayings', 'INSERT')
                           or has_table_privilege('authenticated', 'public.post_sayings', 'UPDATE') or has_table_privilege('authenticated', 'public.post_sayings', 'DELETE')
                           or has_table_privilege('anon', 'public.post_events', 'SELECT') or has_table_privilege('anon', 'public.post_sayings', 'SELECT'))$$,
  'SHARE-U-15 app users can''t write either table (create_post only), and anon can''t read them');
-- the oracle: for every person in the seed x every event and saying row, can_see equals what RLS returns to them
select (to_regclass('public.post_events') is not null and to_regclass('public.post_sayings') is not null) as have_children \gset
\if :have_children
create table tests.child_rows as
  select k.kind, e.id, e.post_id from vis.kinds k cross join lateral (select id, post_id from public.post_events) e where k.relation = to_regclass('public.post_events')
  union all
  select k.kind, s.id, s.post_id from vis.kinds k cross join lateral (select id, post_id from public.post_sayings) s where k.relation = to_regclass('public.post_sayings');
create table tests.child_want as select u.id as u, r.kind, r.id from auth.users u cross join tests.child_rows r where vis.can_see(u.id, r.kind, r.id);
create table tests.child_got (u uuid, kind text, id uuid);
grant select on tests.child_rows to authenticated;
grant insert on tests.child_got to authenticated;
create function tests.child_observe(p_me uuid) returns void language plpgsql as $f$
begin
  begin insert into tests.child_got select p_me, r.kind, e.id from public.post_events e join tests.child_rows r on r.id = e.id; exception when others then null; end;
  begin insert into tests.child_got select p_me, r.kind, s.id from public.post_sayings s join tests.child_rows r on r.id = s.id; exception when others then null; end;
end $f$;
grant execute on function tests.child_observe(uuid) to authenticated;
\o /dev/null
select format($s$reset role; select set_config('request.jwt.claim.sub', %L, false); set role authenticated; select tests.child_observe(%L); reset role;$s$, id, id)
  from auth.users order by id \gexec
:as_admin
select tests.ok_sql($$select count(*) >= 4 from tests.child_rows$$, 'SHARE-U-15 oracle setup: event and saying rows exist to check');
select tests.ok_sql($$select not exists (select 1 from tests.child_got g where not exists (select 1 from tests.child_want w where w.u = g.u and w.id = g.id))
                         and not exists (select 1 from tests.child_want w where not exists (select 1 from tests.child_got g where g.u = w.u and g.id = w.id))
                         and exists (select 1 from tests.child_want)
                         and exists (select 1 from auth.users u cross join tests.child_rows r where not vis.can_see(u.id, r.kind, r.id))$$,
  'SHARE-U-15 VIS-8 for event and saying rows: what each person reads equals vis.can_see, both ways (someone allowed, someone not)');
\else
select tests.ok(false, 'SHARE-U-15 VIS-8 for event and saying rows: not run, public.post_events / public.post_sayings missing (0034)');
\endif

-- ======================================================================================================
-- SHARE-U-5 the audience sees each kind; a person outside it gets nothing, on every path
-- ======================================================================================================
:as_ma
select tests.ok_sql(format($$select (select array_agg(kind order by kind) from public.get_feed(%L, null, null, 50) f where f.post_id in (%L, %L, %L))
                                   = array['event', 'news', 'saying']$$, :sa, tests.v('news'), tests.v('event'), tests.v('saying')),
  'SHARE-U-5 allowed: Grandma Rivera (in the group) gets the news, event and saying in her feed, each with its kind');
select tests.ok_sql(format($$select count(*) = 3 from public.get_timeline(%L, null, null, 50) f where f.post_id in (%L, %L, %L) and f.kind in ('news','event','saying')$$,
                           :sa, tests.v('news'), tests.v('event'), tests.v('saying')),
  'SHARE-U-5 allowed: ...and on her timeline, with kind');
select tests.ok_sql(format($$select count(*) = 3 from public.search_posts(%L, null, null, '1900-01-01', '2200-01-01', null, null, 50) f
                              where f.post_id in (%L, %L, %L) and f.kind in ('news','event','saying')$$, :sa, tests.v('news'), tests.v('event'), tests.v('saying')),
  'SHARE-U-5 allowed: ...and in search, with kind');
select tests.ok_sql(format($$select array_agg(post_id::text) = array[%L] from public.search_posts(%L, 'thanksgiving')$$, tests.v('news'), :sa),
  'SHARE-U-5 allowed: ...search finds the news by its words');
select tests.ok_sql(format($$select public.can_view_post(%L) and public.can_view_post(%L) and public.can_view_post(%L)$$, tests.v('news'), tests.v('event'), tests.v('saying')),
  'SHARE-U-5 allowed: ...each opens by id');
select tests.ok_sql(format($$select (select count(*) from public.post_events where post_id = %L) = 1 and (select count(*) from public.post_sayings where post_id = %L) = 1$$,
                           tests.v('event'), tests.v('saying')),
  'SHARE-U-5 allowed: ...she reads the event''s and the saying''s fields');

:as_admin
select tests.ok_sql(format($$select count(*) = 3 from public.posts where id in (%L, %L, %L) and status = 'published' and deleted_at is null$$,
                           tests.v('news'), tests.v('event'), tests.v('saying')),
  'SHARE-U-5 the excluded checks below are not vacuous: the news, event and saying are published and live');
:as_chen
select tests.ok_sql(format($$select not exists (select 1 from public.get_feed(%L, null, null, 50) f where f.post_id in (%L, %L, %L))$$, :sa, tests.v('news'), tests.v('event'), tests.v('saying')),
  'SHARE-U-5 excluded: Grandma Chen (Everyone only) gets none of them in her feed');
select tests.ok_sql(format($$select not exists (select 1 from public.get_timeline(%L, null, null, 50) f where f.post_id in (%L, %L, %L))$$, :sa, tests.v('news'), tests.v('event'), tests.v('saying')),
  'SHARE-U-5 excluded: ...nor on her timeline');
select tests.ok_sql(format($$select not exists (select 1 from public.search_posts(%L, null, null, '1900-01-01', '2200-01-01', null, null, 50) f where f.post_id in (%L, %L, %L))
                               and not exists (select 1 from public.search_posts(%L, 'thanksgiving'))$$, :sa, tests.v('news'), tests.v('event'), tests.v('saying'), :sa),
  'SHARE-U-5 excluded: ...nor in search, by date or by words');
select tests.ok_sql(format($$select not (public.can_view_post(%L) or public.can_view_post(%L) or public.can_view_post(%L))
                               and (select count(*) from public.posts where id in (%L, %L, %L)) = 0$$,
                           tests.v('news'), tests.v('event'), tests.v('saying'), tests.v('news'), tests.v('event'), tests.v('saying')),
  'SHARE-U-5 excluded: ...nor by id (can_view_post false, the posts table shows nothing)');
select tests.ok_sql($$select (select count(*) from public.post_events) = 0 and (select count(*) from public.post_sayings) = 0$$,
  'SHARE-U-5 excluded: ...she reads no event and no saying fields at all');
select tests.ok_sql(format($$select count(*) = 0 from public.post_viewers(array[%L, %L, %L]::uuid[])$$, tests.v('news'), tests.v('event'), tests.v('saying')),
  'SHARE-U-5 excluded: ...post_viewers leaves them out');
select tests.ok_sql($$select position('Pawpaw''s 80th' in public.export_my_data()::text) = 0 and position('hair went on vacation' in public.export_my_data()::text) = 0
                         and position('Thanksgiving' in public.export_my_data()::text) = 0$$,
  'SHARE-U-5 excluded: ...and her export carries none of their words');
select tests.ok_sql(format($$select not exists (select 1 from public.list_family_dates(%L) d where d::text like '%%Pawpaw''s 80th%%')$$, :sa),
  'SHARE-U-5 excluded: ...and the life calendar never lists the event');
:as_blair
select tests.ok_sql(format($$select not exists (select 1 from public.get_feed(%L, null, null, 50) f where f.post_id in (%L, %L, %L))
                               and (select count(*) from public.post_events) = 0 and (select count(*) from public.post_sayings) = 0$$,
                           :sa, tests.v('news'), tests.v('event'), tests.v('saying')),
  'SHARE-U-5 excluded: Blair (co-parent, not in the group) gets none of them, nor their fields');

-- the author's own export has them (their data)
:as_alex
select tests.ok_sql($$select position('Pawpaw''s 80th birthday picnic' in public.export_my_data()::text) > 0
                         and position('Pawpaw, your hair went on vacation' in public.export_my_data()::text) > 0
                         and position('Gammy is coming for Thanksgiving!' in public.export_my_data()::text) > 0$$,
  'SHARE-U-5 the author''s own export has the news words and the event''s and saying''s fields');

-- a deleted post takes its fields with it
select tests.lives(format('select public.delete_post(%L)', tests.v('saying')), 'SHARE-U-5 setup: the owner deletes the saying');
:as_ma
select tests.ok_sql(format($$select (select count(*) from public.post_sayings where post_id = %L) = 0
                               and not exists (select 1 from public.get_feed(%L, null, null, 50) f where f.post_id = %L)$$, tests.v('saying'), :sa, tests.v('saying')),
  'SHARE-U-5 once the saying is deleted, the person who saw it no longer reads its fields or the post');

-- ======================================================================================================
-- SHARE-U-14 parents only: relatives never, even in a family where relatives may post photos; adults yes
-- ======================================================================================================
:as_admin
update public.spaces set viewers_can_post = true where id = :sa;
:as_ma
select tests.lives($$select tests.mk('photos', 'Grandma''s garden', null)$$,
  'SHARE-U-14 setup: with relatives allowed to post, Grandma Rivera can make a photos post');
select tests.throws_code($$select tests.mk('news', 'Grandma news', null)$$, 'SHARE-U-14 ...but her news is refused (42501, parents only)', '42501');
select tests.throws_code($$select tests.mk('event', null, '{"what":"Bingo","when":"2026-12-01"}')$$, 'SHARE-U-14 ...and her event (42501)', '42501');
select tests.throws_code($$select tests.mk('saying', null, '{"words":"Crunchy water","who":"Mia"}')$$, 'SHARE-U-14 ...and her saying (42501)', '42501');
:as_admin
update public.spaces set viewers_can_post = false where id = :sa;
:as_chen
select tests.throws_code($$select tests.mk('news', 'Chen news', null, array['33333333-0000-0000-0000-0000000000a0']::uuid[])$$,
  'SHARE-U-14 a relative who can''t post gets 42501 for news', '42501');
:as_admin
update public.space_members set role = 'adult'
 where space_id = '22222222-0000-0000-0000-00000000000a' and user_id = 'c0000000-0000-0000-0000-0000000000c1';
:as_jo
select tests.ok_sql(format($$select exists (select 1 from public.my_features(%L) f where f.feature = 'post_kinds')$$, :sa),
  'SHARE-U-14 an adult (second parent) gets post_kinds in my_features');
select tests.setv('jo_news', $$select tests.mk('news', 'Aunt Jo''s news for the grandparents', null)$$);
select tests.ok(tests.v('jo_news') is not null, 'SHARE-U-14 an adult (second parent) can post news');
:as_admin
update public.space_features set enabled = false where space_id = :sa and feature = 'post_kinds';
:as_jo
select tests.throws_code($$select tests.mk('saying', null, '{"words":"Crunchy water","who":"Mia"}')$$,
  'SHARE-U-14 the family turns post_kinds off again: the adult is refused (42501)', '42501');

-- ---------- report ----------
\o
\pset format aligned
:as_admin
select n, case when ok then 'ok' else 'NOT OK' end as result, description from tests.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tests.results \gset
\echo
\echo POST KINDS RESULT: :passed passed, :failed failed
select :failed = 0 as all_ok \gset
\if :all_ok
\else
  \echo SOME TESTS FAILED
  select 1/0 as force_nonzero_exit;
\endif
