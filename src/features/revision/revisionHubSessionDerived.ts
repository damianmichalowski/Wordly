import type { RevisionHubCounts } from "@/src/features/revision/components/RevisionHub";
import type { RevisionHubStats } from "@/src/features/revision/services/revisionRpc.service";
import type { UserProfileSummaryDto } from "@/src/features/achievements/services/achievements.service";

/** When RPC confirms zero known words in track — unlock CTA, not “loading”. */
export function computeHubUnlockEmptyConfirmed(
  hasProfile: boolean,
  hubStatsFetched: boolean,
  stats: RevisionHubStats | undefined,
): boolean {
  if (!hasProfile || !hubStatsFetched || stats == null) {
    return false;
  }
  return stats.quickPractice.knownCount === 0;
}

export function computeHubLoadError(
  hasProfile: boolean,
  hubStatsFetched: boolean,
  hubStatsIsError: boolean,
): boolean {
  return hasProfile && hubStatsFetched && hubStatsIsError;
}

/**
 * Hub tiles may render only after settings resolved; transport error on settings still allows
 * shell retry paths (matches prior `hubStatsReady` semantics).
 */
export function computeHubStatsReady(
  settingsResolved: boolean,
  settingsFetchError: boolean,
  hasProfile: boolean,
  hubStatsFetched: boolean,
): boolean {
  if (!settingsResolved) {
    return false;
  }
  if (settingsFetchError) {
    return true;
  }
  return !hasProfile || hubStatsFetched;
}

export function selectDisplayHubCounts(
  hasProfile: boolean,
  stats: RevisionHubStats | undefined,
  fallback: RevisionHubCounts,
): RevisionHubCounts {
  if (hasProfile && stats) {
    return {
      daily: stats.dailyRevision.dueCount,
      recent: stats.recentlyLearned.availableCount,
      all: stats.quickPractice.knownCount,
    };
  }
  return fallback;
}

export function selectDailyRevisionCompletedToday(
  hasProfile: boolean,
  stats: RevisionHubStats | undefined,
  fallback: boolean,
): boolean {
  if (hasProfile && stats) {
    return stats.dailyRevision.completedToday;
  }
  return fallback;
}

export function selectCurrentDailyReviewStreak(
  hasProfile: boolean,
  summary: UserProfileSummaryDto | undefined,
  fallback: number,
): number {
  if (hasProfile && summary) {
    return summary.currentDailyReviewStreak;
  }
  return fallback;
}

export function selectLongestDailyReviewStreak(
  hasProfile: boolean,
  summary: UserProfileSummaryDto | undefined,
  fallback: number,
): number {
  if (hasProfile && summary) {
    return summary.longestDailyReviewStreak;
  }
  return fallback;
}
