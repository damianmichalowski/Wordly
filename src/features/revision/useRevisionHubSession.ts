import {
  useFocusEffect,
  useIsFocused,
} from "@react-navigation/native";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getUserProfileSummary,
  type UserProfileSummaryDto,
} from "@/src/features/achievements/services/achievements.service";
import type { RevisionHubCounts } from "@/src/features/revision/components/RevisionHub";
import { useProfileSettingsGate } from "@/src/features/profile/hooks/useProfileSettingsGate";
import { mergeDailyReviewStreakIntoSummaryCache } from "@/src/features/revision/revisionSessionCompletionCache";
import {
  computeHubLoadError,
  computeHubStatsReady,
  computeHubUnlockEmptyConfirmed,
  selectCurrentDailyReviewStreak,
  selectDailyRevisionCompletedToday,
  selectDisplayHubCounts,
  selectLongestDailyReviewStreak,
} from "@/src/features/revision/revisionHubSessionDerived";
import type { WordDetails } from "@/src/features/word-details/types/wordDetails.types";
import { invalidateAfterRevisionSessionComplete } from "@/src/lib/query/invalidateAfterMutations";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { refetchIfStaleNotFetching } from "@/src/lib/query/refetchIfStaleNotFetching";
import { staleTimes } from "@/src/lib/query/staleTimes";
import { wordDetailsToVocabularyWord } from "@/src/features/revision/utils/revisionSessionWordMap";
import {
  encodeRevisionSessionMode,
  type RevisionMode,
  type RevisionSessionCompletionStats,
  type RevisionSessionConfig,
  type RevisionSessionPhase,
} from "@/src/types/revisionSession";
import type { VocabularyWord } from "@/src/types/words";
import { shuffleArray } from "@/src/utils/shuffleArray";
import { logUserAction } from "@/src/utils/userActionLog";

import {
  completeDailyReviewSession,
  getDailyReviewWords,
  getQuickPracticeWords,
  getRecentlyLearnedWords,
  getRevisionHubStats,
} from "./services/revisionRpc.service";

export type { RevisionMode } from "@/src/types/revisionSession";
export type { RevisionSortPrefs } from "@/src/services/revision/revisionSortPrefs";

type RevisionProfile = { userId: string };

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
  sessionFetchPending: boolean;
  mode: RevisionMode;
  flashDeck: VocabularyWord[];
  index: number;
  isFlipped: boolean;
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
    sessionFetchPending: false,
    mode: "list",
    flashDeck: [],
    index: 0,
    isFlipped: false,
  };
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
    }, []),
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
      sessionFetchPending: false,
      mode: "list",
      flashDeck: [],
      index: 0,
      isFlipped: false,
    }));
  }, []);

  const cancelHubRevisionSession = useCallback(() => {
    flashSessionStartedAtMsRef.current = null;
    setState((prev) => ({
      ...prev,
      sessionPhase: "hub",
      sessionConfig: null,
      sessionFetchPending: false,
      mode: "list",
      flashDeck: [],
      index: 0,
      isFlipped: false,
      knownWords: [],
    }));
  }, []);

  const enterSession = useCallback((config: RevisionSessionConfig) => {
    const target =
      config.kind === "daily"
        ? "revision_daily_review"
        : config.kind === "recent"
          ? "revision_recently_learned"
          : "revision_quick_practice";
    logUserAction("session_start", {
      target,
      from: "revision_hub",
      ...(config.kind === "quick" ? { size: config.count } : {}),
    });
    void (async () => {
      setState((prev) => ({
        ...prev,
        sessionPhase: "session",
        sessionConfig: config,
        sessionFetchPending: true,
        mode: "flashcards",
        flashDeck: [],
        index: 0,
        isFlipped: false,
      }));

      let details: WordDetails[];
      if (config.kind === "daily") {
        details = await getDailyReviewWords();
      } else if (config.kind === "recent") {
        details = await getRecentlyLearnedWords();
      } else if (config.kind === "quick") {
        details = await getQuickPracticeWords(config.count);
      } else {
        details = [];
      }

      const words = details.map(wordDetailsToVocabularyWord);

      setState((prev) => {
        if (words.length === 0) {
          return {
            ...prev,
            knownWords: [],
            sessionFetchPending: false,
            mode: "list",
            flashDeck: [],
          };
        }
        if (prev.sessionPhase === "session") {
          flashSessionStartedAtMsRef.current = Date.now();
        }
        return {
          ...prev,
          knownWords: words,
          sessionFetchPending: false,
          mode: "flashcards",
          flashDeck: shuffleArray(words),
          index: 0,
          isFlipped: false,
        };
      });
    })();
  }, []);

  const completeRevisionSession =
    useCallback(async (): Promise<RevisionSessionCompletionStats | null> => {
      if (sessionCompleteInFlightRef.current) {
        return null;
      }
      const prev = stateRef.current;
      const isHubSession =
        prev.sessionPhase === "session" && prev.flashDeck.length > 0;

      if (!isHubSession) {
        return null;
      }

      sessionCompleteInFlightRef.current = true;
      try {
        const stats: RevisionSessionCompletionStats = {
          cardsReviewed: prev.flashDeck.length,
          sessionDurationMs:
            flashSessionStartedAtMsRef.current != null
              ? Date.now() - flashSessionStartedAtMsRef.current
              : 0,
          mode: prev.sessionConfig
            ? encodeRevisionSessionMode(prev.sessionConfig)
            : "unknown",
        };

        flashSessionStartedAtMsRef.current = null;

        if (prev.sessionConfig?.kind === "daily") {
          stats.dailyReviewCompletion = await completeDailyReviewSession(
            prev.flashDeck.map((w) => w.id),
          );
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
          sessionFetchPending: false,
          mode: "list",
          flashDeck: [],
          index: 0,
          isFlipped: false,
          knownWords: [],
          ...(streakFromCompletion ?? {}),
        }));

        if (streakFromCompletion) {
          mergeDailyReviewStreakIntoSummaryCache(
            queryClient,
            streakFromCompletion,
          );
        }

        invalidateAfterRevisionSessionComplete(queryClient);
        return stats;
      } catch (e) {
        if (__DEV__) {
          console.warn("[wordly] complete_revision_session failed", e);
        }
        setState((s) => ({
          ...s,
          sessionPhase: "hub",
          sessionConfig: null,
          sessionFetchPending: false,
          mode: "list",
          flashDeck: [],
          index: 0,
          isFlipped: false,
          knownWords: [],
        }));
        return null;
      } finally {
        sessionCompleteInFlightRef.current = false;
      }
    }, [queryClient]);

  const flip = useCallback(() => {
    if (state.mode !== "flashcards" || !activeCard) {
      return;
    }
    setState((prev) => ({ ...prev, isFlipped: !prev.isFlipped }));
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
    sessionFetchPending: state.sessionFetchPending,
    enterSession,
    exitSessionToHub,
    cancelHubRevisionSession,
    hubCounts: displayHubCounts,
    mode: state.mode,
    flashDeck: state.flashDeck,
    index: state.index,
    isFlipped: state.isFlipped,
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
