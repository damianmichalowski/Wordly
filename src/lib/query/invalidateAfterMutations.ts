import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/src/lib/query/queryKeys";

const staleOnly = { refetchType: "none" as const };

type ProfileSettingsInvalidationOpts = {
  /**
   * Callers that already `setQueryData(profile.settings, saved)` (e.g. save success)
   * can skip re-invalidating settings to avoid a redundant refetch and one-frame loading churn.
   */
  skipSettingsQuery?: boolean;
};

/**
 * After profile/settings change or onboarding completion.
 * Broad invalidation is appropriate: tor / języki / dzienne słowo muszą się zsynchronizować.
 */
export function invalidateAfterProfileOrSettingsChange(
  qc: QueryClient,
  opts?: ProfileSettingsInvalidationOpts,
) {
  if (!opts?.skipSettingsQuery) {
    qc.invalidateQueries({ queryKey: queryKeys.profile.settings });
  }
  qc.invalidateQueries({ queryKey: queryKeys.profile.summary });
  qc.invalidateQueries({ queryKey: queryKeys.learning.trackProgress });
  qc.invalidateQueries({ queryKey: queryKeys.learning.optionsProgress });
  qc.invalidateQueries({ queryKey: queryKeys.onboarding.options });
  qc.invalidateQueries({ queryKey: queryKeys.dailyWord.all });
  qc.invalidateQueries({ queryKey: queryKeys.revision.hubStats });
  qc.invalidateQueries({ queryKey: queryKeys.library.allKnownWords });
  qc.invalidateQueries({ queryKey: queryKeys.achievements.list });
}

/**
 * After `mark_word_known_and_advance_daily_word`.
 *
 * - **Do not** invalidate `dailyWord.current`: `useDailyWord` already writes the next row via
 *   `setQueryData` (single source of truth; avoids duplicate get_or_create + get_word_details).
 * - **Do not** touch `profile.settings`: znane słowo nie zmienia języków / trybu nauki.
 * - **Learning** (`trackProgress` + `optionsProgress` dla pasków w Ustawieniach): odświeżane
 *   w `useDailyWord` przez `fetchQuery` (bez dodatkowego `refetchQueries` na tor).
 * - **Stale-only (no background network)**: hub, biblioteka, podsumowanie, trofea, podgląd
 *   dziennego słowa tylko do odczytu — odświeżą się przy wejściu na zakładkę / focus.
 */
export function invalidateAfterDailyWordMarkedKnown(qc: QueryClient) {
  qc.invalidateQueries({
    queryKey: queryKeys.revision.hubStats,
    ...staleOnly,
  });
  qc.invalidateQueries({
    queryKey: queryKeys.library.allKnownWords,
    ...staleOnly,
  });
  qc.invalidateQueries({
    queryKey: queryKeys.profile.summary,
    ...staleOnly,
  });
  qc.invalidateQueries({
    queryKey: queryKeys.achievements.list,
    ...staleOnly,
  });
  qc.invalidateQueries({
    queryKey: queryKeys.dailyWord.readOnlyDetails,
    ...staleOnly,
  });
}

/**
 * Po ukończeniu sesji z Revision Hub (np. Daily Review): zmieniają się liczniki / streak w hubie.
 * `profile.settings` nie jest dotykane — to nie zmiana preferencji użytkownika.
 */
export function invalidateAfterRevisionSessionComplete(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: queryKeys.revision.hubStats });
  qc.invalidateQueries({ queryKey: queryKeys.learning.trackProgress });
  qc.invalidateQueries({
    queryKey: queryKeys.profile.summary,
    ...staleOnly,
  });
  qc.invalidateQueries({
    queryKey: queryKeys.achievements.list,
    ...staleOnly,
  });
  qc.invalidateQueries({
    queryKey: queryKeys.library.allKnownWords,
    ...staleOnly,
  });
}
