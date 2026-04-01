-- =========================================================
-- FIX RPC FUNCTIONS TO USE auth.uid() INSTEAD OF p_user_id
-- =========================================================

-- ---------------------------------------------------------
-- cleanup old function signatures
-- ---------------------------------------------------------

drop function if exists public.get_or_create_daily_word(uuid);
drop function if exists public.get_or_create_daily_word();

drop function if exists public.get_daily_word_details(uuid);
drop function if exists public.get_daily_word_details();

drop function if exists public.mark_word_known(uuid, uuid);
drop function if exists public.mark_word_known(uuid);

drop function if exists public.get_revision_hub_stats(uuid);
drop function if exists public.get_revision_hub_stats();

drop function if exists public.get_daily_review_words(uuid);
drop function if exists public.get_daily_review_words();

drop function if exists public.complete_daily_review_session(uuid, uuid[]);
drop function if exists public.complete_daily_review_session(uuid[]);

drop function if exists public.get_quick_practice_words(uuid, integer);
drop function if exists public.get_quick_practice_words(integer);

drop function if exists public.get_recently_learned_words(uuid);
drop function if exists public.get_recently_learned_words();

drop function if exists public.get_library_words(uuid, text, text[], text[], text, integer, integer);
drop function if exists public.get_library_words(text, text[], text[], text, integer, integer);

drop function if exists public.get_word_details(uuid, uuid);
drop function if exists public.get_word_details(uuid);

drop function if exists public.get_user_profile_settings(uuid);
drop function if exists public.get_user_profile_settings();

drop function if exists public.upsert_user_profile_settings(uuid, uuid, uuid, text, text, uuid);
drop function if exists public.upsert_user_profile_settings(uuid, uuid, text, text, uuid);

drop function if exists public.get_onboarding_options();


-- ---------------------------------------------------------
-- get_or_create_daily_word()
-- ---------------------------------------------------------

create or replace function public.get_or_create_daily_word()
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
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_now timestamptz := now();

  v_existing_daily_word_id uuid;
  v_existing_word_id uuid;

  v_learning_language_id uuid;
  v_learning_mode_type text;
  v_learning_level text;
  v_selected_category_id uuid;

  v_candidate_word_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- auto-finish previous learning words -> known + init SRS
  update public.user_word_progress uwp
  set
    status = 'known',
    known_at = coalesce(uwp.known_at, v_now),
    last_review_at = coalesce(uwp.last_review_at, v_now),
    interval_days = case
      when uwp.interval_days is null or uwp.interval_days < 1 then 1
      else uwp.interval_days
    end,
    next_review_at = case
      when uwp.next_review_at is null then v_now + interval '1 day'
      else uwp.next_review_at
    end,
    updated_at = v_now
  where uwp.user_id = v_user_id
    and uwp.status = 'learning'
    and exists (
      select 1
      from public.user_daily_word udw
      where udw.user_id = v_user_id
        and udw.word_id = uwp.word_id
        and udw.day_date < v_today
    );

  -- if today's word already exists -> return it
  select udw.id, udw.word_id
  into v_existing_daily_word_id, v_existing_word_id
  from public.user_daily_word udw
  where udw.user_id = v_user_id
    and udw.day_date = v_today
  limit 1;

  if v_existing_daily_word_id is not null then
    return query
    select v_existing_daily_word_id, v_existing_word_id, v_today;
    return;
  end if;

  -- load user profile
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
  where up.id = v_user_id;

  if v_learning_language_id is null or v_learning_mode_type is null then
    raise exception 'User profile not found or incomplete';
  end if;

  -- pick candidate
  if v_learning_mode_type = 'difficulty' then
    select w.id
    into v_candidate_word_id
    from public.words w
    join public.cefr_level cl
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
        from public.user_word_progress uwp
        where uwp.user_id = v_user_id
          and uwp.word_id = w.id
          and uwp.status = 'known'
      )
    order by random()
    limit 1;

  elsif v_learning_mode_type = 'category' then
    select w.id
    into v_candidate_word_id
    from public.words w
    join public.word_category wc
      on wc.word_id = w.id
    where w.target_language_id = v_learning_language_id
      and w.is_active = true
      and wc.category_id = v_selected_category_id
      and not exists (
        select 1
        from public.user_word_progress uwp
        where uwp.user_id = v_user_id
          and uwp.word_id = w.id
          and uwp.status = 'known'
      )
    order by random()
    limit 1;

  else
    raise exception 'Unsupported learning_mode_type=%', v_learning_mode_type;
  end if;

  if v_candidate_word_id is null then
    return;
  end if;

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
  returning id into v_existing_daily_word_id;

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
  on conflict (user_id, word_id)
  do update
    set
      status = case
        when public.user_word_progress.status = 'known' then public.user_word_progress.status
        else 'learning'
      end,
      updated_at = v_now;

  return query
  select v_existing_daily_word_id, v_candidate_word_id, v_today;
end;
$$;


-- ---------------------------------------------------------
-- get_daily_word_details()
-- ---------------------------------------------------------

create or replace function public.get_daily_word_details()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_native_language_id uuid;
  v_word_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select up.native_language_id
  into v_native_language_id
  from public.user_profile up
  where up.id = v_user_id;

  if v_native_language_id is null then
    raise exception 'User profile not found or native_language_id missing';
  end if;

  select udw.word_id
  into v_word_id
  from public.user_daily_word udw
  where udw.user_id = v_user_id
    and udw.day_date = v_today
  limit 1;

  if v_word_id is null then
    return null;
  end if;

  select public.get_word_details(v_word_id)
  into v_result;

  return v_result;
end;
$$;


-- ---------------------------------------------------------
-- mark_word_known(p_word_id)
-- ---------------------------------------------------------

create or replace function public.mark_word_known(
  p_word_id uuid
)
returns table (
  user_id uuid,
  word_id uuid,
  status text,
  known_at timestamptz,
  last_review_at timestamptz,
  interval_days integer,
  next_review_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_next_review_at timestamptz := v_now + interval '1 day';
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_word_id is null then
    raise exception 'word_id is required';
  end if;

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
    v_next_review_at,
    v_now,
    v_now
  )
  on conflict (user_id, word_id)
  do update
    set
      status = 'known',
      known_at = coalesce(public.user_word_progress.known_at, v_now),
      last_review_at = v_now,
      interval_days = case
        when public.user_word_progress.interval_days is null or public.user_word_progress.interval_days < 1 then 1
        else public.user_word_progress.interval_days
      end,
      next_review_at = case
        when public.user_word_progress.next_review_at is null then v_next_review_at
        else public.user_word_progress.next_review_at
      end,
      updated_at = v_now;

  return query
  select
    uwp.user_id,
    uwp.word_id,
    uwp.status,
    uwp.known_at,
    uwp.last_review_at,
    uwp.interval_days,
    uwp.next_review_at
  from public.user_word_progress uwp
  where uwp.user_id = v_user_id
    and uwp.word_id = p_word_id
  limit 1;
end;
$$;


-- ---------------------------------------------------------
-- get_revision_hub_stats()
-- ---------------------------------------------------------

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
    )
  );
end;
$$;


-- ---------------------------------------------------------
-- get_daily_review_words()
-- ---------------------------------------------------------

create or replace function public.get_daily_review_words()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_native_language_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select up.native_language_id
  into v_native_language_id
  from public.user_profile up
  where up.id = v_user_id;

  if v_native_language_id is null then
    raise exception 'User profile not found or native_language_id missing';
  end if;

  with due_words as (
    select
      uwp.word_id,
      uwp.next_review_at,
      uwp.known_at,
      uwp.last_review_at,
      uwp.interval_days
    from public.user_word_progress uwp
    where uwp.user_id = v_user_id
      and uwp.status = 'known'
      and uwp.next_review_at is not null
      and uwp.next_review_at <= v_now
    order by uwp.next_review_at asc, uwp.known_at asc nulls last
    limit 20
  )
  select coalesce(
    jsonb_agg(
      public.get_word_details(dw.word_id)
      order by dw.next_review_at asc, dw.known_at asc nulls last
    ),
    '[]'::jsonb
  )
  into v_result
  from due_words dw;

  return v_result;
end;
$$;


-- ---------------------------------------------------------
-- complete_daily_review_session(p_word_ids)
-- ---------------------------------------------------------

create or replace function public.complete_daily_review_session(
  p_word_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_updated_count int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_word_ids is null or array_length(p_word_ids, 1) is null then
    return jsonb_build_object(
      'success', true,
      'updatedCount', 0
    );
  end if;

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
    and uwp.word_id = any(p_word_ids);

  get diagnostics v_updated_count = row_count;

  return jsonb_build_object(
    'success', true,
    'updatedCount', v_updated_count
  );
end;
$$;


-- ---------------------------------------------------------
-- get_quick_practice_words(p_limit)
-- ---------------------------------------------------------

create or replace function public.get_quick_practice_words(
  p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_safe_limit integer;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_limit not in (5, 10, 20) then
    raise exception 'Invalid p_limit=%, allowed values are 5, 10, 20', p_limit;
  end if;

  v_safe_limit := p_limit;

  with practice_words as (
    select
      uwp.word_id,
      uwp.known_at
    from public.user_word_progress uwp
    where uwp.user_id = v_user_id
      and uwp.status = 'known'
    order by random()
    limit v_safe_limit
  )
  select coalesce(
    jsonb_agg(public.get_word_details(pw.word_id)),
    '[]'::jsonb
  )
  into v_result
  from practice_words pw;

  return v_result;
end;
$$;


-- ---------------------------------------------------------
-- get_recently_learned_words()
-- ---------------------------------------------------------

create or replace function public.get_recently_learned_words()
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

  with recent_words as (
    select
      uwp.word_id,
      uwp.known_at
    from public.user_word_progress uwp
    where uwp.user_id = v_user_id
      and uwp.status = 'known'
      and uwp.known_at is not null
    order by uwp.known_at desc
    limit 20
  )
  select coalesce(
    jsonb_agg(
      public.get_word_details(rw.word_id)
      order by rw.known_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from recent_words rw;

  return v_result;
end;
$$;


-- ---------------------------------------------------------
-- get_library_words(...)
-- ---------------------------------------------------------

create or replace function public.get_library_words(
  p_search text default null,
  p_cefr_codes text[] default null,
  p_category_codes text[] default null,
  p_sort_known_at text default 'desc',
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_safe_limit integer;
  v_safe_offset integer;
  v_sort_direction text;
  v_total_count integer;
  v_items jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_safe_limit := greatest(1, least(coalesce(p_limit, 20), 50));
  v_safe_offset := greatest(0, coalesce(p_offset, 0));
  v_sort_direction := case
    when lower(coalesce(p_sort_known_at, 'desc')) = 'asc' then 'asc'
    else 'desc'
  end;

  select count(distinct w.id)
  into v_total_count
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
    );

  with filtered_words as (
    select
      w.id as word_id,
      w.lemma,
      uwp.known_at,
      cl.code as cefr_code
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
        'cefr_code', ow.cefr_code
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
-- get_word_details(p_word_id)
-- ---------------------------------------------------------

create or replace function public.get_word_details(
  p_word_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_native_language_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_word_id is null then
    raise exception 'word_id is required';
  end if;

  select up.native_language_id
  into v_native_language_id
  from public.user_profile up
  where up.id = v_user_id;

  if v_native_language_id is null then
    raise exception 'User profile not found or native_language_id missing';
  end if;

  select jsonb_build_object(
    'word_id', w.id,
    'lemma', w.lemma,
    'ipa', w.ipa,
    'is_active', w.is_active,
    'created_at', w.created_at,
    'updated_at', w.updated_at,
    'cefr', jsonb_build_object(
      'id', cl.id,
      'code', cl.code,
      'order_index', cl.order_index
    ),
    'target_language', jsonb_build_object(
      'id', tl.id,
      'code', tl.code,
      'name', tl.name
    ),
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'code', c.code,
          'name', c.name
        )
        order by c.name asc
      )
      from public.word_category wc
      join public.category c
        on c.id = wc.category_id
      where wc.word_id = w.id
    ), '[]'::jsonb),
    'senses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'sense_id', s.id,
          'sense_order', s.sense_order,
          'part_of_speech', jsonb_build_object(
            'id', pos.id,
            'code', pos.code,
            'name', pos.name,
            'order_index', pos.order_index
          ),
          'translation', jsonb_build_object(
            'id', st.id,
            'text', st.translation,
            'native_language_id', st.native_language_id,
            'examples', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', te.id,
                  'text', te.example_text,
                  'order', te.example_order
                )
                order by te.example_order
              )
              from public.translation_example te
              where te.sense_translation_id = st.id
            ), '[]'::jsonb)
          )
        )
        order by s.sense_order
      )
      from public.sense s
      join public.part_of_speech pos
        on pos.id = s.part_of_speech_id
      join public.sense_translation st
        on st.sense_id = s.id
       and st.native_language_id = v_native_language_id
      where s.word_id = w.id
    ), '[]'::jsonb)
  )
  into v_result
  from public.words w
  join public.cefr_level cl
    on cl.id = w.cefr_level_id
  join public.language tl
    on tl.id = w.target_language_id
  where w.id = p_word_id;

  return v_result;
end;
$$;


-- ---------------------------------------------------------
-- get_user_profile_settings()
-- ---------------------------------------------------------

create or replace function public.get_user_profile_settings()
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

  select jsonb_build_object(
    'user_id', up.id,
    'native_language', jsonb_build_object(
      'id', nl.id,
      'code', nl.code,
      'name', nl.name
    ),
    'learning_language', jsonb_build_object(
      'id', ll.id,
      'code', ll.code,
      'name', ll.name
    ),
    'learning_mode_type', up.learning_mode_type,
    'learning_level', up.learning_level,
    'selected_category', case
      when c.id is null then null
      else jsonb_build_object(
        'id', c.id,
        'code', c.code,
        'name', c.name
      )
    end,
    'last_daily_revision_date', up.last_daily_revision_date,
    'created_at', up.created_at
  )
  into v_result
  from public.user_profile up
  join public.language nl
    on nl.id = up.native_language_id
  join public.language ll
    on ll.id = up.learning_language_id
  left join public.category c
    on c.id = up.selected_category_id
  where up.id = v_user_id;

  return v_result;
end;
$$;


-- ---------------------------------------------------------
-- upsert_user_profile_settings(...)
-- ---------------------------------------------------------

create or replace function public.upsert_user_profile_settings(
  p_native_language_id uuid,
  p_learning_language_id uuid,
  p_learning_mode_type text,
  p_learning_level text default null,
  p_selected_category_id uuid default null
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

  if p_native_language_id is null then
    raise exception 'native_language_id is required';
  end if;

  if p_learning_language_id is null then
    raise exception 'learning_language_id is required';
  end if;

  if p_native_language_id = p_learning_language_id then
    raise exception 'native_language_id and learning_language_id must be different';
  end if;

  if p_learning_mode_type not in ('difficulty', 'category') then
    raise exception 'learning_mode_type must be difficulty or category';
  end if;

  if p_learning_mode_type = 'difficulty' then
    if p_learning_level is null then
      raise exception 'learning_level is required when learning_mode_type = difficulty';
    end if;

    if p_learning_level not in ('beginner', 'intermediate', 'advanced') then
      raise exception 'learning_level must be beginner, intermediate or advanced';
    end if;
  end if;

  if p_learning_mode_type = 'category' then
    if p_selected_category_id is null then
      raise exception 'selected_category_id is required when learning_mode_type = category';
    end if;
  end if;

  insert into public.user_profile (
    id,
    native_language_id,
    learning_language_id,
    learning_mode_type,
    learning_level,
    selected_category_id
  )
  values (
    v_user_id,
    p_native_language_id,
    p_learning_language_id,
    p_learning_mode_type,
    case
      when p_learning_mode_type = 'difficulty' then p_learning_level
      else null
    end,
    case
      when p_learning_mode_type = 'category' then p_selected_category_id
      else null
    end
  )
  on conflict (id)
  do update
    set
      native_language_id = excluded.native_language_id,
      learning_language_id = excluded.learning_language_id,
      learning_mode_type = excluded.learning_mode_type,
      learning_level = excluded.learning_level,
      selected_category_id = excluded.selected_category_id;

  select public.get_user_profile_settings()
  into v_result;

  return v_result;
end;
$$;


-- ---------------------------------------------------------
-- get_onboarding_options()
-- ---------------------------------------------------------

create or replace function public.get_onboarding_options()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'languages', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'code', l.code,
          'name', l.name
        )
        order by l.name asc
      )
      from public.language l
    ), '[]'::jsonb),

    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'code', c.code,
          'name', c.name,
          'description', c.description
        )
        order by c.name asc
      )
      from public.category c
      where c.is_active = true
    ), '[]'::jsonb),

    'learningModeTypes', jsonb_build_array(
      jsonb_build_object('value', 'difficulty', 'label', 'Difficulty'),
      jsonb_build_object('value', 'category', 'label', 'Category')
    ),

    'learningLevels', jsonb_build_array(
      jsonb_build_object('value', 'beginner', 'label', 'Beginner'),
      jsonb_build_object('value', 'intermediate', 'label', 'Intermediate'),
      jsonb_build_object('value', 'advanced', 'label', 'Advanced')
    )
  )
  into v_result;

  return v_result;
end;
$$;


-- ---------------------------------------------------------
-- grants
-- ---------------------------------------------------------

revoke all on function public.get_or_create_daily_word() from public;
grant execute on function public.get_or_create_daily_word() to authenticated;

revoke all on function public.get_daily_word_details() from public;
grant execute on function public.get_daily_word_details() to authenticated;

revoke all on function public.mark_word_known(uuid) from public;
grant execute on function public.mark_word_known(uuid) to authenticated;

revoke all on function public.get_revision_hub_stats() from public;
grant execute on function public.get_revision_hub_stats() to authenticated;

revoke all on function public.get_daily_review_words() from public;
grant execute on function public.get_daily_review_words() to authenticated;

revoke all on function public.complete_daily_review_session(uuid[]) from public;
grant execute on function public.complete_daily_review_session(uuid[]) to authenticated;

revoke all on function public.get_quick_practice_words(integer) from public;
grant execute on function public.get_quick_practice_words(integer) to authenticated;

revoke all on function public.get_recently_learned_words() from public;
grant execute on function public.get_recently_learned_words() to authenticated;

revoke all on function public.get_library_words(text, text[], text[], text, integer, integer) from public;
grant execute on function public.get_library_words(text, text[], text[], text, integer, integer) to authenticated;

revoke all on function public.get_word_details(uuid) from public;
grant execute on function public.get_word_details(uuid) to authenticated;

revoke all on function public.get_user_profile_settings() from public;
grant execute on function public.get_user_profile_settings() to authenticated;

revoke all on function public.upsert_user_profile_settings(uuid, uuid, text, text, uuid) from public;
grant execute on function public.upsert_user_profile_settings(uuid, uuid, text, text, uuid) to authenticated;

revoke all on function public.get_onboarding_options() from public;
grant execute on function public.get_onboarding_options() to authenticated;