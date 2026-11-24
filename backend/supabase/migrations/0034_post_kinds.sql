-- 0034 (0030 is reserved by the video branch): News, Event and Saying posts (SHARE-U-4, 5, 11..15;
-- docs/product/SPEC-VISIBILITY-CORE.md "One Share composer", Phase 4). Tests: tests/post_kinds_test.sql (its header
-- is the contract), tests/vis_oracle_test.sql (VIS-8 for the two child kinds).
--
-- * posts.kind: 'photos' (every existing post, and the default), 'news', 'event' or 'saying'. Fixed at creation.
-- * create_post gains p_kind (default 'photos') and p_details (default null), so every older app build keeps working.
--     news    the words are p_caption (trimmed, required); no details; never any media.
--     event   p_details {what, when 'YYYY-MM-DD', where?} -> one row in public.post_events.
--     saying  p_details {words, who, age 0..120?} -> one row in public.post_sayings.
--   Anything malformed is 23514. News, events and sayings are for parents only while the post_kinds feature is on
--   (private.feature_on: Hearth's global switch AND the family's switch AND can(space, 'post_kinds')); otherwise
--   42501 'post_kinds_off'. Off by default: the global row ships off and a missing family row is off.
-- * NO new visibility rule. post_events and post_sayings are item kinds of the post (vis.attach, item_column post_id):
--   one permissive read policy, vis.viewer_sees_item(post_id), so a person reads the fields exactly when they can
--   see the post. App users never write them (create_post only). Deleting the post hides them (the item rule
--   needs a live post) and a hard delete cascades.
-- * No media on a news, event or saying post: a before-insert trigger on media_items refuses it (23514), so
--   prepare_media_upload and a direct insert both stop. publish_post publishes them with no media; a photos draft
--   still needs ready media (23514).
-- * get_feed, get_timeline and search_posts gain `kind` as their last column (older app builds ignore it).
--   The app reads the event and saying fields from the two tables under RLS.
-- * export_my_data: each of the caller's own posts carries its event / saying fields; nobody else's ever does.

-- ---------- the kind of a post ----------
alter table public.posts add column kind text not null default 'photos'
  check (kind in ('photos', 'news', 'event', 'saying'));
-- news is words: a news post never loses them (edit_post_words to blank gets 23514 from this check)
alter table public.posts add constraint posts_news_has_words
  check (kind <> 'news' or (caption is not null and btrim(caption) <> ''));
grant select (kind) on public.posts to authenticated;

-- ---------- the fields of an event and a saying (one row per post) ----------
create table public.post_events (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null unique references public.posts(id) on delete cascade,
  what        text not null check (char_length(what) between 1 and 200),
  on_date     date not null,
  place       text check (place is null or char_length(place) between 1 and 200),
  created_at  timestamptz not null default now()
);
create table public.post_sayings (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null unique references public.posts(id) on delete cascade,
  words       text not null check (char_length(words) between 1 and 2000),
  who         text not null check (char_length(who) between 1 and 80),
  age         smallint check (age is null or age between 0 and 120),
  created_at  timestamptz not null default now()
);
-- item kinds of the post: RLS on and forced, every grant taken from app roles, select to signed-in users, and the
-- one read policy vis.viewer_sees_item(post_id). No rule_fn, no hook.
do $$ begin
perform vis.attach('public.post_events', 'post_event', item_column => 'post_id',
                  note => 'an event''s what, when and where (0034): follows its post (vis.attach); written by create_post only');
perform vis.attach('public.post_sayings', 'post_saying', item_column => 'post_id',
                  note => 'a saying''s words, who and age (0034): follows its post (vis.attach); written by create_post only');
end $$;
grant all on public.post_events, public.post_sayings to service_role;

-- ---------- the feature switch: parents only, off by default ----------
create or replace function public.can(p_space uuid, p_capability text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_role public.member_role := public.space_role(p_space);
begin
  if p_capability is null or p_capability not in ('post', 'send_to_everyone', 'make_events', 'invite', 'set_up_family',
                                                  'family_settings', 'use_video', 'post_kinds') then
    raise exception 'unknown capability' using errcode = '22023';
  end if;
  if v_role is null then return false; end if;
  return case p_capability
    when 'post' then public.can_post_in_space(p_space)
    when 'family_settings' then v_role = 'owner'
    when 'post_kinds' then v_role in ('owner', 'adult') and public.can_post_in_space(p_space)
    else v_role in ('owner', 'adult') end;
end $$;

create or replace function private.feature_capability(p_feature text) returns text
language sql immutable set search_path = '' as $$
  select case p_feature
    when 'video_posting' then 'use_video'
    when 'photo_helpers_duplicates' then 'post'
    when 'photo_helpers_screens_blur' then 'post'
    when 'post_kinds' then 'post_kinds'
  end
$$;

-- Hearth's global switch ships off (Chase turns it on per DEPLOYS.md); feature_default_on stays false for it.
insert into private.feature_flags (feature, enabled) values ('post_kinds', false) on conflict (feature) do nothing;

-- ---------- create_post with a kind ----------
delete from vis.functions where fn = 'public.create_post(uuid,uuid,text,uuid[],timestamp with time zone,uuid[],uuid,integer,text)'::regprocedure;
drop function public.create_post(uuid, uuid, text, uuid[], timestamptz, uuid[], uuid, integer, text);
create function public.create_post(
  p_client_id uuid, p_space uuid, p_caption text, p_circle_ids uuid[],
  p_taken_at timestamptz default null, p_child_ids uuid[] default '{}',
  p_batch_id uuid default null, p_batch_size integer default null, p_title text default null,
  p_kind text default 'photos', p_details jsonb default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_post uuid; v_cid uuid; v_kind text; v_title text := nullif(btrim(p_title), '');
  v_pk text := coalesce(p_kind, 'photos');
  v_d jsonb := case when p_details is null or jsonb_typeof(p_details) = 'null' then null else p_details end;
  v_caption text := p_caption;
  v_what text; v_when date; v_where text; v_words text; v_who text; v_age integer;
begin
  if v_uid is null or not public.can_post_in_space(p_space) then
    raise exception 'you cannot post in this space' using errcode = '42501';
  end if;
  if v_pk not in ('photos', 'news', 'event', 'saying') then
    raise exception 'unknown post kind' using errcode = '23514';
  end if;
  if v_pk <> 'photos' and not private.feature_on(p_space, 'post_kinds') then
    raise exception 'post_kinds_off' using errcode = '42501';
  end if;
  if p_client_id is null then
    raise exception 'p_client_id is required' using errcode = '23514';
  end if;
  if (p_batch_id is null) <> (p_batch_size is null) then
    raise exception 'batch id and batch size go together' using errcode = '23514';
  end if;
  if char_length(v_title) > 80 then
    raise exception 'a title is 80 characters at most' using errcode = '23514';
  end if;
  if p_batch_size is not null and (p_batch_size < 1 or p_batch_size > 100) then
    raise exception 'a batch is 1 to 100 posts' using errcode = '23514';
  end if;
  -- the kind's own fields
  if v_pk in ('photos', 'news') and v_d is not null then
    raise exception 'only an event or a saying has fields' using errcode = '23514';
  end if;
  if v_pk = 'news' then
    v_caption := nullif(btrim(p_caption), '');
    if v_caption is null then
      raise exception 'news needs words' using errcode = '23514';
    end if;
  elsif v_pk in ('event', 'saying') and (v_d is null or jsonb_typeof(v_d) <> 'object') then
    raise exception 'an event or a saying needs its fields' using errcode = '23514';
  end if;
  if v_caption is not null and char_length(v_caption) > 2000 and v_pk <> 'photos' then
    raise exception 'words are 2000 characters at most' using errcode = '23514';
  end if;
  if v_pk = 'event' then
    v_what := nullif(btrim(v_d ->> 'what'), '');
    v_where := nullif(btrim(v_d ->> 'where'), '');
    if v_what is null or char_length(v_what) > 200 then
      raise exception 'an event needs what is happening (200 characters at most)' using errcode = '23514';
    end if;
    if char_length(v_where) > 200 then
      raise exception 'where is 200 characters at most' using errcode = '23514';
    end if;
    if coalesce(v_d ->> 'when', '') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'an event needs a date (YYYY-MM-DD)' using errcode = '23514';
    end if;
    begin
      v_when := (v_d ->> 'when')::date;
    exception when others then
      raise exception 'an event needs a real date' using errcode = '23514';
    end;
  elsif v_pk = 'saying' then
    v_words := nullif(btrim(v_d ->> 'words'), '');
    v_who := nullif(btrim(v_d ->> 'who'), '');
    if v_words is null or char_length(v_words) > 2000 then
      raise exception 'a saying needs the words (2000 characters at most)' using errcode = '23514';
    end if;
    if v_who is null or char_length(v_who) > 80 then
      raise exception 'a saying needs who said it (80 characters at most)' using errcode = '23514';
    end if;
    if v_d ? 'age' and jsonb_typeof(v_d -> 'age') <> 'null' then
      if jsonb_typeof(v_d -> 'age') <> 'number' or (v_d ->> 'age') !~ '^\d{1,3}$'
         or (v_d ->> 'age')::integer > 120 then
        raise exception 'an age is a whole number from 0 to 120' using errcode = '23514';
      end if;
      v_age := (v_d ->> 'age')::integer;
    end if;
  end if;
  select id into v_post from public.posts where author_id = v_uid and client_id = p_client_id;
  if found then return v_post; end if;
  if coalesce(cardinality(p_circle_ids), 0) = 0 then
    raise exception 'choose at least one circle' using errcode = '23514';
  end if;
  foreach v_cid in array p_circle_ids loop
    select kind into v_kind from public.circles where id = v_cid and space_id = p_space and deleted_at is null;
    if v_kind is null then
      raise exception 'circle not found in this space' using errcode = '23514';
    end if;
    if not public.can_send_to(v_cid) then
      -- a container the caller isn't in stays "not found"; Everyone and their own ones say "not allowed"
      if v_kind = 'everyone' or v_cid = any (private.my_circle_ids()) then
        raise exception 'you can''t send there' using errcode = '42501';
      end if;
      raise exception 'circle not found in this space' using errcode = '23514';
    end if;
  end loop;
  insert into public.posts (space_id, author_id, caption, title, taken_at, client_id, batch_id, batch_size, kind)
  values (p_space, v_uid, v_caption, v_title, p_taken_at, p_client_id, p_batch_id, p_batch_size, v_pk)
  on conflict (author_id, client_id) do nothing
  returning id into v_post;
  if v_post is null then   -- lost a race with an identical retry
    select id into v_post from public.posts where author_id = v_uid and client_id = p_client_id;
    return v_post;
  end if;
  insert into public.post_audiences (post_id, circle_id) select distinct v_post, unnest(p_circle_ids);
  insert into public.post_children (post_id, child_id) select distinct v_post, unnest(coalesce(p_child_ids, '{}'));
  if v_pk = 'event' then
    insert into public.post_events (post_id, what, on_date, place) values (v_post, v_what, v_when, v_where);
  elsif v_pk = 'saying' then
    insert into public.post_sayings (post_id, words, who, age) values (v_post, v_words, v_who, v_age);
  end if;
  return v_post;
end $$;
revoke all on function public.create_post(uuid, uuid, text, uuid[], timestamptz, uuid[], uuid, integer, text, text, jsonb) from public, anon;
grant execute on function public.create_post(uuid, uuid, text, uuid[], timestamptz, uuid[], uuid, integer, text, text, jsonb) to authenticated;

-- ---------- publish: photos need ready media; the other kinds never have any ----------
create or replace function public.publish_post(p_post uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.posts;
begin
  if not public.can_view_post(p_post) then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
  select * into v from public.posts where id = p_post for update;
  if v.author_id is distinct from auth.uid() then
    raise exception 'only the author can publish' using errcode = '42501';
  end if;
  if v.status = 'published' then return; end if;     -- idempotent
  if not public.can_post_in_space(v.space_id) then
    raise exception 'you cannot post in this space' using errcode = '42501';
  end if;
  -- re-checked at publish: a parent demoted after drafting to Everyone can't publish it
  if exists (select 1 from public.post_audiences pa where pa.post_id = p_post and not public.can_send_to(pa.circle_id)) then
    raise exception 'you can''t send there' using errcode = '42501';
  end if;
  if v.kind = 'photos' then
    if exists (select 1 from public.media_items where post_id = p_post and upload_status <> 'ready')
       or not exists (select 1 from public.media_items where post_id = p_post) then
      raise exception 'all media must finish uploading first' using errcode = '23514';
    end if;
  else
    -- re-checked at publish, like the audience: switched off (or no longer a parent) since the draft
    if not private.feature_on(v.space_id, 'post_kinds') then
      raise exception 'post_kinds_off' using errcode = '42501';
    end if;
    if exists (select 1 from public.media_items where post_id = p_post) then
      raise exception 'a news, event or saying post has no photos' using errcode = '23514';
    end if;
  end if;
  update public.posts set status = 'published' where id = p_post;
end $$;

-- ---------- no media on a news, event or saying post (prepare_media_upload and a direct insert) ----------
create function private.tg_media_photos_only() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.posts p where p.id = new.post_id and p.kind <> 'photos') then
    raise exception 'a news, event or saying post has no photos' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.tg_media_photos_only() from public, anon, authenticated;
-- named to fire before media_before_insert (alphabetical), so a refused row never touches the video counters
create trigger media_a_photos_only before insert on public.media_items
  for each row execute function private.tg_media_photos_only();

-- ---------- lists gain kind (last column) ----------
delete from vis.functions where fn in (
  'public.get_feed(uuid,timestamp with time zone,uuid,integer)'::regprocedure,
  'public.get_timeline(uuid,timestamp with time zone,uuid,integer)'::regprocedure,
  'public.search_posts(uuid,text,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone,uuid,integer)'::regprocedure);
drop function public.get_feed(uuid, timestamptz, uuid, integer);
drop function public.get_timeline(uuid, timestamptz, uuid, integer);
drop function public.search_posts(uuid, text, uuid, timestamptz, timestamptz, timestamptz, uuid, integer);

create function public.get_feed(
  p_space uuid, p_before_ts timestamptz default null, p_before_id uuid default null, p_limit integer default 20)
returns table (post_id uuid, author_id uuid, author_name text, caption text, published_at timestamptz,
               media jsonb, heart_count integer, i_hearted boolean, comment_count integer,
               audience jsonb, seen_count integer, reach_count integer, reply_scope text, taken_at timestamptz,
               event_id uuid, event_name text, title text, words_edited_at timestamptz, kind text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  select f.post_id, f.author_id, f.author_name, f.caption, f.published_at, f.media, f.heart_count, f.i_hearted,
         f.comment_count, f.audience, f.seen_count, f.reach_count, f.reply_scope, f.taken_at, f.event_id, f.event_name,
         p.title, p.words_edited_at, p.kind
  from private.feed_rows(array(
         select v.post_id from private.visible_posts(p_space, 'shared', p_before_ts, p_before_id,
                                                     least(greatest(coalesce(p_limit, 20), 1), 50)) v)) f
  join public.posts p on p.id = f.post_id
  order by f.published_at desc, f.post_id desc;
end $$;

create function public.get_timeline(
  p_space uuid, p_before_at timestamptz default null, p_before_id uuid default null, p_limit integer default 20)
returns table (post_id uuid, author_id uuid, author_name text, caption text, published_at timestamptz,
               media jsonb, heart_count integer, i_hearted boolean, comment_count integer,
               audience jsonb, seen_count integer, reach_count integer, reply_scope text,
               taken_at timestamptz, sort_at timestamptz, event_id uuid, event_name text, title text,
               words_edited_at timestamptz, kind text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  select f.post_id, f.author_id, f.author_name, f.caption, f.published_at, f.media, f.heart_count, f.i_hearted,
         f.comment_count, f.audience, f.seen_count, f.reach_count, f.reply_scope,
         f.taken_at, coalesce(f.taken_at, f.published_at), f.event_id, f.event_name, p.title, p.words_edited_at, p.kind
  from private.feed_rows(array(
         select v.post_id from private.visible_posts(p_space, 'taken', p_before_at, p_before_id,
                                                     least(greatest(coalesce(p_limit, 20), 1), 50)) v)) f
  join public.posts p on p.id = f.post_id
  order by coalesce(f.taken_at, f.published_at) desc, f.post_id desc;
end $$;

-- 0025's search_posts, plus kind. The words searched are unchanged (title, caption, sender's name): a news post's
-- words are its caption; an event's or a saying's fields are not searched yet.
create function public.search_posts(
  p_space uuid, p_query text default null, p_author uuid default null,
  p_from timestamptz default null, p_until timestamptz default null,
  p_before_at timestamptz default null, p_before_id uuid default null, p_limit integer default 20)
returns table (post_id uuid, author_id uuid, author_name text, caption text, published_at timestamptz,
               media jsonb, heart_count integer, i_hearted boolean, comment_count integer,
               audience jsonb, seen_count integer, reach_count integer, reply_scope text,
               taken_at timestamptz, sort_at timestamptz, event_id uuid, event_name text, title text,
               words_edited_at timestamptz, kind text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_q     text := btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'));
  v_words text[];
  v_pats  text[];
  v_lim   integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_at    timestamptz := coalesce(p_before_at, 'infinity');
  v_id    uuid := coalesce(p_before_id, '00000000-0000-0000-0000-000000000000');
begin
  if char_length(v_q) > 100 then
    raise exception 'search words are 100 characters at most' using errcode = '22023';
  end if;
  v_words := case when v_q = '' then '{}'::text[] else string_to_array(v_q, ' ') end;
  if cardinality(v_words) > 8 then
    raise exception 'search with 8 words at most' using errcode = '22023';
  end if;
  if cardinality(v_words) = 0 and p_author is null and p_from is null and p_until is null then
    raise exception 'type a word, or pick a person or dates' using errcode = '22023';
  end if;
  -- each word as a literal ILIKE pattern: escape \ first, then % and _
  select coalesce(array_agg('%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%'), '{}')
    into v_pats from unnest(v_words) w;

  return query
  select f.post_id, f.author_id, f.author_name, f.caption, f.published_at, f.media, f.heart_count, f.i_hearted,
         f.comment_count, f.audience, f.seen_count, f.reach_count, f.reply_scope,
         f.taken_at, coalesce(f.taken_at, f.published_at), f.event_id, f.event_name, p.title, p.words_edited_at, p.kind
  from private.feed_rows(array(
         select p2.id
         from private.visible_posts(p_space, 'taken', null, null, null) v
         join public.posts p2 on p2.id = v.post_id
         join public.profiles pr on pr.id = p2.author_id
         where (p_author is null or p2.author_id = p_author)
           and (p_from is null or coalesce(p2.taken_at, p2.published_at) >= p_from)
           and (p_until is null or coalesce(p2.taken_at, p2.published_at) < p_until)
           and (coalesce(p2.taken_at, p2.published_at), p2.id) < (v_at, v_id)
           and coalesce(p2.title, '') || ' ' || coalesce(p2.caption, '') || ' ' || coalesce(pr.display_name, '')
               ilike all (v_pats)
         order by coalesce(p2.taken_at, p2.published_at) desc, p2.id desc
         limit v_lim)) f
  join public.posts p on p.id = f.post_id
  order by coalesce(f.taken_at, f.published_at) desc, f.post_id desc;
end $$;

revoke all on function public.get_feed(uuid, timestamptz, uuid, integer) from public, anon;
revoke all on function public.get_timeline(uuid, timestamptz, uuid, integer) from public, anon;
revoke all on function public.search_posts(uuid, text, uuid, timestamptz, timestamptz, timestamptz, uuid, integer) from public, anon;
grant execute on function public.get_feed(uuid, timestamptz, uuid, integer) to authenticated;
grant execute on function public.get_timeline(uuid, timestamptz, uuid, integer) to authenticated;
grant execute on function public.search_posts(uuid, text, uuid, timestamptz, timestamptz, timestamptz, uuid, integer) to authenticated;

-- ---------- export: your own posts carry their event and saying fields ----------
create or replace function public.export_my_data() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile',  (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'households', (select coalesce(jsonb_agg(to_jsonb(h) || jsonb_build_object('role', hm.role)), '[]')
                   from public.household_members hm join public.households h on h.id = hm.household_id
                   where hm.user_id = auth.uid()),
    'spaces',   (select coalesce(jsonb_agg(jsonb_build_object('space_id', sm.space_id, 'name', s.name, 'role', sm.role,
                   'circles', (select coalesce(jsonb_agg(c.name), '[]') from public.circle_members cm
                               join public.circles c on c.id = cm.circle_id
                               where cm.user_id = auth.uid() and c.space_id = sm.space_id
                                 and private.may_see_circle_name(c.space_id, c.kind)))), '[]')
                 from public.space_members sm join public.spaces s on s.id = sm.space_id
                 where sm.user_id = auth.uid()),
    'posts',    (select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object(
                   'audience', (select coalesce(jsonb_agg(c.name), '[]') from public.post_audiences pa
                                join public.circles c on c.id = pa.circle_id
                                where pa.post_id = p.id and private.may_see_circle_name(c.space_id, c.kind)),
                   'media', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'kind', m.kind,
                                'display_key', m.display_key, 'width', m.width, 'height', m.height,
                                'duration_ms', m.duration_ms, 'byte_size', m.byte_size)), '[]')
                             from public.media_items m where m.post_id = p.id),
                   -- 0034: the author's own event and saying fields (p.author_id = auth.uid() below)
                   'event', (select jsonb_build_object('what', e.what, 'when', e.on_date, 'where', e.place)
                               from public.post_events e where e.post_id = p.id),
                   'saying', (select jsonb_build_object('words', s.words, 'who', s.who, 'age', s.age)
                                from public.post_sayings s where s.post_id = p.id))), '[]')
                 from public.posts p where p.author_id = auth.uid()),
    'comments', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.comments c where c.author_id = auth.uid()),
    'reactions',(select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.reactions r where r.user_id = auth.uid()),
    'notification_prefs', (select coalesce(jsonb_agg(to_jsonb(n)), '[]') from public.notification_prefs n where n.user_id = auth.uid()),
    -- PRIV-R3: your own birthdays and the dates you added; nobody else's. R82 (QA-R6): dates you added count only
    -- in a live family (a deleted family's dates are not yours to carry out); your own birthday is unchanged.
    'family_dates', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'space_id', d.space_id, 'kind', d.kind,
                       'label', d.label, 'month', d.month, 'day', d.day, 'member_id', d.member_id,
                       'created_at', d.created_at, 'updated_at', d.updated_at) order by d.month, d.day, d.id), '[]')
                     from public.family_dates d
                     where d.member_id = auth.uid()
                        or (d.created_by = auth.uid()
                            and exists (select 1 from public.spaces s where s.id = d.space_id and s.deleted_at is null)))
  )
$$;

-- ---------- NOTIFY-K (GUX-VC-R11, R83): notices name the kind ----------
-- 0033's claim_notification_batches plus two last columns: kind_counts (new posts per kind, {} for replies only) and
-- post_kinds (the kinds of every post the batch is about, replies included). Counts and kinds only: never a caption,
-- what, when, where, saying, who or age. functions/notify words each kind (SPEC-VISIBILITY-CORE "Notices").
drop function public.claim_notification_batches(timestamptz);
create function public.claim_notification_batches(p_now timestamptz default now())
returns table (
  recipient_id      uuid,
  channel           text,
  actor_names       text[],
  post_ids          uuid[],
  latest_post_id    uuid,
  post_count        int,
  comment_count     int,
  heart_count       int,
  outbox_ids        uuid[],
  push_tokens       text[],
  email             text,
  is_batch          boolean,
  photo_count       int,
  taken_from        timestamptz,
  taken_to          timestamptz,
  kind_counts       jsonb,
  post_kinds        text[]
)
language sql security definer set search_path = '' as $$
  with cand as (
    select o.id, o.recipient_id, o.post_id, o.actor_id, o.kind, o.created_at, p.batch_id, p.taken_at, p.kind as post_kind,
           ( p.deleted_at is null and p.status = 'published'
             and case when o.kind = 'post' then private.sees_post(o.recipient_id, p.id)
                      else o.recipient_id = p.author_id and private.sees_post(o.recipient_id, p.id) end ) as valid,
           coalesce(np.push, true) as want_push,
           coalesce(np.email_digest, 'off') as digest,
           exists (select 1 from public.push_tokens t where t.user_id = o.recipient_id) as has_token,
           exists (select 1 from auth.users u where u.id = o.recipient_id and nullif(btrim(u.email), '') is not null) as has_email
    from public.notification_outbox o
    join public.posts p on p.id = o.post_id
    left join public.notification_prefs np on np.user_id = o.recipient_id and np.space_id = p.space_id
    where o.sent_at is null
      -- BETA-BULK-6: hold an unfinished bulk batch (under 30 minutes old)
      and not (o.kind = 'post' and p.batch_id is not null
               and (select count(*) from public.posts b
                    where b.author_id = p.author_id and b.batch_id = p.batch_id and b.status = 'published') < p.batch_size
               and (select min(o2.created_at) from public.notification_outbox o2
                    join public.posts b2 on b2.id = o2.post_id
                    where b2.author_id = p.author_id and b2.batch_id = p.batch_id and o2.kind = 'post')
                   > p_now - interval '30 minutes')
    for update of o skip locked
  ), classified as (
    select c.*,
           case when not c.valid then 'none'
                when c.want_push and c.has_token then 'push'
                when (c.want_push or c.digest <> 'off') and c.has_email then 'email'
                else 'none' end as ch
    from cand c
  ), clock as (
    select (p_now at time zone 'America/New_York') as l
  ), slots as (
    select (case when l >= date_trunc('day', l) + interval '18 hours' then date_trunc('day', l) + interval '18 hours'
                 else date_trunc('day', l) - interval '6 hours' end) at time zone 'America/New_York' as evening,
           (case when l >= date_trunc('day', l) - extract(dow from l) * interval '1 day' + interval '8 hours'
                 then date_trunc('day', l) - extract(dow from l) * interval '1 day' + interval '8 hours'
                 else date_trunc('day', l) - extract(dow from l) * interval '1 day' - interval '7 days' + interval '8 hours'
            end) at time zone 'America/New_York' as sunday
    from clock
  ), windowed as (
    select k.*,
           case when k.ch = 'push' then p_now - interval '10 minutes'
                when k.digest = 'weekly' and not k.want_push then (select sunday from slots)
                else (select evening from slots) end as since
    from classified k
  ), ready as (
    select g.recipient_id, g.ch
    from (select w.recipient_id, w.ch, max(w.since) as since,
                 bool_or(w.ch = 'push' or w.created_at <= w.since) as due
          from windowed w where w.ch <> 'none' group by 1, 2) g
    where g.due
      and not exists (select 1 from public.notification_outbox s
                      where s.recipient_id = g.recipient_id and s.channel = g.ch
                        and s.sent_at >= g.since)
  ), mark as (
    update public.notification_outbox o
    set sent_at = p_now, channel = w.ch
    from windowed w
    where o.id = w.id
      and (w.ch = 'none' or exists (select 1 from ready r where r.recipient_id = w.recipient_id and r.ch = w.ch))
    returning o.id
  )
  select w.recipient_id,
         w.ch,
         array_agg(distinct pr.display_name order by pr.display_name),
         array_agg(distinct w.post_id order by w.post_id),
         (array_agg(w.post_id order by w.created_at desc))[1],
         (count(distinct w.post_id) filter (where w.kind = 'post'))::int,
         (count(*) filter (where w.kind = 'comment'))::int,
         (count(*) filter (where w.kind = 'heart'))::int,
         array_agg(w.id order by w.id),
         case when w.ch = 'push'
              then coalesce((select array_agg(t.expo_token order by t.expo_token)
                             from public.push_tokens t where t.user_id = w.recipient_id), '{}')
              else '{}'::text[] end,
         case when w.ch = 'email' then (select u.email from auth.users u where u.id = w.recipient_id) end,
         coalesce(bool_and(w.batch_id is not null) filter (where w.kind = 'post'), false),
         (select count(*)::int from public.media_items m
           where m.post_id = any (array_agg(w.post_id) filter (where w.kind = 'post'))
             and m.kind = 'photo' and m.upload_status = 'ready'),
         min(w.taken_at) filter (where w.kind = 'post'),
         max(w.taken_at) filter (where w.kind = 'post'),
         -- 0034 (NOTIFY-K): new posts per kind and the kinds of every post the batch is about. Counts and kinds only.
         coalesce((select jsonb_object_agg(x.k, x.n) from (
                     select pk.k, count(distinct pk.post_id)::int as n
                       from unnest(array_agg(w.post_kind) filter (where w.kind = 'post'),
                                   array_agg(w.post_id) filter (where w.kind = 'post')) pk(k, post_id)
                      group by pk.k) x), '{}'::jsonb),
         array_agg(distinct w.post_kind order by w.post_kind)
  from windowed w
  join ready r on r.recipient_id = w.recipient_id and r.ch = w.ch
  join public.profiles pr on pr.id = w.actor_id
  group by w.recipient_id, w.ch
$$;
revoke execute on function public.claim_notification_batches(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_notification_batches(timestamptz) to service_role;

-- ---------- the registry (tests/vis_registry_test.sql is the gate) ----------
insert into vis.functions (fn, kind, note) values
  ('public.create_post(uuid,uuid,text,uuid[],timestamp with time zone,uuid[],uuid,integer,text,text,jsonb)', null,
   'writes the caller''s own post; can_post_in_space and can_send_to for every group; news, events and sayings only for parents while post_kinds is on (0034)'),
  ('public.get_feed(uuid,timestamp with time zone,uuid,integer)', null,
   'rows come only from private.visible_posts / feed_rows, which call private.sees_post'),
  ('public.get_timeline(uuid,timestamp with time zone,uuid,integer)', null,
   'rows come only from private.visible_posts / feed_rows, which call private.sees_post'),
  ('public.search_posts(uuid,text,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone,uuid,integer)', null,
   'rows come only from private.visible_posts / feed_rows, which call private.sees_post');
