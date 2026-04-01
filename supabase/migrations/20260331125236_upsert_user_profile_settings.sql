create or replace function public.upsert_user_profile_settings(
  p_user_id uuid,
  p_native_language_id uuid,
  p_learning_language_id uuid,
  p_learning_mode_type text,
  p_learning_level text default null,
  p_selected_category_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  -- basic validation
  if p_native_language_id is null then
    raise exception 'native_language_id is required';
  end if;

  if p_learning_language_id is null then
    raise exception 'learning_language_id is required';
  end if;

  if p_native_language_id = p_learning_language_id then
    raise exception 'native_language_id and learning_language_id must be different';
  end if;

  if p_learning_mode_type not in ('difficulty', 'category') then
    raise exception 'learning_mode_type must be difficulty or category';
  end if;

  if p_learning_mode_type = 'difficulty' then
    if p_learning_level is null then
      raise exception 'learning_level is required when learning_mode_type = difficulty';
    end if;

    if p_learning_level not in ('beginner', 'intermediate', 'advanced') then
      raise exception 'learning_level must be beginner, intermediate or advanced';
    end if;
  end if;

  if p_learning_mode_type = 'category' then
    if p_selected_category_id is null then
      raise exception 'selected_category_id is required when learning_mode_type = category';
    end if;
  end if;

  insert into public.user_profile (
    id,
    native_language_id,
    learning_language_id,
    learning_mode_type,
    learning_level,
    selected_category_id
  )
  values (
    p_user_id,
    p_native_language_id,
    p_learning_language_id,
    p_learning_mode_type,
    case
      when p_learning_mode_type = 'difficulty' then p_learning_level
      else null
    end,
    case
      when p_learning_mode_type = 'category' then p_selected_category_id
      else null
    end
  )
  on conflict (id)
  do update
    set
      native_language_id = excluded.native_language_id,
      learning_language_id = excluded.learning_language_id,
      learning_mode_type = excluded.learning_mode_type,
      learning_level = excluded.learning_level,
      selected_category_id = excluded.selected_category_id;

  select public.get_user_profile_settings(p_user_id)
  into v_result;

  return v_result;
end;
$$;