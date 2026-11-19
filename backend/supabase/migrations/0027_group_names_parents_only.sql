-- 0027: a group's name stays with the parents (SEC-R1, Nov 19 tech-debt review; Chase, Nov 4;
-- docs/architecture/05-access-control.md). Until now a relative could read the name of every group they are in
-- with a plain select on public.circles, and their data export listed those names. The app never did either
-- (feed, chat_list and post_viewers already hide names from relatives), so nothing in the app changes.
-- * circles_select: parents (my_managed_space_ids) see every live group in their space, as before. Anyone else
--   sees only the Everyone group and event groups they are in (the app shows those names to members, EVT-1).
-- * export_my_data: the same rule for the group names in "spaces" and in each post's "audience".
-- Changes nobody's access to posts: no visibility rule reads circles through this policy.
-- NO CONTENT IS USED FOR AI/ML TRAINING, ADVERTISING OR PROFILING (see 0001 header).

drop policy circles_select on public.circles;
create policy circles_select on public.circles for select to authenticated
  using (deleted_at is null
         and (space_id = any ((select private.my_managed_space_ids())::uuid[])
              or (kind in ('everyone', 'event') and id = any ((select private.my_circle_ids())::uuid[]))));

-- May the caller see this group's name? Parents of its space always; others only Everyone and events.
create or replace function private.may_see_circle_name(p_space uuid, p_kind text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_kind in ('everyone', 'event') or p_space = any (private.my_managed_space_ids());
$$;
revoke all on function private.may_see_circle_name(uuid, text) from public;

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
    'notification_prefs', (select coalesce(jsonb_agg(to_jsonb(n)), '[]') from public.notification_prefs n where n.user_id = auth.uid())
  )
$$;
