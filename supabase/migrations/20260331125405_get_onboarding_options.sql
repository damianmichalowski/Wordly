create or replace function public.get_onboarding_options()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'languages', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'code', l.code,
          'name', l.name
        )
        order by l.name asc
      )
      from public.language l
    ), '[]'::jsonb),

    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'code', c.code,
          'name', c.name,
          'description', c.description
        )
        order by c.name asc
      )
      from public.category c
      where c.is_active = true
    ), '[]'::jsonb),

    'learningModeTypes', jsonb_build_array(
      jsonb_build_object('value', 'difficulty', 'label', 'Difficulty'),
      jsonb_build_object('value', 'category', 'label', 'Category')
    ),

    'learningLevels', jsonb_build_array(
      jsonb_build_object('value', 'beginner', 'label', 'Beginner'),
      jsonb_build_object('value', 'intermediate', 'label', 'Intermediate'),
      jsonb_build_object('value', 'advanced', 'label', 'Advanced')
    )
  )
  into v_result;

  return v_result;
end;
$$;