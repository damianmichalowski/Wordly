# Wordly Agentic Automation v2.2

## Najważniejsze poprawki

- Naprawiono krytyczny problem z deduplikacją DB: Supabase REST domyślnie zwracało maksymalnie 1000 wierszy, więc lista `Exclusions` była ucięta do 1000 lemma.
- `loadExistingLemmas()` pobiera teraz wszystkie aktywne lemma stronicowaniem `limit/offset`, więc planner nie powinien wybierać słów istniejących poza pierwszą stroną API.
- `getCefrCoverage()` też korzysta z paginacji, żeby liczenie poziomów było odporne przy większych poziomach.
- Usunięto drobną duplikację deklaracji w `runner.ts`.
- Terminal po poprawce powinien pokazywać realną liczbę global exclusions, np. `Exclusions: 1700+ global lemma`, a nie sztuczne `1000`.

## Efekt praktyczny

Problem typu:

```txt
Import: +4 words, skipped=26
Exclusions: 1000 global lemma
```

powinien spaść znacząco, bo candidate planner będzie znał pełny stan DB przed wyborem lemma.
