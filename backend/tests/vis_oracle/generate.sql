-- VIS-8 / VIS-11 generator (SPEC-VISIBILITY-CORE Phase 2, C4; TRACKER R51). Test infrastructure only: never a
-- migration, never deployed. tests/vis_oracle_test.sql includes this file, calls vis_oracle.generate(seed) and
-- compares every read path with vis.can_see; vis_oracle.fixture_json() is what the app's Fake backend loads (VIS-11).
--
-- Deterministic: ids and every "random" choice come from md5(seed:label), times from a fixed base. Nothing reads
-- now() or random(), so the same seed builds the same rows on any day, and the committed seed-42 fixture stays put.
-- Personas only (PERSONAS.md nicknames, emails at example.com). Runs as a superuser, through the real tables with
-- triggers on (notices, profiles, guardians are made the way the app makes them).
--
-- The family it builds (u1..u14 are people, f1..f4 families):
--   f1 Dad's family (owner u1 Dad; Mom u2 is a relative here; Uncle u12 a parent who gets demoted)
--   f2 Aunt's family (owner u11; viewers can post; Cousin u13 posts, then is removed)
--   f3 Mom's family (owner u2, replies open to everyone; Dad u1 is a relative here: the co-parent case)
--   f4 a family that gets deleted (owner u1)
-- Each family: Everyone, household, event, two plain groups and one group retired after use; share-history
-- cutoffs; 16 posts (one deleted, one draft, some words-only, some with unfinished media; the words-only ones are
-- news, event and saying posts with their post_events / post_sayings rows, 0034); replies, reactions,
-- a deleted reply; birthdays and a family date; a chat; push tokens for some, email for all.
create schema if not exists vis_oracle;

create or replace function vis_oracle.id(p_seed int, p_label text) returns uuid language sql immutable as $$
  select (substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 14, 3) || '-8' || substr(h, 18, 3) || '-'
          || substr(h, 21, 12))::uuid
    from (select md5(p_seed || ':' || p_label) as h) x $$;

-- a number in [0, 1) from the seed and a label (replaces random(); same label, same answer)
create or replace function vis_oracle.rnd(p_seed int, p_label text) returns float8 language sql immutable as $$
  select ('x' || substr(md5('r' || p_seed || ':' || p_label), 1, 8))::bit(32)::bigint / 4294967296.0 $$;

-- which seed built the rows in this database, and which rows are its (fixture_json reads only these)
create table if not exists vis_oracle.made (seed int not null, rel text not null, id uuid not null, primary key (rel, id));

create or replace function vis_oracle.generate(p_seed int) returns void language plpgsql as $f$
declare
  names text[] := array['Dad','Mom','Gammy','Grandaddy','Grandmomma','Memaw','Pawpaw','Granny','Gigi','Bebar','Aunt','Uncle',
                        'Cousin','Great-Grandma'];
  base timestamptz := '2026-01-01 12:00+00';
  u uuid[]; i int; j int; f int; sp uuid[]; p uuid; circ uuid[]; n int := 0; mem uuid[]; auth uuid; lbl text;
begin
  delete from vis_oracle.made;
  for i in 1..14 loop
    u[i] := vis_oracle.id(p_seed, 'u' || i);
    insert into auth.users (id, email, raw_user_meta_data)
      values (u[i], lower(replace(names[i], '-', '')) || p_seed || '@example.com', jsonb_build_object('display_name', names[i]));
    insert into vis_oracle.made values (p_seed, 'user', u[i]);
  end loop;
  insert into public.households (id, name, created_by)
    values (vis_oracle.id(p_seed, 'h1'), 'Dad home', u[1]), (vis_oracle.id(p_seed, 'h2'), 'Mom home', u[2]);
  insert into public.household_members (household_id, user_id, role)
    values (vis_oracle.id(p_seed, 'h1'), u[1], 'admin'), (vis_oracle.id(p_seed, 'h2'), u[2], 'admin')
    on conflict do nothing;
  for f in 1..4 loop
    sp[f] := vis_oracle.id(p_seed, 's' || f);
    insert into public.spaces (id, household_id, name, plan, created_by, reply_audience, viewers_can_post)
      values (sp[f], vis_oracle.id(p_seed, case when f in (1, 2, 4) then 'h1' else 'h2' end), 'Family ' || f, 'free',
              case f when 3 then u[2] when 2 then u[11] else u[1] end, case when f = 3 then 'everyone' else 'parents' end, f = 2);
    insert into vis_oracle.made values (p_seed, 'space', sp[f]);
  end loop;
  insert into public.space_members (space_id, user_id, role, invited_by) values
    (sp[1],u[1],'owner',null),(sp[1],u[2],'viewer',u[1]),(sp[1],u[3],'viewer',u[1]),(sp[1],u[4],'viewer',u[1]),(sp[1],u[5],'viewer',u[1]),
    (sp[1],u[9],'viewer',u[1]),(sp[1],u[10],'viewer',u[1]),(sp[1],u[11],'viewer',u[1]),(sp[1],u[12],'adult',u[1]),
    (sp[3],u[2],'owner',null),(sp[3],u[1],'viewer',u[2]),(sp[3],u[6],'viewer',u[2]),(sp[3],u[7],'viewer',u[2]),(sp[3],u[8],'viewer',u[2]),
    (sp[3],u[14],'viewer',u[2]),(sp[3],u[13],'viewer',u[2]),
    (sp[2],u[11],'owner',null),(sp[2],u[12],'viewer',u[11]),(sp[2],u[13],'viewer',u[11]),(sp[2],u[3],'viewer',u[11]),
    (sp[4],u[1],'owner',null),(sp[4],u[3],'viewer',u[1])
  on conflict (space_id, user_id) do update set role = excluded.role, invited_by = excluded.invited_by;
  for f in 1..4 loop
    select array_agg(user_id order by user_id) into mem from public.space_members where space_id = sp[f];
    circ := array[vis_oracle.id(p_seed,'c'||f||'e'), vis_oracle.id(p_seed,'c'||f||'h'), vis_oracle.id(p_seed,'c'||f||'v'),
                  vis_oracle.id(p_seed,'c'||f||'g1'), vis_oracle.id(p_seed,'c'||f||'g2'), vis_oracle.id(p_seed,'c'||f||'x')];
    -- a family's own trigger may already have made an Everyone group: use ours, retire nothing of its
    insert into public.circles (id, space_id, name, kind, created_by) values
      (circ[1], sp[f], 'Everyone', 'everyone', mem[1]), (circ[2], sp[f], 'Home', 'household', mem[1]),
      (circ[3], sp[f], 'Beach', 'event', mem[1]), (circ[4], sp[f], 'Group A', 'group', mem[1]),
      (circ[5], sp[f], 'Group B', 'group', mem[1]), (circ[6], sp[f], 'Old group', 'group', mem[1]);
    for j in 1..array_length(mem, 1) loop
      lbl := f || ':' || j;
      insert into public.circle_members (circle_id, user_id) values (circ[1], mem[j]) on conflict do nothing;
      if vis_oracle.rnd(p_seed, 'g1:' || lbl) < 0.5 or j = 2 then
        insert into public.circle_members (circle_id, user_id, sees_from)
          values (circ[4], mem[j], case when j = 2 then base + interval '8 hours' end) on conflict do nothing;
      end if;
      if vis_oracle.rnd(p_seed, 'g2:' || lbl) < 0.5 then
        insert into public.circle_members (circle_id, user_id, sees_from)
          values (circ[5], mem[j], case when j % 3 = 0 then base + interval '8 hours' end) on conflict do nothing;
      end if;
      if j % 2 = 0 then insert into public.circle_members (circle_id, user_id) values (circ[2], mem[j]) on conflict do nothing; end if;
      if j % 3 = 1 then insert into public.circle_members (circle_id, user_id) values (circ[3], mem[j]) on conflict do nothing; end if;
      if j % 2 = 1 then insert into public.circle_members (circle_id, user_id) values (circ[6], mem[j]) on conflict do nothing; end if;
    end loop;
    insert into public.chat_groups (circle_id, created_by) values (circ[4], mem[1]) on conflict do nothing;
    for i in 1..16 loop
      n := n + 1;
      p := vis_oracle.id(p_seed, 'p' || n);
      auth := case when f = 1 and i % 5 = 0 then u[12] when f = 2 and i % 4 = 0 then u[13] when f = 3 then u[2]
                   when f = 2 then u[11] else u[1] end;
      -- words-only posts (i % 3 = 0, no media) are the 0034 kinds: news, event, saying, then an event again
      insert into public.posts (id, space_id, author_id, caption, title, taken_at, kind)
        values (p, sp[f], auth, 'Post ' || n, case when i % 4 = 1 then 'Day ' || n end,
                case when i % 3 = 0 then base - (i || ' days')::interval end,
                case i when 3 then 'news' when 6 then 'event' when 9 then 'saying' when 12 then 'event' else 'photos' end);
      if i in (6, 12) then
        insert into public.post_events (id, post_id, what, on_date, place)
          values (vis_oracle.id(p_seed, 'ev' || n), p, 'Picnic ' || n, date '2026-02-01' + i, case when i = 6 then 'the park' end);
      elsif i = 9 then
        insert into public.post_sayings (id, post_id, words, who, age)
          values (vis_oracle.id(p_seed, 'sy' || n), p, 'Crunchy water ' || n, 'Mia', 4);
      end if;
      insert into public.post_audiences (post_id, circle_id)
        values (p, circ[1 + floor(vis_oracle.rnd(p_seed, 'aud:' || n) * 6)::int]);
      if vis_oracle.rnd(p_seed, 'aud2:' || n) < 0.4 then
        insert into public.post_audiences (post_id, circle_id) values (p, circ[4]) on conflict do nothing;
      end if;
      if i % 3 <> 0 then
        insert into public.media_items (id, post_id, space_id, uploader_id, position, kind, mime_type, display_key, thumb_key,
                                        width, height, byte_size, thumb_byte_size, exif_stripped, upload_status)
          values (vis_oracle.id(p_seed, 'm' || n), p, sp[f], auth, 0, 'photo', 'image/jpeg', 'k' || n, 't' || n, 10, 10, 100, 10,
                  true, case when i % 7 = 0 then 'pending' else 'ready' end::public.upload_status);
      end if;
      if i <> 16 then
        update public.posts set status = 'published', published_at = base + (i || ' hours')::interval where id = p;
      end if;
      for j in 1..array_length(mem, 1) loop
        lbl := n || ':' || j;
        if vis_oracle.rnd(p_seed, 'cm:' || lbl) < 0.15 and private.sees_post(mem[j], p) then
          insert into public.comments (id, post_id, author_id, body, created_at)
            values (vis_oracle.id(p_seed, 'cm' || lbl), p, mem[j], 'Hi', base + (i || ' hours 5 minutes')::interval);
        end if;
        if vis_oracle.rnd(p_seed, 'rx:' || lbl) < 0.15 and private.sees_post(mem[j], p) then
          insert into public.reactions (post_id, user_id, emoji, created_at)
            values (p, mem[j], '❤️', base + (i || ' hours 6 minutes')::interval);
        end if;
      end loop;
      if i = 15 then update public.posts set deleted_at = base + interval '2 days' where id = p; end if;
    end loop;
    insert into public.family_dates (id, space_id, kind, label, month, day, member_id, created_by) values
      (vis_oracle.id(p_seed, 'd'||f||'a'), sp[f], 'birthday', null, 3, 3, mem[2], mem[1]),
      (vis_oracle.id(p_seed, 'd'||f||'b'), sp[f], 'birthday', null, 4, 4, coalesce(mem[3], mem[1]), mem[1]),
      (vis_oracle.id(p_seed, 'd'||f||'c'), sp[f], 'other', 'Reunion', 5, 5, null, mem[1]);
    update public.circles set deleted_at = base + interval '3 days' where id = circ[6];
  end loop;
  -- some unfinished uploads finish; three posts keep theirs pending
  update public.media_items set upload_status = 'ready'
   where post_id in (select id from public.posts where author_id = any (u)) and position = 0
     and post_id not in (vis_oracle.id(p_seed, 'p7'), vis_oracle.id(p_seed, 'p14'), vis_oracle.id(p_seed, 'p23'));
  update public.comments set deleted_at = base + interval '3 days'
   where id = (select id from public.comments where author_id = any (u) order by id limit 1);
  -- demote Uncle in family 1; remove Cousin from family 2; delete family 4
  update public.space_members set role = 'viewer' where space_id = sp[1] and user_id = u[12];
  delete from public.space_members where space_id = sp[2] and user_id = u[13];
  update public.spaces set deleted_at = base + interval '4 days' where id = sp[4];
  insert into public.push_tokens (user_id, expo_token, platform)
    select x, 'ExponentPushToken[' || x || ']', 'ios' from unnest(u[3:8]) x;
end $f$;

-- ISO time in UTC, the same text on every machine (to_jsonb would follow the session's time zone)
create or replace function vis_oracle.ts(p timestamptz) returns text language sql immutable as $$
  select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

-- The generated rows plus the oracle's answers, in the shape app/src/api/__tests__/visOracle.test.ts reads.
create or replace function vis_oracle.fixture_json() returns jsonb language sql stable as $$
  with us as (select id from vis_oracle.made where rel = 'user'),
       sps as (select id from vis_oracle.made where rel = 'space'),
       po as (select p.* from public.posts p where p.space_id in (select id from sps)),
       co as (select c.* from public.comments c where c.post_id in (select id from po)),
       fd as (select d.* from public.family_dates d where d.space_id in (select id from sps)),
       ci as (select c.* from public.circles c where c.space_id in (select id from sps))
  select jsonb_build_object(
    'seed', (select min(seed) from vis_oracle.made),
    'users', (select coalesce(jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.display_name) order by pr.id), '[]')
                from public.profiles pr where pr.id in (select id from us)),
    'spaces', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'deleted', s.deleted_at is not null,
                                                            'reply_audience', s.reply_audience) order by s.id), '[]')
                 from public.spaces s where s.id in (select id from sps)),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('space', sm.space_id, 'user', sm.user_id, 'role', sm.role)
                                          order by sm.space_id, sm.user_id), '[]')
                  from public.space_members sm where sm.space_id in (select id from sps)),
    'circles', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'space', c.space_id, 'name', c.name, 'kind', c.kind,
                                                             'deleted', c.deleted_at is not null) order by c.id), '[]') from ci c),
    'circle_members', (select coalesce(jsonb_agg(jsonb_build_object('circle', cm.circle_id, 'user', cm.user_id,
                                                                    'sees_from', vis_oracle.ts(cm.sees_from))
                                                 order by cm.circle_id, cm.user_id), '[]')
                         from public.circle_members cm where cm.circle_id in (select id from ci)),
    'posts', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'space', p.space_id, 'author', p.author_id,
                'status', p.status, 'deleted', p.deleted_at is not null, 'published_at', vis_oracle.ts(p.published_at),
                'taken_at', vis_oracle.ts(p.taken_at), 'title', p.title, 'caption', p.caption, 'kind', p.kind,
                'circles', (select coalesce(jsonb_agg(pa.circle_id order by pa.circle_id), '[]')
                              from public.post_audiences pa where pa.post_id = p.id)) order by p.id), '[]') from po p),
    'comments', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'post', c.post_id, 'author', c.author_id, 'body', c.body,
                   'created_at', vis_oracle.ts(c.created_at), 'deleted', c.deleted_at is not null) order by c.id), '[]') from co c),
    'reactions', (select coalesce(jsonb_agg(jsonb_build_object('post', r.post_id, 'user', r.user_id, 'emoji', r.emoji,
                    'created_at', vis_oracle.ts(r.created_at)) order by r.post_id, r.user_id), '[]')
                    from public.reactions r where r.post_id in (select id from po)),
    'family_dates', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'space', d.space_id, 'kind', d.kind, 'label', d.label,
                       'month', d.month, 'day', d.day, 'member', d.member_id, 'created_by', d.created_by) order by d.id), '[]') from fd d),
    'oracle', jsonb_build_object(
      'post', (select coalesce(jsonb_agg(jsonb_build_array(x.u, x.id) order by x.u, x.id), '[]')
                 from (select us.id as u, po.id from us cross join po where vis.can_see(us.id, 'post', po.id)) x),
      'comment', (select coalesce(jsonb_agg(jsonb_build_array(x.u, x.id) order by x.u, x.id), '[]')
                    from (select us.id as u, co.id from us cross join co where vis.can_see(us.id, 'comment', co.id)) x),
      'family_date', (select coalesce(jsonb_agg(jsonb_build_array(x.u, x.id) order by x.u, x.id), '[]')
                        from (select us.id as u, fd.id from us cross join fd where vis.can_see(us.id, 'family_date', fd.id)) x)))
$$;
