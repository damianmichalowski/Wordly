# Wordly Automation Agentic v2.5

Osobna paczka do generowania batchy Wordly przez prosty agentic pipeline:

```bash
npx tsx automation-agentic/scripts/automation.ts cefr
npx tsx automation-agentic/scripts/automation.ts category
```

Obsługiwany jest też typo-alias:

```bash
npx tsx automation-agentic/scripts/automation.ts cateogry
```



## v2.5 safe validation update

Finalny `json_repair` jest teraz domyślnie wyłączony, bo potrafił zepsuć poprawne przykłady w całym batchu. Jeśli batch nie przejdzie walidacji, paczka:

- nie importuje go do Supabase,
- nie zapisuje go do `datasets/json`,
- nie zapisuje CSV do `datasets/category` / `datasets/cefr`,
- zapisuje tylko diagnostykę w `datasets/reports/*.invalid.*`.

Dzięki temu failed batch nie blokuje i nie przesuwa kolejnej numeracji batchy. Opcjonalny repair można wymusić przez:

```bash
WORDLY_ENABLE_FINAL_JSON_REPAIR=true npx tsx automation-agentic/scripts/automation-full.ts category --category business --import
```

## v2.1 update

Ta wersja poprawia główny problem z logów: `search mode` i `coverage` są teraz liczone na podstawie realnego coverage aktualnego poziomu CEFR, np. `B2 690/800`, a nie na podstawie globalnej listy wykluczeń. Dzięki temu pipeline nie wpada za wcześnie w tryb `exhaustive`.

Terminal jest teraz prostszy domyślnie. Szczegółowe refill attempts, usage per request i ścieżki pomocnicze zobaczysz po dodaniu:

```bash
npx tsx automation-agentic/scripts/automation.ts cefr --level B2 --import --verbose
```

## Flow

```txt
0. Batch context + exclusions
1. Lemma Planner: lemma + IPA + CEFR
2. Sense Explorer: common senses + POS + translation + examples
3. Deterministic Assembler: final JSON + CSV + validation + preview + usage report
4. Optional Supabase dry import / live import
```

## Modele

Domyślnie:

```txt
lemma_planner  -> gpt-5-mini
sense_explorer -> gpt-5-mini
json_repair    -> gpt-5-nano
```

Czyli główne zadania językowe robi `gpt-5-mini`, a słabszy/tańszy model `gpt-5-nano` jest używany tylko jako fallback do naprawy JSON/schema, jeśli walidacja nie przejdzie.

Możesz nadpisać modele przez env:

```bash
WORDLY_AGENTIC_MODEL_PLANNER=gpt-5-mini
WORDLY_AGENTIC_MODEL_SENSES=gpt-5-mini
WORDLY_AGENTIC_MODEL_REPAIR=gpt-5-nano
```

## Env

Skopiuj:

```bash
cp automation-agentic/.env.example .env
```

Uzupełnij:

```env
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

`OPENAI_API_KEY` jest wymagany do generowania. Supabase env jest potrzebny tylko do DB exclusions / dry import / live import. Bez Supabase możesz użyć:

```bash
npx tsx automation-agentic/scripts/automation.ts cefr --skip-db
```

## Komendy CEFR

```bash
npx tsx automation-agentic/scripts/automation.ts cefr
npx tsx automation-agentic/scripts/automation.ts cefr --level B2
npx tsx automation-agentic/scripts/automation.ts cefr --level B2 --size 30 --batch 2
```

## Komendy Category

```bash
npx tsx automation-agentic/scripts/automation.ts category
npx tsx automation-agentic/scripts/automation.ts category --category business
npx tsx automation-agentic/scripts/automation.ts category --category law --size 30 --batch 3
```

## Import do Supabase

Domyślnie paczka generuje pliki i waliduje, ale nie robi live importu.

Dry import:

```bash
npx tsx automation-agentic/scripts/automation.ts cefr --level B2 --dry-import
```

Live import:

```bash
npx tsx automation-agentic/scripts/automation.ts cefr --level B2 --import
```

Dla category:

```bash
npx tsx automation-agentic/scripts/automation.ts category --category business --dry-import
npx tsx automation-agentic/scripts/automation.ts category --category business --import
```

## Outputy

Po każdym runie dostajesz:

```txt
automation-agentic/datasets/intermediate/<batch-run>/01-lemma-plan.json
automation-agentic/datasets/intermediate/<batch-run>/02-sense-candidates.raw.json
automation-agentic/datasets/intermediate/<batch-run>/02b-sense-candidates-polished.json
automation-agentic/datasets/intermediate/<batch-run>/02b-quality-fixes.json
automation-agentic/datasets/intermediate/<batch-run>/03-final-batch.json

automation-agentic/datasets/json/<batch>.json
automation-agentic/datasets/cefr/<batch>.csv
automation-agentic/datasets/category/<batch>.csv

automation-agentic/datasets/previews/<batch>-preview.md
automation-agentic/datasets/reports/<batch-run>.report.json
automation-agentic/datasets/reports/<batch-run>.usage.json
automation-agentic/datasets/reports/agentic-<run>.log
```

Najważniejszy plik do ręcznego przeglądu:

```txt
automation-agentic/datasets/previews/<batch>-preview.md
```

Tam masz całość batcha w czytelnym Markdownie: lemma, senses, POS, translations, examples, usage, czas response i walidację.

## Logi w terminalu

Logi są celowo nietechniczne:

```txt
🚀 Wordly Agentic Automation v2
ℹ️  Tryb: cefr • level B2
✅ Lista wykluczeń gotowa • 300 lemma
🧠 Step 1/3: wybieram lemma + IPA + level
✅ lemma_planner zakończony • 12.1s • tokens in/out=1200/850 • ~$0.00200
🧠 Step 2/3: szukam common senses, tłumaczeń i przykładów
✅ sense_explorer zakończony • 54.2s • tokens in/out=3000/8000 • ~$0.01675
✅ Quality polish pass • drobne poprawki=2
✅ Zapisano podgląd całości: automation-agentic/datasets/previews/b2_002-preview.md
```

## Token/usage tracker

Każdy request zapisuje:

```json
{
  "step": "sense_explorer",
  "model": "gpt-5-mini",
  "duration_ms": 54200,
  "input_tokens": 3000,
  "output_tokens": 8000,
  "total_tokens": 11000,
  "estimated_cost_usd": 0.01675
}
```

Suma jest w:

```txt
automation-agentic/datasets/reports/*.usage.json
automation-agentic/datasets/reports/*.report.json
```

## Ważne decyzje architektoniczne

- `sense_order` nie pochodzi bezpośrednio z modelu. Model daje kandydatów ze score, a assembler sortuje i nadaje finalne `sense_order`.
- Intermediate format jest celowo krótki tokenowo: `pos`, `tr`, `score`, `ex`.
- Final JSON jest dopiero po assemblerze i ma format zgodny z bazą: `entries → senses → translation → examples`.
- `gpt-5-nano` nie decyduje o jakości językowej; naprawia tylko JSON/schema jako fallback.
- Supabase import jest opcjonalny i domyślnie wyłączony, żeby nie wrzucić danych do DB przypadkiem.

## Struktura folderu

```txt
automation-agentic/
  config/
    cefr.json
    category.json
  scripts/
    automation.ts
  src/
    agent/
    db/
    io/
    pipeline/
    validation/
  datasets/
    json/
    cefr/
    category/
    cache/
    intermediate/
    previews/
    reports/
```

## v2.1 fix: GPT-5 JSON output

Ta wersja używa Responses API + Structured Outputs dla kroków LLM. Dzięki temu Step 1/2/repair nie polega już wyłącznie na promptowym `Return JSON`, tylko dostaje schema bezpośrednio w API.

Dodatkowo każdy request zapisuje surową odpowiedź do:

```txt
automation-agentic/datasets/intermediate/<batch-run>/raw-01-lemma-planner-response.json
automation-agentic/datasets/intermediate/<batch-run>/raw-02-sense-explorer-response.json
automation-agentic/datasets/intermediate/<batch-run>/raw-03-json-repair-response.json
```

Jeżeli model zwróci pusty output albo odpowiedź incomplete, terminal pokaże ścieżkę do raw response.


## Prompt instructions

Główne instrukcje promptów są tutaj:

```txt
automation-agentic/src/pipeline/prompts.ts
```

Najważniejsze ustawienia ilościowe są w:

```txt
automation-agentic/config/cefr.json
automation-agentic/config/category.json
```

### v2.1 prompt tuning

- Lemma planner ma trzymać balans CEFR: około 50% daily-life/communication, 30% work/school/media/general adult life, 20% academic/professional/domain-adjacent.
- Sense explorer mocniej szuka common senses przez różne parts of speech.
- Finalny limit senses podniesiony do 5, żeby wspierać bardzo polisemiczne słowa typu `present`.
- Nawiasy w tłumaczeniach są nadal odradzane, ale dozwolone wyjątkowo, gdy bez nich tłumaczenie byłoby mylące.
- IPA zostaje per lemma, więc model ma wybierać najczęstszą/najmocniejszą wymowę dla lemma.

## v2.2 prompt + assembler tuning

Ta wersja doprecyzowuje jakość danych bez zmiany bazy danych:

- `sense_translation.translation` traktujemy jako **display translation** dla użytkownika, więc kompaktowe warianty typu `dostarczać/zapewniać` lub wyjątkowe nawiasy są dozwolone, jeśli realnie pomagają zrozumieć sens.
- Sense explorer mocniej celuje w **3–5 senses dla common multi-POS lemmas**, gdy znaczenia są praktyczne i rzeczywiście używane.
- Dodany został przykład `present` jako wzorzec bogatego, ale praktycznego multi-POS coverage: noun, adjective, verb.
- Dodano twardą regułę: **nie tworzyć senses z derived words**. Przykład: `arrange` nie może dostać noun sense opartego na `arrangement`; `arrangement` to osobne lemma.
- Assembler obniża score candidate, jeśli przykłady nie używają dokładnego lemma ani jego prawdziwej odmiany. Dzięki temu przypadki typu `arrange → arrangement` zwykle odpadają przed finalnym JSON.
- Walidator dodaje warning, jeśli finalny sense wygląda na oparty o słowo pochodne zamiast właściwego lemma.
- CEFR planner ma teraz dokładniejszy balans per level, np. dla B2: 50% daily-life/practical communication, 30% work/media/adult life, 20% abstract/professional vocabulary.

Główne pliki zmian:

```txt
automation-agentic/src/pipeline/prompts.ts
automation-agentic/src/pipeline/assembler.ts
automation-agentic/src/validation/validateBatch.ts
```

## v2.4 notes

- Fix: top-level slash splitting no longer touches slashes inside balanced parentheses, e.g. `uważać (kogoś/coś za)` stays one translation.
- Fix: broken translation fragments with unbalanced parentheses are filtered/validated.
- Fix: assembler deduplicates senses with identical example pairs, so slash-expanded variants do not create multiple senses with the same examples.
- Prompt update: separate different top-level slash meanings only when they can get different examples; gender variants remain allowed as display translations.

## v2.5 update

- Step 2 now owns slash splitting decisions.
- Different top-level slash meanings/actions/roles must be generated as separate candidates with separate examples.
- Gender-only slash variants like `sąsiad/sąsiadka` remain allowed as one display translation.
- If Step 2 cannot produce distinct examples for two translations, it should keep only the strongest translation instead of creating duplicate senses.

## v2.6 update

- Final translations no longer allow top-level comma lists. Do not output `okolica, sąsiedztwo`, `spotkanie, wizyta`, `procedura, procedury`, etc.
- Step 2 must split different useful Polish translations into separate candidates with separate examples, or keep only the strongest translation.
- Top-level slash remains allowed only for gender variants / the same exact masculine-feminine concept, e.g. `sąsiad/sąsiadka`.
- Slash inside balanced parentheses is still safe, e.g. `uważać (kogoś/coś za)`.
- Assembler now also splits top-level comma candidates as a safety net, then deduplicates by example pair.
- Validator now fails final JSON when a translation contains a top-level comma or a non-gender top-level slash.
- Added translation quality rules for recurring weak cases: `priority`, `responsibility`, and `transfer`.
- Added automatic backfill: if filtering leaves fewer entries than requested, the runner generates missing lemmas/senses and appends them until the target size is reached, up to two backfill rounds.


## v2.7 update

- Added a small deterministic **quality polish pass** after Step 2 and before assembler.
- This pass does not call another model, so it adds no tokens/cost.
- It writes both raw and polished sense candidates:

```txt
automation-agentic/datasets/intermediate/<batch-run>/02-sense-candidates.raw.json
automation-agentic/datasets/intermediate/<batch-run>/02b-sense-candidates-polished.json
automation-agentic/datasets/intermediate/<batch-run>/02b-quality-fixes.json
```

- Current polish checks fix recurring small issues such as Polish diacritics (`material dowodowy` → `materiał dowodowy`), obvious false friend translation (`compliment` verb: `gratulować` → `pochwalić`), and a small English grammar issue (`The data justifies` → `The data justify`).
- The core prompt/sense rules from v2.6 are unchanged.


## v2.8 CEFR dedupe / ownership

CEFR generation treats the database as the source of truth. Before generating a CEFR batch, the runner loads **all active lemmas for the target language** from Supabase, regardless of CEFR level, and passes them as exclusions. This prevents the same lemma from appearing in B1 and B2.

Local JSON/CSV/cache files are **fallback only**. You can delete them without breaking dedupe, as long as the database contains the imported words and `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are configured.

Rule: one lemma should belong to exactly one CEFR level, preferably the lowest practical level where the lemma is useful for learners. Do not place an easier B1 lemma into B2 only because it has one more formal sense.

Terminal log for CEFR now says `globalnie dla CEFR` when the DB/global exclusion list is used.

## v2.9 local registry + parenthesis polish

- DB remains the production source of truth for existing lemmas.
- Added a small local generation registry for words generated but not yet imported:

```txt
automation-agentic/datasets/state/generated-lemmas.json
```

This prevents repeated B1/B2 test batches from generating the same lemma before import. You can delete JSON/CSV outputs; the registry keeps temporary generation memory. After live import, DB remains the stronger source of truth.

- CEFR exclusions now combine: DB/cache + local registry.
- Backfill now retries up to 5 rounds and over-generates slightly to reach the requested size after filtering.
- Parentheses were tightened in the quality polish pass:
  - allowed: `pożyczyć (od kogoś)`, `wypożyczyć (z biblioteki)`, `odmówić (czegoś komuś)`, `uważać (kogoś/coś za)`
  - cleaned: `doświadczenie (życiowe/praktyczne)` → `doświadczenie`, `szacunek (przybliżona wartość)` → `szacunek`, `umówić (spotkanie/wizytę)` → `umówić`
- No core sense/CEFR strategy changes from v2.8.

## v2.14 code fix notes

- Sense explorer prompt reset to a shorter, compact instruction set for `gpt-5-mini`.
- Step 2 now explicitly searches for the full useful practical sense set: 1st/2nd/3rd/4th/5th meanings when real and useful, while skipping archaic/dead/awkward dictionary senses.
- Backfill and final assembly now use hard code-level guards against duplicate lemmas in the same batch.
- Planner output is filtered against DB/cache/local registry exclusions in code, not only by prompt.
- Invalid generated lemmas such as glued phrase lemmas (`submitto`, `applyto`) and ordinary preposition collocations are rejected before final output.

## v2.15 prompt85 restore

- Restored the higher-quality prompt from `prompt85score.ts` into `src/pipeline/prompts.ts`.
- Kept the existing agentic mechanics: DB/cache/local-registry exclusions, quality polish pass, assembler guards, validation, and backfill.
- Main change is Step 2 sense-explorer quality: stronger multi-sense search, cross-POS coverage, comma/slash translation splitting rules, exact-lemma examples, and natural Polish translation rules.
- This version intentionally keeps the technical pipeline from `automation-agentic`, but replaces the downgraded prompt layer with the prompt that previously reached the higher quality score.


## Patch: prompt85 + Wordly sense semantics

This package treats `sense` as a Wordly database row for a useful translation/use-case, not only as a completely separate dictionary meaning.

Implemented behavior:
- sense explorer now prefers the most common/practical translation first, then secondary useful translations/use-cases;
- multi-POS coverage is encouraged when useful, e.g. `present` → `prezent`, `teraźniejszość`, `obecny`, `prezentować`;
- IPA remains one value per lemma and the prompt asks for the most standard/common English pronunciation;
- CEFR selection is stricter: if a lemma or sense is uncertain/borderline for the requested level, the model should skip it;
- backfill requests exactly the missing count, e.g. `3` when final batch is `27/30`, and keeps trying up to 5 rounds;
- if the final batch still does not reach the requested size, validation fails and the command exits with an error instead of silently marking a partial batch as successful.

## Full automation per CEFR level

For autopilot generation + import until the selected level reaches its DB target:

```bash
npx tsx automation-agentic/scripts/automation-full.ts cefr --level B2 --import
```

Then manually run the next level when you want:

```bash
npx tsx automation-agentic/scripts/automation-full.ts cefr --level C1 --import
```

What it does:

```txt
1. Checks current DB state for the selected CEFR level
2. Shows friendly progress: e.g. B2 280/800, missing 520
3. Generates one safe batch
4. Imports it to Supabase
5. Checks DB state again
6. Repeats until the level target is reached
```

Business-friendly logs show:

```txt
🚀 Wordly Full Automation • CEFR B2
ℹ️  Cel poziomu B2: 800 słów
ℹ️  Aktualny stan bazy: 280/800 (35%)

🚀 Runda 1
ℹ️  Brakuje jeszcze: 520 słów
ℹ️  Teraz wygeneruję i zaimportuję maksymalnie 30 nowych słów dla B2.
✅ Runda 1 zakończona.
ℹ️  Dodane do bazy w tej rundzie: 30 słów
ℹ️  Stan po imporcie: 310/800 (39%)
ℹ️  Zostało do celu: 490 słów
```

Safety rules:

- requires `--import`, because the DB is the source of truth for coverage;
- refuses `--skip-db`;
- stops if a batch fails validation;
- skips import if validation failed;
- stops if a round does not increase DB coverage, to avoid an infinite loop;
- supports `--max-batches`, useful for testing:

```bash
npx tsx automation-agentic/scripts/automation-full.ts cefr --level B2 --import --max-batches 1
```

## Candidate bank optimization

This package includes a local candidate bank to reduce repeated lemma-planner requests during long CEFR runs.

Location:

```txt
automation-agentic/datasets/candidates/
```

How it works:

1. The pipeline checks the candidate bank for fresh lemmas before calling the lemma planner.
2. If the bank has enough unused candidates, the lemma planner is skipped.
3. If the bank is low, the pipeline performs a larger lemma-only refill and saves accepted candidates locally.
4. The sense explorer is called only for the final selected lemmas, not for the whole candidate pool.
5. Existing DB lemmas, local registry lemmas, current batch lemmas and rejected-in-run lemmas are still filtered by code.

This keeps prompts unchanged while making long automation runs more resistant to large exclusion lists.

## v2.2 adaptive lemma search / last-mile top-up

Lemma planner ma teraz tryby adaptacyjne zależne od pokrycia poziomu CEFR w bazie:

```txt
normal     -> początek poziomu, wybiera najmocniejsze core vocabulary
expanded   -> około 60%+ targetu / ~500+ istniejących lemma, szuka szerzej
frontier   -> około 85%+ targetu / ~700+ istniejących lemma, szuka mniej oczywistych, ale nadal praktycznych B1/B2 lemma
exhaustive -> ostatnie ~25 brakujących słów, tryb last-mile dobijania targetu
```

W terminalu zobaczysz np.:

```txt
Lemma search mode: frontier • coverage=700/800 • remaining=100
lemma_candidate_bank: ... search=frontier, lemma-only pool=120
```

Co robi ten mechanizm:

- zwiększa reserve banku, chunk size i liczbę prób w późnym etapie poziomu,
- dodaje do promptu instrukcje „frontier / last-mile”, żeby model nie powtarzał oczywistych słów,
- kieruje model w stronę bezpiecznych, normalnych base lemma zamiast fake `-able`, glued compounds i artefaktów,
- wydłuża backfill tylko wtedy, gdy batch po filtrach nadal nie ma pełnego target size.

Dodatkowo code-level guard odrzuca typowe błędy generatora: `receiveable`, `replyable`, `arriveer`, `mentionabletest`, `meetingplace`, `chargeable`, `searchable`, `explainable`, `planing`, `-replaced`, glued compounds i invented `-able`.

## Category full automation v2.3

Category mode now works like CEFR full automation, but with category-specific logic:

```bash
npx tsx automation-agentic/scripts/automation-full.ts category --category travel --import
```

Rules:

- category coverage is counted from `word_category` for the selected target language,
- target comes from `config/category.json`,
- batch size is reduced to the remaining missing words,
- existing DB lemmas are allowed if they are not yet attached to this category,
- import attaches `word_category` for existing lemmas and skips duplicating senses,
- local registry is scoped per category, so one lemma can belong to multiple categories.

Useful coverage check:

```bash
npx tsx automation-agentic/scripts/category-coverage.ts --category travel
```

Category profiles now include a stronger specialized vocabulary share, usually 20–35% depending on the category. For example, `law` and `software_development` intentionally include more professional/specialized terms than lifestyle/travel categories.


---

## v2.4 Category targets and level profiles

`config/category.json` now supports different targets and CEFR level rules per category.

Example:

```json
"travel": {
  "target_words": 120,
  "level_distribution": {
    "A1": 18,
    "A2": 27,
    "B1": 33,
    "B2": 20,
    "C1": 2,
    "C2": 0
  },
  "mix": {
    "core": 60,
    "adjacent": 20,
    "specialized": 20
  },
  "profile": "Travel = help the learner travel independently before, during and after a trip.",
  "prefer": ["airport", "flight", "luggage", "booking", "refund", "directions"],
  "avoid": ["poetic travel words", "rare geography terms"],
  "level_policy": [
    "Travel may contain many A1-A2 survival words, but after the first 80-100 words prefer B1-B2 practical terms.",
    "C1-C2 should be almost zero unless the word is highly practical for travel."
  ]
}
```

Legacy format still works:

```json
"travel": 100
```

The automation resolves the final target through `getCategoryTargetWords()`, and both `automation-full.ts category` and `category-coverage.ts` use the same source of truth.
