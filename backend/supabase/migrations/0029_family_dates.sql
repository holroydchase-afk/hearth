-- 0029: the life calendar v1, birthdays and important dates (CAL-1..10, CAL-18; docs/product/SPEC-LIFE-CALENDAR.md,
-- DEC-81; docs/architecture/02-data-flow.md and 05-access-control.md).
-- * public.family_dates: month and day only. There is no year column and no RPC takes or returns a year or an
--   age (CAL-9): nothing to hide because nothing is asked.
-- * Dates follow who sees a name (PRIV-R2): a member's birthday reads only where public.can_see_profile(member)
--   holds; a date with no member (an anniversary, "something else", a child's birthday by name) reads only to the
--   family's parents and the members of its Everyone group. RLS select and list_family_dates alike. Anybody
--   else, and any id from another family, gets "not found" (P0002), same as an unknown id.
-- * Members read only the date columns (PRIV-R1): who added a date and when (created_by, created_at, updated_at)
--   stays with the server and the export.
-- * The 200 cap holds under concurrent adds: the write RPCs lock the family's spaces row first (PRIV-R5).
-- * export_my_data carries your own birthdays and the dates you added (PRIV-R3).
-- * Writes only through the four RPCs (security definer, search_path ''): any member sets their own birthday;
--   parents (owner, adult) add, change and delete any date; a viewer may delete only their own birthday.
-- * A member-linked date goes when that member leaves the family (composite FK to space_members, cascade).
-- * Labels are never logged, never repeated in an error and never put in a notice (CAL-18).
-- NO CONTENT IS USED FOR AI/ML TRAINING, ADVERTISING OR PROFILING (see 0001 header).

create table public.family_dates (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  kind        text not null check (kind in ('birthday', 'anniversary', 'other')),
  label       text check (label is null or (char_length(label) between 1 and 60 and label = btrim(label))),
  month       smallint not null check (month between 1 and 12),
  day         smallint not null check (day between 1 and 31),
  member_id   uuid,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- a real day of the month (Feb 29 allowed)
  constraint family_dates_real_day check (day <= case month when 2 then 29 when 4 then 30 when 6 then 30
                                                             when 9 then 30 when 11 then 30 else 31 end),
  -- a member-linked date is that member's birthday and carries no label (their current name is shown)
  constraint family_dates_member_birthday check (member_id is null or (kind = 'birthday' and label is null)),
  constraint family_dates_has_name check (member_id is not null or label is not null),
  -- leaving the family takes your birthday there with you (CAL-8)
  constraint family_dates_member_fk foreign key (space_id, member_id)
    references public.space_members (space_id, user_id) on delete cascade
);
create unique index family_dates_one_birthday on public.family_dates (space_id, member_id) where member_id is not null;
create index family_dates_space on public.family_dates (space_id, month, day);
create index family_dates_created_by on public.family_dates (created_by);
create trigger set_updated_at before update on public.family_dates for each row execute function public.tg_set_updated_at();

alter table public.family_dates enable row level security;
revoke all on public.family_dates from public, anon, authenticated;
-- PRIV-R1: the date columns only, never who added it or when
grant select (id, space_id, kind, label, month, day, member_id) on public.family_dates to authenticated;

-- PRIV-R2: may the caller see this date? A member's birthday follows who may see that member's name; a date with
-- no member goes to the family's parents and its Everyone group only. Members of the family only, in both cases.
create or replace function private.may_see_family_date(p_space uuid, p_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_space_member(p_space)
     and (public.is_space_manager(p_space)
          or case when p_member is not null then public.can_see_profile(p_member)
                  else exists (select 1 from public.circles c
                                where c.space_id = p_space and c.kind = 'everyone' and c.deleted_at is null
                                  and c.id = any (private.my_circle_ids())) end)
$$;
revoke all on function private.may_see_family_date(uuid, uuid) from public, anon;
grant execute on function private.may_see_family_date(uuid, uuid) to authenticated;   -- the RLS policy calls it

create policy family_dates_select on public.family_dates for select to authenticated
  using (space_id = any ((select private.my_space_ids())::uuid[]) and private.may_see_family_date(space_id, member_id));

-- Month and day must name a real date (Feb 29 allowed). The error never repeats what was sent.
create or replace function private.check_month_day(p_month int, p_day int) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_month is null or p_day is null or p_month not between 1 and 12 or p_day < 1
     or p_day > (case p_month when 2 then 29 when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30 else 31 end) then
    raise exception 'That date is not on the calendar.' using errcode = '22023';
  end if;
end $$;

-- PRIV-R5: writers take the family's spaces row (FOR NO KEY UPDATE) first, so two adds can't both pass the count.
create or replace function private.lock_family_dates(p_space uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.spaces where id = p_space for no key update;
end $$;

-- 200 dates per family (CAL-10). Plain words, no database terms. Call with the spaces row locked (above).
create or replace function private.check_family_dates_room(p_space uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.family_dates where space_id = p_space) >= 200 then
    raise exception 'This family already has 200 dates. Delete one to add another.' using errcode = 'P0001';
  end if;
end $$;
revoke all on function private.check_month_day(int, int), private.check_family_dates_room(uuid),
  private.lock_family_dates(uuid) from public, anon, authenticated;

-- Every date in the family the caller may see (PRIV-R2), month then day, ties by id. A member's birthday carries
-- that member's current name.
create or replace function public.list_family_dates(p_space uuid)
returns table (id uuid, kind text, label text, month int, day int, member_id uuid, member_name text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.kind, d.label, d.month::int, d.day::int, d.member_id, p.display_name
    from public.family_dates d
    left join public.profiles p on p.id = d.member_id
   where d.space_id = p_space and private.may_see_family_date(d.space_id, d.member_id)
   order by d.month, d.day, d.id
$$;

-- Your own birthday in this family. Null and null clears it.
create or replace function public.set_my_birthday(p_space uuid, p_month int, p_day int) returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null or not public.is_space_member(p_space) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  perform private.lock_family_dates(p_space);
  if p_month is null and p_day is null then
    delete from public.family_dates where space_id = p_space and member_id = v_me;
    return;
  end if;
  perform private.check_month_day(p_month, p_day);
  if exists (select 1 from public.family_dates where space_id = p_space and member_id = v_me) then
    update public.family_dates set month = p_month, day = p_day
     where space_id = p_space and member_id = v_me;
  else
    perform private.check_family_dates_room(p_space);
    insert into public.family_dates (space_id, kind, label, month, day, member_id, created_by)
    values (p_space, 'birthday', null, p_month, p_day, v_me, v_me);
  end if;
end $$;

-- Parents (owner, adult) add (p_id null) or change any date. Returns the date's id.
-- p_member links a member's birthday (no label: their name is shown); one per member per family.
create or replace function public.save_family_date(p_space uuid, p_id uuid, p_kind text, p_label text,
                                                   p_month int, p_day int, p_member uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_label text := nullif(btrim(coalesce(p_label, '')), '');
  v_id uuid;
begin
  if v_me is null or not public.is_space_manager(p_space) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  perform private.lock_family_dates(p_space);
  if p_id is not null and not exists (select 1 from public.family_dates where id = p_id and space_id = p_space) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  if p_member is not null and not exists (select 1 from public.space_members where space_id = p_space and user_id = p_member) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  if p_kind is null or p_kind not in ('birthday', 'anniversary', 'other') then
    raise exception 'Choose birthday, anniversary or something else.' using errcode = '22023';
  end if;
  if p_member is not null then
    if p_kind <> 'birthday' then
      raise exception 'Only a birthday can belong to a member.' using errcode = '22023';
    end if;
    v_label := null;
  elsif v_label is null or char_length(v_label) > 60 then
    raise exception 'Give it a name of 1 to 60 letters.' using errcode = '22023';
  end if;
  perform private.check_month_day(p_month, p_day);

  if p_id is null and p_member is not null then
    -- one birthday per member per family: a second one changes the first
    select d.id into v_id from public.family_dates d where d.space_id = p_space and d.member_id = p_member;
  else
    v_id := p_id;
  end if;

  if v_id is null then
    perform private.check_family_dates_room(p_space);
    insert into public.family_dates (space_id, kind, label, month, day, member_id, created_by)
    values (p_space, p_kind, v_label, p_month, p_day, p_member, v_me)
    returning id into v_id;
  else
    if p_member is not null and exists (select 1 from public.family_dates d
                                         where d.space_id = p_space and d.member_id = p_member and d.id <> v_id) then
      raise exception 'That member already has a birthday here.' using errcode = '22023';
    end if;
    update public.family_dates
       set kind = p_kind, label = v_label, month = p_month, day = p_day, member_id = p_member
     where id = v_id;
  end if;
  return v_id;
end $$;

-- Parents delete any date in their family; anyone may delete their own birthday. Otherwise "not found".
create or replace function public.delete_family_date(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_row public.family_dates;
begin
  select * into v_row from public.family_dates where id = p_id;
  if not found or auth.uid() is null
     or not coalesce(private.may_see_family_date(v_row.space_id, v_row.member_id), false)
     or not coalesce(public.is_space_manager(v_row.space_id)
                     or (v_row.member_id = auth.uid() and public.is_space_member(v_row.space_id)), false) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
  delete from public.family_dates where id = p_id;
end $$;

revoke all on function public.list_family_dates(uuid), public.set_my_birthday(uuid, int, int),
  public.save_family_date(uuid, uuid, text, text, int, int, uuid), public.delete_family_date(uuid) from public, anon;
grant execute on function public.list_family_dates(uuid), public.set_my_birthday(uuid, int, int),
  public.save_family_date(uuid, uuid, text, text, int, int, uuid), public.delete_family_date(uuid) to authenticated;

-- PRIV-R3: the export (0027's, unchanged otherwise) gains family_dates.
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
    -- PRIV-R3: your own birthdays and the dates you added; nobody else's
    'family_dates', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'space_id', d.space_id, 'kind', d.kind,
                       'label', d.label, 'month', d.month, 'day', d.day, 'member_id', d.member_id,
                       'created_at', d.created_at, 'updated_at', d.updated_at) order by d.month, d.day, d.id), '[]')
                     from public.family_dates d where d.member_id = auth.uid() or d.created_by = auth.uid())
  )
$$;
