-- START-ON-4 (SPEC-START-FAMILY section 8): turn "start a family" (private.feature_flags start_family_open) on or
-- off, or print whether it is on. Run by scripts/start-family-switch.sh through the Supabase Management API
-- (service role, no psql), which fills in the two psql variables below as quoted SQL literals;
-- tests/suspend_family_test.sql runs it with psql \ir.
--   mode   on | off | status
--   apply  yes | no  (no = dry run: nothing changes; status never changes anything)
-- Only start_family_open changes: no other flag, no family.
create or replace function pg_temp.hearth_start_family_switch(p_mode text, p_apply text)
returns setof text language plpgsql as $$
declare
  v_now  boolean;
  v_want boolean;
  v_word text;
begin
  if p_mode is null or p_mode not in ('on', 'off', 'status') then
    raise exception 'mode must be on, off or status';
  end if;
  if p_apply is null or p_apply not in ('yes', 'no') then
    raise exception 'apply must be yes or no';
  end if;
  v_now := coalesce((select f.enabled from private.feature_flags f where f.feature = 'start_family_open'), false);
  v_word := case when v_now then 'on' else 'off' end;

  if p_mode = 'status' then
    return next format('Start a family is %s.', v_word);
    return;
  end if;
  v_want := p_mode = 'on';
  if v_want = v_now then
    return next format('Start a family is already %s. Nothing changed.', v_word);
    return;
  end if;
  if p_apply <> 'yes' then
    return next format('Dry run: start a family is %s and would be turned %s. Nothing changed. Add --apply to do it.', v_word, p_mode);
    return;
  end if;
  insert into private.feature_flags (feature, enabled) values ('start_family_open', v_want)
  on conflict (feature) do update set enabled = excluded.enabled;
  return next format('Start a family is now %s (was %s).', p_mode, v_word);
end $$;

select line from pg_temp.hearth_start_family_switch(:'mode', :'apply') line;
