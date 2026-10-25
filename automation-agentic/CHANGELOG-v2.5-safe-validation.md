# Wordly Automation Agentic v2.5 — safe validation update

## Co poprawiono

- Wyłączono domyślny automatyczny repair finalnego batcha po walidacji.
- Problem: tani `json_repair` potrafił przepisać cały batch i zepsuć `examples`, przez co z 1 błędu robiło się kilkadziesiąt błędów `exactly 2 examples required`.
- Teraz, gdy finalny batch nie przejdzie walidacji:
  - import do Supabase jest pomijany,
  - batch nie jest zapisywany do `datasets/json`,
  - CSV nie trafia do `datasets/category` ani `datasets/cefr`,
  - pliki diagnostyczne są zapisywane w `datasets/reports` jako `.invalid.*`,
  - numeracja kolejnych batchy nie jest zanieczyszczana przez nieudany plik.

## Opcjonalny tryb repair

Można ręcznie włączyć dawny tryb przez:

```bash
WORDLY_ENABLE_FINAL_JSON_REPAIR=true npx tsx automation-agentic/scripts/automation-full.ts category --category business --import
```

Repair jest teraz ostrożniejszy: zapisuje batch przed/po naprawie i akceptuje wynik tylko wtedy, gdy zmniejsza liczbę błędów albo całkowicie przechodzi walidację.

## Zalecenie

Domyślnie zostaw repair wyłączony. Jeśli walidacja padnie, lepiej wygenerować batch ponownie niż pozwolić małemu modelowi przepisać cały batch językowy.
