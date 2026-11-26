-- START-ON-3 (SPEC-START-FAMILY section 8, PRIV-R7): suspend a family, undo it, or mark it known (lift the cap).
-- Run by scripts/suspend-family.sh through the Supabase Management API (service role, no psql), which fills in the
-- three psql variables below as quoted SQL literals; tests/suspend_family_test.sql runs it with psql \ir.
--   space_id  the family's space id (uuid)
--   action    suspend | undo | known
--   apply     yes | no  (no = dry run: nothing changes)
-- Suspending sets spaces.deleted_at (no new migration): every member then finds nothing (rule 2: not found) and
-- uploads are refused. Undo clears deleted_at and the family comes back unchanged. purge_soft_deleted() can remove
-- families suspended over 30 days ago, but it is not scheduled on the hosted project (SEC-R1). Known sets private.started_families.known_at.
-- An unknown space id raises an error and changes nothing. Every line printed carries only the space id: no family,
-- group or member name, no email.
create or replace function pg_temp.hearth_suspend_family(p_space text, p_action text, p_apply text)
returns setof text language plpgsql as $$
declare
  v_space   uuid := p_space::uuid;
  v_apply   boolean;
  v_deleted timestamptz;
  v_known   timestamptz;
  v_started boolean;
  v_purge   constant text := '--undo brings it back unchanged. purge_soft_deleted can remove families suspended over 30 days ago, but it is not scheduled, so nothing (photos included) is deleted on its own.';
begin
  if p_action is null or p_action not in ('suspend', 'undo', 'known') then
    raise exception 'action must be suspend, undo or known';
  end if;
  if p_apply is null or p_apply not in ('yes', 'no') then
    raise exception 'apply must be yes or no';
  end if;
  v_apply := p_apply = 'yes';

  select s.deleted_at into v_deleted from public.spaces s where s.id = v_space for update;
  if not found then
    raise exception 'No family has space id % (or it was purged for good). Nothing changed.', v_space;
  end if;

  if p_action = 'suspend' then
    if v_deleted is not null then
      return next format('Family %s is already suspended (since %s). Nothing changed.', v_space, v_deleted);
      return next v_purge;
      return;
    end if;
    if v_apply then
      update public.spaces set deleted_at = now() where id = v_space;
      return next format('Suspended family %s: every member now finds nothing and uploads to it are refused.', v_space);
      return next v_purge;
      return next format('To undo: bash scripts/suspend-family.sh --space %s --undo --apply', v_space);
    else
      return next format('Dry run: would suspend family %s. Nothing changed. Add --apply to suspend it.', v_space);
      return next v_purge;
    end if;

  elsif p_action = 'undo' then
    if v_deleted is null then
      return next format('Family %s is not suspended. Nothing changed.', v_space);
      return;
    end if;
    if v_apply then
      update public.spaces set deleted_at = null where id = v_space;
      return next format('Brought back family %s: its members see it again, unchanged.', v_space);
    else
      return next format('Dry run: would bring back family %s (suspended since %s). Nothing changed. Add --apply to undo.',
                         v_space, v_deleted);
    end if;

  else  -- known
    select true, f.known_at into v_started, v_known from private.started_families f where f.space_id = v_space for update;
    if v_started is null then
      return next format('Family %s was not started in the app, so it has no cap. Nothing changed.', v_space);
      return;
    end if;
    if v_known is not null then
      return next format('Family %s is already known (since %s): no cap. Nothing changed.', v_space, v_known);
      return;
    end if;
    if v_apply then
      update private.started_families set known_at = now() where space_id = v_space;
      return next format('Marked family %s known: its cap (500 items or 2 GiB) is lifted.', v_space);
    else
      return next format('Dry run: would mark family %s known and lift its cap. Nothing changed. Add --apply to do it.', v_space);
    end if;
  end if;
end $$;

select line from pg_temp.hearth_suspend_family(:'space_id', :'action', :'apply') line;
