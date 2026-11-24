-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (C) 2026 Chase Holroyd
--
-- VIS-19, VIS-20, VIS-23 (hooks): the conformance kit for the generic visibility core
-- (SPEC-VISIBILITY-CORE C5, C6, Phase 1b; docs/architecture/07-visibility-model.md). Written FIRST (Nov 24, 2026):
-- red until packages/visibility/core/supabase.sql (the `vis` schema template) exists.
-- A toy product that isn't Hearth: guilds (tenants), squads (containers), scrolls (items). Runs in one transaction
-- and rolls back, so it is safe on any scratch database: plain Postgres 15+ (an auth stub is made if missing) or a
-- local Supabase stack. Exits non-zero on any failure.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q -f packages/visibility/core/test.sql
-- Contract assumed (07): the template makes the vis schema with placeholder adapter views vis.item_v, vis.audience_v,
-- vis.membership_v, vis.role_v (the product replaces them with `create or replace view`, same columns),
-- vis.kinds, vis.sees_item(user, item), vis.can_see(user, kind, id) and
-- vis.attach(relation, kind, item_column => ..., narrow_fn => ...). A hook is narrow_fn(user uuid, id uuid) -> boolean.
begin;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
do $$ begin
  if to_regprocedure('auth.uid()') is null then
    execute $f$create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid'$f$;
  end if;
end $$;
grant usage on schema auth, public to anon, authenticated, service_role;

create temp table results (n serial, ok boolean, what text);
grant all on results, results_n_seq to authenticated, anon;
create function pg_temp.ok(p boolean, what text) returns void language sql as $$ insert into results (ok, what) values (coalesce(p, false), what) $$;
-- Which rows of a table a user reads through RLS, as a sorted list of `body`; 'error:<sqlstate>' if the read fails.
create function pg_temp.seen(p_user char, p_table text) returns text language plpgsql as $$
declare v text;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000' || p_user, true);
  begin
    execute 'set local role authenticated';
    execute format('select coalesce(string_agg(body, '','' order by body), '''') from %s', p_table) into v;
    execute 'reset role';
  exception when others then
    execute 'reset role'; v := 'error:' || sqlstate;
  end;
  return v;
end $$;
create function pg_temp.code(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return 'none'; exception when others then return sqlstate; end $$;

-- The toy product's own tables (no visibility logic in them).
create table public.toy_guild (id uuid primary key, live boolean not null default true);
create table public.toy_guild_member (guild_id uuid, user_id uuid, role text, live boolean not null default true);
create table public.toy_squad (id uuid primary key, guild_id uuid);
create table public.toy_squad_member (squad_id uuid, user_id uuid, sees_from timestamptz, live boolean not null default true);
create table public.toy_scroll (id uuid primary key, guild_id uuid, author_id uuid, live boolean, live_at timestamptz);
create table public.toy_scroll_to (scroll_id uuid, squad_id uuid, added_at timestamptz);

-- The template under test. Missing file = red (the expected first failure).
\ir supabase.sql

-- The toy adapter: the four views 07 names, over the toy tables.
create or replace view vis.item_v as
  select s.id as item_id, s.guild_id as tenant_id, s.author_id, (s.live and g.live) as live, s.live_at
    from public.toy_scroll s join public.toy_guild g on g.id = s.guild_id;
create or replace view vis.audience_v as
  select scroll_id as item_id, squad_id as container_id, added_at from public.toy_scroll_to;
create or replace view vis.membership_v as
  select m.user_id, m.squad_id as container_id, q.guild_id as tenant_id, m.sees_from, m.live
    from public.toy_squad_member m join public.toy_squad q on q.id = m.squad_id;
create or replace view vis.role_v as
  select user_id, guild_id as tenant_id, role from public.toy_guild_member where live;

-- People: a owns guild 1; b is in squad 1; c is in guild 1, not the squad; d joined squad 1 after scroll 1;
-- e was in squad 1 and left; x owns guild 2.
insert into auth.users (id) select ('00000000-0000-0000-0000-00000000000' || u)::uuid from unnest(array['a','b','c','d','e','f']) u;
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000009');
insert into public.toy_guild values ('11111111-0000-0000-0000-000000000001'), ('11111111-0000-0000-0000-000000000002');
insert into public.toy_guild_member values
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'owner', true),
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'member', true),
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'member', true),
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'member', true),
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000e', 'member', true),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000009', 'owner', true);
insert into public.toy_squad values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001');
insert into public.toy_squad_member values
  ('22222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', null, true),
  ('22222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', now(), true),
  ('22222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000e', null, false);
-- scroll 1: a's, live a day ago, to squad 1. scroll 3: c's draft, to squad 1.
insert into public.toy_scroll values
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', true, now() - interval '1 day'),
  ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', false, null);
insert into public.toy_scroll_to values
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', now() - interval '1 day'),
  ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001', now());
-- Expected item audience: scroll 1 -> a (author), b (squad). scroll 3 -> c only (author; a draft, so not even the owner).

-- ---------- VIS-19 a throwaway kind registered by one call follows its item's audience ----------
create table public.vis_test_note (id uuid primary key default gen_random_uuid(), scroll_id uuid not null, body text not null);
insert into public.vis_test_note (scroll_id, body) values
  ('33333333-0000-0000-0000-000000000001', 'note1'), ('33333333-0000-0000-0000-000000000003', 'note3');
select pg_temp.ok(pg_temp.code($q$select vis.attach('public.vis_test_note', 'vis_test_note', item_column => 'scroll_id')$q$) = 'none',
                  'VIS-19 vis.attach registers the throwaway kind with one call');
select pg_temp.ok(exists (select 1 from vis.kinds where kind = 'vis_test_note' and relation = 'public.vis_test_note'::regclass and reach = 'item'),
                  'VIS-19 the kind is in the registry, reach item');
select pg_temp.ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.vis_test_note'::regclass),
                  'VIS-19 attach turned RLS on and forced it');
select pg_temp.ok((select count(*) from pg_policies where schemaname = 'public' and tablename = 'vis_test_note'
                    and permissive = 'PERMISSIVE' and cmd in ('SELECT', 'ALL')) = 1,
                  'VIS-19 attach wrote exactly one permissive select policy (PRIV-VC-R4)');
select pg_temp.ok(not has_table_privilege('anon', 'public.vis_test_note', 'select'), 'VIS-19 signed out (anon) can''t read the kind');
select pg_temp.ok(pg_temp.seen('a', 'public.vis_test_note') = 'note1', 'VIS-19 a (author of scroll 1, owner) sees note1 only, not c''s draft');
select pg_temp.ok(pg_temp.seen('b', 'public.vis_test_note') = 'note1', 'VIS-19 b (in the squad) sees note1');
select pg_temp.ok(pg_temp.seen('c', 'public.vis_test_note') = 'note3', 'VIS-19 c sees only the note on their own draft');
select pg_temp.ok(pg_temp.seen('d', 'public.vis_test_note') = '', 'VIS-19 d (joined after scroll 1) sees nothing');
select pg_temp.ok(pg_temp.seen('e', 'public.vis_test_note') = '', 'VIS-19 e (left the squad) sees nothing');
select pg_temp.ok(pg_temp.seen('9', 'public.vis_test_note') = '', 'VIS-19 x (another tenant''s owner) sees nothing');
select pg_temp.ok(pg_temp.seen('f', 'public.vis_test_note') = '', 'VIS-19 f (in no tenant) sees nothing');
select pg_temp.ok((select bool_and(vis.can_see(u.id, 'vis_test_note', n.id)
                                   = vis.sees_item(u.id, n.scroll_id)) from auth.users u cross join public.vis_test_note n),
                  'VIS-19 vis.can_see for the kind equals vis.sees_item of its scroll for every user and note');

-- ---------- VIS-20 a hook that says yes to everyone can't widen ----------
create function public.toy_hook_yes(p_user uuid, p_id uuid) returns boolean language sql stable as 'select true';
create function public.toy_hook_null(p_user uuid, p_id uuid) returns boolean language sql stable as 'select null::boolean';
create function public.toy_hook_raise(p_user uuid, p_id uuid) returns boolean language plpgsql stable as
  $$ begin raise exception 'hook broke'; end $$;
grant execute on function public.toy_hook_yes(uuid, uuid), public.toy_hook_null(uuid, uuid), public.toy_hook_raise(uuid, uuid) to authenticated;
create table public.toy_reply_yes   (id uuid primary key default gen_random_uuid(), scroll_id uuid not null, body text not null);
create table public.toy_reply_null  (id uuid primary key default gen_random_uuid(), scroll_id uuid not null, body text not null);
create table public.toy_reply_raise (id uuid primary key default gen_random_uuid(), scroll_id uuid not null, body text not null);
insert into public.toy_reply_yes (scroll_id, body)   values ('33333333-0000-0000-0000-000000000001', 'r1'), ('33333333-0000-0000-0000-000000000003', 'r3');
insert into public.toy_reply_null (scroll_id, body)  values ('33333333-0000-0000-0000-000000000001', 'r1'), ('33333333-0000-0000-0000-000000000003', 'r3');
insert into public.toy_reply_raise (scroll_id, body) values ('33333333-0000-0000-0000-000000000001', 'r1'), ('33333333-0000-0000-0000-000000000003', 'r3');
select pg_temp.ok(pg_temp.code($q$select vis.attach('public.toy_reply_yes', 'toy_reply_yes', item_column => 'scroll_id',
                                                    narrow_fn => 'public.toy_hook_yes(uuid,uuid)')$q$) = 'none',
                  'VIS-20 vis.attach takes a narrowing hook');
select pg_temp.ok(pg_temp.seen('b', 'public.toy_reply_yes') = 'r1', 'VIS-20 b, in the audience, still sees the reply on scroll 1');
select pg_temp.ok(pg_temp.seen('c', 'public.toy_reply_yes') = 'r3', 'VIS-20 c sees only the reply on their own draft (the yes-hook adds nothing)');
select pg_temp.ok(pg_temp.seen('d', 'public.toy_reply_yes') = '', 'VIS-20 d, outside the audience, still sees nothing');
select pg_temp.ok(pg_temp.seen('9', 'public.toy_reply_yes') = '', 'VIS-20 x, another tenant, still sees nothing');
select pg_temp.ok(pg_temp.seen('f', 'public.toy_reply_yes') = '', 'VIS-20 f, in no tenant, still sees nothing');
select pg_temp.ok((select bool_and(not vis.can_see(u.id, 'toy_reply_yes', r.id) or vis.sees_item(u.id, r.scroll_id))
                     from auth.users u cross join public.toy_reply_yes r),
                  'VIS-20 can_see never says yes where sees_item says no');

-- ---------- VIS-23 a hook that returns null or raises fails closed ----------
select pg_temp.ok(pg_temp.code($q$select vis.attach('public.toy_reply_null', 'toy_reply_null', item_column => 'scroll_id',
                                                    narrow_fn => 'public.toy_hook_null(uuid,uuid)')$q$) = 'none',
                  'VIS-23 a null-returning hook can be attached');
select pg_temp.ok(pg_temp.code($q$select vis.attach('public.toy_reply_raise', 'toy_reply_raise', item_column => 'scroll_id',
                                                    narrow_fn => 'public.toy_hook_raise(uuid,uuid)')$q$) = 'none',
                  'VIS-23 a raising hook can be attached');
select pg_temp.ok(pg_temp.seen(u, 'public.toy_reply_null') = '', format('VIS-23 null hook: %s sees no rows (fail closed)', u))
  from unnest(array['a', 'b', 'c']) u;
-- An error is also "no": either nothing comes back or the read fails; a row never does.
select pg_temp.ok(pg_temp.seen(u, 'public.toy_reply_raise') = '' or pg_temp.seen(u, 'public.toy_reply_raise') like 'error:%',
                  format('VIS-23 raising hook: %s gets no rows (fail closed)', u))
  from unnest(array['a', 'b', 'c']) u;
select pg_temp.ok((select bool_and(vis.can_see(u.id, 'toy_reply_null', r.id) is false) from auth.users u cross join public.toy_reply_null r),
                  'VIS-23 null hook: can_see is false (not null) for everyone');
-- XX001 means can_see said yes; any other error (the hook's own) or a false/null answer is closed.
select pg_temp.ok(to_regprocedure('vis.can_see(uuid,text,uuid)') is not null
                  and (select bool_and(pg_temp.code(format($d$do $x$ begin if vis.can_see(%L, %L, %L) then
                                                       raise exception 'leak' using errcode = 'XX001'; end if; end $x$$d$,
                                                       u.id, 'toy_reply_raise', r.id)) <> 'XX001')
                         from auth.users u cross join public.toy_reply_raise r),
                  'VIS-23 raising hook: can_see is never true for anyone (false, or the call fails)');

-- ---------- report ----------
reset role;
select case when ok then 'ok      ' else 'NOT OK  ' end || what from results order by n;
do $$ declare bad int := (select count(*) from results where not ok); total int := (select count(*) from results);
begin
  raise notice 'VIS CORE KIT RESULT: % passed, % failed', total - bad, bad;
  if bad > 0 or total = 0 then raise exception 'visibility conformance kit: % failed', bad; end if;
end $$;
rollback;
