-- User-submitted vocabulary issues (admin review only; clients insert via RPC).
create table public.word_report (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users (id) on delete cascade,
  word_id uuid not null references public.words (id) on delete cascade,
  issue_type text not null,
  comment text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint word_report_issue_type_check check (
    issue_type in (
      'wrong_translation',
      'wrong_example',
      'wrong_pronunciation',
      'wrong_cefr',
      'wrong_category',
      'typo',
      'duplicate',
      'other'
    )
  ),
  constraint word_report_status_check check (
    status in ('pending', 'in_progress', 'resolved', 'dismissed')
  ),
  constraint word_report_comment_length_check check (
    comment is null or char_length(btrim(comment)) <= 500
  )
);

create index idx_word_report_word_id on public.word_report (word_id);
create index idx_word_report_reporter_user_id on public.word_report (reporter_user_id);
create index idx_word_report_status_created_at on public.word_report (status, created_at desc);

create trigger trg_word_report_set_updated_at
before update on public.word_report
for each row
execute function public.set_updated_at();

comment on table public.word_report is
  'User reports of vocabulary data issues; readable only via service role / admin tools.';
comment on column public.word_report.reporter_user_id is 'auth.users id of the reporter.';
comment on column public.word_report.issue_type is 'Machine-readable issue category.';
comment on column public.word_report.status is 'Admin workflow: pending → in_progress → resolved | dismissed.';

alter table public.word_report enable row level security;

revoke all on table public.word_report from anon, authenticated;

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
