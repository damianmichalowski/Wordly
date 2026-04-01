-- Liczby słów w katalogu per poziom / kategoria (bez postępu użytkownika).
-- Do onboardingu i miejsc, gdzie potrzebny jest tylko rozmiar puli słów.

create or replace function public.get_learning_option_catalog_counts()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return jsonb_build_object(

    'difficulty', jsonb_build_array(

      jsonb_build_object(
        'key', 'beginner',
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
        'availableCount', (
          select count(*)
          from public.words w
          join public.cefr_level cl on cl.id = w.cefr_level_id
          where w.is_active = true
            and cl.code in ('C1','C2')
        )
      )

    ),

    'categories', coalesce((
      select jsonb_agg(obj.obj)
      from (
        select jsonb_build_object(
          'id', c.id,
          'availableCount', (
            select count(*)
            from public.word_category wc
            join public.words w on w.id = wc.word_id
            where wc.category_id = c.id
              and w.is_active = true
          )
        ) as obj
        from public.category c
        where c.is_active = true
        order by c.name
      ) obj
    ), '[]'::jsonb)

  );
end;
$$;

grant execute on function public.get_learning_option_catalog_counts() to anon, authenticated;
