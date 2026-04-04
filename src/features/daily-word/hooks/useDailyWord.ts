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
import { createDailyWordCurrentQueryFn } from "@/src/lib/query/dailyWordCurrentQuery";
import { invalidateAfterDailyWordMarkedKnown } from "@/src/lib/query/invalidateAfterMutations";
import { queryKeys } from "@/src/lib/query/queryKeys";
import { staleTimes } from "@/src/lib/query/staleTimes";
import { syncWidgetSnapshotFromApp } from "@/src/services/widgets/syncWidgetSnapshot";
import { getWordDetails } from "@/src/features/word-details/services/wordDetails.service";

import { markDailyWordAsKnown } from "../services/dailyWord.service";
import type { DailyWordResult } from "../types/dailyWord.types";

type DailyWordHookState = {
  /** Ostatnie zdarzenia trofeów z `mark_word_known_and_advance_daily_word`. */
  lastAchievementEvents: AchievementEventPayload[];
  exhaustedAwaitingTrackCelebration: boolean;
  /** Błąd zapisu „Known” — ten sam wyświetlany słowo, bez zmiany cache. */
  markKnownInlineError: string | null;
};

const initialHookState: DailyWordHookState = {
  lastAchievementEvents: [],
  exhaustedAwaitingTrackCelebration: false,
  markKnownInlineError: null,
};

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
      const online = state.isConnected !== false;
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
      setHookState((prev) => ({
        ...prev,
        markKnownInlineError:
          prev.markKnownInlineError ??
          "Połączeniu przywrócono. Spróbuj ponownie.",
      }));
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
    markKnownReconnectRecoveryEligibleRef.current = false;
    markKnownFlowPendingRef.current = true;
    setMarkKnownFlowPending(true);
    setHookState((prev) => ({ ...prev, markKnownInlineError: null }));
    if (__DEV__) {
      console.log("[wordly] daily_word_mark_known flow started", { wordId });
    }
    try {
      const { assignment: nextAssignment, achievementEvents } =
        await markKnownMutation.mutateAsync(wordId);
      markKnownReconnectRecoveryEligibleRef.current = false;

      if (!nextAssignment) {
        queryClient.setQueryData(queryKeys.dailyWord.current, null);
        setHookState((prev) => ({
          ...prev,
          lastAchievementEvents: achievementEvents,
          exhaustedAwaitingTrackCelebration: true,
          markKnownInlineError: null,
        }));
        invalidateAfterDailyWordMarkedKnown(queryClient);
        await refreshLearningCachesAfterMarkKnown(queryClient);
        try {
          await options?.onTrackExhausted?.();
        } catch {
          // Postęp toru jest best-effort.
        }
        void syncWidgetSnapshotFromApp();
        return "exhausted";
      }

      const details = await getWordDetails(nextAssignment.word_id);
      queryClient.setQueryData(
        queryKeys.words.detail(nextAssignment.word_id),
        details,
      );
      const data: DailyWordResult = { assignment: nextAssignment, details };
      queryClient.setQueryData(queryKeys.dailyWord.current, data);
      setHookState((prev) => ({
        ...prev,
        lastAchievementEvents: achievementEvents,
        exhaustedAwaitingTrackCelebration: false,
        markKnownInlineError: null,
      }));
      invalidateAfterDailyWordMarkedKnown(queryClient);
      await refreshLearningCachesAfterMarkKnown(queryClient);
      void syncWidgetSnapshotFromApp();
      return "next";
    } catch (e) {
      if (__DEV__) {
        console.warn("[wordly] daily_word_mark_known flow failed (network or RPC)", e);
      }
      setHookState((prev) => ({
        ...prev,
        markKnownInlineError:
          "Nie udało się zapisać. Spróbuj ponownie.",
      }));
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
    markKnownInlineError: hookState.markKnownInlineError,
    clearLastAchievementEvents,
    dismissLastAchievementEvent,
    clearExhaustedAwaitingTrackCelebration,
    canAct,
    refresh,
    refreshIfStale,
    markKnown,
  };
}
