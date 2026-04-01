create or replace function public.get_learning_track_progress()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();

  v_mode text;
  v_level text;
  v_category_id uuid;

  v_known_count int := 0;
  v_available_count int := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- user settings
  select
    up.learning_mode_type,
    up.learning_level,
    up.selected_category_id
  into
    v_mode,
    v_level,
    v_category_id
  from public.user_profile up
  where up.id = v_user_id;

  -- =========================
  -- DIFFICULTY MODE
  -- =========================
  if v_mode = 'difficulty' then

    -- available words
    select count(*)
    into v_available_count
    from public.words w
    join public.cefr_level cl on cl.id = w.cefr_level_id
    where w.is_active = true
      and (
        (v_level = 'beginner' and cl.code in ('A1','A2'))
        or
        (v_level = 'intermediate' and cl.code in ('B1','B2'))
        or
        (v_level = 'advanced' and cl.code in ('C1','C2'))
      );

    -- known words
    select count(*)
    into v_known_count
    from public.user_word_progress uwp
    join public.words w on w.id = uwp.word_id
    join public.cefr_level cl on cl.id = w.cefr_level_id
    where uwp.user_id = v_user_id
      and uwp.status = 'known'
      and (
        (v_level = 'beginner' and cl.code in ('A1','A2'))
        or
        (v_level = 'intermediate' and cl.code in ('B1','B2'))
        or
        (v_level = 'advanced' and cl.code in ('C1','C2'))
      );

  -- =========================
  -- CATEGORY MODE
  -- =========================
  elsif v_mode = 'category' then

    select count(*)
    into v_available_count
    from public.words w
    join public.word_category wc on wc.word_id = w.id
    where w.is_active = true
      and wc.category_id = v_category_id;

    select count(*)
    into v_known_count
    from public.user_word_progress uwp
    join public.words w on w.id = uwp.word_id
    join public.word_category wc on wc.word_id = w.id
    where uwp.user_id = v_user_id
      and uwp.status = 'known'
      and wc.category_id = v_category_id;

  else
    raise exception 'Unsupported mode';
  end if;

  return jsonb_build_object(
    'mode', v_mode,
    'knownCount', v_known_count,
    'availableCount', v_available_count,
    'progressPercent',
      case
        when v_available_count = 0 then 0
        else round((v_known_count::numeric / v_available_count) * 100)
      end
  );
end;
$$;

grant execute on function public.get_learning_track_progress() to authenticated;