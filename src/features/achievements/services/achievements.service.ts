import { rpc } from "@/src/lib/supabase/rpc";

import type {
  AchievementEventPayload,
  CompleteDailyReviewSessionResult,
  ProcessAppEntryAchievementEventsResult,
} from "../types/achievementEvents.types";
import { parseAchievementEventPayloadArray } from "../utils/parseAchievementRpcJson";

export async function processAppEntryAchievementEvents(): Promise<ProcessAppEntryAchievementEventsResult> {
  const { data, error } = await rpc("process_app_entry_achievement_events");
  if (error) {
    throw new Error(`process_app_entry_achievement_events failed: ${error.message}`);
  }
  const row = data as Record<string, unknown> | null;
  const pendingRaw = row?.pendingEvents;
  return {
    streakRefreshed: Boolean(row?.streakRefreshed),
    midnightSyncRan: Boolean(row?.midnightSyncRan),
    newlyUnlocked: Array.isArray(row?.newlyUnlocked) ? row!.newlyUnlocked : [],
    pendingEvents: parseAchievementEventPayloadArray(pendingRaw),
  };
}

export async function consumeAchievementEvents(eventIds: string[]): Promise<number> {
  if (eventIds.length === 0) {
    return 0;
  }
  const { data, error } = await rpc("consume_achievement_events", {
    p_event_ids: eventIds,
  });
  if (error) {
    throw new Error(`consume_achievement_events failed: ${error.message}`);
  }
  const row = data as { consumedCount?: number } | null;
  return typeof row?.consumedCount === "number" ? row.consumedCount : 0;
}

export async function getPendingAchievementEvents(): Promise<AchievementEventPayload[]> {
  const { data, error } = await rpc("get_pending_achievement_events");
  if (error) {
    throw new Error(`get_pending_achievement_events failed: ${error.message}`);
  }
  const row = data as { pending?: unknown } | null;
  return parseAchievementEventPayloadArray(row?.pending);
}

export async function getKnownWordUnlockData(): Promise<{
  knownWordsCount: number;
  pendingKnownWordEvents: AchievementEventPayload[];
}> {
  const { data, error } = await rpc("get_known_word_unlock_data");
  if (error) {
    throw new Error(`get_known_word_unlock_data failed: ${error.message}`);
  }
  const row = data as Record<string, unknown> | null;
  return {
    knownWordsCount: typeof row?.knownWordsCount === "number" ? row.knownWordsCount : 0,
    pendingKnownWordEvents: parseAchievementEventPayloadArray(row?.pendingKnownWordEvents),
  };
}

export type UserProfileSummaryDto = {
  knownWordsCount: number;
  currentDailyReviewStreak: number;
  longestDailyReviewStreak: number;
  memberSince: string;
  email: string | null;
};

export async function getUserProfileSummary(): Promise<UserProfileSummaryDto> {
  const { data, error } = await rpc("get_user_profile_summary");
  if (error) {
    throw new Error(`get_user_profile_summary failed: ${error.message}`);
  }
  const row = data as Record<string, unknown> | null;
  return {
    knownWordsCount: typeof row?.knownWordsCount === "number" ? row.knownWordsCount : 0,
    currentDailyReviewStreak:
      typeof row?.currentDailyReviewStreak === "number"
        ? row.currentDailyReviewStreak
        : 0,
    longestDailyReviewStreak:
      typeof row?.longestDailyReviewStreak === "number"
        ? row.longestDailyReviewStreak
        : 0,
    memberSince: typeof row?.memberSince === "string" ? row.memberSince : "",
    email: typeof row?.email === "string" ? row.email : null,
  };
}

export type UserAchievementRow = {
  definition: {
    id: string;
    code: string;
    type: string;
    threshold: number;
    title: string;
    description: string | null;
    icon: string | null;
    sortOrder: number;
  };
  unlocked: boolean;
  unlockedAt: string | null;
  progressCurrent: number;
  progressTarget: number;
  progressRatio: number;
};

export async function getUserAchievementsList(): Promise<UserAchievementRow[]> {
  const { data, error } = await rpc("get_user_achievements");
  if (error) {
    throw new Error(`get_user_achievements failed: ${error.message}`);
  }
  const row = data as { achievements?: unknown } | null;
  const raw = row?.achievements;
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: UserAchievementRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const def = o.definition as Record<string, unknown> | undefined;
    if (!def || typeof def.id !== "string") continue;
    out.push({
      definition: {
        id: def.id,
        code: String(def.code ?? ""),
        type: String(def.type ?? ""),
        threshold: typeof def.threshold === "number" ? def.threshold : 0,
        title: String(def.title ?? ""),
        description:
          def.description === null || typeof def.description === "string"
            ? def.description
            : null,
        icon: def.icon === null || typeof def.icon === "string" ? def.icon : null,
        sortOrder: typeof def.sortOrder === "number" ? def.sortOrder : 0,
      },
      unlocked: Boolean(o.unlocked),
      unlockedAt:
        o.unlockedAt === null || typeof o.unlockedAt === "string"
          ? o.unlockedAt
          : null,
      progressCurrent:
        typeof o.progressCurrent === "number" ? o.progressCurrent : 0,
      progressTarget:
        typeof o.progressTarget === "number" ? o.progressTarget : 0,
      progressRatio:
        typeof o.progressRatio === "number" ? o.progressRatio : 0,
    });
  }
  return out;
}

export async function completeDailyReviewSessionRpc(
  wordIds: string[],
): Promise<CompleteDailyReviewSessionResult> {
  const { data, error } = await rpc("complete_daily_review_session", {
    p_word_ids: wordIds,
  });
  if (error) {
    throw new Error(`complete_daily_review_session failed: ${error.message}`);
  }
  const row = data as Record<string, unknown> | null;
  return {
    success: Boolean(row?.success),
    sessionCompleted: Boolean(row?.sessionCompleted),
    updatedCount: typeof row?.updatedCount === "number" ? row.updatedCount : 0,
    currentDailyReviewStreak:
      typeof row?.currentDailyReviewStreak === "number" ? row.currentDailyReviewStreak : 0,
    longestDailyReviewStreak:
      typeof row?.longestDailyReviewStreak === "number" ? row.longestDailyReviewStreak : 0,
    newlyUnlockedAchievements: Array.isArray(row?.newlyUnlockedAchievements)
      ? row!.newlyUnlockedAchievements
      : [],
    newlyUnlockedStreakAchievements: Array.isArray(row?.newlyUnlockedStreakAchievements)
      ? row!.newlyUnlockedStreakAchievements
      : [],
    pendingEvents: parseAchievementEventPayloadArray(row?.pendingEvents),
  };
}
