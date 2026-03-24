-- Postęp użytkownika wskazuje na vocabulary_senses.id (sense_id w aplikacji), nie na legacy vocabulary_words.

delete from public.daily_word_state;
delete from public.user_word_progress;

alter table public.user_word_progress
  drop constraint if exists user_word_progress_word_id_fkey;

alter table public.user_word_progress
  add constraint user_word_progress_word_id_fkey
  foreign key (word_id) references public.vocabulary_senses (id) on delete cascade;

alter table public.daily_word_state
  drop constraint if exists daily_word_state_active_word_id_fkey;

alter table public.daily_word_state
  add constraint daily_word_state_active_word_id_fkey
  foreign key (active_word_id) references public.vocabulary_senses (id) on delete set null;

alter table public.user_word_progress add column if not exists skipped_at timestamptz;
