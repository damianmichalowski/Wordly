# Screen state architecture (post–view-model cleanup)

Concise map of how major tabs separate **data source**, **business**, and **UI** concerns. See also [`ASYNC_UI_STATE.md`](./ASYNC_UI_STATE.md) for transport vs business semantics.

## Layers (mental model)

1. **Data source** — React Query: `isFetched`, `isSuccess`, `isError`, `data`, `isFetching`, cache / `placeholderData`.
2. **Business** — Confirmed facts only (e.g. `onboardingRequiredConfirmed` = `isSuccess && data === null`, `confirmedNoDailyWord`, RPC-backed empty track).
3. **UI** — Skeletons, `TransportRetryMessage`, `CenteredMessageCta`, centered vs full-bleed layout — driven by normalized **`viewKind`** / **`panel`** / **`view`** from screen hooks, not raw query flags alone.

## Shared profile gate

**`useProfileSettingsGate`** (`src/features/profile/hooks/useProfileSettingsGate.ts`) — single `profile.settings` query and derived flags used anywhere a tab must match Settings-style semantics: resolved fetch, onboarding required, blocking error without cache.

Revision Hub and Library both use it; they do **not** share session or list state.

## Home (Daily Word)

- **Orchestrator:** `useHomeScreenData` → normalized **`view`** (`celebrate` vs `main` + `mainPanel`).
- **Daily fetch:** `useDailyWord` — cache-first (`keepPreviousData`), explicit `loadFailed` / `confirmedNoDailyWord` / transport retry.

## Revision Hub vs Library

| Concern | Revision Hub | Library |
|--------|--------------|---------|
| Hook | `useRevisionHubSession` + `useRevisionHubScreenData` | `useLibraryScreenData` |
| Data | Hub stats RPC, profile summary (streak), session word fetch | `library.allKnownWords` query, sort prefs (AsyncStorage) |
| Session UI | Flashcards, completion, `viewKind` for hub branches | None — browse / filters / open word details |
| Top-level UI branch | `computeRevisionHubTabViewKind` → `viewKind` | `computeLibraryTabViewKind` → `viewKind` |

**`useRevisionHubSession`** composes: profile gate, hub/summary queries, in-memory session state, and delegates pure derivations to `revisionHubSessionDerived.ts` and word mapping to `utils/revisionSessionWordMap.ts`.

**`useLibraryScreenData`** composes: same profile gate, library list query, sort prefs — no flashcard state.

Cross-tab **`refresh`** invalidates settings, hub stats, summary, and library list so recovery from errors stays consistent when switching tabs.

## Settings

- **`useSettings`** exposes **`viewKind`**: blocking load error vs onboarding vs main form (skeleton/stuck still inside `main`).

## Word Details

- **`useWordDetailsScreenData`** → **`computeWordDetailsScreenPanel`**: invalid id vs loading shell vs error vs content (cache wins over error when placeholder exists).

## Mutations

User-triggered flows must end in success, controlled failure, or retry — never infinite pending (e.g. daily “mark known” clears flow flag in `finally`; hub session completion uses `sessionCompleteInFlightRef`).
