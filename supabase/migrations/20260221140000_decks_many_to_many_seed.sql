-- Decks + many-to-many deck_words; remove vocabulary_words.deck_id
-- Seed: 6 words from app mock + 2 decks (overlap demonstrates M:N)
-- Idempotent: można ponownie uruchomić.

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_decks_slug on public.decks (slug);

create table if not exists public.deck_words (
  deck_id uuid not null references public.decks (id) on delete cascade,
  word_id uuid not null references public.vocabulary_words (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (deck_id, word_id)
);

create index if not exists idx_deck_words_word on public.deck_words (word_id);

alter table public.vocabulary_words drop column if exists deck_id;

-- RLS (read-only catalog for clients)
alter table public.decks enable row level security;
alter table public.deck_words enable row level security;

drop policy if exists "decks_select_all" on public.decks;
create policy "decks_select_all"
  on public.decks for select using (true);

drop policy if exists "deck_words_select_all" on public.deck_words;
create policy "deck_words_select_all"
  on public.deck_words for select using (true);

-- Triggers: decks updated_at
drop trigger if exists decks_set_updated_at on public.decks;
create trigger decks_set_updated_at
  before update on public.decks
  for each row execute function public.set_updated_at();

-- ---------- Seed (stable UUIDs for app / imports) ----------
-- Decks
insert into public.decks (id, slug, title, description, sort_order)
values
  (
    'b2000000-0000-4000-8000-000000000001'::uuid,
    'wordly_seed',
    'Wordly seed',
    'Initial vocabulary covering all demo language pairs.',
    0
  ),
  (
    'b2000000-0000-4000-8000-000000000002'::uuid,
    'pl_en',
    'PL → EN',
    'Polish–English subset; overlaps with wordly_seed for M:N demo.',
    1
  )
on conflict (slug) do nothing;

-- Legacy flat vocabulary rows (demo deck); app uses vocabulary_sense_display + senses for new content.
insert into public.vocabulary_words (
  id,
  source_language_code,
  target_language_code,
  source_text,
  target_text,
  example_source,
  example_target,
  cefr_level,
  pronunciation_text,
  category
) values
  (
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'pl', 'en',
    'odporny', 'resilient',
    'Musisz być odporny na stres.',
    'You need to be resilient under stress.',
    'B2', 'resilient', 'general'
  ),
  (
    'a1000000-0000-4000-8000-000000000002'::uuid,
    'pl', 'en',
    'subtelny', 'subtle',
    'To była subtelna różnica.',
    'That was a subtle difference.',
    'B2', 'subtle', 'general'
  ),
  (
    'a1000000-0000-4000-8000-000000000003'::uuid,
    'pl', 'en',
    'wykonalny', 'feasible',
    'Plan jest wykonalny przy tym budżecie.',
    'The plan is feasible with this budget.',
    'C1', 'feasible', 'general'
  ),
  (
    'a1000000-0000-4000-8000-000000000004'::uuid,
    'en', 'es',
    'insight', 'perspectiva',
    'Your insight helped the team.',
    'Tu perspectiva ayudó al equipo.',
    'B2', 'perspectiva', 'general'
  ),
  (
    'a1000000-0000-4000-8000-000000000005'::uuid,
    'en', 'es',
    'compelling', 'convincente',
    'She made a compelling argument.',
    'Ella presentó un argumento convincente.',
    'C1', 'convincente', 'general'
  ),
  (
    'a1000000-0000-4000-8000-000000000006'::uuid,
    'pl', 'de',
    'osiągnąć', 'erreichen',
    'Chcę osiągnąć ten cel.',
    'Ich will dieses Ziel erreichen.',
    'B1', 'erreichen', 'general'
  )
on conflict (source_language_code, target_language_code, source_text, target_text) do nothing;

-- M:N: all words in wordly_seed
insert into public.deck_words (deck_id, word_id, sort_order)
select 'b2000000-0000-4000-8000-000000000001'::uuid, w.id, row_number() over (order by w.source_text)
from public.vocabulary_words w
where w.id in (
  'a1000000-0000-4000-8000-000000000001'::uuid,
  'a1000000-0000-4000-8000-000000000002'::uuid,
  'a1000000-0000-4000-8000-000000000003'::uuid,
  'a1000000-0000-4000-8000-000000000004'::uuid,
  'a1000000-0000-4000-8000-000000000005'::uuid,
  'a1000000-0000-4000-8000-000000000006'::uuid
)
on conflict do nothing;

-- M:N: only PL→EN words also in pl_en (overlap = same word in two decks)
insert into public.deck_words (deck_id, word_id, sort_order)
values
  ('b2000000-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-000000000001'::uuid, 1),
  ('b2000000-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-000000000002'::uuid, 2),
  ('b2000000-0000-4000-8000-000000000002'::uuid, 'a1000000-0000-4000-8000-000000000003'::uuid, 3)
on conflict do nothing;
