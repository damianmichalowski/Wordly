create or replace function public.get_learning_options_progress()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  return jsonb_build_object(

    -- =========================
    -- DIFFICULTY TRACKS
    -- =========================
    'difficulty', jsonb_build_array(

      jsonb_build_object(
        'key', 'beginner',
        'knownCount', (
          select count(*)
          from public.user_word_progress uwp
          join public.words w on w.id = uwp.word_id
          join public.cefr_level cl on cl.id = w.cefr_level_id
          where uwp.user_id = v_user_id
            and uwp.status = 'known'
            and cl.code in ('A1','A2')
        ),
        'availableCount', (
          select count(*)
          from public.words w
          join public.cefr_level cl on cl.id = w.cefr_level_id
          where w.is_active = true
            and cl.code in ('A1','A2')
        )
      ),

      jsonb_build_object(
        'key', 'intermediate',
        'knownCount', (
          select count(*)
          from public.user_word_progress uwp
          join public.words w on w.id = uwp.word_id
          join public.cefr_level cl on cl.id = w.cefr_level_id
          where uwp.user_id = v_user_id
            and uwp.status = 'known'
            and cl.code in ('B1','B2')
        ),
        'availableCount', (
          select count(*)
          from public.words w
          join public.cefr_level cl on cl.id = w.cefr_level_id
          where w.is_active = true
            and cl.code in ('B1','B2')
        )
      ),

      jsonb_build_object(
        'key', 'advanced',
        'knownCount', (
          select count(*)
          from public.user_word_progress uwp
          join public.words w on w.id = uwp.word_id
          join public.cefr_level cl on cl.id = w.cefr_level_id
          where uwp.user_id = v_user_id
            and uwp.status = 'known'
            and cl.code in ('C1','C2')
        ),
        'availableCount', (
          select count(*)
          from public.words w
          join public.cefr_level cl on cl.id = w.cefr_level_id
          where w.is_active = true
            and cl.code in ('C1','C2')
        )
      )

    ),

    -- =========================
    -- CATEGORIES
    -- =========================
    'categories', (
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'code', c.code,
          'name', c.name,
          'availableCount', (
            select count(*)
            from public.word_category wc
            join public.words w on w.id = wc.word_id
            where wc.category_id = c.id
              and w.is_active = true
          ),
          'knownCount', (
            select count(*)
            from public.user_word_progress uwp
            join public.word_category wc on wc.word_id = uwp.word_id
            where uwp.user_id = v_user_id
              and uwp.status = 'known'
              and wc.category_id = c.id
          )
        )
      )
      from public.category c
      where c.is_active = true
    )

  );
end;
$$;

grant execute on function public.get_learning_options_progress() to authenticated;