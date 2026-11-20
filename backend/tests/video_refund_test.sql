-- ENG-R2, ENG-R11, SEC-R7 (2026-11-19 tech-debt review): the free video cap before video is switched on.
-- Written FIRST: red until migration 0029 lands.
--   ENG-R2  a video that never reached 'ready' (deleted while pending, its draft thrown away by the upload queue's
--           restart(), or marked 'failed') gives its count back; a 'ready' video that's later deleted does not (0020).
--           The counter never goes below 0, and the 10-a-month cap still holds.
--   ENG-R11 the cap refusal has its own SQLSTATE, HF002 (message still free_video_cap_reached). HF001 is already
--           family_full (0024, API.md), so the cap can't reuse it or sign-media would mix the two up.
--   SEC-R7  private.videos_this_month(uuid) is SECURITY DEFINER: nobody but the owner may EXECUTE it.
-- Seed: Alex owns space A (free) and already has 1 video there; Blair owns space B (family plan, no cap).
\set ON_ERROR_STOP 1
\pset footer off
\ir harness.sql

\set as_admin 'reset role; select set_config(''request.jwt.claim.sub'', '''', false);'
\set as_alex  'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-00000000000a'', false);'
\set as_blair 'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''b0000000-0000-0000-0000-00000000000b'', false);'
\set space_a  '''22222222-0000-0000-0000-00000000000a'''
\set space_b  '''22222222-0000-0000-0000-00000000000b'''
\set dad_side '''33333333-0000-0000-0000-0000000000a1'''

-- n video items, as sign-media sends them
create function tests.videos(p_post text, p_n integer) returns text language sql as $$
  select format($q$select * from public.prepare_media_upload(%L, %L::jsonb)$q$, p_post,
    (select jsonb_agg(jsonb_build_object('kind','video','mime_type','video/mp4','width',1280,'height',720,'duration_ms',5000,
                                         'byte_size',1000,'thumb_byte_size',10,'exif_stripped',true))
       from generate_series(1, p_n))::text)
$$;
-- a fresh draft in space A, as the upload queue makes one
create function tests.draft_a() returns text language sql as $$
  select format($q$select public.create_post(gen_random_uuid(), '22222222-0000-0000-0000-00000000000a', null,
                  array['33333333-0000-0000-0000-0000000000a1']::uuid[])$q$)
$$;
-- someone's count this month (read as admin: the table is private)
create function tests.used(p_user text) returns integer language sql security definer as $$
  select coalesce((select videos from private.video_usage
                    where user_id = p_user::uuid and month = (date_trunc('month', now() at time zone 'utc'))::date), 0)
$$;
-- a cap refusal's SQLSTATE and message, or null when nothing was raised
create function tests.err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;
\set alex '''a0000000-0000-0000-0000-00000000000a'''
\set blair '''b0000000-0000-0000-0000-00000000000b'''

:as_admin
insert into private.feature_flags (feature, enabled) values ('video_posting', true) on conflict (feature) do update set enabled = true;
insert into public.space_features (space_id, feature, enabled) values (:space_a, 'video_posting', true), (:space_b, 'video_posting', true);
select tests.setv('base', format('select tests.used(%L)', :alex));
select tests.ok(tests.v('base') is not null, 'ENG-R2 setup: Alex''s count this month is readable');

-- ---------- ENG-R2-1: the upload queue's restart() three times spends one video, not three ----------
-- restart() calls delete_post on the unfinished draft (its media rows are still 'pending') and prepares a new one.
:as_alex
select tests.setv('r1', tests.draft_a());
select tests.try(tests.videos(tests.v('r1'), 1));
select tests.try(format('select public.delete_post(%L)', tests.v('r1')));
select tests.setv('r2', tests.draft_a());
select tests.try(tests.videos(tests.v('r2'), 1));
select tests.try(format('select public.delete_post(%L)', tests.v('r2')));
select tests.setv('r3', tests.draft_a());
select tests.try(tests.videos(tests.v('r3'), 1));
:as_admin
select tests.ok_sql(format('select tests.used(%L) = %s + 1', :alex, tests.v('base')),
                    'ENG-R2-1 a video upload restarted 3x (drafts thrown away while pending) counts once');

-- ---------- ENG-R2-2: a failed upload gives its video back ----------
select tests.setv('n_before_fail', format('select tests.used(%L)', :alex));
:as_alex
select tests.setv('p_fail', tests.draft_a());
select tests.setv('m_fail', format('select media_id from (%s) x', tests.videos(tests.v('p_fail'), 1)));
:as_admin
select tests.ok_sql(format('select tests.used(%L) = %s + 1', :alex, tests.v('n_before_fail')),
                    'ENG-R2-2 setup: preparing a video counts it');
select tests.lives(format('select public.mark_media_upload_result(%L, false)', tests.v('m_fail')),
                   'ENG-R2-2 sign-media marks the upload failed');
select tests.ok_sql(format('select tests.used(%L) = %s', :alex, tests.v('n_before_fail')),
                    'ENG-R2-2 a failed video gives the month''s count back');

-- ---------- ENG-R2-3: failed, then deleted, gives it back once, not twice ----------
select tests.setv('n_after_fail', format('select tests.used(%L)', :alex));
:as_alex
select tests.lives(format('delete from public.media_items where id = %L', tests.v('m_fail')),
                   'ENG-R2-3 Alex deletes his failed video row');
:as_admin
select tests.ok_sql(format('select tests.used(%L) = %s', :alex, tests.v('n_after_fail')),
                    'ENG-R2-3 deleting an already-failed video does not give it back a second time');

-- ---------- ENG-R2-4: deleting a still-pending video row gives it back ----------
select tests.setv('n_before_del', format('select tests.used(%L)', :alex));
:as_alex
select tests.setv('p_del', tests.draft_a());
select tests.setv('m_del', format('select media_id from (%s) x', tests.videos(tests.v('p_del'), 1)));
select tests.lives(format('delete from public.media_items where id = %L', tests.v('m_del')),
                   'ENG-R2-4 Alex deletes a pending video row');
:as_admin
select tests.ok_sql(format('select tests.used(%L) = %s', :alex, tests.v('n_before_del')),
                    'ENG-R2-4 a pending video that is deleted gives its count back');

-- ---------- ENG-R2-5: an uploaded video that's later deleted does NOT give the month back (0020) ----------
:as_alex
select tests.setv('p_ok', tests.draft_a());
select tests.setv('m_ok', format('select media_id from (%s) x', tests.videos(tests.v('p_ok'), 1)));
:as_admin
insert into public.media_keys (media_id, wrapped_dek) values (tests.v('m_ok')::uuid, '\x00');
select public.mark_media_upload_result(tests.v('m_ok')::uuid, true);
select tests.ok_sql(format($$select upload_status = 'ready' from public.media_items where id = %L$$, tests.v('m_ok')),
                    'ENG-R2-5 setup: the video uploaded (ready)');
select tests.setv('n_after_ok', format('select tests.used(%L)', :alex));
:as_alex
select tests.try(format('select public.delete_post(%L)', tests.v('p_ok')));
:as_admin
delete from public.media_items where id = tests.v('m_ok')::uuid;   -- as the purge worker would
select tests.ok_sql(format('select tests.used(%L) = %s', :alex, tests.v('n_after_ok')),
                    'ENG-R2-5 deleting an uploaded video (post deleted, row purged) keeps it counted');

-- ---------- ENG-R2-6: the 10-a-month cap still holds, and a failed upload frees its slot ----------
select tests.setv('left', format('select 10 - tests.used(%L)', :alex));
:as_alex
select tests.setv('p_cap', tests.draft_a());
select tests.lives(tests.videos(tests.v('p_cap'), tests.v('left')::int), 'ENG-R2-6 Alex sends videos up to 10 this month');
select tests.ok(tests.err(tests.videos(tests.v('p_cap'), 1)) like '% free_video_cap_reached',
                'ENG-R2-6 the 11th is still refused (free_video_cap_reached)');
:as_admin
select tests.ok_sql(format('select tests.used(%L) = 10', :alex), 'ENG-R2-6 the counter stops at 10');
select tests.setv('m_cap', format($$select id from public.media_items where post_id = %L order by position desc limit 1$$, tests.v('p_cap')));
select tests.try(format('select public.mark_media_upload_result(%L, false)', tests.v('m_cap')));
:as_alex
select tests.lives(tests.videos(tests.v('p_cap'), 1), 'ENG-R2-6 once one of the 10 fails, Alex can send one more');
select tests.ok(tests.err(tests.videos(tests.v('p_cap'), 1)) like '% free_video_cap_reached',
                'ENG-R2-6 and then he is at the cap again');

-- ---------- ENG-R2-7: the counter never goes below 0 ----------
:as_alex
select tests.setv('p_neg', tests.draft_a());
:as_admin
delete from private.video_usage where user_id = :alex::uuid;   -- start the month clean so there's room
:as_alex
select tests.setv('m_neg', format('select media_id from (%s) x', tests.videos(tests.v('p_neg'), 2)));
:as_admin
update private.video_usage set videos = 0 where user_id = :alex::uuid;   -- e.g. a row already given back by hand
select tests.lives(format('select public.mark_media_upload_result(%L, false)', tests.v('m_neg')),
                   'ENG-R2-7 marking a video failed when the counter is already 0 does not error');
:as_alex
select tests.lives(format($$delete from public.media_items where post_id = %L and upload_status = 'pending'$$, tests.v('p_neg')),
                   'ENG-R2-7 nor does deleting a pending one');
:as_admin
select tests.ok_sql(format('select tests.used(%L) = 0', :alex), 'ENG-R2-7 the counter stays at 0, never negative');

-- ---------- ENG-R2-8: a paid family's failed video makes no usage row ----------
:as_blair
select tests.setv('p_b', $$select public.create_post(gen_random_uuid(), '22222222-0000-0000-0000-00000000000b', null,
                             array['33333333-0000-0000-0000-0000000000b1']::uuid[])$$);
select tests.setv('m_b', format('select media_id from (%s) x', tests.videos(tests.v('p_b'), 1)));
:as_admin
select tests.lives(format('select public.mark_media_upload_result(%L, false)', tests.v('m_b')),
                   'ENG-R2-8 a paid family''s video can fail');
select tests.ok_sql(format('select not exists (select 1 from private.video_usage where user_id = %L)', :blair),
                    'ENG-R2-8 and still has no free-cap usage row');

-- ---------- ENG-R11: the cap refusal has its own SQLSTATE ----------
:as_admin
delete from private.video_usage where user_id = :alex::uuid;
insert into private.video_usage (user_id, month, videos) values (:alex::uuid, (date_trunc('month', now() at time zone 'utc'))::date, 10);
:as_alex
select tests.setv('p_code', tests.draft_a());
select tests.throws_code(tests.videos(tests.v('p_code'), 1),
                         'ENG-R11 the free video cap is refused with SQLSTATE HF002, not generic P0001', 'HF002');
select tests.ok(tests.err(tests.videos(tests.v('p_code'), 1)) = 'HF002 free_video_cap_reached',
                'ENG-R11 the message is still free_video_cap_reached');

-- ---------- SEC-R7: only definer functions may call private.videos_this_month ----------
:as_admin
select tests.ok_sql($$select not exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                       where p.oid = 'private.videos_this_month(uuid)'::regprocedure
                         and a.grantee = 0 and a.privilege_type = 'EXECUTE')$$,
                    'SEC-R7 PUBLIC has no EXECUTE on private.videos_this_month(uuid)');
select tests.ok_sql($$select not has_function_privilege('authenticated', 'private.videos_this_month(uuid)', 'EXECUTE')$$,
                    'SEC-R7 authenticated has no EXECUTE on private.videos_this_month(uuid)');
select tests.ok_sql($$select not has_function_privilege('anon', 'private.videos_this_month(uuid)', 'EXECUTE')$$,
                    'SEC-R7 anon has no EXECUTE on private.videos_this_month(uuid)');
:as_blair
select tests.throws_code(format('select private.videos_this_month(%L)', :alex),
                         'SEC-R7 Blair can''t read Alex''s video count directly', '42501');
:as_alex
select tests.ok_sql(format($$select (public.space_upload_quota(%L)->>'videos_this_month')::int = 10$$, :space_a),
                    'SEC-R7 Alex still sees his own count through space_upload_quota');

-- ---------- PRIV-R1 (privacy-security, 0029 review): no app role touches the refund table ----------
:as_admin
select tests.ok_sql($$select not has_table_privilege('authenticated', 'private.video_refundable', 'SELECT,INSERT,UPDATE,DELETE')$$,
                    'PRIV-R1 authenticated has no privilege on private.video_refundable');
select tests.ok_sql($$select not has_table_privilege('anon', 'private.video_refundable', 'SELECT,INSERT,UPDATE,DELETE')$$,
                    'PRIV-R1 anon has no privilege on private.video_refundable');

-- ---------- report ----------
\o
\pset format aligned
select n, case when ok then 'ok' else 'NOT OK' end as result, description from tests.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tests.results \gset
\echo
\echo VIDEO REFUND RESULT: :passed passed, :failed failed
select :failed = 0 as all_ok \gset
\if :all_ok
\else
  \echo SOME TESTS FAILED
  select 1/0 as force_nonzero_exit;
\endif
