create or replace function public.get_revision_hub_stats(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_today date := current_date;

  v_due_count int;
  v_known_count int;
  v_recent_count int;
  v_completed_today boolean;

begin
  -- 1. Daily Revision - due words
  select count(*)
  into v_due_count
  from public.user_word_progress uwp
  where uwp.user_id = p_user_id
    and uwp.status = 'known'
    and uwp.next_review_at is not null
    and uwp.next_review_at <= v_now;

  -- 2. Known count (for Quick Practice)
  select count(*)
  into v_known_count
  from public.user_word_progress uwp
  where uwp.user_id = p_user_id
    and uwp.status = 'known';

  -- 3. Recently learned (last 20)
  select count(*)
  into v_recent_count
  from (
    select 1
    from public.user_word_progress uwp
    where uwp.user_id = p_user_id
      and uwp.status = 'known'
      and uwp.known_at is not null
    order by uwp.known_at desc
    limit 20
  ) t;

  -- 4. Completed today (Daily Revision)
  -- uznajemy completed jeśli:
  -- brak due words + user miał już jakieś known
  v_completed_today := (v_due_count = 0 and v_known_count > 0);

  -- 5. Build response
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