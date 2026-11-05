-- 0023: a fourth reaction, 🎉 Hooray (Chase, Nov 5: "add"; REACT-12, tests/reactions_test.sql).
-- Same rules as the other three (0017): one per person per post, switch or take back, counts follow the reply
-- rules. Only the allowed list grows, in set_reaction and in 0018's table check (HARD-12). Older apps never send it,
-- and show a 🎉 count from reaction_summary only if they render unknown kinds (they skip them).
create or replace function public.set_reaction(p_post uuid, p_emoji text) returns public.reaction_state
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_had text; r public.reaction_state;
begin
  if p_emoji is null or p_emoji not in ('❤️', '😂', '👍', '🎉') then
    raise exception 'unknown reaction' using errcode = '22023';
  end if;
  if not public.can_view_post(p_post) then raise exception 'post not found' using errcode = 'P0002'; end if;
  if not public.can_comment_in_space((select space_id from public.posts where id = p_post)) then
    raise exception 'reactions are turned off here' using errcode = '42501';
  end if;
  select emoji into v_had from public.reactions where post_id = p_post and user_id = v_uid for update;
  if v_had = p_emoji then
    delete from public.reactions where post_id = p_post and user_id = v_uid;
  elsif v_had is not null then
    update public.reactions set emoji = p_emoji where post_id = p_post and user_id = v_uid;
  else
    insert into public.reactions (post_id, user_id, emoji) values (p_post, v_uid, p_emoji) on conflict do nothing;
  end if;
  r.my_reaction := (select emoji from public.reactions where post_id = p_post and user_id = v_uid);
  r.counts := private.reaction_counts(p_post);
  r.heart_count := (select coalesce(sum(value::integer), 0)::integer from jsonb_each_text(r.counts));
  return r;
end $$;

alter table public.reactions drop constraint reactions_emoji_known;
alter table public.reactions add constraint reactions_emoji_known check (emoji in ('❤️', '😂', '👍', '🎉'));
