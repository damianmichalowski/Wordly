# Vocabulary data architecture (Supabase)

This document describes the **relational model** for lemmas, senses, examples, and how it relates to legacy flat rows. It does not cover onboarding, auth, widgets, or navigation.

---

## 1. Problems with a single flat row per “word”

A table like `vocabulary_words(source_text, target_text, example_*, …)` forces **one translation and one example pair** per row. That breaks when:

- One surface form has **several meanings** (e.g. English *run*: verb vs noun).
- The same **part of speech** appears twice with **different glosses** (e.g. *run* verb → *biegać* vs *prowadzić*).
- **Examples** must match a **specific sense**, not the whole lemma.

So: **do not encode multiple meanings in one `target_text` field.**

---

## 2. Canonical model (normalized)

| Entity | Role |
|--------|------|
| **`vocabulary_lemmas`** | Headword in the **source** (learning) language: `lemma_text`, optional `pronunciation_text`, optional `audio_url`. One row per distinct surface form per language (e.g. EN `run`). |
| **`vocabulary_senses`** | **One meaning** toward a **target** language: `part_of_speech`, `gloss_text` (translation), `cefr_level`, `sense_index` (ordering within `(lemma_id, target_language_code)`). Pair = `lemma.source_language_code` + `target_language_code`. |
| **`vocabulary_examples`** | **Sentences tied to a sense**: `example_source_text`, optional `example_target_text`, `sort_order`. |
| **`deck_senses`** | M:N between `decks` and **senses** (same idea as `deck_words`, but at sense granularity). |

**CEFR** lives on **`vocabulary_senses`**, because difficulty is meaning-specific (same lemma can have senses at different levels).

**Pronunciation** lives on **`vocabulary_lemmas`**, because spelling/audio usually applies to the shared form; if you ever need sense-level IPA, add nullable columns on `vocabulary_senses` later.

**TTS vs `audio_url`:** Synteza mówi **w języku lematu** (`pronunciation_text` lub `lemma_text` / `sourceText` w aplikacji), nie w języku glossu. **`audio_url` is not required** — optional (`NULL`). UI: play URL when present; otherwise TTS w locale `source_language_code` lematu.

**Implementation:** `src/services/audio/pronunciationService.ts` uses **`expo-audio`** to play `audioUrl` when set; on failure or when absent it falls back to **`expo-speech`** (TTS). `canPronounce` is true if either URL or TTS text is available.

**Profile vs catalog language pair:** W profilu `sourceLanguage` = język ojczysty, `targetLanguage` = język nauki. W widoku `vocabulary_sense_display` kolumny `source_language_code` / `target_language_code` oznaczają **lemat / gloss**. Zapytania do katalogu używają `getCatalogLanguagePair` (nauka → lemat, ojczysty → gloss), np. PL→EN w profilu → para **en→pl** w bazie przy seedzie angielskim z polskim tłumaczeniem.

**UX (rdzeń produktu):** „Uczę się EN, jestem z PL” → na ekranie głównym **duże** słowo w języku nauki (`sourceText`), **tłumaczenie** po polsku (`targetText`), **wymowa** TTS/audio w języku nauki, **przykłady** w `vocabulary_examples`: `example_source_text` = zdanie w języku nauki, `example_target_text` = tłumaczenie zdania na język ojczysty.

---

## 3. Example: `run` → Polish

| `lemma_text` | `part_of_speech` | `gloss_text` |
|---------------|------------------|--------------|
| run | verb | biegać |
| run | verb | prowadzić |
| run | noun | bieg |

Each row is a **different** `vocabulary_senses` row (distinct `sense_index` / gloss). Examples attach to the sense that matches the meaning.

---

## 4. Multiple language pairs (future scale)

- **Lemma** is always in **one** source language.
- **Senses** are scoped with `target_language_code`.
- To support the same lemma with translations into **several** targets, add **more sense rows** (same `lemma_id`, different `target_language_code`), not more columns.

Import pipelines should treat **(source_lang, lemma, target_lang, gloss, pos, sense_index)** as the natural key for deduplication, in addition to UUIDs.

---

## 5. Legacy table `vocabulary_words`

The existing **`vocabulary_words`** table remains a **flat, backward-compatible** catalog (one row ≈ one card). The app and seeds can keep using it until features move to lemmas/senses.

**`vocabulary_word_sense_links`** is an optional **1:1-style bridge** (`word_id` ↔ `sense_id`) for migrating or enriching imports: one legacy row maps to exactly one sense during a transition. Splitting one legacy row into multiple senses is done by **creating multiple senses** and, if needed, multiple placeholder links or new import rules—not by overloading `target_text`.

---

## 6. UI / API fetching patterns

(See **§10–§12** for fetch checklist, DB→UI mapping, and `VocabularyWord` projection.)

**Per sense (daily card, list row):**

1. Query `vocabulary_sense_display` **or** join `vocabulary_lemmas` + `vocabulary_senses` for: lemma, POS, gloss, CEFR, pronunciation, audio.
2. Query `vocabulary_examples` **where `sense_id = …`**, ordered by `sort_order`.

**Optional aggregate (e.g. detail screen):** `json_agg` examples in SQL or merge in application code.

**Do not** flatten multiple senses into a single string for storage; the client may concatenate for display only.

---

## 7. Importing data (batch order)

Imports must respect **foreign keys** and **uniqueness**:

1. **`languages`** — ensure every `source_language_code` / `target_language_code` you reference exists (seed is in `20260221120000_wordly_initial.sql`).
2. **`vocabulary_lemmas`** — one row per **surface form** in the source language. Respect  
   `unique (source_language_code, lower(trim(lemma_text)))` (see migration). Normalize (trim; decide lowercase policy once for inserts).
3. **`vocabulary_senses`** — one row per **meaning** (pair: lemma + target language + `sense_index`). Trigger enforces **source ≠ target** language on the pair.
4. **`vocabulary_examples`** — rows keyed by **`sense_id`** (examples belong to a meaning, not to the lemma alone).
5. **`deck_senses`** — optional M:N between `decks` and **senses** (same role as deck membership at sense granularity).
6. **`vocabulary_word_sense_links`** — optional bridge from legacy **`vocabulary_words`** rows to a **single** sense during migration.

**Staging / provenance:** for large CSV jobs, a staging table + validation step is still recommended (see `VOCABULARY_DATA.md`). Service-role scripts or SQL Editor — **not** the mobile anon key for bulk writes.

---

## 8. Migration file

Schema + demo seed (EN *run* → PL, three senses + examples):  
`supabase/migrations/20260321100000_vocabulary_lemmas_senses_examples.sql`

Unikalność sensu przy importach z wielu CSV (lemma + para języków + POS + `gloss_text`):  
`supabase/migrations/20260322120000_vocabulary_senses_semantic_unique.sql`

Legacy flat catalog (backward compatible):  
`supabase/migrations/20260221120000_wordly_initial.sql` (`vocabulary_words`)

**Ładowanie dużych list (Oxford, CEFR-J, 10k CEFR):** patrz [VOCABULARY_DATASET_SEEDING.md](./VOCABULARY_DATASET_SEEDING.md) i skrypt `scripts/vocabulary-seed/`.

**RLS + startowy seed EN→PL:** migracja `20260323120000_vocabulary_catalog_rls_writes_and_seed.sql` — zapisy katalogu dla `service_role`, odczyt dla `anon`; przykładowe słowa w bazie po `db push` / wklejeniu migracji w SQL Editor.

---

## 9. Enriching data after import

Enrichment = **updates** and **extra rows**, still without flattening meanings.

| Layer | Fields you can add or refine later |
|--------|-------------------------------------|
| **Lemma** | `pronunciation_text`, `audio_url` (shared across senses of the same form) |
| **Sense** | `gloss_text`, `cefr_level`, `part_of_speech`, `category`, `sense_index` ordering |
| **Example** | More rows per `sense_id`, `sort_order` for ordering |

**Future columns** (optional migration): `data_source`, `license_code`, `source_url` on lemmas/senses for audit — not required for the normalized shape itself.

**Do not** encode multiple glosses or POS in one text field; add or update **sense rows** instead.

---

## 10. Fetching for UI display

**Read paths:**

1. **Per sense (lists, daily card, revision row)**  
   - Query view **`vocabulary_sense_display`** (or join `vocabulary_lemmas` + `vocabulary_senses`).  
   - Returns: lemma text, POS, gloss, CEFR, pronunciation, audio, pair keys.  
   - Reference: `src/services/api/vocabularyApi.ts` → `fetchVocabularySenseDisplay`.

2. **Examples**  
   - `select * from vocabulary_examples where sense_id = $1 order by sort_order`  
   - Multiple examples per sense are expected.

3. **Optional JSON aggregate**  
   - `json_agg` examples in one SQL round-trip for detail screens, or merge in app code.

**Stable identity for progress:** use **`sense_id`** (or your app’s projection id derived from it) as the unit of “known / review”, not `lemma_id` alone.

---

## 11. DB → UI field mapping (no redesign; read model only)

| UI concept | Normalized source |
|------------|-------------------|
| Headword / “word” in the source (L2) language | `vocabulary_lemmas.lemma_text` |
| Translation (target language) | `vocabulary_senses.gloss_text` |
| Part of speech | `vocabulary_senses.part_of_speech` |
| CEFR | `vocabulary_senses.cefr_level` |
| Pronunciation (text) | `vocabulary_lemmas.pronunciation_text` |
| Pronunciation (audio) | `vocabulary_lemmas.audio_url` (optional; TTS can substitute when null — see §2) |
| Example — source sentence | `vocabulary_examples.example_source_text` |
| Example — target sentence | `vocabulary_examples.example_target_text` |

**Rule:** one **sense** = one **gloss** + one **POS** + one **CEFR**; homonyms and multiple verbs are separate **sense rows** (e.g. *run* verb vs *run* noun), not newline-separated strings.

---

## 12. Application projection (`VocabularyWord`)

The app may keep a **flat** TypeScript type for one **learning unit** = **one sense** (plus joined lemma + optional first example). Example mapping:

| `VocabularyWord` field | Typical source |
|------------------------|----------------|
| `id` | **`sense_id`** (recommended) |
| `sourceLanguageCode` | `vocabulary_lemmas.source_language_code` |
| `targetLanguageCode` | `vocabulary_senses.target_language_code` |
| `sourceText` | `lemma_text` |
| `targetText` | `gloss_text` |
| `cefrLevel` | `cefr_level` |
| `exampleSource` / `exampleTarget` | First `vocabulary_examples` row by `sort_order`, or chosen example |
| `pronunciationText` / `audioUrl` | From lemma |

This is a **read model**, not a second database: the canonical truth remains **lemmas + senses + examples** in Supabase.
