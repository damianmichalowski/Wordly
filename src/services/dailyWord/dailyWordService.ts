/**
 * @deprecated Import from `@/src/services/currentWordService` instead.
 * Re-export layer for existing imports.
 */
export {
  applyDailyWordAction,
  applyOptimisticDailySnapshot,
  buildOptimisticKnownUserProgress,
  fetchCurrentWord,
  getDailyWordSnapshot,
  loadCandidateListCached,
  syncCurrentWord,
  type DailyWordSnapshot,
  type GetDailyWordSnapshotOptions,
} from "@/src/services/currentWordService";
export {
  checkAndHandleDailyRollover,
  type DailyRolloverParams,
  type DailyRolloverResult,
} from "@/src/services/dailyWordRollover";
export {
  getEffectiveCalendarDateKey,
  getEffectiveNow,
  msUntilNextLocalMidnight,
  setAppClockOverrideForTests,
} from "@/src/time/appClock";
