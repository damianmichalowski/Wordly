import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, DeviceEventEmitter } from "react-native";

import { clearDailyWordSessionProgress } from "@/src/cache/dailyWordSessionProgress";
import { mergeKnownWordIntoCache } from "@/src/cache/knownWordsCache";
import { mergeDailySnapshotPreservingDisplayEnrichment } from "@/src/features/dailyWord/mergeSnapshotEnrichment";
import {
  enrichDailySnapshotForDisplay,
  enrichVocabularyWordsForHomeDisplay,
} from "@/src/services/api/vocabularyApi";
import {
  getCachedCurrentWord,
  isCurrentWordCacheValidForToday,
  setCachedCurrentWord,
} from "@/src/cache/currentWordCache";
import { PROFILE_SETTINGS_SAVED } from "@/src/events/profileSettingsEvents";
import { emitWordProgressUpdated } from "@/src/events/wordProgressEvents";
import { getUserProfile } from "@/src/services/storage/profileStorage";
import {
  applyDailyWordAction,
  applyOptimisticDailySnapshot,
  buildOptimisticKnownUserProgress,
  fetchCurrentWord,
  getDailyWordSnapshot,
  type DailyWordSnapshot,
} from "@/src/services/currentWordService";
import { syncWidgetLoadingSnapshot } from "@/src/services/widgets/widgetLoadingSync";
import { syncWidgetSnapshotFromApp } from "@/src/services/widgets/syncWidgetSnapshot";
import {
  getEffectiveNow,
  msUntilNextLocalMidnight,
} from "@/src/time/appClock";
import type { UserProfile } from "@/src/types/profile";
import { LogTag, logger } from "@/src/utils/logger";

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

type DailyWordState = {
  isLoading: boolean;
  isSyncPending: boolean;
  isOptimisticTransition: boolean;
  profile: UserProfile | null;
  snapshot: DailyWordSnapshot | null;
};

export type UseCurrentWordReturn = {
  isLoading: boolean;
  isSyncPending: boolean;
  isOptimisticTransition: boolean;
  /** Full-screen overlay when sync runs without a local prefetch path. */
  showBlockingLoadingUi: boolean;
  profile: UserProfile | null;
  snapshot: DailyWordSnapshot | null;
  canAct: boolean;
  refresh: () => Promise<void>;
  markKnown: () => Promise<void>;
};

const initialState: DailyWordState = {
  isLoading: true,
  isSyncPending: false,
  isOptimisticTransition: false,
  profile: null,
  snapshot: null,
};

export function useCurrentWord(): UseCurrentWordReturn {
  const [state, setState] = useState<DailyWordState>(initialState);

  const snapshotRef = useRef<DailyWordSnapshot | null>(null);
  snapshotRef.current = state.snapshot;

  const profileRef = useRef<UserProfile | null>(null);
  profileRef.current = state.profile;

  const actionQueueRef = useRef<"known"[]>([]);
  const processingQueueRef = useRef(false);
  /**
   * Synchronous guard: while queue is empty during await applyDailyWordAction, a second tap
   * would otherwise pass the queue-length check and double-advance optimistically.
   */
  const markKnownSyncLockRef = useRef(false);
  /** Invalidates in-flight post-mark display enrichment (refresh or newer mark). */
  const displayEnrichmentGenRef = useRef(0);
  /** Invalidates in-flight prefetch-head enrichment when sense_id / deps change. */
  const prefetchEnrichGenRef = useRef(0);

  const refresh = useCallback(async () => {
    actionQueueRef.current = [];
    markKnownSyncLockRef.current = false;
    displayEnrichmentGenRef.current += 1;
    prefetchEnrichGenRef.current += 1;
    const prevProfile = profileRef.current;
    const profile = await getUserProfile();
    if (!profile) {
      clearDailyWordSessionProgress();
      logger.info(LogTag.WORD_FLOW, "Refresh skipped (no profile)");
      setState({
        isLoading: false,
        isSyncPending: false,
        isOptimisticTransition: false,
        profile: null,
        snapshot: null,
      });
      await syncWidgetSnapshotFromApp();
      return;
    }
    if (prevProfile?.userId && prevProfile.userId !== profile.userId) {
      clearDailyWordSessionProgress(prevProfile.userId);
    }

    const tTotal = nowMs();

    await logger.groupAsync("WORD FLOW — Word of the Day load", async () => {
      logger.info(LogTag.WORD_FLOW, "Checking cache");
      const tCache = nowMs();
      const cachedPayload = await getCachedCurrentWord(profile);
      logger.perf("cache-read", nowMs() - tCache);

      const cacheOk =
        cachedPayload &&
        isCurrentWordCacheValidForToday(cachedPayload) &&
        cachedPayload.snapshot;

      if (cacheOk) {
        logger.info(LogTag.WORD_FLOW, "Cache hit (valid for today)");
        logger.info(LogTag.WORD_FLOW, "Rendering cached word");
        setState({
          isLoading: false,
          isSyncPending: false,
          isOptimisticTransition: false,
          profile,
          snapshot: cachedPayload.snapshot,
        });
        logger.perf("total-load-time-to-usable-ui", nowMs() - tTotal);

        await syncWidgetSnapshotFromApp();

        void (async () => {
          logger.info(LogTag.WORD_FLOW, "Starting Supabase fetch (background)");
          const tFetch = nowMs();
          try {
            const fresh = await fetchCurrentWord(profile);
            logger.perf("supabase-fetch-background", nowMs() - tFetch);
            await setCachedCurrentWord(profile, fresh);
            setState((prev) => {
              if (
                prev.snapshot &&
                fresh.stateVersion < prev.snapshot.stateVersion
              ) {
                logger.info(
                  LogTag.WORD_FLOW,
                  "Background fetch discarded (older stateVersion than current UI; likely raced optimistic advance)",
                );
                return prev;
              }
              if (
                prev.snapshot?.stateVersion === fresh.stateVersion &&
                prev.snapshot?.activeWord?.id === fresh.activeWord?.id &&
                prev.snapshot?.updatedAt === fresh.updatedAt
              ) {
                logger.info(
                  LogTag.WORD_FLOW,
                  "Background fetch: no snapshot change; UI unchanged",
                );
                return prev;
              }
              logger.info(
                LogTag.WORD_FLOW,
                "Word updated from backend (silent refresh)",
              );
              return { ...prev, snapshot: fresh, profile };
            });
          } catch (e) {
            logger.warn(LogTag.WORD_FLOW, "Background fetch failed", e);
          }
          await syncWidgetSnapshotFromApp();
        })();
        return;
      }

      logger.info(LogTag.WORD_FLOW, "Cache miss or stale (network required)");
      logger.info(LogTag.WORD_FLOW, "Starting Supabase fetch (blocking)");
      const tFetch = nowMs();
      const snapshot = await getDailyWordSnapshot(profile);
      logger.perf("supabase-fetch-blocking", nowMs() - tFetch);

      await setCachedCurrentWord(profile, snapshot);
      setState({
        isLoading: false,
        isSyncPending: false,
        isOptimisticTransition: false,
        profile,
        snapshot,
      });
      logger.info(LogTag.WORD_FLOW, "Word ready from network");
      logger.perf("total-load-time-to-usable-ui", nowMs() - tTotal);
      await syncWidgetSnapshotFromApp();
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(PROFILE_SETTINGS_SAVED, () => {
      logger.info(LogTag.WORD_FLOW, "Profile saved — refreshing word");
      void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  /** Calendar rollover: resolve whenever the app returns to foreground (mandatory path). */
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") {
        return;
      }
      if (debounce) {
        clearTimeout(debounce);
      }
      debounce = setTimeout(() => {
        debounce = undefined;
        void refresh();
      }, 400);
    });
    return () => {
      if (debounce) {
        clearTimeout(debounce);
      }
      sub.remove();
    };
  }, [refresh]);

  /**
   * Optional: schedule one refresh shortly after local midnight while the app stays open.
   * Startup + resume remain the primary rollover detectors.
   */
  useEffect(() => {
    if (!state.profile?.userId) {
      return;
    }
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const armNextMidnight = () => {
      const ms = msUntilNextLocalMidnight(getEffectiveNow());
      timeoutId = setTimeout(() => {
        if (cancelled) {
          return;
        }
        void refresh();
        if (!cancelled) {
          armNextMidnight();
        }
      }, ms + 500);
    };

    armNextMidnight();
    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [state.profile?.userId, refresh]);

  /** While user reads the current card, cheaply enrich only the next queued card (prefetch queue head). */
  useEffect(() => {
    if (state.isSyncPending) {
      return;
    }
    const snap = state.snapshot;
    const profile = state.profile;
    if (!snap || !profile || !snap.prefetch?.knownQueue[0]) {
      return;
    }
    const next = snap.prefetch.knownQueue[0];
    if (next.exampleSource?.trim()) {
      return;
    }

    let cancelled = false;
    const gen = (prefetchEnrichGenRef.current += 1);
    const t0 = nowMs();
    void enrichVocabularyWordsForHomeDisplay(profile, [next]).then((rows) => {
      if (cancelled || rows.length === 0) {
        return;
      }
      if (gen !== prefetchEnrichGenRef.current) {
        return;
      }
      const enriched = rows[0];
      logger.perf("prefetch-next-card-enrichment", nowMs() - t0);
      setState((prev) => {
        if (!prev.snapshot?.prefetch?.knownQueue[0]) {
          return prev;
        }
        if (prev.snapshot.prefetch.knownQueue[0].id !== next.id) {
          return prev;
        }
        return {
          ...prev,
          snapshot: {
            ...prev.snapshot,
            prefetch: {
              knownQueue: [
                enriched,
                ...prev.snapshot.prefetch.knownQueue.slice(1),
              ],
            },
          },
        };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [
    state.isSyncPending,
    state.snapshot?.activeWord?.id,
    state.snapshot?.prefetch?.knownQueue[0]?.id,
    state.profile?.userId,
  ]);

  const processActionQueue = useCallback(async () => {
    if (processingQueueRef.current) {
      return;
    }
    processingQueueRef.current = true;
    try {
      while (actionQueueRef.current.length > 0) {
        actionQueueRef.current.shift();
        const profile = await getUserProfile();
        if (!profile) {
          actionQueueRef.current = [];
          setState((prev) => ({
            ...prev,
            isSyncPending: false,
            isOptimisticTransition: false,
          }));
          break;
        }
        try {
          /** UI snapshot before remote round-trip; avoids merge with a ref mutated by refresh/background fetch. */
          const uiMergeBase = snapshotRef.current;
          const tSync = nowMs();
          const serverSnapshot = await applyDailyWordAction(profile);
          logger.perf("sync-daily-action-remote", nowMs() - tSync);
          const freshProfile = await getUserProfile();
          const mergedSnapshot = mergeDailySnapshotPreservingDisplayEnrichment(
            uiMergeBase,
            serverSnapshot,
          );
          await setCachedCurrentWord(profile, mergedSnapshot);
          setState((prev) => ({
            ...prev,
            profile: freshProfile ?? prev.profile,
            snapshot: mergedSnapshot,
          }));

          const enrichKey = mergedSnapshot.activeWord?.id ?? "";
          const enrichGen = (displayEnrichmentGenRef.current += 1);
          void (async () => {
            const tEnrich = nowMs();
            try {
              const enriched = await enrichDailySnapshotForDisplay(
                profile,
                mergedSnapshot,
              );
              logger.perf(
                "card-display-enrichment-after-mark",
                nowMs() - tEnrich,
              );
              setState((prev) => {
                if (enrichGen !== displayEnrichmentGenRef.current) {
                  return prev;
                }
                if (!prev.snapshot?.activeWord) {
                  return prev;
                }
                if (prev.snapshot.activeWord.id !== enrichKey) {
                  return prev;
                }
                return { ...prev, snapshot: enriched };
              });
            } catch (err) {
              logger.warn(LogTag.CARD_FLOW, "Background display enrichment failed", err);
            }
          })();
        } catch (e) {
          logger.error(
            LogTag.USER_ACTION,
            "Supabase write failure (daily word action)",
            e,
          );
          actionQueueRef.current = [];
          setState((prev) => ({
            ...prev,
            isSyncPending: false,
            isOptimisticTransition: false,
          }));
          logger.warn(
            LogTag.USER_ACTION,
            "Keeping optimistic next-card UI; disk cache was not updated. Skipping refresh() to avoid reverting the card and blocking on a full snapshot fetch (typical cause of duplicate Supabase traffic after a transient network error).",
          );
          return;
        }
      }
    } finally {
      await syncWidgetSnapshotFromApp();
      processingQueueRef.current = false;
      markKnownSyncLockRef.current = false;
      if (actionQueueRef.current.length > 0) {
        void processActionQueue();
      } else {
        setState((prev) => ({
          ...prev,
          isSyncPending: false,
          isOptimisticTransition: false,
        }));
      }
    }
  }, []);

  const markKnown = useCallback(async () => {
    const snap = snapshotRef.current;
    if (!snap?.activeWord) {
      return;
    }

    let profile = profileRef.current;
    if (!profile) {
      profile = await getUserProfile();
    }
    if (!profile) {
      return;
    }

    if (markKnownSyncLockRef.current) {
      return;
    }
    if (actionQueueRef.current.length > 0) {
      return;
    }

    markKnownSyncLockRef.current = true;

    const optimistic = applyOptimisticDailySnapshot(snap);
    if (optimistic) {
      const w = snap.activeWord;
      if (w) {
        void mergeKnownWordIntoCache(
          profile.userId,
          w,
          buildOptimisticKnownUserProgress(w.id, undefined),
        ).then(() => {
          emitWordProgressUpdated();
        });
      }
      setState((prev) => ({
        ...prev,
        profile,
        snapshot: optimistic,
        isSyncPending: true,
        isOptimisticTransition: true,
      }));
    } else {
      void syncWidgetLoadingSnapshot();
      setState((prev) => ({
        ...prev,
        profile,
        isSyncPending: true,
        isOptimisticTransition: false,
      }));
    }

    actionQueueRef.current.push("known");
    void processActionQueue();
  }, [processActionQueue]);

  const canAct = useMemo(
    () => Boolean(state.snapshot?.activeWord),
    [state.snapshot?.activeWord],
  );

  const showBlockingLoadingUi = useMemo(
    () => state.isSyncPending && !state.isOptimisticTransition,
    [state.isSyncPending, state.isOptimisticTransition],
  );

  return {
    isLoading: state.isLoading,
    isSyncPending: state.isSyncPending,
    isOptimisticTransition: state.isOptimisticTransition,
    showBlockingLoadingUi,
    profile: state.profile,
    snapshot: state.snapshot,
    canAct,
    refresh,
    markKnown,
  };
}
