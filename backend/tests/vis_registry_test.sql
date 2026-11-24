-- VIS-1, VIS-3, VIS-4, VIS-5: the coverage gate (SPEC-VISIBILITY-CORE C3, Phase 1; docs/architecture/07-visibility-model.md).
-- Reads the live catalog after every migration and fails, naming the relation, when anything an app user can
-- touch has no reach class or doesn't use its rule. Written FIRST (Nov 24, 2026): red until the vis registry lands
-- (migrations 0030+). Registry shape is 07's sketch: vis.kinds (kind, relation, reach, item_column, owner_column,
-- narrow_fn, note), vis.functions (fn, kind, note). A vis.functions row with kind null is the VIS-5 allowlist.
-- VIS-2 and VIS-23 (the gate bites) run this file against scratch migrations: tests/vis_gate_test.sh.
\set ON_ERROR_STOP 1
\pset footer off
\ir harness.sql

-- For each row the list query returns (one text column), run a boolean check built from it. If the list itself
-- can't run (the registry doesn't exist yet), that is one failure, never an abort.
create function tests.ok_each(p_list text, p_check_fmt text, p_desc_fmt text) returns void language plpgsql as $f$
declare v text; n int := 0;
begin
  begin
    for v in execute p_list loop
      perform tests.ok_sql(format(p_check_fmt, v), format(p_desc_fmt, v)); n := n + 1;
    end loop;
  exception when others then
    perform tests.ok(false, format(p_desc_fmt, '(list)') || '  [' || sqlstate || ' ' || sqlerrm || ']'); return;
  end;
  if n = 0 then perform tests.ok(true, format(p_desc_fmt, '(none listed)')); end if;
end $f$;

-- Relations an app user could reach: every table, view and materialized view in a schema PostgREST exposes
-- (config.toml [api] schemas: public, graphql_public; PRIV-VC-R2), plus any vis.* relation.
create temp view vis_exposed as
  select quote_ident(n.nspname) || '.' || quote_ident(c.relname) as rel, c.relkind
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public', 'graphql_public') and c.relkind in ('r', 'p', 'v', 'm');

-- ---------- VIS-1 every exposed relation has exactly one registry row ----------
select tests.ok_sql($$select to_regclass('vis.kinds') is not null$$,
                    'VIS-1 the registry vis.kinds exists');
select tests.ok_sql(format($$select (select count(*) from vis.kinds where relation = %L::regclass) = 1$$, rel),
                    format('VIS-1 %s has a reach class: add a vis_registry row', rel))
  from vis_exposed order by rel;

-- Storage buckets: Hearth's media is in Backblaze B2 (sign-media), so Supabase Storage has no buckets today.
-- If the storage schema ever appears, every bucket must be registered (07 has no bucket column yet: see report).
select tests.ok_sql(case when to_regclass('storage.buckets') is null then 'select true'
                         else $$select not exists (select 1 from storage.buckets b
                                where not exists (select 1 from vis.kinds k where k.kind = 'bucket:' || b.id))$$ end,
                    'VIS-1 every storage bucket has a reach class (no storage schema in this build)');

-- Phase 1 confirms each row of 07's mapping table, so nothing hides from VIS-4 by sitting in the wrong reach.
create temp table vis_expected_reach (rel text, reach text);
insert into vis_expected_reach values
  ('public.posts','item'), ('public.media_items','item'), ('public.media_keys','item'), ('public.post_children','item'),
  ('public.comments','item'), ('public.reactions','item'), ('public.post_audiences','item'),
  ('public.profiles','person'), ('public.children','person'), ('public.child_guardians','person'),
  ('public.circles','container'), ('public.circle_members','container'), ('public.circle_people','container'),
  ('public.circle_links','container'), ('public.chat_groups','container'), ('public.chat_messages','container'),
  ('public.chat_key_packages','container'),
  ('public.push_tokens','self'), ('public.notification_prefs','self'), ('public.account_exports','self'),
  ('public.chat_devices','self'), ('public.post_views','self'),
  ('public.spaces','admin'), ('public.space_members','admin'), ('public.space_features','admin'),
  ('public.space_children','admin'), ('public.invites','admin'), ('public.invite_circles','admin'),
  ('public.comment_mode_log','admin'), ('public.households','admin'), ('public.household_members','admin'),
  ('public.client_errors','server'), ('public.notification_outbox','server'), ('public.storage_purge_queue','server');
select tests.ok_sql(format($$select exists (select 1 from vis.kinds where relation = %L::regclass and reach = %L)$$, rel, reach),
                    format('VIS-1 %s is in reach %s (07 mapping)', rel, reach))
  from vis_expected_reach order by rel;
select tests.ok_sql($$select bool_and(note is not null and length(btrim(note)) > 0) from vis.kinds$$,
                    'VIS-1 every registry row says why it is in its reach (note)');

-- ---------- VIS-3 RLS on and forced; no open policy; views run as the caller ----------
select tests.ok_sql(format($$select c.relrowsecurity and c.relforcerowsecurity from pg_class c where c.oid = %L::regclass$$, rel),
                    format('VIS-3 %s has RLS enabled and forced', rel))
  from vis_exposed where relkind in ('r', 'p') order by rel;
select tests.ok_sql(format($$select coalesce('security_invoker=true' = any(c.reloptions) or 'security_invoker=on' = any(c.reloptions), false)
                               from pg_class c where c.oid = %L::regclass$$, rel),
                    format('VIS-3 view %s is security_invoker (PRIV-VC-R2)', rel))
  from vis_exposed where relkind = 'v' order by rel;
select tests.ok(not exists (select 1 from vis_exposed where relkind = 'm'),
                'VIS-3 no materialized view in an exposed schema (PRIV-VC-R2)');
select tests.ok(not exists (select 1 from pg_policies p
                             where p.schemaname in ('public', 'graphql_public')
                               and (p.roles && array['authenticated', 'public', 'anon']::name[])
                               and btrim(coalesce(p.qual, '')) = 'true'),
                'VIS-3 no policy for authenticated, anon or public is using (true)');
select tests.ok(not exists (select 1 from vis_exposed e
                             where has_table_privilege('anon', e.rel, 'select')
                                or has_table_privilege('anon', e.rel, 'insert')
                                or has_table_privilege('anon', e.rel, 'update')
                                or has_table_privilege('anon', e.rel, 'delete')),
                'VIS-3 anon has no table privilege on any exposed relation (PRIV-VC-R2)');
-- Server reach: no app user reads it, ever (client_errors stays insert-only through its RPC).
select tests.ok_each($$select quote_ident(n.nspname) || '.' || quote_ident(c.relname) from vis.kinds k join pg_class c on c.oid = k.relation join pg_namespace n on n.oid = c.relnamespace where k.reach = 'server' order by 1$$,
  $$select not exists (select 1 from pg_policies p where format('%%I.%%I', p.schemaname, p.tablename)::regclass = %L::regclass
                         and p.cmd in ('SELECT', 'ALL') and p.roles && array['authenticated','public']::name[])$$,
  'VIS-3 server-reach %s has no select policy for app users');

-- ---------- VIS-4 every item-reach table reads through the one rule, in exactly one permissive select policy ----------
-- Item tables app users can't select at all (media_keys today: service role only) need no select policy.
-- "Can select" counts column grants too (posts has only column grants since 0009), so posts is never skipped.
-- Accepted calls: private.sees_post / vis.sees_item directly, or the two wrappers that call it
-- (public.can_view_post -> sees_post; private.reply_visible -> private.reply_ok -> sees_post).
select tests.ok_sql($$select position('sees_post' in prosrc) > 0 from pg_proc where oid = 'public.can_view_post(uuid)'::regprocedure$$,
                    'VIS-4 the wrapper can_view_post calls private.sees_post');
select tests.ok_sql($$select position('sees_post' in prosrc) > 0 from pg_proc where proname = 'reply_ok' and pronamespace = 'private'::regnamespace$$,
                    'VIS-4 the wrapper private.reply_ok (behind reply_visible) calls private.sees_post');
select tests.ok_each($$select quote_ident(n.nspname) || '.' || quote_ident(c.relname) from vis.kinds k join pg_class c on c.oid = k.relation join pg_namespace n on n.oid = c.relnamespace
                         where k.reach = 'item' and c.relkind in ('r', 'p')
                           and has_any_column_privilege('authenticated', k.relation, 'select') order by 1$$,
  $$select (select count(*) from pg_policies p where format('%%I.%%I', p.schemaname, p.tablename)::regclass = %L::regclass
             and p.permissive = 'PERMISSIVE' and p.cmd in ('SELECT', 'ALL')) = 1$$,
  'VIS-4 %s has exactly one permissive select policy (PRIV-VC-R4)');
select tests.ok_each($$select quote_ident(n.nspname) || '.' || quote_ident(c.relname) from vis.kinds k join pg_class c on c.oid = k.relation join pg_namespace n on n.oid = c.relnamespace
                         where k.reach = 'item' and c.relkind in ('r', 'p')
                           and has_any_column_privilege('authenticated', k.relation, 'select') order by 1$$,
  $$select coalesce(bool_and(p.qual ~ '(sees_post|sees_item|can_view_post|reply_visible)\('), false)
      from pg_policies p where format('%%I.%%I', p.schemaname, p.tablename)::regclass = %L::regclass and p.cmd in ('SELECT', 'ALL')$$,
  'VIS-4 every select policy on %s calls private.sees_post (directly or via a wrapper)');

-- ---------- VIS-5 every security definer function app users can call is registered and calls its rule ----------
-- Covers every security definer function in an exposed schema that authenticated or anon can execute
-- (row-returning ones per VIS-5, the rest per PRIV-VC-R2). Registered with a kind: its body names its reach's rule.
-- Registered with kind null: allowlisted, and the note is the reason.
select tests.ok_sql($$select to_regclass('vis.functions') is not null$$, 'VIS-5 the function registry vis.functions exists');
create temp view vis_definer_fns as
  select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'graphql_public') and p.prosecdef and p.prokind = 'f'
     and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'));
select tests.ok_sql(format($$select exists (select 1 from vis.functions where fn = %L::regprocedure)$$, fn::text),
                    format('VIS-5 %s is registered in vis.functions (or allowlisted with a reason)', fn::text))
  from vis_definer_fns order by fn::text;
select tests.ok_each($$select f.fn::text from vis.functions f join vis_definer_fns d on d.fn = f.fn
                         where f.kind is not null order by 1$$,
  $$select case k.reach
           when 'item'      then p.prosrc ~ '(sees_post|sees_item|can_view_post|reply_ok|reply_visible|can_see)\('
           when 'person'    then p.prosrc ~ '(can_see_profile|can_see)\('
           when 'container' then p.prosrc ~ '(can_see_circle|is_circle_member|is_space_manager|my_circle_ids|my_managed_circle_ids|can_see)\('
           when 'self'      then p.prosrc ~ 'auth\.uid\(\)'
           when 'admin'     then p.prosrc ~ '(is_space_manager|is_space_owner|can|my_managed_space_ids|my_owned_space_ids)\('
           else false end
      from vis.functions f join vis.kinds k on k.kind = f.kind join pg_proc p on p.oid = f.fn
     where f.fn = %L::regprocedure$$,
  'VIS-5 %s calls its reach''s rule');
select tests.ok_sql($$select coalesce(bool_and(length(btrim(note)) > 0), true) from vis.functions where kind is null$$,
                    'VIS-5 every allowlisted function names its reason');

-- ---------- report ----------
\o
\pset format aligned
select n, case when ok then 'ok' else 'NOT OK' end as result, description from tests.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from tests.results \gset
\echo
\echo VIS REGISTRY RESULT: :passed passed, :failed failed
select :failed = 0 as all_ok \gset
\if :all_ok
\else
  \echo SOME TESTS FAILED
  select 1/0 as force_nonzero_exit;
\endif
