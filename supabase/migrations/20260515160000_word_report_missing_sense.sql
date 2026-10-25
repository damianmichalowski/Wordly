alter table public.word_report
drop constraint word_report_issue_type_check;

alter table public.word_report
add constraint word_report_issue_type_check check (
  issue_type in (
    'wrong_translation',
    'missing_sense',
    'wrong_example',
    'wrong_pronunciation',
    'wrong_cefr',
    'wrong_category',
    'typo',
    'duplicate',
    'other'
  )
);

create or replace function public.submit_word_report(
  p_word_id uuid,
  p_issue_type text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_comment text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_word_id is null then
    raise exception 'word_id is required';
  end if;

  if p_issue_type is null or btrim(p_issue_type) = '' then
    raise exception 'issue_type is required';
  end if;

  if p_issue_type not in (
    'wrong_translation',
    'missing_sense',
    'wrong_example',
    'wrong_pronunciation',
    'wrong_cefr',
    'wrong_category',
    'typo',
    'duplicate',
    'other'
  ) then
    raise exception 'invalid issue_type';
  end if;

  if not exists (
    select 1
    from public.words as w
    where w.id = p_word_id
      and w.is_active = true
  ) then
    raise exception 'word not found or inactive';
  end if;

  v_comment := nullif(btrim(p_comment), '');

  if v_comment is not null and char_length(v_comment) > 500 then
    raise exception 'comment too long (max 500 characters)';
  end if;

  insert into public.word_report (
    reporter_user_id,
    word_id,
    issue_type,
    comment,
    status,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    p_word_id,
    p_issue_type,
    v_comment,
    'pending',
    now(),
    now()
  );
end;
$$;

revoke all on function public.submit_word_report(uuid, text, text) from public;
grant execute on function public.submit_word_report(uuid, text, text) to authenticated;
