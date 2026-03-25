import { mergeKnownWordIntoCache } from "@/src/cache/knownWordsCache";
import {
  buildOptimisticKnownUserProgress,
  progressKnownNow,
  selectNextWord,
} from "@/src/domain/dailyWord/dailyWordHelpers";
import { emitWordProgressUpdated } from "@/src/events/wordProgressEvents";
import {
  saveDailyWordState,
  upsertSingleProgress,
  type ProgressMap,
} from "@/src/services/api/progressApi";
import { getEffectiveNow } from "@/src/time/appClock";
import type { DailyWordState } from "@/src/types/progress";
import type { UserProfile } from "@/src/types/profile";
import type { VocabularyWord } from "@/src/types/words";
import { LogTag, logger } from "@/src/utils/logger";

export type DailyRolloverParams = {
  userId: string;
  profile: UserProfile;
  state: DailyWordState;
  progressMap: ProgressMap;
  candidates: VocabularyWord[];
  /** From `getLocalCalendarDateKey()` / `getEffectiveCalendarDateKey()`. */
  todayKey: string;
};

export type DailyRolloverResult = {
  state: DailyWordState;
  didRollover: boolean;
};

/**
 * If `activeDate` is a past local day, marks yesterday’s daily word **known** (unless already),
 * advances `daily_word_state` to `todayKey` with the next eligible word, persists to Supabase.
 *
 * Idempotent: once `activeDate === todayKey`, returns without writes. Safe if called repeatedly.
 */
export async function checkAndHandleDailyRollover(
  params: DailyRolloverParams,
): Promise<DailyRolloverResult> {
  const { userId, profile, todayKey, candidates } = params;
  let { state } = params;
  const { progressMap } = params;

  logger.info(LogTag.ROLLOVER, "Checking daily rollover");
  logger.info(LogTag.ROLLOVER, `Current date key=${todayKey}`);
  logger.info(
    LogTag.ROLLOVER,
    `Active state date key=${state.activeDate ?? "null"} sense_id=${state.activeWordId ?? "null"}`,
  );

  if (!state.activeDate || !state.activeWordId) {
    logger.info(
      LogTag.ROLLOVER,
      "Rollover skipped (no activeDate/activeWordId to anchor)",
    );
    return { state, didRollover: false };
  }

  if (state.activeDate === todayKey) {
    logger.info(LogTag.ROLLOVER, "Rollover skipped (already processed for this calendar day)");
    return { state, didRollover: false };
  }

  if (!candidates.some((w) => w.id === state.activeWordId)) {
    logger.warn(
      LogTag.ROLLOVER,
      `Rollover skipped: sense_id=${state.activeWordId} not in candidate bucket`,
    );
    return { state, didRollover: false };
  }

  const prevId = state.activeWordId;
  logger.info(
    LogTag.ROLLOVER,
    `Day change detected: ${state.activeDate} -> ${todayKey}`,
  );
  logger.info(LogTag.ROLLOVER, `Previous active sense_id=${prevId}`);

  const prevProgress = progressMap[prevId];
  const nowIso = getEffectiveNow().toISOString();

  const mapAfterPrev: ProgressMap = { ...progressMap };

  try {
    if (prevProgress?.status === "known") {
      logger.info(LogTag.ROLLOVER, "Auto-mark-known skipped (already known)");
    } else {
      logger.info(LogTag.ROLLOVER, "Auto-mark-known started (rollover)");
      const known = progressKnownNow(prevId, prevProgress, nowIso);
      await upsertSingleProgress(userId, known);
      mapAfterPrev[prevId] = known;

      const prevWord = candidates.find((w) => w.id === prevId);
      if (prevWord) {
        void mergeKnownWordIntoCache(
          profile.userId,
          prevWord,
          buildOptimisticKnownUserProgress(prevId, prevProgress),
        );
      }
    }

    const nextWord = selectNextWord(candidates, mapAfterPrev);
    const rolled: DailyWordState = {
      activeWordId: nextWord?.id ?? null,
      activeDate: nextWord ? todayKey : null,
      updatedAt: nowIso,
      stateVersion: state.stateVersion + 1,
    };

    await saveDailyWordState(userId, rolled);

    Object.assign(progressMap, mapAfterPrev);

    emitWordProgressUpdated();

    logger.info(
      LogTag.ROLLOVER,
      `New daily word resolved: sense_id=${rolled.activeWordId ?? "none"}`,
    );
    logger.info(LogTag.ROLLOVER, "Daily state updated");
    logger.info(LogTag.ROLLOVER, "Rollover complete");

    return { state: rolled, didRollover: true };
  } catch (e) {
    logger.warn(
      LogTag.ROLLOVER,
      "Rollover failed (remote persist); will retry on next resolution",
      e,
    );
    throw e;
  }
}
