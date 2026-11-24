-- 0030: the generic visibility core (SPEC-VISIBILITY-CORE Phase 1b, docs/architecture/07-visibility-model.md, DEC-81).
-- Everything below this header is packages/visibility/core/supabase.sql, copied verbatim (like 0015 and the messenger
-- relay). Edit the package first, then copy it here in a new migration. No behavior change: nothing reads it yet.

-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Copyright (C) 2026 Chase Holroyd
--
-- @holroyd/visibility core: the `vis` schema template for Supabase (Postgres 15+, PostgREST).
-- One registry of kinds, one rule per reach, one dispatch, and one call to make a new kind safe by default.
-- Copy it into a migration, verbatim, then write your adapter (below) in a later migration.
-- Tests: packages/visibility/core/test.sql (conformance kit, a toy product that rolls back).
--
-- Words: a TENANT is one walled space of members; a MEMBER has a role in it (owner, admin, member); a CONTAINER is
-- a named set of members inside a tenant; an ITEM is the one thing with an audience (a list of containers); a KIND
-- is a type of row, registered with exactly one REACH:
--   item      author, tenant admins, live members of a live audience container past their cutoff
--   person    the product's person rule (rule_fn)
--   container the product's container rule (rule_fn)
--   self      the row's owner only (owner_column)
--   admin     the product's admin rule (rule_fn)
--   server    no app user, ever
--
-- YOU WRITE (the adapter): replace the four placeholder views with `create or replace view`, same columns:
--   vis.item_v       (item_id, tenant_id, author_id, live boolean, live_at timestamptz)
--                    only items that exist in a live tenant; live = the item has gone out (not a draft)
--   vis.audience_v   (item_id, container_id, added_at timestamptz)
--   vis.membership_v (user_id, container_id, tenant_id, sees_from timestamptz, live boolean)
--                    live = the container still exists; sees_from null = sees everything sent to it
--   vis.role_v       (user_id, tenant_id, role text)  role is 'owner', 'admin' or 'member'; live members only
-- Then register every relation an app user can touch in vis.kinds (or call vis.attach for item kinds), every
-- security definer function app users can call in vis.functions, and every edge function in vis.edge_functions.
-- Your CI gate reads the catalog and fails on anything unregistered.
--
-- Guarantees:
--   * Default deny: an unregistered kind, a row with no uuid `id`, a missing rule or a null answer is "no".
--   * Hooks only narrow: narrow_fn is ANDed with the reach's rule; a hook that returns null or raises means "no".
--   * Functions that take a user id (sees_item, can_see) are never executable by app roles. RLS policies call
--     vis.viewer_sees_item(item), which passes auth.uid() itself.
--   * Every function here is security definer with search_path = '' and reads the adapter views as their owner.
-- Not included yet: links (a container two tenants share). Planned; see the design doc.

create schema if not exists vis;
revoke all on schema vis from public;
grant usage on schema vis to authenticated, service_role;

-- ---------- adapter placeholders (the product replaces these; they see nothing until then) ----------
create view vis.item_v as
  select null::uuid as item_id, null::uuid as tenant_id, null::uuid as author_id, null::boolean as live,
         null::timestamptz as live_at
   where false;
create view vis.audience_v as
  select null::uuid as item_id, null::uuid as container_id, null::timestamptz as added_at where false;
create view vis.membership_v as
  select null::uuid as user_id, null::uuid as container_id, null::uuid as tenant_id, null::timestamptz as sees_from,
         null::boolean as live
   where false;
create view vis.role_v as
  select null::uuid as user_id, null::uuid as tenant_id, null::text as role where false;

-- ---------- the registry ----------
create table vis.kinds (
  kind          text primary key check (kind ~ '^[a-z][a-z0-9_:]*$'),
  relation      regclass not null unique,
  reach         text not null check (reach in ('item', 'person', 'container', 'self', 'admin', 'server')),
  item_column   name,          -- reach item: the column holding the item id (null: no app reads; can_see says no)
  owner_column  name,          -- reach self: the column holding the owner's user id
  rule_fn       regprocedure,  -- reach person, container, admin: the product's rule, fn(user uuid, id uuid) -> boolean
  narrow_fn     regprocedure,  -- optional hook, fn(user uuid, id uuid) -> boolean, ANDed (never widens)
  note          text not null check (length(btrim(note)) > 0),   -- why it is in this reach, for reviewers
  check (reach <> 'self' or owner_column is not null),
  check (reach <> 'server' or (rule_fn is null and narrow_fn is null))
);
-- Security definer functions app roles can execute. kind null = allowlisted; the note is the reason.
create table vis.functions (
  fn    regprocedure primary key,
  kind  text references vis.kinds (kind) on delete cascade,
  note  text not null check (length(btrim(note)) > 0)
);
-- Every deployed edge function. A function that skips the caller's token (verify_jwt = false) says why in note.
create table vis.edge_functions (
  name  text primary key,
  kind  text references vis.kinds (kind) on delete set null,
  note  text not null check (length(btrim(note)) > 0)
);
alter table vis.kinds enable row level security;
alter table vis.functions enable row level security;
alter table vis.edge_functions enable row level security;
revoke all on vis.kinds, vis.functions, vis.edge_functions, vis.item_v, vis.audience_v, vis.membership_v, vis.role_v
  from public, anon, authenticated;

-- ---------- the one item rule ----------
-- sees_item(user, item) := the item exists in a live tenant, the user is a live member of that tenant, and either
--   the user is the author, or the item is live and the user is a tenant owner or admin, or the item is live and
--   the user is a live member of a live audience container and (sees_from is null or live_at >= sees_from).
create function vis.sees_item(p_user uuid, p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_user is not null and p_item is not null and exists (
    select 1
      from vis.item_v i
      join vis.role_v r on r.tenant_id = i.tenant_id and r.user_id = p_user
     where i.item_id = p_item
       and (i.author_id = p_user
            or (i.live is true and r.role in ('owner', 'admin'))
            or (i.live is true and exists (
                  select 1
                    from vis.audience_v a
                    join vis.membership_v m on m.container_id = a.container_id and m.user_id = p_user and m.live is true
                   where a.item_id = i.item_id
                     and (m.sees_from is null or i.live_at >= m.sees_from)))))
$$;

-- For RLS policies only: the signed-in caller, never a user id from the request.
create function vis.viewer_sees_item(p_item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select vis.sees_item(auth.uid(), p_item)
$$;

-- ---------- the one dispatch (server side: tests, download signing, notices, export) ----------
create function vis.can_see(p_user uuid, p_kind text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  k vis.kinds;
  v_item uuid;
  v_ok boolean;
begin
  if p_user is null or p_kind is null or p_id is null then return false; end if;
  select * into k from vis.kinds where kind = p_kind;
  if not found or k.reach = 'server' then return false; end if;
  -- rows are addressed by a uuid `id`; anything else is answered by its table's own policy, never here
  if not exists (select 1 from pg_catalog.pg_attribute a
                  where a.attrelid = k.relation and a.attname = 'id' and not a.attisdropped
                    and a.atttypid = 'pg_catalog.uuid'::pg_catalog.regtype) then
    return false;
  end if;
  begin
    if k.reach = 'item' then
      if k.item_column is null then return false; end if;
      execute format('select %I::uuid from %s where id = $1', k.item_column, k.relation) into v_item using p_id;
      v_ok := vis.sees_item(p_user, v_item);
    elsif k.reach = 'self' then
      execute format('select exists (select 1 from %s where id = $1 and %I = $2)', k.relation, k.owner_column)
        into v_ok using p_id, p_user;
    elsif k.rule_fn is null then
      return false;
    else
      execute format('select %s($1, $2)', k.rule_fn::oid::regproc) into v_ok using p_user, p_id;
    end if;
    if v_ok is true and k.narrow_fn is not null then
      execute format('select %s($1, $2)', k.narrow_fn::oid::regproc) into v_ok using p_user, p_id;
    end if;
  exception when others then
    return false;   -- a broken rule or hook fails closed
  end;
  return coalesce(v_ok, false);
end $$;

-- ---------- fungible kinds: one call makes a table an item kind ----------
-- select vis.attach('public.notes', 'note', item_column => 'item_id');
-- Registers the kind, turns RLS on and forces it, takes every grant away from app roles, grants select to signed-in
-- users, and writes the table's one permissive select policy: the item rule ANDed with the hook (null = no).
-- Refuses a table that already has another permissive select policy (it would OR a wider rule in).
create function vis.attach(p_relation regclass, p_kind text, item_column name, narrow_fn regprocedure default null,
                           note text default 'item kind: follows its item''s audience (vis.attach)')
returns void language plpgsql set search_path = '' as $$
declare v_hook text := '';
begin
  if not exists (select 1 from pg_catalog.pg_attribute a
                  where a.attrelid = p_relation and a.attname = item_column and not a.attisdropped
                    and a.atttypid = 'pg_catalog.uuid'::pg_catalog.regtype) then
    raise exception 'vis.attach: % has no uuid column %', p_relation, item_column using errcode = '22023';
  end if;
  if narrow_fn is not null then
    if not exists (select 1 from pg_catalog.pg_proc p
                    where p.oid = narrow_fn and p.prorettype = 'pg_catalog.bool'::pg_catalog.regtype
                      and p.pronargs = 2
                      and p.proargtypes[0] = 'pg_catalog.uuid'::pg_catalog.regtype
                      and p.proargtypes[1] = 'pg_catalog.uuid'::pg_catalog.regtype
                      and p.provolatile in ('s', 'i')) then
      raise exception 'vis.attach: hook % must be stable, take (uuid, uuid) and return boolean', narrow_fn
        using errcode = '22023';
    end if;
    if not exists (select 1 from pg_catalog.pg_attribute a
                    where a.attrelid = p_relation and a.attname = 'id' and not a.attisdropped
                      and a.atttypid = 'pg_catalog.uuid'::pg_catalog.regtype) then
      raise exception 'vis.attach: a hook needs a uuid id column on %', p_relation using errcode = '22023';
    end if;
    v_hook := format(' and coalesce(%s((select auth.uid()), id), false)', narrow_fn::oid::regproc);
  end if;
  if exists (select 1 from pg_catalog.pg_policy pol
              where pol.polrelid = p_relation and pol.polpermissive and pol.polcmd in ('r', '*')) then
    raise exception 'vis.attach: % already has a permissive select policy; drop it or make it restrictive', p_relation
      using errcode = '42710';
  end if;
  insert into vis.kinds (kind, relation, reach, item_column, narrow_fn, note)
  values (p_kind, p_relation, 'item', item_column, narrow_fn, note);
  execute format('alter table %s enable row level security', p_relation);
  execute format('alter table %s force row level security', p_relation);
  execute format('revoke all on %s from public, anon, authenticated', p_relation);
  execute format('grant select on %s to authenticated', p_relation);
  execute format('create policy vis_select on %s for select to authenticated using (vis.viewer_sees_item(%I)%s)',
                 p_relation, item_column, v_hook);
end $$;

-- Nobody but the migration owner runs these; app roles get only the RLS entry point.
revoke all on all functions in schema vis from public, anon, authenticated;
grant execute on function vis.viewer_sees_item(uuid) to authenticated;
grant execute on function vis.can_see(uuid, text, uuid), vis.sees_item(uuid, uuid) to service_role;
