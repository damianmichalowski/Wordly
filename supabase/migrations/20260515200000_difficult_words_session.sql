-- Difficult Words revision mode: fetch deck, hub count, streak updates with last_review_at.

create or replace function public.set_word_difficult_correct_streak(
  p_word_id uuid,
  p_streak integer
)
returns table (
  user_id uuid,
  word_id uuid,
  difficult_correct_streak integer,
  is_difficult boolean,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();

  v_status text;
  v_streak integer;
  v_is_difficult boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_word_id is null then
    raise exception 'word_id is required';
  end if;

  if p_streak is null then
    raise exception 'streak is required';
  end if;

  if p_streak < 0 then
    raise exception 'streak must be >= 0';
  end if;

  if not exists (
    select 1
    from public.words as w
    where w.id = p_word_id
      and w.is_active = true
  ) then
    raise exception 'word not found or inactive';
  end if;

  insert into public.user_word_progress (
    user_id,
    word_id,
    status,
    difficult_correct_streak,
    last_review_at,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    p_word_id,
    'learning',
    p_streak,
    v_now,
    v_now,
    v_now
  )
  on conflict on constraint user_word_progress_unique
  do update
    set
      difficult_correct_streak = p_streak,
      last_review_at = v_now,
      updated_at = v_now;

  select
    uwp.status,
    uwp.difficult_correct_streak,
    uwp.is_difficult
  into
    v_status,
    v_streak,
    v_is_difficult
  from public.user_word_progress as uwp
  where uwp.user_id = v_user_id
    and uwp.word_id = p_word_id
  limit 1;

  user_id := v_user_id;
  word_id := p_word_id;
  difficult_correct_streak := v_streak;
  is_difficult := v_is_difficult;
  status := v_status;

  return next;
  return;
end;
$$;

create or replace function public.get_difficult_words(
  p_limit integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_limit is not null and p_limit < 1 then
    raise exception 'limit must be >= 1 when provided';
  end if;

  with difficult_words as (
    select
      uwp.word_id,
      uwp.last_review_at,
      uwp.difficult_correct_streak
    from public.user_word_progress as uwp
    join public.words as w
      on w.id = uwp.word_id
    where uwp.user_id = v_user_id
      and uwp.is_difficult = true
      and w.is_active = true
    order by uwp.last_review_at asc nulls first, uwp.word_id asc
    limit p_limit
  )
  select coalesce(
    jsonb_agg(
      public.get_word_details(dw.word_id)
        || jsonb_build_object(
          'difficult_correct_streak', coalesce(dw.difficult_correct_streak, 0),
          'last_review_at', dw.last_review_at
        )
      order by dw.last_review_at asc nulls first, dw.word_id asc
    ),
    '[]'::jsonb
  )
  into v_result
  from difficult_words as dw;

  return v_result;
end;
$$;

create or replace function public.get_revision_hub_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();

  v_due_count int;
  v_known_count int;
  v_recent_count int;
  v_difficult_count int;
  v_completed_today boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select count(*)
  into v_due_count
  from public.user_word_progress uwp
  where uwp.user_id = v_user_id
    and uwp.status = 'known'
    and uwp.next_review_at is not null
    and uwp.next_review_at <= v_now;

  select count(*)
  into v_known_count
  from public.user_word_progress uwp
  where uwp.user_id = v_user_id
    and uwp.status = 'known';

  select count(*)
  into v_recent_count
  from (
    select 1
    from public.user_word_progress uwp
    where uwp.user_id = v_user_id
      and uwp.status = 'known'
      and uwp.known_at is not null
    order by uwp.known_at desc
    limit 20
  ) t;

  select count(*)
  into v_difficult_count
  from public.user_word_progress uwp
  join public.words w
    on w.id = uwp.word_id
  where uwp.user_id = v_user_id
    and uwp.is_difficult = true
    and w.is_active = true;

  v_completed_today := (v_due_count = 0 and v_known_count > 0);

  return jsonb_build_object(
    'dailyRevision', jsonb_build_object(
      'dueCount', v_due_count,
      'maxSessionSize', 20,
      'completedToday', v_completed_today
    ),
    'quickPractice', jsonb_build_object(
      'knownCount', v_known_count,
      'canStart5', v_known_count >= 5,
      'canStart10', v_known_count >= 10,
      'canStart20', v_known_count >= 20
    ),
    'recentlyLearned', jsonb_build_object(
      'availableCount', v_recent_count
    ),
    'difficultWords', jsonb_build_object(
      'availableCount', v_difficult_count
    )
  );
end;
$$;

revoke all on function public.get_difficult_words(integer) from public;
grant execute on function public.get_difficult_words(integer) to authenticated;

revoke all on function public.set_word_difficult_correct_streak(uuid, integer) from public;
grant execute on function public.set_word_difficult_correct_streak(uuid, integer) to authenticated;

revoke all on function public.get_revision_hub_stats() from public;
grant execute on function public.get_revision_hub_stats() to authenticated;
