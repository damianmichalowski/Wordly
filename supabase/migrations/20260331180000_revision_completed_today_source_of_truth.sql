-- Daily Review completion is an explicit user action.
-- `completedToday` must be based on session completion (`user_profile.last_daily_revision_date`)
-- and not inferred from current `dueCount` (which can be 0 for multiple reasons).

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
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Mark completion explicitly even when there are 0 words to update.
  update public.user_profile up
  set last_daily_revision_date = v_today
  where up.id = v_user_id;

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


create or replace function public.get_revision_hub_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_today date := current_date;

  v_due_count int;
  v_known_count int;
  v_recent_count int;
  v_completed_today boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Daily Revision: due words are purely schedule-driven.
  select count(*)
  into v_due_count
  from public.user_word_progress uwp
  where uwp.user_id = v_user_id
    and uwp.status = 'known'
    and uwp.next_review_at is not null
    and uwp.next_review_at <= v_now;

  -- Quick Practice: total known words.
  select count(*)
  into v_known_count
  from public.user_word_progress uwp
  where uwp.user_id = v_user_id
    and uwp.status = 'known';

  -- Recently learned: last 20 known.
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

  -- `completedToday` is based on explicit Daily Review completion,
  -- not inferred from `dueCount` (which can be 0 without the user doing a session).
  select (up.last_daily_revision_date = v_today)
  into v_completed_today
  from public.user_profile up
  where up.id = v_user_id;

  return jsonb_build_object(
    'dailyRevision', jsonb_build_object(
      'dueCount', v_due_count,
      'maxSessionSize', 20,
      'completedToday', coalesce(v_completed_today, false)
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

