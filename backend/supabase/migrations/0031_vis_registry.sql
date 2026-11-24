-- 0031: Hearth's visibility registry and adapter (SPEC-VISIBILITY-CORE Phase 1 and 1b, TRACKER R77, DEC-81;
-- docs/architecture/07-visibility-model.md). NO behavior change: every RLS policy and RPC stays as it is.
-- This migration:
--   1. points the generic core (0030) at Hearth's tables through its four adapter views;
--   2. adds the per-user rule functions can_see dispatches to (copies of today's rules with the user as a
--      parameter; tests/vis_core_test.sql VIS-7 proves each equals the rule RLS uses today);
--   3. registers every table, every security definer function app users can call, and both edge functions;
--   4. forces RLS on every public table (the table owner bypasses RLS on hosted and locally, so nothing changes;
--      the guard below refuses to run if that were ever not true) and takes any leftover table grant from anon.
-- tests/vis_registry_test.sql is the gate: a new table, view or function without a row here fails CI.

-- ---------- 1. adapter views (generic words: tenant = family space, container = group, item = post) ----------
create or replace view vis.item_v as
  select p.id as item_id, p.space_id as tenant_id, p.author_id, (p.status = 'published') as live,
         p.published_at as live_at
    from public.posts p
    join public.spaces s on s.id = p.space_id and s.deleted_at is null
   where p.deleted_at is null;
create or replace view vis.audience_v as
  select pa.post_id as item_id, pa.circle_id as container_id, pa.added_at from public.post_audiences pa;
create or replace view vis.membership_v as
  select cm.user_id, cm.circle_id as container_id, c.space_id as tenant_id, cm.sees_from,
         (c.deleted_at is null) as live
    from public.circle_members cm
    join public.circles c on c.id = cm.circle_id;
create or replace view vis.role_v as
  select sm.user_id, sm.space_id as tenant_id,
         case sm.role when 'owner' then 'owner' when 'adult' then 'admin' else 'member' end as role
    from public.space_members sm;

-- ---------- 2. rules and hooks, with the user as a parameter (server side only; never callable by app roles) ----------
-- Person: public.can_see_profile(id) for p_viewer instead of auth.uid() (0012, 0018).
create function private.vis_sees_person(p_viewer uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_viewer is not null and (
    p_user = p_viewer
    or exists (
      select 1 from public.space_members me
      join public.space_members them on them.space_id = me.space_id
      join public.spaces s on s.id = me.space_id and s.deleted_at is null
      where me.user_id = p_viewer and them.user_id = p_user
        and (me.role in ('owner','adult') or them.role in ('owner','adult')))
    or exists (
      select 1 from public.circle_members a
      join public.circle_members b on b.circle_id = a.circle_id
      join public.circles c on c.id = a.circle_id and c.deleted_at is null
      join public.spaces s on s.id = c.space_id and s.deleted_at is null
      where a.user_id = p_viewer and b.user_id = p_user)
    or exists (   -- can_see_reply(post, p_user) for any post p_user replied or reacted on
      select 1 from (select distinct c.post_id from public.comments c
                      where c.author_id = p_user and c.deleted_at is null
                     union
                     select r.post_id from public.reactions r where r.user_id = p_user) w
      where private.reply_ok(p_viewer, w.post_id, p_user,
              coalesce(least((select r.created_at from public.reactions r where r.post_id = w.post_id and r.user_id = p_user),
                             (select min(c.created_at) from public.comments c
                               where c.post_id = w.post_id and c.author_id = p_user and c.deleted_at is null)),
                       now()))))
$$;

-- Container: circles_select (0027) for p_viewer: parents read every live group in their space; others only
-- Everyone and events they are in.
create function private.vis_sees_circle(p_viewer uuid, p_circle uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.circles c
     where c.id = p_circle and c.deleted_at is null
       and (exists (select 1 from public.space_members sm
                      join public.spaces s on s.id = sm.space_id and s.deleted_at is null
                     where sm.space_id = c.space_id and sm.user_id = p_viewer and sm.role in ('owner', 'adult'))
            or (c.kind in ('everyone', 'event')
                and exists (select 1 from public.circle_members cm
                              join public.space_members sm on sm.space_id = c.space_id and sm.user_id = cm.user_id
                              join public.spaces s on s.id = c.space_id and s.deleted_at is null
                             where cm.circle_id = c.id and cm.user_id = p_viewer))))
$$;

-- Admin: spaces_select, invites_select, households_select for p_viewer.
create function private.vis_sees_space(p_viewer uuid, p_space uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.space_members sm
                   join public.spaces s on s.id = sm.space_id and s.deleted_at is null
                  where sm.space_id = p_space and sm.user_id = p_viewer)
$$;
create function private.vis_sees_invite(p_viewer uuid, p_invite uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.invites i
                   join public.space_members sm on sm.space_id = i.space_id and sm.user_id = p_viewer
                                               and sm.role in ('owner', 'adult')
                   join public.spaces s on s.id = sm.space_id and s.deleted_at is null
                  where i.id = p_invite)
$$;
create function private.vis_sees_household(p_viewer uuid, p_household uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.household_members hm where hm.household_id = p_household and hm.user_id = p_viewer)
$$;

-- Item hooks (narrow only; ANDed with vis.sees_item by can_see).
-- media_items_select: pending uploads only to their uploader.
create function private.vis_media_ok(p_viewer uuid, p_media uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.media_items m
                  where m.id = p_media and (m.upload_status = 'ready' or m.uploader_id = p_viewer))
$$;
-- comments_select: live comments the reader may read under the reply settings (0009, 0013).
create function private.vis_comment_ok(p_viewer uuid, p_comment uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.comments c
                  where c.id = p_comment and c.deleted_at is null
                    and private.reply_ok(p_viewer, c.post_id, c.author_id, c.created_at))
$$;

revoke all on function private.vis_sees_person(uuid, uuid), private.vis_sees_circle(uuid, uuid),
  private.vis_sees_space(uuid, uuid), private.vis_sees_invite(uuid, uuid), private.vis_sees_household(uuid, uuid),
  private.vis_media_ok(uuid, uuid), private.vis_comment_ok(uuid, uuid)
  from public, anon, authenticated;

-- ---------- 3a. kinds: every table an app user could reach (07 mapping) ----------
insert into vis.kinds (kind, relation, reach, item_column, owner_column, rule_fn, narrow_fn, note) values
  -- item: the post and everything hanging off it. RLS calls private.sees_post (directly or via can_view_post,
  -- reply_visible); vis.sees_item is its generic twin, held equal by VIS-22.
  ('post', 'public.posts', 'item', 'id', null, null, null,
   'the item itself: posts_select calls can_view_post -> private.sees_post'),
  ('media_item', 'public.media_items', 'item', 'post_id', null, null, 'private.vis_media_ok(uuid,uuid)',
   'photos and videos of a post: media_items_select = can_view_post, narrowed to ready uploads (or the uploader)'),
  ('media_key', 'public.media_keys', 'item', null, null, null, null,
   'wrapped per-item keys: no app grant at all; sign-media (service role) reads them after its own check'),
  ('post_child', 'public.post_children', 'item', 'post_id', null, null, null,
   'child tags on a post: post_children_select = can_view_post (no row id, so can_see says no)'),
  ('comment', 'public.comments', 'item', 'post_id', null, null, 'private.vis_comment_ok(uuid,uuid)',
   'replies: comments_select = private.reply_visible -> reply_ok -> sees_post, narrowed by the reply settings'),
  ('reaction', 'public.reactions', 'item', 'post_id', null, null, null,
   'hearts: reactions_select = private.reply_visible -> reply_ok -> sees_post (no row id, so can_see says no)'),
  ('post_audience', 'public.post_audiences', 'item', 'post_id', null, null, null,
   'a post''s groups: author, or can_view_post and a group the reader is in or manages (no row id)'),
  -- person
  ('profile', 'public.profiles', 'person', null, null, 'private.vis_sees_person(uuid,uuid)', null,
   'names: profiles_select = can_see_profile (shared family as a parent, shared live group, or a reply you can read)'),
  ('child', 'public.children', 'person', null, null, 'private.vis_sees_person(uuid,uuid)', null,
   'children: RLS shows guardians, parents and tagged posts; can_see uses the person rule, which says no for a child (default deny until the oracle adds a child rule)'),
  ('child_guardian', 'public.child_guardians', 'person', null, null, null, null,
   'who guards a child: child_guardians_select = the reader is a guardian of that child (no row id)'),
  -- container
  ('circle', 'public.circles', 'container', null, null, 'private.vis_sees_circle(uuid,uuid)', null,
   'groups: circles_select (0027): parents read every live group; others only Everyone and events they are in'),
  ('circle_member', 'public.circle_members', 'container', null, null, null, null,
   'derived group membership: your own rows, or every row of a group you manage (no row id)'),
  ('circle_person', 'public.circle_people', 'container', null, null, null, null,
   'people placed in a group: your own rows, or a group you manage (no row id)'),
  ('circle_link', 'public.circle_links', 'container', null, null, null, null,
   'group nesting: groups you manage only (no row id)'),
  ('chat_group', 'public.chat_groups', 'container', null, null, null, null,
   'messenger groups: no app grant; RPC only (chat_list, chat_start), guarded by private.chat_member_since'),
  ('chat_message', 'public.chat_messages', 'container', null, null, null, null,
   'sealed MLS bytes: no app grant; RPC only (chat_send, chat_fetch), members since they joined'),
  ('chat_key_package', 'public.chat_key_packages', 'container', null, null, null, null,
   'MLS key packages: no app grant; handed out only by chat_claim to a group''s members'),
  -- self
  ('push_token', 'public.push_tokens', 'self', null, 'user_id', null, null, 'push_tokens_all: your own rows only'),
  ('notification_pref', 'public.notification_prefs', 'self', null, 'user_id', null, null,
   'notification_prefs_all: your own rows only'),
  ('account_export', 'public.account_exports', 'self', null, 'user_id', null, null,
   'account_exports_select: your own export requests only'),
  ('chat_device', 'public.chat_devices', 'self', null, 'user_id', null, null,
   'your messenger signing key: no app grant; written by chat_publish_device for auth.uid() only'),
  ('post_view', 'public.post_views', 'self', null, 'user_id', null, null,
   'seen receipts: your own rows; a family-plan author also reads receipts on their own posts (R62 drops this before any link)'),
  -- admin
  ('space', 'public.spaces', 'admin', null, null, 'private.vis_sees_space(uuid,uuid)', null,
   'family settings: every member reads their live family (spaces_select); only the owner changes it'),
  ('space_member', 'public.space_members', 'admin', null, null, null, null,
   'who is in a family: your own row, parents read all, members read the parents (no row id)'),
  ('space_feature', 'public.space_features', 'admin', null, null, null, null,
   'family feature switches: parents only (my_managed_space_ids)'),
  ('space_child', 'public.space_children', 'admin', null, null, null, null,
   'children in a family: parents, guardians, or a child tagged on a post you can see (no row id)'),
  ('invite', 'public.invites', 'admin', null, null, 'private.vis_sees_invite(uuid,uuid)', null,
   'invites: parents of that family only (invites_select)'),
  ('invite_circle', 'public.invite_circles', 'admin', null, null, null, null,
   'an invite''s groups: groups you manage only (no row id)'),
  ('comment_mode_log', 'public.comment_mode_log', 'admin', null, null, null, null,
   'reply-setting history: groups you manage only (bigint id, so can_see says no)'),
  ('household', 'public.households', 'admin', null, null, 'private.vis_sees_household(uuid,uuid)', null,
   'households: their members only (households_select)'),
  ('household_member', 'public.household_members', 'admin', null, null, null, null,
   'household membership: members of that household only (no row id)'),
  -- server
  ('client_error', 'public.client_errors', 'server', null, null, null, null,
   'error reports: insert only through report_client_error; no app user reads them'),
  ('notification_outbox', 'public.notification_outbox', 'server', null, null, null, null,
   'the notice queue: the notify edge function (service role) drains it and rechecks each recipient'),
  ('storage_purge_queue', 'public.storage_purge_queue', 'server', null, null, null, null,
   'B2 objects to delete: filled by triggers, drained by the service role');

-- ---------- 3b. security definer functions app users can call ----------
-- With a kind: its body calls that kind's rule (VIS-5 checks the text). Kind null: allowlisted, with the reason.
-- The oracle (Phase 2, VIS-8) is the backstop for every row here.
insert into vis.functions (fn, kind, note) values
  ('public.can_view_post(uuid)', 'post', 'the app-facing wrapper: private.sees_post(auth.uid(), post)'),
  ('public.delete_post(uuid)', 'post', 'author only, after sees_post'),
  ('public.mark_seen(uuid)', 'post', 'writes your own receipt only for a post you can see'),
  ('public.publish_post(uuid)', 'post', 'author only'),
  ('public.edit_post_words(uuid,text,text)', 'post', 'author only, on a post they can see'),
  ('public.post_viewers(uuid[])', 'post', 'names who can see each post you can see (WHO-1..5)'),
  ('public.reply_scope(uuid)', 'post', 'reply wording for a post you can see'),
  ('public.can_see_reply(uuid,uuid)', 'comment', 'private.reply_ok for the caller'),
  ('public.reply_readers(uuid)', 'comment', 'who reads your reply, for a post you can see'),
  ('public.get_comments(uuid,integer)', 'comment', 'replies filtered by reply_ok'),
  ('public.add_comment(uuid,uuid,text)', 'comment', 'only on a post you can see'),
  ('public.toggle_heart(uuid)', 'reaction', 'only on a post you can see'),
  ('public.set_reaction(uuid,text)', 'reaction', 'only on a post you can see'),
  ('public.reaction_summary(uuid[])', 'reaction', 'counts only for posts you can see'),
  ('public.can_see_circle(uuid)', 'circle', 'is_space_manager or is_circle_member'),
  ('public.rename_circle(uuid,text)', 'circle', 'parents only'),
  ('public.create_level(uuid,text,text)', 'circle', 'parents only'),
  ('public.can_send_to(uuid)', 'circle', 'a group you are in or manage'),
  ('public.chat_list(uuid)', 'chat_group', 'groups you are in or manage'),
  ('public.create_invite(uuid,member_role,uuid[],invite_channel,text,text,interval,integer,text,text)', 'invite',
   'parents only (is_space_manager)'),
  ('public.space_upload_quota(uuid)', 'space', 'your family''s video quota'),
  ('public.set_reply_audience(uuid,text)', 'space', 'owner only (family_settings)'),
  ('public.register_push_token(text,text)', 'push_token', 'writes a token for auth.uid() only'),
  ('public.set_notification_prefs(uuid,boolean,text)', 'notification_pref', 'writes your own prefs only'),
  ('public.request_account_export()', 'account_export', 'requests your own export only'),
  ('public.chat_publish_device(text,text[])', 'chat_device', 'publishes your own device key only'),
  -- allowlist: caller-scoped yes/no checks that read only the caller's own rows and return no one else's data
  ('public.delete_comment(uuid)', null, 'deletes the caller''s own comment, or one on the caller''s own post (is_post_author)'),
  ('public.is_post_author(uuid)', null, 'yes/no: did the caller write this post (author_id = auth.uid())'),
  ('public.is_child_guardian(uuid)', null, 'yes/no about the caller''s own guardian rows'),
  ('public.is_household_member(uuid)', null, 'yes/no about the caller''s own household rows'),
  ('public.is_circle_member(uuid)', null, 'yes/no about the caller''s own group rows'),
  ('public.space_role(uuid)', null, 'the caller''s own role in a family, null when not a member'),
  ('public.is_space_member(uuid)', null, 'yes/no from space_role (the caller''s own row)'),
  ('public.is_space_owner(uuid)', null, 'yes/no from space_role (the caller''s own row)'),
  ('public.is_space_manager(uuid)', null, 'yes/no from space_role (the caller''s own row)'),
  ('public.can_post_in_space(uuid)', null, 'yes/no from space_role and the family setting'),
  ('public.can_comment_in_space(uuid)', null, 'yes/no from space_role and the family setting'),
  ('public.can(uuid,text)', null, 'yes/no permission check from space_role (the caller''s own row)'),
  ('public.child_birth_date(uuid)', null, 'a birth date for guardians only (is_child_guardian)'),
  ('public.can_see_profile(uuid)', null, 'the person rule itself (private.vis_sees_person is its server-side twin; VIS-7)'),
  ('public.my_profile()', null, 'the caller''s own profile only'),
  ('public.set_my_name(text)', null, 'changes the caller''s own name only'),
  ('public.my_spaces()', null, 'families the caller is a member of'),
  ('public.my_features(uuid)', null, 'feature switches via private.feature_on for a family the caller is in'),
  ('public.my_circles(uuid)', null, 'group names for parents only (private.my_managed_space_ids, same as circles_select)'),
  ('public.request_account_deletion()', null, 'deletes the caller''s own account only'),
  ('public.export_my_data()', null, 'the caller''s own data; group names only where private.may_see_circle_name says so (SEC-R1)'),
  ('public.get_feed(uuid,timestamp with time zone,uuid,integer)', null,
   'rows come only from private.visible_posts / feed_rows, which call private.sees_post'),
  ('public.get_timeline(uuid,timestamp with time zone,uuid,integer)', null,
   'rows come only from private.visible_posts / feed_rows, which call private.sees_post'),
  ('public.get_timeline_years(uuid,text)', null, 'counts come only from private.visible_posts (sees_post)'),
  ('public.search_posts(uuid,text,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone,uuid,integer)', null,
   'rows come only from private.visible_posts / feed_rows, which call private.sees_post'),
  ('public.create_post(uuid,uuid,text,uuid[],timestamp with time zone,uuid[],uuid,integer,text)', null,
   'writes the caller''s own post; can_post_in_space and can_send_to for every group'),
  ('public.place_person(uuid,uuid,text)', null, 'parents only (private.managed_circle)'),
  ('public.add_people_from(uuid,uuid,text)', null, 'parents only (private.managed_circle)'),
  ('public.link_level(uuid,uuid,text)', null, 'parents only (private.managed_circle)'),
  ('public.unlink_level(uuid,uuid)', null, 'parents only (private.managed_circle)'),
  ('public.unplace_person(uuid,uuid)', null, 'parents only (private.managed_circle)'),
  ('public.retire_level(uuid)', null, 'parents only (private.managed_circle)'),
  ('public.set_comment_mode(uuid,text)', null, 'parents only (private.managed_circle)'),
  ('public.chat_key_package_count()', null, 'counts the caller''s own key packages'),
  ('public.chat_start(uuid)', null, 'members only (private.chat_member_since)'),
  ('public.chat_roster(uuid)', null, 'members only (private.chat_member_since, chat_people)'),
  ('public.chat_claim(uuid,uuid[])', null, 'members only (private.chat_member_since, chat_people)'),
  ('public.chat_send(uuid,text,bigint,text,uuid)', null, 'members only (private.chat_member_since, chat_people)'),
  ('public.chat_fetch(uuid,bigint,integer)', null, 'members only, rows since they joined (private.chat_member_since)'),
  ('public.start_family(uuid,text,text[])', null, 'creates the caller''s own family (BETA-START)'),
  ('public.can_start_family()', null, 'yes/no about the caller''s own families'),
  ('public.redeem_invite(text)', null, 'joins the caller by a code; wrong codes are rate limited and say not found'),
  ('public.invite_preview(text)', null, 'signed out by design: shows an invite''s first name only for a valid code; rate limited'),
  ('public.report_client_error(text,text,text,text,text)', null,
   'signed out by design: inserts fixed fields only, never reads (BETA-OPS-1)');

-- ---------- 3c. edge functions ----------
insert into vis.edge_functions (name, kind, note) values
  ('sign-media', 'media_item', 'signs a 10-minute URL only after can_view_post for the caller''s own token'),
  ('notify', 'notification_outbox',
   'verify_jwt = false: called by the 1-minute cron with the service key, never by an app user; rechecks each recipient');

-- ---------- 4. RLS forced everywhere; anon holds no table grant ----------
do $$
declare r record;
begin
  for r in select c.oid::regclass as rel, c.relowner::regrole as owner, o.rolsuper or o.rolbypassrls as bypasses
             from pg_catalog.pg_class c
             join pg_catalog.pg_namespace n on n.oid = c.relnamespace
             join pg_catalog.pg_roles o on o.oid = c.relowner
            where n.nspname = 'public' and c.relkind in ('r', 'p') loop
    -- Forcing RLS on a table whose owner doesn't bypass it would hide rows from every security definer function.
    if not r.bypasses then
      raise exception 'VIS-3: % is owned by %, which does not bypass RLS; forcing RLS would change behavior', r.rel, r.owner;
    end if;
    execute format('alter table %s enable row level security', r.rel);
    execute format('alter table %s force row level security', r.rel);
  end loop;
end $$;
revoke all on all tables in schema public from anon;
