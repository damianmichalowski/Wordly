# Seedowanie słownictwa z CSV (Oxford, CEFR-J, 10k CEFR, Words-CEFR…)

Ten dokument opisuje **jak łączyć zewnętrzne listy słów** z modelem `vocabulary_lemmas` → `vocabulary_senses` w Supabase, tak aby:

- **nie duplikować** tego samego sensu (ten sam lemat + język docelowy + **ta sama część mowy** + **to samo tłumaczenie**),
- **rozróżniać znaczenia** (np. *about* jako **adverb** vs **preposition**, *run* jako dwa czasowniki z różnymi polskimi glossami),
- scalać **CEFR** z wielu źródeł według **priorytetu źródła** (np. Oxford wyżej niż CEFR-J).

**Uwaga licencyjna:** list **Oxford 3000 / 5000** nie wolno commitować do repozytorium — pobierz je samodzielnie i trzymaj lokalnie w `scripts/vocabulary-seed/data/raw/` (katalog ignorowany przez git). Inne zbiory często mają licencje CC-BY lub „research use” — zawsze sprawdź plik `LICENSE` / stronę projektu.

---

## 1. Indeks unikalny w bazie (deduplikacja sensów)

Migracja:

`supabase/migrations/20260322120000_vocabulary_senses_semantic_unique.sql`

Dodaje indeks:

`(lemma_id, target_language_code, lower(part_of_speech), lower(gloss_text))`

Dzięki temu drugi import z innego CSV **nie wstawi** drugi raz identycznego tłumaczenia dla tego samego sensu.

---

## 2a. Duży import EN→PL z FreeDict (~10k+ sensów, licencja GPL/GFDL)

Słownik **FreeDict eng-pol** (XML z GitHub) + poziomy CEFR z **CEFR-J** (tam gdzie pasuje `lemma`+POS), w przeciwnym razie **B1**.

```bash
# w katalogu głównym repozytorium
# Wymaga pliku CEFR-J w data/raw (lub podaj --cefrj):
# curl -o scripts/vocabulary-seed/data/raw/cefrj-vocabulary-profile-1.5.csv \
#   https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv

npm run vocabulary:seed:freedict -- --limit 10000
# albo całość FreeDict po deduplikacji (~39k sensów, większy plik):
npm run vocabulary:seed:freedict -- --all
```

- **`--limit N`** — opcjonalny sufit (domyślnie 10000), żeby pierwszy import był lżejszy dla SQL Editor i szybszy.
- **`--all`** — bez obcinania: wszystkie unikalne sensy z XML (~39k), plik SQL ~15 MB.
- Pierwsze uruchomienie **ściąga** `eng-pol/letters/a.xml` … `z.xml` do `data/raw/freedict-eng-pol/` (w `.gitignore`).
- Wynik: domyślnie `wordly_freedict_10k.sql` lub przy `--all` → `wordly_freedict_full.sql`.
- **SQL Editor ma limit rozmiaru zapytania** — dla pełnego pliku użyj **podziału na części**, potem wklejaj po kolei w edytorze:

```bash
npm run vocabulary:seed:split-sql -- \
  --in supabase/seeds/generated/wordly_freedict_full.sql \
  --out-dir supabase/seeds/generated/freedict_chunks \
  --chunk 500
```

Pliki `wordly_freedict_full.part001.sql`, `part002.sql`, … uruchamiaj **po kolei** (cały plik = jedno Run), **albo** zrób to automatycznie:

```bash
# W `.env` w katalogu głównym repo: URI z Supabase → Database → Connection string + ?sslmode=require (node-pg).
#
# IPv4 (typowa sieć domowa): **Session pooler** — user `postgres.<ref>`, host `…pooler.supabase.com`,
# port jak w panelu (często 5432), pool_mode session. Nie direct `db.*`.
# Na IPv6 możesz użyć Direct connection; albo IPv4 add-on dla direct.
# DATABASE_URL=postgresql://postgres.[REF]:HASŁO@aws-1-eu-west-3.pooler.supabase.com:5432/postgres?sslmode=require
#
# Skrypt wczytuje `.env` i przy hoście `db.*` wymusza IPv4 (DNS), żeby uniknąć ECONNREFUSED na IPv6.
export DATABASE_URL="postgresql://postgres.[REF]:HASŁO@aws-1-eu-west-3.pooler.supabase.com:5432/postgres?sslmode=require"
npm run vocabulary:seed:apply-chunks

# Wznowienie od np. part033 (pomija part001–032):
# npm run vocabulary:seed:apply-chunks -- --from-part 33
```

Opis: `supabase/seeds/generated/freedict_chunks/README.md`.
- **Licencja / atrybucja:** [scripts/vocabulary-seed/third-party/FREEDICT_ENG_POL.md](../scripts/vocabulary-seed/third-party/FREEDICT_ENG_POL.md).

---

## 2. Skrypt ETL (`scripts/vocabulary-seed`)

### Co robi

1. Wczytuje jeden lub więcej plików **metadanych** (angielski lemat + POS + CEFR), np. format CEFR-J OLP lub ogólny CSV.
2. **Scala** wiersze do jednego wpisu na parę `(lemma, POS)` — przy konflikcie CEFR wygrywa źródło o **wyższym priorytecie** (domyślnie: `oxford5000` > `oxford3000` > `10k_cefr` > `words_cefr` > `cefrj` > `generic`).
3. Łączy z plikiem **tłumaczeń** `headword, pos, gloss_pl` (wiele wierszy dla tego samego `headword+pos` = **wiele znaczeń**).
4. Generuje **SQL** z deterministycznymi UUID (v5), żeby ponowne uruchomienie na tych samych danych dawało te same `id` (`on conflict (id) do nothing`).

### Uruchomienie

```bash
# w katalogu głównym repozytorium
npm install

npx tsx scripts/vocabulary-seed/src/index.ts \
  --cefrj path/to/cefrj-vocabulary-profile-1.5.csv \
  --generic path/to/oxford3000.csv:oxford3000 \
  --translations path/to/en-pl.csv \
  --source-lang en --target-lang pl \
  --out supabase/seeds/generated/wordly_seed.sql
```

- `--cefrj` — można podać **wiele razy**.
- `--generic ścieżka:etykieta` — CSV z nagłówkami (`headword`/`word`/`lemma`, `pos`, `CEFR`/`level`); etykieta służy do **priorytetu** w `DEFAULT_PRIORITY` (patrz `src/index.ts`) lub w pliku `--priorities`.

Wyjście:

- `--out` — plik `.sql`
- obok — `*.report.txt` (np. tłumaczenia bez dopasowania w metadanych)

Skrót npm:

```bash
npm run vocabulary:seed -- \
  --cefrj ... \
  --translations ... \
  --out ...
```

### Przykładowe dane w repozytorium

- `scripts/vocabulary-seed/sample-data/cefrj-vocabulary-profile-1.5.sample.csv` — skrócona lista w stylu CEFR-J OLP.
- `scripts/vocabulary-seed/sample-data/en-pl.example.csv` — przykładowe tłumaczenia PL.
- `supabase/seeds/generated/wordly_seed.sample.sql` — przykładowy wynik (można uruchomić w SQL Editor po migracjach).

---

## 3. Skąd brać pełne zbiory (orientacyjnie)

| Zbiór | Uwagi |
|--------|--------|
| **CEFR-J / Open Language Profiles** | Repozytorium np. [openlanguageprofiles/olp-en-cefrj](https://github.com/openlanguageprofiles/olp-en-cefrj) — plik `cefrj-vocabulary-profile-*.csv` (kolumny `headword`, `pos`, `CEFR`). Cytuj zgodnie z regulaminem TUFS / OLP. |
| **Oxford 3000 / 5000** | Lista słów pod licencją Oxford — **nie redystrybuuj**; pobierz legalnie i zaadaptuj do `--generic` z kolumnami `word`/`lemma`, `pos`, `level`. |
| **Words-CEFR / 10k CEFR Words** | Często na Kaggle / GitHub — każdy plik ma inny układ kolumn; dopasuj nagłówki lub dodaj adapter w `scripts/vocabulary-seed/src/parsers/`. |

---

## 4. Plik tłumaczeń (wymagany do sensów PL)

Listy typu Oxford / CEFR-J podają zwykle **tylko angielski** i CEFR. Pole `gloss_text` w `vocabulary_senses` musi być po **polsku** (dla pary `en` → `pl`).

Minimalny format:

```csv
headword,pos,gloss_pl
run,verb,biegać
run,verb,prowadzić
run,noun,bieg
```

- Ten sam `headword` + `pos` w **wielu wierszach** = **wiele znaczeń** (różne `gloss_pl`).
- `pos` musi być rozpoznawalny przez mapowanie w `posMap.ts` (`verb`, `noun`, `adjective`, `preposition`, …).

Możesz budować ten plik z:

- słownika offline (Wiktionary dump),
- eksportu z narzędzia tłumaczeniowego (zgodnie z regulaminem),
- ręcznej kuracji.

---

## 5. Priorytety źródeł (JSON opcjonalny)

Domyślne wartości są w `scripts/vocabulary-seed/src/index.ts` (`DEFAULT_PRIORITY`).

Nadpisanie:

```bash
--priorities scripts/vocabulary-seed/my-priorities.json
```

```json
{
  "oxford3000": 95,
  "cefrj": 50,
  "moj_plik": 80
}
```

Przy tym samym `(lemma, POS)` z dwóch plików **wyższy priorytet** ustala **CEFR** przy konflikcie; przy niższym priorytecie CEFR jest **łączony** z trudniejszym poziomem (`pickHarderCefr`).

---

## 6. RLS — kto może dopisywać słowa

- **`anon` (klucz w aplikacji mobilnej):** tylko **SELECT** katalogu — użytkownicy **nie** dodają słów z klienta.
- **`service_role` (sekretny klucz — tylko backend / skrypty):** pełne **INSERT/UPDATE/DELETE** na `vocabulary_*` (polityki w migracji `20260323120000_vocabulary_catalog_rls_writes_and_seed.sql`). Klucz **service_role** w Supabase i tak omija RLS — jawne `policy` dokumentują model i zabezpieczają narzędzia, które nie bypassują RLS.
- **SQL Editor w Dashboard** (rola `postgres`): migracje i ręczne `INSERT` działają (superuser omija RLS).

Większy import: wygeneruj SQL z `npm run vocabulary:seed`, wklej w **SQL Editor** w transakcji lub użyj `supabase db push` po dodaniu pliku migracji.

## 7. Zastosowanie SQL w Supabase

1. **Dashboard → SQL → New query** — wklej kolejne migracje z `supabase/migrations/` (lub `supabase db push` z CLI).
2. Migracja `20260323120000_vocabulary_catalog_rls_writes_and_seed.sql` dodaje polityki RLS dla `service_role` oraz **startowy seed** EN→PL (~21 lematów, 25 sensów).

Na produkcji rozważ **batchowanie** bardzo dużych plików lub `COPY` — dla ~10k wierszy zwykły INSERT w transakcji (`begin`/`commit` w pliku) jest zwykle OK.

---

## 8. Powiązanie z dokumentacją modelu

Szczegóły relacyjne: [VOCABULARY_ARCHITECTURE.md](./VOCABULARY_ARCHITECTURE.md).
