-- Trudność słowa w powtórkach (np. przyszłe „znowu” / łatwo).
alter table public.user_word_progress
  add column if not exists difficulty_score integer not null default 0;
