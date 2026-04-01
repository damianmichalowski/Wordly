drop function if exists public.mark_word_known_and_advance_daily_word(uuid);

create or replace function public.mark_word_known_and_advance_daily_word(
  p_word_id uuid
)
returns table (
  daily_word_id uuid,
  word_id uuid,
  day_date date
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_now timestamptz := now();

  v_learning_language_id uuid;
  v_learning_mode_type text;
  v_learning_level text;
  v_selected_category_id uuid;

  v_old_daily_word_id uuid;
  v_candidate_word_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_word_id is null then
    raise exception 'word_id is required';
  end if;

  -- 1. mark current word as known
  insert into public.user_word_progress (
    user_id,
    word_id,
    status,
    known_at,
    last_review_at,
    interval_days,
    next_review_at,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    p_word_id,
    'known',
    v_now,
    v_now,
    1,
    v_now + interval '1 day',
    v_now,
    v_now
  )
  on conflict on constraint user_word_progress_unique
  do update
    set
      status = 'known',
      known_at = coalesce(public.user_word_progress.known_at, v_now),
      last_review_at = v_now,
      interval_days = case
        when public.user_word_progress.interval_days is null
          or public.user_word_progress.interval_days < 1
        then 1
        else public.user_word_progress.interval_days
      end,
      next_review_at = case
        when public.user_word_progress.next_review_at is null then v_now + interval '1 day'
        else public.user_word_progress.next_review_at
      end,
      updated_at = v_now;

  -- 2. remove today's current daily word entry
  select udw.id
  into v_old_daily_word_id
  from public.user_daily_word as udw
  where udw.user_id = v_user_id
    and udw.day_date = v_today
    and udw.word_id = p_word_id
  limit 1;

  if v_old_daily_word_id is not null then
    delete from public.user_daily_word
    where id = v_old_daily_word_id;
  end if;

  -- 3. load user profile
  select
    up.learning_language_id,
    up.learning_mode_type,
    up.learning_level,
    up.selected_category_id
  into
    v_learning_language_id,
    v_learning_mode_type,
    v_learning_level,
    v_selected_category_id
  from public.user_profile as up
  where up.id = v_user_id;

  if v_learning_language_id is null or v_learning_mode_type is null then
    raise exception 'User profile not found or incomplete';
  end if;

  -- 4. pick next candidate, excluding known words
  if v_learning_mode_type = 'difficulty' then
    select w.id
    into v_candidate_word_id
    from public.words as w
    join public.cefr_level as cl
      on cl.id = w.cefr_level_id
    where w.target_language_id = v_learning_language_id
      and w.is_active = true
      and (
        (v_learning_level = 'beginner' and cl.code in ('A1', 'A2'))
        or
        (v_learning_level = 'intermediate' and cl.code in ('B1', 'B2'))
        or
        (v_learning_level = 'advanced' and cl.code in ('C1', 'C2'))
      )
      and not exists (
        select 1
        from public.user_word_progress as uwp
        where uwp.user_id = v_user_id
          and uwp.word_id = w.id
          and uwp.status = 'known'
      )
    order by random()
    limit 1;

  elsif v_learning_mode_type = 'category' then
    select w.id
    into v_candidate_word_id
    from public.words as w
    join public.word_category as wc
      on wc.word_id = w.id
    where w.target_language_id = v_learning_language_id
      and w.is_active = true
      and wc.category_id = v_selected_category_id
      and not exists (
        select 1
        from public.user_word_progress as uwp
        where uwp.user_id = v_user_id
          and uwp.word_id = w.id
          and uwp.status = 'known'
      )
    order by random()
    limit 1;

  else
    raise exception 'Unsupported learning_mode_type=%', v_learning_mode_type;
  end if;

  -- 5. no more words left
  if v_candidate_word_id is null then
    return;
  end if;

  -- 6. create next daily word for today
  insert into public.user_daily_word (
    user_id,
    day_date,
    word_id
  )
  values (
    v_user_id,
    v_today,
    v_candidate_word_id
  )
  returning id into daily_word_id;

  -- 7. ensure progress row exists as learning
  insert into public.user_word_progress (
    user_id,
    word_id,
    status,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_candidate_word_id,
    'learning',
    v_now,
    v_now
  )
  on conflict on constraint user_word_progress_unique
  do update
    set
      status = case
        when public.user_word_progress.status = 'known' then public.user_word_progress.status
        else 'learning'
      end,
      updated_at = v_now;

  word_id := v_candidate_word_id;
  day_date := v_today;

  return next;
  return;
end;
$$;

revoke all on function public.mark_word_known_and_advance_daily_word(uuid) from public;
grant execute on function public.mark_word_known_and_advance_daily_word(uuid) to authenticated;