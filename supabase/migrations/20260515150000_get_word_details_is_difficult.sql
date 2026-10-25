-- Expose per-user difficult flag on word details (for UI toggle state).
create or replace function public.get_word_details(
  p_word_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_native_language_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_word_id is null then
    raise exception 'word_id is required';
  end if;

  select up.native_language_id
  into v_native_language_id
  from public.user_profile up
  where up.id = v_user_id;

  if v_native_language_id is null then
    raise exception 'User profile not found or native_language_id missing';
  end if;

  select jsonb_build_object(
    'word_id', w.id,
    'lemma', w.lemma,
    'ipa', w.ipa,
    'is_active', w.is_active,
    'created_at', w.created_at,
    'updated_at', w.updated_at,
    'is_difficult', uwp.is_difficult,
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
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'code', c.code,
          'name', c.name
        )
        order by c.name asc
      )
      from public.word_category wc
      join public.category c
        on c.id = wc.category_id
      where wc.word_id = w.id
    ), '[]'::jsonb),
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
  left join public.user_word_progress uwp
    on uwp.user_id = v_user_id
   and uwp.word_id = w.id
  where w.id = p_word_id;

  return v_result;
end;
$$;
