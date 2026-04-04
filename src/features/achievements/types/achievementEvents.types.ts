/** Mirrors `achievement_definition` + nested `definition` in RPC JSON. */
export type AchievementDefinitionPayload = {
  id: string;
  code: string;
  type: string;
  threshold: number;
  title: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
};

export type AchievementEventSource =
  | "known_word_manual"
  | "known_word_midnight"
  | "streak_daily_review";

/**
 * Single pending celebration row from `user_achievement_event` + definition fields
 * (sync RPC, get_pending, get_known_word_unlock_data, completion screen, etc.).
 */
export type AchievementEventPayload = {
  eventId: string;
  source: AchievementEventSource;
  createdAt: string;
  achievementDefinitionId: string;
  code: string;
  type: string;
  threshold: number;
  title: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  definition: AchievementDefinitionPayload;
};

export type ProcessAppEntryAchievementEventsResult = {
  streakRefreshed: boolean;
  midnightSyncRan: boolean;
  newlyUnlocked: unknown[];
  pendingEvents: AchievementEventPayload[];
};

export type CompleteDailyReviewSessionResult = {
  success: boolean;
  sessionCompleted: boolean;
  updatedCount: number;
  currentDailyReviewStreak: number;
  longestDailyReviewStreak: number;
  newlyUnlockedAchievements: unknown[];
  newlyUnlockedStreakAchievements: unknown[];
  pendingEvents: AchievementEventPayload[];
};
