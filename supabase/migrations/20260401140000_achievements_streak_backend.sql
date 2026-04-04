-- Phase 1: achievements tables, daily review streak columns, consumable unlock events, RPCs.
--
-- Streak semantics:
-- - If last_daily_revision_date is null OR strictly before yesterday (calendar gap ≥ 2 days),
--   current_daily_review_streak is reset to 0 (lost streak). Longest is preserved.
-- - A valid daily review session (≥1 word actually updated) sets last_daily_revision_date to
--   today and advances streak: yesterday → +1; same day → unchanged; after gap → starts at 1.
-- - Empty or no-op complete_daily_review_session calls do NOT update streak or last_daily_revision_date.
--
-- Achievement events: pending rows until consumed; sources distinguish manual known-word,
-- first app-entry sync after calendar day (midnight pipeline), and daily review streak.
-- All event payloads include `eventId`; call consume_achievement_events('{uuid,...}') after UI.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.achievement_definition (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null,
  threshold integer not null,
  title text not null,
  description text,
  icon text,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint achievement_definition_type_check
    check (type in ('known_words', 'streak')),
  constraint achievement_definition_threshold_positive check (threshold > 0)
);

create table if not exists public.user_achievement (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_definition_id uuid not null references public.achievement_definition (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint user_achievement_user_definition_unique unique (user_id, achievement_definition_id)
);

-- Pending / consumable unlock notifications (show once, then mark consumed).
create table if not exists public.user_achievement_event (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_definition_id uuid not null references public.achievement_definition (id) on delete cascade,
  source text not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint user_achievement_event_source_check
    check (source in (
      'known_word_manual',
      'known_word_midnight',
      'streak_daily_review'
    )),
  -- One notification row per user per trophy (pending until consumed_at is set).
  constraint user_achievement_event_user_trophy_unique unique (user_id, achievement_definition_id)
);

create index if not exists idx_user_achievement_event_user_pending
  on public.user_achievement_event (user_id)
  where consumed_at is null;

create index if not exists idx_user_achievement_user_id on public.user_achievement (user_id);
create index if not exists idx_user_achievement_unlocked_at on public.user_achievement (user_id, unlocked_at desc);
create index if not exists idx_achievement_definition_type_sort on public.achievement_definition (type, sort_order);

alter table public.user_profile
  add column if not exists current_daily_review_streak integer not null default 0,
  add column if not exists longest_daily_review_streak integer not null default 0,
  add column if not exists achievement_entry_calendar_date date;

comment on column public.user_profile.current_daily_review_streak is
  'Consecutive calendar days with a completed daily review session (0 if streak is broken until next valid session).';
comment on column public.user_profile.longest_daily_review_streak is
  'Best streak of consecutive calendar days with a completed daily review session.';
comment on column public.user_profile.achievement_entry_calendar_date is
  'Local calendar date (current_date) when process_app_entry_achievement_events last ran; used for midnight known-word pipeline.';

-- ---------------------------------------------------------------------------
-- Seed achievements (idempotent on code)
-- ---------------------------------------------------------------------------

insert into public.achievement_definition (code, type, threshold, title, description, icon, sort_order)
values
  ('known_words_10', 'known_words', 10, 'First 10', null, null, 10),
  ('known_words_20', 'known_words', 20, 'Getting Started', null, null, 20),
  ('known_words_30', 'known_words', 30, 'Building Momentum', null, null, 30),
  ('known_words_50', 'known_words', 50, 'Word Collector', null, null, 50),
  ('known_words_100', 'known_words', 100, 'Century', null, null, 100),
  ('known_words_200', 'known_words', 200, 'Strong Progress', null, null, 200),
  ('known_words_300', 'known_words', 300, 'Solid Foundation', null, null, 300),
  ('known_words_500', 'known_words', 500, 'Vocabulary Boost', null, null, 500),
  ('known_words_800', 'known_words', 800, 'Serious Progress', null, null, 800),
  ('known_words_1000', 'known_words', 1000, 'Deepening Knowledge', null, null, 1000),
  ('known_words_1200', 'known_words', 1200, 'Advanced Momentum', null, null, 1200),
  ('known_words_2000', 'known_words', 2000, 'Word Explorer', null, null, 2000),
  ('known_words_3000', 'known_words', 3000, 'Legendary Learner', null, null, 3000),
  ('streak_3', 'streak', 3, 'First Spark', null, null, 1003),
  ('streak_7', 'streak', 7, 'On Fire', null, null, 1007),
  ('streak_14', 'streak', 14, 'Two Weeks Strong', null, null, 1014),
  ('streak_30', 'streak', 30, 'Full Focus', null, null, 1030),
  ('streak_60', 'streak', 60, 'Unstoppable', null, null, 1060),
  ('streak_100', 'streak', 100, 'Wordly Habit', null, null, 1100),
  ('streak_180', 'streak', 180, 'Half-Year Streak', null, null, 1180),
  ('streak_365', 'streak', 365, 'Legend', null, null, 1365)
on conflict (code) do update set
  type = excluded.type,
  threshold = excluded.threshold,
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

-- ---------------------------------------------------------------------------
-- Drop functions that cannot be altered in place (PostgreSQL rejects CREATE OR REPLACE
-- when the return type or OUT/RETURNS TABLE row type changes).
-- ---------------------------------------------------------------------------

-- Prior app migrations: single-arg sync (if a partial run created this overload).
drop function if exists public.sync_user_achievements(uuid);

-- Return table gained column `achievement_events jsonb`.
drop function if exists public.mark_word_known(uuid);
drop function if exists public.mark_word_known_and_advance_daily_word(uuid);

-- ---------------------------------------------------------------------------
-- Lost streak: before any valid completion, effective streak is 0 when calendar gap ≥ 2 days.
-- ---------------------------------------------------------------------------

create or replace function public.refresh_daily_review_streak_if_broken(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  update public.user_profile up
  set current_daily_review_streak = 0
  where up.id = p_user_id
    and (
      up.last_daily_revision_date is null
      or up.last_daily_revision_date < v_today - 1
    );
end;
$$;

revoke all on function public.refresh_daily_review_streak_if_broken(uuid) from public;

-- ---------------------------------------------------------------------------
-- Sync achievements + optional pending events (internal)
-- p_known_source / p_streak_source: null = unlock trophy but do not enqueue celebration for that type
-- ---------------------------------------------------------------------------

create or replace function public.sync_user_achievements(
  p_user_id uuid,
  p_known_source text default null,
  p_streak_source text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_known_count integer;
  v_streak integer;
  v_new_rows jsonb;
  v_events jsonb;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if p_known_source is not null
    and p_known_source not in ('known_word_manual', 'known_word_midnight') then
    raise exception 'Invalid p_known_source';
  end if;

  if p_streak_source is not null and p_streak_source <> 'streak_daily_review' then
    raise exception 'Invalid p_streak_source';
  end if;

  select count(*)::integer
  into v_known_count
  from public.user_word_progress uwp
  where uwp.user_id = p_user_id
    and uwp.status = 'known';

  select coalesce(up.current_daily_review_streak, 0)
  into v_streak
  from public.user_profile up
  where up.id = p_user_id;

  if v_streak is null then
    v_streak := 0;
  end if;

  with inserted as (
    insert into public.user_achievement (user_id, achievement_definition_id, unlocked_at)
    select
      p_user_id,
      ad.id,
      now()
    from public.achievement_definition ad
    where ad.is_active = true
      and (
        (ad.type = 'known_words' and v_known_count >= ad.threshold)
        or (ad.type = 'streak' and v_streak >= ad.threshold)
      )
    on conflict on constraint user_achievement_user_definition_unique do nothing
    returning achievement_definition_id, unlocked_at
  ),
  payload as (
    select
      i.achievement_definition_id,
      i.unlocked_at,
      ad.code,
      ad.type,
      ad.threshold,
      ad.title,
      ad.description,
      ad.icon,
      ad.sort_order,
      case ad.type
        when 'known_words' then p_known_source
        when 'streak' then p_streak_source
      end as event_source
    from inserted i
    join public.achievement_definition ad
      on ad.id = i.achievement_definition_id
  ),
  ev as (
    insert into public.user_achievement_event (
      user_id,
      achievement_definition_id,
      source
    )
    select
      p_user_id,
      p.achievement_definition_id,
      p.event_source
    from payload p
    where p.event_source is not null
    on conflict on constraint user_achievement_event_user_trophy_unique do nothing
    returning id, achievement_definition_id, source, created_at
  )
  select
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'achievementDefinitionId', p.achievement_definition_id,
            'code', p.code,
            'type', p.type,
            'threshold', p.threshold,
            'title', p.title,
            'description', p.description,
            'icon', p.icon,
            'sortOrder', p.sort_order,
            'unlockedAt', p.unlocked_at
          )
          order by p.sort_order asc, p.threshold asc
        )
        from payload p
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'eventId', e.id,
            'source', e.source,
            'createdAt', e.created_at,
            'achievementDefinitionId', ad.id,
            'code', ad.code,
            'type', ad.type,
            'threshold', ad.threshold,
            'title', ad.title,
            'description', ad.description,
            'icon', ad.icon,
            'sortOrder', ad.sort_order,
            'definition', jsonb_build_object(
              'id', ad.id,
              'code', ad.code,
              'type', ad.type,
              'threshold', ad.threshold,
              'title', ad.title,
              'description', ad.description,
              'icon', ad.icon,
              'sortOrder', ad.sort_order
            )
          )
          order by e.id
        )
        from ev e
        join public.achievement_definition ad
          on ad.id = e.achievement_definition_id
      ),
      '[]'::jsonb
    )
  into v_new_rows, v_events;

  return jsonb_build_object(
    'newlyUnlocked', coalesce(v_new_rows, '[]'::jsonb),
    'pendingEvents', coalesce(v_events, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.sync_user_achievements(uuid, text, text) from public;

-- ---------------------------------------------------------------------------
-- complete_daily_review_session — streak only when session updates ≥1 known word row
-- ---------------------------------------------------------------------------

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
  v_today date := current_date;
  v_updated_count int := 0;
  v_last date;
  v_curr int;
  v_long int;
  v_new int;
  v_sync jsonb;
  v_new_streak_unlocks jsonb;
  v_session_valid boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.refresh_daily_review_streak_if_broken(v_user_id);

  if p_word_ids is not null and array_length(p_word_ids, 1) is not null then
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
  end if;

  v_session_valid := v_updated_count > 0;

  if not v_session_valid then
    select
      coalesce(up.current_daily_review_streak, 0),
      coalesce(up.longest_daily_review_streak, 0)
    into v_curr, v_long
    from public.user_profile up
    where up.id = v_user_id;

    return jsonb_build_object(
      'success', true,
      'sessionCompleted', false,
      'updatedCount', v_updated_count,
      'currentDailyReviewStreak', coalesce(v_curr, 0),
      'longestDailyReviewStreak', coalesce(v_long, 0),
      'newlyUnlockedAchievements', '[]'::jsonb,
      'newlyUnlockedStreakAchievements', '[]'::jsonb,
      'pendingEvents', '[]'::jsonb
    );
  end if;

  select
    up.last_daily_revision_date,
    coalesce(up.current_daily_review_streak, 0),
    coalesce(up.longest_daily_review_streak, 0)
  into v_last, v_curr, v_long
  from public.user_profile up
  where up.id = v_user_id;

  if v_last is null then
    v_new := 1;
  elsif v_last = v_today then
    v_new := v_curr;
  elsif v_last = v_today - 1 then
    v_new := v_curr + 1;
  else
    v_new := 1;
  end if;

  v_long := greatest(v_long, v_new);

  update public.user_profile up
  set
    last_daily_revision_date = v_today,
    current_daily_review_streak = v_new,
    longest_daily_review_streak = v_long
  where up.id = v_user_id;

  v_sync := public.sync_user_achievements(
    v_user_id,
    null,
    'streak_daily_review'
  );

  select coalesce(
    jsonb_agg(elem order by (elem->>'sortOrder')::int, (elem->>'threshold')::int),
    '[]'::jsonb
  )
  into v_new_streak_unlocks
  from jsonb_array_elements(v_sync->'newlyUnlocked') as elem
  where elem->>'type' = 'streak';

  return jsonb_build_object(
    'success', true,
    'sessionCompleted', true,
    'updatedCount', v_updated_count,
    'currentDailyReviewStreak', v_new,
    'longestDailyReviewStreak', v_long,
    'newlyUnlockedAchievements', coalesce(v_sync->'newlyUnlocked', '[]'::jsonb),
    'newlyUnlockedStreakAchievements', coalesce(v_new_streak_unlocks, '[]'::jsonb),
    'pendingEvents', coalesce(v_sync->'pendingEvents', '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_word_known — returns achievement_events for immediate celebration
-- ---------------------------------------------------------------------------

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
  next_review_at timestamptz,
  achievement_events jsonb
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_next_review_at timestamptz := v_now + interval '1 day';

  v_status text;
  v_known_at timestamptz;
  v_last_review_at timestamptz;
  v_interval_days integer;
  v_next_review_at_result timestamptz;
  v_sync jsonb;
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
        when public.user_word_progress.next_review_at is null then v_next_review_at
        else public.user_word_progress.next_review_at
      end,
      updated_at = v_now;

  v_sync := public.sync_user_achievements(v_user_id, 'known_word_manual', null);

  select
    uwp.status,
    uwp.known_at,
    uwp.last_review_at,
    uwp.interval_days,
    uwp.next_review_at
  into
    v_status,
    v_known_at,
    v_last_review_at,
    v_interval_days,
    v_next_review_at_result
  from public.user_word_progress as uwp
  where uwp.user_id = v_user_id
    and uwp.word_id = p_word_id
  limit 1;

  user_id := v_user_id;
  word_id := p_word_id;
  status := v_status;
  known_at := v_known_at;
  last_review_at := v_last_review_at;
  interval_days := v_interval_days;
  next_review_at := v_next_review_at_result;
  achievement_events := coalesce(v_sync->'pendingEvents', '[]'::jsonb);

  return next;
  return;
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_word_known_and_advance_daily_word
-- ---------------------------------------------------------------------------

create or replace function public.mark_word_known_and_advance_daily_word(
  p_word_id uuid
)
returns table (
  daily_word_id uuid,
  word_id uuid,
  day_date date,
  achievement_events jsonb
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
  v_sync jsonb;
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

  v_sync := public.sync_user_achievements(v_user_id, 'known_word_manual', null);

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

  if v_candidate_word_id is null then
    daily_word_id := null;
    word_id := null;
    day_date := null;
    achievement_events := coalesce(v_sync->'pendingEvents', '[]'::jsonb);
    return next;
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
  returning id into daily_word_id;

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
  achievement_events := coalesce(v_sync->'pendingEvents', '[]'::jsonb);

  return next;
  return;
end;
$$;

-- ---------------------------------------------------------------------------
-- App entry: refresh streak, optional first-of-day known-word sync (midnight pipeline)
-- ---------------------------------------------------------------------------

create or replace function public.process_app_entry_achievement_events()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_last_entry date;
  v_sync jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.refresh_daily_review_streak_if_broken(v_user_id);

  select up.achievement_entry_calendar_date
  into v_last_entry
  from public.user_profile up
  where up.id = v_user_id;

  if v_last_entry is null or v_last_entry < v_today then
    v_sync := public.sync_user_achievements(v_user_id, 'known_word_midnight', null);

    update public.user_profile up
    set achievement_entry_calendar_date = v_today
    where up.id = v_user_id;

    return jsonb_build_object(
      'streakRefreshed', true,
      'midnightSyncRan', true,
      'newlyUnlocked', coalesce(v_sync->'newlyUnlocked', '[]'::jsonb),
      'pendingEvents', coalesce(v_sync->'pendingEvents', '[]'::jsonb)
    );
  end if;

  return jsonb_build_object(
    'streakRefreshed', true,
    'midnightSyncRan', false,
    'newlyUnlocked', '[]'::jsonb,
    'pendingEvents', '[]'::jsonb
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Pending list + consume
-- ---------------------------------------------------------------------------

create or replace function public.get_pending_achievement_events()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_items jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.refresh_daily_review_streak_if_broken(v_user_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'eventId', e.id,
        'source', e.source,
        'createdAt', e.created_at,
        'achievementDefinitionId', ad.id,
        'code', ad.code,
        'type', ad.type,
        'threshold', ad.threshold,
        'title', ad.title,
        'description', ad.description,
        'icon', ad.icon,
        'sortOrder', ad.sort_order,
        'definition', jsonb_build_object(
          'id', ad.id,
          'code', ad.code,
          'type', ad.type,
          'threshold', ad.threshold,
          'title', ad.title,
          'description', ad.description,
          'icon', ad.icon,
          'sortOrder', ad.sort_order
        )
      )
      order by e.created_at asc
    ),
    '[]'::jsonb
  )
  into v_items
  from public.user_achievement_event e
  join public.achievement_definition ad
    on ad.id = e.achievement_definition_id
  where e.user_id = v_user_id
    and e.consumed_at is null;

  return jsonb_build_object('pending', v_items);
end;
$$;

create or replace function public.consume_achievement_events(p_event_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_event_ids is null or array_length(p_event_ids, 1) is null then
    return jsonb_build_object('consumedCount', 0);
  end if;

  update public.user_achievement_event e
  set consumed_at = now()
  where e.user_id = v_user_id
    and e.id = any(p_event_ids)
    and e.consumed_at is null;

  get diagnostics v_count = row_count;

  return jsonb_build_object('consumedCount', v_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: full achievement list + progress
-- ---------------------------------------------------------------------------

create or replace function public.get_user_achievements()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_known_count integer;
  v_streak integer;
  v_items jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.refresh_daily_review_streak_if_broken(v_user_id);

  select count(*)::integer
  into v_known_count
  from public.user_word_progress uwp
  where uwp.user_id = v_user_id
    and uwp.status = 'known';

  select coalesce(up.current_daily_review_streak, 0)
  into v_streak
  from public.user_profile up
  where up.id = v_user_id;

  with defs as (
    select *
    from public.achievement_definition ad
    where ad.is_active = true
  ),
  enriched as (
    select
      ad.id,
      ad.code,
      ad.type,
      ad.threshold,
      ad.title,
      ad.description,
      ad.icon,
      ad.sort_order,
      ua.unlocked_at,
      case ad.type
        when 'known_words' then v_known_count
        else v_streak
      end as progress_current
    from defs ad
    left join public.user_achievement ua
      on ua.achievement_definition_id = ad.id
     and ua.user_id = v_user_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'definition', jsonb_build_object(
          'id', e.id,
          'code', e.code,
          'type', e.type,
          'threshold', e.threshold,
          'title', e.title,
          'description', e.description,
          'icon', e.icon,
          'sortOrder', e.sort_order
        ),
        'unlocked', e.unlocked_at is not null,
        'unlockedAt', e.unlocked_at,
        'progressCurrent', e.progress_current,
        'progressTarget', e.threshold,
        'progressRatio', least(1.0::double precision, e.progress_current::double precision / nullif(e.threshold, 0)::double precision)
      )
      order by e.sort_order, e.threshold
    ),
    '[]'::jsonb
  )
  into v_items
  from enriched e;

  return jsonb_build_object('achievements', v_items);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: profile summary
-- ---------------------------------------------------------------------------

create or replace function public.get_user_profile_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_known_count integer;
  v_row record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.refresh_daily_review_streak_if_broken(v_user_id);

  select count(*)::integer
  into v_known_count
  from public.user_word_progress uwp
  where uwp.user_id = v_user_id
    and uwp.status = 'known';

  select
    up.created_at,
    coalesce(up.current_daily_review_streak, 0) as current_daily_review_streak,
    coalesce(up.longest_daily_review_streak, 0) as longest_daily_review_streak,
    au.email
  into v_row
  from public.user_profile up
  join auth.users au
    on au.id = up.id
  where up.id = v_user_id;

  if v_row.created_at is null then
    raise exception 'User profile not found';
  end if;

  return jsonb_build_object(
    'knownWordsCount', v_known_count,
    'currentDailyReviewStreak', v_row.current_daily_review_streak,
    'longestDailyReviewStreak', v_row.longest_daily_review_streak,
    'memberSince', v_row.created_at,
    'email', v_row.email
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: completion screen — streak stats + pending streak events from daily review (today)
-- ---------------------------------------------------------------------------

create or replace function public.get_completion_screen_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_curr int;
  v_long int;
  v_streak_unlocks jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.refresh_daily_review_streak_if_broken(v_user_id);

  select
    coalesce(up.current_daily_review_streak, 0),
    coalesce(up.longest_daily_review_streak, 0)
  into v_curr, v_long
  from public.user_profile up
  where up.id = v_user_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'eventId', e.id,
        'source', e.source,
        'createdAt', e.created_at,
        'achievementDefinitionId', ad.id,
        'code', ad.code,
        'type', ad.type,
        'threshold', ad.threshold,
        'title', ad.title,
        'description', ad.description,
        'icon', ad.icon,
        'sortOrder', ad.sort_order,
        'definition', jsonb_build_object(
          'id', ad.id,
          'code', ad.code,
          'type', ad.type,
          'threshold', ad.threshold,
          'title', ad.title,
          'description', ad.description,
          'icon', ad.icon,
          'sortOrder', ad.sort_order
        )
      )
      order by e.created_at asc
    ),
    '[]'::jsonb
  )
  into v_streak_unlocks
  from public.user_achievement_event e
  join public.achievement_definition ad
    on ad.id = e.achievement_definition_id
  where e.user_id = v_user_id
    and e.consumed_at is null
    and e.source = 'streak_daily_review'
    and ad.type = 'streak'
    and e.created_at::date = v_today;

  return jsonb_build_object(
    'currentDailyReviewStreak', coalesce(v_curr, 0),
    'longestDailyReviewStreak', coalesce(v_long, 0),
    'pendingStreakAchievementEvents', coalesce(v_streak_unlocks, '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: known-word unlock payload — unconsumed known-word events only
-- ---------------------------------------------------------------------------

create or replace function public.get_known_word_unlock_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_known_count integer;
  v_items jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select count(*)::integer
  into v_known_count
  from public.user_word_progress uwp
  where uwp.user_id = v_user_id
    and uwp.status = 'known';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'eventId', e.id,
        'source', e.source,
        'createdAt', e.created_at,
        'achievementDefinitionId', ad.id,
        'code', ad.code,
        'type', ad.type,
        'threshold', ad.threshold,
        'title', ad.title,
        'description', ad.description,
        'icon', ad.icon,
        'sortOrder', ad.sort_order,
        'definition', jsonb_build_object(
          'id', ad.id,
          'code', ad.code,
          'type', ad.type,
          'threshold', ad.threshold,
          'title', ad.title,
          'description', ad.description,
          'icon', ad.icon,
          'sortOrder', ad.sort_order
        )
      )
      order by e.created_at asc
    ),
    '[]'::jsonb
  )
  into v_items
  from public.user_achievement_event e
  join public.achievement_definition ad
    on ad.id = e.achievement_definition_id
  where e.user_id = v_user_id
    and e.consumed_at is null
    and ad.type = 'known_words'
    and e.source in ('known_word_manual', 'known_word_midnight');

  return jsonb_build_object(
    'knownWordsCount', v_known_count,
    'pendingKnownWordEvents', v_items
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.complete_daily_review_session(uuid[]) from public;
grant execute on function public.complete_daily_review_session(uuid[]) to authenticated;

revoke all on function public.mark_word_known(uuid) from public;
grant execute on function public.mark_word_known(uuid) to authenticated;

revoke all on function public.mark_word_known_and_advance_daily_word(uuid) from public;
grant execute on function public.mark_word_known_and_advance_daily_word(uuid) to authenticated;

revoke all on function public.get_user_achievements() from public;
grant execute on function public.get_user_achievements() to authenticated;

revoke all on function public.get_user_profile_summary() from public;
grant execute on function public.get_user_profile_summary() to authenticated;

revoke all on function public.get_completion_screen_data() from public;
grant execute on function public.get_completion_screen_data() to authenticated;

revoke all on function public.get_known_word_unlock_data() from public;
grant execute on function public.get_known_word_unlock_data() to authenticated;

revoke all on function public.process_app_entry_achievement_events() from public;
grant execute on function public.process_app_entry_achievement_events() to authenticated;

revoke all on function public.get_pending_achievement_events() from public;
grant execute on function public.get_pending_achievement_events() to authenticated;

revoke all on function public.consume_achievement_events(uuid[]) from public;
grant execute on function public.consume_achievement_events(uuid[]) to authenticated;
