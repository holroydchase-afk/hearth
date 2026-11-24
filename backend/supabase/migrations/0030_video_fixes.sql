-- 0030: video fixes from the Nov 19 tech-debt review, before video is switched on (DEC-88). Tests: tests/video_refund_test.sql,
-- tests/video_cap_test.sql.
--   ENG-R2  The free cap (0020) counted attempts, so a video that never finished uploading still used up one of the
--           month's 10: the upload queue's restart() throws its draft away and prepares a new one, so one video could
--           cost three. Now a free video that never reached 'ready' gives its count back, once, to the month it was
--           counted in, when its upload is marked 'failed', its row is deleted, or its post is deleted while it is
--           still pending. A video that did upload keeps its count when it is deleted later (as in 0020). The counter
--           never goes below 0. Paid families' videos were never counted, so nothing is given back for them.
--           Bookkeeping lives in private.video_refundable: one row per counted video still in flight (who, which
--           month). Reaching 'ready' drops the row; giving the count back drops it too, so it can only happen once.
--   ENG-R11 The cap refusal now has its own SQLSTATE, HF002 (HF001 is family_full, 0024), so sign-media branches on
--           the code, not the message (CLAUDE.md rule 7). tg_media_before_insert is 0024's with only that change.
--   SEC-R7  private.videos_this_month(uuid) is SECURITY DEFINER and was executable by PUBLIC, so anyone signed in
--           could read anyone's monthly count. Only definer functions (space_upload_quota) call it now.

-- ---------------------------------------------------------------------------
-- ENG-R2
-- ---------------------------------------------------------------------------
create table private.video_refundable (
  media_id uuid primary key,          -- no FK: the row is read in the media row's own delete trigger
  user_id  uuid not null,
  month    date not null
);
-- Private schema, no grants: only the definer functions below touch it.

-- Gives a counted, unfinished video back to the month it was counted in. Does nothing the second time.
create or replace function private.give_video_back(p_media uuid) returns void
language sql security definer set search_path = '' as $$
  with r as (delete from private.video_refundable where media_id = p_media returning user_id, month)
  update private.video_usage u set videos = greatest(u.videos - 1, 0)
    from r where u.user_id = r.user_id and u.month = r.month
$$;
revoke execute on function private.give_video_back(uuid) from public, anon, authenticated;

-- Upload result: 'ready' keeps the count for good; 'failed' gives it back.
create or replace function private.tg_media_video_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.upload_status = 'ready' then
    delete from private.video_refundable where media_id = new.id;
  elsif new.upload_status = 'failed' then
    perform private.give_video_back(new.id);
  end if;
  return null;
end $$;
create trigger media_video_status after update of upload_status on public.media_items
  for each row when (new.kind = 'video' and old.upload_status is distinct from new.upload_status)
  execute function private.tg_media_video_status();

-- A row deleted before it was ready (by its uploader, the purge worker, or a cascade) gives its count back.
create or replace function private.tg_media_video_deleted() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.upload_status <> 'ready' then perform private.give_video_back(old.id); end if;
  return null;
end $$;
create trigger media_video_deleted after delete on public.media_items
  for each row when (old.kind = 'video') execute function private.tg_media_video_deleted();

-- A post soft-deleted while its videos are still pending (the upload queue's restart()) gives them back.
create or replace function private.tg_post_deleted_videos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.give_video_back(m.id)
     from public.media_items m
    where m.post_id = new.id and m.kind = 'video' and m.upload_status <> 'ready';
  return null;
end $$;
create trigger post_deleted_videos after update of deleted_at on public.posts
  for each row when (old.deleted_at is null and new.deleted_at is not null)
  execute function private.tg_post_deleted_videos();

revoke execute on function private.tg_media_video_status(), private.tg_media_video_deleted(),
  private.tg_post_deleted_videos() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- ENG-R11 (+ ENG-R2's bookkeeping row): same as 0024 except errcode HF002 and the video_refundable insert.
-- ---------------------------------------------------------------------------
create or replace function public.tg_media_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_space   uuid;
  v_plan    public.plan_tier;
  v_month   date;
  v_count   integer;
  v_cap     integer;
  v_now_m   date := (date_trunc('month', now() at time zone 'utc'))::date;
begin
  select p.space_id into v_space from public.posts p where p.id = new.post_id;
  new.space_id    := v_space;
  new.uploader_id := coalesce(auth.uid(), (select author_id from public.posts where id = new.post_id));
  new.id          := coalesce(new.id, gen_random_uuid());
  new.display_key := format('s/%s/p/%s/m/%s/display', v_space, new.post_id, new.id);
  new.thumb_key   := format('s/%s/p/%s/m/%s/thumb',   v_space, new.post_id, new.id);
  new.upload_status := 'pending';

  perform private.family_cap_check(v_space, coalesce(new.byte_size, 0) + coalesce(new.thumb_byte_size, 0));

  if new.kind = 'video' then
    if auth.uid() is not null and not private.feature_on(v_space, 'video_posting') then
      raise exception 'video_posting_off' using errcode = '42501';
    end if;
    select plan, videos_month, videos_this_month into v_plan, v_month, v_count
      from public.spaces where id = v_space;
    if v_month <> v_now_m then v_count := 0; end if;
    v_cap := public.plan_video_cap(v_plan);
    if v_cap is not null then
      -- S14: one row per person per month; the row lock serializes that person's concurrent uploads.
      insert into private.video_usage (user_id, month) values (new.uploader_id, v_now_m) on conflict do nothing;
      if (select u.videos from private.video_usage u
           where u.user_id = new.uploader_id and u.month = v_now_m for update) >= v_cap then
        raise exception 'free_video_cap_reached'
          using errcode = 'HF002',
                hint = format('Each person can send %s videos a month on the free plan.', v_cap);
      end if;
      update private.video_usage set videos = videos + 1 where user_id = new.uploader_id and month = v_now_m;
      -- ENG-R2: counted and not yet uploaded, so it can be given back if it never gets there.
      insert into private.video_refundable (media_id, user_id, month) values (new.id, new.uploader_id, v_now_m)
        on conflict (media_id) do nothing;
    end if;
    update public.spaces set videos_month = v_now_m, videos_this_month = v_count + 1 where id = v_space;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- SEC-R7
-- ---------------------------------------------------------------------------
revoke execute on function private.videos_this_month(uuid) from public, anon, authenticated;
