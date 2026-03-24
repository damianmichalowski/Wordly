-- Wordly initial schema (public)
-- Run in Supabase SQL Editor or via supabase db push
-- Idempotent: można ponownie uruchomić, jeśli część obiektów już istnieje.

create extension if not exists pgcrypto;

-- Reference languages (optional UI / validation)
create table if not exists public.languages (
  code text primary key,
  name text not null
);

insert into public.languages (code, name) values
  ('pl', 'Polish'),
  ('en', 'English'),
  ('es', 'Spanish'),
  ('de', 'German')
on conflict (code) do nothing;

-- User profile (one row per auth user in MVP)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_language_code text not null,
  target_language_code text not null,
  current_level text not null,
  configured_display_level text not null,
  display_level_policy text not null default 'next-level',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  constraint profiles_distinct_languages check (source_language_code <> target_language_code)
);

create index if not exists idx_profiles_user_id on public.profiles (user_id);

-- Vocabulary catalog
create table if not exists public.vocabulary_words (
  id uuid primary key default gen_random_uuid(),
  source_language_code text not null,
  target_language_code text not null,
  source_text text not null,
  target_text text not null,
  example_source text,
  example_target text,
  cefr_level text not null,
  pronunciation_text text,
  audio_url text,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vocabulary_words_pair_unique unique (source_language_code, target_language_code, source_text, target_text)
);

create index if not exists idx_vocabulary_words_pair_level
  on public.vocabulary_words (source_language_code, target_language_code, cefr_level);

-- Per-user progress
create table if not exists public.user_word_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  word_id uuid not null references public.vocabulary_words (id) on delete cascade,
  status text not null default 'active',
  first_seen_at timestamptz,
  marked_known_at timestamptz,
  last_reviewed_at timestamptz,
  next_review_at timestamptz,
  review_count integer not null default 0,
  unique (user_id, word_id),
  constraint user_word_progress_status_chk
    check (status in ('active', 'known', 'skipped', 'review'))
);

create index if not exists idx_user_word_progress_user_status
  on public.user_word_progress (user_id, status);

-- One active daily pointer per user (MVP)
create table if not exists public.daily_word_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  active_word_id uuid references public.vocabulary_words (id) on delete set null,
  active_date date,
  state_version bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists idx_daily_word_state_user on public.daily_word_state (user_id);

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists vocabulary_words_set_updated_at on public.vocabulary_words;
create trigger vocabulary_words_set_updated_at
  before update on public.vocabulary_words
  for each row execute function public.set_updated_at();

-- RLS
alter table public.languages enable row level security;
alter table public.profiles enable row level security;
alter table public.vocabulary_words enable row level security;
alter table public.user_word_progress enable row level security;
alter table public.daily_word_state enable row level security;

drop policy if exists "languages_select_authenticated" on public.languages;
create policy "languages_select_authenticated"
  on public.languages for select to authenticated using (true);

drop policy if exists "languages_select_anon" on public.languages;
create policy "languages_select_anon"
  on public.languages for select to anon using (true);

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update using (auth.uid() = user_id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
  on public.profiles for delete using (auth.uid() = user_id);

-- Public read catalog (anon + authenticated) — adjust later if vocab should be private
drop policy if exists "vocabulary_words_select_all" on public.vocabulary_words;
create policy "vocabulary_words_select_all"
  on public.vocabulary_words for select using (true);

drop policy if exists "user_word_progress_select_own" on public.user_word_progress;
create policy "user_word_progress_select_own"
  on public.user_word_progress for select using (auth.uid() = user_id);

drop policy if exists "user_word_progress_insert_own" on public.user_word_progress;
create policy "user_word_progress_insert_own"
  on public.user_word_progress for insert with check (auth.uid() = user_id);

drop policy if exists "user_word_progress_update_own" on public.user_word_progress;
create policy "user_word_progress_update_own"
  on public.user_word_progress for update using (auth.uid() = user_id);

drop policy if exists "user_word_progress_delete_own" on public.user_word_progress;
create policy "user_word_progress_delete_own"
  on public.user_word_progress for delete using (auth.uid() = user_id);

drop policy if exists "daily_word_state_select_own" on public.daily_word_state;
create policy "daily_word_state_select_own"
  on public.daily_word_state for select using (auth.uid() = user_id);

drop policy if exists "daily_word_state_insert_own" on public.daily_word_state;
create policy "daily_word_state_insert_own"
  on public.daily_word_state for insert with check (auth.uid() = user_id);

drop policy if exists "daily_word_state_update_own" on public.daily_word_state;
create policy "daily_word_state_update_own"
  on public.daily_word_state for update using (auth.uid() = user_id);

drop policy if exists "daily_word_state_delete_own" on public.daily_word_state;
create policy "daily_word_state_delete_own"
  on public.daily_word_state for delete using (auth.uid() = user_id);
