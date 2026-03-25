import { deriveDisplayLevel } from "@/src/domain/userProfile/levelMapping";
import {
  buildOptimisticKnownUserProgress,
  progressKnownNow,
  selectNextWord,
} from "@/src/domain/dailyWord/dailyWordHelpers";
import { emitProfileSettingsSaved } from "@/src/events/profileSettingsEvents";
import { emitWordProgressUpdated } from "@/src/events/wordProgressEvents";
import { hasSupabaseEnv } from "@/src/lib/supabase/client";
import { upsertProfileToSupabase } from "@/src/services/api/profileApi";
import type { ProgressMap } from "@/src/services/api/progressApi";
import {
  fetchDailyWordState,
  fetchProgressMap,
  fetchProgressMapForWordIds,
  resetDailyWordState as resetRemoteDailyWordState,
  saveDailyWordState,
  upsertSingleProgress,
} from "@/src/services/api/progressApi";
import {
  enrichDailySnapshotForDisplay,
  fetchVocabularyCandidatesForProfile,
} from "@/src/services/api/vocabularyApi";
import { perfLog } from "@/src/services/performance/perfLog";
import { saveUserProfile } from "@/src/services/storage/profileStorage";
import type { DailyWordSnapshot } from "@/src/types/dailyWord";
import { cefrLevels, type CefrLevel } from "@/src/types/cefr";
import type { UserProfile } from "@/src/types/profile";
import type { DailyWordState, UserWordProgress } from "@/src/types/progress";
import type { VocabularyWord } from "@/src/types/words";
import { getLocalCalendarDateKey } from "@/src/utils/calendarDate";

import {
  getDailyWordSessionProgressCopy,
  replaceDailyWordSessionProgress,
} from "@/src/cache/dailyWordSessionProgress";
import {
  getCachedVocabularyCandidates,
  setCachedVocabularyCandidates,
} from "@/src/cache/vocabularyCandidatesCache";
import {
  setCachedCurrentWord,
} from "@/src/cache/currentWordCache";
import { checkAndHandleDailyRollover } from "@/src/services/dailyWordRollover";
import { getEffectiveNow } from "@/src/time/appClock";
import { LogTag, logger } from "@/src/utils/logger";

export type { DailyWordSnapshot };

/** @see {@link buildOptimisticKnownUserProgress} in `dailyWordHelpers` */
export { buildOptimisticKnownUserProgress };

const DAILY_PREFETCH_DEPTH = 20;

function buildDailyPrefetch(
  candidates: VocabularyWord[],
  progressMap: Record<string, UserWordProgress>,
  activeWord: VocabularyWord | null,
  depth: number,
): NonNullable<DailyWordSnapshot["prefetch"]> {
  const nowIso = getEffectiveNow().toISOString();
  if (!activeWord || candidates.length === 0) {
    return { knownQueue: [] };
  }

  const knownQueue: VocabularyWord[] = [];
  let pm = { ...progressMap };
  let cur = activeWord;

  for (let i = 0; i < depth; i++) {
    pm[cur.id] = progressKnownNow(cur.id, pm[cur.id], nowIso);
    const next = selectNextWord(candidates, pm);
    if (!next) break;
    knownQueue.push(next);
    cur = next;
  }

  return { knownQueue };
}

/** Optymistyczna klatka po „I know” (prefetch kolejnych słów). */
export function applyOptimisticDailySnapshot(
  snapshot: DailyWordSnapshot,
): DailyWordSnapshot | null {
  const active = snapshot.activeWord;
  if (!active || !snapshot.prefetch) {
    return null;
  }
  const now = getEffectiveNow().toISOString();
  const prefetch = snapshot.prefetch;

  const next = prefetch.knownQueue[0];
  if (!next) {
    return null;
  }
  return {
    ...snapshot,
    activeWord: next,
    knownCount: snapshot.knownCount + 1,
    skippedCount: snapshot.skippedCount,
    remainingCount: Math.max(0, snapshot.remainingCount - 1),
    prefetch: {
      knownQueue: prefetch.knownQueue.slice(1),
    },
    stateVersion: snapshot.stateVersion + 1,
    updatedAt: now,
    emptyReason: undefined,
  };
}

function getNextCefrLevel(level: CefrLevel): CefrLevel | null {
  const i = cefrLevels.indexOf(level);
  if (i < 0 || i + 1 >= cefrLevels.length) {
    return null;
  }
  return cefrLevels[i + 1];
}

export async function loadCandidateListCached(
  profile: UserProfile,
): Promise<VocabularyWord[]> {
  perfLog.start("cache-vocab-candidates-read");
  const disk = await getCachedVocabularyCandidates(profile);
  perfLog.end("cache-vocab-candidates-read");
  if (disk && disk.length > 0) {
    return disk;
  }

  const words = await perfLog.measure("fetch-vocab-candidates-network", () =>
    fetchVocabularyCandidatesForProfile(profile),
  );
  await setCachedVocabularyCandidates(profile, words);
  return words;
}

function isRemoteProfile(profile: UserProfile): boolean {
  return Boolean(
    profile.userId && profile.userId !== "local-user" && hasSupabaseEnv(),
  );
}

function emptySnapshot(
  emptyReason: DailyWordSnapshot["emptyReason"],
): DailyWordSnapshot {
  const now = getEffectiveNow().toISOString();
  return {
    activeWord: null,
    knownCount: 0,
    skippedCount: 0,
    remainingCount: 0,
    totalCandidateCount: 0,
    stateVersion: 0,
    updatedAt: now,
    emptyReason,
    prefetch: { knownQueue: [] },
  };
}

function countStatuses(progressList: UserWordProgress[]) {
  const knownCount = progressList.filter(
    (item) => item.status === "known",
  ).length;
  const skippedCount = progressList.filter(
    (item) => item.status === "skipped",
  ).length;
  return { knownCount, skippedCount };
}

export type GetDailyWordSnapshotOptions = {
  /** When set, avoids refetching the full candidate bucket (e.g. after `applyDailyWordAction`). */
  candidates?: VocabularyWord[];
  /**
   * When set (e.g. right after marking known), skips `fetchProgressMap` and uses this map.
   * Avoids a redundant full progress select after a single-row upsert.
   */
  progressMap?: ProgressMap;
  /**
   * When false, skips `enrichDailySnapshotForDisplay` (examples + lemma gloss lines from Supabase).
   * Use for fast paths; merge enrichment in the background so the card shell (word + translation) shows first.
   * Default true (full home display).
   */
  enrichDisplay?: boolean;
  /**
   * When set (e.g. immediately after `saveDailyWordState` in `applyDailyWordAction`), skips
   * `daily_word_state.select` — avoids read-after-write.
   */
  initialDailyState?: DailyWordState;
};

/**
 * Remote + local logic for the active daily word. When `options.candidates` is omitted,
 * uses disk cache + network for the vocabulary bucket.
 */
export async function getDailyWordSnapshot(
  profile: UserProfile,
  options?: GetDailyWordSnapshotOptions,
): Promise<DailyWordSnapshot> {
  if (!isRemoteProfile(profile)) {
    return emptySnapshot("onboarding-incomplete");
  }
  const userId = profile.userId;

  const [initialState, progressMap, candidates] = await Promise.all([
    options?.initialDailyState !== undefined
      ? Promise.resolve(options.initialDailyState)
      : fetchDailyWordState(userId),
    options?.progressMap !== undefined
      ? Promise.resolve(options.progressMap)
      : fetchProgressMap(userId),
    options?.candidates
      ? Promise.resolve(options.candidates)
      : loadCandidateListCached(profile),
  ]);

  let state = initialState;

  if (candidates.length === 0) {
    replaceDailyWordSessionProgress(userId, progressMap);
    const { knownCount, skippedCount } = countStatuses(
      Object.values(progressMap),
    );
    return {
      activeWord: null,
      knownCount,
      skippedCount,
      remainingCount: 0,
      totalCandidateCount: 0,
      stateVersion: state.stateVersion,
      updatedAt: state.updatedAt,
      emptyReason: "no-words-for-config",
      prefetch: { knownQueue: [] },
    };
  }

  const todayKey = getLocalCalendarDateKey();

  if (state.activeWordId && !state.activeDate) {
    const backfill: DailyWordState = {
      ...state,
      activeDate: todayKey,
      updatedAt: getEffectiveNow().toISOString(),
      stateVersion: state.stateVersion + 1,
    };
    await saveDailyWordState(userId, backfill);
    state = backfill;
  }

  try {
    const rollover = await checkAndHandleDailyRollover({
      userId,
      profile,
      state,
      progressMap,
      candidates,
      todayKey,
    });
    state = rollover.state;
  } catch (e) {
    logger.warn(
      LogTag.ROLLOVER,
      "Rollover interrupted; continuing snapshot build with previous daily state (retry on next load)",
      e,
    );
  }

  let activeWord = state.activeWordId
    ? (candidates.find((item) => item.id === state.activeWordId) ?? null)
    : null;
  const isCurrentWordCompleted =
    activeWord && progressMap[activeWord.id]?.status === "known";

  if (!activeWord || isCurrentWordCompleted) {
    const nextWord = selectNextWord(candidates, progressMap);
    const nextState: DailyWordState = {
      activeWordId: nextWord?.id ?? null,
      activeDate: nextWord ? getLocalCalendarDateKey() : null,
      updatedAt: getEffectiveNow().toISOString(),
      stateVersion: state.stateVersion + 1,
    };
    await saveDailyWordState(userId, nextState);
    state = nextState;
    activeWord = nextWord;
  }

  const progressForCandidates = candidates
    .map((word) => progressMap[word.id])
    .filter((value): value is UserWordProgress => Boolean(value));
  const { knownCount, skippedCount } = countStatuses(progressForCandidates);
  const remainingCount = candidates.filter(
    (w) => progressMap[w.id]?.status !== "known",
  ).length;

  const prefetch = buildDailyPrefetch(
    candidates,
    progressMap,
    activeWord,
    DAILY_PREFETCH_DEPTH,
  );

  const base: DailyWordSnapshot = {
    activeWord,
    knownCount,
    skippedCount,
    remainingCount,
    totalCandidateCount: candidates.length,
    stateVersion: state.stateVersion,
    updatedAt: state.updatedAt,
    emptyReason: activeWord ? undefined : "all-words-completed",
    prefetch,
  };

  replaceDailyWordSessionProgress(userId, progressMap);

  if (options?.enrichDisplay === false) {
    return base;
  }
  return enrichDailySnapshotForDisplay(profile, base);
}

async function maybeAdvanceLevelAfterBucketComplete(
  profile: UserProfile,
  snapshot: DailyWordSnapshot,
): Promise<DailyWordSnapshot> {
  if (
    snapshot.emptyReason !== "all-words-completed" ||
    snapshot.totalCandidateCount === 0
  ) {
    return snapshot;
  }

  const completedBucket = profile.displayLevel;
  const nextBucket = getNextCefrLevel(completedBucket);
  if (!nextBucket) {
    return snapshot;
  }

  const from = completedBucket;
  const to = nextBucket;

  const newProfile: UserProfile = {
    ...profile,
    currentLevel: nextBucket,
    displayLevel: deriveDisplayLevel(nextBucket, profile.displayLevelPolicy),
    updatedAt: getEffectiveNow().toISOString(),
  };

  await saveUserProfile(newProfile);
  await upsertProfileToSupabase(newProfile);
  await resetRemoteDailyWordState(profile.userId);
  emitProfileSettingsSaved();

  const nextSnap = await getDailyWordSnapshot(newProfile);
  return { ...nextSnap, levelAdvanced: { from, to } };
}

/** Alias: explicit network+local resolution of the active word. */
export async function fetchCurrentWord(
  profile: UserProfile,
): Promise<DailyWordSnapshot> {
  return getDailyWordSnapshot(profile);
}

/**
 * Persists the latest snapshot for instant next launch + background refresh consumers.
 */
export async function syncCurrentWord(
  profile: UserProfile,
  snapshot: DailyWordSnapshot,
): Promise<void> {
  await setCachedCurrentWord(profile, snapshot);
}

/** Zapis „known” na serwerze i przejście do następnego słowa wg snapshotu. */
export async function applyDailyWordAction(
  profile: UserProfile,
): Promise<DailyWordSnapshot> {
  if (!isRemoteProfile(profile)) {
    return emptySnapshot("onboarding-incomplete");
  }
  const userId = profile.userId;

  const candidates = await loadCandidateListCached(profile);
  if (candidates.length === 0) {
    return getDailyWordSnapshot(profile, { candidates });
  }

  const candidateIds = candidates.map((c) => c.id);
  const state = await fetchDailyWordState(userId);

  let progressMap: ProgressMap;
  const sessionCopy = getDailyWordSessionProgressCopy(userId);
  if (sessionCopy !== null) {
    progressMap = { ...sessionCopy };
  } else {
    logger.info(
      LogTag.WORD_FLOW,
      "Daily mark-known: hydrating progress map (cold path; one-time bucket select)",
    );
    progressMap = await fetchProgressMapForWordIds(userId, candidateIds);
  }

  const activeWord = state.activeWordId
    ? (candidates.find((item) => item.id === state.activeWordId) ?? null)
    : null;

  if (!activeWord) {
    return getDailyWordSnapshot(profile, { candidates });
  }

  const nowIso = getEffectiveNow().toISOString();
  const existing = progressMap[activeWord.id];

  if (existing?.status === "known") {
    return getDailyWordSnapshot(profile, { candidates });
  }

  progressMap[activeWord.id] = progressKnownNow(
    activeWord.id,
    existing,
    nowIso,
  );

  const todayKey = getLocalCalendarDateKey();
  const nextWord = selectNextWord(candidates, progressMap);
  const nextState: DailyWordState = {
    activeWordId: nextWord?.id ?? null,
    activeDate: nextWord ? todayKey : null,
    updatedAt: nowIso,
    stateVersion: state.stateVersion + 1,
  };

  const knownProgress = progressMap[activeWord.id];
  perfLog.start("sync-known-word");
  await upsertSingleProgress(userId, knownProgress);
  perfLog.end("sync-known-word");
  await saveDailyWordState(userId, nextState);

  let snapshot = await getDailyWordSnapshot(profile, {
    candidates,
    progressMap,
    enrichDisplay: false,
    initialDailyState: nextState,
  });
  snapshot = await maybeAdvanceLevelAfterBucketComplete(profile, snapshot);
  emitWordProgressUpdated();
  return snapshot;
}
