create or replace function public.set_word_difficult(
  p_word_id uuid,
  p_is_difficult boolean
)
returns table (
  user_id uuid,
  word_id uuid,
  is_difficult boolean,
  difficult_marked_at timestamptz,
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
  v_is_difficult boolean;
  v_difficult_marked_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_word_id is null then
    raise exception 'word_id is required';
  end if;

  if p_is_difficult is null then
    raise exception 'is_difficult is required';
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
    is_difficult,
    difficult_marked_at,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    p_word_id,
    'learning',
    p_is_difficult,
    case when p_is_difficult then v_now else null end,
    v_now,
    v_now
  )
  on conflict on constraint user_word_progress_unique
  do update
    set
      is_difficult = p_is_difficult,
      difficult_marked_at = case when p_is_difficult then v_now else null end,
      updated_at = v_now;

  select
    uwp.status,
    uwp.is_difficult,
    uwp.difficult_marked_at
  into
    v_status,
    v_is_difficult,
    v_difficult_marked_at
  from public.user_word_progress as uwp
  where uwp.user_id = v_user_id
    and uwp.word_id = p_word_id
  limit 1;

  user_id := v_user_id;
  word_id := p_word_id;
  is_difficult := v_is_difficult;
  difficult_marked_at := v_difficult_marked_at;
  status := v_status;

  return next;
  return;
end;
$$;

revoke all on function public.set_word_difficult(uuid, boolean) from public;
grant execute on function public.set_word_difficult(uuid, boolean) to authenticated;
