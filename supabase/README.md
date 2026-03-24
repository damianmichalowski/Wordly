# Supabase (Wordly)

## Zastosowanie migracji na projekcie w chmurze

1. **Supabase CLI** (z katalogu głównego repozytorium):  
   `supabase link` → `supabase db push`

2. **Bez CLI — SQL Editor** w Dashboard:  
   wklej zawartość plików z `migrations/` **po kolei** (data w nazwie pliku), albo tylko nowsze niż ostatnio uruchomione.

Kolejność (wszystkie przed `npm run vocabulary:seed:apply-chunks`):

1. `20260221120000_wordly_initial.sql`
2. `20260221140000_decks_many_to_many_seed.sql`
3. `20260321100000_vocabulary_lemmas_senses_examples.sql` ← tworzy `vocabulary_lemmas` itd.
4. `20260322120000_vocabulary_senses_semantic_unique.sql`
5. `20260323120000_vocabulary_catalog_rls_writes_and_seed.sql` — RLS + przykładowy seed EN→PL
6. `20260324120000_user_progress_vocabulary_senses.sql` — `user_word_progress` / `daily_word_state` wskazują na `vocabulary_senses.id`

## Auth (aplikacja mobilna)

Postęp słów (`user_word_progress`, `daily_word_state`) i profil (`profiles`) wymagają zalogowanego użytkownika (`auth.users`). W aplikacji: **Google** i **Sign in with Apple** (iOS) przez Supabase — konfiguracja redirectów i providerów: **`docs/SOCIAL_AUTH.md`**.

## Połączenie lokalne (CLI, seed skryptami)

Supabase w panelu często pokazuje **„Not IPv4 compatible”**. Na zwykłej sieci IPv4:

- użyj **Session pooler** (host `…pooler.supabase.com`, user `postgres.<ref>`, port jak w URI z panelu — często **5432**),  
  albo **dokup IPv4 add-on**, jeśli potrzebujesz **direct** `db.<ref>.supabase.co:5432`. Na IPv6 możesz użyć Direct z panelu.

Szczegóły: `docs/VOCABULARY_DATASET_SEEDING.md`, `.env.example` w katalogu głównym repo.

## Podgląd słów

W SQL Editor:

```sql
select * from public.vocabulary_sense_display
where source_language_code = 'en' and target_language_code = 'pl'
order by lemma_text, sense_index;
```
