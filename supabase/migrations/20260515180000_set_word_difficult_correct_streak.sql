create or replace function public.set_word_difficult_correct_streak(
  p_word_id uuid,
  p_streak integer
)
returns table (
  user_id uuid,
  word_id uuid,
  difficult_correct_streak integer,
  is_difficult boolean,
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
  v_streak integer;
  v_is_difficult boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_word_id is null then
    raise exception 'word_id is required';
  end if;

  if p_streak is null then
    raise exception 'streak is required';
  end if;

  if p_streak < 0 then
    raise exception 'streak must be >= 0';
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
    difficult_correct_streak,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    p_word_id,
    'learning',
    p_streak,
    v_now,
    v_now
  )
  on conflict on constraint user_word_progress_unique
  do update
    set
      difficult_correct_streak = p_streak,
      updated_at = v_now;

  select
    uwp.status,
    uwp.difficult_correct_streak,
    uwp.is_difficult
  into
    v_status,
    v_streak,
    v_is_difficult
  from public.user_word_progress as uwp
  where uwp.user_id = v_user_id
    and uwp.word_id = p_word_id
  limit 1;

  user_id := v_user_id;
  word_id := p_word_id;
  difficult_correct_streak := v_streak;
  is_difficult := v_is_difficult;
  status := v_status;

  return next;
  return;
end;
$$;

revoke all on function public.set_word_difficult_correct_streak(uuid, integer) from public;
grant execute on function public.set_word_difficult_correct_streak(uuid, integer) to authenticated;

comment on function public.set_word_difficult_correct_streak(uuid, integer) is
  'Sets difficult_correct_streak for the current user and word; upserts user_word_progress when missing.';
