import {
  useFocusEffect,
  useIsFocused,
} from "@react-navigation/native";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DeviceEventEmitter } from "react-native";

import {
  getUserProfileSummary,
  type UserProfileSummaryDto,
} from "@/src/features/achievements/services/achievements.service";
import type { RevisionHubCounts } from "@/src/features/revision/components/RevisionHub";
import type { RevisionHubStats } from "@/src/features/revision/services/revisionRpc.service";
import { useProfileSettingsGate } from "@/src/features/profile/hooks/useProfileSettingsGate";
import { mergeDailyReviewStreakIntoSummaryCache } from "@/src/features/revision/revisionSessionCompletionCache";
import {
  computeHubLoadError,
  computeHubStatsReady,
  computeHubUnlockEmptyConfirmed,
  selectCurrentDailyReviewStreak,
  selectDailyRevisionCompletedToday,
  selectDifficultWordsCount,
  selectDisplayHubCounts,
  selectLongestDailyReviewStreak,
} from "@/src/features/revision/revisionHubSessionDerived";
import { clampDifficultDisplayStreak } from "@/src/features/revision/difficultWordsSession";
import { DIFFICULT_DONT_KNOW_TARGET } from "@/src/components/word/wordDifficultBadge.constants";
import type {
  FlashcardSubmitResult,
  RevisionAnswerUndoEntry,
} from "@/src/features/revision/revisionFlashcardAnswer";
import {
  patchWordDetailsDontKnowCounter,
  patchWordDetailsIsDifficult,
} from "@/src/features/word-progress/utils/patchWordDetailsDifficult";
import {
  graduateWordFromDifficultSession,
  invalidateAfterDifficultWordsGraduation,
} from "@/src/features/word-progress/utils/patchWordGraduatedFromDifficult";
import type { WordDetails } from "@/src/features/word-details/types/wordDetails.types";
import { invalidateAfterDailyReviewSessionComplete } from "@/src/lib/query/invalidateAfterMutations";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { computeLikelyOffline } from "@/src/network/netInfoPolicy";
import { warmCachesAfterDailyReviewSessionComplete } from "@/src/lib/query/warmCachesAfterMutations";
import { refetchIfStaleNotFetching } from "@/src/lib/query/refetchIfStaleNotFetching";
import { staleTimes } from "@/src/lib/query/staleTimes";
import { buildRevisionDeckFromLibraryCache } from "@/src/features/revision/utils/buildRevisionDeckFromLibraryCache";
import { enrichVocabularyFromDetailCache } from "@/src/features/word-progress/utils/enrichVocabularyFromDetailCache";
import { seedWordDetailsCache } from "@/src/features/word-progress/utils/seedWordDetailsCache";
import { wordDetailsToVocabularyWord } from "@/src/features/revision/utils/revisionSessionWordMap";
import {
  encodeRevisionSessionMode,
  type CompleteRevisionSessionOptions,
  type RevisionMode,
  type RevisionSessionAnswerStats,
  type RevisionSessionCompletionStats,
  type RevisionSessionConfig,
  type RevisionSessionPhase,
} from "@/src/types/revisionSession";
import type { VocabularyWord } from "@/src/types/words";
import {
  emitWordDifficultToggled,
  emitWordProgressUpdated,
  WORD_DIFFICULT_TOGGLED,
  type WordDifficultToggledPayload,
} from "@/src/events/wordProgressEvents";
import { shuffleArray } from "@/src/utils/shuffleArray";
import { logUserAction } from "@/src/utils/userActionLog";

import {
  readRevisionSessionDeck,
  persistRevisionSessionDeck,
} from "@/src/services/revision/revisionSessionDeckCache";

import {
  recordWordDifficultDontKnow,
  setWordDifficult,
  setWordDifficultCorrectStreak,
  setWordDifficultDontKnowCounter,
} from "@/src/services/wordProgress/wordProgress.service";

import {
  completeDailyReviewSession,
  completeRevisionSessionRpc,
  getDailyReviewWords,
  getDifficultWords,
  getQuickPracticeWords,
  getRecentlyLearnedWords,
  getRevisionHubStats,
  startRevisionSessionRpc,
} from "./services/revisionRpc.service";
import type { RevisionSessionAnswer } from "@/src/types/revisionTracking";

export type DifficultWordAnswerRecord = {
  knew: boolean;
  streakAfter: number;
};

export type { RevisionMode } from "@/src/types/revisionSession";
export type { RevisionSortPrefs } from "@/src/services/revision/revisionSortPrefs";

type RevisionProfile = { userId: string };

type ServerSessionStatus = "idle" | "pending" | "ready" | "failed";

type HubSessionState = {
  profile: RevisionProfile | null;
  hubCounts: RevisionHubCounts;
  dailyRevisionCompletedToday: boolean;
  currentDailyReviewStreak: number;
  longestDailyReviewStreak: number;
  /** Session deck words only — not the Library catalog. */
  knownWords: VocabularyWord[];
  sessionPhase: RevisionSessionPhase;
  sessionConfig: RevisionSessionConfig | null;
  /** True if session was entered while offline — Daily Review will not persist streak/stats. */
  sessionStartedOffline: boolean;
  sessionFetchPending: boolean;
  mode: RevisionMode;
  flashDeck: VocabularyWord[];
  index: number;
  isFlipped: boolean;
  lastFlipDirection: 1 | -1;
  difficultAnsweredByWordId: Record<string, DifficultWordAnswerRecord>;
  difficultSessionAnswerError: string | null;
  revisionAnswerUndoStack: RevisionAnswerUndoEntry[];
  serverSessionStatus: ServerSessionStatus;
  serverSessionId: string | null;
};

function createInitialHubSessionState(): HubSessionState {
  return {
    profile: null,
    hubCounts: { daily: 0, recent: 0, all: 0 },
    dailyRevisionCompletedToday: false,
    currentDailyReviewStreak: 0,
    longestDailyReviewStreak: 0,
    knownWords: [],
    sessionPhase: "hub",
    sessionConfig: null,
    sessionStartedOffline: false,
    sessionFetchPending: false,
    mode: "list",
    flashDeck: [],
    index: 0,
    isFlipped: false,
    lastFlipDirection: 1,
    difficultAnsweredByWordId: {},
    difficultSessionAnswerError: null,
    revisionAnswerUndoStack: [],
    serverSessionStatus: "idle",
    serverSessionId: null,
  };
}

function computeSessionAnswerStats(
  stack: RevisionAnswerUndoEntry[],
): RevisionSessionAnswerStats {
  let knowCount = 0;
  let dontKnowCount = 0;
  for (const entry of stack) {
    if (entry.kind === "know") {
      knowCount += 1;
    } else {
      dontKnowCount += 1;
    }
  }
  return {
    reviewed: stack.length,
    knowCount,
    dontKnowCount,
  };
}

/**
 * Maps session config to DB mode and SRS flag for tracked sessions.
 * Returns null for sessions that are NOT tracked in this phase.
 */
function resolveSessionTracking(config: RevisionSessionConfig | null): {
  dbMode: string;
  applySrs: boolean;
} | null {
  if (!config) return null;
  switch (config.kind) {
    case "daily":
      return { dbMode: "daily_review", applySrs: false };
    case "quick":
      return { dbMode: "quick_practice", applySrs: true };
    case "recent":
      return { dbMode: "recently_learned", applySrs: true };
    default:
      return null;
  }
}

function streakForCard(
  card: VocabularyWord,
  answeredByWordId: Record<string, DifficultWordAnswerRecord>,
): number {
  const answered = answeredByWordId[card.id];
  if (answered) {
    return answered.streakAfter;
  }
  return clampDifficultDisplayStreak(card.difficultCorrectStreak);
}

/**
 * Revision Hub tab only: hub stats, streak summary, and in-tab review sessions (flashcards).
 * Library browse/list lives in `useLibraryScreenData` + `useProfileSettingsGate`.
 */
export function useRevisionHubSession() {
  const {
    settingsQuery,
    settingsResolved,
    onboardingRequiredConfirmed,
    settingsFetchError,
    settingsRetryBusy,
    hasProfile,
  } = useProfileSettingsGate();

  const queryClient = useQueryClient();
  const isFocused = useIsFocused();

  const [state, setState] = useState<HubSessionState>(createInitialHubSessionState);

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      WORD_DIFFICULT_TOGGLED,
      (payload: WordDifficultToggledPayload) => {
        setState((prev) => {
          const patchWord = (w: VocabularyWord) => {
            if (w.id !== payload.wordId) {
              return w;
            }
            const counter =
              payload.difficultDontKnowCounter !== undefined
                ? payload.difficultDontKnowCounter
                : payload.isDifficult
                  ? 0
                  : 0;
            return {
              ...w,
              isDifficult: payload.isDifficult ? true : undefined,
              difficultDontKnowCounter: counter,
              difficultCorrectStreak: payload.isDifficult
                ? w.difficultCorrectStreak
                : 0,
            };
          };
          return {
            ...prev,
            flashDeck: prev.flashDeck.map(patchWord),
            knownWords: prev.knownWords.map(patchWord),
          };
        });
      },
    );
    return () => sub.remove();
  }, []);

  const flashSessionStartedAtMsRef = useRef<number | null>(null);
  const sessionCompleteInFlightRef = useRef(false);

  const fetchWhenFocused = isFocused;

  const hubStatsQuery = useQuery({
    queryKey: queryKeys.revision.hubStats,
    queryFn: getRevisionHubStats,
    enabled: hasProfile && fetchWhenFocused,
    staleTime: staleTimes.revisionHubStats,
    placeholderData: keepPreviousData,
  });

  const summaryQuery = useQuery<UserProfileSummaryDto>({
    queryKey: queryKeys.profile.summary,
    queryFn: getUserProfileSummary,
    enabled: hasProfile && fetchWhenFocused,
    staleTime: staleTimes.profileSummary,
    placeholderData: keepPreviousData,
  });

  const hubUnlockEmptyConfirmed = useMemo(
    () =>
      computeHubUnlockEmptyConfirmed(
        hasProfile,
        hubStatsQuery.isFetched,
        hubStatsQuery.data,
      ),
    [hasProfile, hubStatsQuery.isFetched, hubStatsQuery.data],
  );

  const hubLoadError = useMemo(
    () =>
      computeHubLoadError(
        hasProfile,
        hubStatsQuery.isFetched,
        hubStatsQuery.isError,
      ),
    [hasProfile, hubStatsQuery.isFetched, hubStatsQuery.isError],
  );

  const difficultWordsCount = useMemo(
    () => selectDifficultWordsCount(hasProfile, hubStatsQuery.data),
    [hasProfile, hubStatsQuery.data],
  );

  const displayHubCounts = useMemo(
    () =>
      selectDisplayHubCounts(
        hasProfile,
        hubStatsQuery.data,
        state.hubCounts,
      ),
    [hasProfile, hubStatsQuery.data, state.hubCounts],
  );

  const displayDailyRevisionCompletedToday = useMemo(
    () =>
      selectDailyRevisionCompletedToday(
        hasProfile,
        hubStatsQuery.data,
        state.dailyRevisionCompletedToday,
      ),
    [hasProfile, hubStatsQuery.data, state.dailyRevisionCompletedToday],
  );

  const displayCurrentDailyReviewStreak = useMemo(
    () =>
      selectCurrentDailyReviewStreak(
        hasProfile,
        summaryQuery.data,
        state.currentDailyReviewStreak,
      ),
    [hasProfile, summaryQuery.data, state.currentDailyReviewStreak],
  );

  const displayLongestDailyReviewStreak = useMemo(
    () =>
      selectLongestDailyReviewStreak(
        hasProfile,
        summaryQuery.data,
        state.longestDailyReviewStreak,
      ),
    [hasProfile, summaryQuery.data, state.longestDailyReviewStreak],
  );

  const hubStatsReady = computeHubStatsReady(
    settingsResolved,
    settingsFetchError,
    hasProfile,
    hubStatsQuery.isFetched,
  );

  const hubFocusQueriesRef = useRef({
    settingsQuery,
    hubStatsQuery,
    summaryQuery,
    hasProfile,
  });
  hubFocusQueriesRef.current = {
    settingsQuery,
    hubStatsQuery,
    summaryQuery,
    hasProfile,
  };

  useFocusEffect(
    useCallback(() => {
      const {
        settingsQuery: sq,
        hubStatsQuery: hq,
        summaryQuery: sumQ,
        hasProfile: hp,
      } = hubFocusQueriesRef.current;
      refetchIfStaleNotFetching(sq);
      if (!hp) {
        return;
      }
      refetchIfStaleNotFetching(hq);
      refetchIfStaleNotFetching(sumQ);
      const dqState = queryClient.getQueryState(queryKeys.revision.dashboardStats);
      if (dqState?.isInvalidated) {
        void queryClient.refetchQueries({
          queryKey: queryKeys.revision.dashboardStats,
          type: "active",
        });
      }
    }, [queryClient]),
  );

  useEffect(() => {
    if (!settingsQuery.isFetched) {
      return;
    }
    if (settingsQuery.isError) {
      return;
    }
    const settings = settingsQuery.data;
    if (settingsQuery.isSuccess && !settings) {
      setState((prev) => ({
        ...prev,
        profile: null,
        knownWords: [],
        hubCounts: { daily: 0, recent: 0, all: 0 },
        dailyRevisionCompletedToday: false,
        currentDailyReviewStreak: 0,
        longestDailyReviewStreak: 0,
      }));
      return;
    }

    if (!settings) {
      return;
    }

    const stats = hubStatsQuery.data;
    const summary = summaryQuery.data;

    setState((prev) => ({
      ...prev,
      profile: { userId: settings.user_id },
      hubCounts: stats
        ? selectDisplayHubCounts(true, stats, prev.hubCounts)
        : prev.hubCounts,
      dailyRevisionCompletedToday:
        stats?.dailyRevision.completedToday ?? prev.dailyRevisionCompletedToday,
      currentDailyReviewStreak:
        summary?.currentDailyReviewStreak ?? prev.currentDailyReviewStreak,
      longestDailyReviewStreak:
        summary?.longestDailyReviewStreak ?? prev.longestDailyReviewStreak,
    }));
  }, [
    settingsQuery.isFetched,
    settingsQuery.isError,
    settingsQuery.isSuccess,
    settingsQuery.data,
    hubStatsQuery.data,
    summaryQuery.data,
  ]);

  const activeCard = useMemo(() => {
    if (state.mode !== "flashcards") {
      return null;
    }
    return state.flashDeck[state.index] ?? null;
  }, [state.flashDeck, state.index, state.mode]);

  const exitSessionToHub = useCallback(() => {
    flashSessionStartedAtMsRef.current = null;
    setState((prev) => ({
      ...prev,
      sessionPhase: "hub",
      sessionConfig: null,
      sessionStartedOffline: false,
      sessionFetchPending: false,
      mode: "list",
      flashDeck: [],
      index: 0,
      isFlipped: false,
      serverSessionStatus: "idle",
      serverSessionId: null,
    }));
  }, []);

  const cancelHubRevisionSession = useCallback(() => {
    flashSessionStartedAtMsRef.current = null;
    setState((prev) => ({
      ...prev,
      sessionPhase: "hub",
      sessionConfig: null,
      sessionStartedOffline: false,
      sessionFetchPending: false,
      mode: "list",
      flashDeck: [],
      index: 0,
      isFlipped: false,
      knownWords: [],
      difficultAnsweredByWordId: {},
      difficultSessionAnswerError: null,
      revisionAnswerUndoStack: [],
      serverSessionStatus: "idle",
      serverSessionId: null,
    }));
  }, []);

  const enterSession = useCallback((config: RevisionSessionConfig) => {
    const target =
      config.kind === "daily"
        ? "revision_daily_review"
        : config.kind === "recent"
          ? "revision_recently_learned"
          : config.kind === "difficultWords"
            ? "revision_difficult_words"
            : "revision_quick_practice";
    logUserAction("session_start", {
      target,
      from: "revision_hub",
      ...(config.kind === "quick" ? { size: config.count } : {}),
      ...(config.kind === "difficultWords" ? { limit: config.limit } : {}),
      ...(config.kind === "recent" ? { count: config.count } : {}),
    });
    void (async () => {
      const net = await NetInfo.fetch();
      const isOffline = computeLikelyOffline(net);

      setState((prev) => ({
        ...prev,
        sessionPhase: "session",
        sessionConfig: config,
        sessionStartedOffline: isOffline,
        sessionFetchPending: true,
        mode: "flashcards",
        flashDeck: [],
        index: 0,
        isFlipped: false,
        difficultAnsweredByWordId: {},
        difficultSessionAnswerError: null,
        revisionAnswerUndoStack: [],
        serverSessionStatus: "idle",
        serverSessionId: null,
      }));

      const cachedPromise = readRevisionSessionDeck(config);

      let details: WordDetails[] = [];
      let rpcFailed = false;

      if (config.kind === "daily") {
        if (!isOffline) {
          try {
            details = await getDailyReviewWords();
          } catch (e) {
            rpcFailed = true;
            if (__DEV__) {
              console.warn("[wordly] revision hub session RPC load failed", e);
            }
          }
        }
      } else if (config.kind === "recent") {
        if (!isOffline) {
          const hub = queryClient.getQueryData<RevisionHubStats>(
            queryKeys.revision.hubStats,
          );
          const n = hub?.recentlyLearned?.availableCount ?? -1;
          try {
            const all = await getRecentlyLearnedWords();
            details = all.slice(0, config.count);
            queryClient.setQueryData(
              queryKeys.revision.recentlyLearnedDeck(n, config.count),
              details,
            );
          } catch (e) {
            rpcFailed = true;
            if (__DEV__) {
              console.warn("[wordly] revision hub session RPC load failed", e);
            }
          }
        } else {
          const hub = queryClient.getQueryData<RevisionHubStats>(
            queryKeys.revision.hubStats,
          );
          const n = hub?.recentlyLearned?.availableCount ?? -1;
          const cached =
            queryClient.getQueryData<WordDetails[]>(
              queryKeys.revision.recentlyLearnedDeck(n, config.count),
            ) ?? [];
          details = cached.slice(0, config.count);
        }
      } else if (config.kind === "quick") {
        if (!isOffline) {
          try {
            details = await getQuickPracticeWords(config.count);
            queryClient.setQueryData(
              queryKeys.revision.quickPracticeDeck(config.count),
              details,
            );
          } catch (e) {
            rpcFailed = true;
            if (__DEV__) {
              console.warn("[wordly] revision hub session RPC load failed", e);
            }
          }
        } else {
          details =
            queryClient.getQueryData<WordDetails[]>(
              queryKeys.revision.quickPracticeDeck(config.count),
            ) ?? [];
        }
      } else if (config.kind === "difficultWords") {
        if (!isOffline) {
          try {
            details = await getDifficultWords(config.limit);
            queryClient.setQueryData(
              queryKeys.revision.difficultWordsDeck(config.limit),
              details,
            );
          } catch (e) {
            rpcFailed = true;
            if (__DEV__) {
              console.warn("[wordly] revision hub session RPC load failed", e);
            }
          }
        } else {
          details =
            queryClient.getQueryData<WordDetails[]>(
              queryKeys.revision.difficultWordsDeck(config.limit),
            ) ?? [];
        }
      }

      const shouldTryLocalFallback =
        config.kind !== "difficultWords" && (isOffline || rpcFailed);

      let knownWords: VocabularyWord[] = [];
      let flashDeck: VocabularyWord[] = [];

      if (details.length > 0) {
        seedWordDetailsCache(queryClient, details);
        knownWords = details.map(wordDetailsToVocabularyWord);
        flashDeck =
          config.kind === "difficultWords"
            ? knownWords
            : shuffleArray(knownWords);
        void persistRevisionSessionDeck(config, knownWords, flashDeck);
      } else if (shouldTryLocalFallback) {
        const cached = await cachedPromise;
        if (cached && cached.flashDeck.length > 0) {
          knownWords = enrichVocabularyFromDetailCache(
            queryClient,
            cached.knownWords,
          );
          flashDeck = enrichVocabularyFromDetailCache(
            queryClient,
            cached.flashDeck,
          );
        } else {
          const fromLib = buildRevisionDeckFromLibraryCache(queryClient, config);
          if (fromLib) {
            knownWords = enrichVocabularyFromDetailCache(
              queryClient,
              fromLib.knownWords,
            );
            flashDeck = enrichVocabularyFromDetailCache(
              queryClient,
              fromLib.flashDeck,
            );
            void persistRevisionSessionDeck(config, knownWords, flashDeck);
          }
        }
      }

      // --- server session tracking (tracked modes only) ---
      let trackingStatus: ServerSessionStatus = "idle";
      let trackingSessionId: string | null = null;

      if (flashDeck.length > 0 && !isOffline) {
        const tracking = resolveSessionTracking(config);
        if (tracking) {
          trackingStatus = "pending";
          try {
            const result = await startRevisionSessionRpc(
              tracking.dbMode,
              flashDeck.length,
            );
            trackingStatus = "ready";
            trackingSessionId = result.sessionId;
          } catch (e) {
            trackingStatus = "failed";
            if (__DEV__) {
              console.warn("[wordly] start_revision_session failed — session continues without tracking", e);
            }
          }
        }
      }

      setState((prev) => {
        if (knownWords.length === 0 || flashDeck.length === 0) {
          return {
            ...prev,
            knownWords: [],
            sessionPhase: "hub",
            sessionConfig: null,
            sessionStartedOffline: false,
            sessionFetchPending: false,
            mode: "list",
            flashDeck: [],
            serverSessionStatus: "idle",
            serverSessionId: null,
          };
        }
        if (prev.sessionPhase === "session") {
          flashSessionStartedAtMsRef.current = Date.now();
        }
        return {
          ...prev,
          knownWords,
          sessionFetchPending: false,
          mode: "flashcards",
          flashDeck,
          index: 0,
          isFlipped: false,
          serverSessionStatus: trackingStatus,
          serverSessionId: trackingSessionId,
        };
      });
    })();
  }, [queryClient]);

  const completeRevisionSession = useCallback(
    async (
      options?: CompleteRevisionSessionOptions,
    ): Promise<RevisionSessionCompletionStats | null> => {
      if (sessionCompleteInFlightRef.current) {
        return null;
      }
      const prev = stateRef.current;
      const isHubSession =
        prev.sessionPhase === "session" && prev.flashDeck.length > 0;

      if (!isHubSession) {
        return null;
      }

      const endedEarly = options?.endedEarly === true;
      const answerStats = computeSessionAnswerStats(
        prev.revisionAnswerUndoStack,
      );
      const answeredWordIds = prev.revisionAnswerUndoStack.map(
        (entry) => entry.wordId,
      );

      sessionCompleteInFlightRef.current = true;
      try {
        const stats: RevisionSessionCompletionStats = {
          cardsReviewed: endedEarly
            ? answerStats.reviewed
            : prev.flashDeck.length,
          sessionDurationMs:
            flashSessionStartedAtMsRef.current != null
              ? Date.now() - flashSessionStartedAtMsRef.current
              : 0,
          mode: prev.sessionConfig
            ? encodeRevisionSessionMode(prev.sessionConfig)
            : "unknown",
          endedEarly,
          answerStats,
        };

        flashSessionStartedAtMsRef.current = null;

        const dailyPersistOnline =
          prev.sessionConfig?.kind === "daily" && !prev.sessionStartedOffline;

        if (dailyPersistOnline) {
          const dailyWordIds = endedEarly
            ? answeredWordIds
            : prev.flashDeck.map((w) => w.id);
          if (dailyWordIds.length > 0) {
            stats.dailyReviewCompletion = await completeDailyReviewSession(
              dailyWordIds,
            );
          }
        }

        // --- server session tracking ---
        const tracking = resolveSessionTracking(prev.sessionConfig);
        if (
          tracking &&
          prev.serverSessionStatus === "ready" &&
          prev.serverSessionId
        ) {
          const rpcAnswers: RevisionSessionAnswer[] =
            prev.revisionAnswerUndoStack.map((entry) => ({
              word_id: entry.wordId,
              answer_result: entry.kind === "know" ? "correct" : "wrong",
              response_time_ms: null,
            }));

          const durationSeconds = Math.round(stats.sessionDurationMs / 1000);

          try {
            await completeRevisionSessionRpc(
              prev.serverSessionId,
              rpcAnswers,
              durationSeconds,
              tracking.applySrs,
            );
            void queryClient.invalidateQueries({
              queryKey: queryKeys.revision.dashboardStats,
            });
          } catch (e) {
            if (__DEV__) {
              console.warn(
                "[wordly] complete_revision_session tracking failed — session completed locally",
                e,
              );
            }
          }
        }

        const dr = stats.dailyReviewCompletion;
        const streakFromCompletion =
          dr?.sessionCompleted === true
            ? {
                currentDailyReviewStreak: dr.currentDailyReviewStreak,
                longestDailyReviewStreak: dr.longestDailyReviewStreak,
              }
            : null;

        setState((s) => ({
          ...s,
          sessionPhase: "hub",
          sessionConfig: null,
          sessionStartedOffline: false,
          sessionFetchPending: false,
          mode: "list",
          flashDeck: [],
          index: 0,
          isFlipped: false,
          knownWords: [],
          difficultAnsweredByWordId: {},
          difficultSessionAnswerError: null,
          revisionAnswerUndoStack: [],
          serverSessionStatus: "idle",
          serverSessionId: null,
          ...(streakFromCompletion ?? {}),
        }));

        if (streakFromCompletion) {
          mergeDailyReviewStreakIntoSummaryCache(
            queryClient,
            streakFromCompletion,
          );
        }

        if (dailyPersistOnline) {
          invalidateAfterDailyReviewSessionComplete(queryClient);
          warmCachesAfterDailyReviewSessionComplete(queryClient);
        }

        if (prev.sessionConfig?.kind === "difficultWords") {
          const answers = prev.difficultAnsweredByWordId;
          const wordsToFinalize = endedEarly
            ? prev.flashDeck.filter((w) => answers[w.id] !== undefined)
            : prev.flashDeck;
          let mastered = 0;
          let stillDifficult = 0;
          const graduatedWordIds: string[] = [];
          const graduationTasks: Promise<unknown>[] = [];
          for (const w of wordsToFinalize) {
            const streakAfter =
              answers[w.id]?.streakAfter ?? w.difficultCorrectStreak ?? 0;
            if (streakAfter >= 3) {
              mastered += 1;
              graduatedWordIds.push(w.id);
              graduationTasks.push(
                graduateWordFromDifficultSession(queryClient, w.id),
              );
            } else {
              stillDifficult += 1;
            }
          }
          await Promise.all(graduationTasks);
          stats.difficultWordsCompletion = {
            reviewed: wordsToFinalize.length,
            mastered,
            stillDifficult,
          };
          await invalidateAfterDifficultWordsGraduation(
            queryClient,
            graduatedWordIds,
          );
        }

        await queryClient.invalidateQueries({
          queryKey: queryKeys.revision.hubStats,
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.revision.dashboardStats,
        });
        if (!dailyPersistOnline) {
          emitWordProgressUpdated();
        }

        return stats;
      } catch (e) {
        if (__DEV__) {
          console.warn("[wordly] complete_revision_session failed", e);
        }
        setState((s) => ({
          ...s,
          sessionPhase: "hub",
          sessionConfig: null,
          sessionStartedOffline: false,
          sessionFetchPending: false,
          mode: "list",
          flashDeck: [],
          index: 0,
          isFlipped: false,
          knownWords: [],
          difficultAnsweredByWordId: {},
          revisionAnswerUndoStack: [],
          serverSessionStatus: "idle",
          serverSessionId: null,
        }));
        return null;
      } finally {
        sessionCompleteInFlightRef.current = false;
      }
    },
    [queryClient],
  );

  const advanceAfterFlashcardAnswer = useCallback(
    (cardIndex: number, deckLength: number): FlashcardSubmitResult => {
      if (cardIndex >= deckLength - 1) {
        return "complete";
      }
      setState((s) => ({
        ...s,
        index: cardIndex + 1,
        isFlipped: false,
      }));
      return "advanced";
    },
    [],
  );

  const submitFlashcardKnow = useCallback(async (): Promise<FlashcardSubmitResult> => {
    const prev = stateRef.current;
    if (prev.mode !== "flashcards" || prev.flashDeck.length === 0) {
      return "advanced";
    }
    const cardIndex = prev.index;
    const card = prev.flashDeck[cardIndex];
    if (!card) {
      return "advanced";
    }

    const isDifficultWords = prev.sessionConfig?.kind === "difficultWords";
    const previousStreak = streakForCard(card, prev.difficultAnsweredByWordId);
    const undoEntry: RevisionAnswerUndoEntry = {
      cardIndex,
      wordId: card.id,
      kind: "know",
      difficultWordsMode: isDifficultWords,
      previousStreak,
      previousIsDifficult: card.isDifficult,
      previousDontKnowCounter: card.difficultDontKnowCounter ?? 0,
    };

    logUserAction("button_press", {
      target: "revision_flashcard_know",
      wordId: card.id,
      mode: prev.sessionConfig?.kind ?? "unknown",
    });

    if (isDifficultWords) {
      const streakAfter = Math.min(3, previousStreak + 1);
      setState((s) => ({
        ...s,
        difficultSessionAnswerError: null,
        difficultAnsweredByWordId: {
          ...s.difficultAnsweredByWordId,
          [card.id]: { knew: true, streakAfter },
        },
        flashDeck: s.flashDeck.map((w) =>
          w.id === card.id ? { ...w, difficultCorrectStreak: streakAfter } : w,
        ),
        knownWords: s.knownWords.map((w) =>
          w.id === card.id ? { ...w, difficultCorrectStreak: streakAfter } : w,
        ),
        revisionAnswerUndoStack: [...s.revisionAnswerUndoStack, undoEntry],
      }));

      try {
        await setWordDifficultCorrectStreak(card.id, streakAfter);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to save answer";
        setState((s) => {
          const { [card.id]: _removed, ...restAnswers } =
            s.difficultAnsweredByWordId;
          return {
            ...s,
            difficultSessionAnswerError: message,
            difficultAnsweredByWordId: restAnswers,
            revisionAnswerUndoStack: s.revisionAnswerUndoStack.slice(0, -1),
            flashDeck: s.flashDeck.map((w) =>
              w.id === card.id
                ? { ...w, difficultCorrectStreak: previousStreak }
                : w,
            ),
          };
        });
        return "advanced";
      }
    } else {
      const previousDontKnowCounter = card.difficultDontKnowCounter ?? 0;
      const alreadyDifficult = card.isDifficult === true;

      if (alreadyDifficult) {
        setState((s) => ({
          ...s,
          difficultSessionAnswerError: null,
          revisionAnswerUndoStack: [...s.revisionAnswerUndoStack, undoEntry],
        }));
      } else if (previousDontKnowCounter > 0) {
        const counterAfter = Math.max(0, previousDontKnowCounter - 1);
        const knowEntry: RevisionAnswerUndoEntry = {
          ...undoEntry,
          knowDecrementedCounter: true,
        };

        setState((s) => ({
          ...s,
          difficultSessionAnswerError: null,
          revisionAnswerUndoStack: [...s.revisionAnswerUndoStack, knowEntry],
          flashDeck: s.flashDeck.map((w) =>
            w.id === card.id
              ? { ...w, difficultDontKnowCounter: counterAfter }
              : w,
          ),
          knownWords: s.knownWords.map((w) =>
            w.id === card.id
              ? { ...w, difficultDontKnowCounter: counterAfter }
              : w,
          ),
        }));

        try {
          const result = await setWordDifficultDontKnowCounter(
            card.id,
            counterAfter,
          );
          patchWordDetailsDontKnowCounter(
            queryClient,
            card.id,
            result.difficultDontKnowCounter,
          );
          emitWordDifficultToggled({
            wordId: card.id,
            isDifficult: false,
            difficultDontKnowCounter: result.difficultDontKnowCounter,
          });
        } catch (e) {
          const message =
            e instanceof Error ? e.message : "Failed to save answer";
          setState((s) => ({
            ...s,
            difficultSessionAnswerError: message,
            revisionAnswerUndoStack: s.revisionAnswerUndoStack.slice(0, -1),
            flashDeck: s.flashDeck.map((w) =>
              w.id === card.id
                ? {
                    ...w,
                    difficultDontKnowCounter: previousDontKnowCounter,
                  }
                : w,
            ),
            knownWords: s.knownWords.map((w) =>
              w.id === card.id
                ? {
                    ...w,
                    difficultDontKnowCounter: previousDontKnowCounter,
                  }
                : w,
            ),
          }));
          return "advanced";
        }
      } else {
        setState((s) => ({
          ...s,
          difficultSessionAnswerError: null,
          revisionAnswerUndoStack: [...s.revisionAnswerUndoStack, undoEntry],
        }));
      }
    }

    return advanceAfterFlashcardAnswer(cardIndex, prev.flashDeck.length);
  }, [advanceAfterFlashcardAnswer, queryClient]);

  const submitFlashcardDontKnow =
    useCallback(async (): Promise<FlashcardSubmitResult> => {
      const prev = stateRef.current;
      if (prev.mode !== "flashcards" || prev.flashDeck.length === 0) {
        return "advanced";
      }
      const cardIndex = prev.index;
      const card = prev.flashDeck[cardIndex];
      if (!card) {
        return "advanced";
      }

      const isDifficultWords = prev.sessionConfig?.kind === "difficultWords";
      const previousStreak = streakForCard(card, prev.difficultAnsweredByWordId);
      const previousDontKnowCounter = card.difficultDontKnowCounter ?? 0;
      const undoEntry: RevisionAnswerUndoEntry = {
        cardIndex,
        wordId: card.id,
        kind: "dontKnow",
        difficultWordsMode: isDifficultWords,
        previousStreak,
        previousIsDifficult: card.isDifficult,
        previousDontKnowCounter,
      };

      logUserAction("button_press", {
        target: "revision_flashcard_dont_know",
        wordId: card.id,
        mode: prev.sessionConfig?.kind ?? "unknown",
      });

      if (isDifficultWords) {
        const streakAfter = 0;
        setState((s) => ({
          ...s,
          difficultSessionAnswerError: null,
          difficultAnsweredByWordId: {
            ...s.difficultAnsweredByWordId,
            [card.id]: { knew: false, streakAfter },
          },
          flashDeck: s.flashDeck.map((w) =>
            w.id === card.id ? { ...w, difficultCorrectStreak: streakAfter } : w,
          ),
          knownWords: s.knownWords.map((w) =>
            w.id === card.id ? { ...w, difficultCorrectStreak: streakAfter } : w,
          ),
          revisionAnswerUndoStack: [...s.revisionAnswerUndoStack, undoEntry],
        }));

        try {
          await setWordDifficultCorrectStreak(card.id, streakAfter);
        } catch (e) {
          const message =
            e instanceof Error ? e.message : "Failed to save answer";
          setState((s) => {
            const { [card.id]: _removed, ...restAnswers } =
              s.difficultAnsweredByWordId;
            return {
              ...s,
              difficultSessionAnswerError: message,
              difficultAnsweredByWordId: restAnswers,
              revisionAnswerUndoStack: s.revisionAnswerUndoStack.slice(0, -1),
              flashDeck: s.flashDeck.map((w) =>
                w.id === card.id
                  ? { ...w, difficultCorrectStreak: previousStreak }
                  : w,
              ),
            };
          });
          return "advanced";
        }
      } else if (card.isDifficult === true) {
        const previousStreak = card.difficultCorrectStreak ?? 0;
        const streakOnlyEntry: RevisionAnswerUndoEntry = {
          ...undoEntry,
          dontKnowResetStreakOnly: true,
          previousStreak,
        };

        setState((s) => ({
          ...s,
          difficultSessionAnswerError: null,
          revisionAnswerUndoStack: [
            ...s.revisionAnswerUndoStack,
            streakOnlyEntry,
          ],
          flashDeck: s.flashDeck.map((w) =>
            w.id === card.id ? { ...w, difficultCorrectStreak: 0 } : w,
          ),
          knownWords: s.knownWords.map((w) =>
            w.id === card.id ? { ...w, difficultCorrectStreak: 0 } : w,
          ),
        }));

        try {
          await setWordDifficultCorrectStreak(card.id, 0);
        } catch (e) {
          const message =
            e instanceof Error ? e.message : "Failed to save answer";
          setState((s) => ({
            ...s,
            difficultSessionAnswerError: message,
            revisionAnswerUndoStack: s.revisionAnswerUndoStack.slice(0, -1),
            flashDeck: s.flashDeck.map((w) =>
              w.id === card.id
                ? { ...w, difficultCorrectStreak: previousStreak }
                : w,
            ),
            knownWords: s.knownWords.map((w) =>
              w.id === card.id
                ? { ...w, difficultCorrectStreak: previousStreak }
                : w,
            ),
          }));
          return "advanced";
        }
      } else {
        const counterAfter = previousDontKnowCounter + 1;
        const isDifficultAfter = counterAfter >= DIFFICULT_DONT_KNOW_TARGET;

        setState((s) => ({
          ...s,
          difficultSessionAnswerError: null,
          revisionAnswerUndoStack: [...s.revisionAnswerUndoStack, undoEntry],
          flashDeck: s.flashDeck.map((w) =>
            w.id === card.id
              ? {
                  ...w,
                  difficultDontKnowCounter: counterAfter,
                  isDifficult: isDifficultAfter ? true : undefined,
                }
              : w,
          ),
          knownWords: s.knownWords.map((w) =>
            w.id === card.id
              ? {
                  ...w,
                  difficultDontKnowCounter: counterAfter,
                  isDifficult: isDifficultAfter ? true : undefined,
                }
              : w,
          ),
        }));

        if (isDifficultAfter) {
          patchWordDetailsIsDifficult(queryClient, card.id, true);
        }

        try {
          const result = await recordWordDifficultDontKnow(card.id);
          if (result.isDifficult === true && card.isDifficult !== true) {
            emitWordDifficultToggled({ wordId: card.id, isDifficult: true });
            emitWordProgressUpdated();
            void queryClient.invalidateQueries({
              queryKey: queryKeys.revision.hubStats,
            });
          }
          setState((s) => ({
            ...s,
            flashDeck: s.flashDeck.map((w) =>
              w.id === card.id
                ? {
                    ...w,
                    difficultDontKnowCounter: result.difficultDontKnowCounter,
                    isDifficult: result.isDifficult === true ? true : undefined,
                  }
                : w,
            ),
            knownWords: s.knownWords.map((w) =>
              w.id === card.id
                ? {
                    ...w,
                    difficultDontKnowCounter: result.difficultDontKnowCounter,
                    isDifficult: result.isDifficult === true ? true : undefined,
                  }
                : w,
            ),
          }));
        } catch (e) {
          const message =
            e instanceof Error ? e.message : "Failed to save answer";
          const wasMarked = card.isDifficult === true;
          if (isDifficultAfter && !wasMarked) {
            patchWordDetailsIsDifficult(queryClient, card.id, false);
          }
          setState((s) => ({
            ...s,
            difficultSessionAnswerError: message,
            revisionAnswerUndoStack: s.revisionAnswerUndoStack.slice(0, -1),
            flashDeck: s.flashDeck.map((w) =>
              w.id === card.id
                ? {
                    ...w,
                    difficultDontKnowCounter: previousDontKnowCounter,
                    isDifficult: wasMarked ? true : undefined,
                  }
                : w,
            ),
            knownWords: s.knownWords.map((w) =>
              w.id === card.id
                ? {
                    ...w,
                    difficultDontKnowCounter: previousDontKnowCounter,
                    isDifficult: wasMarked ? true : undefined,
                  }
                : w,
            ),
          }));
          return "advanced";
        }
      }

      return advanceAfterFlashcardAnswer(cardIndex, prev.flashDeck.length);
    }, [advanceAfterFlashcardAnswer, queryClient]);

  const undoFlashcardAnswer = useCallback(async () => {
    const prev = stateRef.current;
    const stack = prev.revisionAnswerUndoStack;
    if (stack.length === 0) {
      return;
    }

    const entry = stack[stack.length - 1];
    const indexBeforeUndo = prev.index;
    logUserAction("button_press", {
      target: "revision_flashcard_undo",
      wordId: entry.wordId,
    });

    setState((s) => ({
      ...s,
      difficultSessionAnswerError: null,
      revisionAnswerUndoStack: s.revisionAnswerUndoStack.slice(0, -1),
      index: entry.cardIndex,
      isFlipped: false,
    }));

    try {
      if (entry.difficultWordsMode) {
        const { [entry.wordId]: _removed, ...restAnswers } =
          prev.difficultAnsweredByWordId;
        setState((s) => ({
          ...s,
          difficultAnsweredByWordId: restAnswers,
          flashDeck: s.flashDeck.map((w) =>
            w.id === entry.wordId
              ? { ...w, difficultCorrectStreak: entry.previousStreak }
              : w,
          ),
          knownWords: s.knownWords.map((w) =>
            w.id === entry.wordId
              ? { ...w, difficultCorrectStreak: entry.previousStreak }
              : w,
          ),
        }));
        await setWordDifficultCorrectStreak(entry.wordId, entry.previousStreak);
        return;
      }

      if (entry.kind === "know" && entry.knowDecrementedCounter) {
        setState((s) => ({
          ...s,
          flashDeck: s.flashDeck.map((w) =>
            w.id === entry.wordId
              ? {
                  ...w,
                  difficultDontKnowCounter: entry.previousDontKnowCounter,
                }
              : w,
          ),
          knownWords: s.knownWords.map((w) =>
            w.id === entry.wordId
              ? {
                  ...w,
                  difficultDontKnowCounter: entry.previousDontKnowCounter,
                }
              : w,
          ),
        }));
        await setWordDifficultDontKnowCounter(
          entry.wordId,
          entry.previousDontKnowCounter,
        );
        patchWordDetailsDontKnowCounter(
          queryClient,
          entry.wordId,
          entry.previousDontKnowCounter,
        );
        emitWordDifficultToggled({
          wordId: entry.wordId,
          isDifficult: false,
          difficultDontKnowCounter: entry.previousDontKnowCounter,
        });
        return;
      }

      if (entry.kind === "dontKnow" && entry.dontKnowResetStreakOnly) {
        setState((s) => ({
          ...s,
          flashDeck: s.flashDeck.map((w) =>
            w.id === entry.wordId
              ? { ...w, difficultCorrectStreak: entry.previousStreak }
              : w,
          ),
          knownWords: s.knownWords.map((w) =>
            w.id === entry.wordId
              ? { ...w, difficultCorrectStreak: entry.previousStreak }
              : w,
          ),
        }));
        await setWordDifficultCorrectStreak(
          entry.wordId,
          entry.previousStreak,
        );
        return;
      }

      if (entry.kind === "dontKnow") {
        const restoreMarked = entry.previousIsDifficult === true;
        patchWordDetailsIsDifficult(queryClient, entry.wordId, restoreMarked);
        setState((s) => ({
          ...s,
          flashDeck: s.flashDeck.map((w) =>
            w.id === entry.wordId
              ? {
                  ...w,
                  isDifficult: restoreMarked ? true : undefined,
                  difficultDontKnowCounter: entry.previousDontKnowCounter,
                }
              : w,
          ),
          knownWords: s.knownWords.map((w) =>
            w.id === entry.wordId
              ? {
                  ...w,
                  isDifficult: restoreMarked ? true : undefined,
                  difficultDontKnowCounter: entry.previousDontKnowCounter,
                }
              : w,
          ),
        }));
        await setWordDifficultDontKnowCounter(
          entry.wordId,
          entry.previousDontKnowCounter,
        );
        await setWordDifficult(entry.wordId, restoreMarked);
        emitWordDifficultToggled({
          wordId: entry.wordId,
          isDifficult: restoreMarked,
          difficultDontKnowCounter: entry.previousDontKnowCounter,
        });
        emitWordProgressUpdated();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to undo";
      setState((s) => ({
        ...s,
        difficultSessionAnswerError: message,
        revisionAnswerUndoStack: stack,
        index: indexBeforeUndo,
      }));
    }
  }, [queryClient]);

  const canUndoFlashcard = state.revisionAnswerUndoStack.length > 0;

  const getDifficultDisplayStreak = useCallback((word: VocabularyWord) => {
    const answered =
      stateRef.current.difficultAnsweredByWordId[word.id]?.streakAfter;
    if (answered !== undefined) {
      return answered;
    }
    return clampDifficultDisplayStreak(word.difficultCorrectStreak);
  }, []);

  const flip = useCallback((direction: 1 | -1 = 1) => {
    if (state.mode !== "flashcards" || !activeCard) {
      return;
    }
    setState((prev) => ({
      ...prev,
      isFlipped: !prev.isFlipped,
      lastFlipDirection: direction,
    }));
  }, [activeCard, state.mode]);

  const next = useCallback(() => {
    setState((prev) => {
      const len = prev.flashDeck.length;
      if (prev.mode !== "flashcards" || len === 0) {
        return prev;
      }
      return { ...prev, index: (prev.index + 1) % len, isFlipped: false };
    });
  }, []);

  const previous = useCallback(() => {
    setState((prev) => {
      const len = prev.flashDeck.length;
      if (prev.mode !== "flashcards" || len === 0) {
        return prev;
      }
      return { ...prev, index: Math.max(0, prev.index - 1), isFlipped: false };
    });
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.settings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.revision.hubStats }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.summary }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.library.allKnownWords,
      }),
    ]);
  }, [queryClient]);

  const hubStatsRetryBusy =
    hasProfile &&
    hubStatsQuery.isFetched &&
    hubStatsQuery.isError &&
    hubStatsQuery.isFetching;

  return {
    isLoading: !settingsResolved,
    settingsResolved,
    onboardingRequiredConfirmed,
    settingsFetchError,
    settingsRetryBusy,
    hubStatsRetryBusy,
    hubUnlockEmptyConfirmed,
    hubLoadError,
    hubStatsReady,
    profile: state.profile,
    knownWords: state.knownWords,
    sessionPhase: state.sessionPhase,
    sessionConfig: state.sessionConfig,
    sessionStartedOffline: state.sessionStartedOffline,
    sessionFetchPending: state.sessionFetchPending,
    enterSession,
    exitSessionToHub,
    cancelHubRevisionSession,
    hubCounts: displayHubCounts,
    difficultWordsCount,
    difficultSessionAnswerError: state.difficultSessionAnswerError,
    submitFlashcardKnow,
    submitFlashcardDontKnow,
    undoFlashcardAnswer,
    canUndoFlashcard,
    getDifficultDisplayStreak,
    mode: state.mode,
    flashDeck: state.flashDeck,
    index: state.index,
    isFlipped: state.isFlipped,
    lastFlipDirection: state.lastFlipDirection,
    activeCard,
    completeRevisionSession,
    dailyRevisionCompletedToday: displayDailyRevisionCompletedToday,
    currentDailyReviewStreak: displayCurrentDailyReviewStreak,
    longestDailyReviewStreak: displayLongestDailyReviewStreak,
    flip,
    next,
    previous,
    refresh,
  };
}
