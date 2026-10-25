# Wordly Automation Agentic v2.1

## Najważniejsze poprawki

- Fixed CEFR search pressure: search mode is now based on active words in the current CEFR level, not on global excluded lemmas.
- Split terminal metrics clearly:
  - level coverage, e.g. `B2 coverage: 690/800`
  - global exclusions, e.g. `Exclusions: 1707 global lemma`
- Reduced candidate-bank overbuilding:
  - smaller reserve targets
  - fewer refill attempts
  - smaller refill chunks outside true last-mile mode
- Simplified terminal logs:
  - concise default output
  - detailed refill/usage logs only with `--verbose`
- Import summary now includes skipped existing lemmas preview.
- Local registry log now clearly distinguishes generated lemmas from real DB inserts.
- Fixed misleading prompt wording that mentioned B1 inside generic frontier/exhaustive search.

## Useful env overrides

```bash
WORDLY_CANDIDATE_RESERVE_TARGET=120
WORDLY_CANDIDATE_REFILL_CHUNK=70
WORDLY_CANDIDATE_REFILL_MAX_ATTEMPTS=4
```

Use `--verbose` if you want the old detailed diagnostic view.
