import type { QueryClient } from "@tanstack/react-query";

import { getUserProfileSummary } from "@/src/features/achievements/services/achievements.service";
import {
  getLearningTrackProgress,
} from "@/src/features/profile/services/learningProgress.service";
import { getUserProfileSettings } from "@/src/features/profile/services/profile.service";
import { getRevisionHubStats } from "@/src/features/revision/services/revisionRpc.service";
import { createDailyWordCurrentQueryFn } from "@/src/lib/query/dailyWordCurrentQuery";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { staleTimes } from "@/src/lib/query/staleTimes";

/**
 * Warm critical caches after auth + onboarding without blocking the splash transition.
 * Safe to call multiple times; React Query dedupes in-flight identical requests.
 * Tab `useFocusEffect` paths use `refetchIfStaleNotFetching` so focus does not stack
 * a second request while mount/prefetch is already fetching the same queryKey.
 */
export async function prefetchAppShellData(queryClient: QueryClient): Promise<void> {
  const started = Date.now();
  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.profile.settings,
      queryFn: getUserProfileSettings,
      staleTime: staleTimes.profileSettings,
    });

    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.dailyWord.current,
        queryFn: createDailyWordCurrentQueryFn(queryClient),
        staleTime: staleTimes.dailyWordCurrent,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.learning.trackProgress,
        queryFn: getLearningTrackProgress,
        staleTime: staleTimes.learningTrackProgress,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.revision.hubStats,
        queryFn: getRevisionHubStats,
        staleTime: staleTimes.revisionHubStats,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.profile.summary,
        queryFn: getUserProfileSummary,
        staleTime: staleTimes.profileSummary,
      }),
    ]);

    if (__DEV__) {
      console.log(
        `[wordly][data] prefetch_app_shell ok (${Date.now() - started}ms)`,
      );
    }
  } catch (e) {
    if (__DEV__) {
      console.warn(
        `[wordly][data] prefetch_app_shell failed (${Date.now() - started}ms)`,
        e,
      );
    }
  }
}
