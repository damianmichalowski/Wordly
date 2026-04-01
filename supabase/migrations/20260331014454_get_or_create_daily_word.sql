create or replace function public.get_or_create_daily_word(p_user_id uuid)
returns table (
  daily_word_id uuid,
  word_id uuid,
  day_date date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
  v_existing_daily_word_id uuid;
  v_existing_word_id uuid;

  v_learning_language_id uuid;
  v_learning_mode_type text;
  v_learning_level text;
  v_selected_category_id uuid;

  v_candidate_word_id uuid;
begin
  -- 1. Auto-finish previous learning words -> known
  -- zgodnie z Twoją zasadą: gdy kończy się dzień, słowo staje się known
  update public.user_word_progress uwp
  set
    status = 'known',
    known_at = coalesce(uwp.known_at, now()),
    updated_at = now()
  where uwp.user_id = p_user_id
    and uwp.status = 'learning'
    and exists (
      select 1
      from public.user_daily_word udw
      where udw.user_id = p_user_id
        and udw.word_id = uwp.word_id
        and udw.day_date < v_today
    );

  -- 2. If today's word already exists -> return it
  select udw.id, udw.word_id
  into v_existing_daily_word_id, v_existing_word_id
  from public.user_daily_word udw
  where udw.user_id = p_user_id
    and udw.day_date = v_today
  limit 1;

  if v_existing_daily_word_id is not null then
    return query
    select v_existing_daily_word_id, v_existing_word_id, v_today;
    return;
  end if;

  -- 3. Load user profile
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
  from public.user_profile up
  where up.id = p_user_id;

  if v_learning_language_id is null or v_learning_mode_type is null then
    raise exception 'User profile not found or incomplete for user_id=%', p_user_id;
  end if;

  -- 4. Pick candidate
  if v_learning_mode_type = 'difficulty' then
    select w.id
    into v_candidate_word_id
    from public.words w
    join public.cefr_level cl on cl.id = w.cefr_level_id
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
        from public.user_word_progress uwp
        where uwp.user_id = p_user_id
          and uwp.word_id = w.id
          and uwp.status = 'known'
      )
    order by random()
    limit 1;

  elsif v_learning_mode_type = 'category' then
    select w.id
    into v_candidate_word_id
    from public.words w
    join public.word_category wc on wc.word_id = w.id
    where w.target_language_id = v_learning_language_id
      and w.is_active = true
      and wc.category_id = v_selected_category_id
      and not exists (
        select 1
        from public.user_word_progress uwp
        where uwp.user_id = p_user_id
          and uwp.word_id = w.id
          and uwp.status = 'known'
      )
    order by random()
    limit 1;

  else
    raise exception 'Unsupported learning_mode_type=% for user_id=%', v_learning_mode_type, p_user_id;
  end if;

  -- 5. No candidates -> return empty
  if v_candidate_word_id is null then
    return;
  end if;

  -- 6. Save daily word
  insert into public.user_daily_word (
    user_id,
    day_date,
    word_id
  )
  values (
    p_user_id,
    v_today,
    v_candidate_word_id
  )
  returning id into v_existing_daily_word_id;

  -- 7. Ensure progress exists as learning
  insert into public.user_word_progress (
    user_id,
    word_id,
    status,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    v_candidate_word_id,
    'learning',
    now(),
    now()
  )
  on conflict (user_id, word_id)
  do update
    set
      status = case
        when public.user_word_progress.status = 'known' then public.user_word_progress.status
        else 'learning'
      end,
      updated_at = now();

  -- 8. Return created daily word
  return query
  select v_existing_daily_word_id, v_candidate_word_id, v_today;
end;
$$;