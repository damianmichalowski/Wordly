-- extensions
create extension if not exists pgcrypto;

-- =========================
-- dictionary tables
-- =========================

create table public.language (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);

create table public.cefr_level (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  order_index integer not null unique,
  constraint cefr_level_code_check check (code in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  constraint cefr_level_order_index_check check (order_index between 1 and 6)
);

create table public.part_of_speech (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  order_index integer not null unique,
  constraint part_of_speech_code_check check (code in ('noun', 'verb', 'adjective', 'adverb', 'phrase', 'other'))
);

create table public.category (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.words (
  id uuid primary key default gen_random_uuid(),
  target_language_id uuid not null references public.language(id) on delete restrict,
  lemma text not null,
  cefr_level_id uuid not null references public.cefr_level(id) on delete restrict,
  ipa text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint words_lemma_not_blank check (btrim(lemma) <> ''),
  constraint words_unique_target_language_lemma unique (target_language_id, lemma)
);

create table public.word_category (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references public.words(id) on delete cascade,
  category_id uuid not null references public.category(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint word_category_unique unique (word_id, category_id)
);

create table public.sense (
  id uuid primary key default gen_random_uuid(),
  word_id uuid not null references public.words(id) on delete cascade,
  part_of_speech_id uuid not null references public.part_of_speech(id) on delete restrict,
  sense_order integer not null,
  created_at timestamptz not null default now(),
  constraint sense_order_positive check (sense_order > 0),
  constraint sense_unique_word_order unique (word_id, sense_order)
);

create table public.sense_translation (
  id uuid primary key default gen_random_uuid(),
  sense_id uuid not null references public.sense(id) on delete cascade,
  native_language_id uuid not null references public.language(id) on delete restrict,
  translation text not null,
  created_at timestamptz not null default now(),
  constraint sense_translation_not_blank check (btrim(translation) <> ''),
  constraint sense_translation_unique unique (sense_id, native_language_id)
);

create table public.translation_example (
  id uuid primary key default gen_random_uuid(),
  sense_translation_id uuid not null references public.sense_translation(id) on delete cascade,
  example_text text not null,
  example_order integer not null,
  created_at timestamptz not null default now(),
  constraint translation_example_not_blank check (btrim(example_text) <> ''),
  constraint translation_example_order_positive check (example_order > 0),
  constraint translation_example_unique_text unique (sense_translation_id, example_text),
  constraint translation_example_unique_order unique (sense_translation_id, example_order)
);

-- =========================
-- user tables
-- =========================

create table public.user_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  native_language_id uuid not null references public.language(id) on delete restrict,
  learning_language_id uuid not null references public.language(id) on delete restrict,
  learning_mode_type text not null,
  learning_level text,
  selected_category_id uuid references public.category(id) on delete set null,
  last_daily_revision_date date,
  created_at timestamptz not null default now(),
  constraint user_profile_learning_mode_type_check
    check (learning_mode_type in ('difficulty', 'category')),
  constraint user_profile_learning_level_check
    check (learning_level is null or learning_level in ('beginner', 'intermediate', 'advanced')),
  constraint user_profile_native_learning_diff_check
    check (native_language_id <> learning_language_id),
  constraint user_profile_mode_consistency_check
    check (
      (learning_mode_type = 'difficulty' and learning_level is not null)
      or
      (learning_mode_type = 'category' and selected_category_id is not null)
    )
);

create table public.user_word_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id uuid not null references public.words(id) on delete cascade,
  status text not null,
  interval_days integer not null default 0,
  next_review_at timestamptz,
  last_review_at timestamptz,
  known_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_word_progress_status_check
    check (status in ('learning', 'known', 'review')),
  constraint user_word_progress_interval_days_check
    check (interval_days >= 0),
  constraint user_word_progress_unique unique (user_id, word_id)
);

create table public.user_daily_word (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_date date not null,
  word_id uuid not null references public.words(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_daily_word_unique_day unique (user_id, day_date)
);

-- =========================
-- updated_at trigger
-- =========================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_words_set_updated_at
before update on public.words
for each row
execute function public.set_updated_at();

create trigger trg_user_word_progress_set_updated_at
before update on public.user_word_progress
for each row
execute function public.set_updated_at();

-- =========================
-- indexes
-- =========================

create index idx_language_code on public.language(code);
create index idx_cefr_level_order_index on public.cefr_level(order_index);
create index idx_part_of_speech_order_index on public.part_of_speech(order_index);

create index idx_words_target_language_id on public.words(target_language_id);
create index idx_words_cefr_level_id on public.words(cefr_level_id);
create index idx_words_target_language_id_cefr_level_id on public.words(target_language_id, cefr_level_id);
create index idx_words_is_active on public.words(is_active);
create index idx_words_lemma on public.words(lemma);

create index idx_word_category_word_id on public.word_category(word_id);
create index idx_word_category_category_id on public.word_category(category_id);

create index idx_sense_word_id on public.sense(word_id);
create index idx_sense_part_of_speech_id on public.sense(part_of_speech_id);

create index idx_sense_translation_sense_id on public.sense_translation(sense_id);
create index idx_sense_translation_native_language_id on public.sense_translation(native_language_id);

create index idx_translation_example_sense_translation_id on public.translation_example(sense_translation_id);
create index idx_translation_example_example_order on public.translation_example(example_order);

create index idx_user_profile_native_language_id on public.user_profile(native_language_id);
create index idx_user_profile_learning_language_id on public.user_profile(learning_language_id);
create index idx_user_profile_learning_mode_type on public.user_profile(learning_mode_type);
create index idx_user_profile_selected_category_id on public.user_profile(selected_category_id);

create index idx_user_word_progress_user_id on public.user_word_progress(user_id);
create index idx_user_word_progress_word_id on public.user_word_progress(word_id);
create index idx_user_word_progress_status on public.user_word_progress(status);
create index idx_user_word_progress_next_review_at on public.user_word_progress(next_review_at);

create index idx_user_daily_word_user_id on public.user_daily_word(user_id);
create index idx_user_daily_word_word_id on public.user_daily_word(word_id);
create index idx_user_daily_word_day_date on public.user_daily_word(day_date);