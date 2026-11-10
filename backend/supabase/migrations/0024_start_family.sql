-- 0024: Start a family (DEC-55, SPEC-START-FAMILY "Build design (architect, Nov 7)"). Tests: tests/start_family_test.sql.
-- A signed-in account with no family starts one in the app through start_family(); joining stays invite-only.
--   * private.started_families marks the families made in the app. Only those are capped (500 items or 2 GiB,
--     HF001) until Chase marks them known. Families made by family-setup*.sql are never in it, so never capped.
--   * The start_family_open switch (private.feature_flags) ships OFF.
--   * 3 starts per account per 24 hours (private.rate_limit_events, key 'start:<uid>'); the 1-hour purges in
--     rl_fail and purge_client_errors keep those rows for 24 hours.
--   * redeem_invite retires an empty family the caller started when they join another one (START-7).
--   * create_household / create_space are closed to app users (START-10): start_family is the only app path.
-- Every refusal is a fixed string: no family name, side name, email or id (START-13).

-- ---------------------------------------------------------------------------
-- Which families were started in the app. Private schema: no grants.
-- ---------------------------------------------------------------------------
create table private.started_families (
  space_id    uuid primary key references public.spaces(id) on delete cascade,
  started_by  uuid not null references public.profiles(id) on delete cascade,
  client_id   uuid not null,
  started_at  timestamptz not null default now(),
  known_at    timestamptz,            -- set by Chase (service role) once he knows the family: no cap
  unique (started_by, client_id)
);

insert into private.feature_flags (feature, enabled) values ('start_family_open', false)
on conflict (feature) do nothing;

-- ---------------------------------------------------------------------------
-- Shared checks
-- ---------------------------------------------------------------------------
-- Is the caller a member of any live family?
create or replace function private.in_live_family(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.space_members sm
                   join public.spaces s on s.id = sm.space_id and s.deleted_at is null
                  where sm.user_id = p_user)
$$;

-- Starts by this account in the last 24 hours.
create or replace function private.starts_today(p_user uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from private.rate_limit_events e
   where e.key = 'start:' || p_user::text and e.action = 'start_family' and e.at > now() - interval '24 hours'
$$;

-- Would p_bytes more (and one more item) pass the cap? False for families not started in the app, or known.
create or replace function private.family_over_cap(p_space uuid, p_bytes bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.started_families f where f.space_id = p_space and f.known_at is null)
     and (select count(*) >= 500
              or coalesce(sum(m.byte_size + m.thumb_byte_size), 0) + coalesce(p_bytes, 0) > 2147483648
            from public.media_items m where m.space_id = p_space)
$$;

-- START-12: refuse an upload that would pass the cap. The row lock serializes a family's concurrent uploads.
create or replace function private.family_cap_check(p_space uuid, p_bytes bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from private.started_families f where f.space_id = p_space and f.known_at is null for update;
  if not found then return; end if;
  if private.family_over_cap(p_space, p_bytes) then
    raise exception 'family_full' using errcode = 'HF001';
  end if;
end $$;

revoke execute on function private.in_live_family(uuid), private.starts_today(uuid),
  private.family_over_cap(uuid, bigint), private.family_cap_check(uuid, bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- start_family / can_start_family
-- ---------------------------------------------------------------------------
create or replace function public.start_family(p_client_id uuid, p_name text, p_sides text[] default '{}')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_space uuid;
  v_name  text := btrim(coalesce(p_name, ''));
  v_sides text[] := coalesce(p_sides, '{}');
  v_side  text;
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_client_id is null then raise exception 'a request id is required' using errcode = '23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hearth.start:' || v_uid::text, 0));

  -- the same request again returns the family it made (API.md idempotency)
  select f.space_id into v_space from private.started_families f
   where f.started_by = v_uid and f.client_id = p_client_id;
  if v_space is not null then return v_space; end if;

  if not coalesce((select f.enabled from private.feature_flags f where f.feature = 'start_family_open'), false) then
    raise exception 'starting a family is closed for now' using errcode = '42501';
  end if;
  if private.in_live_family(v_uid) then
    raise exception 'already in a family' using errcode = '23505';
  end if;
  if private.starts_today(v_uid) >= 3 then
    raise exception 'too many families started today' using errcode = '54000';
  end if;
  if char_length(v_name) not between 1 and 60 then
    raise exception 'a family name is 1-60 characters' using errcode = '23514';
  end if;
  if cardinality(v_sides) not in (0, 2) then
    raise exception 'choose no sides or two' using errcode = '23514';
  end if;
  foreach v_side in array v_sides loop
    if char_length(btrim(coalesce(v_side, ''))) not between 1 and 60 then
      raise exception 'a side name is 1-60 characters' using errcode = '23514';
    end if;
  end loop;
  if cardinality(v_sides) = 2 and lower(btrim(v_sides[1])) = lower(btrim(v_sides[2])) then
    raise exception 'the two sides need different names' using errcode = '23514';
  end if;

  -- the definer still holds execute on these (START-10 revokes them from app users only)
  v_space := public.create_space(public.create_household(v_name), v_name);
  foreach v_side in array v_sides loop
    perform public.create_level(v_space, 'group', v_side);   -- a bad name raises 23514: the whole call rolls back
  end loop;

  insert into private.started_families (space_id, started_by, client_id) values (v_space, v_uid, p_client_id);
  insert into private.rate_limit_events (key, action) values ('start:' || v_uid::text, 'start_family');
  return v_space;
end $$;

create or replace function public.can_start_family() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and coalesce((select f.enabled from private.feature_flags f where f.feature = 'start_family_open'), false)
     and not private.in_live_family(auth.uid())
     and private.starts_today(auth.uid()) < 3
$$;

revoke execute on function public.start_family(uuid, text, text[]), public.can_start_family() from public, anon;
grant execute on function public.start_family(uuid, text, text[]), public.can_start_family() to authenticated;

-- START-10: the old functions are for the server only (family-setup*.sql make the family before switching role).
revoke execute on function public.create_household(text), public.create_space(uuid, text) from public, anon, authenticated;
grant execute on function public.create_household(text), public.create_space(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- The media insert trigger: same as 0020 plus the family cap (START-12), for every insert, so prepare_media_upload
-- and a direct insert get the same HF001.
-- ---------------------------------------------------------------------------
create or replace function public.tg_media_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_space   uuid;
  v_plan    public.plan_tier;
  v_month   date;
  v_count   integer;
  v_cap     integer;
  v_now_m   date := (date_trunc('month', now() at time zone 'utc'))::date;
begin
  select p.space_id into v_space from public.posts p where p.id = new.post_id;
  new.space_id    := v_space;
  new.uploader_id := coalesce(auth.uid(), (select author_id from public.posts where id = new.post_id));
  new.id          := coalesce(new.id, gen_random_uuid());
  new.display_key := format('s/%s/p/%s/m/%s/display', v_space, new.post_id, new.id);
  new.thumb_key   := format('s/%s/p/%s/m/%s/thumb',   v_space, new.post_id, new.id);
  new.upload_status := 'pending';

  perform private.family_cap_check(v_space, coalesce(new.byte_size, 0) + coalesce(new.thumb_byte_size, 0));

  if new.kind = 'video' then
    if auth.uid() is not null and not private.feature_on(v_space, 'video_posting') then
      raise exception 'video_posting_off' using errcode = '42501';
    end if;
    select plan, videos_month, videos_this_month into v_plan, v_month, v_count
      from public.spaces where id = v_space;
    if v_month <> v_now_m then v_count := 0; end if;
    v_cap := public.plan_video_cap(v_plan);
    if v_cap is not null then
      -- S14: one row per person per month; the row lock serializes that person's concurrent uploads.
      insert into private.video_usage (user_id, month) values (new.uploader_id, v_now_m) on conflict do nothing;
      if (select u.videos from private.video_usage u
           where u.user_id = new.uploader_id and u.month = v_now_m for update) >= v_cap then
        raise exception 'free_video_cap_reached'
          using errcode = 'P0001',
                hint = format('Each person can send %s videos a month on the free plan.', v_cap);
      end if;
      update private.video_usage set videos = videos + 1 where user_id = new.uploader_id and month = v_now_m;
    end if;
    update public.spaces set videos_month = v_now_m, videos_this_month = v_count + 1 where id = v_space;
  end if;
  return new;
end $$;

-- Same as 0020 plus family_full, so the app can say "Your family is full for now" before photos are picked.
create or replace function public.space_upload_quota(p_space uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not public.is_space_member(p_space) then null else
    jsonb_build_object(
      'plan', s.plan,
      'video_cap', public.plan_video_cap(s.plan),
      'videos_this_month', case when not public.can_post_in_space(p_space) then null
                                else private.videos_this_month(auth.uid()) end,
      'can_post', public.can_post_in_space(p_space),
      'family_full', private.family_over_cap(p_space, 0))
    || case when public.is_space_owner(p_space) then
         jsonb_build_object('plan_status', s.plan_status, 'plan_provider', s.plan_provider,
                            'plan_period_end', s.plan_period_end)
       else '{}'::jsonb end
  end
  from public.spaces s where s.id = p_space
$$;

-- ---------------------------------------------------------------------------
-- Purges: start rows are kept 24 hours (the limit's window), everything else 1 hour as before (0002, 0012).
-- ---------------------------------------------------------------------------
create or replace function private.rl_fail(p_keys text[], p_action text) returns void
language sql security definer set search_path = '' as $$
  insert into private.rate_limit_events (key, action) select unnest(p_keys), p_action;
  delete from private.rate_limit_events
   where (action <> 'start_family' and at < now() - interval '1 hour') or at < now() - interval '24 hours';
$$;

create or replace function public.purge_client_errors() returns void
language sql security definer set search_path = '' as $$
  delete from public.client_errors where at < now() - interval '30 days';
  delete from private.rate_limit_events
   where (action <> 'start_family' and at < now() - interval '1 hour') or at < now() - interval '24 hours';
  update private.secrets set value = encode(extensions.gen_random_bytes(32), 'hex'), created_at = now() where name = 'ip_pepper';
$$;
revoke execute on function public.purge_client_errors() from public, anon, authenticated;
grant execute on function public.purge_client_errors() to service_role;

-- ---------------------------------------------------------------------------
-- redeem_invite: same as 0013 plus START-7. Joining another family retires an empty family the caller started
-- (they are its only member and it has no posts at all, drafts included). The purge removes it later. Its start
-- stays counted, so retiring never resets the 3-a-day limit.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_invite(p_code text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_inv   public.invites;
  v_user  auth.users;
  v_keys  text[];
  v_ok    boolean;
  v_all   boolean;
  v_from  timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  v_keys := private.rl_keys();
  if private.rl_blocked(v_keys) then
    return private.api_error('54000', 'Too many tries. Wait 10 minutes.', 429);
  end if;
  select * into v_inv from public.invites
   where code_hash = private.invite_hash(p_code) or link_hash = private.invite_hash(p_code)
   for update;
  v_ok := found;
  select * into v_user from auth.users where id = auth.uid();
  if not v_ok or v_inv.revoked_at is not null or v_inv.expires_at <= now() or v_inv.use_count >= v_inv.max_uses
     or (v_inv.target_email is not null and lower(coalesce(v_user.email, '')) <> v_inv.target_email)
     or (v_inv.target_phone is not null and coalesce(v_user.phone, '') <> v_inv.target_phone)
     or not exists (select 1 from public.spaces where id = v_inv.space_id and deleted_at is null) then
    perform private.rl_fail(v_keys, 'redeem');
    return private.api_error('22023', 'invite is invalid or expired', 400);
  end if;
  if not private.invite_places(v_inv) then
    return private.api_error('22023', 'invite is invalid or expired', 400);
  end if;

  -- START-7: retire an empty family the caller started in the app
  update public.spaces s set deleted_at = now()
   where s.deleted_at is null and s.id <> v_inv.space_id
     and s.id in (select f.space_id from private.started_families f where f.started_by = auth.uid())
     and not exists (select 1 from public.space_members sm where sm.space_id = s.id and sm.user_id <> auth.uid())
     and not exists (select 1 from public.posts p where p.space_id = s.id);

  -- "Only new photos" starts when the invite was made ("from today on")
  v_from := case when v_inv.role = 'viewer' and v_inv.history = 'new' then v_inv.created_at end;
  -- Everyone when the invite names it, or (an invite made before 0013, PRIV-G2) names a household
  select exists (select 1 from public.invite_circles ic
                 join public.circles c on c.id = ic.circle_id and c.deleted_at is null
                 where ic.invite_id = v_inv.id
                   and (c.kind = 'everyone' or (v_inv.household_means_everyone and c.kind = 'household'))) into v_all;
  insert into public.space_members (space_id, user_id, role, invited_by, sees_from, in_everyone)
  values (v_inv.space_id, auth.uid(), v_inv.role, v_inv.created_by, v_from, v_all)
  on conflict (space_id, user_id) do nothing;          -- never silently changes an existing role or choice
  -- one placement per named live group (memberships are derived from it; no direct circle_members rows)
  insert into public.circle_people (circle_id, user_id, sees_from, added_by)
  select ic.circle_id, auth.uid(), v_from, v_inv.created_by from public.invite_circles ic
   join public.circles c on c.id = ic.circle_id and c.deleted_at is null and c.kind <> 'everyone'
   where ic.invite_id = v_inv.id
  on conflict do nothing;
  insert into public.notification_prefs (user_id, space_id, push, email_digest)
  values (auth.uid(), v_inv.space_id, true, case when v_inv.role = 'viewer' then 'weekly'::public.digest_freq else 'off' end)
  on conflict do nothing;
  if v_inv.invitee_name is not null then
    update public.profiles set display_name = v_inv.invitee_name, name_set = true
    where id = auth.uid() and not name_set;
  end if;
  update public.invites set use_count = use_count + 1 where id = v_inv.id;
  return to_json(v_inv.space_id);
end $$;
