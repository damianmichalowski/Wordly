-- =========================================================
-- REVISION SESSION TRACKING — tables, constraints, indexes
-- =========================================================

-- Per-session aggregate: one row per started review session.
create table public.user_revision_session (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_words integer not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  duration_seconds integer,
  created_at timestamptz not null default now(),

  constraint urs_mode_check check (mode in (
    'daily_review',
    'quick_practice',
    'recently_learned',
    'level_practice',
    'library_practice'
  )),
  constraint urs_total_words_check check (total_words >= 0),
  constraint urs_correct_count_check check (correct_count >= 0),
  constraint urs_wrong_count_check check (wrong_count >= 0),
  constraint urs_duration_check check (duration_seconds is null or duration_seconds >= 0),
  constraint urs_completed_after_started check (completed_at is null or completed_at >= started_at)
);

-- Per-word answer within a session. user_id denormalised for efficient stats queries.
create table public.user_revision_answer (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.user_revision_session(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  answer_result text not null,
  response_time_ms integer,
  created_at timestamptz not null default now(),

  constraint ura_answer_result_check check (answer_result in ('correct', 'wrong', 'skipped')),
  constraint ura_response_time_check check (response_time_ms is null or response_time_ms >= 0)
);

-- ---------------------------------------------------------
-- indexes — user_revision_session
-- ---------------------------------------------------------
create index idx_urs_user_id
  on public.user_revision_session (user_id);

create index idx_urs_user_started
  on public.user_revision_session (user_id, started_at desc);

create index idx_urs_user_completed
  on public.user_revision_session (user_id, completed_at desc)
  where completed_at is not null;

create index idx_urs_mode
  on public.user_revision_session (mode);

-- ---------------------------------------------------------
-- indexes — user_revision_answer
-- ---------------------------------------------------------
create index idx_ura_session_id
  on public.user_revision_answer (session_id);

create index idx_ura_user_id
  on public.user_revision_answer (user_id);

create index idx_ura_word_id
  on public.user_revision_answer (word_id);

create index idx_ura_user_created
  on public.user_revision_answer (user_id, created_at desc);

create index idx_ura_user_answer_result
  on public.user_revision_answer (user_id, answer_result);

create index idx_ura_user_word
  on public.user_revision_answer (user_id, word_id);
