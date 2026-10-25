alter table public.user_word_progress
  add column if not exists difficult_correct_streak integer not null default 0;

comment on column public.user_word_progress.difficult_correct_streak is
  'Consecutive correct reviews while the word is marked difficult; used for difficult-word graduation.';
