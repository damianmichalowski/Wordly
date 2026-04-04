-- Streak should only reset when the user skipped a calendar day (gap ≥ 2 days).
-- Previously we also reset when last_daily_revision_date was null, which is redundant for
-- new users (streak already 0) and could race with profile reads after the first completion.

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
    and up.last_daily_revision_date is not null
    and up.last_daily_revision_date < v_today - 1;
end;
$$;
