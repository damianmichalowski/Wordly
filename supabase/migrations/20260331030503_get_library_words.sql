create or replace function public.get_library_words(
  p_user_id uuid,
  p_search text default null,
  p_cefr_codes text[] default null,
  p_category_codes text[] default null,
  p_sort_known_at text default 'desc',
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_safe_limit integer;
  v_safe_offset integer;
  v_sort_direction text;
  v_total_count integer;
  v_items jsonb;
begin
  -- sanitize inputs
  v_safe_limit := greatest(1, least(coalesce(p_limit, 20), 50));
  v_safe_offset := greatest(0, coalesce(p_offset, 0));
  v_sort_direction := case
    when lower(coalesce(p_sort_known_at, 'desc')) = 'asc' then 'asc'
    else 'desc'
  end;

  -- total count
  select count(distinct w.id)
  into v_total_count
  from public.user_word_progress uwp
  join public.words w
    on w.id = uwp.word_id
  join public.cefr_level cl
    on cl.id = w.cefr_level_id
  where uwp.user_id = p_user_id
    and uwp.status = 'known'
    and (
      p_search is null
      or btrim(p_search) = ''
      or w.lemma ilike '%' || btrim(p_search) || '%'
    )
    and (
      p_cefr_codes is null
      or array_length(p_cefr_codes, 1) is null
      or cl.code = any(p_cefr_codes)
    )
    and (
      p_category_codes is null
      or array_length(p_category_codes, 1) is null
      or exists (
        select 1
        from public.word_category wc
        join public.category c
          on c.id = wc.category_id
        where wc.word_id = w.id
          and c.code = any(p_category_codes)
      )
    );

  -- paginated items
  with filtered_words as (
    select
      w.id as word_id,
      w.lemma,
      uwp.known_at,
      cl.code as cefr_code
    from public.user_word_progress uwp
    join public.words w
      on w.id = uwp.word_id
    join public.cefr_level cl
      on cl.id = w.cefr_level_id
    where uwp.user_id = p_user_id
      and uwp.status = 'known'
      and (
        p_search is null
        or btrim(p_search) = ''
        or w.lemma ilike '%' || btrim(p_search) || '%'
      )
      and (
        p_cefr_codes is null
        or array_length(p_cefr_codes, 1) is null
        or cl.code = any(p_cefr_codes)
      )
      and (
        p_category_codes is null
        or array_length(p_category_codes, 1) is null
        or exists (
          select 1
          from public.word_category wc
          join public.category c
            on c.id = wc.category_id
          where wc.word_id = w.id
            and c.code = any(p_category_codes)
        )
      )
  ),
  ordered_words as (
    select *
    from filtered_words
    order by
      case when v_sort_direction = 'asc' then known_at end asc nulls last,
      case when v_sort_direction = 'desc' then known_at end desc nulls last,
      lemma asc
    limit v_safe_limit
    offset v_safe_offset
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'word_id', ow.word_id,
        'lemma', ow.lemma,
        'known_at', ow.known_at,
        'cefr_code', ow.cefr_code
      )
      order by
        case when v_sort_direction = 'asc' then ow.known_at end asc nulls last,
        case when v_sort_direction = 'desc' then ow.known_at end desc nulls last,
        ow.lemma asc
    ),
    '[]'::jsonb
  )
  into v_items
  from ordered_words ow;

  return jsonb_build_object(
    'items', v_items,
    'totalCount', v_total_count,
    'hasMore', (v_safe_offset + jsonb_array_length(v_items)) < v_total_count
  );
end;
$$;