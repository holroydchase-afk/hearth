-- 0025: find a post by its words, who sent it and when (SEARCH-1..14; docs/product/SPEC-SEARCH.md, go-live item 9).
-- Plain words only, never AI: every typed word must appear in the post's title, caption or the sender's name
-- (case-insensitive, as a literal: % and _ are just characters). Optional "from this person" and a capture-date
-- range [p_from, p_until), on the same date the timeline sorts by (taken_at, else published_at).
-- Privacy: the candidates are private.visible_posts, the timeline's own "who sees what" rule, so a post you can't
-- see is never found. Group names are never searched, and rows come from private.feed_rows, which hands the
-- audience (group titles) to the sender only (GROUP PRIVACY, Nov 4). Replies are not searched: their own
-- reader rules (0009, 0013) stay with get_comments. STABLE: Hearth stores nothing anyone types, and the app never logs
-- it; the database host's own statement logs follow its settings (SEARCH-R2, TRACKER R42). Supabase's 8 s statement
-- timeout for signed-in calls bounds a search (SEARCH-R3).
-- Order and paging match get_timeline: newest photo first, keyset (p_before_at, p_before_id). Same columns too.

create function public.search_posts(
  p_space uuid, p_query text default null, p_author uuid default null,
  p_from timestamptz default null, p_until timestamptz default null,
  p_before_at timestamptz default null, p_before_id uuid default null, p_limit integer default 20)
returns table (post_id uuid, author_id uuid, author_name text, caption text, published_at timestamptz,
               media jsonb, heart_count integer, i_hearted boolean, comment_count integer,
               audience jsonb, seen_count integer, reach_count integer, reply_scope text,
               taken_at timestamptz, sort_at timestamptz, event_id uuid, event_name text, title text, words_edited_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_q     text := btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g'));
  v_words text[];
  v_pats  text[];
  v_lim   integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_at    timestamptz := coalesce(p_before_at, 'infinity');
  v_id    uuid := coalesce(p_before_id, '00000000-0000-0000-0000-000000000000');
begin
  if char_length(v_q) > 100 then
    raise exception 'search words are 100 characters at most' using errcode = '22023';
  end if;
  v_words := case when v_q = '' then '{}'::text[] else string_to_array(v_q, ' ') end;
  if cardinality(v_words) > 8 then
    raise exception 'search with 8 words at most' using errcode = '22023';
  end if;
  if cardinality(v_words) = 0 and p_author is null and p_from is null and p_until is null then
    raise exception 'type a word, or pick a person or dates' using errcode = '22023';
  end if;
  -- each word as a literal ILIKE pattern: escape \ first, then % and _
  select coalesce(array_agg('%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%'), '{}')
    into v_pats from unnest(v_words) w;

  return query
  select f.post_id, f.author_id, f.author_name, f.caption, f.published_at, f.media, f.heart_count, f.i_hearted,
         f.comment_count, f.audience, f.seen_count, f.reach_count, f.reply_scope,
         f.taken_at, coalesce(f.taken_at, f.published_at), f.event_id, f.event_name, p.title, p.words_edited_at
  from private.feed_rows(array(
         select p2.id
         from private.visible_posts(p_space, 'taken', null, null, null) v
         join public.posts p2 on p2.id = v.post_id
         join public.profiles pr on pr.id = p2.author_id
         where (p_author is null or p2.author_id = p_author)
           and (p_from is null or coalesce(p2.taken_at, p2.published_at) >= p_from)
           and (p_until is null or coalesce(p2.taken_at, p2.published_at) < p_until)
           and (coalesce(p2.taken_at, p2.published_at), p2.id) < (v_at, v_id)
           and coalesce(p2.title, '') || ' ' || coalesce(p2.caption, '') || ' ' || coalesce(pr.display_name, '')
               ilike all (v_pats)
         order by coalesce(p2.taken_at, p2.published_at) desc, p2.id desc
         limit v_lim)) f
  join public.posts p on p.id = f.post_id
  order by coalesce(f.taken_at, f.published_at) desc, f.post_id desc;
end $$;

revoke all on function public.search_posts(uuid, text, uuid, timestamptz, timestamptz, timestamptz, uuid, integer) from public, anon;
grant execute on function public.search_posts(uuid, text, uuid, timestamptz, timestamptz, timestamptz, uuid, integer) to authenticated;
