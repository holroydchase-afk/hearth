-- VIS-18 (SPEC-VISIBILITY-CORE Phase 5; docs/architecture/07-visibility-model.md): the life calendar (migration 0029,
-- public.family_dates) is attached as a Person-class kind, and vis.can_see covers it with no new person rule: a
-- member's birthday reuses the person rule (private.vis_sees_person, the twin of can_see_profile), and every answer
-- equals what that user's RLS select on family_dates returns today (PRIV-R2). Written FIRST (Nov 24, 2026): red
-- until the registry migration registers family_date.
-- Fixture: supabase/seed.sql (space A: Alex owner; Grandma and Grandpa Rivera, Blair (co-parent, Co-parent group
-- only), Aunt Jo, Grandma Chen viewers. Space B: Blair owner; Grandma Chen and Alex viewers), plus Partner Sky, a
-- viewer in A's Everyone group only, as in family_dates_test.sql's PRIV-R2 setup.
\set ON_ERROR_STOP 1
\pset footer off
\ir harness.sql

\set blair '''b0000000-0000-0000-0000-00000000000b'''

insert into auth.users (id, email, raw_user_meta_data) values
  ('e0000000-0000-0000-0000-0000000000e1', 'sky@example.com', '{"display_name":"Partner Sky"}');
insert into public.space_members (space_id, user_id, role, invited_by) values
  ('22222222-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-0000000000e1', 'viewer', 'a0000000-0000-0000-0000-00000000000a');
-- seed.sql predates 0011's kinds; a real family's Everyone is kind 'everyone' (as in family_dates_test.sql).
update public.circles set kind = 'everyone'
 where id in ('33333333-0000-0000-0000-0000000000a0', '33333333-0000-0000-0000-0000000000b0');
insert into public.circle_members (circle_id, user_id) values
  ('33333333-0000-0000-0000-0000000000a0', 'e0000000-0000-0000-0000-0000000000e1');

-- Dates in both families: members' birthdays and dates with no member.
insert into public.family_dates (id, space_id, kind, label, month, day, member_id, created_by) values
  ('77777777-0000-0000-0000-0000000000a1', '22222222-0000-0000-0000-00000000000a', 'birthday', null, 5, 5,
   'a0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a'),
  ('77777777-0000-0000-0000-0000000000a2', '22222222-0000-0000-0000-00000000000a', 'birthday', null, 3, 3,
   'a0000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-0000000000a1'),
  ('77777777-0000-0000-0000-0000000000a3', '22222222-0000-0000-0000-00000000000a', 'birthday', null, 4, 12,
   'e0000000-0000-0000-0000-0000000000e1', 'e0000000-0000-0000-0000-0000000000e1'),
  ('77777777-0000-0000-0000-0000000000a4', '22222222-0000-0000-0000-00000000000a', 'birthday', null, 8, 18,
   'b0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000b'),
  ('77777777-0000-0000-0000-0000000000a5', '22222222-0000-0000-0000-00000000000a', 'anniversary', 'Anniversary', 6, 1,
   null, 'a0000000-0000-0000-0000-00000000000a'),
  ('77777777-0000-0000-0000-0000000000b1', '22222222-0000-0000-0000-00000000000b', 'birthday', null, 9, 9,
   'b0000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b'),
  ('77777777-0000-0000-0000-0000000000b2', '22222222-0000-0000-0000-00000000000b', 'other', 'Reunion', 7, 4,
   null, 'b0000000-0000-0000-0000-00000000000b');

-- ---------- VIS-18 registered as a Person-class kind ----------
select tests.ok_sql($$select exists (select 1 from vis.kinds where kind = 'family_date'
                                        and relation = 'public.family_dates'::regclass and reach = 'person')$$,
                    'VIS-18 public.family_dates is registered as kind family_date in reach person');
select tests.ok_sql($$select coalesce((select p.prosrc ~ 'vis_sees_person\('
                                         from vis.kinds k join pg_proc p on p.oid = k.rule_fn::oid
                                        where k.kind = 'family_date'), false)$$,
                    'VIS-18 family_date''s rule reuses the person rule (private.vis_sees_person), no new person rule');

-- ---------- VIS-18 can_see equals today's RLS select for every user x every date ----------
create function tests.vis18() returns text language plpgsql as $f$
declare u uuid; d uuid; got boolean; want boolean; bad int := 0; checked int := 0; yes int := 0; first text;
begin
  for d in select id from public.family_dates order by id loop
    for u in select id from auth.users order by id loop
      got := vis.can_see(u, 'family_date', d);
      perform set_config('request.jwt.claim.sub', u::text, true);
      execute 'set local role authenticated';
      select exists (select 1 from public.family_dates where id = d) into want;
      execute 'reset role';
      perform set_config('request.jwt.claim.sub', '', true);
      checked := checked + 1;
      if want then yes := yes + 1; end if;
      if got is distinct from want then
        bad := bad + 1;
        if first is null then first := format('date %s user %s: can_see %s, RLS %s', d, u, got, want); end if;
      end if;
    end loop;
  end loop;
  if checked = 0 then return 'nothing checked'; end if;
  if yes = 0 or yes = checked then return format('vacuous: %s of %s visible', yes, checked); end if;
  return case when bad = 0 then 'ok' else format('%s of %s wrong; first: %s', bad, checked, first) end;
end $f$;
begin;
select tests.setv('vis18', 'select tests.vis18()');
commit;
select tests.ok(tests.v('vis18') = 'ok',
                format('VIS-18 every user and every family date: can_see equals the RLS select (PRIV-R2)  [%s]',
                       coalesce(tests.v('vis18'), 'errored: kind family_date or vis.can_see missing')));

-- Pinned answers, both directions (split family: Blair is in A through the Co-parent group only).
select tests.ok(vis.can_see(:blair, 'family_date', '77777777-0000-0000-0000-0000000000a3') is false,
                'VIS-18 Blair can''t see Partner Sky''s birthday in A (can''t see Sky''s name)');
select tests.ok(vis.can_see(:blair, 'family_date', '77777777-0000-0000-0000-0000000000a5') is false,
                'VIS-18 Blair can''t see A''s anniversary (not in A''s Everyone group)');
select tests.ok(vis.can_see(:blair, 'family_date', '77777777-0000-0000-0000-0000000000a1') is true,
                'VIS-18 Blair sees Alex''s birthday in A (a parent of A)');
select tests.ok(vis.can_see('a0000000-0000-0000-0000-0000000000a1', 'family_date', '77777777-0000-0000-0000-0000000000a5') is true,
                'VIS-18 Grandma Rivera sees A''s anniversary (in A''s Everyone group)');
select tests.ok(vis.can_see('a0000000-0000-0000-0000-0000000000a1', 'family_date', '77777777-0000-0000-0000-0000000000b2') is false,
                'VIS-18 Grandma Rivera can''t see B''s reunion (not in family B)');

-- ---------- report ----------
\o
\pset format aligned
select n, case when ok then 'ok' else 'NOT OK' end as result, description from tests.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tests.results \gset
\echo
\echo VIS CALENDAR RESULT: :passed passed, :failed failed
select :failed = 0 as all_ok \gset
\if :all_ok
\else
  \echo SOME TESTS FAILED
  select 1/0 as force_nonzero_exit;
\endif
