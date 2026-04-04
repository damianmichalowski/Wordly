# Async UI state (React Query / RPC)

Practical rules so transport failures are never shown as business truth.

## Principles

1. **Business states only after confirmed success**  
   Treat “no row”, “empty list”, “onboarding incomplete”, “track exhausted” as final UI only when the relevant query is **`isSuccess`** (or the RPC returned a definitive payload you map explicitly).  
   **`isFetched` alone is not enough** — a finished fetch can be **`isError`**.

2. **Offline / error is not empty / onboarding**  
   - **`undefined` / missing `data` after `isError`** → network or server failure, not “no data in DB”.  
   - **`null` from a successful RPC** → may mean empty / no profile (business).  
   Do not branch on `if (!data)` or `if (!profile)` without knowing **success vs error**.

3. **Retry must not fall into business-empty**  
   With **`placeholderData` / cached `null`**, a failed refetch can leave **`data === null`** while **`isError`**.  
   “No word today” / “empty library” must require **`isSuccess && …`**, not merely `!data`.  
   Prefer **`loadFailed = isError && !hasDisplayableCachedData`** (or equivalent) over **`isError && data === undefined`**.

4. **Unresolved / loading must not show CTA / empty / locked**  
   Until the first fetch settles (**or** you deliberately show stale cache), use **shell + skeletons** or a single loading surface — not onboarding CTAs, empty states, or unlock prompts.

5. **Cache-first / background refresh**  
   Prefer showing last good data while `isFetching` (e.g. `keepPreviousData`, persisted cache). Avoid swapping the whole screen to a blocking spinner on every focus if data is still fresh (`staleTime` + stale refetch on tab focus).

## Anti-patterns

| Unsafe | Why |
|--------|-----|
| `if (!query.data) showEmpty()` | Collapses error and empty |
| `isFetched && !data` → onboarding | `isFetched` includes **error** |
| `data ?? []` / `count ?? 0` for **gating** | OK for rendering *inside* known-good data; not for deciding success vs failure |
| `if (!items.length)` before **`isSuccess`** | Empty list vs not loaded |

## Safe patterns

- **Onboarding / no profile:** `query.isSuccess && query.data === null` (or your RPC’s explicit empty shape).  
- **Error UI:** `query.isError` when there is nothing valid to show (account for cached stale success).  
- **Loading:** `!query.isFetched && !query.isError` (or `isPending` / feature-specific flags) for initial load.  
- **Lists with errors:** check **`loadError` (or `isError`) before** treating `null` rows as “still loading”.

## References in codebase (current hooks)

| Area | Hooks / helpers |
|------|------------------|
| Profile gate (shared) | `useProfileSettingsGate` — `onboardingRequiredConfirmed`, `settingsFetchError`, `settingsResolved` |
| Daily Word | `useDailyWord` — `confirmedNoDailyWord`, `loadFailed`, displayable word + `keepPreviousData` |
| Settings form | `useSettings` — `blockingLoadError`, `viewKind`, `onboardingRequiredConfirmed` |
| Revision Hub | `useRevisionHubSession` + `useRevisionHubScreenData` — `viewKind` from `computeRevisionHubTabViewKind` |
| Library | `useLibraryScreenData` — `viewKind` from `computeLibraryTabViewKind`; list query separate from hub session |
| Word Details | `useWordDetailsScreenData` — `computeWordDetailsScreenPanel` |
| Achievements list | initial load vs `loadError` ordering (see feature hook) |

Screen-level orchestration and Hub vs Library split: **[`SCREEN_STATE_ARCHITECTURE.md`](./SCREEN_STATE_ARCHITECTURE.md)**.

## Request orchestration (dedupe)

- **Prefetch** (`prefetchAppShellData`) and **screen `useQuery`** share cache keys — RQ **dedupes concurrent** fetches.
- **Focus refetch** on Library / Revision Hub / Home (daily) uses **`refetchIfStaleNotFetching`**: **stale** but **not** if **`isFetching`** already, avoiding mount + focus **double hits** on the same RPC.
- **Settings tab** `refetchQueries({ stale: true, type: 'active' })` only touches **observed** queries, not inactive cache entries.

## Transport UI (retry)

Błędy transportu (sieć / retryable) — jeden komponent: `TransportRetryMessage` (`variant`: `screen` | `embedded` | `hubBanner`), wspólny copy w `transportRetry.constants.ts`, `isRetrying` z `query.isFetching` przy `isError`, żeby retry nie wyglądał „na martwo”.

Długie wiszące żądania (np. offline bez szybkiego `isError`): `useStuckLoading` + `STUCK_LOADING_MS` — po czasie ten sam komunikat + retry w treści (nagłówek / shell zostaje).
