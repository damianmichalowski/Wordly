    create or replace function public.get_user_profile_settings(
    p_user_id uuid
    )
    returns jsonb
    language plpgsql
    security definer
    set search_path = public
    as $$
    declare
    v_result jsonb;
    begin
    select jsonb_build_object(
        'user_id', up.id,
        'native_language', jsonb_build_object(
        'id', nl.id,
        'code', nl.code,
        'name', nl.name
        ),
        'learning_language', jsonb_build_object(
        'id', ll.id,
        'code', ll.code,
        'name', ll.name
        ),
        'learning_mode_type', up.learning_mode_type,
        'learning_level', up.learning_level,
        'selected_category', case
        when c.id is null then null
        else jsonb_build_object(
            'id', c.id,
            'code', c.code,
            'name', c.name
        )
        end,
        'last_daily_revision_date', up.last_daily_revision_date,
        'created_at', up.created_at
    )
    into v_result
    from public.user_profile up
    join public.language nl
        on nl.id = up.native_language_id
    join public.language ll
        on ll.id = up.learning_language_id
    left join public.category c
        on c.id = up.selected_category_id
    where up.id = p_user_id;

    return v_result;
    end;
    $$;