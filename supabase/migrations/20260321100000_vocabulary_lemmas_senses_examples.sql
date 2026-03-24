-- Canonical vocabulary model: lemma (headword) → senses (meanings per language pair) → examples per sense.
-- Existing public.vocabulary_words remains for backward compatibility until the app migrates off flat rows.
-- Idempotent: można ponownie uruchomić.

-- ---------------------------------------------------------------------------
-- Lemma = orthographic headword in the SOURCE (learning/from) language.
-- Pronunciation + optional audio attach here (shared across senses of the same surface form).
-- ---------------------------------------------------------------------------
create table if not exists public.vocabulary_lemmas (
  id uuid primary key default gen_random_uuid(),
  source_language_code text not null references public.languages (code),
  lemma_text text not null,
  pronunciation_text text,
  audio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vocabulary_lemmas_source_text_nonempty check (length(trim(lemma_text)) > 0)
);

create unique index if not exists idx_vocabulary_lemmas_lang_lemma_normalized
  on public.vocabulary_lemmas (source_language_code, lower(trim(lemma_text)));

create index if not exists idx_vocabulary_lemmas_source_lang
  on public.vocabulary_lemmas (source_language_code);

-- ---------------------------------------------------------------------------
-- Sense = one target-language gloss for a lemma: POS + translation + CEFR.
-- Multiple senses per lemma (e.g. run: verb / verb / noun) differ by sense_index + gloss.
-- Pair = lemma.source_language_code + target_language_code (must differ; enforced by trigger).
-- ---------------------------------------------------------------------------
create table if not exists public.vocabulary_senses (
  id uuid primary key default gen_random_uuid(),
  lemma_id uuid not null references public.vocabulary_lemmas (id) on delete cascade,
  target_language_code text not null references public.languages (code),
  part_of_speech text not null,
  gloss_text text not null,
  cefr_level text not null,
  sense_index smallint not null default 0,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vocabulary_senses_pos_chk check (
    part_of_speech in (
      'noun', 'verb', 'adj', 'adv', 'prep', 'conj', 'pron', 'det', 'num', 'phrase', 'other'
    )
  ),
  constraint vocabulary_senses_cefr_chk check (
    cefr_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
  ),
  constraint vocabulary_senses_gloss_nonempty check (length(trim(gloss_text)) > 0),
  unique (lemma_id, target_language_code, sense_index)
);

create or replace function public.enforce_vocabulary_sense_language_pair()
returns trigger
language plpgsql
as $$
declare
  src text;
begin
  select l.source_language_code into strict src
  from public.vocabulary_lemmas l
  where l.id = new.lemma_id;

  if src = new.target_language_code then
    raise exception 'vocabulary_senses: source and target language must differ (lemma_id=%)', new.lemma_id;
  end if;
  return new;
end;
$$;

drop trigger if exists vocabulary_senses_enforce_language_pair on public.vocabulary_senses;
create trigger vocabulary_senses_enforce_language_pair
  before insert or update of lemma_id, target_language_code on public.vocabulary_senses
  for each row execute function public.enforce_vocabulary_sense_language_pair();

create index if not exists idx_vocabulary_senses_lemma_target
  on public.vocabulary_senses (lemma_id, target_language_code);

create index if not exists idx_vocabulary_senses_pair_cefr
  on public.vocabulary_senses (target_language_code, cefr_level);

-- ---------------------------------------------------------------------------
-- Example sentences belong to a sense (not to the lemma), so translations match meaning.
-- ---------------------------------------------------------------------------
create table if not exists public.vocabulary_examples (
  id uuid primary key default gen_random_uuid(),
  sense_id uuid not null references public.vocabulary_senses (id) on delete cascade,
  example_source_text text not null,
  example_target_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint vocabulary_examples_source_nonempty check (length(trim(example_source_text)) > 0)
);

create index if not exists idx_vocabulary_examples_sense_sort
  on public.vocabulary_examples (sense_id, sort_order);

-- ---------------------------------------------------------------------------
-- Deck membership at sense granularity (parallel to deck_words on legacy vocabulary_words).
-- ---------------------------------------------------------------------------
create table if not exists public.deck_senses (
  deck_id uuid not null references public.decks (id) on delete cascade,
  sense_id uuid not null references public.vocabulary_senses (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (deck_id, sense_id)
);

create index if not exists idx_deck_senses_sense on public.deck_senses (sense_id);

-- ---------------------------------------------------------------------------
-- Optional bridge: map one legacy vocabulary_words row to one sense (incremental migration).
-- ---------------------------------------------------------------------------
create table if not exists public.vocabulary_word_sense_links (
  word_id uuid not null references public.vocabulary_words (id) on delete cascade,
  sense_id uuid not null references public.vocabulary_senses (id) on delete cascade,
  primary key (word_id, sense_id),
  unique (word_id),
  unique (sense_id)
);

-- ---------------------------------------------------------------------------
-- Read-friendly view: one row per sense with lemma + pair; examples via separate query or aggregate.
-- ---------------------------------------------------------------------------
create or replace view public.vocabulary_sense_display as
select
  s.id as sense_id,
  l.id as lemma_id,
  l.source_language_code,
  l.lemma_text,
  l.pronunciation_text,
  l.audio_url,
  s.target_language_code,
  s.part_of_speech,
  s.gloss_text,
  s.cefr_level,
  s.sense_index,
  s.category
from public.vocabulary_senses s
join public.vocabulary_lemmas l on l.id = s.lemma_id;

-- ---------------------------------------------------------------------------
-- Triggers: updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists vocabulary_lemmas_set_updated_at on public.vocabulary_lemmas;
create trigger vocabulary_lemmas_set_updated_at
  before update on public.vocabulary_lemmas
  for each row execute function public.set_updated_at();

drop trigger if exists vocabulary_senses_set_updated_at on public.vocabulary_senses;
create trigger vocabulary_senses_set_updated_at
  before update on public.vocabulary_senses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: public catalog (same policy pattern as vocabulary_words)
-- ---------------------------------------------------------------------------
alter table public.vocabulary_lemmas enable row level security;
alter table public.vocabulary_senses enable row level security;
alter table public.vocabulary_examples enable row level security;
alter table public.deck_senses enable row level security;
alter table public.vocabulary_word_sense_links enable row level security;

drop policy if exists "vocabulary_lemmas_select_all" on public.vocabulary_lemmas;
create policy "vocabulary_lemmas_select_all"
  on public.vocabulary_lemmas for select using (true);

drop policy if exists "vocabulary_senses_select_all" on public.vocabulary_senses;
create policy "vocabulary_senses_select_all"
  on public.vocabulary_senses for select using (true);

drop policy if exists "vocabulary_examples_select_all" on public.vocabulary_examples;
create policy "vocabulary_examples_select_all"
  on public.vocabulary_examples for select using (true);

drop policy if exists "deck_senses_select_all" on public.deck_senses;
create policy "deck_senses_select_all"
  on public.deck_senses for select using (true);

drop policy if exists "vocabulary_word_sense_links_select_all" on public.vocabulary_word_sense_links;
create policy "vocabulary_word_sense_links_select_all"
  on public.vocabulary_word_sense_links for select using (true);

-- ---------------------------------------------------------------------------
-- Demo: English "run" → Polish three senses (verb / verb / noun) + one example each
-- ---------------------------------------------------------------------------
insert into public.vocabulary_lemmas (id, source_language_code, lemma_text, pronunciation_text)
values (
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'en',
  'run',
  'run'
)
on conflict (id) do nothing;

insert into public.vocabulary_senses (
  id,
  lemma_id,
  target_language_code,
  part_of_speech,
  gloss_text,
  cefr_level,
  sense_index,
  category
)
values
  (
    'c1000000-0000-4000-8000-000000000011'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'pl',
    'verb',
    'biegać',
    'A2',
    0,
    'demo'
  ),
  (
    'c1000000-0000-4000-8000-000000000012'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'pl',
    'verb',
    'prowadzić',
    'B1',
    1,
    'demo'
  ),
  (
    'c1000000-0000-4000-8000-000000000013'::uuid,
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'pl',
    'noun',
    'bieg',
    'A2',
    2,
    'demo'
  )
on conflict (id) do nothing;

insert into public.vocabulary_examples (id, sense_id, example_source_text, example_target_text, sort_order)
values
  (
    'c1000000-0000-4000-8000-000000000021'::uuid,
    'c1000000-0000-4000-8000-000000000011'::uuid,
    'She runs every morning.',
    'Ona biega każdego ranka.',
    0
  ),
  (
    'c1000000-0000-4000-8000-000000000022'::uuid,
    'c1000000-0000-4000-8000-000000000012'::uuid,
    'She runs the marketing department.',
    'Ona prowadzi dział marketingu.',
    0
  ),
  (
    'c1000000-0000-4000-8000-000000000023'::uuid,
    'c1000000-0000-4000-8000-000000000013'::uuid,
    'He finished the run in first place.',
    'Ukończył bieg na pierwszym miejscu.',
    0
  )
on conflict (id) do nothing;
