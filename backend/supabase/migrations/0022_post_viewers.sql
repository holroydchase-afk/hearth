-- 0022: who can see a post, by people's names (Chase, Nov 4; WHO-1..5, tests/viewers_test.sql).
-- Every card says who can see it ("Grandma Jo, Grandpa Earl and Kai can see this") to everyone who can see it.
-- A group's name stays with the parents (get_feed's audience column, unchanged): Chase found "Grandparents – Dad's
-- side" off-putting to show a grandparent. The list is exactly the family members private.sees_post lets see the
-- post, so it can never name someone who can't see it, and it carries a name and an id only.
-- A post you can't see is left out (it behaves as "not found"), like reaction_summary (0017).

create function public.post_viewers(p_posts uuid[])
returns table (post_id uuid, viewers jsonb)
language sql stable security definer set search_path = '' as $$
  select p.id,
         (select coalesce(jsonb_agg(jsonb_build_object('user_id', sm.user_id::text, 'name', pr.display_name)
                                    order by pr.display_name, sm.user_id), '[]'::jsonb)
            from public.space_members sm
            join public.profiles pr on pr.id = sm.user_id
           where sm.space_id = p.space_id and private.sees_post(sm.user_id, p.id))
  from public.posts p
  where p.id = any (p_posts[1:100]) and p.deleted_at is null and public.can_view_post(p.id)
$$;

revoke all on function public.post_viewers(uuid[]) from public, anon;
grant execute on function public.post_viewers(uuid[]) to authenticated;
