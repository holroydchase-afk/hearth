-- 0025: text message sign-in, the database side (SPEC-SMS-SIGN-IN, DEC-56, TRACKER R42).
-- BETA-SMS-8: phone invites hold a US number as E.164 (+1XXXXXXXXXX); redeem matches auth.users.phone in either
--   form Supabase Auth stores it ('13045550100' or '+13045550100'). A non-US number is refused (23514), never echoed.
-- BETA-SMS-9: invite_preview says how to sign in (sign_in_with = phone | email | either); it never returns the target.
-- BETA-SMS-13: a phone-only account (no email) never gets an email batch; push only.
-- BETA-SMS-15 / QA-R1: no phone number is kept as a placeholder name or in an error report.
-- No table or column changes; no access changes (RLS untouched).

-- A US number in any common shape -> '+1XXXXXXXXXX'; anything else -> null. Area code and exchange can't start with 0/1.
create or replace function private.us_e164(p text) returns text
language plpgsql immutable set search_path = '' as $$
declare d text;
begin
  if p is null or btrim(p) !~ '^\+?[0-9 ().-]+$' then return null; end if;
  d := regexp_replace(p, '[^0-9]', '', 'g');
  if length(d) = 11 and left(d, 1) = '1' then d := substr(d, 2);
  elsif position('+' in p) > 0 then return null;      -- a '+' must be +1
  end if;
  if d !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$' then return null; end if;
  return '+1' || d;
end $$;

-- Every US-looking number in a piece of text becomes "[phone]" (BETA-SMS-15).
create or replace function private.scrub_phone(p text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(p, '(\+?1[ ().-]{0,2})?\(?[0-9]{3}\)?[ ().-]{0,2}[0-9]{3}[ .-]?[0-9]{4}', '[phone]', 'g')
$$;

-- invites.target_phone is always E.164 or null, whoever writes it. The refusal never repeats the number.
create or replace function private.tg_invite_phone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.target_phone is not null then
    new.target_phone := private.us_e164(new.target_phone);
    if new.target_phone is null then
      raise exception 'please use a US mobile number' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists invites_phone_e164 on public.invites;
create trigger invites_phone_e164 before insert or update of target_phone on public.invites
  for each row execute function private.tg_invite_phone();

-- BETA-SMS-9: how the join screen should ask. A phone invite: a number; an email invite: an email; a link: either.
create or replace function private.invite_sign_in_with(p_inv public.invites) returns text
language sql immutable set search_path = '' as $$
  select case when p_inv.target_phone is not null or p_inv.channel = 'sms' then 'phone'
              when p_inv.target_email is not null or p_inv.channel = 'email' then 'email'
              else 'either' end
$$;
revoke execute on function private.us_e164(text), private.scrub_phone(text), private.invite_sign_in_with(public.invites)
  from public, anon, authenticated;

-- QA-R1: a phone-only account's placeholder name was its number (0007: coalesce(email, phone)). Now the email's
-- first part, else "Member"; name_set stays false so the app asks for a real name.
create or replace function public.tg_handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $fn$
begin
  insert into public.profiles (id, display_name, name_set)
  values (new.id,
          case when private.valid_name(new.raw_user_meta_data->>'display_name')
               then btrim(new.raw_user_meta_data->>'display_name')
               else coalesce(nullif(private.scrub_phone(regexp_replace(split_part(nullif(btrim(new.email), ''), '@', 1), '[\r\n\t<>]', '', 'g')), ''),
                             'Member') end,
          private.valid_name(new.raw_user_meta_data->>'display_name'))
  on conflict (id) do nothing;
  return new;
end $fn$;

-- BETA-SMS-15: an error report keeps "[phone]" where a number was (fixed fields are checked first, as in 0006).
create or replace function public.report_client_error(
  p_app_version text, p_os text, p_screen text, p_kind text, p_code text default null
) returns void
language plpgsql security definer set search_path = '' as $fn$
declare v_who text := coalesce(auth.uid()::text, 'anon');
begin
  if coalesce(p_app_version, '') !~ '^[0-9A-Za-z.+-]{1,20}$'
     or coalesce(p_os, '') !~ '^(ios|android|web)( [0-9.]{1,12})?$'
     or coalesce(p_screen, '') !~ '^[A-Za-z0-9_/\[\]-]{1,40}$'
     or coalesce(p_kind, '') !~ '^[A-Za-z][A-Za-z0-9_]{0,59}$'
     or (p_code is not null and p_code !~ '^[A-Za-z0-9_]{1,20}$') then
    raise exception 'error reports take fixed fields only' using errcode = '23514';
  end if;
  if (select count(*) from public.client_errors e
      where e.reporter = v_who and e.at > now() - interval '1 hour') >= (case when v_who = 'anon' then 300 else 30 end) then
    raise exception 'too many error reports' using errcode = '54000';
  end if;
  insert into public.client_errors (reporter, app_version, os, screen, kind, code)
  values (v_who, private.scrub_phone(p_app_version), p_os, private.scrub_phone(p_screen), private.scrub_phone(p_kind),
          private.scrub_phone(p_code));
end $fn$;

-- BETA-SMS-8: redeem as in 0024; the phone check now compares E.164 to E.164 (Supabase stores it without the '+').
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
     or (v_inv.target_phone is not null and private.us_e164(v_user.phone) is distinct from v_inv.target_phone)
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

-- BETA-SMS-9: invite_preview as in 0011, plus sign_in_with. Still never the target email or phone.
create or replace function public.invite_preview(p_code text) returns json
language plpgsql security definer set search_path = '' as $$
declare v_keys text[]; v_inv public.invites; v_inviter text; v_space text;
begin
  v_keys := private.rl_keys();
  if private.rl_blocked(v_keys) then
    return private.api_error('54000', 'Too many tries. Wait 10 minutes.', 429);
  end if;
  select i.* into v_inv
  from public.invites i
  join public.spaces s on s.id = i.space_id and s.deleted_at is null
  where (i.code_hash = private.invite_hash(p_code) or i.link_hash = private.invite_hash(p_code))
    and i.revoked_at is null and i.expires_at > now() and i.use_count < i.max_uses;
  if not found then
    perform private.rl_fail(v_keys, 'preview');
    return private.api_error('22023', 'invite is invalid or expired', 400);
  end if;
  select pr.display_name into v_inviter from public.profiles pr where pr.id = v_inv.created_by;
  if not private.invite_places(v_inv) then
    return private.api_error('22023', 'invite is invalid or expired', 400, v_inviter);
  end if;
  select s.name into v_space from public.spaces s where s.id = v_inv.space_id;
  return json_build_object('inviter_name', v_inviter, 'space_name', v_space,
                           'sign_in_with', private.invite_sign_in_with(v_inv));
end $$;

-- BETA-SMS-13: the outbox as in 0011; email only for an account that has an email address.
create or replace function public.claim_notification_batches(p_now timestamptz default now())
returns table (
  recipient_id      uuid,
  channel           text,
  actor_names       text[],
  post_ids          uuid[],
  latest_post_id    uuid,
  post_count        int,
  comment_count     int,
  heart_count       int,
  outbox_ids        uuid[],
  push_tokens       text[],
  email             text,
  is_batch          boolean,
  photo_count       int,
  taken_from        timestamptz,
  taken_to          timestamptz
)
language sql security definer set search_path = '' as $$
  with cand as (
    select o.id, o.recipient_id, o.post_id, o.actor_id, o.kind, o.created_at, p.batch_id, p.taken_at,
           ( p.deleted_at is null and p.status = 'published'
             and case when o.kind = 'post' then private.sees_post(o.recipient_id, p.id)
                      else o.recipient_id = p.author_id
                           and exists (select 1 from public.space_members sm
                                       where sm.space_id = p.space_id and sm.user_id = o.recipient_id) end ) as valid,
           coalesce(np.push, true) as want_push,
           coalesce(np.email_digest, 'off') as digest,
           exists (select 1 from public.push_tokens t where t.user_id = o.recipient_id) as has_token,
           exists (select 1 from auth.users u where u.id = o.recipient_id and nullif(btrim(u.email), '') is not null) as has_email
    from public.notification_outbox o
    join public.posts p on p.id = o.post_id
    left join public.notification_prefs np on np.user_id = o.recipient_id and np.space_id = p.space_id
    where o.sent_at is null
      -- BETA-BULK-6: hold an unfinished bulk batch (under 30 minutes old)
      and not (o.kind = 'post' and p.batch_id is not null
               and (select count(*) from public.posts b
                    where b.author_id = p.author_id and b.batch_id = p.batch_id and b.status = 'published') < p.batch_size
               and (select min(o2.created_at) from public.notification_outbox o2
                    join public.posts b2 on b2.id = o2.post_id
                    where b2.author_id = p.author_id and b2.batch_id = p.batch_id and o2.kind = 'post')
                   > p_now - interval '30 minutes')
    for update of o skip locked
  ), classified as (
    select c.*,
           case when not c.valid then 'none'
                when c.want_push and c.has_token then 'push'
                when (c.want_push or c.digest <> 'off') and c.has_email then 'email'
                else 'none' end as ch
    from cand c
  ), clock as (
    select (p_now at time zone 'America/New_York') as l
  ), slots as (
    select (case when l >= date_trunc('day', l) + interval '18 hours' then date_trunc('day', l) + interval '18 hours'
                 else date_trunc('day', l) - interval '6 hours' end) at time zone 'America/New_York' as evening,
           (case when l >= date_trunc('day', l) - extract(dow from l) * interval '1 day' + interval '8 hours'
                 then date_trunc('day', l) - extract(dow from l) * interval '1 day' + interval '8 hours'
                 else date_trunc('day', l) - extract(dow from l) * interval '1 day' - interval '7 days' + interval '8 hours'
            end) at time zone 'America/New_York' as sunday
    from clock
  ), windowed as (
    select k.*,
           case when k.ch = 'push' then p_now - interval '10 minutes'
                when k.digest = 'weekly' and not k.want_push then (select sunday from slots)
                else (select evening from slots) end as since
    from classified k
  ), ready as (
    select g.recipient_id, g.ch
    from (select w.recipient_id, w.ch, max(w.since) as since,
                 bool_or(w.ch = 'push' or w.created_at <= w.since) as due
          from windowed w where w.ch <> 'none' group by 1, 2) g
    where g.due
      and not exists (select 1 from public.notification_outbox s
                      where s.recipient_id = g.recipient_id and s.channel = g.ch
                        and s.sent_at >= g.since)
  ), mark as (
    update public.notification_outbox o
    set sent_at = p_now, channel = w.ch
    from windowed w
    where o.id = w.id
      and (w.ch = 'none' or exists (select 1 from ready r where r.recipient_id = w.recipient_id and r.ch = w.ch))
    returning o.id
  )
  select w.recipient_id,
         w.ch,
         array_agg(distinct pr.display_name order by pr.display_name),
         array_agg(distinct w.post_id order by w.post_id),
         (array_agg(w.post_id order by w.created_at desc))[1],
         (count(distinct w.post_id) filter (where w.kind = 'post'))::int,
         (count(*) filter (where w.kind = 'comment'))::int,
         (count(*) filter (where w.kind = 'heart'))::int,
         array_agg(w.id order by w.id),
         case when w.ch = 'push'
              then coalesce((select array_agg(t.expo_token order by t.expo_token)
                             from public.push_tokens t where t.user_id = w.recipient_id), '{}')
              else '{}'::text[] end,
         case when w.ch = 'email' then (select u.email from auth.users u where u.id = w.recipient_id) end,
         coalesce(bool_and(w.batch_id is not null) filter (where w.kind = 'post'), false),
         (select count(*)::int from public.media_items m
           where m.post_id = any (array_agg(w.post_id) filter (where w.kind = 'post'))
             and m.kind = 'photo' and m.upload_status = 'ready'),
         min(w.taken_at) filter (where w.kind = 'post'),
         max(w.taken_at) filter (where w.kind = 'post')
  from windowed w
  join ready r on r.recipient_id = w.recipient_id and r.ch = w.ch
  join public.profiles pr on pr.id = w.actor_id
  group by w.recipient_id, w.ch
$$;
