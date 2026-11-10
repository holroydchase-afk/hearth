-- BETA-SMS-8, -9, -13, -15 (SPEC-SMS-SIGN-IN, DEC-56): text message sign-in, the database side.
-- Phone invites match the number in the form Supabase Auth stores it (with or without the '+'), invite_preview says how
-- to sign in and never names the target, phone-only accounts get push and never an email batch, and no phone number is
-- kept in an error report or a raised message. Written FIRST: red until the SMS migration lands.
-- Numbers are fictional 555-01xx numbers. auth.users.phone: SMS-PROVIDER.md section 5 expects '13045550100' (no '+');
-- unconfirmed on a live stack, so both forms are tested.
\set ON_ERROR_STOP 1
\pset footer off
\ir harness.sql

\set as_admin 'reset role; select set_config(''request.jwt.claim.sub'', '''', false);'
\set as_anon  'reset role; set role anon; select set_config(''request.jwt.claim.sub'', '''', false);'
\set as_alex  'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''a0000000-0000-0000-0000-00000000000a'', false);'
\set as_gammy 'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''e0000000-0000-0000-0000-0000000000e1'', false);'
\set as_pawpaw 'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''e0000000-0000-0000-0000-0000000000e2'', false);'
\set as_wrong 'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''e0000000-0000-0000-0000-0000000000e3'', false);'
\set as_mailonly 'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''e0000000-0000-0000-0000-0000000000e4'', false);'
\set as_nophone 'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''e0000000-0000-0000-0000-0000000000e5'', false);'
\set as_nana  'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''e0000000-0000-0000-0000-0000000000e6'', false);'
\set as_papa  'reset role; set role authenticated; select set_config(''request.jwt.claim.sub'', ''e0000000-0000-0000-0000-0000000000e7'', false);'
\set space_a  '''22222222-0000-0000-0000-00000000000a'''
\set c_a_gp   '''33333333-0000-0000-0000-0000000000a1'''
\set gma_riv  '''a0000000-0000-0000-0000-0000000000a1'''

:as_admin
-- Phone-only accounts have no email (SPEC-SMS-SIGN-IN 3.6). Gammy signed up without a name, like a real text sign-in.
insert into auth.users (id, email, phone, raw_user_meta_data) values
  ('e0000000-0000-0000-0000-0000000000e1', null, '13045550100', '{}'),                                  -- Supabase form, no '+'
  ('e0000000-0000-0000-0000-0000000000e2', null, '+13045550111', '{"display_name":"Pawpaw"}'),          -- E.164 form
  ('e0000000-0000-0000-0000-0000000000e3', null, '13045550199', '{"display_name":"Wrong Number"}'),
  ('e0000000-0000-0000-0000-0000000000e4', 'mailonly@example.com', null, '{"display_name":"Aunt Mae"}'),
  ('e0000000-0000-0000-0000-0000000000e5', null, null, '{"display_name":"Uncle Bo"}'),
  ('e0000000-0000-0000-0000-0000000000e6', null, '13045550122', '{"display_name":"Nana"}'),
  ('e0000000-0000-0000-0000-0000000000e7', null, '13045550133', '{"display_name":"Papa"}');

-- The SQLSTATE plus every word a refusal carries (message, detail, hint); null when nothing was raised.
create function tests.err_text(p_sql text) returns text language plpgsql as $$
declare m text; d text; h text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics m = message_text, d = pg_exception_detail, h = pg_exception_hint;
  return sqlstate || ': ' || coalesce(m, '') || ' ' || coalesce(d, '') || ' ' || coalesce(h, '');
end $$;
-- A US number in any common shape: 10 digits, maybe a leading 1, maybe separators.
create function tests.has_phone(p_text text) returns boolean language sql immutable as $$
  select coalesce(p_text, '') ~ '(\+?1[^0-9]{0,2})?\(?[0-9]{3}\)?[^0-9]{0,2}[0-9]{3}[^0-9]?[0-9]{4}' $$;
-- Published post by p_author to one circle (copied from notify_test.sql).
create function tests.mkpost(p_author uuid, p_circle uuid, p_caption text) returns uuid language plpgsql as $$
declare v_post uuid := gen_random_uuid(); v_space uuid;
begin
  select space_id into v_space from public.circles where id = p_circle;
  insert into public.posts (id, space_id, author_id, caption) values (v_post, v_space, p_author, p_caption);
  insert into public.post_audiences (post_id, circle_id) values (v_post, p_circle);
  insert into public.post_children (post_id, child_id) values (v_post, '44444444-0000-0000-0000-000000000001');
  insert into public.media_items (post_id, space_id, uploader_id, position, kind, mime_type, display_key, thumb_key,
                                  width, height, byte_size, thumb_byte_size, exif_stripped)
  values (v_post, v_space, p_author, 0, 'photo', 'image/jpeg', 'k', 't', 100, 100, 1000, 100, true);
  update public.posts set status = 'published' where id = v_post;
  return v_post;
end $$;
create table tests.batches as select * from public.claim_notification_batches(now()) limit 0;
grant execute on all functions in schema tests to authenticated, anon;

-- A phone invite, as the app makes it (create_invite with channel 'sms' and an E.164 target).
create function tests.phone_invite(p_phone text) returns text language sql as $$
  select format($q$select code from public.create_invite(%L, 'viewer', array[%L]::uuid[], 'sms', p_target_phone => %L, p_history => 'all')$q$,
                '22222222-0000-0000-0000-00000000000a', '33333333-0000-0000-0000-0000000000a1', p_phone) $$;
grant execute on function tests.phone_invite(text) to authenticated;

-- ======================================================================
-- BETA-SMS-8: create_invite stores the target as E.164 and refuses a non-US number with a coded error
-- ======================================================================
:as_alex
select tests.setv('inv_gammy',  tests.phone_invite('+13045550100'));
select tests.setv('inv_pawpaw', tests.phone_invite('+13045550111'));
select tests.ok_sql($$select tests.v('inv_gammy') is not null and tests.v('inv_pawpaw') is not null$$,
                    'BETA-SMS-8 setup: a parent makes phone invites (channel sms, E.164 target)');
select tests.setv('id_paren', $$select invite_id from public.create_invite('22222222-0000-0000-0000-00000000000a', 'viewer',
                                 array['33333333-0000-0000-0000-0000000000a1']::uuid[], 'sms', p_target_phone => '(304) 555-0144', p_history => 'all')$$);
select tests.setv('id_ones',  $$select invite_id from public.create_invite('22222222-0000-0000-0000-00000000000a', 'viewer',
                                 array['33333333-0000-0000-0000-0000000000a1']::uuid[], 'sms', p_target_phone => '1 304 555 0155', p_history => 'all')$$);
select tests.setv('id_dots',  $$select invite_id from public.create_invite('22222222-0000-0000-0000-00000000000a', 'viewer',
                                 array['33333333-0000-0000-0000-0000000000a1']::uuid[], 'sms', p_target_phone => '304.555.0166', p_history => 'all')$$);
:as_admin
select tests.ok_sql($$select target_phone = '+13045550144' from public.invites where id = tests.v('id_paren')::uuid$$,
                    'BETA-SMS-8 create_invite stores "(304) 555-0144" as +13045550144');
select tests.ok_sql($$select target_phone = '+13045550155' from public.invites where id = tests.v('id_ones')::uuid$$,
                    'BETA-SMS-8 create_invite stores "1 304 555 0155" as +13045550155');
select tests.ok_sql($$select target_phone = '+13045550166' from public.invites where id = tests.v('id_dots')::uuid$$,
                    'BETA-SMS-8 create_invite stores "304.555.0166" as +13045550166');
:as_alex
select tests.throws_code(format($q$select * from public.create_invite(%L, 'viewer', array[%L]::uuid[], 'sms', p_target_phone => '+44 20 7946 0000', p_history => 'all')$q$, :space_a, :c_a_gp),
                         'BETA-SMS-8 create_invite refuses a UK number (23514)', '23514');
select tests.throws_code(format($q$select * from public.create_invite(%L, 'viewer', array[%L]::uuid[], 'sms', p_target_phone => '555-0100', p_history => 'all')$q$, :space_a, :c_a_gp),
                         'BETA-SMS-8 create_invite refuses a 7-digit number (23514)', '23514');
select tests.throws_code(format($q$select * from public.create_invite(%L, 'viewer', array[%L]::uuid[], 'sms', p_target_phone => '(104) 555-0100', p_history => 'all')$q$, :space_a, :c_a_gp),
                         'BETA-SMS-8 create_invite refuses an area code starting with 1 (23514)', '23514');
select tests.throws_code(format($q$select * from public.create_invite(%L, 'viewer', array[%L]::uuid[], 'sms', p_target_phone => '304-155-0100', p_history => 'all')$q$, :space_a, :c_a_gp),
                         'BETA-SMS-8 create_invite refuses an exchange starting with 1 (23514)', '23514');
select tests.throws_code(format($q$select * from public.create_invite(%L, 'viewer', array[%L]::uuid[], 'sms', p_target_phone => '130455501001', p_history => 'all')$q$, :space_a, :c_a_gp),
                         'BETA-SMS-8 create_invite refuses 12 digits (23514)', '23514');
-- BETA-SMS-15: the refusal never repeats the number
select tests.ok_sql(format($q$select e is not null and not tests.has_phone(e) and position('7946' in e) = 0
                              from tests.err_text(%L) e$q$,
                           format($s$select * from public.create_invite(%L, 'viewer', array[%L]::uuid[], 'sms', p_target_phone => '+44 20 7946 0000', p_history => 'all')$s$, :space_a, :c_a_gp)),
                    'BETA-SMS-15 the bad-number refusal raised by create_invite does not hold the number');

-- ======================================================================
-- BETA-SMS-9: invite_preview says how to sign in, and never names the target
-- ======================================================================
:as_alex
select tests.setv('pv_phone', tests.phone_invite('+13045550177'));
select tests.setv('pv_email', format($q$select code from public.create_invite(%L, 'viewer', array[%L]::uuid[], 'email', p_target_email => 'kim@example.com', p_history => 'all')$q$, :space_a, :c_a_gp));
select tests.setv('pv_link',  format($q$select code from public.create_invite(%L, 'viewer', array[%L]::uuid[], p_history => 'all')$q$, :space_a, :c_a_gp));
:as_anon
select tests.ok_sql($$select public.invite_preview(tests.v('pv_phone'))->>'sign_in_with' = 'phone'$$,
                    'BETA-SMS-9 invite_preview: a phone invite says sign_in_with = phone');
select tests.ok_sql($$select public.invite_preview(tests.v('pv_email'))->>'sign_in_with' = 'email'$$,
                    'BETA-SMS-9 invite_preview: an email invite says sign_in_with = email');
select tests.ok_sql($$select public.invite_preview(tests.v('pv_link'))->>'sign_in_with' = 'either'$$,
                    'BETA-SMS-9 invite_preview: a link invite says sign_in_with = either');
select tests.ok_sql($$select not tests.has_phone(public.invite_preview(tests.v('pv_phone'))::text)
                         and position('0177' in public.invite_preview(tests.v('pv_phone'))::text) = 0
                         and position('phone"' in public.invite_preview(tests.v('pv_phone'))::text) = 0$$,
                    'BETA-SMS-9 invite_preview never returns the target phone (no number, no target_phone key)');
select tests.ok_sql($$select position('kim@' in public.invite_preview(tests.v('pv_email'))::text) = 0
                         and position('target' in public.invite_preview(tests.v('pv_email'))::text) = 0$$,
                    'BETA-SMS-9 invite_preview never returns the target email');
select tests.ok_sql($$select (select array_agg(k order by k) from json_object_keys(public.invite_preview(tests.v('pv_phone'))) k)
                         = array['inviter_name', 'sign_in_with', 'space_name']$$,
                    'BETA-SMS-9 invite_preview returns exactly inviter_name, sign_in_with, space_name');

-- ======================================================================
-- BETA-SMS-8: redeem matches the number with or without the '+'; everyone else gets the same refusal and an rl_fail
-- ======================================================================
-- Refusals first (the invite stays unused). Through PostgREST so the rl_fail row survives the error.
:as_wrong
select tests.setv('r_wrong', $$select tests.rest(format('select public.redeem_invite(%L)', tests.v('inv_gammy')))::text$$);
:as_mailonly
select tests.setv('r_mail', $$select tests.rest(format('select public.redeem_invite(%L)', tests.v('inv_gammy')))::text$$);
:as_nophone
select tests.setv('r_none', $$select tests.rest(format('select public.redeem_invite(%L)', tests.v('inv_gammy')))::text$$);
:as_admin
select tests.ok_sql($$select tests.v('r_wrong')::jsonb @> '{"status":"400","body":{"code":"22023","message":"invite is invalid or expired"}}'$$,
                    'BETA-SMS-8 a different number gets "invalid or expired" (22023)');
select tests.ok_sql($$select tests.v('r_mail')::jsonb @> '{"status":"400","body":{"code":"22023","message":"invite is invalid or expired"}}'$$,
                    'BETA-SMS-8 an email-only account gets the same "invalid or expired" (22023)');
select tests.ok_sql($$select tests.v('r_none')::jsonb @> '{"status":"400","body":{"code":"22023","message":"invite is invalid or expired"}}'$$,
                    'BETA-SMS-8 an account with no phone gets the same "invalid or expired" (22023)');
select tests.ok_sql($$select (select count(distinct key) from private.rate_limit_events where action = 'redeem' and key in
                               ('user:e0000000-0000-0000-0000-0000000000e3', 'user:e0000000-0000-0000-0000-0000000000e4',
                                'user:e0000000-0000-0000-0000-0000000000e5')) = 3$$,
                    'BETA-SMS-8 each refused redeem counts an rl_fail for that account');
select tests.ok_sql($$select not tests.has_phone(tests.v('r_wrong')) and not tests.has_phone(tests.v('r_none'))$$,
                    'BETA-SMS-15 the redeem refusal never holds a phone number');

-- Gammy's account holds 13045550100 (Supabase's form, no '+'); the invite says +13045550100.
:as_gammy
select tests.lives($$select public.redeem_invite(tests.v('inv_gammy'))$$,
                   'BETA-SMS-8 auth.users.phone 13045550100 (no +) redeems an invite for +13045550100');
select tests.ok_sql($$select exists (select 1 from public.space_members where space_id = '22222222-0000-0000-0000-00000000000a' and user_id = auth.uid())$$,
                    'BETA-SMS-8 ...and she is in the family');
:as_pawpaw
select tests.lives($$select public.redeem_invite(tests.v('inv_pawpaw'))$$,
                   'BETA-SMS-8 auth.users.phone +13045550111 (with +) redeems an invite for +13045550111');
select tests.ok_sql($$select exists (select 1 from public.space_members where space_id = '22222222-0000-0000-0000-00000000000a' and user_id = auth.uid())$$,
                    'BETA-SMS-8 ...and he is in the family');

-- QA-R1 (P1, found here): a phone-only account's placeholder name falls back to its number (tg_handle_new_user,
-- migration 0007: coalesce(email, phone)). The family would see "13045550100" as a name and in notices.
:as_admin
select tests.ok_sql($$select not tests.has_phone(display_name) and position('0100' in display_name) = 0 and not name_set
                        from public.profiles where id = 'e0000000-0000-0000-0000-0000000000e1'$$,
                    'BETA-SMS-15 / QA-R1 a phone-only account''s placeholder name is never its phone number');

-- ======================================================================
-- BETA-SMS-13: phone-only accounts get a push batch and never an email batch
-- ======================================================================
:as_alex
select tests.setv('inv_nana', format($q$select code from public.create_invite(%L, 'viewer', array[%L]::uuid[], p_history => 'all')$q$, :space_a, :c_a_gp));
select tests.setv('inv_papa', format($q$select code from public.create_invite(%L, 'viewer', array[%L]::uuid[], p_history => 'all')$q$, :space_a, :c_a_gp));
:as_nana
select tests.lives($$select public.redeem_invite(tests.v('inv_nana'))$$, 'BETA-SMS-13 setup: Nana (phone only) joins by a link invite');
select tests.lives($$select public.register_push_token('ExponentPushToken[nana]', 'ios')$$, 'BETA-SMS-13 setup: Nana''s phone has notices on');
:as_papa
select tests.lives($$select public.redeem_invite(tests.v('inv_papa'))$$, 'BETA-SMS-13 setup: Papa (phone only) joins; no push token yet');
:as_admin
-- An email account with push wanted but no phone registered still falls back to email (the other direction).
update public.notification_prefs set push = true, email_digest = 'weekly' where user_id = :gma_riv and space_id = :space_a;
delete from public.push_tokens where user_id = :gma_riv;
update public.notification_outbox set sent_at = now() where sent_at is null;
select tests.mkpost('a0000000-0000-0000-0000-00000000000a', :c_a_gp, 'For the grandparents');
update public.notification_outbox set created_at = '2026-11-16 12:00 America/New_York' where sent_at is null;
insert into tests.batches select * from public.claim_notification_batches('2026-11-16 18:30 America/New_York');
select tests.ok_sql($$select count(*) = 1 and bool_and(channel = 'push') from tests.batches where recipient_id = 'e0000000-0000-0000-0000-0000000000e6'$$,
                    'BETA-SMS-13 a phone-only account with notices on gets one push batch');
select tests.ok_sql($$select not exists (select 1 from tests.batches where channel = 'email'
                                         and recipient_id in ('e0000000-0000-0000-0000-0000000000e6', 'e0000000-0000-0000-0000-0000000000e7'))$$,
                    'BETA-SMS-13 no phone-only account ever gets an email batch (push off or no token included)');
select tests.ok_sql($$select not exists (select 1 from tests.batches where channel = 'email' and email is null)$$,
                    'BETA-SMS-13 the outbox never makes an email batch with no address');
select tests.ok_sql($$select exists (select 1 from tests.batches where recipient_id = 'a0000000-0000-0000-0000-0000000000a1'
                                     and channel = 'email' and email = 'grandma.rivera@example.com')$$,
                    'BETA-SMS-13 an email account with no phone registered still gets her evening email');

-- ======================================================================
-- BETA-SMS-15: an error report never keeps a phone number
-- ======================================================================
:as_gammy
select tests.try($$select public.report_client_error('1.0.0', 'ios 17.0', '304-555-0100', 'SmsSendFailed', null)$$);
select tests.try($$select public.report_client_error('1.0.0', 'ios 17.0', 'SignIn', 'SmsSendFailed', '3045550100')$$);
select tests.try($$select public.report_client_error('1.0.0', 'ios 17.0', 'SignIn', 'SmsSendFailed', '13045550100')$$);
select tests.try($$select public.report_client_error('1.0.0', 'ios 17.0', 'SignIn', 'Phone13045550100', null)$$);
select tests.try($$select public.report_client_error('1.0.0', 'ios 17.0', '(304) 555-0100', 'SmsSendFailed', null)$$);
select tests.try($$select public.report_client_error('1.0.0', 'ios 17.0', '+13045550100', 'SmsSendFailed', null)$$);
:as_admin
select tests.ok_sql($$select not exists (select 1 from public.client_errors c
                                         where tests.has_phone(concat_ws(' ', c.app_version, c.os, c.screen, c.kind, c.code)))$$,
                    'BETA-SMS-15 report_client_error keeps no phone number in any field ((304) 555-0100, 304-555-0100, 3045550100, +13045550100)');
select tests.ok_sql($$select count(*) >= 1 from public.client_errors c where concat_ws(' ', c.screen, c.kind, c.code) like '%[phone]%'$$,
                    'BETA-SMS-15 a report that held a number keeps "[phone]" in its place');

-- ---------- report ----------
\o
\pset format aligned
select n, case when ok then 'ok' else 'NOT OK' end as result, description from tests.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tests.results \gset
\echo
\echo SMS RESULT: :passed passed, :failed failed
select :failed = 0 as all_ok \gset
\if :all_ok
\else
  \echo SOME TESTS FAILED
  select 1/0 as force_nonzero_exit;
\endif
