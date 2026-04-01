create or replace function public.get_daily_word_details(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := current_date;
  v_native_language_id uuid;
  v_word_id uuid;
  v_result jsonb;
begin
  -- 1. Get user's native language
  select up.native_language_id
  into v_native_language_id
  from public.user_profile up
  where up.id = p_user_id;

  if v_native_language_id is null then
    raise exception 'User profile not found or native_language_id missing for user_id=%', p_user_id;
  end if;

  -- 2. Get today's word
  select udw.word_id
  into v_word_id
  from public.user_daily_word udw
  where udw.user_id = p_user_id
    and udw.day_date = v_today
  limit 1;

  if v_word_id is null then
    return null;
  end if;

  -- 3. Build full word payload
  select jsonb_build_object(
    'word_id', w.id,
    'lemma', w.lemma,
    'ipa', w.ipa,
    'is_active', w.is_active,
    'cefr', jsonb_build_object(
      'id', cl.id,
      'code', cl.code,
      'order_index', cl.order_index
    ),
    'target_language', jsonb_build_object(
      'id', tl.id,
      'code', tl.code,
      'name', tl.name
    ),
    'senses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'sense_id', s.id,
          'sense_order', s.sense_order,
          'part_of_speech', jsonb_build_object(
            'id', pos.id,
            'code', pos.code,
            'name', pos.name,
            'order_index', pos.order_index
          ),
          'translation', jsonb_build_object(
            'id', st.id,
            'text', st.translation,
            'native_language_id', st.native_language_id,
            'examples', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', te.id,
                  'text', te.example_text,
                  'order', te.example_order
                )
                order by te.example_order
              )
              from public.translation_example te
              where te.sense_translation_id = st.id
            ), '[]'::jsonb)
          )
        )
        order by s.sense_order
      )
      from public.sense s
      join public.part_of_speech pos
        on pos.id = s.part_of_speech_id
      join public.sense_translation st
        on st.sense_id = s.id
       and st.native_language_id = v_native_language_id
      where s.word_id = w.id
    ), '[]'::jsonb)
  )
  into v_result
  from public.words w
  join public.cefr_level cl
    on cl.id = w.cefr_level_id
  join public.language tl
    on tl.id = w.target_language_id
  where w.id = v_word_id;

  return v_result;
end;
$$;