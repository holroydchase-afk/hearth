-- 0029: the life calendar v1, birthdays and important dates (CAL-1..10, CAL-18; docs/product/SPEC-LIFE-CALENDAR.md,
-- DEC-81; docs/architecture/02-data-flow.md and 05-access-control.md).
-- * public.family_dates: month and day only. There is no year column and no RPC takes or returns a year or an
--   age (CAL-9): nothing to hide because nothing is asked.
-- * Family-wide: every member of a family reads every date in it (RLS select, and list_family_dates). Nobody
--   else reads any; a date id from another family is "not found" (P0002), same as an unknown id.
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
grant select on public.family_dates to authenticated;
create policy family_dates_select on public.family_dates for select to authenticated
  using (space_id = any ((select private.my_space_ids())::uuid[]));

-- Month and day must name a real date (Feb 29 allowed). The error never repeats what was sent.
create or replace function private.check_month_day(p_month int, p_day int) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_month is null or p_day is null or p_month not between 1 and 12 or p_day < 1
     or p_day > (case p_month when 2 then 29 when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30 else 31 end) then
    raise exception 'That date is not on the calendar.' using errcode = '22023';
  end if;
end $$;

-- 200 dates per family (CAL-10). Plain words, no database terms.
create or replace function private.check_family_dates_room(p_space uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.family_dates where space_id = p_space) >= 200 then
    raise exception 'This family already has 200 dates. Delete one to add another.' using errcode = 'P0001';
  end if;
end $$;
revoke all on function private.check_month_day(int, int), private.check_family_dates_room(uuid) from public, anon, authenticated;

-- Every date in the family, month then day. A member's birthday carries that member's current name.
create or replace function public.list_family_dates(p_space uuid)
returns table (id uuid, kind text, label text, month int, day int, member_id uuid, member_name text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.kind, d.label, d.month::int, d.day::int, d.member_id, p.display_name
    from public.family_dates d
    left join public.profiles p on p.id = d.member_id
   where d.space_id = p_space and public.is_space_member(p_space)
   order by d.month, d.day, d.created_at, d.id
$$;

-- Your own birthday in this family. Null and null clears it.
create or replace function public.set_my_birthday(p_space uuid, p_month int, p_day int) returns void
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null or not public.is_space_member(p_space) then
    raise exception 'Not found.' using errcode = 'P0002';
  end if;
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
