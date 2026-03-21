# Wordly app architecture (Phase 1)

This folder contains shared product logic and infrastructure that is independent from screen rendering.

## Planned structure

- `features/` screen-facing feature modules (onboarding, dailyWord, revision, settings, audio)
- `domain/` pure business logic (level mapping, selection logic, progress rules)
- `services/` integrations (api, storage, widgets, audio)
- `lib/` external clients (Supabase)
- `hooks/` reusable app hooks
- `types/` domain and API types
- `constants/` app constants
- `platform/` iOS/Android specific contracts for external surfaces
