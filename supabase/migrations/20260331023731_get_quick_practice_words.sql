create or replace function public.get_quick_practice_words(
  p_user_id uuid,
  p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_native_language_id uuid;
  v_safe_limit integer;
  v_result jsonb;
begin
  -- allow only 5 / 10 / 20
  if p_limit not in (5, 10, 20) then
    raise exception 'Invalid p_limit=%, allowed values are 5, 10, 20', p_limit;
  end if;

  v_safe_limit := p_limit;

  -- user's native language
  select up.native_language_id
  into v_native_language_id
  from public.user_profile up
  where up.id = p_user_id;

  if v_native_language_id is null then
    raise exception 'User profile not found or native_language_id missing for user_id=%', p_user_id;
  end if;

  with practice_words as (
    select
      uwp.word_id,
      uwp.known_at,
      uwp.last_review_at,
      uwp.interval_days,
      uwp.next_review_at
    from public.user_word_progress uwp
    where uwp.user_id = p_user_id
      and uwp.status = 'known'
    order by random()
    limit v_safe_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'word_id', w.id,
        'lemma', w.lemma,
        'ipa', w.ipa,
        'known_at', pw.known_at,
        'last_review_at', pw.last_review_at,
        'interval_days', pw.interval_days,
        'next_review_at', pw.next_review_at,
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
    ),
    '[]'::jsonb
  )
  into v_result
  from practice_words pw
  join public.words w
    on w.id = pw.word_id
  join public.cefr_level cl
    on cl.id = w.cefr_level_id
  join public.language tl
    on tl.id = w.target_language_id;

  return v_result;
end;
$$;