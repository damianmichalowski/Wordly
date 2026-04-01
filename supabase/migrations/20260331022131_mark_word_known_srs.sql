drop function if exists public.mark_word_known(uuid, uuid);

create function public.mark_word_known(
  p_user_id uuid,
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
  v_now timestamptz := now();
  v_next_review_at timestamptz := v_now + interval '1 day';
begin
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
    p_user_id,
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
  where uwp.user_id = p_user_id
    and uwp.word_id = p_word_id
  limit 1;
end;
$$;