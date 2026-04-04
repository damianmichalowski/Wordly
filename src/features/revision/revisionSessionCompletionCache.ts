import type { QueryClient } from "@tanstack/react-query";

import type { UserProfileSummaryDto } from "@/src/features/achievements/services/achievements.service";
import { queryKeys } from "@/src/lib/query/queryKeys";

/** After daily review completion RPC — merge streak into `profile.summary` so UI matches server without waiting for refetch. */
export function mergeDailyReviewStreakIntoSummaryCache(
  queryClient: QueryClient,
  streak: {
    currentDailyReviewStreak: number;
    longestDailyReviewStreak: number;
  },
): void {
  queryClient.setQueryData<UserProfileSummaryDto | undefined>(
    queryKeys.profile.summary,
    (old) => {
      if (!old) {
        return {
          knownWordsCount: 0,
          currentDailyReviewStreak: streak.currentDailyReviewStreak,
          longestDailyReviewStreak: streak.longestDailyReviewStreak,
          memberSince: "",
          email: null,
        };
      }
      return {
        ...old,
        currentDailyReviewStreak: streak.currentDailyReviewStreak,
        longestDailyReviewStreak: streak.longestDailyReviewStreak,
      };
    },
  );
}
