# External surface contract (Phase 7)

This project keeps widget logic separate from app screens.

## Shared source of truth

- Canonical state: daily word snapshot (`stateVersion`, `updatedAt`, active word)
- Shared service: `src/services/widgets/widgetSurfaceService.ts`
- Shared deep links: `src/services/widgets/deepLinks.ts`

## App <-> widget sync rules

- Widget reads `getWidgetSurfaceSnapshot()`.
- Widget actions use `applyWidgetAction({ action, expectedStateVersion })`.
- If state version is stale, result status is `stale` and caller should refresh snapshot before retry.
- Actions are idempotent because daily-word domain actions are idempotent.

## Privacy-ready payload

- Snapshot can hide translation (`targetText: null`) for lock screen surfaces.
- Surface can request reveal only when product setting allows it.

## Native bridge direction

- iOS/Android native widget modules should consume only these service contracts.
- Native layers must not reimplement daily selection logic.

## Phase 8 (native implementation plan)

See **`docs/PHASE_8_NATIVE_WIDGETS.md`** for:

- Expo development builds vs Expo Go
- iOS WidgetKit + App Groups + App Intents
- Android AppWidget + shared storage + refresh
- Bridge strategy: JS snapshot → native shared store → widget UI
- Step-by-step checklist before writing Swift/Kotlin
