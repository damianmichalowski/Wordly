# CHANGELOG v2.3 — Category Flow Upgrade

## Najważniejsze zmiany

### 1. Category coverage-aware automation
`automation-full.ts` obsługuje teraz oba tryby:

```bash
npx tsx automation-agentic/scripts/automation-full.ts cefr --level B2 --import
npx tsx automation-agentic/scripts/automation-full.ts category --category travel --import
```

W trybie `category` runner:
- sprawdza aktualną liczbę aktywnych słów przypiętych do kategorii,
- liczy `missing_words` względem targetu z `config/category.json`,
- zmniejsza batch size do brakującej liczby słów,
- importuje batch,
- ponownie sprawdza coverage,
- powtarza do targetu albo do `--max-batches`.

### 2. Category dedupe działa per kategoria, nie globalnie
Dla CEFR dedupe nadal jest globalny po wszystkich istniejących lemma w target language.

Dla category zmiana jest celowa:
- wykluczane są tylko lemma już przypięte do tej kategorii,
- istniejące lemma z DB bez tej kategorii mogą zostać wybrane,
- importer wtedy tylko dopina `word_category`, bez duplikowania słowa i senses.

To rozwiązuje problem, w którym najlepsze słowa typu `hotel`, `ticket`, `contract`, `claim`, `invoice` były blokowane, bo istniały już w CEFR.

### 3. Category profiles z większym udziałem specialized vocabulary
Prompt ma teraz profile dla kategorii:
- `travel`
- `law`
- `business`
- `technology`
- `software_development`
- `finance`
- `trading`
- `health`
- `education`

Specialized vocabulary zostało zwiększone z wcześniejszych ~10% do zwykle 20–35%, zależnie od kategorii.

Przykłady:
- `law`: 30% specialized legal vocabulary,
- `software_development`: 30% specialized software vocabulary,
- `trading`: 35% specialized trading vocabulary,
- `business/finance/technology`: 25%,
- `travel/health/education`: 20%.

### 4. Category prompt jest profilowany po intencji usera
Prompt nie traktuje już wszystkich kategorii tak samo.

Przykłady:
- `travel` ma pomagać w realnym podróżowaniu: lotnisko, bilety, hotel, opóźnienia, bagaż, rezerwacje, problemy.
- `law` ma pomagać w pracy i dokumentach prawnych: court, claim, evidence, hearing, contract, liability, clause, appeal.
- `software_development` ma pomagać w pracy dev: deploy, branch, merge, endpoint, dependency, environment, release.

### 5. Registry scoped per category
Lokalny registry nie blokuje już tej samej lemma w innych kategoriach.
Dla category zapis idzie pod kluczem:

```txt
category:<category>:<lemma>
```

Dzięki temu jedno słowo może być później legalnie przypięte do kilku kategorii.

### 6. Nowy pomocniczy skrypt coverage
Dodany został:

```bash
npx tsx automation-agentic/scripts/category-coverage.ts
npx tsx automation-agentic/scripts/category-coverage.ts --category travel
```

Zwraca JSON z:
- `current_words`,
- `target_words`,
- `missing_words`,
- `done`.

### 7. Paczka wyczyszczona z wygenerowanych danych
Usunięto stare wygenerowane:
- JSON/CSV,
- previews,
- reports,
- intermediate,
- candidate banks,
- cache,
- local registry.

Zostawione są tylko `.gitkeep`, config i kod.
