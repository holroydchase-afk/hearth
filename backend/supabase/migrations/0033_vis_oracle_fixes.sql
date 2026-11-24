-- 0033: the gaps the Phase 2 oracle found (SPEC-VISIBILITY-CORE Phase 2, TRACKER R51 -> R77; tests/vis_oracle_test.sql).
-- Every change here is the same or narrower than before, never wider, and none changes a live family:
--   QA-R1 (P1) the child kind gets its own rule, private.vis_sees_child = children_select (0002) for a given user,
--         so vis.can_see answers for children exactly as RLS does (it said no to everyone before: never looser,
--         but wrong). Nothing an app user reads changes.
--   QA-R2 (P2) reply and reaction notices go to the author only while the author can still see the post
--         (private.sees_post), so a deleted family sends nothing. In a live family the author's own published
--         post always passes sees_post, so live notices are unchanged.
--   QA-R3 (P2) private.chat_people is empty in a deleted family, so chat_roster (and every chat RPC built on it)
--         answers "not found" there, the same as chat_list already did.
--   QA-R4 (P2, part) public.is_post_author needs a live family, so post_audiences_select and set_post_audience
--         stop telling the author that their post in a deleted family exists. In a live family it is unchanged.
--   R82 (QA-R6, P2) export_my_data leaves out life-calendar dates the caller added in a deleted family (0029 took
--         every date with created_by = caller). Only that branch changes; your own birthday stays in your export.
-- Not here: delete_post's repeat call on your own deleted post stays a no-op for its author (BETA-AUD-5; VIS-9's
-- named exception).

-- ---------- QA-R1: the child rule ----------
create function private.vis_sees_child(p_viewer uuid, p_child uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_viewer is not null and (
    exists (select 1 from public.child_guardians g where g.child_id = p_child and g.user_id = p_viewer)
    or exists (select 1 from public.space_children sc
                 join public.space_members sm on sm.space_id = sc.space_id and sm.user_id = p_viewer
                                              and sm.role in ('owner', 'adult')
                 join public.spaces s on s.id = sc.space_id and s.deleted_at is null
                where sc.child_id = p_child)
    or exists (select 1 from public.post_children pc
                where pc.child_id = p_child and private.sees_post(p_viewer, pc.post_id)))
$$;
revoke all on function private.vis_sees_child(uuid, uuid) from public, anon, authenticated;

update vis.kinds
   set rule_fn = 'private.vis_sees_child(uuid,uuid)'::regprocedure,
       note = 'children: children_select (0002): a guardian, a parent of a live family the child is in, or a child tagged on a post you can see; private.vis_sees_child is its twin (0033, QA-R1)'
 where kind = 'child';

-- ---------- QA-R4: the author of a post, only in a live family ----------
create or replace function public.is_post_author(p_post uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.posts p
                 join public.space_members sm on sm.space_id = p.space_id and sm.user_id = auth.uid()
                 join public.spaces s on s.id = p.space_id and s.deleted_at is null
                 where p.id = p_post and p.author_id = auth.uid() and p.deleted_at is null)
$$;

-- ---------- QA-R3: no chat in a deleted family ----------
create or replace function private.chat_people(p_circle uuid) returns table (user_id uuid, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select x.user_id, min(x.since)
  from public.circles c
  join public.spaces s on s.id = c.space_id and s.deleted_at is null
  cross join lateral (
    select cm.user_id, cm.added_at as since
    from public.circle_members cm
    join public.space_members sm on sm.space_id = c.space_id and sm.user_id = cm.user_id
    where cm.circle_id = c.id
    union all
    select sm.user_id, sm.joined_at
    from public.space_members sm
    where sm.space_id = c.space_id and sm.role in ('owner', 'adult')
  ) x
  where c.id = p_circle and c.deleted_at is null and c.kind <> 'household'
  group by x.user_id
$$;

-- ---------- QA-R2: reply and reaction notices only while the author can see the post ----------
-- 0026's claim_notification_batches with one change in `valid`: the author branch asks private.sees_post
-- (live family, still a member, post not deleted) instead of membership alone.
create or replace function public.claim_notification_batches(p_now timestamptz default now())
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
  taken_to          timestamptz
)
language sql security definer set search_path = '' as $$
  with cand as (
    select o.id, o.recipient_id, o.post_id, o.actor_id, o.kind, o.created_at, p.batch_id, p.taken_at,
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
         max(w.taken_at) filter (where w.kind = 'post')
  from windowed w
  join ready r on r.recipient_id = w.recipient_id and r.ch = w.ch
  join public.profiles pr on pr.id = w.actor_id
  group by w.recipient_id, w.ch
$$;

-- ---------- R82 (QA-R6): no dates you added in a deleted family in your export ----------
-- 0029's export_my_data with one change in family_dates.
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
                             from public.media_items m where m.post_id = p.id))), '[]')
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
