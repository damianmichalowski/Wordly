import type { ProgressMap } from "@/src/services/api/progressApi";
import type { UserWordProgress } from "@/src/types/progress";

/**
 * In-memory session map for daily-word progress (per user).
 * Avoids repeated `user_word_progress.select (by word_ids, …)` on every "I know" tap
 * after the first hydrate from `getDailyWordSnapshot` or a cold `applyDailyWordAction`.
 */
const sessionByUserId = new Map<string, ProgressMap>();

export function replaceDailyWordSessionProgress(
  userId: string,
  map: ProgressMap,
): void {
  sessionByUserId.set(userId, { ...map });
}

/** Shallow copy for mutating flows (apply / getDailyWordSnapshot). */
export function getDailyWordSessionProgressCopy(
  userId: string,
): ProgressMap | null {
  const m = sessionByUserId.get(userId);
  if (!m) {
    return null;
  }
  return { ...m };
}

export function mergeDailyWordSessionProgress(
  userId: string,
  wordId: string,
  progress: UserWordProgress,
): void {
  const prev = sessionByUserId.get(userId) ?? {};
  sessionByUserId.set(userId, { ...prev, [wordId]: progress });
}

export function clearDailyWordSessionProgress(userId?: string): void {
  if (userId) {
    sessionByUserId.delete(userId);
  } else {
    sessionByUserId.clear();
  }
}
