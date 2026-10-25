import type { RevisionSessionCompletionStats } from "@/src/types/revisionSession";

/** Builds Expo Router params for `/revision-session-complete`. */
export function buildRevisionSessionCompleteParams(
  stats: RevisionSessionCompletionStats,
): Record<string, string> {
  const dr = stats.dailyReviewCompletion;
  const pending = dr?.pendingEvents ?? [];
  const streakTrophyEv =
    dr?.pendingEvents?.find((e) => e.source === "streak_daily_review") ?? null;

  const params: Record<string, string> = {
    cardsReviewed: String(stats.cardsReviewed),
    sessionDurationMs: String(stats.sessionDurationMs),
    mode: stats.mode,
    ...(stats.endedEarly ? { endedEarly: "1" } : {}),
    ...(stats.answerStats
      ? {
          knowCount: String(stats.answerStats.knowCount),
          dontKnowCount: String(stats.answerStats.dontKnowCount),
        }
      : {}),
    ...(stats.difficultWordsCompletion
      ? {
          difficultReviewed: String(stats.difficultWordsCompletion.reviewed),
          difficultMastered: String(stats.difficultWordsCompletion.mastered),
          difficultStill: String(stats.difficultWordsCompletion.stillDifficult),
        }
      : {}),
    ...(stats.mode === "daily" && dr
      ? {
          dailyReviewStreak: String(dr.currentDailyReviewStreak),
          ...(streakTrophyEv ? { streakTrophyTitle: streakTrophyEv.title } : {}),
        }
      : {}),
    ...(pending.length > 0
      ? { achievementEventIds: pending.map((e) => e.eventId).join(",") }
      : {}),
  };

  return params;
}
