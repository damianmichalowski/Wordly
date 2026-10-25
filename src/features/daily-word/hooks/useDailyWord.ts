import type { QueryClient } from "@tanstack/react-query";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AchievementEventPayload } from "@/src/features/achievements/types/achievementEvents.types";
import {
    getLearningOptionsProgress,
    getLearningTrackProgress,
} from "@/src/features/profile/services/learningProgress.service";
import { patchLibraryCacheAfterMarkKnown } from "@/src/features/library/utils/patchLibraryCacheAfterMarkKnown";
import { createDailyWordCurrentQueryFn } from "@/src/lib/query/dailyWordCurrentQuery";
import { invalidateAfterDailyWordMarkedKnown } from "@/src/lib/query/invalidateAfterMutations";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { computeLikelyOnline } from "@/src/network/netInfoPolicy";
import { warmCachesAfterDailyWordMarkedKnown } from "@/src/lib/query/warmCachesAfterMutations";
import { staleTimes } from "@/src/lib/query/staleTimes";
import type { WordDetails } from "@/src/features/word-details/types/wordDetails.types";
import { getWordDetails } from "@/src/features/word-details/services/wordDetails.service";
import { syncWidgetSnapshotFromApp } from "@/src/services/widgets/syncWidgetSnapshot";

import { markDailyWordAsKnown } from "../services/dailyWord.service";
import type { DailyWordResult } from "../types/dailyWord.types";

type DailyWordHookState = {
  /** Ostatnie zdarzenia trofeów z `mark_word_known_and_advance_daily_word`. */
  lastAchievementEvents: AchievementEventPayload[];
  exhaustedAwaitingTrackCelebration: boolean;
};

const initialHookState: DailyWordHookState = {
  lastAchievementEvents: [],
  exhaustedAwaitingTrackCelebration: false,
};

const GET_WORD_DETAILS_AFTER_MARK_MS = 25_000;
/** Bez limitu `mutateAsync` potrafi wisieć po flaky reconnect — wtedy `finally` nigdy nie zdejmuje pending. */
const MARK_KNOWN_RPC_TIMEOUT_MS = 45_000;
/** `fetchQuery` odzyskania `dailyWord.current` po błędzie `getWordDetails` — musi mieć górny limit. */
const FETCH_CURRENT_AFTER_MARK_FAILED_TIMEOUT_MS = 25_000;
/** Ciepłenie cache po sukcesie — best-effort; nie może blokować CTA w nieskończoność. */
const MARK_KNOWN_CACHE_WARM_TIMEOUT_MS = 40_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("withTimeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Home: `trackProgress`; Ustawienia (paski): `optionsProgress` — osobne RPC; zsynchronizuj oba. */
async function refreshLearningCachesAfterMarkKnown(qc: QueryClient) {
  await Promise.all([
    qc.fetchQuery({
      queryKey: queryKeys.learning.trackProgress,
      queryFn: getLearningTrackProgress,
      staleTime: 0,
    }),
    qc.fetchQuery({
      queryKey: queryKeys.learning.optionsProgress,
      queryFn: () => getLearningOptionsProgress().catch(() => null),
      staleTime: 0,
    }),
  ]);
}

export type UseDailyWordOptions = {
  onTrackExhausted?: () => Promise<void>;
};

export function useDailyWord(options?: UseDailyWordOptions) {
  const queryClient = useQueryClient();
  const [hookState, setHookState] =
    useState<DailyWordHookState>(initialHookState);
  /** Cały przebieg „Known” (RPC + dogranie następnego słowa) — nie tylko `mutation.isPending`. */
  const [markKnownFlowPending, setMarkKnownFlowPending] = useState(false);
  /** Ostatnia próba zakończona błędem — CTA pokazuje retry zamiast samego spinnera. */
  const [markKnownFailed, setMarkKnownFailed] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.dailyWord.current,
    queryFn: createDailyWordCurrentQueryFn(queryClient),
    staleTime: staleTimes.dailyWordCurrent,
    /** Refetch errors: keep showing last good word instead of flashing the offline / error screen. */
    placeholderData: keepPreviousData,
  });

  const queryRef = useRef(query);
  queryRef.current = query;

  const markKnownMutation = useMutation({
    mutationFn: markDailyWordAsKnown,
    networkMode: "always",
    onError: (e) => {
      if (__DEV__) {
        console.warn("[wordly] useDailyWord markKnown failed", e);
      }
    },
  });

  /**
   * Drives `refreshIfStale` / NetInfo recovery. Updated only explicitly (not from React state)
   * so `finally` can clear it before the next paint — avoids false "reconnect recovery"
   * when NetInfo emits while `setMarkKnownFlowPending(false)` is still queued.
   */
  const markKnownFlowPendingRef = useRef(false);
  /**
   * True only after we saw offline (while flow pending) or the mutation paused —
   * avoids treating the normal “RPC done, still dograj next word” window as reconnect recovery.
   */
  const markKnownReconnectRecoveryEligibleRef = useRef(false);

  useEffect(() => {
    if (!markKnownFlowPending) {
      return;
    }
    if (!markKnownMutation.isPaused) {
      return;
    }
    markKnownReconnectRecoveryEligibleRef.current = true;
  }, [markKnownFlowPending, markKnownMutation.isPaused]);

  /**
   * If the mutation was paused while offline and resumes online, or the flow flag
   * desyncs from a stuck paused mutation, recover on real reconnect.
   */
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = computeLikelyOnline(state);
      if (!online) {
        if (markKnownFlowPendingRef.current) {
          markKnownReconnectRecoveryEligibleRef.current = true;
        }
        return;
      }
      if (!markKnownFlowPendingRef.current) {
        return;
      }
      if (markKnownMutation.isPending || markKnownMutation.isPaused) {
        return;
      }
      if (!markKnownReconnectRecoveryEligibleRef.current) {
        return;
      }
      if (__DEV__) {
        console.warn(
          "[wordly] daily_word_mark_known reconnect recovery: stale pending flag cleared",
        );
      }
      markKnownReconnectRecoveryEligibleRef.current = false;
      markKnownMutation.reset();
      markKnownFlowPendingRef.current = false;
      setMarkKnownFlowPending(false);
    });
    return () => unsub();
  }, [markKnownMutation]);

  const wordId = query.data?.details.word_id ?? null;

  /** Stale cache może mieć `data === null` — wtedy `data === undefined` jest fałszywym rozróżnieniem od błędu sieci. */
  const hasDisplayableDailyWord = Boolean(
    query.data?.assignment && query.data?.details,
  );

  const markKnown = useCallback(async (): Promise<
    "exhausted" | "next" | "skipped"
  > => {
    if (!wordId) {
      return "skipped";
    }
    setMarkKnownFailed(false);
    markKnownReconnectRecoveryEligibleRef.current = false;
    markKnownFlowPendingRef.current = true;
    setMarkKnownFlowPending(true);
    if (__DEV__) {
      console.log("[wordly] daily_word_mark_known flow started", { wordId });
    }
    try {
      const { assignment: nextAssignment, achievementEvents } =
        await withTimeout(
          markKnownMutation.mutateAsync(wordId),
          MARK_KNOWN_RPC_TIMEOUT_MS,
        );
      markKnownReconnectRecoveryEligibleRef.current = false;

      const prevDaily = queryClient.getQueryData<DailyWordResult | null>(
        queryKeys.dailyWord.current,
      );
      patchLibraryCacheAfterMarkKnown(queryClient, {
        markedWordId: wordId,
        details: prevDaily?.details,
      });

      if (!nextAssignment) {
        queryClient.setQueryData(queryKeys.dailyWord.current, null);
        setHookState((prev) => ({
          ...prev,
          lastAchievementEvents: achievementEvents,
          exhaustedAwaitingTrackCelebration: true,
        }));
        invalidateAfterDailyWordMarkedKnown(queryClient);
        await withTimeout(
          Promise.all([
            refreshLearningCachesAfterMarkKnown(queryClient),
            warmCachesAfterDailyWordMarkedKnown(queryClient, {
              prefetchAchievements: achievementEvents.length > 0,
            }),
          ]),
          MARK_KNOWN_CACHE_WARM_TIMEOUT_MS,
        ).catch(() => {
          // Best-effort po wyczerpaniu toru.
        });
        try {
          await options?.onTrackExhausted?.();
        } catch {
          // Postęp toru jest best-effort.
        }
        void syncWidgetSnapshotFromApp();
        return "exhausted";
      }

      const nextWordId = nextAssignment.word_id;
      let details =
        queryClient.getQueryData<WordDetails>(queryKeys.words.detail(nextWordId)) ??
        null;
      if (!details) {
        try {
          details = await withTimeout(
            getWordDetails(nextWordId),
            GET_WORD_DETAILS_AFTER_MARK_MS,
          );
        } catch (e) {
          if (__DEV__) {
            console.warn(
              "[wordly] getWordDetails after mark known failed; refetching current daily word",
              e,
            );
          }
          await queryClient.invalidateQueries({ queryKey: queryKeys.dailyWord.all });
          const recovered = await withTimeout(
            queryClient.fetchQuery({
              queryKey: queryKeys.dailyWord.current,
              queryFn: createDailyWordCurrentQueryFn(queryClient),
            }),
            FETCH_CURRENT_AFTER_MARK_FAILED_TIMEOUT_MS,
          );
          if (
            recovered?.details &&
            recovered.assignment?.word_id === nextWordId
          ) {
            details = recovered.details;
          } else {
            throw e instanceof Error ? e : new Error("recover_next_word_failed");
          }
        }
      }
      queryClient.setQueryData(queryKeys.words.detail(nextWordId), details);
      const data: DailyWordResult = { assignment: nextAssignment, details };
      queryClient.setQueryData(queryKeys.dailyWord.current, data);
      setHookState((prev) => ({
        ...prev,
        lastAchievementEvents: achievementEvents,
        exhaustedAwaitingTrackCelebration: false,
      }));
      invalidateAfterDailyWordMarkedKnown(queryClient);
      await withTimeout(
        Promise.all([
          refreshLearningCachesAfterMarkKnown(queryClient),
          warmCachesAfterDailyWordMarkedKnown(queryClient, {
            prefetchAchievements: achievementEvents.length > 0,
          }),
        ]),
        MARK_KNOWN_CACHE_WARM_TIMEOUT_MS,
      ).catch(() => {
        // Best-effort; focus / retry odświeży.
      });
      void syncWidgetSnapshotFromApp();
      return "next";
    } catch (e) {
      if (__DEV__) {
        console.warn("[wordly] daily_word_mark_known flow failed (network or RPC)", e);
      }
      setMarkKnownFailed(true);
      return "skipped";
    } finally {
      if (__DEV__) {
        console.log("[wordly] daily_word_mark_known flow pending cleared");
      }
      markKnownReconnectRecoveryEligibleRef.current = false;
      markKnownFlowPendingRef.current = false;
      setMarkKnownFlowPending(false);
    }
  }, [markKnownMutation, options, queryClient, wordId]);

  const canAct = useMemo(
    () =>
      Boolean(query.data?.details?.word_id) && !markKnownFlowPending,
    [markKnownFlowPending, query.data?.details?.word_id],
  );

  const clearLastAchievementEvents = useCallback(() => {
    setHookState((prev) => ({
      ...prev,
      lastAchievementEvents: [],
    }));
  }, []);

  const dismissLastAchievementEvent = useCallback((eventId: string) => {
    setHookState((prev) => ({
      ...prev,
      lastAchievementEvents: prev.lastAchievementEvents.filter(
        (e) => e.eventId !== eventId,
      ),
    }));
  }, []);

  const clearExhaustedAwaitingTrackCelebration = useCallback(() => {
    setHookState((prev) => ({
      ...prev,
      exhaustedAwaitingTrackCelebration: false,
    }));
  }, []);

  const refresh = useCallback(async () => {
    await query.refetch();
    void syncWidgetSnapshotFromApp();
  }, [query]);

  const refreshIfStale = useCallback(() => {
    /** Avoid racing tab-focus refetch with in-flight mark-known (RPC + next word fetch). */
    if (markKnownFlowPendingRef.current) {
      return;
    }
    const q = queryRef.current;
    if (q.isStale && !q.isFetching) {
      void q.refetch();
    }
  }, []);

  return {
    /** Pełny loader tylko do pierwszego ustalonego fetchu; refetch w tle nie zasłania UI. */
    isLoading: !query.isFetched && !query.isError,
    isSaving: markKnownFlowPending,
    /**
     * Błąd pobrania gdy nie ma sensownej treści w cache (w tym: sukces „brak słowa” + padnięty refetch
     * z `keepPreviousData` — `data === null` musi zostać potraktowane jak brak cache do wyświetlenia).
     */
    loadFailed: query.isError && !hasDisplayableDailyWord,
    /**
     * Wyłącznie po udanym RPC: brak przypisania na dziś / pusty tor — nie mylić z błędem sieci.
     */
    confirmedNoDailyWord: query.isSuccess && query.data === null,
    /**
     * Refetch / pierwszy fetch bez wyświetlanej karty — spinner na CTA (błąd, „stuck” loading, retry).
     */
    transportFetchBusy:
      !hasDisplayableDailyWord && query.isFetching,
    data: query.data ?? null,
    lastAchievementEvents: hookState.lastAchievementEvents,
    exhaustedAwaitingTrackCelebration:
      hookState.exhaustedAwaitingTrackCelebration,
    clearLastAchievementEvents,
    dismissLastAchievementEvent,
    clearExhaustedAwaitingTrackCelebration,
    canAct,
    refresh,
    refreshIfStale,
    markKnown,
    markKnownFailed,
  };
}
