import type { QueryClient } from "@tanstack/react-query";

import {
  getUserAchievementsList,
  getUserProfileSummary,
} from "@/src/features/achievements/services/achievements.service";
import {
  getLearningTrackProgress,
} from "@/src/features/profile/services/learningProgress.service";
import { getRevisionHubStats } from "@/src/features/revision/services/revisionRpc.service";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { staleTimes } from "@/src/lib/query/staleTimes";

/**
 * After `mark_word_known_and_advance_daily_word`: background-warm caches used by
 * Revision Hub, Settings summary, and (optionally) achievements.
 *
 * Does **not** prefetch `library.allKnownWords` — `patchLibraryCacheAfterMarkKnown` owns
 * immediate list consistency; a full list prefetch here would replace that cache.
 *
 * Pairs with `invalidateAfterDailyWordMarkedKnown` (stale-only). React Query dedupes
 * in-flight requests with the same key (e.g. hub prefetch + focus refetch).
 */
export async function warmCachesAfterDailyWordMarkedKnown(
  qc: QueryClient,
  opts?: { prefetchAchievements?: boolean },
): Promise<void> {
  const prefetchAchievements = opts?.prefetchAchievements === true;
  const tasks: Promise<unknown>[] = [
    qc.prefetchQuery({
      queryKey: queryKeys.revision.hubStats,
      queryFn: getRevisionHubStats,
      staleTime: staleTimes.revisionHubStats,
    }),
    qc.prefetchQuery({
      queryKey: queryKeys.profile.summary,
      queryFn: getUserProfileSummary,
      staleTime: staleTimes.profileSummary,
    }),
  ];
  if (prefetchAchievements) {
    tasks.push(
      qc.prefetchQuery({
        queryKey: queryKeys.achievements.list,
        queryFn: getUserAchievementsList,
        staleTime: staleTimes.achievementsList,
      }),
    );
  }
  try {
    await Promise.all(tasks);
  } catch {
    // Best-effort; offline is OK — tab focus will refetchIfStaleNotFetching.
  }
}

/**
 * After completing a **Daily Review** session (online): warm hub stats, summary, learning
 * track, and achievements. Does **not** prefetch the library list — session completion does not
 * change `known_at` / membership returned by `get_library_words` (see
 * `invalidateAfterDailyReviewSessionComplete`). Pairs with that invalidation; dedupes with active refetches.
 */
export function warmCachesAfterDailyReviewSessionComplete(qc: QueryClient): void {
  void Promise.all([
    qc.prefetchQuery({
      queryKey: queryKeys.revision.hubStats,
      queryFn: getRevisionHubStats,
      staleTime: staleTimes.revisionHubStats,
    }),
    qc.prefetchQuery({
      queryKey: queryKeys.profile.summary,
      queryFn: getUserProfileSummary,
      staleTime: staleTimes.profileSummary,
    }),
    qc.prefetchQuery({
      queryKey: queryKeys.learning.trackProgress,
      queryFn: getLearningTrackProgress,
      staleTime: staleTimes.learningTrackProgress,
    }),
    qc.prefetchQuery({
      queryKey: queryKeys.achievements.list,
      queryFn: getUserAchievementsList,
      staleTime: staleTimes.achievementsList,
    }),
  ]).catch(() => {
    // Best-effort background warm.
  });
}
