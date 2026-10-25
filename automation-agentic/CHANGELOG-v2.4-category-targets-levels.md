# Wordly automation-agentic v2.4 — category targets + level profiles

## Added

- Category-specific `target_words` in `config/category.json`.
- Category-specific CEFR distribution rules via `level_distribution`.
- Category-specific vocabulary mix via `mix.core`, `mix.adjacent`, `mix.specialized`.
- Category-specific prompt fields: `profile`, `prefer`, `avoid`, `level_policy`, `notes`.
- `src/pipeline/categorySettings.ts` helper for resolving category config consistently across runner, coverage and prompts.

## Changed

- Category target calculation now supports both old format:

```json
"travel": 100
```

and new format:

```json
"travel": {
  "target_words": 120,
  "level_distribution": { "A1": 18, "A2": 27, "B1": 33, "B2": 20, "C1": 2, "C2": 0 }
}
```

- `automation-full.ts category` now reads `target_words` from the new category config.
- `category-coverage.ts` now prints targets from the new category config.
- Lemma planner and sense explorer now receive category-level rules in the prompt, so `travel`, `law`, `software_development`, etc. can have different difficulty profiles.

## Recommended defaults

- `travel`: 120 words, mostly A2-B1 with useful B2 and almost no C1/C2.
- `law`: 180 words, mostly B2-C1, with more specialized legal vocabulary.
- `software_development`: 180 words, mostly B1-C1.
- `business` / `finance`: 150 words.
- `health` / `education`: 120 words.
- `trading`: 160 words.

## Clean package

Generated datasets, previews, reports, intermediate files, local cache, candidate banks and registry contents were removed from this package.
