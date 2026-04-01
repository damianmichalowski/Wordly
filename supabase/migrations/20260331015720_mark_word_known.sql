create or replace function public.mark_word_known(
  p_user_id uuid,
  p_word_id uuid
)
returns table (
  user_id uuid,
  word_id uuid,
  status text,
  known_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_known_at timestamptz := now();
begin
  insert into public.user_word_progress (
    user_id,
    word_id,
    status,
    known_at,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    p_word_id,
    'known',
    v_known_at,
    now(),
    now()
  )
  on conflict (user_id, word_id)
  do update
    set
      status = 'known',
      known_at = coalesce(public.user_word_progress.known_at, v_known_at),
      updated_at = now();

  return query
  select
    uwp.user_id,
    uwp.word_id,
    uwp.status,
    uwp.known_at
  from public.user_word_progress uwp
  where uwp.user_id = p_user_id
    and uwp.word_id = p_word_id
  limit 1;
end;
$$;