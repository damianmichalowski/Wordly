-- =========================================================
-- REVISION SESSION TRACKING — RPC functions
-- =========================================================

-- ---------------------------------------------------------
-- 1. start_revision_session
-- ---------------------------------------------------------

create or replace function public.start_revision_session(
  p_mode text,
  p_total_words integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_safe_total integer;
  v_session_id uuid;
  v_started_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_mode is null or p_mode not in (
    'daily_review', 'quick_practice', 'recently_learned',
    'level_practice', 'library_practice'
  ) then
    raise exception 'Invalid mode: %', coalesce(p_mode, 'null');
  end if;

  v_safe_total := greatest(0, coalesce(p_total_words, 0));

  insert into public.user_revision_session (
    user_id,
    mode,
    total_words
  )
  values (
    v_user_id,
    p_mode,
    v_safe_total
  )
  returning id, started_at
  into v_session_id, v_started_at;

  return jsonb_build_object(
    'sessionId', v_session_id,
    'mode', p_mode,
    'startedAt', v_started_at,
    'totalWords', v_safe_total
  );
end;
$$;


-- ---------------------------------------------------------
-- 2. complete_revision_session
--
-- p_apply_srs = false → only log session + answers (analytics).
-- p_apply_srs = true  → also update user_word_progress SRS fields.
--
-- Daily Review MUST pass false because complete_daily_review_session
-- already handles SRS + streak + achievements.
-- Quick Practice / Recently Learned pass true.
-- ---------------------------------------------------------

create or replace function public.complete_revision_session(
  p_session_id uuid,
  p_answers jsonb,
  p_duration_seconds integer default null,
  p_apply_srs boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_session_user_id uuid;
  v_session_completed_at timestamptz;
  v_correct int := 0;
  v_wrong int := 0;
  v_total int := 0;
  v_accuracy int := 0;
  v_safe_duration integer;
  v_answer record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_session_id is null then
    raise exception 'session_id is required';
  end if;

  -- verify session ownership and open status
  select urs.user_id, urs.completed_at
  into v_session_user_id, v_session_completed_at
  from public.user_revision_session urs
  where urs.id = p_session_id;

  if v_session_user_id is null then
    raise exception 'Session not found';
  end if;

  if v_session_user_id <> v_user_id then
    raise exception 'Session does not belong to current user';
  end if;

  if v_session_completed_at is not null then
    return jsonb_build_object(
      'success', false,
      'error', 'session_already_completed'
    );
  end if;

  -- idempotent: clear previous answers for this session
  delete from public.user_revision_answer
  where session_id = p_session_id;

  -- insert answers
  if p_answers is not null and jsonb_array_length(p_answers) > 0 then
    for v_answer in
      select
        (elem->>'word_id')::uuid as word_id,
        elem->>'answer_result' as answer_result,
        (elem->>'response_time_ms')::integer as response_time_ms
      from jsonb_array_elements(p_answers) as elem
    loop
      if v_answer.answer_result not in ('correct', 'wrong', 'skipped') then
        raise exception 'Invalid answer_result: %', v_answer.answer_result;
      end if;

      insert into public.user_revision_answer (
        session_id,
        user_id,
        word_id,
        answer_result,
        response_time_ms
      )
      values (
        p_session_id,
        v_user_id,
        v_answer.word_id,
        v_answer.answer_result,
        v_answer.response_time_ms
      );
    end loop;
  end if;

  -- compute aggregates from inserted rows
  select
    count(*),
    count(*) filter (where ura.answer_result = 'correct'),
    count(*) filter (where ura.answer_result = 'wrong')
  into v_total, v_correct, v_wrong
  from public.user_revision_answer ura
  where ura.session_id = p_session_id;

  if v_total > 0 then
    v_accuracy := round(v_correct * 100.0 / v_total);
  end if;

  v_safe_duration := case
    when p_duration_seconds is not null and p_duration_seconds >= 0 then p_duration_seconds
    else null
  end;

  -- finalise session row
  update public.user_revision_session
  set
    completed_at = v_now,
    total_words = v_total,
    correct_count = v_correct,
    wrong_count = v_wrong,
    duration_seconds = v_safe_duration
  where id = p_session_id;

  -- SRS update (only when explicitly requested)
  if p_apply_srs = true and v_total > 0 then
    -- correct answers: advance interval on the existing ladder
    update public.user_word_progress uwp
    set
      last_review_at = v_now,
      interval_days = case
        when coalesce(uwp.interval_days, 1) <= 1 then 3
        when uwp.interval_days = 3 then 7
        when uwp.interval_days = 7 then 14
        when uwp.interval_days = 14 then 30
        else 30
      end,
      next_review_at = v_now + (
        case
          when coalesce(uwp.interval_days, 1) <= 1 then interval '3 days'
          when uwp.interval_days = 3 then interval '7 days'
          when uwp.interval_days = 7 then interval '14 days'
          when uwp.interval_days = 14 then interval '30 days'
          else interval '30 days'
        end
      ),
      updated_at = v_now
    where uwp.user_id = v_user_id
      and uwp.status = 'known'
      and uwp.word_id in (
        select ura.word_id
        from public.user_revision_answer ura
        where ura.session_id = p_session_id
          and ura.answer_result = 'correct'
      );

    -- wrong answers: reset interval to 1, next review tomorrow
    update public.user_word_progress uwp
    set
      last_review_at = v_now,
      interval_days = 1,
      next_review_at = v_now + interval '1 day',
      updated_at = v_now
    where uwp.user_id = v_user_id
      and uwp.status = 'known'
      and uwp.word_id in (
        select ura.word_id
        from public.user_revision_answer ura
        where ura.session_id = p_session_id
          and ura.answer_result = 'wrong'
      );
  end if;

  return jsonb_build_object(
    'success', true,
    'sessionId', p_session_id,
    'totalWords', v_total,
    'correctCount', v_correct,
    'wrongCount', v_wrong,
    'accuracy', v_accuracy,
    'durationSeconds', v_safe_duration
  );
end;
$$;


-- ---------------------------------------------------------
-- 3. get_revision_dashboard_stats
-- ---------------------------------------------------------

create or replace function public.get_revision_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_today date := current_date;
  v_week_start timestamptz;
  v_prev_week_start timestamptz;

  -- today
  v_today_reviewed int := 0;
  v_today_correct int := 0;
  v_today_wrong int := 0;
  v_today_accuracy int := 0;
  v_today_duration int := 0;

  -- week
  v_week_reviewed int := 0;
  v_week_sessions int := 0;
  v_week_correct int := 0;
  v_week_wrong int := 0;
  v_week_accuracy int := 0;
  v_week_duration int := 0;
  v_prev_week_correct int := 0;
  v_prev_week_total int := 0;
  v_prev_week_accuracy int;
  v_improvement_percent int;

  -- all time
  v_known_count int := 0;
  v_all_reviewed int := 0;
  v_all_sessions int := 0;
  v_all_correct int := 0;
  v_all_wrong int := 0;
  v_all_accuracy int := 0;
  v_best_accuracy int;
  v_best_words int;
  v_best_time int;

  -- memory
  v_due_today int := 0;
  v_due_soon int := 0;
  v_strong int := 0;
  v_need_attention int := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_week_start := date_trunc('week', v_today::timestamptz);
  v_prev_week_start := v_week_start - interval '7 days';

  -- === TODAY ===
  select
    coalesce(sum(urs.total_words), 0),
    coalesce(sum(urs.correct_count), 0),
    coalesce(sum(urs.wrong_count), 0),
    coalesce(sum(urs.duration_seconds), 0)
  into v_today_reviewed, v_today_correct, v_today_wrong, v_today_duration
  from public.user_revision_session urs
  where urs.user_id = v_user_id
    and urs.completed_at is not null
    and urs.completed_at::date = v_today;

  if v_today_reviewed > 0 then
    v_today_accuracy := round(v_today_correct * 100.0 / v_today_reviewed);
  end if;

  -- === THIS WEEK ===
  select
    coalesce(sum(urs.total_words), 0),
    count(*),
    coalesce(sum(urs.correct_count), 0),
    coalesce(sum(urs.wrong_count), 0),
    coalesce(sum(urs.duration_seconds), 0)
  into v_week_reviewed, v_week_sessions, v_week_correct, v_week_wrong, v_week_duration
  from public.user_revision_session urs
  where urs.user_id = v_user_id
    and urs.completed_at is not null
    and urs.completed_at >= v_week_start;

  if v_week_reviewed > 0 then
    v_week_accuracy := round(v_week_correct * 100.0 / v_week_reviewed);
  end if;

  -- previous week for improvement
  select
    coalesce(sum(urs.correct_count), 0),
    coalesce(sum(urs.total_words), 0)
  into v_prev_week_correct, v_prev_week_total
  from public.user_revision_session urs
  where urs.user_id = v_user_id
    and urs.completed_at is not null
    and urs.completed_at >= v_prev_week_start
    and urs.completed_at < v_week_start;

  if v_prev_week_total > 0 and v_week_reviewed > 0 then
    v_prev_week_accuracy := round(v_prev_week_correct * 100.0 / v_prev_week_total);
    v_improvement_percent := v_week_accuracy - v_prev_week_accuracy;
  end if;

  -- === ALL TIME ===
  select
    coalesce(sum(urs.total_words), 0),
    count(*),
    coalesce(sum(urs.correct_count), 0),
    coalesce(sum(urs.wrong_count), 0)
  into v_all_reviewed, v_all_sessions, v_all_correct, v_all_wrong
  from public.user_revision_session urs
  where urs.user_id = v_user_id
    and urs.completed_at is not null;

  if v_all_reviewed > 0 then
    v_all_accuracy := round(v_all_correct * 100.0 / v_all_reviewed);
  end if;

  select count(*)
  into v_known_count
  from public.user_word_progress uwp
  where uwp.user_id = v_user_id
    and uwp.status = 'known';

  -- best session records (sessions with >= 5 words)
  select
    max(case when urs.total_words > 0
      then round(urs.correct_count * 100.0 / urs.total_words)
      else 0 end)::int,
    max(urs.total_words)::int,
    min(case when urs.duration_seconds > 0 then urs.duration_seconds else null end)::int
  into v_best_accuracy, v_best_words, v_best_time
  from public.user_revision_session urs
  where urs.user_id = v_user_id
    and urs.completed_at is not null
    and urs.total_words >= 5;

  -- === MEMORY ===
  select
    count(*) filter (where uwp.next_review_at is not null and uwp.next_review_at <= v_now),
    count(*) filter (where uwp.next_review_at is not null
      and uwp.next_review_at > v_now
      and uwp.next_review_at <= v_now + interval '3 days'),
    count(*) filter (where uwp.interval_days >= 14),
    count(*) filter (where uwp.interval_days <= 1
      or (uwp.next_review_at is not null and uwp.next_review_at < v_now - interval '1 day'))
  into v_due_today, v_due_soon, v_strong, v_need_attention
  from public.user_word_progress uwp
  where uwp.user_id = v_user_id
    and uwp.status = 'known';

  return jsonb_build_object(
    'today', jsonb_build_object(
      'reviewedWords', v_today_reviewed,
      'correctCount', v_today_correct,
      'wrongCount', v_today_wrong,
      'accuracy', v_today_accuracy,
      'durationSeconds', v_today_duration
    ),
    'week', jsonb_build_object(
      'reviewedWords', v_week_reviewed,
      'sessionsCount', v_week_sessions,
      'correctCount', v_week_correct,
      'wrongCount', v_week_wrong,
      'accuracy', v_week_accuracy,
      'durationSeconds', v_week_duration,
      'improvementPercent', v_improvement_percent
    ),
    'allTime', jsonb_build_object(
      'knownWords', v_known_count,
      'reviewedWords', v_all_reviewed,
      'sessionsCount', v_all_sessions,
      'correctCount', v_all_correct,
      'wrongCount', v_all_wrong,
      'accuracy', v_all_accuracy,
      'bestAccuracy', v_best_accuracy,
      'bestSessionWords', v_best_words,
      'bestTimeSeconds', v_best_time
    ),
    'memory', jsonb_build_object(
      'dueToday', v_due_today,
      'dueSoon', v_due_soon,
      'strongWords', v_strong,
      'needAttention', v_need_attention
    )
  );
end;
$$;


-- ---------------------------------------------------------
-- 4. get_library_overview
-- ---------------------------------------------------------

create or replace function public.get_library_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_known_count int := 0;
  v_reviewed_week int := 0;
  v_week_start timestamptz;
  v_by_level jsonb;
  v_recently_learned int := 0;
  v_due_soon int := 0;
  v_need_attention int := 0;
  v_strong_memory int := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_week_start := date_trunc('week', current_date::timestamptz);

  select count(*)
  into v_known_count
  from public.user_word_progress uwp
  where uwp.user_id = v_user_id
    and uwp.status = 'known';

  select coalesce(sum(urs.total_words), 0)
  into v_reviewed_week
  from public.user_revision_session urs
  where urs.user_id = v_user_id
    and urs.completed_at is not null
    and urs.completed_at >= v_week_start;

  -- by CEFR level with targets
  with level_counts as (
    select
      cl.code,
      count(uwp.id)::int as known
    from public.cefr_level cl
    left join public.words w
      on w.cefr_level_id = cl.id
    left join public.user_word_progress uwp
      on uwp.word_id = w.id
     and uwp.user_id = v_user_id
     and uwp.status = 'known'
    group by cl.code, cl.order_index
    order by cl.order_index
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code', lc.code,
        'known', lc.known,
        'target', case lc.code
          when 'A1' then 300
          when 'A2' then 500
          when 'B1' then 800
          when 'B2' then 800
          when 'C1' then 400
          when 'C2' then 300
          else 0
        end
      )
    ),
    '[]'::jsonb
  )
  into v_by_level
  from level_counts lc;

  -- collection counts
  select
    count(*) filter (where uwp.known_at >= v_now - interval '7 days'),
    count(*) filter (where uwp.next_review_at is not null
      and uwp.next_review_at > v_now
      and uwp.next_review_at <= v_now + interval '3 days'),
    count(*) filter (where uwp.interval_days <= 1
      or (uwp.next_review_at is not null and uwp.next_review_at < v_now - interval '1 day')),
    count(*) filter (where uwp.interval_days >= 14)
  into v_recently_learned, v_due_soon, v_need_attention, v_strong_memory
  from public.user_word_progress uwp
  where uwp.user_id = v_user_id
    and uwp.status = 'known';

  return jsonb_build_object(
    'knownWords', v_known_count,
    'reviewedThisWeek', v_reviewed_week,
    'byLevel', v_by_level,
    'collections', jsonb_build_object(
      'recentlyLearned', v_recently_learned,
      'dueSoon', v_due_soon,
      'needAttention', v_need_attention,
      'strongMemory', v_strong_memory
    )
  );
end;
$$;


-- ---------------------------------------------------------
-- 5. get_library_words — extended with p_collection
-- ---------------------------------------------------------

drop function if exists public.get_library_words(text, text[], text[], text, integer, integer);

create or replace function public.get_library_words(
  p_search text default null,
  p_cefr_codes text[] default null,
  p_category_codes text[] default null,
  p_sort_known_at text default 'desc',
  p_limit integer default 20,
  p_offset integer default 0,
  p_collection text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_safe_limit integer;
  v_safe_offset integer;
  v_sort_direction text;
  v_total_count integer;
  v_items jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_collection is not null and p_collection not in (
    'all', 'recently_learned', 'due_soon', 'need_attention', 'strong_memory'
  ) then
    raise exception 'Invalid collection: %', p_collection;
  end if;

  v_safe_limit := greatest(1, least(coalesce(p_limit, 20), 50));
  v_safe_offset := greatest(0, coalesce(p_offset, 0));
  v_sort_direction := case
    when lower(coalesce(p_sort_known_at, 'desc')) = 'asc' then 'asc'
    else 'desc'
  end;

  -- total count
  select count(distinct w.id)
  into v_total_count
  from public.user_word_progress uwp
  join public.words w
    on w.id = uwp.word_id
  join public.cefr_level cl
    on cl.id = w.cefr_level_id
  where uwp.user_id = v_user_id
    and uwp.status = 'known'
    -- search
    and (
      p_search is null
      or btrim(p_search) = ''
      or w.lemma ilike '%' || btrim(p_search) || '%'
    )
    -- cefr filter
    and (
      p_cefr_codes is null
      or array_length(p_cefr_codes, 1) is null
      or cl.code = any(p_cefr_codes)
    )
    -- category filter
    and (
      p_category_codes is null
      or array_length(p_category_codes, 1) is null
      or exists (
        select 1
        from public.word_category wc
        join public.category c
          on c.id = wc.category_id
        where wc.word_id = w.id
          and c.code = any(p_category_codes)
      )
    )
    -- collection filter
    and (
      p_collection is null or p_collection = 'all'
      or (p_collection = 'recently_learned' and uwp.known_at >= v_now - interval '7 days')
      or (p_collection = 'due_soon'
          and uwp.next_review_at is not null
          and uwp.next_review_at > v_now
          and uwp.next_review_at <= v_now + interval '3 days')
      or (p_collection = 'need_attention'
          and (uwp.interval_days <= 1
               or (uwp.next_review_at is not null and uwp.next_review_at < v_now - interval '1 day')))
      or (p_collection = 'strong_memory' and uwp.interval_days >= 14)
    );

  -- paginated items
  with filtered_words as (
    select
      w.id as word_id,
      w.lemma,
      uwp.known_at,
      cl.code as cefr_code,
      uwp.next_review_at,
      uwp.interval_days,
      coalesce(uwp.is_difficult, false) as is_difficult
    from public.user_word_progress uwp
    join public.words w
      on w.id = uwp.word_id
    join public.cefr_level cl
      on cl.id = w.cefr_level_id
    where uwp.user_id = v_user_id
      and uwp.status = 'known'
      and (
        p_search is null
        or btrim(p_search) = ''
        or w.lemma ilike '%' || btrim(p_search) || '%'
      )
      and (
        p_cefr_codes is null
        or array_length(p_cefr_codes, 1) is null
        or cl.code = any(p_cefr_codes)
      )
      and (
        p_category_codes is null
        or array_length(p_category_codes, 1) is null
        or exists (
          select 1
          from public.word_category wc
          join public.category c
            on c.id = wc.category_id
          where wc.word_id = w.id
            and c.code = any(p_category_codes)
        )
      )
      and (
        p_collection is null or p_collection = 'all'
        or (p_collection = 'recently_learned' and uwp.known_at >= v_now - interval '7 days')
        or (p_collection = 'due_soon'
            and uwp.next_review_at is not null
            and uwp.next_review_at > v_now
            and uwp.next_review_at <= v_now + interval '3 days')
        or (p_collection = 'need_attention'
            and (uwp.interval_days <= 1
                 or (uwp.next_review_at is not null and uwp.next_review_at < v_now - interval '1 day')))
        or (p_collection = 'strong_memory' and uwp.interval_days >= 14)
      )
  ),
  ordered_words as (
    select *
    from filtered_words
    order by
      case when v_sort_direction = 'asc' then known_at end asc nulls last,
      case when v_sort_direction = 'desc' then known_at end desc nulls last,
      lemma asc
    limit v_safe_limit
    offset v_safe_offset
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'word_id', ow.word_id,
        'lemma', ow.lemma,
        'known_at', ow.known_at,
        'cefr_code', ow.cefr_code,
        'next_review_at', ow.next_review_at,
        'interval_days', ow.interval_days,
        'is_difficult', ow.is_difficult
      )
      order by
        case when v_sort_direction = 'asc' then ow.known_at end asc nulls last,
        case when v_sort_direction = 'desc' then ow.known_at end desc nulls last,
        ow.lemma asc
    ),
    '[]'::jsonb
  )
  into v_items
  from ordered_words ow;

  return jsonb_build_object(
    'items', v_items,
    'totalCount', v_total_count,
    'hasMore', (v_safe_offset + jsonb_array_length(v_items)) < v_total_count
  );
end;
$$;


-- ---------------------------------------------------------
-- Grants
-- ---------------------------------------------------------

revoke all on function public.start_revision_session(text, integer) from public;
grant execute on function public.start_revision_session(text, integer) to authenticated;

revoke all on function public.complete_revision_session(uuid, jsonb, integer, boolean) from public;
grant execute on function public.complete_revision_session(uuid, jsonb, integer, boolean) to authenticated;

revoke all on function public.get_revision_dashboard_stats() from public;
grant execute on function public.get_revision_dashboard_stats() to authenticated;

revoke all on function public.get_library_overview() from public;
grant execute on function public.get_library_overview() to authenticated;

revoke all on function public.get_library_words(text, text[], text[], text, integer, integer, text) from public;
grant execute on function public.get_library_words(text, text[], text[], text, integer, integer, text) to authenticated;
