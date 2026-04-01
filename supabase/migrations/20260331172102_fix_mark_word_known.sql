drop function if exists public.mark_word_known(uuid);

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

  return next;
  return;
end;
$$;

revoke all on function public.mark_word_known(uuid) from public;
grant execute on function public.mark_word_known(uuid) to authenticated;