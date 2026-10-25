-- Tracks how many times the user tapped "Nie znam" outside difficult-words mode.
-- Second tap (counter >= 2) auto-marks the word difficult.
alter table public.user_word_progress
  add column if not exists difficult_dont_know_counter integer not null default 0;

comment on column public.user_word_progress.difficult_dont_know_counter is
  'Increments on revision "Nie znam"; at 2+ the word is auto-marked difficult (is_difficult = true).';

create or replace function public.record_word_difficult_dont_know(
  p_word_id uuid
)
returns table (
  user_id uuid,
  word_id uuid,
  difficult_dont_know_counter integer,
  is_difficult boolean,
  difficult_marked_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_counter integer;
  v_is_difficult boolean;
  v_difficult_marked_at timestamptz;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_word_id is null then
    raise exception 'word_id is required';
  end if;

  if not exists (
    select 1
    from public.words as w
    where w.id = p_word_id
      and w.is_active = true
  ) then
    raise exception 'word not found or inactive';
  end if;

  insert into public.user_word_progress (
    user_id,
    word_id,
    status,
    difficult_dont_know_counter,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    p_word_id,
    'learning',
    1,
    v_now,
    v_now
  )
  on conflict on constraint user_word_progress_unique
  do update
    set
      difficult_dont_know_counter = public.user_word_progress.difficult_dont_know_counter + 1,
      updated_at = v_now;

  select uwp.difficult_dont_know_counter
  into v_counter
  from public.user_word_progress as uwp
  where uwp.user_id = v_user_id
    and uwp.word_id = p_word_id
  limit 1;

  if v_counter >= 2 then
    update public.user_word_progress as uwp
    set
      is_difficult = true,
      difficult_marked_at = v_now,
      updated_at = v_now
    where uwp.user_id = v_user_id
      and uwp.word_id = p_word_id;
  end if;

  select
    uwp.difficult_dont_know_counter,
    uwp.is_difficult,
    uwp.difficult_marked_at,
    uwp.status
  into
    v_counter,
    v_is_difficult,
    v_difficult_marked_at,
    v_status
  from public.user_word_progress as uwp
  where uwp.user_id = v_user_id
    and uwp.word_id = p_word_id
  limit 1;

  user_id := v_user_id;
  word_id := p_word_id;
  difficult_dont_know_counter := v_counter;
  is_difficult := v_is_difficult;
  difficult_marked_at := v_difficult_marked_at;
  status := v_status;

  return next;
  return;
end;
$$;

revoke all on function public.record_word_difficult_dont_know(uuid) from public;
grant execute on function public.record_word_difficult_dont_know(uuid) to authenticated;

comment on function public.record_word_difficult_dont_know(uuid) is
  'Increments difficult_dont_know_counter; auto-marks is_difficult when counter reaches 2.';

create or replace function public.set_word_difficult_dont_know_counter(
  p_word_id uuid,
  p_counter integer
)
returns table (
  user_id uuid,
  word_id uuid,
  difficult_dont_know_counter integer,
  is_difficult boolean,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_counter integer;
  v_is_difficult boolean;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_word_id is null then
    raise exception 'word_id is required';
  end if;

  if p_counter is null or p_counter < 0 then
    raise exception 'counter must be >= 0';
  end if;

  if not exists (
    select 1
    from public.words as w
    where w.id = p_word_id
      and w.is_active = true
  ) then
    raise exception 'word not found or inactive';
  end if;

  insert into public.user_word_progress (
    user_id,
    word_id,
    status,
    difficult_dont_know_counter,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    p_word_id,
    'learning',
    p_counter,
    v_now,
    v_now
  )
  on conflict on constraint user_word_progress_unique
  do update
    set
      difficult_dont_know_counter = p_counter,
      updated_at = v_now;

  select
    uwp.difficult_dont_know_counter,
    uwp.is_difficult,
    uwp.status
  into
    v_counter,
    v_is_difficult,
    v_status
  from public.user_word_progress as uwp
  where uwp.user_id = v_user_id
    and uwp.word_id = p_word_id
  limit 1;

  user_id := v_user_id;
  word_id := p_word_id;
  difficult_dont_know_counter := v_counter;
  is_difficult := v_is_difficult;
  status := v_status;

  return next;
  return;
end;
$$;

revoke all on function public.set_word_difficult_dont_know_counter(uuid, integer) from public;
grant execute on function public.set_word_difficult_dont_know_counter(uuid, integer) to authenticated;

comment on function public.set_word_difficult_dont_know_counter(uuid, integer) is
  'Sets difficult_dont_know_counter for undo / admin correction; does not change is_difficult.';

-- Return type adds difficult_dont_know_counter; must drop before recreate.
drop function if exists public.set_word_difficult(uuid, boolean);

create or replace function public.set_word_difficult(
  p_word_id uuid,
  p_is_difficult boolean
)
returns table (
  user_id uuid,
  word_id uuid,
  is_difficult boolean,
  difficult_marked_at timestamptz,
  difficult_dont_know_counter integer,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();

  v_status text;
  v_is_difficult boolean;
  v_difficult_marked_at timestamptz;
  v_counter integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_word_id is null then
    raise exception 'word_id is required';
  end if;

  if p_is_difficult is null then
    raise exception 'is_difficult is required';
  end if;

  if not exists (
    select 1
    from public.words as w
    where w.id = p_word_id
      and w.is_active = true
  ) then
    raise exception 'word not found or inactive';
  end if;

  insert into public.user_word_progress (
    user_id,
    word_id,
    status,
    is_difficult,
    difficult_marked_at,
    difficult_dont_know_counter,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    p_word_id,
    'learning',
    p_is_difficult,
    case when p_is_difficult then v_now else null end,
    0,
    v_now,
    v_now
  )
  on conflict on constraint user_word_progress_unique
  do update
    set
      is_difficult = p_is_difficult,
      difficult_marked_at = case when p_is_difficult then v_now else null end,
      difficult_dont_know_counter = case
        when p_is_difficult
          and not coalesce(public.user_word_progress.is_difficult, false)
          then 0
        else public.user_word_progress.difficult_dont_know_counter
      end,
      updated_at = v_now;

  select
    uwp.status,
    uwp.is_difficult,
    uwp.difficult_marked_at,
    uwp.difficult_dont_know_counter
  into
    v_status,
    v_is_difficult,
    v_difficult_marked_at,
    v_counter
  from public.user_word_progress as uwp
  where uwp.user_id = v_user_id
    and uwp.word_id = p_word_id
  limit 1;

  user_id := v_user_id;
  word_id := p_word_id;
  is_difficult := v_is_difficult;
  difficult_marked_at := v_difficult_marked_at;
  difficult_dont_know_counter := v_counter;
  status := v_status;

  return next;
  return;
end;
$$;

revoke all on function public.set_word_difficult(uuid, boolean) from public;
grant execute on function public.set_word_difficult(uuid, boolean) to authenticated;

-- Expose counter on word details for cache / flashcard bookmark state.
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
    'difficult_correct_streak', coalesce(uwp.difficult_correct_streak, 0),
    'difficult_dont_know_counter', coalesce(uwp.difficult_dont_know_counter, 0),
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
