import { deriveDisplayLevel } from "@/src/domain/userProfile/levelMapping";
import { emitProfileSettingsSaved } from "@/src/events/profileSettingsEvents";
import { emitWordProgressUpdated } from "@/src/events/wordProgressEvents";
import { hasSupabaseEnv } from "@/src/lib/supabase/client";
import { upsertProfileToSupabase } from "@/src/services/api/profileApi";
import {
    fetchDailyWordState,
    fetchProgressMap,
    resetDailyWordState as resetRemoteDailyWordState,
    saveDailyWordState,
    saveProgressMap,
} from "@/src/services/api/progressApi";
import { fetchVocabularyCandidatesForProfile } from "@/src/services/api/vocabularyApi";
import { initialNextReviewAfterMarkedKnown } from "@/src/services/revision/spacedRepetition";
import { saveUserProfile } from "@/src/services/storage/profileStorage";
import { cefrLevels, type CefrLevel } from "@/src/types/cefr";
import type { UserProfile } from "@/src/types/profile";
import type { DailyWordState, UserWordProgress } from "@/src/types/progress";
import type { VocabularyWord } from "@/src/types/words";

export type DailyWordSnapshot = {
  activeWord: VocabularyWord | null;
  knownCount: number;
  skippedCount: number;
  remainingCount: number;
  totalCandidateCount: number;
  stateVersion: number;
  updatedAt: string;
  emptyReason?:
    | "onboarding-incomplete"
    | "no-words-for-config"
    | "all-words-completed";
  /** Ustawiane po automatycznym przejściu na kolejny poziom CEFR po ukończeniu całego bucketa */
  levelAdvanced?: { from: CefrLevel; to: CefrLevel };
  /**
   * Kolejka wyłącznie w pamięci (bez osobnych requestów na słowo): następne słowa po serii „known”
   * oraz cele po „skip”, liczone z już pobranej listy kandydatów + mapy postępu (jak w `getDailyWordSnapshot`).
   */
  prefetch?: {
    knownQueue: VocabularyWord[];
    afterSkipByWordId: Record<string, VocabularyWord | null>;
  };
};

/**
 * Ile kolejnych kroków „known” symulujemy lokalnie (oraz dopasowane cele „skip”).
 * To nie jest N zapytań do API. Pełna pula słów i tak przychodzi w `fetchVocabularyCandidatesForProfile`.
 */
const DAILY_PREFETCH_DEPTH = 20;

function progressKnownNow(
  wordId: string,
  existing: UserWordProgress | undefined,
  nowIso: string,
): UserWordProgress {
  return {
    wordId,
    status: "known",
    firstSeenAt: existing?.firstSeenAt ?? nowIso,
    markedKnownAt: nowIso,
    skippedAt: existing?.skippedAt,
    reviewCount: existing?.reviewCount ?? 0,
    lastReviewedAt: existing?.lastReviewedAt,
    nextReviewAt: existing?.nextReviewAt,
  };
}

function progressSkippedNow(
  wordId: string,
  existing: UserWordProgress | undefined,
  nowIso: string,
): UserWordProgress {
  return {
    wordId,
    status: "skipped",
    firstSeenAt: existing?.firstSeenAt ?? nowIso,
    markedKnownAt: existing?.markedKnownAt,
    skippedAt: nowIso,
    reviewCount: existing?.reviewCount ?? 0,
    lastReviewedAt: existing?.lastReviewedAt,
    nextReviewAt: existing?.nextReviewAt,
    difficultyScore: existing?.difficultyScore ?? 0,
  };
}

function buildDailyPrefetch(
  candidates: VocabularyWord[],
  progressMap: Record<string, UserWordProgress>,
  activeWord: VocabularyWord | null,
  depth: number,
): NonNullable<DailyWordSnapshot["prefetch"]> {
  const nowIso = new Date().toISOString();
  if (!activeWord || candidates.length === 0) {
    return { knownQueue: [], afterSkipByWordId: {} };
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

  const afterSkipByWordId: Record<string, VocabularyWord | null> = {};
  const steps = [activeWord, ...knownQueue];
  pm = { ...progressMap };
  for (let i = 0; i < steps.length; i++) {
    const w = steps[i];
    const pmSkip = { ...pm };
    pmSkip[w.id] = progressSkippedNow(w.id, pmSkip[w.id], nowIso);
    afterSkipByWordId[w.id] = selectNextNotKnownAfter(candidates, pmSkip, w.id);
    if (i + 1 < steps.length) {
      pm[w.id] = progressKnownNow(w.id, pm[w.id], nowIso);
    }
  }

  return { knownQueue, afterSkipByWordId };
}

/**
 * Jedna klatka optymistycznej UI (bez I/O). Zwraca `null`, gdy nie mamy danych
 * do bezpiecznego przejścia (serwer musi zdecydować).
 */
export function applyOptimisticDailySnapshot(
  snapshot: DailyWordSnapshot,
  action: "known" | "skip",
): DailyWordSnapshot | null {
  const active = snapshot.activeWord;
  if (!active || !snapshot.prefetch) {
    return null;
  }
  const now = new Date().toISOString();
  const prefetch = snapshot.prefetch;

  if (action === "known") {
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
        afterSkipByWordId: prefetch.afterSkipByWordId,
      },
      stateVersion: snapshot.stateVersion + 1,
      updatedAt: now,
      emptyReason: undefined,
    };
  }

  if (Object.prototype.hasOwnProperty.call(prefetch.afterSkipByWordId, active.id)) {
    const nextSkip = prefetch.afterSkipByWordId[active.id];
    return {
      ...snapshot,
      activeWord: nextSkip,
      knownCount: snapshot.knownCount,
      skippedCount: snapshot.skippedCount + 1,
      remainingCount: snapshot.remainingCount,
      prefetch: {
        knownQueue: [],
        afterSkipByWordId: {},
      },
      stateVersion: snapshot.stateVersion + 1,
      updatedAt: now,
      emptyReason: nextSkip ? undefined : "all-words-completed",
    };
  }

  return null;
}

/** Klucz kalendarzowy w strefie lokalnej urządzenia (YYYY-MM-DD). */
function getLocalDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Pierwsze słowo w kolejności listy, które nie jest „known”, zaczynając cyklicznie po `afterWordId`.
 * Używane po zmianie dnia lokalnego, żeby nie wybierać ponownie tego samego wpisu co wczoraj.
 */
function selectNextNotKnownAfter(
  candidates: VocabularyWord[],
  progressByWordId: Record<string, UserWordProgress>,
  afterWordId: string,
): VocabularyWord | null {
  const start = candidates.findIndex((w) => w.id === afterWordId);
  if (start < 0) {
    return selectNextWord(candidates, progressByWordId);
  }
  const n = candidates.length;
  for (let step = 1; step <= n; step++) {
    const i = (start + step) % n;
    const word = candidates[i];
    if (progressByWordId[word.id]?.status !== "known") {
      return word;
    }
  }
  return null;
}

function getNextCefrLevel(level: CefrLevel): CefrLevel | null {
  const i = cefrLevels.indexOf(level);
  if (i < 0 || i + 1 >= cefrLevels.length) {
    return null;
  }
  return cefrLevels[i + 1];
}

async function loadCandidateList(
  profile: UserProfile,
): Promise<VocabularyWord[]> {
  return fetchVocabularyCandidatesForProfile(profile);
}

function isRemoteProfile(profile: UserProfile): boolean {
  return Boolean(
    profile.userId && profile.userId !== "local-user" && hasSupabaseEnv(),
  );
}

function emptySnapshot(
  emptyReason: DailyWordSnapshot["emptyReason"],
): DailyWordSnapshot {
  const now = new Date().toISOString();
  return {
    activeWord: null,
    knownCount: 0,
    skippedCount: 0,
    remainingCount: 0,
    totalCandidateCount: 0,
    stateVersion: 0,
    updatedAt: now,
    emptyReason,
    prefetch: { knownQueue: [], afterSkipByWordId: {} },
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

/** Kolejne słowo: tylko nieoznaczone jako „known” (legacy „skipped” nadal wraca do kolejki). */
function selectNextWord(
  candidates: VocabularyWord[],
  progressByWordId: Record<string, UserWordProgress>,
) {
  return (
    candidates.find((word) => {
      const status = progressByWordId[word.id]?.status;
      return status !== "known";
    }) ?? null
  );
}

export async function getDailyWordSnapshot(
  profile: UserProfile,
): Promise<DailyWordSnapshot> {
  if (!isRemoteProfile(profile)) {
    return emptySnapshot("onboarding-incomplete");
  }
  const userId = profile.userId;

  const [initialState, progressMap] = await Promise.all([
    fetchDailyWordState(userId),
    fetchProgressMap(userId),
  ]);
  let state = initialState;
  const candidates = await loadCandidateList(profile);

  if (candidates.length === 0) {
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
      prefetch: { knownQueue: [], afterSkipByWordId: {} },
    };
  }

  const todayKey = getLocalDateKey();

  if (state.activeWordId && !state.activeDate) {
    const backfill: DailyWordState = {
      ...state,
      activeDate: todayKey,
      updatedAt: new Date().toISOString(),
      stateVersion: state.stateVersion + 1,
    };
    await saveDailyWordState(userId, backfill);
    state = backfill;
  }

  if (
    state.activeDate &&
    state.activeDate !== todayKey &&
    state.activeWordId &&
    candidates.some((w) => w.id === state.activeWordId)
  ) {
    const prevId = state.activeWordId;
    const prevProgress = progressMap[prevId];
    const now = new Date().toISOString();

    if (prevProgress?.status !== "known") {
      progressMap[prevId] = {
        wordId: prevId,
        status: "skipped",
        firstSeenAt: prevProgress?.firstSeenAt ?? now,
        skippedAt: now,
        markedKnownAt: prevProgress?.markedKnownAt,
        reviewCount: prevProgress?.reviewCount ?? 0,
        lastReviewedAt: prevProgress?.lastReviewedAt,
        nextReviewAt: prevProgress?.nextReviewAt,
        difficultyScore: prevProgress?.difficultyScore ?? 0,
      };
      await saveProgressMap(userId, progressMap);
    }

    const nextWord =
      prevProgress?.status === "known"
        ? selectNextWord(candidates, progressMap)
        : selectNextNotKnownAfter(candidates, progressMap, prevId);

    const rolled: DailyWordState = {
      activeWordId: nextWord?.id ?? null,
      activeDate: nextWord ? todayKey : null,
      updatedAt: new Date().toISOString(),
      stateVersion: state.stateVersion + 1,
    };
    await saveDailyWordState(userId, rolled);
    state = rolled;
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
      activeDate: nextWord ? getLocalDateKey() : null,
      updatedAt: new Date().toISOString(),
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

  return {
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
    updatedAt: new Date().toISOString(),
  };

  await saveUserProfile(newProfile);
  await upsertProfileToSupabase(newProfile);
  await resetRemoteDailyWordState(profile.userId);
  emitProfileSettingsSaved();

  const nextSnap = await getDailyWordSnapshot(newProfile);
  return { ...nextSnap, levelAdvanced: { from, to } };
}

export async function applyDailyWordAction(
  profile: UserProfile,
  action: "known" | "skip",
): Promise<DailyWordSnapshot> {
  if (!isRemoteProfile(profile)) {
    return emptySnapshot("onboarding-incomplete");
  }
  const userId = profile.userId;

  const [state, progressMap] = await Promise.all([
    fetchDailyWordState(userId),
    fetchProgressMap(userId),
  ]);
  const candidates = await loadCandidateList(profile);
  const activeWord = state.activeWordId
    ? (candidates.find((item) => item.id === state.activeWordId) ?? null)
    : null;

  if (!activeWord) {
    return getDailyWordSnapshot(profile);
  }

  const now = new Date().toISOString();
  const existing = progressMap[activeWord.id];

  if (existing?.status === "known") {
    return getDailyWordSnapshot(profile);
  }

  if (action === "known") {
    progressMap[activeWord.id] = progressKnownNow(
      activeWord.id,
      existing,
      now,
    );
  } else {
    progressMap[activeWord.id] = progressSkippedNow(
      activeWord.id,
      existing,
      now,
    );
  }

  const todayKey = getLocalDateKey();
  /** Po „known” czyszczymy aktywne; snapshot wybierze pierwsze nie-known (znane odpada). Po „skip” musimy przejść cyklicznie dalej, bo skipped wciąż jest „nie-known” i `selectNextWord` zwróciłoby to samo słowo. */
  const nextWordAfterSkip =
    action === "skip"
      ? selectNextNotKnownAfter(candidates, progressMap, activeWord.id)
      : null;

  const nextState: DailyWordState = {
    activeWordId: action === "skip" ? (nextWordAfterSkip?.id ?? null) : null,
    activeDate: todayKey,
    updatedAt: now,
    stateVersion: state.stateVersion + 1,
  };

  /** Najpierw postęp, potem daily state — żeby przy błędzie upsertu nie zostawić `active_word_id` null bez zapisanego „known”. */
  await saveProgressMap(userId, progressMap);
  await saveDailyWordState(userId, nextState);
  let snapshot = await getDailyWordSnapshot(profile);
  if (action === "known") {
    snapshot = await maybeAdvanceLevelAfterBucketComplete(profile, snapshot);
  }
  emitWordProgressUpdated();
  return snapshot;
}
