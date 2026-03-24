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

## Phase 8 (native)

Implemented for **iOS**: `targets/widget/` (WidgetKit) + **`src/features/wordly-widget-bridge`** writes `getWidgetSurfaceSnapshot()` JSON to the App Group and reloads timelines. **Android** stores the same JSON in `SharedPreferences` for a future `AppWidget`.

Details: **`docs/PHASE_8_NATIVE_WIDGETS.md`**, root **`README.md`** (build commands).
