# vocabulary-seed

Skrypt łączy CSV z list słów (CEFR-J OLP, Oxford, 10k CEFR…) z plikiem tłumaczeń EN→PL i generuje SQL dla `vocabulary_lemmas` / `vocabulary_senses`.

Pełna instrukcja: [`docs/VOCABULARY_DATASET_SEEDING.md`](../../docs/VOCABULARY_DATASET_SEEDING.md).

**Duży zestaw (FreeDict + CEFR-J):**

```bash
npm run vocabulary:seed:freedict -- --limit 10000   # domyślnie; lżejszy SQL
npm run vocabulary:seed:freedict -- --all           # ~39k sensów, pełny słownik z XML
```

Szczegóły licencji: `third-party/FREEDICT_ENG_POL.md`.

---

Szybki test na przykładowych plikach:

```bash
npm run vocabulary:seed -- \
  --cefrj scripts/vocabulary-seed/sample-data/cefrj-vocabulary-profile-1.5.sample.csv \
  --translations scripts/vocabulary-seed/sample-data/en-pl.example.csv \
  --source-lang en --target-lang pl \
  --out supabase/seeds/generated/wordly_seed.sample.sql
```

`data/raw/` — tutaj lokalnie trzymaj pobrane pełne CSV (Oxford itd.); nie commituj plików z ograniczeniami licencyjnymi.
